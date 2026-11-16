package game

import (
	"fmt"
	"math/rand"
	"sort"
	"time"
)

// RunSimulationReport describes one complete seeded expedition driven by the
// random-decision policy. The simulation executes the same domain commands as
// live play; it does not reproduce combat or reward rules independently.
type RunSimulationReport struct {
	Seed                  int64          `json:"seed"`
	PartyClasses          []string       `json:"partyClasses"`
	PartySize             int            `json:"partySize"`
	Outcome               string         `json:"outcome"`
	Completed             bool           `json:"completed"`
	Wiped                 bool           `json:"wiped"`
	ReachedDepth          int            `json:"reachedDepth"`
	RoomsVisited          int            `json:"roomsVisited"`
	EncountersCleared     int            `json:"encountersCleared"`
	CombatRounds          int            `json:"combatRounds"`
	PlayersDownAtEnd      int            `json:"playersDownAtEnd"`
	RemainingHealth       int            `json:"remainingHealth"`
	RemainingMaxHealth    int            `json:"remainingMaxHealth"`
	RemainingHealthPct    int            `json:"remainingHealthPct"`
	Levels                map[string]int `json:"levels"`
	Steps                 int            `json:"steps"`
}

// RunSimulationBatchReport summarizes a reproducible collection of full runs.
type RunSimulationBatchReport struct {
	Policy          string                `json:"policy"`
	SeedCount       int                   `json:"seedCount"`
	FirstSeed       int64                 `json:"firstSeed"`
	LastSeed        int64                 `json:"lastSeed"`
	PartyClasses    []string              `json:"partyClasses"`
	Completed       int                   `json:"completed"`
	Wiped           int                   `json:"wiped"`
	Stalled         int                   `json:"stalled"`
	CompletionRate  float64               `json:"completionRate"`
	WipeRate        float64               `json:"wipeRate"`
	DepthReachRates map[int]float64       `json:"depthReachRates"`
	MedianDepth     int                   `json:"medianDepth"`
	P90Depth        int                   `json:"p90Depth"`
	MedianRooms     int                   `json:"medianRoomsVisited"`
	MedianRounds    int                   `json:"medianCombatRounds"`
	Runs            []RunSimulationReport `json:"runs"`
}

const RandomRunPolicyDescription = "uniform random choice among currently legal combat actions, targets, room exits, room-event choices, and inter-floor choices; this is a deliberately unskilled baseline, not human play"

// SimulateRun runs one seeded multi-floor dungeon with the supplied class
// composition. A fresh aggregate is created for every run and all game
// transitions are performed through StartMultiLevelRun and ApplyCommand.
func SimulateRun(seed int64, classIDs []string, maxSteps int) (RunSimulationReport, error) {
	if len(classIDs) < 1 || len(classIDs) > 4 {
		return RunSimulationReport{}, fmt.Errorf("party must contain between 1 and 4 characters")
	}
	if maxSteps <= 0 {
		maxSteps = 2000
	}
	classes := make(map[string]bool)
	for _, definition := range ClassCatalog() {
		classes[definition.ID] = true
	}
	for _, id := range classIDs {
		if !classes[id] {
			return RunSimulationReport{}, fmt.Errorf("unknown class %q", id)
		}
	}

	rng := rand.New(rand.NewSource(seed))
	now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	runID := fmt.Sprintf("simulation-%d", seed)
	room := &Room{
		ID: runID, OwnerPlayerID: "hero-1",
		PlayerIDs: make([]string, len(classIDs)),
		PlayerClasses: make(map[string]string, len(classIDs)),
		Presence: make(map[string]PlayerPresence, len(classIDs)),
	}
	for i, classID := range classIDs {
		playerID := fmt.Sprintf("hero-%d", i+1)
		room.PlayerIDs[i] = playerID
		room.PlayerClasses[playerID] = classID
	}
	if err := StartMultiLevelRun(room, runID, now); err != nil {
		return RunSimulationReport{}, fmt.Errorf("start simulated run: %w", err)
	}
	// The supplied seed is the canonical generation seed. The run ID remains
	// stable and unique within this in-memory aggregate.
	room.Run.Seed = uint64(seed)

	visited := map[string]bool{room.Run.CurrentRoomID: true}
	steps := 0
	for room.Run.Phase != PhaseCompleted && room.Run.Phase != PhaseFailed && steps < maxSteps {
		steps++
		switch room.Run.Phase {
		case PhaseCombat:
			if room.Run.CombatRound == nil {
				startCombatRound(room, now)
			}
			round := room.Run.CombatRound.Number
			for _, playerID := range room.PlayerIDs {
				player := room.Run.Players[playerID]
				if player == nil || player.Health <= 0 {
					continue
				}
				candidates := randomCombatCommands(room, playerID, round)
				if len(candidates) == 0 {
					candidates = []Command{{Type: "combat", Round: round, Action: "defend"}}
				}
				command := candidates[rng.Intn(len(candidates))]
				if err := ApplyCommand(room, playerID, command, now); err != nil {
					return RunSimulationReport{}, fmt.Errorf("seed %d player %s combat action: %w", seed, playerID, err)
				}
			}
		case PhaseExploring:
			current := room.Run.Rooms[room.Run.CurrentRoomID]
			if current == nil {
				return RunSimulationReport{}, fmt.Errorf("seed %d reached missing room %q", seed, room.Run.CurrentRoomID)
			}
			if current.Event != nil && !current.Event.Resolved {
				eligible := eligibleCombatPlayers(room)
				if len(eligible) == 0 {
					break
				}
				choice := current.Event.Choices[rng.Intn(len(current.Event.Choices))]
				if err := ApplyCommand(room, eligible[rng.Intn(len(eligible))], Command{Type: "choose_event", ChoiceID: choice.ID}, now); err != nil {
					return RunSimulationReport{}, fmt.Errorf("seed %d room event %s: %w", seed, current.Event.ID, err)
				}
				break
			}
			if len(current.Exits) == 0 {
				// Boss rooms complete the run through combat resolution. A cleared
				// non-boss room without exits is a malformed generated floor.
				return RunSimulationReport{}, fmt.Errorf("seed %d cleared non-terminal room %q has no exits", seed, current.ID)
			}
			exit := current.Exits[rng.Intn(len(current.Exits))]
			// A shared party choice avoids nondeterministic tie-breaking in the
			// live co-op vote resolver while still randomizing the route.
			eligible := eligibleCombatPlayers(room)
			for _, playerID := range eligible {
				if err := ApplyCommand(room, playerID, Command{Type: "choose_exit", ExitID: exit.ID}, now); err != nil {
					return RunSimulationReport{}, fmt.Errorf("seed %d choose exit %s: %w", seed, exit.ID, err)
				}
			}
		case PhaseIntermission:
			eligible := eligibleCombatPlayers(room)
			if len(eligible) == 0 {
				room.Run.Phase = PhaseFailed
				continue
			}
			choice := "restore"
			if rng.Intn(2) == 1 {
				choice = "perk"
			}
			for _, playerID := range eligible {
				if room.Run.Phase != PhaseIntermission {
					break
				}
				if err := ApplyCommand(room, playerID, Command{Type: "choose_inter_floor", ChoiceID: choice}, now); err != nil {
					return RunSimulationReport{}, fmt.Errorf("seed %d inter-floor choice: %w", seed, err)
				}
			}
		default:
			return RunSimulationReport{}, fmt.Errorf("seed %d reached unsupported run phase %q", seed, room.Run.Phase)
		}
		if room.Run.CurrentRoomID != "" {
			visited[room.Run.CurrentRoomID] = true
		}
	}

	report := RunSimulationReport{
		Seed: seed, PartyClasses: append([]string(nil), classIDs...), PartySize: len(classIDs),
		Completed: room.Run.Phase == PhaseCompleted, Wiped: room.Run.Phase == PhaseFailed,
		ReachedDepth: room.Run.Depth, RoomsVisited: len(visited), CombatRounds: room.Run.CombatRoundNumber,
		Levels: make(map[string]int), Steps: steps,
	}
	switch {
	case report.Completed:
		report.Outcome = "completed"
	case report.Wiped:
		report.Outcome = "wiped"
	default:
		report.Outcome = "step_limit"
	}
	for _, player := range room.Run.Players {
		report.RemainingHealth += player.Health
		report.RemainingMaxHealth += player.MaxHealth
		report.Levels[player.ID] = player.Level
		if player.Health <= 0 {
			report.PlayersDownAtEnd++
		}
	}
	if report.RemainingMaxHealth > 0 {
		report.RemainingHealthPct = report.RemainingHealth * 100 / report.RemainingMaxHealth
	}
	for _, dungeonRoom := range room.Run.Rooms {
		if dungeonRoom.Encounter != nil && dungeonRoom.Encounter.Status == EncounterCleared {
			report.EncountersCleared++
		}
	}
	return report, nil
}

func randomCombatCommands(room *Room, playerID string, round int) []Command {
	run := room.Run
	player := run.Players[playerID]
	current := run.Rooms[run.CurrentRoomID]
	if player == nil || current == nil || current.Encounter == nil {
		return nil
	}
	commands := []Command{
		{Type: "combat", Round: round, Action: "defend"},
	}
	for _, enemy := range current.Encounter.Enemies {
		if enemy.Health <= 0 {
			continue
		}
		commands = append(commands, Command{Type: "combat", Round: round, Action: "attack", TargetID: enemy.ID})
		if enemy.Intent != nil && enemy.Intent.Interruptible {
			commands = append(commands, Command{Type: "combat", Round: round, Action: "interrupt", TargetID: enemy.ID})
		}
	}
	if player.ClassBuild == nil {
		return commands
	}
	ability, ok := findClassAbility(player.ClassBuild.SignatureAbilityID)
	if !ok {
		return commands
	}
	handler := classAbilityHandlers[ability.EffectID]
	modes := append([]string(nil), handler.modes...)
	if len(modes) == 0 {
		modes = []string{""}
	}
	for _, mode := range modes {
		switch handler.target {
		case "none":
			candidate := Command{Type: "combat", Round: round, Action: "ability", Mode: mode}
			if validateClassAbilityCommand(player, current.Encounter, candidate, run.Players) == nil {
				commands = append(commands, candidate)
			}
		case "enemy":
			for _, enemy := range current.Encounter.Enemies {
				candidate := Command{Type: "combat", Round: round, Action: "ability", Mode: mode, TargetID: enemy.ID}
				if validateClassAbilityCommand(player, current.Encounter, candidate, run.Players) == nil {
					commands = append(commands, candidate)
				}
			}
		case "player_optional":
			candidate := Command{Type: "combat", Round: round, Action: "ability", Mode: mode}
			if validateClassAbilityCommand(player, current.Encounter, candidate, run.Players) == nil {
				commands = append(commands, candidate)
			}
			for _, targetID := range room.PlayerIDs {
				candidate := Command{Type: "combat", Round: round, Action: "ability", Mode: mode, TargetID: targetID}
				if validateClassAbilityCommand(player, current.Encounter, candidate, run.Players) == nil {
					commands = append(commands, candidate)
				}
			}
		case "mode_target":
			if mode == "defend" {
				candidate := Command{Type: "combat", Round: round, Action: "ability", Mode: mode}
				if validateClassAbilityCommand(player, current.Encounter, candidate, run.Players) == nil {
					commands = append(commands, candidate)
				}
				for _, targetID := range room.PlayerIDs {
					candidate := Command{Type: "combat", Round: round, Action: "ability", Mode: mode, TargetID: targetID}
					if validateClassAbilityCommand(player, current.Encounter, candidate, run.Players) == nil {
						commands = append(commands, candidate)
					}
				}
			} else {
				for _, enemy := range current.Encounter.Enemies {
					candidate := Command{Type: "combat", Round: round, Action: "ability", Mode: mode, TargetID: enemy.ID}
					if validateClassAbilityCommand(player, current.Encounter, candidate, run.Players) == nil {
						commands = append(commands, candidate)
					}
				}
			}
		}
	}
	return commands
}

// SimulateRunBatch repeats the same party composition across consecutive seeds.
func SimulateRunBatch(seedCount int, firstSeed int64, classIDs []string, maxSteps int) (RunSimulationBatchReport, error) {
	if seedCount <= 0 {
		return RunSimulationBatchReport{}, fmt.Errorf("seed count must be positive")
	}
	report := RunSimulationBatchReport{
		Policy: RandomRunPolicyDescription, SeedCount: seedCount, FirstSeed: firstSeed,
		LastSeed: firstSeed + int64(seedCount) - 1, PartyClasses: append([]string(nil), classIDs...),
		DepthReachRates: make(map[int]float64),
		Runs: make([]RunSimulationReport, 0, seedCount),
	}
	depths := make([]int, 0, seedCount)
	rooms := make([]int, 0, seedCount)
	rounds := make([]int, 0, seedCount)
	for i := 0; i < seedCount; i++ {
		run, err := SimulateRun(firstSeed+int64(i), classIDs, maxSteps)
		if err != nil {
			return RunSimulationBatchReport{}, err
		}
		report.Runs = append(report.Runs, run)
		depths = append(depths, run.ReachedDepth)
		rooms = append(rooms, run.RoomsVisited)
		rounds = append(rounds, run.CombatRounds)
		if run.Completed {
			report.Completed++
		}
		if run.Wiped {
			report.Wiped++
		}
		if run.Outcome == "step_limit" {
			report.Stalled++
		}
	}
	report.CompletionRate = float64(report.Completed) / float64(seedCount)
	report.WipeRate = float64(report.Wiped) / float64(seedCount)
	for depth := 1; depth <= MaximumDungeonDepth; depth++ {
		reached := 0
		for _, run := range report.Runs {
			if run.ReachedDepth >= depth {
				reached++
			}
		}
		report.DepthReachRates[depth] = float64(reached) / float64(seedCount)
	}
	sort.Ints(depths)
	sort.Ints(rooms)
	sort.Ints(rounds)
	report.MedianDepth = median(depths)
	report.P90Depth = percentileNearestRank(depths, 90)
	report.MedianRooms = median(rooms)
	report.MedianRounds = median(rounds)
	return report, nil
}

func percentileNearestRank(values []int, percentile int) int {
	if len(values) == 0 {
		return 0
	}
	index := (percentile*len(values)+99)/100 - 1
	if index < 0 {
		index = 0
	}
	if index >= len(values) {
		index = len(values) - 1
	}
	return values[index]
}
