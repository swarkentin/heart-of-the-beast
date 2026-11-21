package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/swarkentin/heart-of-the-beast/backend/internal/game"
	"github.com/swarkentin/heart-of-the-beast/backend/internal/store"
)

func readBeastHeart(t *testing.T, handler http.Handler) beastHeartResponse {
	t.Helper()
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/beast", nil))
	if response.Code != http.StatusOK {
		t.Fatalf("GET /beast: %d %s", response.Code, response.Body.String())
	}
	var heart beastHeartResponse
	if err := json.Unmarshal(response.Body.Bytes(), &heart); err != nil {
		t.Fatal(err)
	}
	return heart
}

func TestBeastHeartIsPublicAndStartsWhole(t *testing.T) {
	heart := readBeastHeart(t, NewHandler(store.NewMemory()))
	if heart.MaxHealth != game.BeastHeartInitialHealth || heart.Health != heart.MaxHealth || heart.Damage != 0 || heart.Strikes != 0 {
		t.Fatalf("a new server's heart should be whole: %+v", heart)
	}
}

func TestHeartStrikesAreBankedOncePerFight(t *testing.T) {
	memory := store.NewMemory()
	handler := &Handler{rooms: memory, now: func() time.Time { return time.Date(2026, 11, 21, 12, 0, 0, 0, time.UTC) }}
	room := &game.Room{ID: "room-1", Run: &game.Run{ID: "run-1"}}
	game.RecordHeartStrike(room.Run, "d3-boss", 420)
	game.RecordHeartStrike(room.Run, "d3-boss", 999) // the same fight again is ignored
	for range 3 {
		if err := handler.awardRunProgress(t.Context(), room); err != nil {
			t.Fatal(err)
		}
	}
	// A fresh process (no in-memory cache) still cannot count the fight twice.
	if err := (&Handler{rooms: memory, now: handler.now}).awardHeartStrikes(t.Context(), room); err != nil {
		t.Fatal(err)
	}
	heart := readBeastHeart(t, NewHandler(memory))
	if heart.Damage != 420 || heart.Strikes != 1 || heart.Health != game.BeastHeartInitialHealth-420 {
		t.Fatalf("one strike of 420 should be banked once: %+v", heart)
	}
}
