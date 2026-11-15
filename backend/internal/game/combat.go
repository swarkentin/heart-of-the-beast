package game

import (
	"errors"
	"sort"
	"time"
)

const (
	CombatActionWindow = 8 * time.Second
	GuardDamageReduction = 6
)

var (
	ErrRoundActionSubmitted = errors.New("an action has already been submitted for this round")
	ErrStaleCombatRound     = errors.New("combat action belongs to an expired round")
)

func startCombatRound(room *Room, now time.Time) {
	run := room.Run
	run.CombatRoundNumber++
	run.CombatRound = &CombatRound{
		Number: run.CombatRoundNumber, StartedAt: now.UTC(),
		Deadline: now.UTC().Add(CombatActionWindow),
		Actions:  make(map[string]Command),
	}

	current := run.Rooms[run.CurrentRoomID]
	if current == nil || current.Encounter == nil {
		return
	}
	players := eligibleCombatPlayers(room)
	for enemyIndex := range current.Encounter.Enemies {
		enemy := &current.Encounter.Enemies[enemyIndex]
		if enemy.Health <= 0 {
			enemy.Intent = nil
			continue
		}
		enemy.TurnsTaken++
		enemy.Intent = buildEnemyIntent(enemy, enemy.TurnsTaken, enemyIndex, players)
	}
}

// SubmitCombatAction records one player's choice. In co-op, the round resolves
// only when every living, non-departed player has submitted or the deadline passes.
func SubmitCombatAction(room *Room, actorID string, command Command, now time.Time) error {
	run := room.Run
	if run == nil || run.Phase != PhaseCombat {
		return ErrInvalidPhase
	}
	player, ok := run.Players[actorID]
	if !ok {
		return ErrNotPlayer
	}
	if player.Health <= 0 || room.Presence[actorID].LeftAt != nil {
		return ErrInvalidPhase
	}
	if run.CombatRound == nil {
		startCombatRound(room, now)
	}
	if !now.Before(run.CombatRound.Deadline) {
		AdvanceCombatRound(room, now)
		if run.Phase != PhaseCombat || run.CombatRound == nil {
			return ErrInvalidPhase
		}
	}
	if command.Round != run.CombatRound.Number {
		return ErrStaleCombatRound
	}
	if _, exists := run.CombatRound.Actions[actorID]; exists {
		return ErrRoundActionSubmitted
	}
	if command.Action != "attack" && command.Action != "defend" {
		return ErrInvalidAction
	}
	if command.Action == "attack" {
		current := run.Rooms[run.CurrentRoomID]
		if current == nil || current.Encounter == nil || current.Encounter.Status != EncounterActive {
			return ErrInvalidPhase
		}
		if !hasLivingEnemy(current.Encounter, command.TargetID) {
			return ErrInvalidTarget
		}
	}
	run.CombatRound.Actions[actorID] = command
	if allCombatActionsSubmitted(room) {
		resolveCombatRound(room, now)
	}
	return nil
}

// AdvanceCombatRound applies timeout fallbacks. It is safe to call on every
// player/spectator snapshot; it changes state only when a deadline has elapsed.
func AdvanceCombatRound(room *Room, now time.Time) bool {
	if room.Run == nil || room.Run.Phase != PhaseCombat || room.Run.CombatRound == nil {
		return false
	}
	if now.Before(room.Run.CombatRound.Deadline) {
		return false
	}
	resolveCombatRound(room, now)
	return true
}

func allCombatActionsSubmitted(room *Room) bool {
	for _, playerID := range room.PlayerIDs {
		player := room.Run.Players[playerID]
		if player == nil || player.Health <= 0 || room.Presence[playerID].LeftAt != nil {
			continue
		}
		if _, submitted := room.Run.CombatRound.Actions[playerID]; !submitted {
			return false
		}
	}
	return true
}

func resolveCombatRound(room *Room, now time.Time) {
	run := room.Run
	if run == nil || run.CombatRound == nil {
		return
	}
	current := run.Rooms[run.CurrentRoomID]
	if current == nil || current.Encounter == nil {
		run.CombatRound = nil
		return
	}

	roundNumber := run.CombatRound.Number
	run.LastCombatEvents = make([]CombatEvent, 0, len(room.PlayerIDs)+len(current.Encounter.Enemies)*2)
	playerIDs := append([]string(nil), room.PlayerIDs...)
	sort.Strings(playerIDs)

	// Resolve all player choices before enemy intents. An enemy defeated here
	// cannot carry out its already-telegraphed action.
	for _, playerID := range playerIDs {
		player := run.Players[playerID]
		if player == nil || player.Health <= 0 || room.Presence[playerID].LeftAt != nil {
			continue
		}
		action, submitted := run.CombatRound.Actions[playerID]
		if !submitted {
			action = Command{Type: "combat", Action: "defend"}
		}
		switch action.Action {
		case "attack":
			for i := range current.Encounter.Enemies {
				enemy := &current.Encounter.Enemies[i]
				if enemy.ID != action.TargetID || enemy.Health <= 0 {
					continue
				}
				enemy.Health -= 10
				if enemy.Health < 0 {
					enemy.Health = 0
				}
				addCombatEvent(run, roundNumber, "player_attack", adventurerLabel(room, playerID)+" hits "+enemy.Name+" for 10 damage.")
				if enemy.Health == 0 {
					enemy.Intent = nil
					addCombatEvent(run, roundNumber, "enemy_defeated", enemy.Name+" is defeated. Its attack is stopped.")
				}
				break
			}
		case "defend":
			player.Guarding = true
			addCombatEvent(run, roundNumber, "player_defend", adventurerLabel(room, playerID)+" braces, blocking up to 6 damage from the next hit.")
		}
	}

	// Surviving enemies execute the intentions players saw during the action
	// window. A guard protects against one incoming hit; area attacks test each
	// player's own guard independently.
	for enemyIndex := range current.Encounter.Enemies {
		enemy := &current.Encounter.Enemies[enemyIndex]
		if enemy.Health <= 0 || enemy.Intent == nil {
			continue
		}
		intent := *enemy.Intent
		targets := intentTargets(room, intent)
		if len(targets) == 0 {
			addCombatEvent(run, roundNumber, "enemy_miss", enemy.Name+"'s "+intent.Label+" finds no target.")
		}
		for _, playerID := range targets {
			player := run.Players[playerID]
			if player == nil || player.Health <= 0 || room.Presence[playerID].LeftAt != nil {
				continue
			}
			damage := intent.Damage
			guarded := player.Guarding
			if guarded {
				damage -= GuardDamageReduction
				if damage < 0 {
					damage = 0
				}
				player.Guarding = false
			}
			player.Health -= damage
			if player.Health < 0 {
				player.Health = 0
			}
			message := enemy.Name+" uses "+intent.Label+" on "+adventurerLabel(room, playerID)+" for "+itoa(damage)+" damage."
			if guarded {
				message += " Guarded."
			}
			addCombatEvent(run, roundNumber, "enemy_attack", message)
			if player.Health == 0 {
				addCombatEvent(run, roundNumber, "player_down", adventurerLabel(room, playerID)+" is down!")
			}
		}
		if intent.Heal > 0 && enemy.Health > 0 {
			before := enemy.Health
			enemy.Health += intent.Heal
			if enemy.Health > enemy.MaxHealth {
				enemy.Health = enemy.MaxHealth
			}
			if enemy.Health > before {
				addCombatEvent(run, roundNumber, "enemy_heal", enemy.Name+" drains life and restores "+itoa(enemy.Health-before)+" health.")
			}
		}
		enemy.Intent = nil
	}

	for _, player := range run.Players {
		player.Guarding = false
	}

	if allEnemiesDefeated(current.Encounter) {
		current.Encounter.Status = EncounterCleared
		current.Cleared = true
		run.CombatRound = nil
		if run.CurrentRoomID == "warden" {
			run.Phase = PhaseCompleted
			completed := now.UTC()
			run.CompletedAt = &completed
			addCombatEvent(run, roundNumber, "victory", "The Crypt Warden falls. The catacombs are cleared!")
		} else {
			run.Phase = PhaseExploring
			startNavigationVote(room, now)
		}
		return
	}

	if len(eligibleCombatPlayers(room)) == 0 {
		run.CombatRound = nil
		run.Phase = PhaseFailed
		completed := now.UTC()
		run.CompletedAt = &completed
		addCombatEvent(run, roundNumber, "defeat", "The party has fallen. The run is over.")
		return
	}

	startCombatRound(room, now)
}

func buildEnemyIntent(enemy *Enemy, roundNumber, enemyIndex int, players []string) *EnemyIntent {
	intent := &EnemyIntent{}
	switch enemy.Behavior {
	case "scout":
		intent.Kind, intent.Label, intent.Damage = "quick_strike", "Quick jab", 3
	case "guardian":
		if roundNumber%2 == 1 {
			intent.Kind, intent.Label, intent.Damage = "heavy_strike", "Heavy blow", 8
		} else {
			intent.Kind, intent.Label, intent.Damage = "strike", "Stone strike", 4
		}
	case "warden":
		if roundNumber%3 == 0 {
			intent.Kind, intent.Label, intent.Damage, intent.TargetAll = "soul_sweep", "Soul sweep", 3, true
		} else {
			intent.Kind, intent.Label, intent.Damage, intent.Heal = "soul_drain", "Soul drain", 5, 2
		}
	default:
		intent.Kind, intent.Label, intent.Damage = "strike", "Strike", 4
	}
	if !intent.TargetAll && len(players) > 0 {
		targetIndex := (roundNumber + enemyIndex) % len(players)
		intent.TargetPlayerID = players[targetIndex]
	}
	return intent
}

func intentTargets(room *Room, intent EnemyIntent) []string {
	if intent.TargetAll {
		return eligibleCombatPlayers(room)
	}
	if intent.TargetPlayerID == "" {
		return nil
	}
	player := room.Run.Players[intent.TargetPlayerID]
	if player == nil || player.Health <= 0 || room.Presence[intent.TargetPlayerID].LeftAt != nil {
		return nil
	}
	return []string{intent.TargetPlayerID}
}

func eligibleCombatPlayers(room *Room) []string {
	if room.Run == nil {
		return nil
	}
	players := make([]string, 0, len(room.PlayerIDs))
	for _, playerID := range room.PlayerIDs {
		player := room.Run.Players[playerID]
		if player == nil || player.Health <= 0 || room.Presence[playerID].LeftAt != nil {
			continue
		}
		players = append(players, playerID)
	}
	sort.Strings(players)
	return players
}

func adventurerLabel(room *Room, playerID string) string {
	for index, id := range room.PlayerIDs {
		if id == playerID {
			return "Adventurer "+itoa(index+1)
		}
	}
	return "Adventurer"
}

func addCombatEvent(run *Run, round int, kind, message string) {
	run.LastCombatEvents = append(run.LastCombatEvents, CombatEvent{Round: round, Kind: kind, Message: message})
	if len(run.LastCombatEvents) > 8 {
		run.LastCombatEvents = append([]CombatEvent(nil), run.LastCombatEvents[len(run.LastCombatEvents)-8:]...)
	}
}

func itoa(value int) string {
	if value == 0 {
		return "0"
	}
	digits := make([]byte, 0, 3)
	for value > 0 {
		digits = append(digits, byte('0'+value%10))
		value /= 10
	}
	for left, right := 0, len(digits)-1; left < right; left, right = left+1, right-1 {
		digits[left], digits[right] = digits[right], digits[left]
	}
	return string(digits)
}

func hasLivingEnemy(encounter *Encounter, enemyID string) bool {
	for _, enemy := range encounter.Enemies {
		if enemy.ID == enemyID && enemy.Health > 0 {
			return true
		}
	}
	return false
}
