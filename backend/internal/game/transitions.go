package game

import (
	"errors"
	"time"
)

var (
	ErrRunAlreadyStarted = errors.New("run has already started")
	ErrRunNotStarted     = errors.New("run has not started")
	ErrInvalidPhase      = errors.New("command is not valid in the current phase")
	ErrInvalidExit       = errors.New("exit is not available from the current room")
	ErrInvalidTarget     = errors.New("target is not alive in the current encounter")
	ErrInvalidAction     = errors.New("unsupported combat action")
	ErrNotPlayer         = errors.New("actor is not a room player")
)

func StartRun(room *Room, runID string, now time.Time) error {
	if room.Run != nil {
		return ErrRunAlreadyStarted
	}
	if len(room.PlayerIDs) == 0 || runID == "" {
		return errors.New("room requires a player and run id")
	}

	rooms := map[string]*DungeonRoom{
		"entry": {
			ID:          "entry",
			Name:        "The Watcher's Hall",
			Description: "A narrow hall opens into a chamber watched by a restless sentinel.",
			Exits:       []Exit{{ID: "north", Destination: "reliquary", Label: "The Silent Reliquary"}},
			Encounter:   &Encounter{Status: EncounterActive, Enemies: []Enemy{{ID: "sentinel", Name: "Restless Sentinel", Health: 10, MaxHealth: 10}}},
		},
		"reliquary": {
			ID:          "reliquary",
			Name:        "The Silent Reliquary",
			Description: "Dust-covered alcoves conceal a guardian among the old offerings.",
			Exits:       []Exit{{ID: "east", Destination: "warden", Label: "The Warden's Gate"}},
			Encounter:   &Encounter{Status: EncounterActive, Enemies: []Enemy{{ID: "guardian", Name: "Reliquary Guardian", Health: 15, MaxHealth: 15}}},
		},
		"warden": {
			ID:          "warden",
			Name:        "The Warden's Gate",
			Description: "The crypt warden waits before the sealed gate.",
			Encounter:   &Encounter{Status: EncounterActive, Enemies: []Enemy{{ID: "warden", Name: "Crypt Warden", Health: 30, MaxHealth: 30}}},
		},
	}

	players := make(map[string]*PlayerState, len(room.PlayerIDs))
	for _, id := range room.PlayerIDs {
		players[id] = &PlayerState{ID: id, Health: 30, MaxHealth: 30}
	}
	room.Run = &Run{
		ID:            runID,
		Phase:         PhaseCombat,
		CurrentRoomID: "entry",
		Rooms:         rooms,
		Players:       players,
		StartedAt:     now,
	}
	startCombatRound(room.Run, now)
	return nil
}

// ApplyCommand mutates the aggregate only after validating the actor, phase,
// and command. Callers persist the aggregate atomically after this succeeds.
func ApplyCommand(room *Room, actorID string, command Command, now time.Time) error {
	if room.Run == nil {
		return ErrRunNotStarted
	}
	if _, ok := room.Run.Players[actorID]; !ok {
		return ErrNotPlayer
	}

	run := room.Run
	current := run.Rooms[run.CurrentRoomID]

	switch command.Type {
	case "combat":
		return SubmitCombatAction(room, actorID, command, now)
	case "choose_exit":
		return SubmitNavigationVote(room, actorID, command.ExitID, now)
	default:
		return ErrInvalidAction
	}
}

func allEnemiesDefeated(encounter *Encounter) bool {
	for _, enemy := range encounter.Enemies {
		if enemy.Health > 0 {
			return false
		}
	}
	return true
}
