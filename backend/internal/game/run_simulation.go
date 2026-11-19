package game

import (
	"fmt"
	"math/rand"
	"runtime"
	"sort"
	"sync"
	"time"
)

// RunSimulationReport describes one complete seeded expedition driven by the
// random-decision policy. The simulation executes the same domain commands as
// live play; it does not reproduce combat or reward rules independently.
type RunSimulationReport struct {
	Seed               int64                          `json:"seed"`
	InitialThemeID     string                         `json:"initialThemeId"`
	ThemeID            string                         `json:"themeId"`
	Floors             int                            `json:"floors"`
	GoldEarned         int                            `json:"goldEarned"`
	ItemsBought        int                            `json:"itemsBought"`
	DungeonsCleared    int                            `json:"dungeonsCleared"`
	Rank               string                         `json:"rank"`
	PartyClasses       []string                       `json:"partyClasses"`
	PartySize          int                            `json:"partySize"`
	Outcome            string                         `json:"outcome"`
	Completed          bool                           `json:"completed"`
	Wiped              bool                           `json:"wiped"`
	ReachedDepth       int                            `json:"reachedDepth"`
	RoomsVisited       int                            `json:"roomsVisited"`
	EncountersCleared  int                            `json:"encountersCleared"`
	CombatRounds       int                            `json:"combatRounds"`
	CombatMetrics      map[string]PlayerCombatMetrics `json:"combatMetrics"`
	StrikeDamageAtEnd  map[string]int                 `json:"strikeDamageAtEnd"`
	NetPartyHealthLoss int                            `json:"netPartyHealthLoss"`
	EndEnemyHealth     int                            `json:"endEnemyHealth,omitempty"`
	EndEnemyMaxHealth  int                            `json:"endEnemyMaxHealth,omitempty"`
	EndEnemiesAlive    int                            `json:"endEnemiesAlive,omitempty"`
	PlayersDownAtEnd   int                            `json:"playersDownAtEnd"`
	RemainingHealth    int                            `json:"remainingHealth"`
	RemainingMaxHealth int                            `json:"remainingMaxHealth"`
	RemainingHealthPct int                            `json:"remainingHealthPct"`
	Levels             map[string]int                 `json:"levels"`
	Steps              int                            `json:"steps"`
	// EndRoomType and EndDepth say where the run ended: the room type (encounter, miniboss, boss) a wipe happened in.
	EndRoomType    string                     `json:"endRoomType,omitempty"`
	EndRoomName    string                     `json:"endRoomName,omitempty"`
	EndEncounterID string                     `json:"endEncounterId,omitempty"`
	EndEnemies     []RunSimulationEnemyReport `json:"endEnemies,omitempty"`
	EndDepth       int                        `json:"endDepth,omitempty"`
	// EndDungeon and EndThemeID name the dungeon of the expedition the party fell in.
	EndDungeon int    `json:"endDungeon,omitempty"`
	EndThemeID string `json:"endThemeId,omitempty"`
}

// RunSimulationEnemyReport identifies an enemy present when an expedition ended, including its remaining health.
type RunSimulationEnemyReport struct {
	DefinitionID string `json:"definitionId"`
	Name         string `json:"name"`
	Health       int    `json:"health"`
	MaxHealth    int    `json:"maxHealth"`
	Modifier     string `json:"modifier,omitempty"`
	Enraged      bool   `json:"enraged,omitempty"`
	Anchored     bool   `json:"anchored,omitempty"`
	Reborn       bool   `json:"reborn,omitempty"`
	IntentLabel  string `json:"intentLabel,omitempty"`
	IntentDamage int    `json:"intentDamage,omitempty"`
}

// PlayerCombatMetrics records combat contribution for one simulated adventurer.
type PlayerCombatMetrics struct {
	DamageDealt int `json:"damageDealt"`
	Attacks     int `json:"attacks"`
	Abilities   int `json:"abilities"`
	Interrupts  int `json:"interrupts"`
	Defends     int `json:"defends"`
}

// RunSimulationBatchReport summarizes a reproducible collection of full runs.
type RunSimulationBatchReport struct {
	Policy          string                `json:"policy"`
	ThemeID         string                `json:"themeId"`
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

const RandomRunPolicyDescription = "uniform random choice among currently legal combat actions, targets, room exits, room-event choices, camp mini-game moves, capstone boons and affordable shop purchases; this is a deliberately unskilled baseline, not human play"

const TacticalRunPolicyDescription = "tactical combat (the shared skill policy: interrupt dangerous telegraphs while interrupts are off cooldown, revive and heal the wounded, protect against killing blows, otherwise the most valuable ready skill on the weakest enemy) with starting loadouts, and invests in affordable permanent Strike upgrades up to the run cap, then buys healing or revival when needed; routes, room events and mini-games stay random. A stand-in for attentive play, not optimal play"

// RunPolicy names how a full-run simulation makes decisions.
type RunPolicy string

const (
	// RunPolicyRandom picks uniformly among legal moves: the floor of how badly a run can be played.
	RunPolicyRandom RunPolicy = "random"
	// RunPolicyTactical plays combat the way an attentive player reads intents. It is what balance targets use.
	RunPolicyTactical RunPolicy = "tactical"
)

// Description is the policy's report text.
func (policy RunPolicy) Description() string {
	if policy == RunPolicyTactical {
		return TacticalRunPolicyDescription
	}
	return RandomRunPolicyDescription
}

// SimulateRun runs one seeded expedition through Forgotten Catacombs with the supplied class composition.
func SimulateRun(seed int64, classIDs []string, maxSteps int) (RunSimulationReport, error) {
	return SimulateRunInTheme(seed, DefaultDungeonThemeID, classIDs, maxSteps)
}

// SimulateRunInTheme runs one seeded expedition in a dungeon theme (or RandomDungeonThemeID) under the random
// policy. A fresh aggregate is created for every run and every game transition goes through the same commands as
// live play.
func SimulateRunInTheme(seed int64, themeID string, classIDs []string, maxSteps int) (RunSimulationReport, error) {
	return SimulateRunWithPolicy(seed, themeID, classIDs, maxSteps, RunPolicyRandom)
}

// SimulateRunWithPolicy runs one seeded expedition under a decision policy.
func SimulateRunWithPolicy(seed int64, themeID string, classIDs []string, maxSteps int, policy RunPolicy) (RunSimulationReport, error) {
	if policy != RunPolicyRandom && policy != RunPolicyTactical {
		return RunSimulationReport{}, fmt.Errorf("unknown run simulation policy %q", policy)
	}
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
		PlayerIDs:     make([]string, len(classIDs)),
		PlayerClasses: make(map[string]string, len(classIDs)),
		Presence:      make(map[string]PlayerPresence, len(classIDs)),
	}
	for i, classID := range classIDs {
		playerID := fmt.Sprintf("hero-%d", i+1)
		room.PlayerIDs[i] = playerID
		room.PlayerClasses[playerID] = classID
	}
	// The supplied seed is the canonical generation seed. The run ID remains
	// stable and unique within this in-memory aggregate.
	if err := startExpeditionWithSeed(room, runID, themeID, uint64(seed), now); err != nil {
		return RunSimulationReport{}, fmt.Errorf("start simulated run: %w", err)
	}

	initialThemeID := room.Run.ThemeID
	visited := map[string]bool{room.Run.CurrentRoomID: true}
	steps, itemsBought, goldSpent := 0, 0, 0
	combatMetrics := make(map[string]PlayerCombatMetrics, len(classIDs))
	netPartyHealthLoss := 0
	for room.Run.Phase != PhaseCompleted && room.Run.Phase != PhaseFailed && steps < maxSteps {
		steps++
		switch room.Run.Phase {
		case PhaseCombat:
			roundPartyHealth := totalPartyHealth(room)
			if room.Run.CombatRound == nil {
				startCombatRound(room, now)
			}
			round := room.Run.CombatRound.Number
			for _, playerID := range room.PlayerIDs {
				player := room.Run.Players[playerID]
				if player == nil || player.Health <= 0 {
					continue
				}
				if _, submitted := room.Run.CombatRound.Actions[playerID]; submitted {
					continue
				}
				var command Command
				if policy == RunPolicyTactical {
					if consumable, use := tacticalConsumableCommand(room, playerID); use {
						command = consumable
					} else {
						command = skillPolicyCommand(room, playerID, round, rng)
					}
				} else {
					candidates := randomSkillCommands(room, playerID, round)
					if len(candidates) == 0 {
						candidates = []Command{{Type: "combat", Round: round, Action: "defend"}}
					}
					command = candidates[rng.Intn(len(candidates))]
				}
				beforeEnemyHealth := currentEncounterHealth(room)
				if err := ApplyCommand(room, playerID, command, now); err != nil {
					return RunSimulationReport{}, fmt.Errorf("seed %d player %s combat action: %w", seed, playerID, err)
				}
				if command.Type != "use_consumable" {
					metrics := combatMetrics[playerID]
					damage := beforeEnemyHealth - currentEncounterHealth(room)
					if damage > 0 {
						metrics.DamageDealt += damage
					}
					definition, _ := findSkill(command.Skill)
					switch {
					case command.Action == "defend" || command.Skill == SkillDefend:
						metrics.Defends++
					case definition.Basic:
						metrics.Attacks++
					case SkillInterrupts(definition):
						metrics.Interrupts++
					default:
						metrics.Abilities++
					}
					combatMetrics[playerID] = metrics
				}
				if room.Run.CombatRound == nil || room.Run.CombatRound.Number != round {
					break
				}
			}
			if loss := roundPartyHealth - totalPartyHealth(room); loss > 0 {
				netPartyHealthLoss += loss
			}
		case PhaseExploring:
			if policy == RunPolicyTactical {
				// Use carried herbs between encounters, where they do not replace an attack or expose the
				// party to an enemy turn. This keeps the tactical policy from wasting combat tempo on small heals.
				for _, playerID := range eligibleCombatPlayers(room) {
					if command, ok := tacticalExplorationConsumableCommand(room, playerID); ok {
						if err := ApplyCommand(room, playerID, command, now); err != nil {
							return RunSimulationReport{}, fmt.Errorf("seed %d player %s exploration herb: %w", seed, playerID, err)
						}
					}
				}
			}
			current := room.Run.Rooms[room.Run.CurrentRoomID]
			if current == nil {
				return RunSimulationReport{}, fmt.Errorf("seed %d reached missing room %q", seed, room.Run.CurrentRoomID)
			}
			if current.Event != nil && !current.Event.Resolved {
				if len(current.Event.Choices) == 0 {
					return RunSimulationReport{}, fmt.Errorf("seed %d room event %s has no choices", seed, current.Event.ID)
				}
				eligible := eligibleCombatPlayers(room)
				if len(eligible) == 0 {
					break
				}
				choice := current.Event.Choices[rng.Intn(len(current.Event.Choices))]
				if policy == RunPolicyTactical {
					needsHerbs := false
					for _, playerID := range eligible {
						player := room.Run.Players[playerID]
						if player != nil && player.Health > 0 && player.Consumables[ConsumableHealingHerb] < MaxHealingHerbs {
							needsHerbs = true
							break
						}
					}
					if needsHerbs {
						for _, option := range current.Event.Choices {
							if option.ID == "herb_cache" {
								choice = option
								break
							}
						}
					}
				}
				// Give every eligible adventurer the same simulated preference so the
				// event vote resolves without injecting random tie-break noise.
				for _, playerID := range eligible {
					if err := ApplyCommand(room, playerID, Command{Type: "choose_event", ChoiceID: choice.ID}, now); err != nil {
						return RunSimulationReport{}, fmt.Errorf("seed %d room event %s: %w", seed, current.Event.ID, err)
					}
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
			if room.Run.NavigationVote == nil && len(eligible) > 1 {
				eligible = eligible[:1]
			}
			for _, playerID := range eligible {
				if err := ApplyCommand(room, playerID, Command{Type: "choose_exit", ExitID: exit.ID}, now); err != nil {
					return RunSimulationReport{}, fmt.Errorf("seed %d choose exit %s: %w", seed, exit.ID, err)
				}
			}
		case PhaseIntermission:
			eligible := eligibleCombatPlayers(room)
			if len(eligible) == 0 || room.Run.Camp == nil {
				room.Run.Phase = PhaseFailed
				continue
			}
			for _, playerID := range eligible {
				if room.Run.Phase != PhaseIntermission {
					break
				}
				command, ok := Command{}, false
				if policy == RunPolicyTactical {
					command, ok = tacticalShopCommand(room, playerID)
				}
				if !ok {
					command, ok = randomCampCommand(room, playerID, rng)
				}
				if !ok {
					continue
				}
				if err := ApplyCommand(room, playerID, command, now); err != nil {
					return RunSimulationReport{}, fmt.Errorf("seed %d camp command %+v: %w", seed, command, err)
				}
				if command.Type == "buy" {
					itemsBought++
					for _, offer := range room.Run.Camp.Offers {
						if offer.ID == command.ChoiceID {
							goldSpent += offer.Price
							break
						}
					}
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
		Seed: seed, InitialThemeID: initialThemeID, ThemeID: room.Run.ThemeID, Floors: room.Run.MaxDepth, ItemsBought: itemsBought,
		PartyClasses: append([]string(nil), classIDs...), PartySize: len(classIDs),
		// An expedition never ends in victory. "Completed" means the first dungeon's boss was beaten, and the
		// depth reached counts floors across every dungeon of the expedition.
		Completed: room.Run.DungeonsCleared > 0, Wiped: room.Run.Phase == PhaseFailed,
		DungeonsCleared: room.Run.DungeonsCleared, Rank: ExpeditionRank(room.Run.FloorsCleared),
		ReachedDepth: room.Run.FloorsCleared + 1, RoomsVisited: len(visited), CombatRounds: room.Run.CombatRoundNumber,
		Levels: make(map[string]int), Steps: steps, CombatMetrics: combatMetrics, StrikeDamageAtEnd: make(map[string]int),
		NetPartyHealthLoss: netPartyHealthLoss,
	}
	switch {
	case report.Completed:
		report.Outcome = "completed"
	case report.Wiped:
		report.Outcome = "wiped"
	default:
		report.Outcome = "step_limit"
	}
	if report.Wiped {
		// Where the party fell, for every wipe, so later dungeons (and capstone castles) can be read too.
		report.EndDungeon, report.EndThemeID = dungeonNumber(room.Run), room.Run.Theme()
		if current := room.Run.Rooms[room.Run.CurrentRoomID]; current != nil {
			report.EndRoomType, report.EndRoomName, report.EndDepth = current.RoomType, current.Name, room.Run.Depth
			if current.Encounter != nil {
				report.EndEncounterID = current.Encounter.DefinitionID
				for _, enemy := range current.Encounter.Enemies {
					entry := RunSimulationEnemyReport{DefinitionID: enemy.DefinitionID, Name: enemy.Name, Health: enemy.Health, MaxHealth: enemy.MaxHealth, Modifier: enemy.Modifier, Enraged: enemy.Enraged, Anchored: enemy.Anchored, Reborn: enemy.Reborn}
					if enemy.Intent != nil {
						entry.IntentLabel, entry.IntentDamage = enemy.Intent.Label, enemy.Intent.Damage
					}
					report.EndEnemies = append(report.EndEnemies, entry)
				}
			}
		}
	}
	for _, player := range room.Run.Players {
		report.RemainingHealth += player.Health
		report.RemainingMaxHealth += player.MaxHealth
		report.Levels[player.ID] = player.Level
		report.StrikeDamageAtEnd[player.ID] = player.StrikeDamage
		report.GoldEarned += player.Gold
		if player.Health <= 0 {
			report.PlayersDownAtEnd++
		}
	}
	report.GoldEarned += goldSpent
	if report.RemainingMaxHealth > 0 {
		report.RemainingHealthPct = report.RemainingHealth * 100 / report.RemainingMaxHealth
	}
	if current := room.Run.Rooms[room.Run.CurrentRoomID]; current != nil && current.Encounter != nil {
		report.EndEnemyMaxHealth = encounterMaxHealth(current.Encounter)
		report.EndEnemyHealth = currentEncounterHealth(room)
		for _, enemy := range current.Encounter.Enemies {
			if enemy.Health > 0 {
				report.EndEnemiesAlive++
			}
		}
	}
	for _, dungeonRoom := range room.Run.Rooms {
		if dungeonRoom.Encounter != nil && dungeonRoom.Encounter.Status == EncounterCleared {
			report.EncountersCleared++
		}
	}
	return report, nil
}

// totalPartyHealth returns the party's combined current health.
func totalPartyHealth(room *Room) int {
	total := 0
	for _, player := range room.Run.Players {
		if player != nil && player.Health > 0 {
			total += player.Health
		}
	}
	return total
}

// currentEncounterHealth returns the combined remaining health of enemies in the current room.
func currentEncounterHealth(room *Room) int {
	if room == nil || room.Run == nil {
		return 0
	}
	current := room.Run.Rooms[room.Run.CurrentRoomID]
	if current == nil || current.Encounter == nil {
		return 0
	}
	total := 0
	for _, enemy := range current.Encounter.Enemies {
		if enemy.Health > 0 {
			total += enemy.Health
		}
	}
	return total
}

// encounterMaxHealth returns the combined maximum health of an encounter's enemies.
func encounterMaxHealth(encounter *Encounter) int {
	if encounter == nil {
		return 0
	}
	total := 0
	for _, enemy := range encounter.Enemies {
		total += enemy.MaxHealth
	}
	return total
}

// randomCampCommand chooses one legal camp move for a player: a mini-game move while the game is on, and at the
// shop either a purchase they can afford or readying up.
func randomCampCommand(room *Room, playerID string, rng *rand.Rand) (Command, bool) {
	camp := room.Run.Camp
	if camp.Stage == CampStageGame {
		play := camp.Game.Players[playerID]
		if play == nil || play.Done {
			return Command{}, false
		}
		switch camp.Game.Kind {
		case MinigameDice:
			if len(play.Rolls) == 0 || rng.Intn(2) == 0 {
				return Command{Type: "minigame", Action: "roll"}, true
			}
		case MinigameChests:
			var shut []int
			for index, chest := range play.Chests {
				if chest < 0 {
					shut = append(shut, index)
				}
			}
			if len(shut) == ChestCount || rng.Intn(2) == 0 {
				return Command{Type: "minigame", Action: "open", ChoiceID: fmt.Sprint(shut[rng.Intn(len(shut))])}, true
			}
		}
		return Command{Type: "minigame", Action: "bank"}, true
	}
	if camp.Stage == CampStageBoon {
		offers := camp.BoonOffers[playerID]
		if camp.BoonChoices[playerID] != "" || len(offers) == 0 {
			return Command{}, false
		}
		return Command{Type: "choose_boon", ChoiceID: offers[rng.Intn(len(offers))].ID}, true
	}
	if camp.Stage == CampStageCrossroads {
		if camp.Votes[playerID] != "" {
			return Command{}, false
		}
		return Command{Type: "choose_dungeon", ChoiceID: camp.Choices[rng.Intn(len(camp.Choices))].ThemeID}, true
	}
	if camp.Ready[playerID] {
		return Command{}, false
	}
	player := room.Run.Players[playerID]
	var affordable []ShopItem
	for _, offer := range camp.Offers {
		useless := (offer.Kind == ShopHeal || offer.Kind == ShopFullHeal) && player.Health >= player.MaxHealth ||
			offer.Kind == ShopConsumable && player.Consumables[offer.ConsumableID] >= MaxHealingHerbs ||
			offer.Kind == ShopWard && player.ClassCombat.Ward >= offer.Amount ||
			offer.Kind == ShopStrike && player.StrikeDamage >= PlayerStrikeDamage+MaxPermanentStrikeBonus ||
			offer.Kind == ShopRevive && fallenAlly(room, playerID) == "" ||
			offer.Kind == ShopCleanse && firstDebuff(camp.NextModifiers) < 0
		if offer.Price <= player.Gold && !useless && (offer.Repeatable || !contains(camp.Purchases[playerID], offer.ID)) {
			affordable = append(affordable, offer)
		}
	}
	if choice := rng.Intn(len(affordable) + 1); choice < len(affordable) {
		return Command{Type: "buy", ChoiceID: affordable[choice].ID}, true
	}
	return Command{Type: "ready"}, true
}

// SimulationDepthLimit is the deepest total floor (across dungeons) a batch report gives a reach rate for.
const SimulationDepthLimit = 2 * MaximumExpeditionDepth

// SimulateRunBatch repeats the same party composition across consecutive seeds in Forgotten Catacombs.
func SimulateRunBatch(seedCount int, firstSeed int64, classIDs []string, maxSteps int) (RunSimulationBatchReport, error) {
	return SimulateRunBatchInTheme(seedCount, firstSeed, DefaultDungeonThemeID, classIDs, maxSteps)
}

// SimulateRunBatchInTheme repeats the same party composition across consecutive seeds in one dungeon theme, or
// in a seeded mix of themes for RandomDungeonThemeID.
func SimulateRunBatchInTheme(seedCount int, firstSeed int64, themeID string, classIDs []string, maxSteps int) (RunSimulationBatchReport, error) {
	return SimulateRunBatchWithPolicy(seedCount, firstSeed, themeID, classIDs, maxSteps, RunPolicyRandom)
}

// SimulateRunBatchWithPolicy repeats the same party composition across consecutive seeds under a decision policy.
func SimulateRunBatchWithPolicy(seedCount int, firstSeed int64, themeID string, classIDs []string, maxSteps int, policy RunPolicy) (RunSimulationBatchReport, error) {
	if seedCount <= 0 {
		return RunSimulationBatchReport{}, fmt.Errorf("seed count must be positive")
	}
	report := RunSimulationBatchReport{
		Policy: policy.Description(), ThemeID: themeID, SeedCount: seedCount, FirstSeed: firstSeed,
		LastSeed: firstSeed + int64(seedCount) - 1, PartyClasses: append([]string(nil), classIDs...),
		DepthReachRates: make(map[int]float64),
		Runs:            make([]RunSimulationReport, 0, seedCount),
	}
	// Each seeded expedition is independent. Run a bounded number concurrently while
	// storing results by seed index so output and aggregate reports remain deterministic.
	workers := runtime.GOMAXPROCS(0)
	if workers > seedCount {
		workers = seedCount
	}
	jobs := make(chan int)
	runs := make([]RunSimulationReport, seedCount)
	errs := make([]error, seedCount)
	var wait sync.WaitGroup
	wait.Add(workers)
	for worker := 0; worker < workers; worker++ {
		go func() {
			defer wait.Done()
			for i := range jobs {
				run, err := SimulateRunWithPolicy(firstSeed+int64(i), themeID, classIDs, maxSteps, policy)
				if err != nil {
					errs[i] = err
					continue
				}
				runs[i] = run
			}
		}()
	}
	for i := 0; i < seedCount; i++ {
		jobs <- i
	}
	close(jobs)
	wait.Wait()

	depths := make([]int, 0, seedCount)
	rooms := make([]int, 0, seedCount)
	rounds := make([]int, 0, seedCount)
	for i, run := range runs {
		if errs[i] != nil {
			return RunSimulationBatchReport{}, fmt.Errorf("seed %d: %w", firstSeed+int64(i), errs[i])
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
	for depth := 1; depth <= SimulationDepthLimit; depth++ {
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
