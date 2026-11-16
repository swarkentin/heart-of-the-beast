package game

import (
	"errors"
	"time"
)

var ErrInvalidEventChoice = errors.New("choice is not available in this room")

// ChooseRoomEvent resolves a room's authored choice and applies its reward to
// the whole party. The server is authoritative; a choice is resolved once.
func ChooseRoomEvent(room *Room, actorID, choiceID string, now time.Time) error {
	run := room.Run
	if run == nil || run.Phase != PhaseExploring {
		return ErrInvalidPhase
	}
	player := run.Players[actorID]
	if player == nil {
		return ErrNotPlayer
	}
	if player.Health <= 0 || room.Presence[actorID].LeftAt != nil {
		return ErrInvalidPhase
	}
	current := run.Rooms[run.CurrentRoomID]
	if current == nil || current.Event == nil || current.Event.Resolved {
		return ErrInvalidPhase
	}
	var choice *EventChoice
	for i := range current.Event.Choices {
		if current.Event.Choices[i].ID == choiceID {
			choice = &current.Event.Choices[i]
			break
		}
	}
	if choice == nil {
		return ErrInvalidEventChoice
	}
	if run.Flags == nil {
		run.Flags = make(map[string]bool)
	}

	run.LastCombatEvents = make([]CombatEvent, 0, len(run.Players))
	applied, outcome := applyRoomEventEffect(room, choice.Effect)
	if !applied {
		return ErrInvalidEventChoice
	}

	current.Event.Resolved = true
	current.Event.Result = choice.Description
	if outcome != "" {
		current.Event.Result = outcome
	}
	current.Cleared = true
	startNavigationVote(room, now)
	return nil
}
