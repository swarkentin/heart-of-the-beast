package game

import (
	"errors"
	"sort"
	"time"
)

const CombatActionWindow = 8 * time.Second

var (
	ErrRoundActionSubmitted = errors.New("an action has already been submitted for this round")
	ErrRoundNotActive       = errors.New("there is no active combat round")
)

func startCombatRound(run *Run, now time.Time) {
	number := 1
	if run.CombatRound != nil {
		number = run.CombatRound.Number + 1
	}
	run.CombatRound = &CombatRound{
		Number: number, StartedAt: now.UTC(),
		Deadline: now.UTC().Add(CombatActionWindow),
		Actions: make(map[string]Command),
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
		return ErrRoundNotActive
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

	playerIDs := make([]string, 0, len(run.CombatRound.Actions))
	for playerID := range run.CombatRound.Actions {
		playerIDs = append(playerIDs, playerID)
	}
	sort.Strings(playerIDs)
	for _, playerID := range playerIDs {
		player := run.Players[playerID]
		if player == nil || player.Health <= 0 || room.Presence[playerID].LeftAt != nil {
			continue
		}
		action := run.CombatRound.Actions[playerID]
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
