package game

import (
	"math/rand"
	"sort"
)

// The simulated adventurer: how balance reports and run simulations choose skills. It reads a round the way an
// attentive player does, in priority order:
//
//  1. interrupt an interruptible telegraph no earlier adventurer has already claimed this round;
//  2. revive a fallen ally;
//  3. heal an ally below 60% health;
//  4. protect: guard yourself against a killing blow, shield an ally facing one, or taunt a heavy hit off an ally;
//  5. otherwise use the ready skill worth the most against the weakest enemy (focus fire).
//
// Every candidate is checked with the same validation live play uses; with nothing valid it defends.

func skillPolicyCommand(room *Room, playerID string, round int, rng *rand.Rand) Command {
	defend := Command{Type: "combat", Round: round, Action: "defend"}
	run := room.Run
	player := run.Players[playerID]
	current := run.Rooms[run.CurrentRoomID]
	if player == nil || current == nil || current.Encounter == nil {
		return defend
	}
	ensureSkills(player)
	encounter := current.Encounter
	targetIndex := simulationTarget(encounter.Enemies, rng)
	if targetIndex < 0 {
		return defend
	}
	target := &encounter.Enemies[targetIndex]
	ready := readySkills(player)
	try := func(skillID, targetID string) (Command, bool) {
		command := Command{Type: "combat", Round: round, Action: "skill", Skill: skillID, TargetID: targetID}
		return command, validateSkillCommand(room, player, encounter, command) == nil
	}

	// 1. Interrupts.
	claimed := map[string]bool{}
	if run.CombatRound != nil {
		for _, action := range run.CombatRound.Actions {
			if definition, ok := findSkill(action.Skill); ok && SkillInterrupts(definition) {
				claimed[action.TargetID] = true
			}
		}
	}
	for _, definition := range ready {
		if !SkillInterrupts(definition) || definition.Target != SkillTargetEnemy {
			continue
		}
		for _, enemy := range encounter.Enemies {
			if enemy.Health > 0 && enemy.Intent != nil && enemy.Intent.Interruptible && enemy.Intent.Damage >= 4 && !claimed[enemy.ID] {
				if command, ok := try(definition.ID, enemy.ID); ok {
					return command
				}
			}
		}
	}

	// 2-3. Revive and heal.
	living := eligibleCombatPlayers(room)
	for _, definition := range ready {
		if !skillHas(definition, EffectRevive) {
			continue
		}
		for _, id := range sortedPlayerIDs(run.Players) {
			if command, ok := try(definition.ID, id); ok && run.Players[id].Health <= 0 {
				return command
			}
		}
	}
	wounded := mostWounded(run, living)
	if wounded != nil && wounded.Health*100 < wounded.MaxHealth*60 {
		for _, definition := range ready {
			if !skillHas(definition, EffectHeal) && !skillHas(definition, EffectRegen) {
				continue
			}
			targetID := ""
			if definition.Target == SkillTargetAlly {
				targetID = wounded.ID
			}
			if definition.Target == SkillTargetEnemy {
				targetID = target.ID
			}
			if command, ok := try(definition.ID, targetID); ok {
				return command
			}
		}
	}

	// 4. Protection.
	longFight := target.TurnsTaken > 12
	incoming := incomingDamageOn(playerID, encounter.Enemies, player)
	// Killing the target this round cancels its move: when that is enough to survive, attacking beats bracing.
	finishing := bestDamageOn(run, player, ready, target) >= target.Health && incoming-intentDamageOn(playerID, target, player) < player.Health
	if incoming > 0 && incoming >= player.Health && !finishing && !longFight {
		if definition, ok := bestProtection(ready, false); ok {
			if command, ok := try(definition.ID, ""); ok {
				return command
			}
		}
		if contains(player.Skills, SkillDefend) {
			return defend
		}
	}
	for _, id := range living {
		ally := run.Players[id]
		if id == playerID || longFight {
			continue
		}
		if danger := incomingDamageOn(id, encounter.Enemies, ally); danger > 0 && danger >= ally.Health {
			if definition, ok := bestProtection(ready, true); ok {
				targetID := ""
				if definition.Target == SkillTargetAlly {
					targetID = id
				}
				if command, ok := try(definition.ID, targetID); ok {
					return command
				}
			}
			for _, definition := range ready {
				if skillHas(definition, EffectTaunt) && player.Health*2 > player.MaxHealth {
					targetID := ""
					if definition.Target == SkillTargetEnemy {
						targetID = target.ID
					}
					if command, ok := try(definition.ID, targetID); ok {
						return command
					}
				}
			}
		}
	}

	// 5. The most valuable ready skill.
	livingEnemies := 0
	for _, enemy := range encounter.Enemies {
		if enemy.Health > 0 {
			livingEnemies++
		}
	}
	best, bestValue := "", -1
	for _, definition := range ready {
		value := skillValue(definition, player, target, livingEnemies, len(living), incoming)
		if damage := estimatedDamage(run, player, definition, target); damage >= target.Health {
			value += 20 // a killing blow also stops the enemy's move
		}
		if value > bestValue {
			targetID := ""
			if definition.Target == SkillTargetEnemy {
				targetID = target.ID
			}
			if _, ok := try(definition.ID, targetID); ok {
				best, bestValue = definition.ID, value
			}
		}
	}
	if best != "" && bestValue > 0 {
		definition, _ := findSkill(best)
		targetID := ""
		if definition.Target == SkillTargetEnemy {
			targetID = target.ID
		}
		command, _ := try(best, targetID)
		return command
	}
	return defend
}

// randomSkillCommands lists every valid command a player could submit this round: the random policy picks one.
func randomSkillCommands(room *Room, playerID string, round int) []Command {
	run := room.Run
	player := run.Players[playerID]
	current := run.Rooms[run.CurrentRoomID]
	if player == nil || current == nil || current.Encounter == nil {
		return nil
	}
	ensureSkills(player)
	commands := []Command{{Type: "combat", Round: round, Action: "defend"}}
	for _, definition := range readySkills(player) {
		var targets []string
		switch definition.Target {
		case SkillTargetEnemy:
			for _, enemy := range current.Encounter.Enemies {
				targets = append(targets, enemy.ID)
			}
		case SkillTargetAlly, SkillTargetFallen:
			targets = append([]string{""}, room.PlayerIDs...)
		default:
			targets = []string{""}
		}
		for _, targetID := range targets {
			command := Command{Type: "combat", Round: round, Action: "skill", Skill: definition.ID, TargetID: targetID}
			if validateSkillCommand(room, player, current.Encounter, command) == nil {
				commands = append(commands, command)
			}
		}
	}
	return commands
}

func readySkills(player *PlayerState) []SkillDefinition {
	var ready []SkillDefinition
	for _, id := range player.Skills {
		if definition, ok := findSkill(id); ok && player.ClassCombat.Cooldowns[id] == 0 && id != SkillDefend {
			ready = append(ready, definition)
		}
	}
	return ready
}

func skillHas(definition SkillDefinition, kind SkillEffectKind) bool {
	for _, effect := range definition.Effects {
		if effect.Kind == kind {
			return true
		}
	}
	return false
}

// bestProtection is the ready guard or ward skill that blocks the most, for yourself or (forAlly) for an ally.
func bestProtection(ready []SkillDefinition, forAlly bool) (SkillDefinition, bool) {
	var best SkillDefinition
	bestBlock := 0
	for _, definition := range ready {
		if forAlly && definition.Target != SkillTargetAlly && definition.Target != SkillTargetParty {
			continue
		}
		if !forAlly && definition.Target != SkillTargetSelf && definition.Target != SkillTargetAlly && definition.Target != SkillTargetParty {
			continue
		}
		block := 0
		for _, effect := range definition.Effects {
			switch effect.Kind {
			case EffectGuard:
				block += GuardDamageReduction + effect.Amount
			case EffectWard:
				block += effect.Amount
			}
		}
		if block > bestBlock {
			best, bestBlock = definition, block
		}
	}
	return best, bestBlock > 0
}

// skillValue roughly prices a skill this round, in damage-equivalents.
func skillValue(definition SkillDefinition, player *PlayerState, target *Enemy, livingEnemies, livingAllies, incoming int) int {
	value := 0
	enemies := 1
	if definition.Target == SkillTargetAllEnemies {
		enemies = livingEnemies
	}
	for _, effect := range definition.Effects {
		amount := effect.Amount + statValue(player, effect.Stat)
		if effect.Bonus > 0 && conditionHolds(effect.When, player, target) {
			amount += effect.Bonus
		}
		switch effect.Kind {
		case EffectDamage:
			value += amount * enemies
		case EffectCounter:
			taken := player.ClassCombat.DamageTakenLastRound
			if taken > effect.Cap {
				taken = effect.Cap
			}
			value += (effect.Amount + taken) * enemies
		case EffectBleed:
			value += effect.Amount * effect.Rounds * enemies * 3 / 4
		case EffectMark:
			value += effect.Amount * enemies * 3 / 4
		case EffectStun:
			if !isBossEnemy(target) {
				value += 5 * enemies
			} else {
				value += 2 * enemies
			}
		case EffectWeaken:
			if target.Intent != nil {
				reduced := effect.Amount
				if reduced > target.Intent.Damage {
					reduced = target.Intent.Damage
				}
				value += reduced * enemies
			}
		case EffectEmpower:
			allies := 1
			if definition.Target == SkillTargetParty || effect.Scope == ScopeParty {
				allies = livingAllies
			}
			value += amount * allies * 2 / 3
		case EffectGuard, EffectWard:
			if incoming > 0 {
				block := amount
				if effect.Kind == EffectGuard {
					block += GuardDamageReduction
				}
				if block > incoming {
					block = incoming
				}
				value += block
			}
		}
	}
	return value
}

// estimatedDamage is what a skill's damage effects would deal to one enemy, after its barrier.
func estimatedDamage(run *Run, player *PlayerState, definition SkillDefinition, enemy *Enemy) int {
	total, struck := 0, false
	for _, effect := range definition.Effects {
		switch effect.Kind {
		case EffectDamage:
			total += effect.Amount + statValue(player, effect.Stat)
			if effect.Bonus > 0 && conditionHolds(effect.When, player, enemy) {
				total += effect.Bonus
			}
			struck = struck || effect.Amount > 0 || effect.Stat != ""
		case EffectCounter:
			taken := player.ClassCombat.DamageTakenLastRound
			if taken > effect.Cap {
				taken = effect.Cap
			}
			total += effect.Amount + taken
			struck = true
		}
	}
	if !struck {
		return 0
	}
	passive := classPassiveEffects(player, enemy, nil)
	total += weaponBonus(run, player) + passive.AttackDamage + player.ClassCombat.Empower + enemy.MarkedDamage
	if definition.Elemental {
		total += passive.ElementalDamage
	}
	if definition.Basic {
		total -= enemy.Barrier
	}
	return total
}

func bestDamageOn(run *Run, player *PlayerState, ready []SkillDefinition, enemy *Enemy) int {
	best := 0
	for _, definition := range ready {
		if definition.Target != SkillTargetEnemy && definition.Target != SkillTargetAllEnemies {
			continue
		}
		if damage := estimatedDamage(run, player, definition, enemy); damage > best {
			best = damage
		}
	}
	return best
}

func intentDamageOn(playerID string, enemy *Enemy, player *PlayerState) int {
	if enemy.Intent == nil || (!enemy.Intent.TargetAll && enemy.Intent.TargetPlayerID != playerID) {
		return 0
	}
	if damage := enemy.Intent.Damage - classPassiveEffects(player, enemy, enemy.Intent).DamageReduction; damage > 0 {
		return damage
	}
	return 0
}

// incomingDamageOn is the telegraphed damage aimed at one adventurer this round, after passive reductions.
func incomingDamageOn(playerID string, enemies []Enemy, player *PlayerState) int {
	total := 0
	for i := range enemies {
		enemy := &enemies[i]
		if enemy.Health <= 0 || enemy.Intent == nil || (!enemy.Intent.TargetAll && enemy.Intent.TargetPlayerID != playerID) {
			continue
		}
		damage := enemy.Intent.Damage - classPassiveEffects(player, enemy, enemy.Intent).DamageReduction
		if damage > 0 {
			total += damage
		}
	}
	return total
}

func mostWounded(run *Run, living []string) *PlayerState {
	var wounded *PlayerState
	for _, id := range living {
		candidate := run.Players[id]
		if candidate.Health >= candidate.MaxHealth {
			continue
		}
		if wounded == nil || candidate.Health*wounded.MaxHealth < wounded.Health*candidate.MaxHealth {
			wounded = candidate
		}
	}
	return wounded
}

func sortedPlayerIDs(players map[string]*PlayerState) []string {
	ids := make([]string, 0, len(players))
	for id := range players {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	return ids
}

// simulationTarget is the weakest living enemy, ties broken by the seed.
func simulationTarget(enemies []Enemy, rng *rand.Rand) int {
	lowestHealth := -1
	candidates := make([]int, 0, len(enemies))
	for i := range enemies {
		if enemies[i].Health <= 0 {
			continue
		}
		if lowestHealth < 0 || enemies[i].Health < lowestHealth {
			lowestHealth = enemies[i].Health
			candidates = candidates[:0]
			candidates = append(candidates, i)
		} else if enemies[i].Health == lowestHealth {
			candidates = append(candidates, i)
		}
	}
	if len(candidates) == 0 {
		return -1
	}
	return candidates[rng.Intn(len(candidates))]
}
