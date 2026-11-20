package game

import "testing"

func TestResolveExperienceGainPreservesProgressionRules(t *testing.T) {
	player := PlayerState{Experience: 54, Level: 1, MaxHealth: 30, StrikeDamage: PlayerStrikeDamage, GuardReduction: GuardDamageReduction, Stats: PlayerStats{Power: 1}}
	result := resolveExperienceGain(player, EncounterExperienceReward)
	if result.Experience != 72 || result.Level != 2 {
		t.Fatalf("unexpected first level transition: %+v", result)
	}
	if result.MaxHealth != 34 || result.StrikeDamage != PlayerStrikeDamage+1 || result.GuardReduction != GuardDamageReduction || result.Stats.Power != 2 || len(result.LevelUps) != 1 || result.LevelUps[0] != 2 {
		t.Fatalf("level 2 growth is incorrect: %+v", result)
	}
	if player.Experience != 54 || player.Level != 1 || player.MaxHealth != 30 {
		t.Fatalf("transition mutated its input: %+v", player)
	}
}

func TestResolveExperienceGainCanCrossMultipleLevelsInOrder(t *testing.T) {
	player := PlayerState{Experience: 59, Level: 1, MaxHealth: 30, StrikeDamage: PlayerStrikeDamage, GuardReduction: GuardDamageReduction, Stats: PlayerStats{Power: 1}}
	result := resolveExperienceGain(player, 400)
	if result.Experience != 459 || result.Level != 5 {
		t.Fatalf("unexpected multi-level transition: %+v", result)
	}
	want := []int{2, 3, 4, 5}
	if len(result.LevelUps) != len(want) {
		t.Fatalf("level-up sequence = %v, want %v", result.LevelUps, want)
	}
	for i := range want {
		if result.LevelUps[i] != want[i] {
			t.Fatalf("level-up sequence = %v, want %v", result.LevelUps, want)
		}
	}
	if result.MaxHealth != 38 || result.StrikeDamage != PlayerStrikeDamage+2 || result.GuardReduction != GuardDamageReduction+2 || result.Stats != (PlayerStats{Power: 3, Focus: 3, Agility: 1}) {
		t.Fatalf("cumulative stat growth is incorrect: max health %d, stats %+v", result.MaxHealth, result.Stats)
	}
}

func TestRunLevelsContinuePastFiveWithNonlinearXPAndGradualGrowth(t *testing.T) {
	wantThresholds := []int{60, 150, 275, 425, 605, 821, 1080, 1391, 1764}
	for level, want := range wantThresholds {
		if got := experienceForNextLevel(level + 1); got != want {
			t.Fatalf("threshold to reach level %d = %d, want %d", level+2, got, want)
		}
	}

	player := PlayerState{Experience: 424, Level: 4, MaxHealth: 38, StrikeDamage: PlayerStrikeDamage + 2, GuardReduction: GuardDamageReduction + 1, Stats: PlayerStats{Power: 2, Focus: 3, Agility: 2}}
	result := resolveExperienceGain(player, 1000)
	if result.Level != 9 {
		t.Fatalf("level 9 should be reachable with 1424 XP, got level %d", result.Level)
	}
	if len(result.LevelUps) != 5 || result.LevelUps[0] != 5 || result.LevelUps[4] != 9 {
		t.Fatalf("unexpected continued level-ups: %v", result.LevelUps)
	}
	if result.MaxHealth <= player.MaxHealth || result.StrikeDamage <= player.StrikeDamage || result.GuardReduction <= player.GuardReduction {
		t.Fatalf("continued levels should improve all core combat stats: %+v", result)
	}
	if result.Stats.Power <= player.Stats.Power || result.Stats.Focus <= player.Stats.Focus || result.Stats.Agility <= player.Stats.Agility {
		t.Fatalf("continued levels should improve all attributes: %+v", result.Stats)
	}
}

func TestResolveExperienceGainAtHighLevelAndForNonPositiveRewards(t *testing.T) {
	player := PlayerState{Experience: experienceForNextLevel(12) - 30, Level: 12, MaxHealth: 62, StrikeDamage: PlayerStrikeDamage + 8, GuardReduction: GuardDamageReduction + 6, Stats: PlayerStats{Power: 7, Focus: 8, Agility: 5}}
	for _, amount := range []int{0, -10, 25} {
		result := resolveExperienceGain(player, amount)
		wantExperience := player.Experience
		if amount > 0 {
			wantExperience += amount
		}
		if result.Experience != wantExperience || result.Level != 12 || len(result.LevelUps) != 0 {
			t.Fatalf("unexpected high-level/non-positive result for %d XP: %+v", amount, result)
		}
		if result.MaxHealth != player.MaxHealth || result.StrikeDamage != player.StrikeDamage || result.GuardReduction != player.GuardReduction || result.Stats != player.Stats {
			t.Fatalf("high-level state changed stats without a level-up for %d XP: %+v", amount, result)
		}
	}
}
