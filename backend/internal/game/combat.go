package game

import (
	"errors"
	"sort"
	"time"
)

const CombatActionWindow = 8 * time.Second

var (
	ErrRoundActionSubmitted = errors.New("an action has already been submitted for this round")
	ErrStaleCombatRound     = errors.New("combat action belongs to an expired round")
)

func startCombatRound(run *Run, now time.Time) {
	run.CombatRoundNumber++
	run.CombatRound = &CombatRound{
		Number: run.CombatRoundNumber, StartedAt: now.UTC(),
		Deadline: now.UTC().Add(CombatActionWindow),
		Actions:  make(map[string]Command),
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
		startCombatRound(run, now)
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

	playerIDs := append([]string(nil), room.PlayerIDs...)
	sort.Strings(playerIDs)
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
				if enemy.ID == action.TargetID && enemy.Health > 0 {
					enemy.Health -= 10
					if enemy.Health < 0 {
						enemy.Health = 0
					}
					break
				}
			}
		case "defend":
			if player.Health < player.MaxHealth {
				player.Health++
			}
		}
	}

	if allEnemiesDefeated(current.Encounter) {
		current.Encounter.Status = EncounterCleared
		current.Cleared = true
		run.CombatRound = nil
		if run.CurrentRoomID == "warden" {
			run.Phase = PhaseCompleted
			completed := now.UTC()
			run.CompletedAt = &completed
		} else {
			run.Phase = PhaseExploring
		}
		return
	}
	startCombatRound(run, now)
}

func hasLivingEnemy(encounter *Encounter, enemyID string) bool {
	for _, enemy := range encounter.Enemies {
		if enemy.ID == enemyID && enemy.Health > 0 {
			return true
		}
	}
	return false
}
