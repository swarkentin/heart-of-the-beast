package httpapi

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/swarkentin/heart-of-the-beast/backend/internal/game"
	"github.com/swarkentin/heart-of-the-beast/backend/internal/store"
)

type healthResponse struct {
	Status  string `json:"status"`
	Service string `json:"service"`
}

type Handler struct {
	rooms store.Repository
	now   func() time.Time
}

func NewHandler(rooms store.Repository) http.Handler {
	return NewHandlerWithClock(rooms, time.Now)
}

// NewHandlerWithClock injects the time source so time-dependent API behavior can be tested deterministically.
func NewHandlerWithClock(rooms store.Repository, now func() time.Time) http.Handler {
	if now == nil {
		now = time.Now
	}
	h := &Handler{rooms: rooms, now: now}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", health)
	mux.HandleFunc("POST /rooms", h.createRoom)
	mux.HandleFunc("POST /rooms/join", h.joinRoom)
	mux.HandleFunc("GET /rooms/{id}", h.getRoom)
	mux.HandleFunc("POST /rooms/{id}/heartbeat", h.heartbeat)
	mux.HandleFunc("POST /rooms/{id}/leave", h.leaveRoom)
	mux.HandleFunc("POST /rooms/{id}/start", h.startRun)
	mux.HandleFunc("POST /rooms/{id}/commands", h.command)
	mux.HandleFunc("GET /spectate/{id}", h.spectate)
	return mux
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
	ID            string                            `json:"id"`
	Code          string                            `json:"code"`
	OwnerPlayerID string                            `json:"ownerPlayerId"`
	PlayerIDs     []string                          `json:"playerIds"`
	Presence      map[string]playerPresenceResponse `json:"presence"`
	Run           *game.Run                         `json:"run,omitempty"`
	Version       int64                             `json:"version"`
	CreatedAt     time.Time                         `json:"createdAt"`
	UpdatedAt     time.Time                         `json:"updatedAt"`
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
		PlayerIDs: room.PlayerIDs, Presence: presence, Run: room.Run,
		Version: room.Version, CreatedAt: room.CreatedAt, UpdatedAt: room.UpdatedAt,
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
		Presence:           map[string]game.PlayerPresence{playerID: {LastSeenAt: now}},
		SpectatorTokenHash: tokenHash(spectatorToken),
		Version:            1,
		CreatedAt:          now,
		UpdatedAt:          now,
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
	expected := room.Version
	room.PlayerIDs = append(room.PlayerIDs, playerID)
	if room.PlayerTokenHashes == nil {
		room.PlayerTokenHashes = make(map[string]string)
	}
	room.PlayerTokenHashes[playerID] = tokenHash(playerToken)
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
	if !game.AdvanceCombatRound(room, h.now().UTC()) {
		return room, nil
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
	return room, nil
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
	expected := room.Version
	runID, err := randomToken(16)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not start run")
		return
	}
	if err := game.StartRun(room, runID, h.now().UTC()); err != nil {
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
