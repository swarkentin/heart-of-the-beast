package game

import (
	"fmt"
	"strings"
)

// ClassAbilityOperationKind describes a deterministic operation performed by
// a signature ability. Definitions are data-only; runtime application remains
// in the authoritative combat engine.
type ClassAbilityOperationKind string

const (
	ClassAbilityOpGuard             ClassAbilityOperationKind = "guard"
	ClassAbilityOpWard              ClassAbilityOperationKind = "ward"
	ClassAbilityOpDamage            ClassAbilityOperationKind = "damage"
	ClassAbilityOpCounterDamage     ClassAbilityOperationKind = "counter_damage"
	ClassAbilityOpInterruptOrWeaken ClassAbilityOperationKind = "interrupt_or_weaken"
	ClassAbilityOpHeal              ClassAbilityOperationKind = "heal"
	ClassAbilityOpMarkAndWeaken     ClassAbilityOperationKind = "mark_and_weaken"
	ClassAbilityOpModeChoice        ClassAbilityOperationKind = "mode_choice"
	ClassAbilityOpBuildCharge       ClassAbilityOperationKind = "build_charge"
)

type ClassAbilityOperation struct {
	Kind        ClassAbilityOperationKind `json:"kind"`
	Amount      int                       `json:"amount,omitempty"`
	ScalingStat string                    `json:"scalingStat,omitempty"`
	Mode        string                    `json:"mode,omitempty"`
	Condition   string                    `json:"condition,omitempty"`
}

type ClassAbilityOperationDefinition struct {
	EffectID     string                  `json:"effectId"`
	TargetPolicy string                  `json:"targetPolicy"`
	Modes        []string                `json:"modes,omitempty"`
	Operations   []ClassAbilityOperation `json:"operations"`
}

var defaultClassAbilityOperationCatalog = []ClassAbilityOperationDefinition{
	{EffectID: "combat.guard", TargetPolicy: "none", Operations: []ClassAbilityOperation{{Kind: ClassAbilityOpGuard, Amount: 6}}},
	{EffectID: "combat.counter", TargetPolicy: "enemy", Operations: []ClassAbilityOperation{{Kind: ClassAbilityOpCounterDamage, Amount: 4, Condition: "damage_taken_last_round", ScalingStat: "damage_taken_last_round"}}},
	{EffectID: "combat.ward", TargetPolicy: "none", Operations: []ClassAbilityOperation{{Kind: ClassAbilityOpWard, Amount: 7}, {Kind: ClassAbilityOpWard, Amount: 2, Condition: "reflect"}}},
	{EffectID: "combat.precision", TargetPolicy: "enemy", Operations: []ClassAbilityOperation{{Kind: ClassAbilityOpDamage, Amount: 5, ScalingStat: "agility", Condition: "wounded_or_has_intent_bonus_4"}}},
	{EffectID: "combat.elemental", TargetPolicy: "enemy", Modes: []string{"fire", "frost"}, Operations: []ClassAbilityOperation{{Kind: ClassAbilityOpModeChoice, Mode: "fire", Amount: 6, ScalingStat: "focus"}, {Kind: ClassAbilityOpModeChoice, Mode: "frost", Amount: 2, ScalingStat: "focus", Condition: "interrupt_intent"}, {Kind: ClassAbilityOpBuildCharge, Amount: 1}}},
	{EffectID: "combat.disrupt", TargetPolicy: "enemy", Operations: []ClassAbilityOperation{{Kind: ClassAbilityOpDamage, Amount: 4, ScalingStat: "agility"}, {Kind: ClassAbilityOpInterruptOrWeaken, Amount: 3, Condition: "weaken_next_attack"}}},
	{EffectID: "combat.heal", TargetPolicy: "player_optional", Operations: []ClassAbilityOperation{{Kind: ClassAbilityOpHeal, Amount: 7, ScalingStat: "focus", Condition: "clamp_to_max_health"}}},
	{EffectID: "combat.command", TargetPolicy: "enemy", Operations: []ClassAbilityOperation{{Kind: ClassAbilityOpDamage, Amount: 3, ScalingStat: "power"}, {Kind: ClassAbilityOpMarkAndWeaken, Amount: 3, Condition: "weaken_intent_by_2"}}},
	{EffectID: "combat.companion", TargetPolicy: "mode_target", Modes: []string{"attack", "defend", "disrupt"}, Operations: []ClassAbilityOperation{{Kind: ClassAbilityOpModeChoice, Mode: "attack", Amount: 4, ScalingStat: "focus"}, {Kind: ClassAbilityOpModeChoice, Mode: "defend", Amount: 3}, {Kind: ClassAbilityOpModeChoice, Mode: "disrupt", Amount: 3, Condition: "interrupt_if_interruptible_else_weaken"}}},
}

func classAbilityOperationDefinition(effectID string) (ClassAbilityOperationDefinition, bool) {
	for _, definition := range defaultClassAbilityOperationCatalog {
		if definition.EffectID == effectID {
			return definition, true
		}
	}
	return ClassAbilityOperationDefinition{}, false
}

func validateClassAbilityOperationCatalog(abilities []ClassAbilityDefinition, definitions []ClassAbilityOperationDefinition) error {
	knownKinds := map[ClassAbilityOperationKind]bool{
		ClassAbilityOpGuard:             true,
		ClassAbilityOpWard:              true,
		ClassAbilityOpDamage:            true,
		ClassAbilityOpCounterDamage:     true,
		ClassAbilityOpInterruptOrWeaken: true,
		ClassAbilityOpHeal:              true,
		ClassAbilityOpMarkAndWeaken:     true,
		ClassAbilityOpModeChoice:        true,
		ClassAbilityOpBuildCharge:       true,
	}
	byEffect := make(map[string]ClassAbilityOperationDefinition, len(definitions))
	for _, definition := range definitions {
		if strings.TrimSpace(definition.EffectID) == "" || byEffect[definition.EffectID].EffectID != "" {
			return fmt.Errorf("duplicate or empty class ability effect %q", definition.EffectID)
		}
		if definition.TargetPolicy != "none" && definition.TargetPolicy != "enemy" && definition.TargetPolicy != "player_optional" && definition.TargetPolicy != "mode_target" {
			return fmt.Errorf("class ability effect %q has invalid target policy %q", definition.EffectID, definition.TargetPolicy)
		}
		if len(definition.Operations) == 0 {
			return fmt.Errorf("class ability effect %q has no operations", definition.EffectID)
		}
		for _, operation := range definition.Operations {
			if !knownKinds[operation.Kind] || operation.Amount < 0 {
				return fmt.Errorf("class ability effect %q has invalid operation", definition.EffectID)
			}
			if operation.Kind == ClassAbilityOpModeChoice && !contains(definition.Modes, operation.Mode) {
				return fmt.Errorf("class ability effect %q has operation for unsupported mode %q", definition.EffectID, operation.Mode)
			}
		}
		byEffect[definition.EffectID] = definition
	}
	for _, ability := range abilities {
		if _, ok := byEffect[ability.EffectID]; !ok {
			return fmt.Errorf("ability %q has no operation definition for effect %q", ability.ID, ability.EffectID)
		}
	}
	if len(byEffect) != len(abilities) {
		return fmt.Errorf("class ability operation catalog has %d effects for %d abilities", len(byEffect), len(abilities))
	}
	return nil
}
