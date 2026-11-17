package game

import "fmt"

// EncounterMonsterDefinition describes one stable spawn slot in an encounter.
// SoloMonsterID is an explicit content variant for a one-player party.
// MinPartySize makes the slot a reinforcement: it only spawns when the party has at least that many adventurers.
// Zero or one means the slot always spawns.
type EncounterMonsterDefinition struct {
	ID            string
	MonsterID     string
	SoloMonsterID string
	BudgetCost    int
	MinPartySize  int
}

const (
	// MaxEncounterEnemies is the most enemies one fight can hold, reinforcements and boss summons included. It is
	// what the combat scene can lay out with every nameplate and intent still legible.
	MaxEncounterEnemies = 6
	// MaxEncounterPartySize is the largest party encounters are authored for.
	MaxEncounterPartySize = 4
)

// spawnsFor reports whether a slot is part of the encounter for a party of the given size.
func (spawn EncounterMonsterDefinition) spawnsFor(partySize int) bool {
	return spawn.MinPartySize <= 1 || partySize >= spawn.MinPartySize
}

// isReinforcement reports whether a slot only joins larger parties.
func (spawn EncounterMonsterDefinition) isReinforcement() bool {
	return spawn.MinPartySize > 1
}

// EncounterDefinition is an authored composition. Budget is a provisional, relative authoring score of the slots
// every party meets (reinforcements excluded); it sets the encounter's gold, not its combat stats.
//
// Larger parties meet more enemies rather than much tougher ones: reinforcement slots (MinPartySize > 1) join as
// the party grows, so each adventurer faces about the same pressure and the party has more targets to choose.
type EncounterDefinition struct {
	ID string
	// ThemeID is the dungeon theme (see DungeonThemeCatalog) whose monsters this encounter is built from.
	ThemeID string
	Budget  int
	Enemies []EncounterMonsterDefinition
}

type EncounterCatalog struct {
	Encounters map[string]EncounterDefinition
}

var defaultEncounterCatalog = newEncounterCatalog()

func newEncounterCatalog() EncounterCatalog {
	definitions := []EncounterDefinition{
		{ID: "catacombs-entry", ThemeID: "catacombs", Budget: 1, Enemies: []EncounterMonsterDefinition{
			{ID: "sentinel", MonsterID: "restless-sentinel", BudgetCost: 1},
		}},
		{ID: "catacombs-reliquary", ThemeID: "catacombs", Budget: 5, Enemies: []EncounterMonsterDefinition{
			{ID: "guardian", MonsterID: "reliquary-guardian", BudgetCost: 3},
			{ID: "scout", MonsterID: "drowned-scout", BudgetCost: 2},
		}},
		{ID: "catacombs-flooded-crossing", ThemeID: "catacombs", Budget: 2, Enemies: []EncounterMonsterDefinition{
			{ID: "scout", MonsterID: "drowned-scout-light", SoloMonsterID: "drowned-scout-crossing-solo", BudgetCost: 2},
		}},
		{ID: "catacombs-bone-gallery", ThemeID: "catacombs", Budget: 5, Enemies: []EncounterMonsterDefinition{
			{ID: "gallery-guardian", MonsterID: "bonebound-guardian", BudgetCost: 3},
			{ID: "gallery-scout", MonsterID: "crypt-skirmisher", BudgetCost: 2},
		}},
		{ID: "catacombs-warden-gate", ThemeID: "catacombs", Budget: 5, Enemies: []EncounterMonsterDefinition{
			{ID: "gate-guardian", MonsterID: "gatekeeper", BudgetCost: 3},
			{ID: "gate-scout", MonsterID: "gravebound-sentry", BudgetCost: 2},
		}},
		{ID: "catacombs-warden-boss", ThemeID: "catacombs", Budget: 8, Enemies: []EncounterMonsterDefinition{
			{ID: "warden", MonsterID: "crypt-warden", SoloMonsterID: "crypt-warden-solo", BudgetCost: 8},
		}},
		{ID: "depth-entry", ThemeID: "catacombs", Budget: 1, Enemies: []EncounterMonsterDefinition{
			{ID: "threshold-guard", MonsterID: "sentinel", BudgetCost: 1},
		}},
		{ID: "depth-left-guardian", ThemeID: "catacombs", Budget: 3, Enemies: []EncounterMonsterDefinition{
			{ID: "left-guardian", MonsterID: "guardian", BudgetCost: 3},
		}},
		{ID: "depth-left-scout", ThemeID: "catacombs", Budget: 2, Enemies: []EncounterMonsterDefinition{
			{ID: "left-enemy", MonsterID: "scout", BudgetCost: 2},
		}},
		{ID: "depth-right-scout", ThemeID: "catacombs", Budget: 2, Enemies: []EncounterMonsterDefinition{
			{ID: "right-scout", MonsterID: "scout", BudgetCost: 2},
		}},
		{ID: "depth-right-guardian", ThemeID: "catacombs", Budget: 3, Enemies: []EncounterMonsterDefinition{
			{ID: "right-enemy", MonsterID: "guardian", BudgetCost: 3},
		}},
		{ID: "depth-guard", ThemeID: "catacombs", Budget: 5, Enemies: []EncounterMonsterDefinition{
			{ID: "guard-a", MonsterID: "stonebound-guard", BudgetCost: 3},
			{ID: "guard-b", MonsterID: "gravebound-scout", BudgetCost: 2},
		}},
		{ID: "depth-boss-warden", ThemeID: "catacombs", Budget: 8, Enemies: []EncounterMonsterDefinition{
			{ID: "boss-enemy", MonsterID: "warden", BudgetCost: 8},
		}},
		{ID: "depth-boss-ossuary", ThemeID: "catacombs", Budget: 8, Enemies: []EncounterMonsterDefinition{
			{ID: "boss-enemy", MonsterID: "ossuary-champion", BudgetCost: 8},
		}},
		{ID: "depth-miniboss", ThemeID: "catacombs", Budget: 6, Enemies: []EncounterMonsterDefinition{
			{ID: "miniboss-enemy", MonsterID: "depth-reliquary-brute", BudgetCost: 6},
		}},
	}
	definitions = append(definitions, themedEncounters()...)
	definitions = append(definitions, varietyEncounters()...)
	definitions = append(definitions, newThemeEncounters()...)
	encounters := make(map[string]EncounterDefinition, len(definitions))
	for _, definition := range definitions {
		definition = withPartyReinforcements(definition)
		if _, duplicate := encounters[definition.ID]; duplicate {
			panic(fmt.Sprintf("duplicate built-in encounter %q", definition.ID))
		}
		encounters[definition.ID] = definition
	}
	return EncounterCatalog{Encounters: encounters}
}

func (catalog EncounterCatalog) Encounter(id string) (EncounterDefinition, error) {
	definition, ok := catalog.Encounters[id]
	if !ok {
		return EncounterDefinition{}, fmt.Errorf("unknown encounter definition %q", id)
	}
	return definition, nil
}

func (catalog EncounterCatalog) Validate(monsters MonsterCatalog) error {
	for id, definition := range catalog.Encounters {
		if id == "" || definition.ID != id || definition.ThemeID == "" || definition.Budget <= 0 || len(definition.Enemies) == 0 {
			return fmt.Errorf("invalid encounter definition %q", id)
		}
		if len(definition.Enemies) > MaxEncounterEnemies {
			return fmt.Errorf("encounter %q can spawn %d enemies; a fight holds at most %d", id, len(definition.Enemies), MaxEncounterEnemies)
		}
		totalBudget, baseSlots := 0, 0
		seenSlots := make(map[string]bool, len(definition.Enemies))
		for _, spawn := range definition.Enemies {
			if spawn.ID == "" || seenSlots[spawn.ID] || spawn.BudgetCost <= 0 || spawn.MinPartySize < 0 || spawn.MinPartySize > MaxEncounterPartySize {
				return fmt.Errorf("encounter %q has invalid spawn slot %q", id, spawn.ID)
			}
			seenSlots[spawn.ID] = true
			if _, err := monsters.Monster(spawn.MonsterID); err != nil {
				return fmt.Errorf("encounter %q: %w", id, err)
			}
			if spawn.SoloMonsterID != "" {
				if _, err := monsters.Monster(spawn.SoloMonsterID); err != nil {
					return fmt.Errorf("encounter %q solo variant: %w", id, err)
				}
			}
			if spawn.isReinforcement() {
				continue
			}
			baseSlots++
			totalBudget += spawn.BudgetCost
		}
		if baseSlots == 0 {
			return fmt.Errorf("encounter %q has no enemy that a solo party meets", id)
		}
		if totalBudget != definition.Budget {
			return fmt.Errorf("encounter %q budget %d does not match spawn costs %d", id, definition.Budget, totalBudget)
		}
	}
	return nil
}

// Instantiate builds mutable runtime enemies from an immutable composition.
func (catalog EncounterCatalog) Instantiate(id, instancePrefix string, scaling MonsterScaling) (*Encounter, error) {
	definition, err := catalog.Encounter(id)
	if err != nil {
		return nil, err
	}
	enemies := make([]Enemy, 0, len(definition.Enemies))
	for _, spawn := range definition.Enemies {
		if !spawn.spawnsFor(scaling.PartySize) {
			continue
		}
		monsterID := spawn.MonsterID
		if scaling.PartySize == 1 && spawn.SoloMonsterID != "" {
			monsterID = spawn.SoloMonsterID
		}
		enemy, err := defaultMonsterCatalog.NewEnemy(instancePrefix+spawn.ID, monsterID, scaling)
		if err != nil {
			return nil, fmt.Errorf("encounter %q spawn %q: %w", id, spawn.ID, err)
		}
		enemy.Health = int(float64(enemy.Health)*LiveEnemyHealthMultiplier + 0.5)
		enemy.MaxHealth = enemy.Health
		enemies = append(enemies, enemy)
	}
	return &Encounter{
		DefinitionID: definition.ID,
		Budget:       definition.Budget,
		Status:       EncounterActive,
		Enemies:      enemies,
	}, nil
}

func newCatalogEncounter(id, instancePrefix string, scaling MonsterScaling) *Encounter {
	encounter, err := defaultEncounterCatalog.Instantiate(id, instancePrefix, scaling)
	if err != nil {
		panic(fmt.Sprintf("invalid built-in encounter %q: %v", id, err))
	}
	return encounter
}

// SpawnCount is how many enemies the encounter puts in front of a party of the given size.
func (definition EncounterDefinition) SpawnCount(partySize int) int {
	count := 0
	for _, spawn := range definition.Enemies {
		if spawn.spawnsFor(partySize) {
			count++
		}
	}
	return count
}
