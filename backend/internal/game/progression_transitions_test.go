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

func TestResolveExperienceGainAtLevelCapAndForNonPositiveRewards(t *testing.T) {
	player := PlayerState{Experience: 500, Level: 5, MaxHealth: 38, StrikeDamage: PlayerStrikeDamage + 2, GuardReduction: GuardDamageReduction + 2, Stats: PlayerStats{Power: 3, Focus: 3, Agility: 1}}
	for _, amount := range []int{0, -10, 25} {
		result := resolveExperienceGain(player, amount)
		wantExperience := player.Experience
		if amount > 0 {
			wantExperience += amount
		}
		if result.Experience != wantExperience || result.Level != 5 || len(result.LevelUps) != 0 {
			t.Fatalf("unexpected level-cap/non-positive result for %d XP: %+v", amount, result)
		}
		if result.MaxHealth != player.MaxHealth || result.StrikeDamage != player.StrikeDamage || result.GuardReduction != player.GuardReduction || result.Stats != player.Stats {
			t.Fatalf("level cap changed stats for %d XP: %+v", amount, result)
		}
	}
}
