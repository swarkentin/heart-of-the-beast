package game

import "errors"

// Skill ranks are the run's way of making a skill *yours*. Every run level-up grants one skill point; the player
// spends it on a skill of their bar, raising that skill one rank (I to V). A rank adds a fixed step to each of
// the skill's scaling effects (more damage, a bigger guard, a longer bleed) and the client draws a ranked skill
// with a stronger animation. Ranks reset with the run like every other run-level gain, and survive a skill being
// swapped off the bar at camp so a swap is never punished twice.

const (
	// MaxSkillRank is the highest rank a skill can reach in one run.
	MaxSkillRank = 5
)

var (
	ErrNoSkillPoints = errors.New("you have no skill points to spend: level up during the run to earn one")
	ErrSkillMaxRank  = errors.New("that skill is already at its highest rank")
)

// SkillRank is the player's rank in a skill this run: 1 until they spend a point on it.
func SkillRank(player *PlayerState, skillID string) int {
	if player == nil || player.SkillRanks == nil || player.SkillRanks[skillID] < 1 {
		return 1
	}
	if player.SkillRanks[skillID] > MaxSkillRank {
		return MaxSkillRank
	}
	return player.SkillRanks[skillID]
}

// rankedSkill returns the definition as it fights at the given rank. Effects that do not scale (stun, taunt,
// hasten, damage riders) are unchanged, so a rank never changes what a skill does, only how much.
func rankedSkill(definition SkillDefinition, rank int) SkillDefinition {
	steps := rank - 1
	if steps <= 0 {
		return definition
	}
	if steps > MaxSkillRank-1 {
		steps = MaxSkillRank - 1
	}
	effects := make([]SkillEffect, len(definition.Effects))
	for i, effect := range definition.Effects {
		effects[i] = rankEffect(effect, steps)
	}
	definition.Effects = effects
	definition.Rules = describeSkill(definition)
	return definition
}

// rankStep is how many points a scaling effect gains at a rank: +1 at ranks II and III, +2 at IV and V. The first
// draft gave +1 at every rank and took a third of the wipes out of two- to four-player expeditions (ADR 0034).
func rankStep(steps int) int { return (steps + 1) / 2 }

func rankEffect(effect SkillEffect, steps int) SkillEffect {
	step := rankStep(steps)
	switch effect.Kind {
	case EffectDamage:
		if !isDamageRider(effect) {
			effect.Amount += step
		}
	case EffectCounter, EffectInterrupt, EffectWeaken, EffectMark, EffectThorns, EffectEmpower, EffectHeal:
		effect.Amount += step
	case EffectGuard:
		// Defend's guard(0) scales through defendRankBonus so an automatic Defend gets it too.
		if effect.Amount > 0 {
			effect.Amount += step
		}
	case EffectWard:
		effect.Amount += 2 * step
	case EffectBleed, EffectRegen:
		effect.Amount += step / 2
		if steps == MaxSkillRank-1 && step/2 == 0 {
			effect.Amount++
		}
	case EffectLifesteal:
		effect.Amount += 5 * steps
	case EffectRevive:
		effect.Amount += 5 * steps
		if effect.Amount > 100 {
			effect.Amount = 100
		}
	}
	return effect
}

// defendRankBonus is the extra guard a ranked Defend gives, whether chosen or taken when the timer runs out.
func defendRankBonus(player *PlayerState) int {
	return rankStep(SkillRank(player, SkillDefend) - 1)
}

// skillRankRules is each rank's rule text, rank I first, so the client can preview an upgrade.
func skillRankRules(definition SkillDefinition) []string {
	rules := make([]string, MaxSkillRank)
	for rank := 1; rank <= MaxSkillRank; rank++ {
		if definition.ID == SkillDefend {
			rules[rank-1] = defendRankRules(rank)
			continue
		}
		rules[rank-1] = rankedSkill(definition, rank).Rules
	}
	return rules
}

func defendRankRules(rank int) string {
	if rank <= 1 {
		return "Guard against the next hit."
	}
	return "Guard against the next hit, blocking " + itoa(rankStep(rank-1)) + " more."
}

// upgradeSkill spends one of the player's skill points on a skill of their bar.
func upgradeSkill(room *Room, playerID, skillID string) error {
	run := room.Run
	if run == nil || run.Phase == PhaseCompleted || run.Phase == PhaseFailed {
		return ErrInvalidPhase
	}
	player := run.Players[playerID]
	if player == nil || room.Presence[playerID].LeftAt != nil {
		return ErrInvalidPhase
	}
	if player.SkillPoints <= 0 {
		return ErrNoSkillPoints
	}
	if _, ok := findSkill(skillID); !ok || !contains(player.Skills, skillID) {
		return ErrInvalidSkill
	}
	rank := SkillRank(player, skillID)
	if rank >= MaxSkillRank {
		return ErrSkillMaxRank
	}
	if player.SkillRanks == nil {
		player.SkillRanks = make(map[string]int)
	}
	player.SkillRanks[skillID] = rank + 1
	player.SkillPoints--
	definition, _ := findSkill(skillID)
	addCombatEvent(run, roundNumber(run), "skill_rank", adventurerLabel(room, playerID)+"'s "+definition.Name+" rises to rank "+romanRank(rank+1)+".")
	last := &run.LastCombatEvents[len(run.LastCombatEvents)-1]
	last.ActorID, last.Skill, last.Rank = playerID, skillID, rank+1
	return nil
}

func roundNumber(run *Run) int {
	if run.CombatRound != nil {
		return run.CombatRound.Number
	}
	return 0
}

func romanRank(rank int) string {
	return [...]string{"I", "I", "II", "III", "IV", "V"}[max(0, min(rank, MaxSkillRank))]
}

// spendSkillPointsByPolicy is how the balance simulations spend skill points: the basic attack first, then the
// lowest-ranked other skill in bar order (Defend last). Deterministic, so seeded runs stay reproducible.
func spendSkillPointsByPolicy(room *Room, playerID string) {
	player := room.Run.Players[playerID]
	for player != nil && player.SkillPoints > 0 {
		best, bestScore := "", 1<<30
		for slot, id := range player.Skills {
			definition, ok := findSkill(id)
			rank := SkillRank(player, id)
			if !ok || rank >= MaxSkillRank {
				continue
			}
			score := rank*100 + slot
			if definition.Basic {
				score -= 150
			}
			if id == SkillDefend {
				score += 1000
			}
			if score < bestScore {
				best, bestScore = id, score
			}
		}
		if best == "" || upgradeSkill(room, playerID, best) != nil {
			return
		}
	}
}
