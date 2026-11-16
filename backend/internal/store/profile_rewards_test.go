package store

import (
	"context"
	"fmt"
	"testing"
	"time"
)

func TestRunXPUnlocksProfileAndClassMasteryRewards(t *testing.T) {
	repository := NewMemory()
	credentialHash := "reward-test-credential-hash"
	profile, err := repository.GetOrCreateProfile(context.Background(), "reward-test-profile", credentialHash, time.Now().UTC())
	if err != nil {
		t.Fatal(err)
	}
	for run := 1; run <= 4; run++ {
		if _, err := repository.AwardRunXP(context.Background(), profile.ID, fmt.Sprintf("reward-run-%d", run), "player-1", "ranger", 30, time.Now().UTC()); err != nil {
			t.Fatalf("award run %d: %v", run, err)
		}
	}
	updated, err := repository.GetProfile(context.Background(), credentialHash)
	if err != nil {
		t.Fatal(err)
	}
	want := map[string]bool{
		"title.catacomb-wayfinder": true,
		"title.mastery.ranger":     true,
	}
	for _, id := range updated.UnlockedCosmetics {
		delete(want, id)
	}
	if len(want) != 0 {
		t.Fatalf("expected milestone rewards were not unlocked: %+v; profile=%+v", want, updated)
	}
	if updated.AdventurerLevel != 2 || updated.ClassMastery["ranger"].Level != 2 {
		t.Fatalf("expected rank-two profile and ranger mastery: %+v", updated)
	}
	if len(updated.UnlockedCosmetics) != 2 {
		t.Fatalf("unexpected reward unlocks: %#v", updated.UnlockedCosmetics)
	}

	// Replaying an already-awarded run must not append duplicate unlocks.
	if _, err := repository.AwardRunXP(context.Background(), profile.ID, "reward-run-4", "player-1", "ranger", 30, time.Now().UTC()); err != nil {
		t.Fatal(err)
	}
	updated, err = repository.GetProfile(context.Background(), credentialHash)
	if err != nil {
		t.Fatal(err)
	}
	if len(updated.UnlockedCosmetics) != 2 {
		t.Fatalf("repeated run duplicated rewards: %#v", updated.UnlockedCosmetics)
	}
}
