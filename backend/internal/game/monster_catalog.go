package game

import "fmt"

// MonsterRole describes the tactical job a monster performs in an encounter.
// Roles are descriptive content metadata, not mandatory party composition rules.
type MonsterRole string

const (
	MonsterRoleStriker   MonsterRole = "striker"
	MonsterRoleProtector MonsterRole = "protector"
	MonsterRoleDisruptor MonsterRole = "disruptor"
	MonsterRoleSupport   MonsterRole = "support"
	MonsterRoleBruiser   MonsterRole = "bruiser"
	MonsterRoleBoss      MonsterRole = "boss"
)

// AbilityDefinition describes an enemy intent selected by a monster.
// Turn cadence is one-indexed: a zero remainder means turns divisible by
// EveryTurns; a non-zero remainder matches that exact modulo.
type AbilityDefinition struct {
	ID             string
	Label          string
	Kind           string
	Damage         int
	Heal           int
	TargetAll      bool
	Interruptible  bool
	EveryTurns     int
	TurnRemainder  int
}

type MonsterDefinition struct {
	ID          string
	Name        string
	Role        MonsterRole
	BaseHealth  int
	AbilityIDs  []string
}

type MonsterCatalog struct {
	Monsters  map[string]MonsterDefinition
	Abilities map[string]AbilityDefinition
}

var defaultMonsterCatalog = newMonsterCatalog()

func newMonsterCatalog() MonsterCatalog {
	abilities := []AbilityDefinition{
		{ID: "quick-jab", Label: "Quick jab", Kind: "quick_strike", Damage: 3},
		{ID: "stone-strike", Label: "Stone strike", Kind: "strike", Damage: 4},
		{ID: "heavy-blow", Label: "Heavy blow", Kind: "heavy_strike", Damage: 8, EveryTurns: 2, TurnRemainder: 1},
		{ID: "reliquary-crush", Label: "Reliquary crush", Kind: "crusher", Damage: 8, Interruptible: true, EveryTurns: 2},
		{ID: "miniboss-stone-strike", Label: "Stone strike", Kind: "stone_strike", Damage: 5, EveryTurns: 2, TurnRemainder: 1},
		{ID: "soul-drain", Label: "Soul drain", Kind: "soul_drain", Damage: 5, Heal: 2, Interruptible: true},
		{ID: "soul-sweep", Label: "Soul sweep", Kind: "soul_sweep", Damage: 3, TargetAll: true, EveryTurns: 3},
	}
	abilityMap := make(map[string]AbilityDefinition, len(abilities))
	for _, ability := range abilities {
		abilityMap[ability.ID] = ability
	}
	monsters := []MonsterDefinition{
		{ID: "scout", Name: "Crypt Stalker", Role: MonsterRoleStriker, BaseHealth: 11, AbilityIDs: []string{"quick-jab"}},
		{ID: "guardian", Name: "Ashbound Guardian", Role: MonsterRoleProtector, BaseHealth: 13, AbilityIDs: []string{"heavy-blow", "stone-strike"}},
		{ID: "sentinel", Name: "Threshold Warden", Role: MonsterRoleProtector, BaseHealth: 12, AbilityIDs: []string{"stone-strike"}},
		{ID: "miniboss", Name: "Reliquary Brute", Role: MonsterRoleBruiser, BaseHealth: 18, AbilityIDs: []string{"reliquary-crush", "miniboss-stone-strike"}},
		{ID: "warden", Name: "Crypt Warden", Role: MonsterRoleBoss, BaseHealth: 30, AbilityIDs: []string{"soul-drain", "soul-sweep"}},
	}
	monsterMap := make(map[string]MonsterDefinition, len(monsters))
	for _, monster := range monsters {
		monsterMap[monster.ID] = monster
	}
	return MonsterCatalog{Monsters: monsterMap, Abilities: abilityMap}
}

func (catalog MonsterCatalog) Monster(id string) (MonsterDefinition, error) {
	monster, ok := catalog.Monsters[id]
	if !ok {
		return MonsterDefinition{}, fmt.Errorf("unknown monster definition %q", id)
	}
	return monster, nil
}

func (catalog MonsterCatalog) Ability(id string) (AbilityDefinition, error) {
	ability, ok := catalog.Abilities[id]
	if !ok {
		return AbilityDefinition{}, fmt.Errorf("unknown monster ability %q", id)
	}
	return ability, nil
}

func (catalog MonsterCatalog) Validate() error {
	for id, monster := range catalog.Monsters {
		if id == "" || monster.ID != id || monster.BaseHealth <= 0 || len(monster.AbilityIDs) == 0 {
			return fmt.Errorf("invalid monster definition %q", id)
		}
		for _, abilityID := range monster.AbilityIDs {
			if _, ok := catalog.Abilities[abilityID]; !ok {
				return fmt.Errorf("monster %q references unknown ability %q", id, abilityID)
			}
		}
	}
	for id, ability := range catalog.Abilities {
		if id == "" || ability.ID != id || ability.Damage < 0 || ability.Heal < 0 || ability.EveryTurns < 0 || ability.TurnRemainder < 0 || (ability.EveryTurns > 0 && ability.TurnRemainder >= ability.EveryTurns) {
			return fmt.Errorf("invalid monster ability %q", id)
		}
	}
	return nil
}

func (catalog MonsterCatalog) SelectAbility(monsterID string, turn int) (AbilityDefinition, error) {
	monster, err := catalog.Monster(monsterID)
	if err != nil {
		return AbilityDefinition{}, err
	}
	for _, abilityID := range monster.AbilityIDs {
		ability, err := catalog.Ability(abilityID)
		if err != nil {
			return AbilityDefinition{}, err
		}
		if ability.EveryTurns == 0 || turn%ability.EveryTurns == ability.TurnRemainder {
			return ability, nil
		}
	}
	return AbilityDefinition{}, fmt.Errorf("monster %q has no ability for turn %d", monsterID, turn)
}
