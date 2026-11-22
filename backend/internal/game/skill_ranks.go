package game

import "errors"

// Skill ranks are the run's way of making a skill *yours*. Every run level-up grants one skill point; the player
// spends it on a skill of their bar, raising that skill one rank (I to V). A rank adds a fixed step to each of
// the skill's scaling effects (more damage, a bigger guard, a longer bleed) and the client draws a ranked skill
// with a stronger animation. Ranks reset with the run like every other run-level gain, and survive a skill being
// swapped off the bar at camp so a swap is never punished twice. Ranks II and IV raise the numbers; ranks III and V
// add a small flourish that suits the skill instead (rankFlourish), so every rank does something without stacking
// more raw power (ADR 0043).

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
	if flourish, ok := rankFlourish(definition, steps); ok {
		effects = append(effects, flourish)
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

// flourishLevel is 1 from rank III and 2 at rank V: the size of the rank's flourish.
func flourishLevel(steps int) int {
	switch {
	case steps >= 4:
		return 2
	case steps >= 2:
		return 1
	}
	return 0
}

// rankFlourish is the small extra a skill gains at ranks III and V, chosen by what the skill is for:
//   - strike: Echo, a 25% (V: 35%) chance per enemy hit to strike again for 2 (V: 3);
//   - guard, and control that targets only you: Thorns 1 (V: 2) this round;
//   - control aimed at enemies: Mark 1 (V: 2), so the party's next hit lands harder;
//   - support: you restore 2 (V: 3) health.
//
// Defend's flourish (thorns) is applied in defend, so a Defend taken when the timer runs out gets it too.
func rankFlourish(definition SkillDefinition, steps int) (SkillEffect, bool) {
	level := flourishLevel(steps)
	if level == 0 || definition.ID == SkillDefend {
		return SkillEffect{}, false
	}
	switch definition.Tone {
	case "strike":
		return SkillEffect{Kind: EffectEcho, Amount: 1 + level, Bonus: 15 + 10*level}, true
	case "control":
		if definition.Target == SkillTargetEnemy || definition.Target == SkillTargetAllEnemies {
			return SkillEffect{Kind: EffectMark, Amount: level}, true
		}
		return SkillEffect{Kind: EffectThorns, Amount: level, Scope: ScopeSelf}, true
	case "guard":
		return SkillEffect{Kind: EffectThorns, Amount: level, Scope: ScopeSelf}, true
	case "support":
		return SkillEffect{Kind: EffectHeal, Amount: 1 + level, Scope: ScopeSelf}, true
	}
	return SkillEffect{}, false
}

// defendFlourish is the thorns a ranked Defend adds (rank III and V), whether chosen or automatic.
func defendFlourish(player *PlayerState) int {
	return flourishLevel(SkillRank(player, SkillDefend) - 1)
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
	text := "Guard against the next hit, blocking " + itoa(rankStep(rank-1)) + " more."
	if thorns := flourishLevel(rank - 1); thorns > 0 {
		text += " Reflect " + itoa(thorns) + " to anything that hits you this round."
	}
	return text
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
