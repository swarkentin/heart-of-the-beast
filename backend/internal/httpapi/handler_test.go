package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

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
