package game

import "testing"

func TestCriticalHitIsDeterministicAndScalesWithRunLevel(t *testing.T) {
	var chosenSeed uint64
	found := false
	for seed := uint64(0); seed < 10000; seed++ {
		run := &Run{Seed: seed}
		player := &PlayerState{ID: "hero-1", Level: 1}
		enemy := &Enemy{ID: "enemy-1"}
		if !criticalHit(run, player, enemy, 7) {
			player.Level = 5
			if criticalHit(run, player, enemy, 7) {
				chosenSeed, found = seed, true
				break
			}
		}
	}
	if !found {
		t.Fatal("could not find a deterministic roll between the level 1 and level 5 critical chances")
	}
	run := &Run{Seed: chosenSeed}
	player := &PlayerState{ID: "hero-1", Level: 5}
	enemy := &Enemy{ID: "enemy-1"}
	if !criticalHit(run, player, enemy, 7) || !criticalHit(run, player, enemy, 7) {
		t.Fatal("the same seeded action should always produce the same critical result")
	}
}
