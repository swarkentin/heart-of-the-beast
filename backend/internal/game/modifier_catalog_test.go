package game

import "testing"

func TestDefaultCombatModifierCatalogValidates(t *testing.T) {
	if err := defaultCombatModifierCatalog.Validate(); err != nil {
		t.Fatalf("default combat modifier catalog is invalid: %v", err)
	}
}

func TestCombatModifierCatalogMatchesTalentBonuses(t *testing.T) {
	cases := []struct {
		id   string
		want TalentBonuses
	}{
		{"support-disruption", TalentBonuses{InterruptDamage: 4}},
		{"support-protective-ward", TalentBonuses{PartyGuardReduction: 2}},
		{"support-expose-weakness", TalentBonuses{AttackVsTelegraph: 4}},
		{"support-rallying-cry", TalentBonuses{PartyEncounterHeal: 2}},
		{"damage-heavy-hands", TalentBonuses{AttackDamage: 3}},
		{"damage-precision", TalentBonuses{AttackDamage: 2}},
		{"damage-opportunist", TalentBonuses{AttackVsTelegraph: 4}},
		{"damage-counterstrike", TalentBonuses{InterruptDamage: 4}},
		{"tank-bulwark", TalentBonuses{MaxHealth: 6}},
		{"tank-braced-stance", TalentBonuses{GuardReduction: 3}},
		{"tank-thorns", TalentBonuses{ReflectDamage: 2}},
		{"tank-unyielding", TalentBonuses{GuardReduction: 3}},
	}
	for _, tc := range cases {
		t.Run(tc.id, func(t *testing.T) {
			got, ok := defaultCombatModifierCatalog.Modifier(tc.id)
			if !ok {
				t.Fatalf("modifier %q was not found", tc.id)
			}
			if got.Bonuses != tc.want {
				t.Fatalf("modifier %q bonuses = %+v, want %+v", tc.id, got.Bonuses, tc.want)
			}
		})
	}
	if _, ok := defaultCombatModifierCatalog.Modifier("missing"); ok {
		t.Fatal("unknown modifier unexpectedly resolved")
	}
}

func TestCombatModifierCatalogRejectsInvalidDefinitions(t *testing.T) {
	catalog := CombatModifierCatalog{Modifiers: map[string]CombatModifierDefinition{
		"mismatch": {ID: "different"},
	}}
	if err := catalog.Validate(); err == nil {
		t.Fatal("expected invalid modifier ID to be rejected")
	}
	catalog = CombatModifierCatalog{Modifiers: map[string]CombatModifierDefinition{
		"negative": {ID: "negative", Bonuses: TalentBonuses{AttackDamage: -1}},
	}}
	if err := catalog.Validate(); err == nil {
		t.Fatal("expected negative modifier bonus to be rejected")
	}
}
