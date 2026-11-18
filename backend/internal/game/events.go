package game

import (
	"errors"
	"math/rand/v2"
	"time"
)

var ErrInvalidEventChoice = errors.New("choice is not available in this room")

const RoomEventVoteWindow = 15 * time.Second

var ErrRoomEventVoteClosed = errors.New("room decision vote has already closed")

// startRoomEventVote opens a shared decision window when a multi-option event is
// entered by a party. Solo choices remain immediate.
func startRoomEventVote(room *Room, now time.Time) {
	run := room.Run
	if run == nil {
		return
	}
	current := run.Rooms[run.CurrentRoomID]
	if current == nil || current.Event == nil || len(current.Event.Choices) < 2 || len(eligibleRoomEventVoters(room)) < 2 {
		run.EventVote = nil
		return
	}
	run.EventVote = &RoomEventVote{
		EventID:   current.Event.ID,
		StartedAt: now.UTC(),
		Deadline:  now.UTC().Add(RoomEventVoteWindow),
		Votes:     make(map[string]string),
	}
}

// ChooseRoomEvent records or replaces a player's vote. The winning option is
// applied once to the whole party after everyone votes or the deadline passes.
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
	if !hasEventChoice(current.Event, choiceID) {
		return ErrInvalidEventChoice
	}

	vote := run.EventVote
	if vote == nil {
		return resolveRoomEventChoice(room, choiceID, now)
	}
	if vote.EventID != current.Event.ID {
		return ErrInvalidPhase
	}
	if !now.Before(vote.Deadline) {
		AdvanceRoomEventVote(room, now)
		return ErrRoomEventVoteClosed
	}
	vote.Votes[actorID] = choiceID
	if allRoomEventVotesSubmitted(room) {
		AdvanceRoomEventVote(room, now)
	}
	return nil
}

// AdvanceRoomEventVote is safe to call while player and spectator snapshots are
// polled. It resolves once everyone eligible has voted or the deadline passes.
func AdvanceRoomEventVote(room *Room, now time.Time) bool {
	run := room.Run
	if run == nil || run.Phase != PhaseExploring || run.EventVote == nil {
		return false
	}
	current := run.Rooms[run.CurrentRoomID]
	if current == nil || current.Event == nil || current.Event.Resolved || current.Event.ID != run.EventVote.EventID {
		run.EventVote = nil
		return false
	}
	if now.Before(run.EventVote.Deadline) && !allRoomEventVotesSubmitted(room) {
		return false
	}

	eligible := make(map[string]bool)
	for _, playerID := range eligibleRoomEventVoters(room) {
		eligible[playerID] = true
	}
	counts := make(map[string]int, len(current.Event.Choices))
	for playerID, choiceID := range run.EventVote.Votes {
		if eligible[playerID] && hasEventChoice(current.Event, choiceID) {
			counts[choiceID]++
		}
	}
	maxVotes := 0
	for _, count := range counts {
		if count > maxVotes {
			maxVotes = count
		}
	}
	candidates := make([]string, 0, len(current.Event.Choices))
	for _, choice := range current.Event.Choices {
		if maxVotes == 0 || counts[choice.ID] == maxVotes {
			candidates = append(candidates, choice.ID)
		}
	}
	winner := candidates[rand.IntN(len(candidates))]
	run.EventVote = nil
	_ = resolveRoomEventChoice(room, winner, now)
	return true
}

func eligibleRoomEventVoters(room *Room) []string {
	if room.Run == nil {
		return nil
	}
	eligible := make([]string, 0, len(room.PlayerIDs))
	for _, playerID := range room.PlayerIDs {
		player := room.Run.Players[playerID]
		if player == nil || player.Health <= 0 || room.Presence[playerID].LeftAt != nil {
			continue
		}
		eligible = append(eligible, playerID)
	}
	return eligible
}

func allRoomEventVotesSubmitted(room *Room) bool {
	eligible := eligibleRoomEventVoters(room)
	if len(eligible) == 0 || room.Run.EventVote == nil {
		return false
	}
	for _, playerID := range eligible {
		if _, voted := room.Run.EventVote.Votes[playerID]; !voted {
			return false
		}
	}
	return true
}

func hasEventChoice(event *RoomEvent, choiceID string) bool {
	for _, choice := range event.Choices {
		if choice.ID == choiceID {
			return true
		}
	}
	return false
}

func resolveRoomEventChoice(room *Room, choiceID string, now time.Time) error {
	run := room.Run
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
	run.EventVote = nil
	startNavigationVote(room, now)
	return nil
}
