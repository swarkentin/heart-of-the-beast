package store

import (
	"context"
	"testing"
	"time"
)

func TestMemoryRecordEnemyKillIsIdempotentAndTracksElites(t *testing.T) {
	ctx := context.Background()
	repository := NewMemory()
	now := time.Date(2026, 11, 18, 12, 0, 0, 0, time.UTC)
	if _, err := repository.GetOrCreateProfile(ctx, "profile-1", "credential-1", now); err != nil {
		t.Fatal(err)
	}

	kill := EnemyKill{EnemyKey: "jungle/razor-vine", Name: "Razor Vine", ThemeID: "jungle", SpriteID: "jungle/razor-vine"}
	if err := repository.RecordEnemyKill(ctx, "profile-1", "run-1", "enemy-1", kill, now); err != nil {
		t.Fatal(err)
	}
	// A retry of the same server-confirmed kill must not inflate the count.
	if err := repository.RecordEnemyKill(ctx, "profile-1", "run-1", "enemy-1", kill, now); err != nil {
		t.Fatal(err)
	}
	kill.Elite = true
	if err := repository.RecordEnemyKill(ctx, "profile-1", "run-1", "enemy-2", kill, now); err != nil {
		t.Fatal(err)
	}

	profile, err := repository.GetProfile(ctx, "credential-1")
	if err != nil {
		t.Fatal(err)
	}
	entry := profile.Bestiary[kill.EnemyKey]
	if entry.Kills != 2 || entry.EliteKills != 1 {
		t.Fatalf("unexpected bestiary entry: %+v", entry)
	}
	if entry.SpriteID != "jungle/razor-vine" || entry.ThemeID != "jungle" {
		t.Fatalf("sprite metadata was not retained: %+v", entry)
	}
}
