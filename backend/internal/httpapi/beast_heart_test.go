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
	if heart.Leaderboard == nil || len(heart.Leaderboard.Players) != 0 || len(heart.Leaderboard.Parties) != 0 {
		t.Fatalf("a new server has empty high scores: %+v", heart.Leaderboard)
	}
}

func TestHeartDamageIsBankedAsItIsDealtAndTalliedPerPlayerAndParty(t *testing.T) {
	memory := store.NewMemory()
	now := time.Date(2026, 11, 21, 12, 0, 0, 0, time.UTC)
	ada, err := memory.GetOrCreateProfile(t.Context(), "ada", tokenHash("ada-credential"), now)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := memory.UpdateProfileName(t.Context(), tokenHash("ada-credential"), "Ada", now); err != nil {
		t.Fatal(err)
	}
	handler := &Handler{rooms: memory, now: func() time.Time { return now }}
	room := &game.Room{ID: "room-1", PlayerProfileIDs: map[string]string{"p1": ada.ID}, Run: &game.Run{ID: "run-1"}}
	room.Run.HeartStrikes = []game.HeartStrike{{EncounterID: "x3-d4-boss", ThemeID: "noir", Dungeon: 3, ByPlayer: map[string]int64{"p1": 30, "p2": 12}}}
	if err := handler.awardRunProgress(t.Context(), room); err != nil {
		t.Fatal(err)
	}
	// The fight goes on: totals grow, and polls in between resend the same totals.
	room.Run.HeartStrikes[0].ByPlayer["p1"] = 50
	room.Run.HeartStrikes[0].ByPlayer[game.HeartPartyKey] = 4
	room.Run.HeartStrikes[0].DrivenOff = true
	for range 3 {
		if err := handler.awardRunProgress(t.Context(), room); err != nil {
			t.Fatal(err)
		}
	}
	// A fresh process (no in-memory cache) resends everything: nothing is counted twice.
	if err := (&Handler{rooms: memory, now: handler.now}).awardHeartStrikes(t.Context(), room); err != nil {
		t.Fatal(err)
	}
	heart := readBeastHeart(t, NewHandler(memory))
	if heart.Damage != 66 || heart.Strikes != 1 || heart.Health != game.BeastHeartInitialHealth-66 {
		t.Fatalf("one fight of 66 damage should be banked once: %+v", heart)
	}
	board := heart.Leaderboard
	if len(board.Players) != 1 || board.Players[0].Name != "Ada" || board.Players[0].Damage != 50 || board.Players[0].Fights != 1 {
		t.Fatalf("Ada leads the adventurers; a player without a profile is not ranked: %+v", board.Players)
	}
	if len(board.Parties) != 1 || board.Parties[0].Damage != 66 || !board.Parties[0].DrivenOff || len(board.Parties[0].Names) != 2 || board.Parties[0].Names[0] != "Ada" {
		t.Fatalf("the party's fight is its high score: %+v", board.Parties)
	}
}
