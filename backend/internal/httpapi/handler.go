package httpapi

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"
	"unicode"

	"github.com/swarkentin/heart-of-the-beast/backend/internal/game"
	"github.com/swarkentin/heart-of-the-beast/backend/internal/store"
)

type healthResponse struct {
	Status  string `json:"status"`
	Service string `json:"service"`
}

type Handler struct {
	rooms   store.Repository
	now     func() time.Time
	discord *DiscordConfig
}

// Options configures optional handler behavior.
type Options struct {
	// Now is the time source; nil uses time.Now.
	Now func() time.Time
	// Discord enables "Sign in with Discord" (ADR 0034); nil disables it.
	Discord *DiscordConfig
}

func NewHandler(rooms store.Repository) http.Handler {
	return NewHandlerWithOptions(rooms, Options{})
}

// NewHandlerWithClock injects the time source so time-dependent API behavior can be tested deterministically.
func NewHandlerWithClock(rooms store.Repository, now func() time.Time) http.Handler {
	return NewHandlerWithOptions(rooms, Options{Now: now})
}

func NewHandlerWithOptions(rooms store.Repository, options Options) http.Handler {
	now := options.Now
	if now == nil {
		now = time.Now
	}
	h := &Handler{rooms: rooms, now: now, discord: options.Discord}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", health)
	mux.HandleFunc("POST /rooms", h.createRoom)
	mux.HandleFunc("POST /rooms/join", h.joinRoom)
	mux.HandleFunc("GET /rooms/{id}", h.getRoom)
	mux.HandleFunc("POST /rooms/{id}/heartbeat", h.heartbeat)
	mux.HandleFunc("POST /rooms/{id}/leave", h.leaveRoom)
	mux.HandleFunc("POST /rooms/{id}/start", h.startRun)
	mux.HandleFunc("POST /rooms/{id}/return-to-lobby", h.returnToLobby)
	mux.HandleFunc("POST /rooms/{id}/archetype", h.selectArchetype)
	mux.HandleFunc("POST /rooms/{id}/class", h.selectClass)
	mux.HandleFunc("POST /rooms/{id}/loadout", h.selectLoadout)
	mux.HandleFunc("GET /progression", progressionCatalog)
	mux.HandleFunc("POST /profile", h.createOrGetProfile)
	mux.HandleFunc("GET /profile", h.getProfile)
	mux.HandleFunc("PATCH /profile", h.updateProfile)
	mux.HandleFunc("GET /auth/providers", authProviders(h))
	mux.HandleFunc("POST /auth/discord/start", h.startDiscordSignIn)
	mux.HandleFunc("POST /auth/discord/complete", h.completeDiscordSignIn)
	mux.HandleFunc("POST /auth/discord/resolve", h.resolveDiscordSignIn)
	mux.HandleFunc("GET /themes", playableThemes)
	mux.HandleFunc("POST /rooms/{id}/commands", h.command)
	mux.HandleFunc("GET /spectate/{id}", h.spectate)
	return mux
}

// createOrGetProfile bootstraps or resumes an anonymous profile using a
// browser-held bearer credential. The server stores only its SHA-256 hash.
func (h *Handler) createOrGetProfile(w http.ResponseWriter, r *http.Request) {
	credential := bearer(r)
	if len(credential) < 32 || len(credential) > 256 {
		writeError(w, http.StatusUnauthorized, "a valid guest profile credential is required")
		return
	}
	profiles, ok := h.rooms.(store.ProfileRepository)
	if !ok {
		writeError(w, http.StatusServiceUnavailable, "profile persistence is unavailable")
		return
	}
	id, err := randomToken(16)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not initialize profile")
		return
	}
	profile, err := profiles.GetOrCreateProfile(r.Context(), id, tokenHash(credential), h.now().UTC())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not initialize profile")
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, h.withAccounts(r.Context(), profile))
}

func (h *Handler) getProfile(w http.ResponseWriter, r *http.Request) {
	credential := bearer(r)
	if len(credential) < 32 || len(credential) > 256 {
		writeError(w, http.StatusUnauthorized, "a valid guest profile credential is required")
		return
	}
	profiles, ok := h.rooms.(store.ProfileRepository)
	if !ok {
		writeError(w, http.StatusServiceUnavailable, "profile persistence is unavailable")
		return
	}
	profile, err := profiles.GetProfile(r.Context(), tokenHash(credential))
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "guest profile not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load profile")
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, h.withAccounts(r.Context(), profile))
}

func (h *Handler) updateProfile(w http.ResponseWriter, r *http.Request) {
	credential := bearer(r)
	if len(credential) < 32 || len(credential) > 256 {
		writeError(w, http.StatusUnauthorized, "a valid guest profile credential is required")
		return
	}
	var request struct {
		DisplayName string `json:"displayName"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 4096)).Decode(&request); err != nil {
		writeError(w, http.StatusBadRequest, "a display name is required")
		return
	}
	name := strings.TrimSpace(request.DisplayName)
	if name == "" || len([]rune(name)) > 18 {
		writeError(w, http.StatusBadRequest, "name must be between 1 and 18 characters")
		return
	}
	for _, character := range name {
		if unicode.IsControl(character) {
			writeError(w, http.StatusBadRequest, "name contains invalid characters")
			return
		}
	}
	profiles, ok := h.rooms.(store.ProfileRepository)
	if !ok {
		writeError(w, http.StatusServiceUnavailable, "profile persistence is unavailable")
		return
	}
	profile, err := profiles.UpdateProfileName(r.Context(), tokenHash(credential), name, h.now().UTC())
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "guest profile not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not update profile")
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, h.withAccounts(r.Context(), profile))
}

func health(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(healthResponse{Status: "ok", Service: "heart-of-the-beast"})
}

type playerPresenceResponse struct {
	Status     string     `json:"status"`
	LastSeenAt time.Time  `json:"lastSeenAt"`
	LeftAt     *time.Time `json:"leftAt,omitempty"`
}

type roomResponse struct {
	ID             string                            `json:"id"`
	Code           string                            `json:"code"`
	OwnerPlayerID  string                            `json:"ownerPlayerId"`
	PlayerIDs      []string                          `json:"playerIds"`
	PlayerClasses  map[string]string                 `json:"playerClasses,omitempty"`
	PlayerSkins    map[string]game.PlayerSkin        `json:"playerSkins,omitempty"`
	PlayerLoadouts map[string][]string               `json:"playerLoadouts,omitempty"`
	PlayerMastery  map[string]int                    `json:"playerMastery,omitempty"`
	Presence       map[string]playerPresenceResponse `json:"presence"`
	Run            *game.Run                         `json:"run,omitempty"`
	// RunProgress is the persistent experience a finished run earned each adventurer who stayed to its end.
	RunProgress *game.RunProgress `json:"runProgress,omitempty"`
	Version     int64             `json:"version"`
	CreatedAt   time.Time         `json:"createdAt"`
	UpdatedAt   time.Time         `json:"updatedAt"`
}

const presenceTimeout = 30 * time.Second

func publicRoom(room *game.Room, now time.Time) roomResponse {
	now = now.UTC()
	presence := make(map[string]playerPresenceResponse, len(room.PlayerIDs))
	for _, playerID := range room.PlayerIDs {
		entry := room.Presence[playerID]
		status := "disconnected"
		if entry.LeftAt != nil {
			status = "left"
		} else if !entry.LastSeenAt.IsZero() && now.Sub(entry.LastSeenAt) <= presenceTimeout {
			status = "online"
		}
		presence[playerID] = playerPresenceResponse{Status: status, LastSeenAt: entry.LastSeenAt, LeftAt: entry.LeftAt}
	}
	return roomResponse{
		ID: room.ID, Code: room.Code, OwnerPlayerID: room.OwnerPlayerID,
		PlayerIDs: room.PlayerIDs, PlayerClasses: room.PlayerClasses, PlayerSkins: room.PlayerSkins, PlayerLoadouts: room.PlayerLoadouts, PlayerMastery: room.PlayerMastery, Presence: presence, Run: room.Run,
		RunProgress: game.RunProgressOf(room.Run),
		Version:     room.Version, CreatedAt: room.CreatedAt, UpdatedAt: room.UpdatedAt,
	}
}

func randomToken(bytes int) (string, error) {
	raw := make([]byte, bytes)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	return hex.EncodeToString(raw), nil
}

func tokenHash(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func bearer(r *http.Request) string {
	value := r.Header.Get("Authorization")
	if !strings.HasPrefix(value, "Bearer ") {
		return ""
	}
	return strings.TrimSpace(strings.TrimPrefix(value, "Bearer "))
}

func (h *Handler) authorizedPlayer(w http.ResponseWriter, r *http.Request) (*game.Room, string, bool) {
	room, err := h.rooms.Get(r.Context(), r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusNotFound, "room not found")
		return nil, "", false
	}
	hash := tokenHash(bearer(r))
	for playerID, expected := range room.PlayerTokenHashes {
		if hash == expected {
			return room, playerID, true
		}
	}
	writeError(w, http.StatusUnauthorized, "invalid player token")
	return nil, "", false
}

// classMasteryLevel is the authoritative mastery level the caller has in a class.
// The profile must be the one this player joined the room with; without a
// profile every class is at level 1, so only the starting look is available.
func (h *Handler) classMasteryLevel(r *http.Request, room *game.Room, playerID, classID string) int {
	credential := r.Header.Get("X-Guest-Profile-Credential")
	profiles, ok := h.rooms.(store.ProfileRepository)
	if !ok || len(credential) < 32 || len(credential) > 256 {
		return 1
	}
	profile, err := profiles.GetProfile(r.Context(), tokenHash(credential))
	if err != nil || profile.ID != room.PlayerProfileIDs[playerID] {
		return 1
	}
	if level := profile.ClassMastery[classID].Level; level > 1 {
		return level
	}
	return 1
}

// guestProfileID resolves the browser-held profile credential to a server-owned
// profile ID. Missing/unavailable profiles do not prevent room play.
func (h *Handler) guestProfileID(r *http.Request) string {
	credential := r.Header.Get("X-Guest-Profile-Credential")
	if len(credential) < 32 || len(credential) > 256 {
		return ""
	}
	profiles, ok := h.rooms.(store.ProfileRepository)
	if !ok {
		return ""
	}
	id, err := randomToken(16)
	if err != nil {
		return ""
	}
	profile, err := profiles.GetOrCreateProfile(r.Context(), id, tokenHash(credential), h.now().UTC())
	if err != nil {
		return ""
	}
	return profile.ID
}

func (h *Handler) awardRunProgress(ctx context.Context, room *game.Room) error {
	if room == nil || room.Run == nil || (room.Run.Phase != game.PhaseCompleted && room.Run.Phase != game.PhaseFailed) {
		return nil
	}
	profiles, ok := h.rooms.(store.ProfileRepository)
	if !ok {
		return nil
	}
	// Failed runs still earn progress for what the party achieved before it fell, and an expedition that got
	// further earns more: see game.RunProgressXP.
	xp := game.RunProgressXP(room.Run)
	if xp == 0 {
		return nil
	}
	for playerID, profileID := range room.PlayerProfileIDs {
		if profileID == "" || room.Presence[playerID].LeftAt != nil {
			continue
		}
		player := room.Run.Players[playerID]
		if player == nil {
			continue
		}
		classID := ""
		if player.ClassBuild != nil {
			classID = player.ClassBuild.ClassID
		}
		if _, err := profiles.AwardRunXP(ctx, profileID, room.Run.ID, playerID, classID, xp, h.now().UTC()); err != nil {
			return err
		}
	}
	return nil
}

func (h *Handler) createRoom(w http.ResponseWriter, r *http.Request) {
	roomID, err := randomToken(16)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not create room")
		return
	}
	playerID, err := randomToken(8)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not create room")
		return
	}
	playerToken, err := randomToken(32)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not create room")
		return
	}
	spectatorToken, err := randomToken(32)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not create room")
		return
	}
	code, err := randomToken(3)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not create room")
		return
	}
	now := h.now().UTC()
	room := &game.Room{
		ID:                 roomID,
		Code:               strings.ToUpper(code),
		OwnerPlayerID:      playerID,
		PlayerIDs:          []string{playerID},
		PlayerTokenHashes:  map[string]string{playerID: tokenHash(playerToken)},
		PlayerProfileIDs:   map[string]string{},
		Presence:           map[string]game.PlayerPresence{playerID: {LastSeenAt: now}},
		SpectatorTokenHash: tokenHash(spectatorToken),
		Version:            1,
		CreatedAt:          now,
		UpdatedAt:          now,
	}
	if profileID := h.guestProfileID(r); profileID != "" {
		room.PlayerProfileIDs[playerID] = profileID
	}
	if err := h.rooms.Create(r.Context(), room); err != nil {
		writeError(w, http.StatusInternalServerError, "could not create room")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{
		"room":           publicRoom(room, h.now()),
		"playerToken":    playerToken,
		"spectatorToken": spectatorToken,
	})
}

const maxRoomPlayers = 4

type joinRoomRequest struct {
	Code string `json:"code"`
}

func (h *Handler) joinRoom(w http.ResponseWriter, r *http.Request) {
	var request joinRoomRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1024)).Decode(&request); err != nil {
		writeError(w, http.StatusBadRequest, "enter a valid room code")
		return
	}
	code := strings.ToUpper(strings.TrimSpace(request.Code))
	if len(code) != 6 {
		writeError(w, http.StatusBadRequest, "room codes must be six characters")
		return
	}
	room, err := h.rooms.GetByCode(r.Context(), code)
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "room not found; check the code and try again")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not find room")
		return
	}
	if room.Run != nil {
		writeError(w, http.StatusConflict, "this run has already started; new players can join at a future safe checkpoint")
		return
	}
	if activePlayerCount(room) >= maxRoomPlayers {
		writeError(w, http.StatusConflict, "this room is full")
		return
	}
	playerID, err := randomToken(8)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not join room")
		return
	}
	playerToken, err := randomToken(32)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not join room")
		return
	}
	profileID := h.guestProfileID(r)
	if profileID != "" {
		for _, existingProfileID := range room.PlayerProfileIDs {
			if existingProfileID == profileID {
				writeError(w, http.StatusConflict, "this guest profile is already in the room")
				return
			}
		}
	}
	expected := room.Version
	room.PlayerIDs = append(room.PlayerIDs, playerID)
	if room.PlayerTokenHashes == nil {
		room.PlayerTokenHashes = make(map[string]string)
	}
	room.PlayerTokenHashes[playerID] = tokenHash(playerToken)
	if profileID != "" {
		if room.PlayerProfileIDs == nil {
			room.PlayerProfileIDs = make(map[string]string)
		}
		room.PlayerProfileIDs[playerID] = profileID
	}
	if room.Presence == nil {
		room.Presence = make(map[string]game.PlayerPresence)
	}
	room.Presence[playerID] = game.PlayerPresence{LastSeenAt: h.now().UTC()}
	room.Version++
	room.UpdatedAt = h.now().UTC()
	if err := h.rooms.Save(r.Context(), room, expected); err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{
		"room":        publicRoom(room, h.now()),
		"playerId":    playerID,
		"playerToken": playerToken,
	})
}

func activePlayerCount(room *game.Room) int {
	active := 0
	for _, playerID := range room.PlayerIDs {
		if room.Presence[playerID].LeftAt == nil {
			active++
		}
	}
	return active
}

func (h *Handler) heartbeat(w http.ResponseWriter, r *http.Request) {
	h.updatePlayerPresence(w, r, false)
}

func (h *Handler) leaveRoom(w http.ResponseWriter, r *http.Request) {
	h.updatePlayerPresence(w, r, true)
}

// Retry optimistic conflicts because multiple party members can heartbeat at once.
func (h *Handler) updatePlayerPresence(w http.ResponseWriter, r *http.Request, leaving bool) {
	for attempt := 0; attempt < 4; attempt++ {
		room, err := h.rooms.Get(r.Context(), r.PathValue("id"))
		if err != nil {
			writeError(w, http.StatusNotFound, "room not found")
			return
		}
		hash := tokenHash(bearer(r))
		playerID := ""
		for id, expected := range room.PlayerTokenHashes {
			if hash == expected {
				playerID = id
				break
			}
		}
		if playerID == "" {
			writeError(w, http.StatusUnauthorized, "invalid player token")
			return
		}
		if room.Presence == nil {
			room.Presence = make(map[string]game.PlayerPresence)
		}
		presence := room.Presence[playerID]
		if presence.LeftAt != nil {
			writeError(w, http.StatusConflict, "player has already left the room")
			return
		}
		now := h.now().UTC()
		if !leaving {
			if err := h.rooms.TouchPlayer(r.Context(), room.ID, playerID, now); err != nil {
				if errors.Is(err, store.ErrPlayerLeft) {
					writeError(w, http.StatusUnauthorized, "player token is no longer active")
					return
				}
				writeStoreError(w, err)
				return
			}
			latest, err := h.rooms.Get(r.Context(), room.ID)
			if err != nil {
				writeStoreError(w, err)
				return
			}
			// A heartbeat can observe the terminal room between its save and the
			// command handler's progression award. Make terminal snapshots safe
			// for clients to use as the signal to refresh their profile.
			if err := h.awardRunProgress(r.Context(), latest); err != nil {
				writeError(w, http.StatusInternalServerError, "could not save progression")
				return
			}
			writeJSON(w, http.StatusOK, publicRoom(latest, h.now()))
			return
		}
		presence.LastSeenAt = now
		presence.LeftAt = &now
		room.Presence[playerID] = presence
		delete(room.PlayerTokenHashes, playerID)
		expectedVersion := room.Version
		room.Version++
		room.UpdatedAt = now
		if err := h.rooms.Save(r.Context(), room, expectedVersion); err != nil {
			if errors.Is(err, store.ErrConflict) {
				continue
			}
			writeStoreError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, publicRoom(room, h.now()))
		return
	}
	writeError(w, http.StatusConflict, "room is busy; retry the presence update")
}

func (h *Handler) getRoom(w http.ResponseWriter, r *http.Request) {
	room, _, ok := h.authorizedPlayer(w, r)
	if !ok {
		return
	}
	room, err := h.advanceRoomIfDue(r, room)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, publicRoom(room, h.now()))
}

func (h *Handler) advanceRoomIfDue(r *http.Request, room *game.Room) (*game.Room, error) {
	now := h.now().UTC()
	changed := game.AdvanceCombatRound(room, now)
	if game.AdvanceNavigationVote(room, now) {
		changed = true
	}
	if game.AdvanceRoomEventVote(room, now) {
		changed = true
	}
	if game.AdvanceInterFloorChoice(room, now) {
		changed = true
	}
	if game.AdvanceCamp(room, now) {
		changed = true
	}
	if !changed {
		return room, h.awardRunProgress(r.Context(), room)
	}
	expected := room.Version
	room.Version++
	room.UpdatedAt = h.now().UTC()
	if err := h.rooms.Save(r.Context(), room, expected); err != nil {
		if errors.Is(err, store.ErrConflict) {
			return h.rooms.Get(r.Context(), room.ID)
		}
		return nil, err
	}
	return room, h.awardRunProgress(r.Context(), room)
}

type archetypeRequest struct {
	Archetype string `json:"archetype"`
}

type loadoutRequest struct {
	SkillIDs []string `json:"skillIds"`
}

type classRequest struct {
	ClassID string `json:"classId"`
	// Tier and Variant choose the look; omitted, the best unlocked armour in the class colours is worn.
	Tier    int    `json:"tier,omitempty"`
	Variant string `json:"variant,omitempty"`
	// SkillIDs optionally chooses the skill bar; omitted or no longer valid, the class's default bar is used.
	SkillIDs []string `json:"skillIds,omitempty"`
}

// selectClass validates the stable content ID and availability on the server;
// client-provided stats, equipment, and ability definitions are never accepted.
func (h *Handler) selectClass(w http.ResponseWriter, r *http.Request) {
	_, actor, ok := h.authorizedPlayer(w, r)
	if !ok {
		return
	}
	var request classRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1024)).Decode(&request); err != nil {
		writeError(w, http.StatusBadRequest, "choose a valid class")
		return
	}
	for attempt := 0; attempt < 4; attempt++ {
		room, err := h.rooms.Get(r.Context(), r.PathValue("id"))
		if err != nil {
			writeError(w, http.StatusNotFound, "room not found")
			return
		}
		if _, active := room.PlayerTokenHashes[actor]; !active {
			writeError(w, http.StatusUnauthorized, "player token is no longer active")
			return
		}
		expected := room.Version
		if err := game.SelectClass(room, actor, request.ClassID); err != nil {
			writeError(w, http.StatusConflict, err.Error())
			return
		}
		mastery := h.classMasteryLevel(r, room, actor, request.ClassID)
		game.SetPlayerMastery(room, actor, mastery)
		if len(request.SkillIDs) > 0 {
			// A remembered bar may hold skills this profile has not earned: fall back to the default bar.
			_ = game.SetPlayerLoadout(room, actor, request.SkillIDs)
		}
		skin := game.PlayerSkin{Tier: request.Tier, Variant: request.Variant}
		if skin.Tier == 0 {
			skin.Tier = game.HighestUnlockedSkinTier(mastery)
		}
		if skin.Variant == "" {
			skin.Variant = game.DefaultSkinColour
		}
		if err := game.SelectPlayerSkin(room, actor, skin, mastery); err != nil {
			writeError(w, http.StatusConflict, err.Error())
			return
		}
		room.Version++
		room.UpdatedAt = h.now().UTC()
		if err := h.rooms.Save(r.Context(), room, expected); err != nil {
			if errors.Is(err, store.ErrConflict) {
				continue
			}
			writeStoreError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, publicRoom(room, h.now()))
		return
	}
	writeError(w, http.StatusConflict, "room is busy; retry the class choice")
}

func progressionCatalog(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"archetypes":        game.ArchetypeCatalog(),
		"classes":           game.ClassCatalog(),
		"skills":            game.SkillCatalog(),
		"loadoutSize":       game.MaxLoadoutSkills,
		"classPassives":     game.ClassPassiveCatalog(),
		"equipment":         game.EquipmentCatalog(),
		"classAvailability": game.ClassAvailabilityCatalog(),
		"levelThresholds":   []int{50, 100, 200, 325},
		"profileRewards":    game.ProfileRewardCatalog(),
		"profileXpPerLevel": game.ProfileXPPerLevel,
		"classSkins":        game.ClassSkinCatalogSnapshot(),
	})
}

func (h *Handler) selectArchetype(w http.ResponseWriter, r *http.Request) {
	_, actor, ok := h.authorizedPlayer(w, r)
	if !ok {
		return
	}
	var request archetypeRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1024)).Decode(&request); err != nil {
		writeError(w, http.StatusBadRequest, "choose a valid archetype")
		return
	}
	for attempt := 0; attempt < 4; attempt++ {
		room, err := h.rooms.Get(r.Context(), r.PathValue("id"))
		if err != nil {
			writeError(w, http.StatusNotFound, "room not found")
			return
		}
		if _, active := room.PlayerTokenHashes[actor]; !active {
			writeError(w, http.StatusUnauthorized, "player token is no longer active")
			return
		}
		expected := room.Version
		if err := game.SelectArchetype(room, actor, request.Archetype); err != nil {
			writeError(w, http.StatusConflict, err.Error())
			return
		}
		room.Version++
		room.UpdatedAt = h.now().UTC()
		if err := h.rooms.Save(r.Context(), room, expected); err != nil {
			if errors.Is(err, store.ErrConflict) {
				continue
			}
			writeStoreError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, publicRoom(room, h.now()))
		return
	}
	writeError(w, http.StatusConflict, "room is busy; retry the archetype choice")
}

// selectLoadout chooses the skill bar for the player's class in the lobby. Mastery is re-read from the profile,
// so skills earned since the class was picked are available without picking it again.
func (h *Handler) selectLoadout(w http.ResponseWriter, r *http.Request) {
	_, actor, ok := h.authorizedPlayer(w, r)
	if !ok {
		return
	}
	var request loadoutRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 2048)).Decode(&request); err != nil {
		writeError(w, http.StatusBadRequest, "choose a valid set of skills")
		return
	}
	for attempt := 0; attempt < 4; attempt++ {
		room, err := h.rooms.Get(r.Context(), r.PathValue("id"))
		if err != nil {
			writeError(w, http.StatusNotFound, "room not found")
			return
		}
		if _, active := room.PlayerTokenHashes[actor]; !active {
			writeError(w, http.StatusUnauthorized, "player token is no longer active")
			return
		}
		expected := room.Version
		if classID := room.PlayerClasses[actor]; classID != "" {
			game.SetPlayerMastery(room, actor, h.classMasteryLevel(r, room, actor, classID))
		}
		if err := game.SetPlayerLoadout(room, actor, request.SkillIDs); err != nil {
			writeError(w, http.StatusConflict, err.Error())
			return
		}
		room.Version++
		room.UpdatedAt = h.now().UTC()
		if err := h.rooms.Save(r.Context(), room, expected); err != nil {
			if errors.Is(err, store.ErrConflict) {
				continue
			}
			writeStoreError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, publicRoom(room, h.now()))
		return
	}
	writeError(w, http.StatusConflict, "room is busy; retry the skill choice")
}

type themeResponse struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Tagline string `json:"tagline"`
}

// playableThemes lists the dungeon themes a host can choose when starting a run, default first. randomThemeId is
// the value to send to let the server pick one.
func playableThemes(w http.ResponseWriter, _ *http.Request) {
	themes := game.PlayableDungeonThemes()
	response := make([]themeResponse, 0, len(themes))
	for _, theme := range themes {
		response = append(response, themeResponse{ID: theme.ID, Name: theme.Name, Tagline: theme.Tagline})
	}
	writeJSON(w, http.StatusOK, map[string]any{"defaultThemeId": game.DefaultDungeonThemeID, "randomThemeId": game.RandomDungeonThemeID, "themes": response})
}

func (h *Handler) startRun(w http.ResponseWriter, r *http.Request) {
	room, actor, ok := h.authorizedPlayer(w, r)
	if !ok {
		return
	}
	if actor != room.OwnerPlayerID {
		writeError(w, http.StatusForbidden, "only the room host can start the run")
		return
	}
	// The body is optional: an empty body starts the default theme, and "random" lets the run seed choose.
	var request struct {
		ThemeID string `json:"themeId"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1024)).Decode(&request); err != nil && !errors.Is(err, io.EOF) {
		writeError(w, http.StatusBadRequest, "invalid start request")
		return
	}
	expected := room.Version
	runID, err := randomToken(16)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not start run")
		return
	}
	if err := game.StartMultiLevelRunForTheme(room, runID, request.ThemeID, h.now().UTC()); err != nil {
		if errors.Is(err, game.ErrUnknownDungeonTheme) || errors.Is(err, game.ErrThemeNotPlayable) {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeError(w, http.StatusConflict, err.Error())
		return
	}
	room.Version++
	room.UpdatedAt = h.now().UTC()
	if err := h.rooms.Save(r.Context(), room, expected); err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, publicRoom(room, h.now()))
}

func (h *Handler) returnToLobby(w http.ResponseWriter, r *http.Request) {
	for attempt := 0; attempt < 4; attempt++ {
		room, actor, ok := h.authorizedPlayer(w, r)
		if !ok {
			return
		}
		if actor != room.OwnerPlayerID {
			writeError(w, http.StatusForbidden, "only the room host can return the party to the lobby")
			return
		}
		if room.Run == nil || (room.Run.Phase != game.PhaseCompleted && room.Run.Phase != game.PhaseFailed) {
			writeError(w, http.StatusConflict, "the run has not ended")
			return
		}

		expected := room.Version
		room.Run = nil
		room.Version++
		room.UpdatedAt = h.now().UTC()
		if err := h.rooms.Save(r.Context(), room, expected); err != nil {
			if errors.Is(err, store.ErrConflict) {
				continue
			}
			writeStoreError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, publicRoom(room, h.now()))
		return
	}
	writeError(w, http.StatusConflict, "room is busy; retry returning to the lobby")
}

func (h *Handler) command(w http.ResponseWriter, r *http.Request) {
	room, actor, ok := h.authorizedPlayer(w, r)
	if !ok {
		return
	}
	var err error
	room, err = h.advanceRoomIfDue(r, room)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	var command game.Command
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&command); err != nil {
		writeError(w, http.StatusBadRequest, "invalid command")
		return
	}
	for attempt := 0; attempt < 4; attempt++ {
		expected := room.Version
		if err := game.ApplyCommand(room, actor, command, h.now().UTC()); err != nil {
			writeError(w, http.StatusConflict, err.Error())
			return
		}
		room.Version++
		room.UpdatedAt = h.now().UTC()
		if err := h.rooms.Save(r.Context(), room, expected); err != nil {
			if errors.Is(err, store.ErrConflict) {
				room, err = h.rooms.Get(r.Context(), room.ID)
				if err == nil {
					room, err = h.advanceRoomIfDue(r, room)
				}
				if err == nil {
					continue
				}
			}
			writeStoreError(w, err)
			return
		}
		if err := h.awardRunProgress(r.Context(), room); err != nil {
			writeError(w, http.StatusInternalServerError, "could not save progression")
			return
		}
		writeJSON(w, http.StatusOK, publicRoom(room, h.now()))
		return
	}
	writeError(w, http.StatusConflict, "room is busy; retry the command")
}

func (h *Handler) spectate(w http.ResponseWriter, r *http.Request) {
	room, err := h.rooms.Get(r.Context(), r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusNotFound, "room not found")
		return
	}
	if tokenHash(bearer(r)) != room.SpectatorTokenHash {
		writeError(w, http.StatusUnauthorized, "invalid spectator token")
		return
	}
	room, err = h.advanceRoomIfDue(r, room)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, publicRoom(room, h.now()))
}

func writeStoreError(w http.ResponseWriter, err error) {
	if errors.Is(err, store.ErrConflict) {
		writeError(w, http.StatusConflict, "room changed; refresh and retry")
		return
	}
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "room not found")
		return
	}
	writeError(w, http.StatusInternalServerError, "could not persist room")
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}
