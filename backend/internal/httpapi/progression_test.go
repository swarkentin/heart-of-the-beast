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

	choose := httptest.NewRequest(http.MethodPost, "/rooms/"+response.Room.ID+"/archetype", bytes.NewBufferString(`{"archetype":"support"}`))
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
		if state.Archetype != "support" || state.Level != 1 {
			t.Fatalf("unexpected initial run progression: %+v", state)
		}
	}

	locked := httptest.NewRequest(http.MethodPost, "/rooms/"+response.Room.ID+"/archetype", bytes.NewBufferString(`{"archetype":"damage"}`))
	locked.Header.Set("Authorization", "Bearer "+response.PlayerToken)
	lockedResponse := httptest.NewRecorder()
	handler.ServeHTTP(lockedResponse, locked)
	if lockedResponse.Code != http.StatusConflict {
		t.Fatalf("archetype change after start should fail, got %d", lockedResponse.Code)
	}
}

func TestProgressionCatalogIsPublicAndContainsThreeArchetypes(t *testing.T) {
	response := httptest.NewRecorder()
	NewHandler(store.NewMemory()).ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/progression", nil))
	if response.Code != http.StatusOK {
		t.Fatalf("catalog: %d %s", response.Code, response.Body.String())
	}
	var catalog struct {
		Archetypes []struct {
			ID string `json:"id"`
		} `json:"archetypes"`
		Classes []struct {
			ID string `json:"id"`
		} `json:"classes"`
		ClassAvailability []struct {
			ClassID            string `json:"classId"`
			InitiallyAvailable bool   `json:"initiallyAvailable"`
		} `json:"classAvailability"`
		Talents []struct {
			ID string `json:"id"`
		} `json:"talents"`
		ProfileRewards []struct {
			ID       string `json:"id"`
			Category string `json:"category"`
		} `json:"profileRewards"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &catalog); err != nil {
		t.Fatal(err)
	}
	if len(catalog.Archetypes) != 3 || len(catalog.Classes) != 9 || len(catalog.ClassAvailability) != 9 || len(catalog.Talents) != 12 || len(catalog.ProfileRewards) != 11 {
		t.Fatalf("unexpected catalog size: %d archetypes, %d classes, %d availability entries, %d talents, %d profile rewards", len(catalog.Archetypes), len(catalog.Classes), len(catalog.ClassAvailability), len(catalog.Talents), len(catalog.ProfileRewards))
	}
	for _, availability := range catalog.ClassAvailability {
		if !availability.InitiallyAvailable {
			t.Fatalf("launch class %q should initially be available", availability.ClassID)
		}
	}
}

func TestRunClassCanBeChosenAndIsServerBuiltAtStart(t *testing.T) {
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

	choose := httptest.NewRequest(http.MethodPost, "/rooms/"+response.Room.ID+"/class", bytes.NewBufferString(`{"classId":"arcanist","maxHealth":999,"stats":{"focus":999},"equipmentIds":["forged.item"]}`))
	choose.Header.Set("Authorization", "Bearer "+response.PlayerToken)
	chosen := httptest.NewRecorder()
	handler.ServeHTTP(chosen, choose)
	if chosen.Code != http.StatusOK {
		t.Fatalf("choose class: %d %s", chosen.Code, chosen.Body.String())
	}
	var lobbySnapshot struct {
		PlayerClasses map[string]string `json:"playerClasses"`
	}
	if err := json.Unmarshal(chosen.Body.Bytes(), &lobbySnapshot); err != nil {
		t.Fatal(err)
	}
	if lobbySnapshot.PlayerClasses == nil || len(lobbySnapshot.PlayerClasses) != 1 {
		t.Fatalf("selected class should be present in lobby snapshot: %+v", lobbySnapshot.PlayerClasses)
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
				ClassBuild struct {
					ClassID   string `json:"classId"`
					MaxHealth int    `json:"maxHealth"`
				} `json:"classBuild"`
				Stats struct {
					Focus int `json:"focus"`
				} `json:"stats"`
			} `json:"players"`
		} `json:"run"`
	}
	if err := json.Unmarshal(started.Body.Bytes(), &snapshot); err != nil {
		t.Fatal(err)
	}
	player := snapshot.Run.Players
	if len(player) != 1 {
		t.Fatalf("expected one player, got %#v", player)
	}
	for _, state := range player {
		if state.ClassBuild.ClassID != "arcanist" || state.ClassBuild.MaxHealth != 27 || state.Stats.Focus != 4 {
			t.Fatalf("server did not apply selected class build: %+v", state)
		}
	}
}

func TestRunClassEndpointRejectsUnknownAndUnauthorizedClass(t *testing.T) {
	handler := NewHandler(store.NewMemory())
	created := httptest.NewRecorder()
	handler.ServeHTTP(created, httptest.NewRequest(http.MethodPost, "/rooms", nil))
	var response struct {
		Room struct {
			ID string `json:"id"`
		} `json:"room"`
		PlayerToken string `json:"playerToken"`
	}
	if err := json.Unmarshal(created.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}

	for _, classID := range []string{"unknown-class", "locked-future-class"} {
		request := httptest.NewRequest(http.MethodPost, "/rooms/"+response.Room.ID+"/class", bytes.NewBufferString(`{"classId":"`+classID+`"}`))
		request.Header.Set("Authorization", "Bearer "+response.PlayerToken)
		result := httptest.NewRecorder()
		handler.ServeHTTP(result, request)
		if result.Code != http.StatusConflict {
			t.Fatalf("class %q should be rejected, got %d %s", classID, result.Code, result.Body.String())
		}
	}
}
