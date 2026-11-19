package game

// ProgressionTransition is the deterministic result of granting experience.
// It contains only progression-owned fields; callers remain responsible for
// mutating the player aggregate and emitting gameplay events.
type ProgressionTransition struct {
	Experience     int
	Level          int
	MaxHealth      int
	StrikeDamage   int
	GuardReduction int
	Stats          PlayerStats
	LevelUps       []int
}

// resolveExperienceGain calculates XP and every level-up caused by a reward.
// It deliberately has no access to rooms, presence, event streams, or clocks.
func resolveExperienceGain(player PlayerState, amount int) ProgressionTransition {
	result := ProgressionTransition{
		Experience: player.Experience,
		Level:      player.Level,
		MaxHealth:      player.MaxHealth,
		StrikeDamage:   player.StrikeDamage,
		GuardReduction: player.GuardReduction,
		Stats:          player.Stats,
	}
	if amount <= 0 {
		return result
	}
	result.Experience += amount
	for result.Level < 5 {
		next := experienceForNextLevel(result.Level)
		if next == 0 || result.Experience < next {
			break
		}
		result.Level++
		result.LevelUps = append(result.LevelUps, result.Level)
		switch result.Level {
		case 2:
			result.MaxHealth += 4
			result.StrikeDamage++
			result.Stats.Power++
		case 3:
			result.GuardReduction++
			result.Stats.Focus += 2
		case 4:
			result.MaxHealth += 4
			result.StrikeDamage++
			result.Stats.Agility++
		case 5:
			result.GuardReduction++
			result.Stats.Power++
			result.Stats.Focus++
		}
	}
	return result
}
