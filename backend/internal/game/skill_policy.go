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
			if definition.Target == SkillTargetSelf && wounded.ID != playerID {
				continue
			}
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
		value := skillValue(run, definition, player, target, livingEnemies, len(living), incoming)
		if spiked, ok := target.trait(TraitSpiked); ok && definition.Basic {
			value -= spiked.Amount * 2 // spikes cut whoever uses a basic attack on them
		}
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
func skillValue(run *Run, definition SkillDefinition, player *PlayerState, target *Enemy, livingEnemies, livingAllies, incoming int) int {
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
		case EffectLifesteal:
			// Lifesteal is both damage and sustain. Without pricing the healing, the tactical
			// policy ignores Juggernaut's defining recovery skill and burns herbs instead.
			healing := estimatedDamage(run, player, definition, target) * effect.Amount / 100
			if missing := player.MaxHealth - player.Health; healing > missing {
				healing = missing
			}
			value += healing
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
	if current := run.Rooms[run.CurrentRoomID]; current != nil {
		total = traitDamageTaken(run, current.Encounter, enemy, total, 0, false)
	}
	if definition.Basic {
		total -= enemy.Barrier
	}
	return total
}

// tacticalLifestealCanReplaceHerb reports whether a ready attack can restore at least 10% of max health
// while still dealing damage. That is the absolute sustain value that justified saving an herb before
// the base herb was raised from 30% to 50%; prefer the attack rather than spend a combat action healing.
func tacticalLifestealCanReplaceHerb(room *Room, player *PlayerState) bool {
	if room == nil || room.Run == nil || player == nil || player.Health <= 0 {
		return false
	}
	current := room.Run.Rooms[room.Run.CurrentRoomID]
	if current == nil || current.Encounter == nil {
		return false
	}
	herbHealing := (player.MaxHealth*HealingHerbHealingPercent + 99) / 100
	herbHealing = floorRulesFor(room.Run).consumableHealing(herbHealing)
	minimumHealing := (player.MaxHealth*15 + 99) / 100
	missing := player.MaxHealth - player.Health
	if missing < minimumHealing {
		return false
	}
	for _, definition := range readySkills(player) {
		for _, effect := range definition.Effects {
			if effect.Kind != EffectLifesteal || effect.Amount <= 0 {
				continue
			}
			for i := range current.Encounter.Enemies {
				enemy := &current.Encounter.Enemies[i]
				if enemy.Health <= 0 {
					continue
				}
				healing := estimatedDamage(room.Run, player, definition, enemy) * effect.Amount / 100
				if healing > missing {
					healing = missing
				}
				if healing >= minimumHealing {
					return true
				}
			}
		}
	}
	return false
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

// simulationTarget is the enemy to focus, ties broken by the seed: the weakest living enemy, counting a shield
// as health and an out-of-phase enemy as twice as tough, except that a lit fuse, a bodyguard or a warder comes
// first, since dropping it is what answers its trait.
func simulationTarget(enemies []Enemy, rng *rand.Rand) int {
	lowestHealth := -1
	candidates := make([]int, 0, len(enemies))
	for i := range enemies {
		if enemies[i].Health <= 0 {
			continue
		}
		key := targetPriority(&enemies[i])
		if lowestHealth < 0 || key < lowestHealth {
			lowestHealth = key
			candidates = candidates[:0]
			candidates = append(candidates, i)
		} else if key == lowestHealth {
			candidates = append(candidates, i)
		}
	}
	if len(candidates) == 0 {
		return -1
	}
	return candidates[rng.Intn(len(candidates))]
}

func targetPriority(enemy *Enemy) int {
	key := enemy.Health + enemy.Shield
	if enemy.Phased {
		key *= 2
	}
	if _, ok := enemy.trait(TraitFuse); ok {
		return key - 100
	}
	for _, kind := range []string{TraitBodyguard, TraitWarder} {
		if _, ok := enemy.trait(kind); ok {
			return key - 8
		}
	}
	return key + 100
}
