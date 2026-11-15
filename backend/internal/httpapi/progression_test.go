package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/swarkentin/heart-of-the-beast/backend/internal/store"
)

func TestRunArchetypeCanBeChosenInLobbyAndIsUsedAtStart(t *testing.T) {
	handler := NewHandler(store.NewMemory())
	created := httptest.NewRecorder()
	handler.ServeHTTP(created, httptest.NewRequest(http.MethodPost, "/rooms", nil))
	if created.Code != http.StatusCreated {
		t.Fatalf("create room: %d %s", created.Code, created.Body.String())
	}

	var response struct {
		Room struct {
			ID string `json:"id"`
		} `json:"room"`
		PlayerToken string `json:"playerToken"`
	}
	if err := json.Unmarshal(created.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}

	choose := httptest.NewRequest(http.MethodPost, "/rooms/"+response.Room.ID+"/archetype", bytes.NewBufferString(`{"archetype":"arcanist"}`))
	choose.Header.Set("Authorization", "Bearer "+response.PlayerToken)
	chosen := httptest.NewRecorder()
	handler.ServeHTTP(chosen, choose)
	if chosen.Code != http.StatusOK {
		t.Fatalf("choose archetype: %d %s", chosen.Code, chosen.Body.String())
	}

	start := httptest.NewRequest(http.MethodPost, "/rooms/"+response.Room.ID+"/start", nil)
	start.Header.Set("Authorization", "Bearer "+response.PlayerToken)
	started := httptest.NewRecorder()
	handler.ServeHTTP(started, start)
	if started.Code != http.StatusOK {
		t.Fatalf("start run: %d %s", started.Code, started.Body.String())
	}

	var snapshot struct {
		Run struct {
			Players map[string]struct {
				Archetype string `json:"archetype"`
				Level     int    `json:"level"`
			} `json:"players"`
		} `json:"run"`
	}
	if err := json.Unmarshal(started.Body.Bytes(), &snapshot); err != nil {
		t.Fatal(err)
	}
	player := snapshot.Run.Players
	if len(player) != 1 {
		t.Fatalf("expected one run player, got %#v", player)
	}
	for _, state := range player {
		if state.Archetype != "arcanist" || state.Level != 1 {
			t.Fatalf("unexpected initial run progression: %+v", state)
		}
	}

	locked := httptest.NewRequest(http.MethodPost, "/rooms/"+response.Room.ID+"/archetype", bytes.NewBufferString(`{"archetype":"rogue"}`))
	locked.Header.Set("Authorization", "Bearer "+response.PlayerToken)
	lockedResponse := httptest.NewRecorder()
	handler.ServeHTTP(lockedResponse, locked)
	if lockedResponse.Code != http.StatusConflict {
		t.Fatalf("archetype change after start should fail, got %d", lockedResponse.Code)
	}
}

func TestProgressionCatalogIsPublicAndContainsFourArchetypes(t *testing.T) {
	response := httptest.NewRecorder()
	NewHandler(store.NewMemory()).ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/progression", nil))
	if response.Code != http.StatusOK {
		t.Fatalf("catalog: %d %s", response.Code, response.Body.String())
	}
	var catalog struct {
		Archetypes []struct {
			ID string `json:"id"`
		} `json:"archetypes"`
		Talents []struct {
			ID string `json:"id"`
		} `json:"talents"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &catalog); err != nil {
		t.Fatal(err)
	}
	if len(catalog.Archetypes) != 4 || len(catalog.Talents) != 16 {
		t.Fatalf("unexpected catalog size: %d archetypes, %d talents", len(catalog.Archetypes), len(catalog.Talents))
	}
}
