package game

import (
	"fmt"
	"math/rand"
	"sort"
	"time"
)

// CombatSimulationSnapshot is an explicit, persistence-free combat fixture.
// Callers provide already-built players and catalog-backed runtime enemies;
// the simulator copies both slices before resolving anything.
type CombatSimulationSnapshot struct {
	Players          []PlayerState `json:"players"`
	Enemies          []Enemy       `json:"enemies"`
	ExperienceReward int           `json:"experienceReward,omitempty"`
}

// CombatSimulationReport is a machine-readable summary for one reproducible run.
type CombatSimulationReport struct {
	Seed                  int64                            `json:"seed"`
	Won                   bool                             `json:"won"`
	Wiped                 bool                             `json:"wiped"`
	Rounds                int                              `json:"rounds"`
	PlayerDamageDealt     int                              `json:"playerDamageDealt"`
	PlayerDamageReceived  int                              `json:"playerDamageReceived"`
	PlayerHealing         int                              `json:"playerHealing"`
	MonsterHealing        int                              `json:"monsterHealing"`
	PlayersDowned         int                              `json:"playersDowned"`
	AbilityUses           map[string]int                   `json:"abilityUses"`
	RemainingPlayerHealth map[string]int                   `json:"remainingPlayerHealth"`
	RemainingEnemyHealth  map[string]int                   `json:"remainingEnemyHealth"`
	PlayerProgression     map[string]ProgressionTransition `json:"playerProgression,omitempty"`
}

const simulationRoomID = "simulation"

// SimulateCombat plays one encounter through the live round engine with the shared skill policy
// (skillPolicyCommand). It has no clock, database or network: a round resolves as soon as every adventurer has
// chosen. The seed controls policy tie-breaking.
func SimulateCombat(snapshot CombatSimulationSnapshot, seed int64, maxRounds int) (CombatSimulationReport, error) {
	if maxRounds <= 0 {
		maxRounds = 100
	}
	players := make(map[string]*PlayerState, len(snapshot.Players))
	playerIDs := make([]string, 0, len(snapshot.Players))
	starting := make(map[string]PlayerState, len(snapshot.Players))
	for _, value := range snapshot.Players {
		if value.ID == "" {
			return CombatSimulationReport{}, fmt.Errorf("simulation player ID cannot be empty")
		}
		if _, exists := players[value.ID]; exists {
			return CombatSimulationReport{}, fmt.Errorf("duplicate simulation player %q", value.ID)
		}
		player := value
		if player.MaxHealth <= 0 || player.Health < 0 || player.Health > player.MaxHealth {
			return CombatSimulationReport{}, fmt.Errorf("player %q has invalid health", player.ID)
		}
		player.Skills = append([]string(nil), value.Skills...)
		ensureSkills(&player)
		players[player.ID] = &player
		playerIDs = append(playerIDs, player.ID)
		starting[player.ID] = player
	}
	if len(players) == 0 {
		return CombatSimulationReport{}, fmt.Errorf("simulation requires at least one player")
	}
	sort.Strings(playerIDs)

	enemies := make([]Enemy, len(snapshot.Enemies))
	copy(enemies, snapshot.Enemies)
	seenEnemies := make(map[string]bool, len(enemies))
	for i := range enemies {
		if enemies[i].ID == "" || seenEnemies[enemies[i].ID] {
			return CombatSimulationReport{}, fmt.Errorf("simulation enemy IDs must be non-empty and unique")
		}
		seenEnemies[enemies[i].ID] = true
		if enemies[i].MaxHealth <= 0 || enemies[i].Health < 0 || enemies[i].Health > enemies[i].MaxHealth {
			return CombatSimulationReport{}, fmt.Errorf("enemy %q has invalid health", enemies[i].ID)
		}
		if enemies[i].Behavior == "" && enemies[i].DefinitionID != "" {
			definition, err := defaultMonsterCatalog.Monster(enemies[i].DefinitionID)
			if err != nil {
				return CombatSimulationReport{}, err
			}
			enemies[i].Behavior = definition.BehaviorID
		}
		if enemies[i].Behavior == "" {
			return CombatSimulationReport{}, fmt.Errorf("enemy %q has no catalog behavior", enemies[i].ID)
		}
		if _, err := defaultMonsterCatalog.Monster(enemies[i].Behavior); err != nil {
			return CombatSimulationReport{}, fmt.Errorf("enemy %q: %w", enemies[i].ID, err)
		}
	}
	if len(enemies) == 0 {
		return CombatSimulationReport{}, fmt.Errorf("simulation requires at least one enemy")
	}

	report := CombatSimulationReport{
		Seed:                  seed,
		AbilityUses:           make(map[string]int),
		RemainingPlayerHealth: make(map[string]int, len(players)),
		RemainingEnemyHealth:  make(map[string]int, len(enemies)),
		PlayerProgression:     make(map[string]ProgressionTransition),
	}
	rng := rand.New(rand.NewSource(seed))
	now := time.Unix(0, 0).UTC()
	encounter := &Encounter{Status: EncounterActive, Enemies: enemies}
	room := &Room{
		ID: simulationRoomID, PlayerIDs: playerIDs, Presence: map[string]PlayerPresence{},
		Run: &Run{
			ID: simulationRoomID, Phase: PhaseCombat, CurrentRoomID: simulationRoomID, Players: players, Flags: map[string]bool{},
			Rooms: map[string]*DungeonRoom{simulationRoomID: {ID: simulationRoomID, RoomType: "combat", Encounter: encounter}},
		},
	}
	run := room.Run
	startCombatRound(room, now)
	for run.Phase == PhaseCombat && run.CombatRound != nil && report.Rounds < maxRounds {
		round := run.CombatRound.Number
		for _, enemy := range encounter.Enemies {
			if enemy.Health > 0 && enemy.Intent != nil {
				report.AbilityUses[enemy.Intent.Kind]++
			}
		}
		for _, playerID := range playerIDs {
			if players[playerID].Health <= 0 || run.CombatRound == nil || run.CombatRound.Number != round {
				continue
			}
			command := skillPolicyCommand(room, playerID, round, rng)
			if err := SubmitCombatAction(room, playerID, command, now); err != nil {
				return CombatSimulationReport{}, fmt.Errorf("simulate %q for player %q: %w", command.Skill, playerID, err)
			}
			if command.Skill != "" {
				report.AbilityUses[command.Skill]++
			}
		}
		report.Rounds++
		for _, event := range run.LastCombatEvents {
			if event.Round != round {
				continue
			}
			switch {
			case event.Effect == "damage" && event.TargetType == "enemy":
				report.PlayerDamageDealt += event.Amount
			case event.Effect == "damage" && event.TargetType == "player":
				report.PlayerDamageReceived += event.Amount
			case event.Effect == "heal" && event.TargetType == "player":
				report.PlayerHealing += event.Amount
			case event.Effect == "heal" && event.TargetType == "enemy":
				report.MonsterHealing += event.Amount
			}
			if event.Kind == "player_down" {
				report.PlayersDowned++
			}
		}
	}

	report.Won = encounter.Status == EncounterCleared
	report.Wiped = run.Phase == PhaseFailed
	if report.Won && snapshot.ExperienceReward > 0 {
		for id, player := range starting {
			report.PlayerProgression[id] = resolveExperienceGain(player, snapshot.ExperienceReward)
		}
	}
	for id, player := range players {
		report.RemainingPlayerHealth[id] = player.Health
	}
	for _, enemy := range encounter.Enemies {
		report.RemainingEnemyHealth[enemy.ID] = enemy.Health
	}
	if len(report.PlayerProgression) == 0 {
		report.PlayerProgression = nil
	}
	return report, nil
}

// SimulateCombatBatch runs independent seeds in caller-provided order.
func SimulateCombatBatch(snapshot CombatSimulationSnapshot, seeds []int64, maxRounds int) ([]CombatSimulationReport, error) {
	reports := make([]CombatSimulationReport, 0, len(seeds))
	for _, seed := range seeds {
		report, err := SimulateCombat(snapshot, seed, maxRounds)
		if err != nil {
			return nil, err
		}
		reports = append(reports, report)
	}
	return reports, nil
}

// CombatSimulationBatchReport summarizes the outcome distribution for a batch.
type CombatSimulationBatchReport struct {
	Runs                 int     `json:"runs"`
	Wins                 int     `json:"wins"`
	Wipes                int     `json:"wipes"`
	WinRate              float64 `json:"winRate"`
	MedianRounds         int     `json:"medianRounds"`
	P90Rounds            int     `json:"p90Rounds"`
	MedianDamageDealt    int     `json:"medianDamageDealt"`
	MedianDamageReceived int     `json:"medianDamageReceived"`
}

// SummarizeCombatBatch reports robust distribution statistics without changing
// the caller's report order or contents. Percentiles use nearest-rank semantics.
func SummarizeCombatBatch(reports []CombatSimulationReport) CombatSimulationBatchReport {
	summary := CombatSimulationBatchReport{Runs: len(reports)}
	if len(reports) == 0 {
		return summary
	}
	rounds := make([]int, len(reports))
	dealt := make([]int, len(reports))
	received := make([]int, len(reports))
	for i, report := range reports {
		if report.Won {
			summary.Wins++
		}
		if report.Wiped {
			summary.Wipes++
		}
		rounds[i] = report.Rounds
		dealt[i] = report.PlayerDamageDealt
		received[i] = report.PlayerDamageReceived
	}
	summary.WinRate = float64(summary.Wins) / float64(summary.Runs)
	sort.Ints(rounds)
	sort.Ints(dealt)
	sort.Ints(received)
	summary.MedianRounds = median(rounds)
	summary.P90Rounds = nearestRank(rounds, 0.90)
	summary.MedianDamageDealt = median(dealt)
	summary.MedianDamageReceived = median(received)
	return summary
}

func nearestRank(sortedValues []int, percentile float64) int {
	if len(sortedValues) == 0 {
		return 0
	}
	index := int(float64(len(sortedValues))*percentile+0.999999) - 1
	if index < 0 {
		index = 0
	}
	if index >= len(sortedValues) {
		index = len(sortedValues) - 1
	}
	return sortedValues[index]
}

func median(sortedValues []int) int {
	if len(sortedValues) == 0 {
		return 0
	}
	middle := len(sortedValues) / 2
	if len(sortedValues)%2 == 1 {
		return sortedValues[middle]
	}
	return (sortedValues[middle-1] + sortedValues[middle]) / 2
}
