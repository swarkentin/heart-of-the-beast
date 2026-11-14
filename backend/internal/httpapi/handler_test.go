package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"strings"

	"github.com/swarkentin/heart-of-the-beast/backend/internal/store"
)

func TestHealth(t *testing.T) {
	response := httptest.NewRecorder()
	NewHandler(store.NewMemory()).ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/healthz", nil))
	if response.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", response.Code)
	}
}

func TestRoomLifecycleAndReadOnlySpectator(t *testing.T) {
	handler := NewHandler(store.NewMemory())
	create := httptest.NewRecorder()
	handler.ServeHTTP(create, httptest.NewRequest(http.MethodPost, "/rooms", nil))
	if create.Code != http.StatusCreated {
		t.Fatalf("create room: %d %s", create.Code, create.Body.String())
	}
	var created struct {
		Room struct {
			ID string `json:"id"`
		} `json:"room"`
		PlayerToken    string `json:"playerToken"`
		SpectatorToken string `json:"spectatorToken"`
	}
	if err := json.Unmarshal(create.Body.Bytes(), &created); err != nil {
		t.Fatal(err)
	}
	if created.Room.ID == "" || created.PlayerToken == "" || created.SpectatorToken == "" {
		t.Fatal("create response omitted credentials")
	}

	start := httptest.NewRequest(http.MethodPost, "/rooms/"+created.Room.ID+"/start", nil)
	start.Header.Set("Authorization", "Bearer "+created.PlayerToken)
	startResponse := httptest.NewRecorder()
	handler.ServeHTTP(startResponse, start)
	if startResponse.Code != http.StatusOK {
		t.Fatalf("start run: %d %s", startResponse.Code, startResponse.Body.String())
	}

	spectate := httptest.NewRequest(http.MethodGet, "/spectate/"+created.Room.ID, nil)
	spectate.Header.Set("Authorization", "Bearer "+created.SpectatorToken)
	spectateResponse := httptest.NewRecorder()
	handler.ServeHTTP(spectateResponse, spectate)
	if spectateResponse.Code != http.StatusOK {
		t.Fatalf("spectate: %d %s", spectateResponse.Code, spectateResponse.Body.String())
	}

	invalid := httptest.NewRequest(http.MethodPost, "/rooms/"+created.Room.ID+"/commands", bytes.NewBufferString(`{"type":"combat","action":"attack","targetId":"sentinel"}`))
	invalid.Header.Set("Authorization", "Bearer "+created.SpectatorToken)
	invalidResponse := httptest.NewRecorder()
	handler.ServeHTTP(invalidResponse, invalid)
	if invalidResponse.Code != http.StatusUnauthorized {
		t.Fatalf("spectator command should be rejected, got %d", invalidResponse.Code)
	}
}

func TestPlayersCanJoinLobbyAndShareRun(t *testing.T) {
	handler := NewHandler(store.NewMemory())
	create := httptest.NewRecorder()
	handler.ServeHTTP(create, httptest.NewRequest(http.MethodPost, "/rooms", nil))
	if create.Code != http.StatusCreated { t.Fatalf("create room: %d %s", create.Code, create.Body.String()) }
	var host struct {
		Room struct { ID string `json:"id"`; Code string `json:"code"`; OwnerPlayerID string `json:"ownerPlayerId"`; PlayerIDs []string `json:"playerIds"` } `json:"room"`
		PlayerToken string `json:"playerToken"`
	}
	if err := json.Unmarshal(create.Body.Bytes(), &host); err != nil { t.Fatal(err) }
	joinBody, _ := json.Marshal(map[string]string{"code": strings.ToLower(host.Room.Code)})
	joined := httptest.NewRecorder()
	handler.ServeHTTP(joined, httptest.NewRequest(http.MethodPost, "/rooms/join", bytes.NewReader(joinBody)))
	if joined.Code != http.StatusCreated { t.Fatalf("join room: %d %s", joined.Code, joined.Body.String()) }
	var guest struct {
		Room struct { ID string `json:"id"`; PlayerIDs []string `json:"playerIds"` } `json:"room"`
		PlayerID string `json:"playerId"`
		PlayerToken string `json:"playerToken"`
	}
	if err := json.Unmarshal(joined.Body.Bytes(), &guest); err != nil { t.Fatal(err) }
	if guest.Room.ID != host.Room.ID || len(guest.Room.PlayerIDs) != 2 || guest.PlayerID == "" || guest.PlayerToken == "" { t.Fatalf("unexpected joined response: %+v", guest) }
	start := httptest.NewRequest(http.MethodPost, "/rooms/"+host.Room.ID+"/start", nil)
	start.Header.Set("Authorization", "Bearer "+host.PlayerToken)
	started := httptest.NewRecorder(); handler.ServeHTTP(started, start)
	if started.Code != http.StatusOK { t.Fatalf("host start: %d %s", started.Code, started.Body.String()) }
	get := httptest.NewRequest(http.MethodGet, "/rooms/"+host.Room.ID, nil)
	get.Header.Set("Authorization", "Bearer "+guest.PlayerToken)
	guestSnapshot := httptest.NewRecorder(); handler.ServeHTTP(guestSnapshot, get)
	if guestSnapshot.Code != http.StatusOK { t.Fatalf("guest snapshot: %d %s", guestSnapshot.Code, guestSnapshot.Body.String()) }
	command := httptest.NewRequest(http.MethodPost, "/rooms/"+host.Room.ID+"/commands", bytes.NewBufferString(`{"type":"combat","action":"attack","targetId":"sentinel"}`))
	command.Header.Set("Authorization", "Bearer "+guest.PlayerToken)
	acted := httptest.NewRecorder(); handler.ServeHTTP(acted, command)
	if acted.Code != http.StatusOK { t.Fatalf("guest command: %d %s", acted.Code, acted.Body.String()) }
}

func TestJoinRejectsStartedFullAndUnknownRooms(t *testing.T) {
	handler := NewHandler(store.NewMemory())
	join := func(code string) *httptest.ResponseRecorder {
		body, _ := json.Marshal(map[string]string{"code": code})
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, httptest.NewRequest(http.MethodPost, "/rooms/join", bytes.NewReader(body)))
		return response
	}
	if response := join("ABC123"); response.Code != http.StatusNotFound { t.Fatalf("unknown code: %d", response.Code) }
	create := httptest.NewRecorder(); handler.ServeHTTP(create, httptest.NewRequest(http.MethodPost, "/rooms", nil))
	var created struct {
		Room struct { ID string `json:"id"`; Code string `json:"code"`; PlayerIDs []string `json:"playerIds"` } `json:"room"`
		PlayerToken string `json:"playerToken"`
	}
	if err := json.Unmarshal(create.Body.Bytes(), &created); err != nil { t.Fatal(err) }
	for len(created.Room.PlayerIDs) < maxRoomPlayers {
		response := join(created.Room.Code)
		if response.Code != http.StatusCreated { t.Fatalf("join before full: %d %s", response.Code, response.Body.String()) }
		var payload struct { Room struct { PlayerIDs []string `json:"playerIds"` } `json:"room"` }
		if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil { t.Fatal(err) }
		created.Room.PlayerIDs = payload.Room.PlayerIDs
	}
	if response := join(created.Room.Code); response.Code != http.StatusConflict { t.Fatalf("full room should reject join: %d", response.Code) }
	start := httptest.NewRequest(http.MethodPost, "/rooms/"+created.Room.ID+"/start", nil)
	start.Header.Set("Authorization", "Bearer "+created.PlayerToken)
	started := httptest.NewRecorder(); handler.ServeHTTP(started, start)
	if started.Code != http.StatusOK { t.Fatalf("start: %d %s", started.Code, started.Body.String()) }
	if response := join(created.Room.Code); response.Code != http.StatusConflict { t.Fatalf("started room should reject join: %d", response.Code) }
}
