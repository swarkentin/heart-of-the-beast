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
	switch choice.Effect {
	case "study_weakness":
		run.Flags["warden_weakness"] = true
	case "rescue_archivist":
		run.Flags["archivist_rescued"] = true
		for playerID, member := range run.Players {
			if member.Health > 0 {
				before := member.Health
				member.Health += 10
				if member.Health > member.MaxHealth {
					member.Health = member.MaxHealth
				}
				if member.Health > before {
					addCombatImpact(run, 0, "player_heal", adventurerLabel(room, playerID)+" recovers "+itoa(member.Health-before)+" health from the archivist's draughts.", "heal", playerID, "player", member.Health-before)
				}
			}
		}
	case "ember_charm":
		run.Flags["emberheart"] = true
		for _, member := range run.Players {
			member.StrikeDamage += 3
		}
	case "stone_charm":
		run.Flags["stoneward"] = true
		for _, member := range run.Players {
			member.GuardReduction += 4
		}
	case "shrine_ward":
		for _, member := range run.Players {
			if member != nil { member.GuardReduction++ }
		}
		run.Flags["shrine_ward"] = true
	case "leave":
		// Choosing to move on is a valid outcome with no reward.
	default:
		return ErrInvalidEventChoice
	}

	current.Event.Resolved = true
	current.Event.Result = choice.Description
	current.Cleared = true
	startNavigationVote(room, now)
	return nil
}
