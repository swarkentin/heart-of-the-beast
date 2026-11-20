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

	partyScaling := MonsterScaling{HealthMultiplier: 1, PartySize: len(room.PlayerIDs)}
	soloScaling := MonsterScaling{HealthMultiplier: 0.75, RoundDown: true, PartySize: len(room.PlayerIDs)}
	encounterScaling := partyScaling
	if len(room.PlayerIDs) == 1 {
		encounterScaling = soloScaling
	}
	rooms := map[string]*DungeonRoom{
		"entry": {
			ID: "entry", Name: "The Watcher's Hall", Floor: "01", RoomType: "encounter",
			Description: "A dead watchfire gutters beneath a ceiling of carved stone. Something stirs in the ash.",
			Exits: []Exit{
				{ID: "north", Destination: "reliquary", Label: "The Silent Reliquary", Description: "Harder fight; claim a sigil that empowers your attacks."},
				{ID: "south", Destination: "flooded-crossing", Label: "The Drowned Crossing", Description: "Safer fight; search the waterlogged cache for healing."},
			},
			Encounter: newCatalogEncounter("catacombs-entry", "", partyScaling),
		},
		"reliquary": {
			ID: "reliquary", Name: "The Silent Reliquary", Floor: "02", RoomType: "encounter",
			Description: "Two rows of stone kings watch over a cracked sarcophagus. A guardian rises as a drowned scout slips from the dark.",
			Exits:       []Exit{{ID: "east", Destination: "archive", Label: "The Archive of Names"}},
			Encounter:   newCatalogEncounter("catacombs-reliquary", "", encounterScaling),
		},
		"flooded-crossing": {
			ID: "flooded-crossing", Name: "The Drowned Crossing", Floor: "02", RoomType: "encounter",
			Description: "A half-submerged causeway crosses black water. Pale hands grasp at the stones below.",
			Exits:       []Exit{{ID: "east", Destination: "archive", Label: "The Archive of Names"}},
			Encounter:   newCatalogEncounter("catacombs-flooded-crossing", "", partyScaling),
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
			Encounter:   newCatalogEncounter("catacombs-bone-gallery", "", encounterScaling),
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
			Encounter:   newCatalogEncounter("catacombs-warden-gate", "", encounterScaling),
		},
		"warden": {
			ID: "warden", Name: "The Warden's Sanctum", Floor: "07", RoomType: "boss",
			Description: "A vast chamber opens around a throne of black iron. The Crypt Warden rises, dragging its chains across the stone.",
			Encounter:   newCatalogEncounter("catacombs-warden-boss", "", partyScaling),
		},
	}

	return beginRun(room, runID, now, DefaultDungeonThemeID, rooms, "entry")
}

// newRunPlayers builds the initial state of every player in the room.
func newRunPlayers(room *Room) (map[string]*PlayerState, error) {
	players := make(map[string]*PlayerState, len(room.PlayerIDs))
	for _, id := range room.PlayerIDs {
		var player *PlayerState
		if classID := room.PlayerClasses[id]; classID != "" {
			definition, ok := findClass(classID)
			if !ok || !ClassAvailableToPlayer(classID, nil) {
				return nil, ErrInvalidClass
			}
			player = newPlayerStateForClass(id, definition)
			player.Skills = runLoadout(room, id, classID)
		} else {
			player = newPlayerState(id, room.PlayerArchetypes[id])
		}
		player.StrikeDamage = PlayerStrikeDamage
		player.GuardReduction = GuardDamageReduction
		player.Consumables = map[string]int{ConsumableHealingHerb: StartingHealingHerbs}
		players[id] = player
	}
	return players, nil
}

// beginRun creates the run aggregate for a theme from its first floor and starts the first combat round.
func beginRun(room *Room, runID string, now time.Time, themeID string, rooms map[string]*DungeonRoom, entryID string) error {
	players, err := newRunPlayers(room)
	if err != nil {
		return err
	}
	for _, dungeonRoom := range rooms {
		if dungeonRoom.ThemeID == "" {
			dungeonRoom.ThemeID = themeID
		}
	}
	room.Run = &Run{
		ID: runID, ThemeID: themeID, Phase: PhaseCombat, CurrentRoomID: entryID, Rooms: rooms,
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
	case "cheat_idkfa":
		return applyIDKFA(room, actorID, now)
	case "upgrade_skill":
		return upgradeSkill(room, actorID, command.Skill)
	case "use_consumable":
		return useConsumable(room, actorID, command.ChoiceID)
	case "combat":
		return SubmitCombatAction(room, actorID, command, now)
	case "choose_exit":
		return SubmitNavigationVote(room, actorID, command.ExitID, now)
	case "choose_event":
		return ChooseRoomEvent(room, actorID, command.ChoiceID, now)
	case "choose_inter_floor":
		return resolveInterFloorChoice(room, actorID, command.ChoiceID, now)
	case "minigame", "choose_boon", "choose_dungeon", "buy", "ready", "set_loadout":
		return applyCampCommand(room, actorID, command, now)
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

// applyIDKFA is the hidden keyboard cheat. It skips the current floor's route and
// resolves its guardian through the ordinary combat/reward path, then fast-forwards
// the camp so the party enters the next floor (or dungeon) immediately.
func applyIDKFA(room *Room, actorID string, now time.Time) error {
	run := room.Run
	if run == nil || run.Generator < ExpeditionGenerator {
		return ErrInvalidPhase
	}
	player := run.Players[actorID]
	if player == nil || player.Health <= 0 || room.Presence[actorID].LeftAt != nil {
		return ErrInvalidPhase
	}
	run.Cheated = true
	if run.Phase == PhaseIntermission {
		// Solo camps have no automatic deadline. Give each stage an expired deadline
		// so the cheat skips the game, settles boon defaults, resolves crossroads,
		// and descends through the same normal camp transitions as a timed-out party.
		for steps := 0; steps < 6 && run.Phase == PhaseIntermission; steps++ {
			if run.Camp == nil {
				break
			}
			deadline := now.UTC().Add(-time.Second)
			run.Camp.Deadline = &deadline
			AdvanceCamp(room, now)
		}
		if run.Phase == PhaseCombat {
			addCombatEvent(run, 0, "cheat_idkfa", "A weary voice echoes through the dungeon: “IDKFA? Really? ... Fine. Go on, then.”")
			return nil
		}
		return ErrInvalidPhase
	}
	if run.Phase != PhaseCombat && run.Phase != PhaseExploring {
		return ErrInvalidPhase
	}

	var guardian *DungeonRoom
	for _, candidate := range run.Rooms {
		if candidate != nil && candidate.RoomType == "boss" && candidate.Encounter != nil && candidate.Encounter.Status != EncounterCleared {
			if guardian == nil || candidate.ID < guardian.ID {
				guardian = candidate
			}
		}
	}
	if guardian == nil {
		return ErrInvalidPhase
	}

	// IDKFA takes the party straight to this floor's guardian. The guardian is
	// defeated by a no-op round, so all normal boss rewards and floor transitions run.
	run.CurrentRoomID = guardian.ID
	run.Phase = PhaseCombat
	startCombatRound(room, now)
	for i := range guardian.Encounter.Enemies {
		guardian.Encounter.Enemies[i].Health = 0
		guardian.Encounter.Enemies[i].Barrier = 0
		guardian.Encounter.Enemies[i].Intent = nil
	}
	for _, id := range eligibleCombatPlayers(room) {
		run.CombatRound.Actions[id] = Command{Type: "combat", Action: "defend"}
	}
	resolveCombatRound(room, now)

	// Floors without a scheduled camp open the normal descent vote. The cheat
	// accepts that descent immediately; the floor boss has already paid out.
	if run.Phase == PhaseExploring {
		for _, exit := range guardian.Exits {
			if exit.Destination == DescendDestination {
				descendExpedition(room, now)
				addCombatEvent(run, 0, "cheat_idkfa", "A weary voice echoes through the dungeon: “IDKFA? Really? ... Fine. Go on, then.”")
				return nil
			}
		}
	}

	// Fast-forward every camp stage. This intentionally skips optional camp
	// activities, but lets the normal camp transition select the next dungeon
	// deterministically and preserve the expedition's progression state.
	for steps := 0; steps < 6 && run.Phase == PhaseIntermission; steps++ {
		if run.Camp == nil {
			break
		}
		deadline := now.UTC().Add(-time.Second)
		run.Camp.Deadline = &deadline
		AdvanceCamp(room, now)
	}
	addCombatEvent(run, 0, "cheat_idkfa", "A weary voice echoes through the dungeon: “IDKFA? Really? ... Fine. Go on, then.”")
	return nil
}
