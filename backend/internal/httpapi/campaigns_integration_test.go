package httpapi

import (
	"database/sql"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/swarkentin/heart-of-the-beast/backend/internal/game"
	"github.com/swarkentin/heart-of-the-beast/backend/internal/store"
	"github.com/swarkentin/heart-of-the-beast/backend/migrations"
)

// TestPostgresCampaignTrophies runs campaign trophies and the leader's unlock against PostgreSQL (ADR 0041).
func TestPostgresCampaignTrophies(t *testing.T) {
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("set TEST_DATABASE_URL to run PostgreSQL integration tests")
	}
	db, err := sql.Open("pgx", databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := migrations.Apply(t.Context(), db); err != nil {
		t.Fatalf("apply embedded migrations: %v", err)
	}
	postgres := store.NewPostgres(db)
	handler := NewHandler(postgres)
	credential, err := randomToken(32)
	if err != nil {
		t.Fatal(err)
	}
	campaigns := game.Campaigns()
	room := newLeaderRoom(t, handler, credential)
	if response := startCampaign(handler, room, campaigns[1].ID); response.Code != http.StatusForbidden {
		t.Fatalf("locked campaign: %d %s", response.Code, response.Body.String())
	}

	stored, err := postgres.Get(t.Context(), room.Room.ID)
	if err != nil {
		t.Fatal(err)
	}
	stored.Run = &game.Run{ID: "pg-won-" + credential[:12], CampaignID: campaigns[0].ID, CampaignWon: true, Phase: game.PhaseCompleted,
		Players: map[string]*game.PlayerState{}, Rooms: map[string]*game.DungeonRoom{}}
	for i := 0; i < 2; i++ {
		awarder := &Handler{rooms: postgres, now: time.Now}
		if err := awarder.awardRunProgress(t.Context(), stored); err != nil {
			t.Fatal(err)
		}
	}
	profile, err := postgres.GetProfile(t.Context(), tokenHash(credential))
	if err != nil {
		t.Fatal(err)
	}
	if record := profile.Campaigns[campaigns[0].ID]; record.Completions != 1 || record.FirstCompletedAt.IsZero() {
		t.Fatalf("trophy after two banks: %+v", record)
	}
	next := newLeaderRoom(t, handler, credential)
	if response := startCampaign(handler, next, campaigns[1].ID); response.Code != http.StatusOK {
		t.Fatalf("unlocked campaign: %d %s", response.Code, response.Body.String())
	}
}
