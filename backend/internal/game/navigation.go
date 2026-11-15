package game

import (
	"errors"
	"math/rand/v2"
	"time"
)

const NavigationVoteWindow = 15 * time.Second

var ErrNavigationVoteClosed = errors.New("navigation vote has already closed")

func startNavigationVote(room *Room, now time.Time) {
	run := room.Run
	if run == nil {
		return
	}
	current := run.Rooms[run.CurrentRoomID]
	if current == nil || len(current.Exits) < 2 || len(eligibleNavigationVoters(room)) < 2 {
		run.NavigationVote = nil
		return
	}
	run.NavigationVote = &NavigationVote{
		StartedAt: now.UTC(),
		Deadline:  now.UTC().Add(NavigationVoteWindow),
		Votes:     make(map[string]string),
	}
}

// SubmitNavigationVote records or replaces a player's path choice. A solo
// player, or a room with only one available path, transitions immediately.
func SubmitNavigationVote(room *Room, actorID, exitID string, now time.Time) error {
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
	if current == nil || !current.Cleared {
		return ErrInvalidPhase
	}
	if !hasExit(current, exitID) {
		return ErrInvalidExit
	}

	if run.NavigationVote == nil {
		transitionToExit(room, exitID, now)
		return nil
	}
	if !now.Before(run.NavigationVote.Deadline) {
		AdvanceNavigationVote(room, now)
		return ErrNavigationVoteClosed
	}
	run.NavigationVote.Votes[actorID] = exitID
	if allNavigationVotesSubmitted(room) {
		resolveNavigationVote(room, now)
	}
	return nil
}

// AdvanceNavigationVote is safe to call during player and spectator polling.
// It resolves only when all eligible players have voted or the deadline passes.
func AdvanceNavigationVote(room *Room, now time.Time) bool {
	if room.Run == nil || room.Run.Phase != PhaseExploring || room.Run.NavigationVote == nil {
		return false
	}
	if now.Before(room.Run.NavigationVote.Deadline) && !allNavigationVotesSubmitted(room) {
		return false
	}
	resolveNavigationVote(room, now)
	return true
}

func eligibleNavigationVoters(room *Room) []string {
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

func allNavigationVotesSubmitted(room *Room) bool {
	eligible := eligibleNavigationVoters(room)
	if len(eligible) == 0 || room.Run.NavigationVote == nil {
		return false
	}
	for _, playerID := range eligible {
		if _, voted := room.Run.NavigationVote.Votes[playerID]; !voted {
			return false
		}
	}
	return true
}

func resolveNavigationVote(room *Room, now time.Time) {
	run := room.Run
	if run == nil || run.NavigationVote == nil {
		return
	}
	current := run.Rooms[run.CurrentRoomID]
	if current == nil || len(current.Exits) == 0 {
		run.NavigationVote = nil
		return
	}

	counts := make(map[string]int, len(current.Exits))
	eligible := make(map[string]bool)
	for _, playerID := range eligibleNavigationVoters(room) {
		eligible[playerID] = true
	}
	for playerID, exitID := range run.NavigationVote.Votes {
		if eligible[playerID] && hasExit(current, exitID) {
			counts[exitID]++
		}
	}

	maxVotes := 0
	for _, count := range counts {
		if count > maxVotes {
			maxVotes = count
		}
	}
	candidates := make([]string, 0, len(current.Exits))
	for _, exit := range current.Exits {
		if maxVotes == 0 || counts[exit.ID] == maxVotes {
			candidates = append(candidates, exit.ID)
		}
	}
	// Equal top vote counts are intentionally settled randomly. With no votes
	// at all, every available exit is an equally valid timeout fallback.
	winner := candidates[rand.IntN(len(candidates))]
	run.NavigationVote = nil
	transitionToExit(run, winner, now)
}

func hasExit(room *DungeonRoom, exitID string) bool {
	for _, exit := range room.Exits {
		if exit.ID == exitID {
			return true
		}
	}
	return false
}

func transitionToExit(room *Room, exitID string, now time.Time) {
	run := room.Run
	current := run.Rooms[run.CurrentRoomID]
	for _, exit := range current.Exits {
		if exit.ID != exitID {
			continue
		}
		next := run.Rooms[exit.Destination]
		if next == nil {
			return
		}
		run.CurrentRoomID = next.ID
		run.Phase = PhaseCombat
		run.NavigationVote = nil
		startCombatRound(room, now)
		return
	}
}
