package game

import (
	"fmt"
)

// assignEncounterModifier rolls once per ordinary encounter. The run seed and
// stable room ID make the result deterministic, and the assignment is persisted
// in the encounter so reconnects never reroll it.
func assignEncounterModifier(run *Run, room *DungeonRoom) {
	if run == nil || room == nil || room.Encounter == nil || room.Encounter.ModifierAssigned {
		return
	}
	room.Encounter.ModifierAssigned = true
	if room.RoomType != "encounter" {
		return
	}
	roll := run.Seed
	for _, char := range room.ID {
		roll = roll*33 + uint64(char)
	}
	if roll%5 != 0 {
		return
	} // about one in five ordinary encounters
	modifier := "ambush"
	if (roll/5)%2 == 1 {
		modifier = "unyielding"
	}
	for index := range room.Encounter.Enemies {
		enemy := &room.Encounter.Enemies[index]
		if enemy.Health <= 0 {
			continue
		}
		enemy.Modifier = modifier
		return
	}
}

// enforceUnyielding makes a telegraphed attack immune to interrupt skills.
func enforceUnyielding(enemy *Enemy) {
	if enemy != nil && enemy.Modifier == "unyielding" && enemy.Intent != nil {
		enemy.Intent.Interruptible = false
	}
}

// applyAmbush resolves the empowered enemy's opening intent before the party
// gets its first action. The intent is consumed here, not repeated later.
func applyAmbush(room *Room, dungeonRoom *DungeonRoom) {
	if room == nil || room.Run == nil || dungeonRoom == nil || dungeonRoom.Encounter == nil {
		return
	}
	for index := range dungeonRoom.Encounter.Enemies {
		enemy := &dungeonRoom.Encounter.Enemies[index]
		if enemy.Modifier != "ambush" || enemy.ModifierTriggered || enemy.Health <= 0 || enemy.Intent == nil {
			continue
		}
		enemy.ModifierTriggered = true
		intent := *enemy.Intent
		enemy.Intent = &EnemyIntent{Kind: "ambush_recovery", Label: "Recovering from ambush", Interruptible: false}
		targets := intentTargets(room, intent)
		if len(targets) == 0 {
			addCombatEvent(room.Run, room.Run.CombatRoundNumber, "enemy_ambush", enemy.Name+" springs an ambush, but finds no target.")
			return
		}
		addCombatEvent(room.Run, room.Run.CombatRoundNumber, "enemy_ambush", enemy.Name+" springs an ambush before the party can act!")
		for _, playerID := range targets {
			player := room.Run.Players[playerID]
			if player == nil || player.Health <= 0 {
				continue
			}
			mitigation := resolveIncomingDamage(IncomingDamageInput{
				IntentDamage:          intent.Damage,
				PassiveReduction:      classPassiveEffects(player, enemy, &intent).DamageReduction,
				Ward:                  player.ClassCombat.Ward,
				WardReflect:           player.ClassCombat.WardReflect,
				Guarding:              player.Guarding,
				GuardReduction:        player.GuardReduction,
				DefaultGuardReduction: GuardDamageReduction,
				GuardBonus:            player.ClassCombat.GuardBonus,
				PartyGuardReduction:   floorRulesFor(room.Run).PlayerGuard,
			})
			player.ClassCombat.Ward = mitigation.WardRemaining
			player.ClassCombat.WardReflect = mitigation.WardReflectRemaining
			player.Guarding = mitigation.Guarding
			player.ClassCombat.GuardBonus = mitigation.GuardBonus
			onClassGuardBlocked(player, intent, mitigation.Guarded, mitigation.GuardBlocked)
			damage := boonIncomingDamage(room, player, mitigation.Damage, room.Run.CombatRoundNumber)
			transition := resolveHealthDamage(player.Health, damage)
			player.Health = transition.Health
			if transition.Applied > 0 {
				addCombatImpact(room.Run, room.Run.CombatRoundNumber, "enemy_ambush", fmt.Sprintf("%s catches %s off guard for %d damage.", enemy.Name, adventurerLabel(room, playerID), transition.Applied), "damage", playerID, "player", transition.Applied)
			}
			if player.Health == 0 {
				addCombatEvent(room.Run, room.Run.CombatRoundNumber, "player_down", adventurerLabel(room, playerID)+" is down!")
			}
		}
		return
	}
}
