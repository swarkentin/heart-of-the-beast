package game

import "testing"

func TestExpeditionEnemyDamageBonusTracksDepth(t *testing.T) {
	tests := []struct {
		name string
		run  *Run
		want int
	}{
		{"legacy run", &Run{Depth: 8}, 0},
		{"first floor", &Run{Generator: ExpeditionGenerator, Depth: 1}, 0},
		{"second floor", &Run{Generator: ExpeditionGenerator, Depth: 2}, 0},
		{"third floor", &Run{Generator: ExpeditionGenerator, Depth: 3}, 1},
		{"later dungeon", &Run{Generator: ExpeditionGenerator, Dungeon: 2, Depth: 1}, 1},
		{"castle depth", &Run{Generator: ExpeditionGenerator, Dungeon: 5, Depth: 1, ThemeID: "eldritch-castle"}, 4},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := expeditionEnemyDamageBonus(test.run); got != test.want {
				t.Fatalf("expeditionEnemyDamageBonus() = %d, want %d", got, test.want)
			}
		})
	}
}

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
