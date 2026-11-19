package game

import (
	"fmt"
	"math/rand"
)

// Floor modifiers are level-wide rules that hold for one floor of an expedition. The deeper the party goes, the
// more debuffs a floor carries, and sometimes a floor also carries a perk. The party sees the next floor's
// modifiers at camp, before it shops.

type FloorModifierKind string

const (
	FloorModifierDebuff FloorModifierKind = "debuff"
	FloorModifierPerk   FloorModifierKind = "perk"
)

// FloorModifierDefinition is an authored modifier. Every numeric field is a signed adjustment; zero means the
// modifier does not touch that rule.
type FloorModifierDefinition struct {
	ID          string
	Name        string
	Description string
	Kind        FloorModifierKind
	// Opposes names a modifier that cancels this one out; the two are never rolled onto the same floor.
	Opposes string
	// Rollable modifiers can be rolled onto a floor. The others are only applied by room events.
	Rollable bool

	EnemyDamage    int // added to the damage of every enemy move that deals damage
	EnemyHealthPct int // percent change to enemy health, applied when the floor is generated
	PlayerStrike   int // added to Strike damage
	PlayerGuard    int // added to the damage Defend blocks
	GoldPct        int // percent change to gold from encounters
	ConsumableHealingPct int // percent change to consumable healing only
	HealingPct     int // percent change to healing adventurers receive
	EncounterHeal  int // health every living adventurer recovers when an encounter is cleared
	EntryDamage    int // damage every living adventurer takes when a fight starts; never lethal
}

// ActiveFloorModifier is a modifier in force on a floor, with the text clients show for it.
type ActiveFloorModifier struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Description string            `json:"description"`
	Kind        FloorModifierKind `json:"kind"`
}

type FloorModifierCatalog struct {
	Definitions []FloorModifierDefinition
	byID        map[string]FloorModifierDefinition
}

var defaultFloorModifierCatalog = newFloorModifierCatalog()

func newFloorModifierCatalog() FloorModifierCatalog {
	definitions := []FloorModifierDefinition{
		{ID: "bloodlust", Name: "Bloodlust", Kind: FloorModifierDebuff, Rollable: true, EnemyDamage: 1, Description: "Enemies on this floor deal 1 more damage with every hit."},
		{ID: "ironhide", Name: "Ironhide", Kind: FloorModifierDebuff, Rollable: true, Opposes: "frail-foes", EnemyHealthPct: 20, Description: "Enemies on this floor have 20% more health."},
		{ID: "dull-edges", Name: "Dull Edges", Kind: FloorModifierDebuff, Rollable: true, Opposes: "battle-hymn", PlayerStrike: -1, Description: "Strikes deal 1 less damage on this floor."},
		{ID: "brittle-guard", Name: "Brittle Guard", Kind: FloorModifierDebuff, Rollable: true, Opposes: "aegis", PlayerGuard: -1, Description: "Defend blocks 1 less damage on this floor."},
		{ID: "withering", Name: "Withering Air", Kind: FloorModifierDebuff, Rollable: true, Opposes: "mending", HealingPct: -50, Description: "All healing is halved on this floor."},
		{ID: "blighted-herbs", Name: "Blighted Herbs", Kind: FloorModifierDebuff, Rollable: true, ConsumableHealingPct: -50, Description: "Healing herbs restore 50% less health on this floor."},
		{ID: "lean-pickings", Name: "Lean Pickings", Kind: FloorModifierDebuff, Rollable: true, Opposes: "fortune", GoldPct: -30, Description: "Encounters on this floor pay 30% less gold."},
		{ID: "hazard", Name: "Hazardous Ground", Kind: FloorModifierDebuff, Rollable: true, EntryDamage: 2, Description: "Every fight on this floor opens with 2 damage to each adventurer."},
		{ID: "fortune", Name: "Fortune's Favour", Kind: FloorModifierPerk, Rollable: true, Opposes: "lean-pickings", GoldPct: 50, Description: "Encounters on this floor pay 50% more gold."},
		{ID: "battle-hymn", Name: "Battle Hymn", Kind: FloorModifierPerk, Rollable: true, Opposes: "dull-edges", PlayerStrike: 1, Description: "Strikes deal 1 more damage on this floor."},
		{ID: "aegis", Name: "Aegis", Kind: FloorModifierPerk, Rollable: true, Opposes: "brittle-guard", PlayerGuard: 1, Description: "Defend blocks 1 more damage on this floor."},
		{ID: "mending", Name: "Mending Air", Kind: FloorModifierPerk, Rollable: true, Opposes: "withering", HealingPct: 25, Description: "All healing restores 25% more health on this floor."},
		{ID: "frail-foes", Name: "Frail Foes", Kind: FloorModifierPerk, Rollable: true, Opposes: "ironhide", EnemyHealthPct: -15, Description: "Enemies on this floor have 15% less health."},
		// Applied only by room events, as the price of a choice.
		{ID: "alerted", Name: "Alerted", Kind: FloorModifierDebuff, EnemyDamage: 1, Description: "The floor knows you are here. Enemies deal 1 more damage until you descend."},
		{ID: "cursed", Name: "Cursed", Kind: FloorModifierDebuff, EntryDamage: 2, Description: "A curse follows the party. Every fight on this floor opens with 2 damage to each adventurer."},
	}
	catalog := FloorModifierCatalog{Definitions: definitions, byID: make(map[string]FloorModifierDefinition, len(definitions))}
	for _, definition := range definitions {
		catalog.byID[definition.ID] = definition
	}
	return catalog
}

func (catalog FloorModifierCatalog) Modifier(id string) (FloorModifierDefinition, bool) {
	definition, ok := catalog.byID[id]
	return definition, ok
}

func (catalog FloorModifierCatalog) Validate() error {
	seen := make(map[string]bool, len(catalog.Definitions))
	for _, definition := range catalog.Definitions {
		if definition.ID == "" || seen[definition.ID] || definition.Name == "" || definition.Description == "" {
			return fmt.Errorf("invalid or duplicate floor modifier %q", definition.ID)
		}
		seen[definition.ID] = true
		if definition.Kind != FloorModifierDebuff && definition.Kind != FloorModifierPerk {
			return fmt.Errorf("floor modifier %q has unknown kind %q", definition.ID, definition.Kind)
		}
		if definition == (FloorModifierDefinition{ID: definition.ID, Name: definition.Name, Description: definition.Description, Kind: definition.Kind, Opposes: definition.Opposes, Rollable: definition.Rollable}) {
			return fmt.Errorf("floor modifier %q changes nothing", definition.ID)
		}
		if definition.EnemyHealthPct <= -100 || definition.GoldPct <= -100 || definition.HealingPct <= -100 || definition.ConsumableHealingPct <= -100 || definition.EntryDamage < 0 || definition.EncounterHeal < 0 {
			return fmt.Errorf("floor modifier %q has an out-of-range adjustment", definition.ID)
		}
	}
	for _, definition := range catalog.Definitions {
		if definition.Opposes == "" {
			continue
		}
		other, ok := catalog.byID[definition.Opposes]
		if !ok || other.Opposes != definition.ID || other.Kind == definition.Kind {
			return fmt.Errorf("floor modifier %q must oppose a modifier of the other kind that opposes it back", definition.ID)
		}
	}
	return nil
}

func (definition FloorModifierDefinition) active() ActiveFloorModifier {
	return ActiveFloorModifier{ID: definition.ID, Name: definition.Name, Description: definition.Description, Kind: definition.Kind}
}

// floorDebuffCount is how many debuffs a floor carries. The first floor is clean; pressure grows every second floor.
func floorDebuffCount(depth int) int {
	if depth < 2 {
		return 0
	}
	count := depth / 2
	if count > 3 {
		count = 3
	}
	return count
}

// FloorPerkChance is the percent chance that a floor below the first also carries a perk.
const FloorPerkChance = 40

// rollFloorModifiers chooses a floor's modifiers. The seed and depth fully determine the result.
func rollFloorModifiers(seed uint64, depth int) []ActiveFloorModifier {
	debuffs := floorDebuffCount(depth)
	if depth < 2 {
		return nil
	}
	rng := rand.New(rand.NewSource(int64(mixSeed(seed, uint64(depth), 0xf100d))))
	var debuffPool, perkPool []FloorModifierDefinition
	for _, definition := range defaultFloorModifierCatalog.Definitions {
		if !definition.Rollable {
			continue
		}
		if definition.Kind == FloorModifierDebuff {
			debuffPool = append(debuffPool, definition)
		} else {
			perkPool = append(perkPool, definition)
		}
	}
	rng.Shuffle(len(debuffPool), func(i, j int) { debuffPool[i], debuffPool[j] = debuffPool[j], debuffPool[i] })
	chosen := make([]ActiveFloorModifier, 0, debuffs+1)
	blocked := make(map[string]bool)
	for _, definition := range debuffPool[:debuffs] {
		chosen = append(chosen, definition.active())
		blocked[definition.Opposes] = true
	}
	if rng.Intn(100) < FloorPerkChance {
		rng.Shuffle(len(perkPool), func(i, j int) { perkPool[i], perkPool[j] = perkPool[j], perkPool[i] })
		for _, definition := range perkPool {
			if !blocked[definition.ID] {
				chosen = append(chosen, definition.active())
				break
			}
		}
	}
	return chosen
}

// floorRules is the sum of the modifiers in force on the run's current floor.
type floorRules struct {
	EnemyDamage    int
	EnemyHealthPct int
	PlayerStrike   int
	PlayerGuard    int
	GoldPct        int
	HealingPct     int
	ConsumableHealingPct int
	EncounterHeal  int
	EntryDamage    int
}

func sumFloorModifiers(modifiers []ActiveFloorModifier) floorRules {
	var rules floorRules
	for _, active := range modifiers {
		definition, ok := defaultFloorModifierCatalog.Modifier(active.ID)
		if !ok {
			continue
		}
		rules.EnemyDamage += definition.EnemyDamage
		rules.EnemyHealthPct += definition.EnemyHealthPct
		rules.PlayerStrike += definition.PlayerStrike
		rules.PlayerGuard += definition.PlayerGuard
		rules.GoldPct += definition.GoldPct
		rules.HealingPct += definition.HealingPct
		rules.ConsumableHealingPct += definition.ConsumableHealingPct
		rules.EncounterHeal += definition.EncounterHeal
		rules.EntryDamage += definition.EntryDamage
	}
	return rules
}

func floorRulesFor(run *Run) floorRules {
	if run == nil || len(run.FloorModifiers) == 0 {
		return floorRules{}
	}
	return sumFloorModifiers(run.FloorModifiers)
}

// healing scales an amount of healing by the floor's healing modifier. Positive healing never rounds to zero.
func (rules floorRules) healing(amount int) int {
	if amount <= 0 || rules.HealingPct == 0 {
		return amount
	}
	scaled := amount * (100 + rules.HealingPct) / 100
	if scaled < 1 {
		scaled = 1
	}
	return scaled
}

// consumableHealing applies the herb-specific modifier and then the general healing modifier.
func (rules floorRules) consumableHealing(amount int) int {
	if amount <= 0 { return amount }
	if rules.ConsumableHealingPct != 0 {
		amount = amount * (100 + rules.ConsumableHealingPct) / 100
		if amount < 1 { amount = 1 }
	}
	return rules.healing(amount)
}

// addFloorModifier puts a modifier in force on the current floor. It reports false if it was already active.
func addFloorModifier(run *Run, id string) bool {
	definition, ok := defaultFloorModifierCatalog.Modifier(id)
	if !ok {
		return false
	}
	for _, active := range run.FloorModifiers {
		if active.ID == id {
			return false
		}
	}
	run.FloorModifiers = append(run.FloorModifiers, definition.active())
	return true
}

// mixSeed derives an independent stream seed from a run seed and two salts (splitmix64 finalizer).
func mixSeed(seed, a, b uint64) uint64 {
	z := seed + a*0x9e3779b97f4a7c15 + b*0xbf58476d1ce4e5b9 + 0x94d049bb133111eb
	z = (z ^ (z >> 30)) * 0xbf58476d1ce4e5b9
	z = (z ^ (z >> 27)) * 0x94d049bb133111eb
	return z ^ (z >> 31)
}
