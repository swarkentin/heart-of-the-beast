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
			ID: "entry", Name: "The Watcher's Hall", Floor: "01", RoomType: "encounter",
			Description: "A dead watchfire gutters beneath a ceiling of carved stone. Something stirs in the ash.",
			Exits: []Exit{
				{ID: "north", Destination: "reliquary", Label: "The Silent Reliquary", Description: "Harder fight; claim a sigil that empowers your attacks."},
				{ID: "south", Destination: "flooded-crossing", Label: "The Drowned Crossing", Description: "Safer fight; search the waterlogged cache for healing."},
			},
			Encounter: &Encounter{Status: EncounterActive, Enemies: []Enemy{{ID: "sentinel", Name: "Restless Sentinel", Behavior: "sentinel", Health: 10, MaxHealth: 10}}},
		},
		"reliquary": {
			ID: "reliquary", Name: "The Silent Reliquary", Floor: "02", RoomType: "encounter",
			Description: "Two rows of stone kings watch over a cracked sarcophagus. A guardian rises as a drowned scout slips from the dark.",
			Exits:       []Exit{{ID: "east", Destination: "archive", Label: "The Archive of Names"}},
			Encounter: &Encounter{Status: EncounterActive, Enemies: []Enemy{
				{ID: "guardian", Name: "Reliquary Guardian", Behavior: "guardian", Health: 20, MaxHealth: 20},
				{ID: "scout", Name: "Drowned Scout", Behavior: "scout", Health: 15, MaxHealth: 15},
			}},
		},
		"flooded-crossing": {
			ID: "flooded-crossing", Name: "The Drowned Crossing", Floor: "02", RoomType: "encounter",
			Description: "A half-submerged causeway crosses black water. Pale hands grasp at the stones below.",
			Exits:       []Exit{{ID: "east", Destination: "archive", Label: "The Archive of Names"}},
			Encounter:   &Encounter{Status: EncounterActive, Enemies: []Enemy{{ID: "scout", Name: "Drowned Scout", Behavior: "scout", Health: 14, MaxHealth: 14}}},
		},
		"archive": {
			ID: "archive", Name: "The Archive of Names", Floor: "03", RoomType: "event",
			Description: "Waterlogged shelves lean beneath a mural of the Warden. One inscription still glows beneath the silt.",
			Exits:       []Exit{{ID: "north", Destination: "bone-gallery", Label: "The Gallery of Bones"}},
			Event: &RoomEvent{ID: "inscription", Title: "A Name Carved in Stone", Description: "The inscription describes the Warden's binding. Studying it may reveal a weakness, but the old script is beginning to fade.", Choices: []EventChoice{
				{ID: "study", Label: "Study the inscription", Description: "Learn the Warden's weakness. Your party's strikes will hit harder against it.", Effect: "study_weakness"},
				{ID: "leave", Label: "Leave it undisturbed", Description: "Move on before the archive collapses.", Effect: "leave"},
			}},
		},
		"bone-gallery": {
			ID: "bone-gallery", Name: "The Gallery of Bones", Floor: "04", RoomType: "encounter",
			Description: "Pillars of fused bone frame a ceremonial dais. The gallery's guardians attack anything that disturbs the dead.",
			Exits:       []Exit{{ID: "west", Destination: "captive-cell", Label: "The Prisoner's Cell"}, {ID: "east", Destination: "reliquary-vault", Label: "The Reliquary Vault"}},
			Encounter: &Encounter{Status: EncounterActive, Enemies: []Enemy{
				{ID: "gallery-guardian", Name: "Bonebound Guardian", Behavior: "guardian", Health: 22, MaxHealth: 22},
				{ID: "gallery-scout", Name: "Crypt Skirmisher", Behavior: "scout", Health: 16, MaxHealth: 16},
			}},
		},
		"captive-cell": {
			ID: "captive-cell", Name: "The Prisoner's Cell", Floor: "04", RoomType: "event",
			Description: "A wounded archivist is chained beneath a collapsed arch. A cache of healing draughts sits just beyond the rubble, but the stonework is groaning.",
			Exits:       []Exit{{ID: "east", Destination: "reliquary-vault", Label: "The Reliquary Vault"}},
			Event: &RoomEvent{ID: "rescue", Title: "Someone Still Lives", Description: "The archivist knows a hidden route through the Warden's defenses. Freeing them will cost precious time, but they may repay the risk.", Choices: []EventChoice{
				{ID: "rescue", Label: "Free the archivist", Description: "Complete the side mission and recover a healing draught for every adventurer.", Effect: "rescue_archivist"},
				{ID: "leave", Label: "Keep moving", Description: "Leave before the ceiling gives way.", Effect: "leave"},
			}},
		},
		"reliquary-vault": {
			ID: "reliquary-vault", Name: "The Reliquary Vault", Floor: "05", RoomType: "reward",
			Description: "A sealed vault opens around two relics: an ember sealed in glass and a stone charm etched with warding runes.",
			Exits:       []Exit{{ID: "north", Destination: "warden-gate", Label: "The Warden's Gate"}},
			Event: &RoomEvent{ID: "relic-choice", Title: "Choose Your Relic", Description: "There is time to claim one relic before the Warden senses the breach. The choice will shape how your party fights.", Choices: []EventChoice{
				{ID: "ember", Label: "Emberheart", Description: "Strike deals 3 additional damage for the rest of the run.", Effect: "ember_charm"},
				{ID: "stone", Label: "Stoneward", Description: "Defend blocks 4 additional damage for the rest of the run.", Effect: "stone_charm"},
			}},
		},
		"warden-gate": {
			ID: "warden-gate", Name: "The Warden's Gate", Floor: "06", RoomType: "encounter",
			Description: "The gate's chains tighten as two sentries step from their alcoves. The sanctum lies beyond them.",
			Exits:       []Exit{{ID: "north", Destination: "warden", Label: "The Warden's Sanctum"}},
			Encounter: &Encounter{Status: EncounterActive, Enemies: []Enemy{
				{ID: "gate-guardian", Name: "Gatekeeper", Behavior: "guardian", Health: 20, MaxHealth: 20},
				{ID: "gate-scout", Name: "Gravebound Sentry", Behavior: "scout", Health: 14, MaxHealth: 14},
			}},
		},
		"warden": {
			ID: "warden", Name: "The Warden's Sanctum", Floor: "07", RoomType: "boss",
			Description: "A vast chamber opens around a throne of black iron. The Crypt Warden rises, dragging its chains across the stone.",
			Encounter:   &Encounter{Status: EncounterActive, Enemies: []Enemy{{ID: "warden", Name: "Crypt Warden", Behavior: "warden", Health: 42, MaxHealth: 42}}},
		},
	}

	// Solo keeps the same route and decisions, but takes less cumulative damage
	// from the optional multi-enemy formations.
	if len(room.PlayerIDs) == 1 {
		for _, id := range []string{"reliquary", "bone-gallery", "warden-gate"} {
			encounter := rooms[id].Encounter
			for i := range encounter.Enemies {
				encounter.Enemies[i].Health = encounter.Enemies[i].Health * 3 / 4
				encounter.Enemies[i].MaxHealth = encounter.Enemies[i].Health
			}
		}
		rooms["flooded-crossing"].Encounter.Enemies[0].Health = 11
		rooms["flooded-crossing"].Encounter.Enemies[0].MaxHealth = 11
		rooms["warden"].Encounter.Enemies[0].Health = 36
		rooms["warden"].Encounter.Enemies[0].MaxHealth = 36
	}

	players := make(map[string]*PlayerState, len(room.PlayerIDs))
	for _, id := range room.PlayerIDs {
		player := newPlayerState(id, room.PlayerArchetypes[id])
		player.StrikeDamage = 10
		player.GuardReduction = GuardDamageReduction
		players[id] = player
	}
	room.Run = &Run{
		ID: runID, Phase: PhaseCombat, CurrentRoomID: "entry", Rooms: rooms,
		Players: players, Flags: make(map[string]bool), StartedAt: now,
	}
	startCombatRound(room, now)
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

	switch command.Type {
	case "combat":
		return SubmitCombatAction(room, actorID, command, now)
	case "choose_exit":
		return SubmitNavigationVote(room, actorID, command.ExitID, now)
	case "choose_event":
		return ChooseRoomEvent(room, actorID, command.ChoiceID, now)
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
