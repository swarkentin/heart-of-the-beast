package game

import "fmt"

type ClassPassiveTrigger string

const (
	ClassPassiveTriggerNone ClassPassiveTrigger = "none"
	ClassPassiveTriggerLowHealthAttack ClassPassiveTrigger = "low_health_attack"
	ClassPassiveTriggerIntentKind ClassPassiveTrigger = "intent_kind"
	ClassPassiveTriggerWoundedTargetAttack ClassPassiveTrigger = "wounded_target_attack"
	ClassPassiveTriggerElementalCharge ClassPassiveTrigger = "elemental_charge"
	ClassPassiveTriggerUnactedTargetAttack ClassPassiveTrigger = "unacted_target_attack"
	ClassPassiveTriggerEncounterClear ClassPassiveTrigger = "encounter_clear"
	ClassPassiveTriggerInterrupt ClassPassiveTrigger = "interrupt"
	ClassPassiveTriggerCompanionInstinct ClassPassiveTrigger = "companion_instinct"
	ClassPassiveTriggerHeavyGuard ClassPassiveTrigger = "heavy_guard"
)

type ClassPassiveBonus string

const (
	ClassPassiveBonusNone ClassPassiveBonus = "none"
	ClassPassiveBonusAttackDamage ClassPassiveBonus = "attack_damage"
	ClassPassiveBonusDamageReduction ClassPassiveBonus = "damage_reduction"
	ClassPassiveBonusElementalDamage ClassPassiveBonus = "elemental_damage"
	ClassPassiveBonusEncounterHeal ClassPassiveBonus = "encounter_heal"
	ClassPassiveBonusInterruptDamage ClassPassiveBonus = "interrupt_damage"
)

type ClassPassiveEffectDefinition struct {
	EffectID string
	Trigger ClassPassiveTrigger
	Bonus ClassPassiveBonus
	Amount int
	HealthThresholdPercent int
	MaxTurnsTaken int
	IntentKinds []string
}

type ClassPassiveEffectCatalog struct {
	Definitions []ClassPassiveEffectDefinition
	byID map[string]ClassPassiveEffectDefinition
}

var defaultClassPassiveEffectCatalog = newClassPassiveEffectCatalog()

func newClassPassiveEffectCatalog() ClassPassiveEffectCatalog {
	definitions := []ClassPassiveEffectDefinition{
		{EffectID: "passive.resolve", Trigger: ClassPassiveTriggerHeavyGuard},
		{EffectID: "passive.low-health", Trigger: ClassPassiveTriggerLowHealthAttack, Bonus: ClassPassiveBonusAttackDamage, Amount: 3, HealthThresholdPercent: 50},
		{EffectID: "passive.magic-resist", Trigger: ClassPassiveTriggerIntentKind, Bonus: ClassPassiveBonusDamageReduction, Amount: 2, IntentKinds: []string{"soul_drain", "soul_sweep"}},
		{EffectID: "passive.wounded-target", Trigger: ClassPassiveTriggerWoundedTargetAttack, Bonus: ClassPassiveBonusAttackDamage, Amount: 3, HealthThresholdPercent: 50},
		{EffectID: "passive.elemental-chain", Trigger: ClassPassiveTriggerElementalCharge, Bonus: ClassPassiveBonusElementalDamage, Amount: 2},
		{EffectID: "passive.unacted-target", Trigger: ClassPassiveTriggerUnactedTargetAttack, Bonus: ClassPassiveBonusAttackDamage, Amount: 3, MaxTurnsTaken: 1},
		{EffectID: "passive.encounter-recovery", Trigger: ClassPassiveTriggerEncounterClear, Bonus: ClassPassiveBonusEncounterHeal, Amount: 2},
		{EffectID: "passive.interrupt", Trigger: ClassPassiveTriggerInterrupt, Bonus: ClassPassiveBonusInterruptDamage, Amount: 2},
		{EffectID: "passive.companion", Trigger: ClassPassiveTriggerCompanionInstinct},
	}
	catalog := ClassPassiveEffectCatalog{Definitions: definitions, byID: make(map[string]ClassPassiveEffectDefinition, len(definitions))}
	for _, definition := range definitions {
		definition.IntentKinds = append([]string(nil), definition.IntentKinds...)
		catalog.byID[definition.EffectID] = definition
	}
	return catalog
}

func (catalog ClassPassiveEffectCatalog) Effect(effectID string) (ClassPassiveEffectDefinition, bool) {
	definition, ok := catalog.byID[effectID]
	definition.IntentKinds = append([]string(nil), definition.IntentKinds...)
	return definition, ok
}

func (definition ClassPassiveEffectDefinition) Resolve(player *PlayerState, enemy *Enemy, intent *EnemyIntent) classPassiveBonuses {
	if player == nil {
		return classPassiveBonuses{}
	}
	active := false
	switch definition.Trigger {
	case ClassPassiveTriggerLowHealthAttack:
		active = player.MaxHealth > 0 && player.Health*100 <= player.MaxHealth*definition.HealthThresholdPercent
	case ClassPassiveTriggerIntentKind:
		active = intent != nil && contains(definition.IntentKinds, intent.Kind)
	case ClassPassiveTriggerWoundedTargetAttack:
		active = enemy != nil && enemy.MaxHealth > 0 && enemy.Health*100 <= enemy.MaxHealth*definition.HealthThresholdPercent
	case ClassPassiveTriggerElementalCharge:
		return classPassiveBonuses{ElementalDamage: player.ClassCombat.ArcaneCharges * definition.Amount}
	case ClassPassiveTriggerUnactedTargetAttack:
		active = enemy != nil && enemy.TurnsTaken <= definition.MaxTurnsTaken
	case ClassPassiveTriggerEncounterClear, ClassPassiveTriggerInterrupt:
		active = true
	}
	if !active {
		return classPassiveBonuses{}
	}
	switch definition.Bonus {
	case ClassPassiveBonusAttackDamage:
		return classPassiveBonuses{AttackDamage: definition.Amount}
	case ClassPassiveBonusDamageReduction:
		return classPassiveBonuses{DamageReduction: definition.Amount}
	case ClassPassiveBonusElementalDamage:
		return classPassiveBonuses{ElementalDamage: definition.Amount}
	case ClassPassiveBonusEncounterHeal:
		return classPassiveBonuses{EncounterHeal: definition.Amount}
	case ClassPassiveBonusInterruptDamage:
		return classPassiveBonuses{InterruptDamage: definition.Amount}
	default:
		return classPassiveBonuses{}
	}
}

func (catalog ClassPassiveEffectCatalog) Validate(passives []ClassPassiveDefinition) error {
	seen := make(map[string]bool, len(catalog.Definitions))
	for _, definition := range catalog.Definitions {
		if definition.EffectID == "" || seen[definition.EffectID] {
			return fmt.Errorf("duplicate or empty class passive effect ID %q", definition.EffectID)
		}
		seen[definition.EffectID] = true
		switch definition.Trigger {
		case ClassPassiveTriggerNone, ClassPassiveTriggerHeavyGuard, ClassPassiveTriggerLowHealthAttack,
			ClassPassiveTriggerIntentKind, ClassPassiveTriggerWoundedTargetAttack, ClassPassiveTriggerElementalCharge,
			ClassPassiveTriggerUnactedTargetAttack, ClassPassiveTriggerEncounterClear, ClassPassiveTriggerInterrupt,
			ClassPassiveTriggerCompanionInstinct:
		default:
			return fmt.Errorf("passive effect %q has unknown trigger %q", definition.EffectID, definition.Trigger)
		}
		switch definition.Bonus {
		case ClassPassiveBonusNone:
			if definition.Amount != 0 {
				return fmt.Errorf("passive effect %q has an amount without a bonus", definition.EffectID)
			}
		case ClassPassiveBonusAttackDamage, ClassPassiveBonusDamageReduction, ClassPassiveBonusElementalDamage,
			ClassPassiveBonusEncounterHeal, ClassPassiveBonusInterruptDamage:
			if definition.Amount <= 0 {
				return fmt.Errorf("passive effect %q must have a positive bonus amount", definition.EffectID)
			}
		default:
			return fmt.Errorf("passive effect %q has unknown bonus %q", definition.EffectID, definition.Bonus)
		}
		if definition.Trigger == ClassPassiveTriggerIntentKind && len(definition.IntentKinds) == 0 {
			return fmt.Errorf("passive effect %q requires intent kinds", definition.EffectID)
		}
		if (definition.Trigger == ClassPassiveTriggerLowHealthAttack || definition.Trigger == ClassPassiveTriggerWoundedTargetAttack) &&
			(definition.HealthThresholdPercent <= 0 || definition.HealthThresholdPercent > 100) {
			return fmt.Errorf("passive effect %q has invalid health threshold", definition.EffectID)
		}
		if definition.Trigger == ClassPassiveTriggerUnactedTargetAttack && definition.MaxTurnsTaken < 0 {
			return fmt.Errorf("passive effect %q has invalid turn threshold", definition.EffectID)
		}
	}
	for _, passive := range passives {
		if _, ok := catalog.byID[passive.EffectID]; !ok {
			return fmt.Errorf("passive %q has no definition for effect %q", passive.ID, passive.EffectID)
		}
	}
	if len(seen) != len(passives) {
		return fmt.Errorf("class passive effect catalog has %d definitions for %d passives", len(seen), len(passives))
	}
	return nil
}

func ValidateClassPassiveEffectCatalog(passives []ClassPassiveDefinition, catalog ClassPassiveEffectCatalog) error {
	return catalog.Validate(passives)
}

func classPassiveHasTrigger(player *PlayerState, trigger ClassPassiveTrigger) bool {
	if player == nil || player.ClassBuild == nil {
		return false
	}
	passive, ok := findClassPassive(player.ClassBuild.PassiveID)
	if !ok {
		return false
	}
	definition, ok := defaultClassPassiveEffectCatalog.Effect(passive.EffectID)
	return ok && definition.Trigger == trigger
}
