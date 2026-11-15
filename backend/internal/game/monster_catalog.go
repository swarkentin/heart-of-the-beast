package game

import (
	"fmt"

	"github.com/swarkentin/heart-of-the-beast/backend/internal/art"
)

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
	ID               string
	Label            string
	Kind             string
	Damage           int
	Heal             int
	TargetAll        bool
	Interruptible    bool
	EveryTurns       int
	TurnRemainder    int
	ExceptEveryTurns int
}

// MonsterDefinition is an immutable authored monster. Every definition has pixel art: Sprite is set by
// defineMonster, which takes the art as a required argument, and art.SpriteID values cannot be forged outside
// package art, so a monster without art, or with art the pipeline never built, does not compile.
type MonsterDefinition struct {
	ID   string
	Name string
	Role MonsterRole
	// Sprite is the monster's sprite sheet. Set it through defineMonster, never directly.
	Sprite art.SpriteID
	// BehaviorID names the monster definition whose abilities this monster uses. Legacy monsters share one
	// of the original behavior definitions; themed monsters name themselves.
	BehaviorID     string
	BaseHealth     int
	HealthPerDepth int
	AbilityIDs     []string
}

// defineMonster attaches required art to a monster definition. Leaving the art out of a monster entry is a
// compile error, because the sprite is a mandatory parameter of the only supported way to declare one.
func defineMonster(sprite art.SpriteID, definition MonsterDefinition) MonsterDefinition {
	definition.Sprite = sprite
	return definition
}

// MonsterScaling holds the explicit inputs used to derive an enemy's health.
type MonsterScaling struct {
	Depth            int
	PartySize        int
	HealthMultiplier float64
	RoundDown        bool
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
		{ID: "soul-drain", Label: "Soul drain", Kind: "soul_drain", Damage: 5, Heal: 2, Interruptible: true, ExceptEveryTurns: 3},
		{ID: "soul-sweep", Label: "Soul sweep", Kind: "soul_sweep", Damage: 3, TargetAll: true, EveryTurns: 3},
	}
	abilityMap := make(map[string]AbilityDefinition, len(abilities))
	for _, ability := range abilities {
		abilityMap[ability.ID] = ability
	}
	monsters := []MonsterDefinition{
		defineMonster(art.CatacombsDrownedScout, MonsterDefinition{ID: "scout", Name: "Crypt Stalker", Role: MonsterRoleStriker, BehaviorID: "scout", BaseHealth: 11, AbilityIDs: []string{"quick-jab"}}),
		defineMonster(art.CatacombsBoneboundGuardian, MonsterDefinition{ID: "guardian", Name: "Ashbound Guardian", Role: MonsterRoleProtector, BehaviorID: "guardian", BaseHealth: 13, AbilityIDs: []string{"heavy-blow", "stone-strike"}}),
		defineMonster(art.CatacombsSkeletonSentinel, MonsterDefinition{ID: "sentinel", Name: "Threshold Warden", Role: MonsterRoleProtector, BehaviorID: "sentinel", BaseHealth: 12, AbilityIDs: []string{"stone-strike"}}),
		defineMonster(art.CatacombsBoneboundGuardian, MonsterDefinition{ID: "miniboss", Name: "Reliquary Brute", Role: MonsterRoleBruiser, BehaviorID: "miniboss", BaseHealth: 18, AbilityIDs: []string{"reliquary-crush", "miniboss-stone-strike"}}),
		defineMonster(art.CatacombsCryptWarden, MonsterDefinition{ID: "warden", Name: "Crypt Warden", Role: MonsterRoleBoss, BehaviorID: "warden", BaseHealth: 30, HealthPerDepth: 4, AbilityIDs: []string{"soul-drain", "soul-sweep"}}),
		defineMonster(art.CatacombsBoneboundGuardian, MonsterDefinition{ID: "stonebound-guard", Name: "Stonebound Guard", Role: MonsterRoleProtector, BehaviorID: "guardian", BaseHealth: 14, AbilityIDs: []string{"heavy-blow", "stone-strike"}}),
		defineMonster(art.CatacombsDrownedScout, MonsterDefinition{ID: "gravebound-scout", Name: "Gravebound Scout", Role: MonsterRoleStriker, BehaviorID: "scout", BaseHealth: 10, AbilityIDs: []string{"quick-jab"}}),
		defineMonster(art.CatacombsOssuaryColossus, MonsterDefinition{ID: "ossuary-champion", Name: "Ossuary Champion", Role: MonsterRoleBoss, BehaviorID: "warden", BaseHealth: 30, HealthPerDepth: 4, AbilityIDs: []string{"soul-drain", "soul-sweep"}}),
		defineMonster(art.CatacombsBoneboundGuardian, MonsterDefinition{ID: "depth-reliquary-brute", Name: "Reliquary Brute", Role: MonsterRoleBruiser, BehaviorID: "miniboss", BaseHealth: 23, HealthPerDepth: 3, AbilityIDs: []string{"reliquary-crush", "miniboss-stone-strike"}}),
		defineMonster(art.CatacombsSkeletonSentinel, MonsterDefinition{ID: "restless-sentinel", Name: "Restless Sentinel", Role: MonsterRoleProtector, BehaviorID: "sentinel", BaseHealth: 10, AbilityIDs: []string{"stone-strike"}}),
		defineMonster(art.CatacombsBoneboundGuardian, MonsterDefinition{ID: "reliquary-guardian", Name: "Reliquary Guardian", Role: MonsterRoleProtector, BehaviorID: "guardian", BaseHealth: 20, AbilityIDs: []string{"heavy-blow", "stone-strike"}}),
		defineMonster(art.CatacombsDrownedScout, MonsterDefinition{ID: "drowned-scout", Name: "Drowned Scout", Role: MonsterRoleStriker, BehaviorID: "scout", BaseHealth: 15, AbilityIDs: []string{"quick-jab"}}),
		defineMonster(art.CatacombsDrownedScout, MonsterDefinition{ID: "drowned-scout-light", Name: "Drowned Scout", Role: MonsterRoleStriker, BehaviorID: "scout", BaseHealth: 14, AbilityIDs: []string{"quick-jab"}}),
		defineMonster(art.CatacombsDrownedScout, MonsterDefinition{ID: "drowned-scout-crossing-solo", Name: "Drowned Scout", Role: MonsterRoleStriker, BehaviorID: "scout", BaseHealth: 11, AbilityIDs: []string{"quick-jab"}}),
		defineMonster(art.CatacombsBoneboundGuardian, MonsterDefinition{ID: "bonebound-guardian", Name: "Bonebound Guardian", Role: MonsterRoleProtector, BehaviorID: "guardian", BaseHealth: 22, AbilityIDs: []string{"heavy-blow", "stone-strike"}}),
		defineMonster(art.CatacombsDrownedScout, MonsterDefinition{ID: "crypt-skirmisher", Name: "Crypt Skirmisher", Role: MonsterRoleStriker, BehaviorID: "scout", BaseHealth: 16, AbilityIDs: []string{"quick-jab"}}),
		defineMonster(art.CatacombsGraveboundSentry, MonsterDefinition{ID: "gatekeeper", Name: "Gatekeeper", Role: MonsterRoleProtector, BehaviorID: "guardian", BaseHealth: 20, AbilityIDs: []string{"heavy-blow", "stone-strike"}}),
		defineMonster(art.CatacombsGraveboundSentry, MonsterDefinition{ID: "gravebound-sentry", Name: "Gravebound Sentry", Role: MonsterRoleStriker, BehaviorID: "scout", BaseHealth: 14, AbilityIDs: []string{"quick-jab"}}),
		defineMonster(art.CatacombsCryptWarden, MonsterDefinition{ID: "crypt-warden", Name: "Crypt Warden", Role: MonsterRoleBoss, BehaviorID: "warden", BaseHealth: 42, AbilityIDs: []string{"soul-drain", "soul-sweep"}}),
		defineMonster(art.CatacombsCryptWarden, MonsterDefinition{ID: "crypt-warden-solo", Name: "Crypt Warden", Role: MonsterRoleBoss, BehaviorID: "warden", BaseHealth: 36, AbilityIDs: []string{"soul-drain", "soul-sweep"}}),
	}
	themedAbilities, themedMonsters := themedMonsterContent()
	for _, ability := range themedAbilities {
		if _, duplicate := abilityMap[ability.ID]; duplicate {
			panic(fmt.Sprintf("duplicate built-in monster ability %q", ability.ID))
		}
		abilityMap[ability.ID] = ability
	}
	monsters = append(monsters, themedMonsters...)
	monsterMap := make(map[string]MonsterDefinition, len(monsters))
	for _, monster := range monsters {
		if _, duplicate := monsterMap[monster.ID]; duplicate {
			panic(fmt.Sprintf("duplicate built-in monster %q", monster.ID))
		}
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
		if id == "" || monster.ID != id || monster.BaseHealth <= 0 || monster.HealthPerDepth < 0 || monster.BehaviorID == "" || len(monster.AbilityIDs) == 0 {
			return fmt.Errorf("invalid monster definition %q", id)
		}
		sprite, ok := art.Lookup(monster.Sprite)
		if !ok {
			return fmt.Errorf("monster %q has no pixel art", id)
		}
		if monster.Role == MonsterRoleBoss && !sprite.Boss {
			return fmt.Errorf("boss monster %q uses non-boss sprite %s", id, monster.Sprite)
		}
		if _, ok := catalog.Monsters[monster.BehaviorID]; !ok {
			return fmt.Errorf("monster %q uses undefined behavior %q", id, monster.BehaviorID)
		}
		for _, abilityID := range monster.AbilityIDs {
			if _, ok := catalog.Abilities[abilityID]; !ok {
				return fmt.Errorf("monster %q references unknown ability %q", id, abilityID)
			}
		}
	}
	for id, ability := range catalog.Abilities {
		if id == "" || ability.ID != id || ability.Damage < 0 || ability.Heal < 0 || ability.EveryTurns < 0 || ability.TurnRemainder < 0 || ability.ExceptEveryTurns < 0 || (ability.EveryTurns > 0 && ability.TurnRemainder >= ability.EveryTurns) {
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
		if (ability.EveryTurns == 0 || turn%ability.EveryTurns == ability.TurnRemainder) && (ability.ExceptEveryTurns == 0 || turn%ability.ExceptEveryTurns != 0) {
			return ability, nil
		}
	}
	return AbilityDefinition{}, fmt.Errorf("monster %q has no ability for turn %d", monsterID, turn)
}

// NewEnemy creates a mutable runtime instance from an immutable catalog entry.
func (catalog MonsterCatalog) NewEnemy(instanceID, monsterID string, scaling MonsterScaling) (Enemy, error) {
	monster, err := catalog.Monster(monsterID)
	if err != nil {
		return Enemy{}, err
	}
	health := monster.BaseHealth + monster.HealthPerDepth*scaling.Depth
	multiplier := scaling.HealthMultiplier
	if multiplier <= 0 {
		multiplier = 1
		if scaling.Depth > 0 {
			multiplier += float64(scaling.Depth-1) * 0.18
			if scaling.PartySize > 1 {
				multiplier += float64(scaling.PartySize-1) * 0.12
			} else if scaling.PartySize == 1 {
				multiplier -= 0.12
			}
		}
	}
	scaledHealth := float64(health) * multiplier
	if scaling.RoundDown {
		health = int(scaledHealth)
	} else {
		health = int(scaledHealth + 0.5)
	}
	if health < 1 {
		health = 1
	}
	return Enemy{
		ID: instanceID, DefinitionID: monster.ID, Name: monster.Name,
		Behavior: monster.BehaviorID, SpriteID: monster.Sprite.String(), Health: health, MaxHealth: health,
	}, nil
}

func newCatalogEnemy(instanceID, monsterID string, scaling MonsterScaling) Enemy {
	enemy, err := defaultMonsterCatalog.NewEnemy(instanceID, monsterID, scaling)
	if err != nil {
		panic(fmt.Sprintf("invalid built-in monster %q: %v", monsterID, err))
	}
	return enemy
}
