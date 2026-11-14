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
}

func NewHandler(rooms store.Repository) http.Handler {
	h := &Handler{rooms: rooms}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", health)
	mux.HandleFunc("POST /rooms", h.createRoom)
	mux.HandleFunc("POST /rooms/join", h.joinRoom)
	mux.HandleFunc("GET /rooms/{id}", h.getRoom)
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

type roomResponse struct {
	ID            string    `json:"id"`
	Code          string    `json:"code"`
	OwnerPlayerID string    `json:"ownerPlayerId"`
	PlayerIDs     []string  `json:"playerIds"`
	Run           *game.Run `json:"run,omitempty"`
	Version       int64     `json:"version"`
	CreatedAt     time.Time `json:"createdAt"`
	UpdatedAt     time.Time `json:"updatedAt"`
}

func publicRoom(room *game.Room) roomResponse {
	return roomResponse{
		ID:            room.ID,
		Code:          room.Code,
		OwnerPlayerID: room.OwnerPlayerID,
		PlayerIDs:     room.PlayerIDs,
		Run:           room.Run,
		Version:       room.Version,
		CreatedAt:     room.CreatedAt,
		UpdatedAt:     room.UpdatedAt,
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
	now := time.Now().UTC()
	room := &game.Room{
		ID:                 roomID,
		Code:               strings.ToUpper(code),
		OwnerPlayerID:      playerID,
		PlayerIDs:          []string{playerID},
		PlayerTokenHashes:  map[string]string{playerID: tokenHash(playerToken)},
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
		"room":           publicRoom(room),
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
	if len(room.PlayerIDs) >= maxRoomPlayers {
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
	room.Version++
	room.UpdatedAt = time.Now().UTC()
	if err := h.rooms.Save(r.Context(), room, expected); err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{
		"room": publicRoom(room),
		"playerId": playerID,
		"playerToken": playerToken,
	})
}

func (h *Handler) getRoom(w http.ResponseWriter, r *http.Request) {
	room, _, ok := h.authorizedPlayer(w, r)
	if !ok {
		return
	}
	writeJSON(w, http.StatusOK, publicRoom(room))
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
	if err := game.StartRun(room, runID, time.Now().UTC()); err != nil {
		writeError(w, http.StatusConflict, err.Error())
		return
	}
	room.Version++
	room.UpdatedAt = time.Now().UTC()
	if err := h.rooms.Save(r.Context(), room, expected); err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, publicRoom(room))
}

func (h *Handler) command(w http.ResponseWriter, r *http.Request) {
	room, actor, ok := h.authorizedPlayer(w, r)
	if !ok {
		return
	}
	var command game.Command
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&command); err != nil {
		writeError(w, http.StatusBadRequest, "invalid command")
		return
	}
	expected := room.Version
	if err := game.ApplyCommand(room, actor, command, time.Now().UTC()); err != nil {
		writeError(w, http.StatusConflict, err.Error())
		return
	}
	room.Version++
	room.UpdatedAt = time.Now().UTC()
	if err := h.rooms.Save(r.Context(), room, expected); err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, publicRoom(room))
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
	writeJSON(w, http.StatusOK, publicRoom(room))
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
