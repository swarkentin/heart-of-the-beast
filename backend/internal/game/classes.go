package game

import (
	"errors"
	"fmt"
	"strings"
)

const ClassDefinitionVersion = 2

const (
	ClassBulwark     = "bulwark"
	ClassJuggernaut  = "juggernaut"
	ClassSpellguard  = "spellguard"
	ClassAssassin    = "assassin"
	ClassArcanist    = "arcanist"
	ClassRanger      = "ranger"
	ClassCleric      = "cleric"
	ClassTactician   = "tactician"
	ClassBeastcaller = "beastcaller"
)

var (
	ErrInvalidClass = errors.New("unknown class")
	ErrClassLocked  = errors.New("class is not unlocked for this player")
)

type EquipmentSlot string

const (
	EquipmentWeapon    EquipmentSlot = "weapon"
	EquipmentShield    EquipmentSlot = "shield"
	EquipmentArmor     EquipmentSlot = "armor"
	EquipmentAccessory EquipmentSlot = "accessory"
)

type EquipmentModifiers struct {
	Health  int `json:"health,omitempty"`
	Power   int `json:"power,omitempty"`
	Focus   int `json:"focus,omitempty"`
	Agility int `json:"agility,omitempty"`
}

type EquipmentDefinition struct {
	ID          string             `json:"id"`
	Name        string             `json:"name"`
	Slot        EquipmentSlot      `json:"slot"`
	Description string             `json:"description"`
	Modifiers   EquipmentModifiers `json:"modifiers"`
}

type ClassStatProfile struct {
	Health  int `json:"health"`
	Power   int `json:"power"`
	Focus   int `json:"focus"`
	Agility int `json:"agility"`
}

type ClassAbilityDefinition struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	EffectID    string `json:"effectId"`
}

type ClassPassiveDefinition struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	EffectID    string `json:"effectId"`
}

type ClassDefinition struct {
	ID                 string           `json:"id"`
	ArchetypeID        string           `json:"archetypeId"`
	Name               string           `json:"name"`
	Description        string           `json:"description"`
	DefinitionVersion  int              `json:"definitionVersion"`
	StartingStats      ClassStatProfile `json:"startingStats"`
	StartingEquipment  []string         `json:"startingEquipment"`
	SignatureAbilityID string           `json:"signatureAbilityId"`
	PassiveID          string           `json:"passiveId"`
}

type ClassAvailability struct {
	ClassID            string `json:"classId"`
	InitiallyAvailable bool   `json:"initiallyAvailable"`
	UnlockPolicyID     string `json:"unlockPolicyId,omitempty"`
}

type ClassBuildSnapshot struct {
	ClassID            string      `json:"classId"`
	DefinitionVersion  int         `json:"definitionVersion"`
	SignatureAbilityID string      `json:"signatureAbilityId"`
	PassiveID          string      `json:"passiveId"`
	MaxHealth          int         `json:"maxHealth"`
	Stats              PlayerStats `json:"stats"`
	EquipmentIDs       []string    `json:"equipmentIds"`
}

var classAbilities = []ClassAbilityDefinition{
	{ID: "ability.shield-wall", Name: "Shield Wall", Description: "Substantially reduce incoming damage.", EffectID: "combat.guard"},
	{ID: "ability.reckoning", Name: "Reckoning", Description: "Turn recently absorbed damage into a counterattack.", EffectID: "combat.counter"},
	{ID: "ability.runic-ward", Name: "Runic Ward", Description: "Absorb an incoming attack and reflect part of its damage.", EffectID: "combat.ward"},
	{ID: "ability.exploit-weakness", Name: "Exploit Weakness", Description: "Deal bonus damage to a marked or preparing enemy.", EffectID: "combat.precision"},
	{ID: "ability.elemental-surge", Name: "Elemental Surge", Description: "Choose fire damage or frost control.", EffectID: "combat.elemental"},
	{ID: "ability.pinning-shot", Name: "Pinning Shot", Description: "Damage an enemy and weaken or delay its next action.", EffectID: "combat.disrupt"},
	{ID: "ability.renewal", Name: "Renewal", Description: "Restore health and remove a minor negative effect.", EffectID: "combat.heal"},
	{ID: "ability.commanding-strike", Name: "Commanding Strike", Description: "Weaken an enemy and empower the next attack against it.", EffectID: "combat.command"},
	{ID: "ability.companion-command", Name: "Companion Command", Description: "Direct a companion to attack, defend, or disrupt.", EffectID: "combat.companion"},
}

var classPassives = []ClassPassiveDefinition{
	{ID: "passive.resolve", Name: "Resolve", Description: "Blocking a heavy attack empowers the next strike.", EffectID: "passive.resolve"},
	{ID: "passive.bloodied-strength", Name: "Bloodied Strength", Description: "Gain offensive strength while below half health.", EffectID: "passive.low-health"},
	{ID: "passive.arcane-resistance", Name: "Arcane Resistance", Description: "Improved resistance to magical attacks.", EffectID: "passive.magic-resist"},
	{ID: "passive.executioner", Name: "Executioner", Description: "Deal bonus damage to wounded enemies.", EffectID: "passive.wounded-target"},
	{ID: "passive.arcane-focus", Name: "Arcane Focus", Description: "Consecutive elemental attacks build Arcane Power.", EffectID: "passive.elemental-chain"},
	{ID: "passive.first-strike", Name: "First Strike", Description: "Deal bonus damage to enemies that have not acted.", EffectID: "passive.unacted-target"},
	{ID: "passive.recovery", Name: "Recovery", Description: "Improved recovery after encounters.", EffectID: "passive.encounter-recovery"},
	{ID: "passive.interrupt-training", Name: "Tactical Interruption", Description: "Improved interrupt effectiveness.", EffectID: "passive.interrupt"},
	{ID: "passive.companion-instinct", Name: "Companion Instinct", Description: "A companion contributes a small automatic benefit each round.", EffectID: "passive.companion"},
}

var equipmentCatalog = []EquipmentDefinition{
	{ID: "weapon.tower-shield", Name: "Tower Shield", Slot: EquipmentShield, Description: "A broad shield built to hold the line."},
	{ID: "weapon.mace", Name: "One-handed Mace", Slot: EquipmentWeapon, Description: "A dependable defensive weapon."},
	{ID: "armor.heavy", Name: "Heavy Armor", Slot: EquipmentArmor, Description: "Layered armor for absorbing punishment."},
	{ID: "weapon.warhammer", Name: "Two-handed Hammer", Slot: EquipmentWeapon, Description: "A massive weapon for forceful retaliation."},
	{ID: "armor.reinforced", Name: "Reinforced Armor", Slot: EquipmentArmor, Description: "Reinforced protection for a bruiser."},
	{ID: "armor.heavy-boots", Name: "Heavy Boots", Slot: EquipmentAccessory, Description: "Sturdy boots that anchor a heavy stance."},
	{ID: "weapon.rune-blade", Name: "Rune Blade", Slot: EquipmentWeapon, Description: "A blade etched with protective runes."},
	{ID: "accessory.warding-charm", Name: "Warding Charm", Slot: EquipmentAccessory, Description: "A charm that steadies defensive magic."},
	{ID: "armor.medium", Name: "Medium Armor", Slot: EquipmentArmor, Description: "Balanced protection and mobility."},
	{ID: "weapon.twin-daggers", Name: "Twin Daggers", Slot: EquipmentWeapon, Description: "Light blades made for precise strikes."},
	{ID: "accessory.throwing-knives", Name: "Throwing Knives", Slot: EquipmentAccessory, Description: "A set of balanced ranged blades."},
	{ID: "armor.leather", Name: "Leather Armor", Slot: EquipmentArmor, Description: "Flexible armor that favors movement."},
	{ID: "weapon.arcane-staff", Name: "Arcane Staff", Slot: EquipmentWeapon, Description: "A focus for elemental magic."},
	{ID: "accessory.spellbook", Name: "Spellbook", Slot: EquipmentAccessory, Description: "Notes on elemental forms and control."},
	{ID: "armor.cloth-robes", Name: "Cloth Robes", Slot: EquipmentArmor, Description: "Light robes suited to spellcasting."},
	{ID: "weapon.longbow", Name: "Longbow", Slot: EquipmentWeapon, Description: "A precise ranged weapon."},
	{ID: "weapon.hunting-knife", Name: "Hunting Knife", Slot: EquipmentWeapon, Description: "A practical field knife."},
	{ID: "armor.reinforced-leather", Name: "Reinforced Leather", Slot: EquipmentArmor, Description: "Leather armor with added protection."},
	{ID: "weapon.holy-staff", Name: "Holy Staff", Slot: EquipmentWeapon, Description: "A staff used to channel restorative magic."},
	{ID: "accessory.healing-talisman", Name: "Healing Talisman", Slot: EquipmentAccessory, Description: "A focus for restorative rites."},
	{ID: "armor.light", Name: "Light Armor", Slot: EquipmentArmor, Description: "Lightweight protection."},
	{ID: "weapon.rapier", Name: "Rapier", Slot: EquipmentWeapon, Description: "A quick blade for tactical openings."},
	{ID: "accessory.war-horn", Name: "War Horn", Slot: EquipmentAccessory, Description: "A signal that rallies allies."},
	{ID: "weapon.nature-staff", Name: "Nature Staff", Slot: EquipmentWeapon, Description: "A staff attuned to the wild."},
	{ID: "accessory.beast-charm", Name: "Beast Charm", Slot: EquipmentAccessory, Description: "A token that binds a companion pact."},
}

var classCatalog = []ClassDefinition{
	{ID: ClassBulwark, ArchetypeID: "tank", Name: "Bulwark", Description: "A defensive shield specialist who protects allies and holds the line.", DefinitionVersion: ClassDefinitionVersion, StartingStats: ClassStatProfile{Health: 36, Power: 2, Focus: 1, Agility: 1}, StartingEquipment: []string{"weapon.tower-shield", "weapon.mace", "armor.heavy"}, SignatureAbilityID: "ability.shield-wall", PassiveID: "passive.resolve"},
	{ID: ClassJuggernaut, ArchetypeID: "tank", Name: "Juggernaut", Description: "An aggressive bruiser who turns punishment into retaliation.", DefinitionVersion: ClassDefinitionVersion, StartingStats: ClassStatProfile{Health: 38, Power: 4, Focus: 0, Agility: 1}, StartingEquipment: []string{"weapon.warhammer", "armor.reinforced", "armor.heavy-boots"}, SignatureAbilityID: "ability.reckoning", PassiveID: "passive.bloodied-strength"},
	{ID: ClassSpellguard, ArchetypeID: "tank", Name: "Spellguard", Description: "An arcane defender who relies on wards and resistance.", DefinitionVersion: ClassDefinitionVersion, StartingStats: ClassStatProfile{Health: 34, Power: 3, Focus: 3, Agility: 2}, StartingEquipment: []string{"weapon.rune-blade", "accessory.warding-charm", "armor.medium"}, SignatureAbilityID: "ability.runic-ward", PassiveID: "passive.arcane-resistance"},
	{ID: ClassAssassin, ArchetypeID: "damage", Name: "Assassin", Description: "A precision fighter who exploits openings and wounded targets.", DefinitionVersion: ClassDefinitionVersion, StartingStats: ClassStatProfile{Health: 28, Power: 3, Focus: 1, Agility: 4}, StartingEquipment: []string{"weapon.twin-daggers", "accessory.throwing-knives", "armor.leather"}, SignatureAbilityID: "ability.exploit-weakness", PassiveID: "passive.executioner"},
	{ID: ClassArcanist, ArchetypeID: "damage", Name: "Arcanist", Description: "An elemental specialist who combines damage and control.", DefinitionVersion: ClassDefinitionVersion, StartingStats: ClassStatProfile{Health: 27, Power: 1, Focus: 4, Agility: 2}, StartingEquipment: []string{"weapon.arcane-staff", "accessory.spellbook", "armor.cloth-robes"}, SignatureAbilityID: "ability.elemental-surge", PassiveID: "passive.arcane-focus"},
	{ID: ClassRanger, ArchetypeID: "damage", Name: "Ranger", Description: "A tactical ranged fighter who disrupts dangerous targets.", DefinitionVersion: ClassDefinitionVersion, StartingStats: ClassStatProfile{Health: 30, Power: 3, Focus: 1, Agility: 3}, StartingEquipment: []string{"weapon.longbow", "weapon.hunting-knife", "armor.reinforced-leather"}, SignatureAbilityID: "ability.pinning-shot", PassiveID: "passive.first-strike"},
	{ID: ClassCleric, ArchetypeID: "support", Name: "Cleric", Description: "A restorative protector who keeps adventurers on their feet.", DefinitionVersion: ClassDefinitionVersion, StartingStats: ClassStatProfile{Health: 32, Power: 1, Focus: 4, Agility: 1}, StartingEquipment: []string{"weapon.holy-staff", "accessory.healing-talisman", "armor.light"}, SignatureAbilityID: "ability.renewal", PassiveID: "passive.recovery"},
	{ID: ClassTactician, ArchetypeID: "support", Name: "Tactician", Description: "A battlefield planner who disrupts enemies and amplifies allies.", DefinitionVersion: ClassDefinitionVersion, StartingStats: ClassStatProfile{Health: 31, Power: 2, Focus: 2, Agility: 3}, StartingEquipment: []string{"weapon.rapier", "accessory.war-horn", "armor.medium"}, SignatureAbilityID: "ability.commanding-strike", PassiveID: "passive.interrupt-training"},
	{ID: ClassBeastcaller, ArchetypeID: "support", Name: "Beastcaller", Description: "A nature adept who directs a companion in combat.", DefinitionVersion: ClassDefinitionVersion, StartingStats: ClassStatProfile{Health: 30, Power: 2, Focus: 3, Agility: 2}, StartingEquipment: []string{"weapon.nature-staff", "weapon.hunting-knife", "accessory.beast-charm", "armor.leather"}, SignatureAbilityID: "ability.companion-command", PassiveID: "passive.companion-instinct"},
}

// Availability is deliberately stored separately from gameplay definitions so
// progression policy can evolve without changing a class's combat data.
var classAvailabilityCatalog = []ClassAvailability{
	{ClassID: ClassBulwark, InitiallyAvailable: true},
	{ClassID: ClassJuggernaut, InitiallyAvailable: true},
	{ClassID: ClassSpellguard, InitiallyAvailable: true},
	{ClassID: ClassAssassin, InitiallyAvailable: true},
	{ClassID: ClassArcanist, InitiallyAvailable: true},
	{ClassID: ClassRanger, InitiallyAvailable: true},
	{ClassID: ClassCleric, InitiallyAvailable: true},
	{ClassID: ClassTactician, InitiallyAvailable: true},
	{ClassID: ClassBeastcaller, InitiallyAvailable: true},
}

func ClassCatalog() []ClassDefinition {
	result := make([]ClassDefinition, len(classCatalog))
	for i, definition := range classCatalog {
		result[i] = definition
		result[i].StartingEquipment = append([]string(nil), definition.StartingEquipment...)
	}
	return result
}

func ClassAbilityCatalog() []ClassAbilityDefinition {
	return append([]ClassAbilityDefinition(nil), classAbilities...)
}

func ClassPassiveCatalog() []ClassPassiveDefinition {
	return append([]ClassPassiveDefinition(nil), classPassives...)
}

func EquipmentCatalog() []EquipmentDefinition {
	return append([]EquipmentDefinition(nil), equipmentCatalog...)
}

func ClassAvailabilityCatalog() []ClassAvailability {
	return append([]ClassAvailability(nil), classAvailabilityCatalog...)
}

func ValidateClassCatalog(archetypes []ArchetypeDefinition, classes []ClassDefinition, abilities []ClassAbilityDefinition, passives []ClassPassiveDefinition, equipment []EquipmentDefinition, availability []ClassAvailability) error {
	archetypeIDs := make(map[string]bool, len(archetypes))
	for _, value := range archetypes {
		if value.ID == "" || archetypeIDs[value.ID] {
			return fmt.Errorf("duplicate or empty archetype ID %q", value.ID)
		}
		archetypeIDs[value.ID] = true
	}
	abilityIDs := make(map[string]bool, len(abilities))
	for _, value := range abilities {
		if value.ID == "" || abilityIDs[value.ID] || value.EffectID == "" {
			return fmt.Errorf("invalid or duplicate ability %q", value.ID)
		}
		abilityIDs[value.ID] = true
	}
	passiveIDs := make(map[string]bool, len(passives))
	for _, value := range passives {
		if value.ID == "" || passiveIDs[value.ID] || value.EffectID == "" {
			return fmt.Errorf("invalid or duplicate passive %q", value.ID)
		}
		passiveIDs[value.ID] = true
	}
	equipmentIDs := make(map[string]bool, len(equipment))
	for _, value := range equipment {
		if value.ID == "" || equipmentIDs[value.ID] {
			return fmt.Errorf("duplicate or empty equipment ID %q", value.ID)
		}
		if value.Slot != EquipmentWeapon && value.Slot != EquipmentShield && value.Slot != EquipmentArmor && value.Slot != EquipmentAccessory {
			return fmt.Errorf("equipment %q has invalid slot %q", value.ID, value.Slot)
		}
		equipmentIDs[value.ID] = true
	}
	classIDs := make(map[string]bool, len(classes))
	for _, value := range classes {
		if value.ID == "" || classIDs[value.ID] {
			return fmt.Errorf("duplicate or empty class ID %q", value.ID)
		}
		if !archetypeIDs[value.ArchetypeID] {
			return fmt.Errorf("class %q references unknown archetype %q", value.ID, value.ArchetypeID)
		}
		if value.Name == "" || value.DefinitionVersion <= 0 || value.StartingStats.Health <= 0 ||
			value.StartingStats.Power < 0 || value.StartingStats.Focus < 0 || value.StartingStats.Agility < 0 {
			return fmt.Errorf("class %q has invalid metadata or starting stats", value.ID)
		}
		if !abilityIDs[value.SignatureAbilityID] || !passiveIDs[value.PassiveID] {
			return fmt.Errorf("class %q references an unknown ability or passive", value.ID)
		}
		if len(value.StartingEquipment) == 0 {
			return fmt.Errorf("class %q has no starting equipment", value.ID)
		}
		for _, equipmentID := range value.StartingEquipment {
			if !equipmentIDs[equipmentID] {
				return fmt.Errorf("class %q references unknown equipment %q", value.ID, equipmentID)
			}
		}
		classIDs[value.ID] = true
	}
	availabilityIDs := make(map[string]bool, len(availability))
	for _, value := range availability {
		if !classIDs[value.ClassID] || availabilityIDs[value.ClassID] {
			return fmt.Errorf("availability references unknown or duplicate class %q", value.ClassID)
		}
		if !value.InitiallyAvailable && strings.TrimSpace(value.UnlockPolicyID) == "" {
			return fmt.Errorf("locked class %q has no unlock policy", value.ClassID)
		}
		availabilityIDs[value.ClassID] = true
	}
	if len(availabilityIDs) != len(classIDs) {
		return errors.New("every class must have exactly one availability entry")
	}
	return nil
}

func ValidateCatalog() error {
	if err := ValidateClassCatalog(archetypeCatalog, classCatalog, classAbilities, classPassives, equipmentCatalog, classAvailabilityCatalog); err != nil {
		return err
	}
	if err := defaultRunRewardCatalog.Validate(); err != nil {
		return err
	}
	if err := defaultFloorModifierCatalog.Validate(); err != nil {
		return err
	}
	if err := defaultRunEffectCatalog.Validate(); err != nil {
		return err
	}
	if err := validateShopCatalog(); err != nil {
		return err
	}
	if err := defaultExpeditionThemeCatalog.Validate(defaultDungeonThemeCatalog, defaultEncounterCatalog, defaultMonsterCatalog); err != nil {
		return err
	}
	return validateRegisteredClassEffects()
}

func ClassAvailableToPlayer(classID string, unlockedClassIDs []string) bool {
	definition, ok := findClassAvailability(classID)
	if !ok {
		return false
	}
	if definition.InitiallyAvailable || contains(unlockedClassIDs, classID) {
		return true
	}
	return false
}

func SelectClass(room *Room, playerID, classID string) error {
	return SelectClassWithUnlocks(room, playerID, classID, nil)
}

// SelectClassWithUnlocks accepts persistent unlock IDs from the caller. The
// HTTP layer currently supplies no extra unlocks because the launch roster is
// configured as initially available; persistent profile storage is a later step.
func SelectClassWithUnlocks(room *Room, playerID, classID string, unlockedClassIDs []string) error {
	if room.Run != nil {
		return ErrArchetypeLocked
	}
	if !contains(room.PlayerIDs, playerID) || room.Presence[playerID].LeftAt != nil {
		return ErrNotPlayer
	}
	if _, ok := findClass(classID); !ok {
		return ErrInvalidClass
	}
	if !ClassAvailableToPlayer(classID, unlockedClassIDs) {
		return ErrClassLocked
	}
	if room.PlayerClasses == nil {
		room.PlayerClasses = make(map[string]string)
	}
	if room.PlayerArchetypes == nil {
		room.PlayerArchetypes = make(map[string]string)
	}
	definition, _ := findClass(classID)
	if room.PlayerClasses[playerID] != classID && room.PlayerSkins != nil {
		// a look belongs to a class: a new class starts from its own default
		delete(room.PlayerSkins, playerID)
	}
	room.PlayerClasses[playerID] = classID
	room.PlayerArchetypes[playerID] = definition.ArchetypeID
	return nil
}

func StartingBuildForClass(classID string) (ClassBuildSnapshot, error) {
	definition, ok := findClass(classID)
	if !ok {
		return ClassBuildSnapshot{}, ErrInvalidClass
	}
	return ClassBuildSnapshot{
		ClassID: definition.ID, DefinitionVersion: definition.DefinitionVersion,
		SignatureAbilityID: definition.SignatureAbilityID, PassiveID: definition.PassiveID,
		MaxHealth:    definition.StartingStats.Health,
		Stats:        PlayerStats{Power: definition.StartingStats.Power, Focus: definition.StartingStats.Focus, Agility: definition.StartingStats.Agility},
		EquipmentIDs: append([]string(nil), definition.StartingEquipment...),
	}, nil
}

func newPlayerStateForClass(id string, definition ClassDefinition) *PlayerState {
	build, _ := StartingBuildForClass(definition.ID)
	return &PlayerState{
		ID: id, Health: build.MaxHealth, MaxHealth: build.MaxHealth, Archetype: definition.ArchetypeID,
		Stats: build.Stats, ClassBuild: &build, Level: 1, Talents: []string{},
	}
}

func findClass(id string) (ClassDefinition, bool) {
	for _, definition := range classCatalog {
		if definition.ID == id {
			return definition, true
		}
	}
	return ClassDefinition{}, false
}

func findClassAvailability(id string) (ClassAvailability, bool) {
	for _, definition := range classAvailabilityCatalog {
		if definition.ClassID == id {
			return definition, true
		}
	}
	return ClassAvailability{}, false
}

func findClassAbility(id string) (ClassAbilityDefinition, bool) {
	for _, definition := range classAbilities {
		if definition.ID == id {
			return definition, true
		}
	}
	return ClassAbilityDefinition{}, false
}

func findClassPassive(id string) (ClassPassiveDefinition, bool) {
	for _, definition := range classPassives {
		if definition.ID == id {
			return definition, true
		}
	}
	return ClassPassiveDefinition{}, false
}
