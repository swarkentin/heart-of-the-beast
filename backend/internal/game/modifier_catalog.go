package game

import "fmt"

// CombatModifierDefinition is an immutable, data-only contribution to combat
// rules. Talent selection remains player-authored; these definitions do not
// introduce random selection or change when a modifier is applied.
type CombatModifierDefinition struct {
	ID      string
	Bonuses TalentBonuses
}

type CombatModifierCatalog struct {
	Modifiers map[string]CombatModifierDefinition
}

var defaultCombatModifierCatalog = newCombatModifierCatalog()

func newCombatModifierCatalog() CombatModifierCatalog {
	definitions := []CombatModifierDefinition{
		{ID: "support-disruption", Bonuses: TalentBonuses{InterruptDamage: 4}},
		{ID: "support-protective-ward", Bonuses: TalentBonuses{PartyGuardReduction: 2}},
		{ID: "support-expose-weakness", Bonuses: TalentBonuses{AttackVsTelegraph: 4}},
		{ID: "support-rallying-cry", Bonuses: TalentBonuses{PartyEncounterHeal: 2}},
		{ID: "damage-heavy-hands", Bonuses: TalentBonuses{AttackDamage: 3}},
		{ID: "damage-precision", Bonuses: TalentBonuses{AttackDamage: 2}},
		{ID: "damage-opportunist", Bonuses: TalentBonuses{AttackVsTelegraph: 4}},
		{ID: "damage-counterstrike", Bonuses: TalentBonuses{InterruptDamage: 4}},
		{ID: "tank-bulwark", Bonuses: TalentBonuses{MaxHealth: 6}},
		{ID: "tank-braced-stance", Bonuses: TalentBonuses{GuardReduction: 3}},
		{ID: "tank-thorns", Bonuses: TalentBonuses{ReflectDamage: 2}},
		{ID: "tank-unyielding", Bonuses: TalentBonuses{GuardReduction: 3}},
	}
	catalog := CombatModifierCatalog{Modifiers: make(map[string]CombatModifierDefinition, len(definitions))}
	for _, definition := range definitions {
		catalog.Modifiers[definition.ID] = definition
	}
	return catalog
}

func (catalog CombatModifierCatalog) Modifier(id string) (CombatModifierDefinition, bool) {
	modifier, ok := catalog.Modifiers[id]
	return modifier, ok
}

func (catalog CombatModifierCatalog) Validate() error {
	for id, modifier := range catalog.Modifiers {
		if id == "" || modifier.ID != id {
			return fmt.Errorf("invalid combat modifier %q", id)
		}
		b := modifier.Bonuses
		if b.AttackDamage < 0 || b.InterruptDamage < 0 || b.GuardReduction < 0 ||
			b.DamageReduction < 0 || b.AttackVsTelegraph < 0 || b.EncounterHeal < 0 ||
			b.ReflectDamage < 0 || b.MaxHealth < 0 || b.PartyGuardReduction < 0 ||
			b.PartyEncounterHeal < 0 {
			return fmt.Errorf("combat modifier %q has a negative bonus", id)
		}
	}
	for _, talent := range talentCatalog {
		if _, ok := catalog.Modifiers[talent.ID]; !ok {
			return fmt.Errorf("talent %q has no combat modifier definition", talent.ID)
		}
	}
	return nil
}
