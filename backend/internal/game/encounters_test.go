package game

import "testing"

func TestDefaultEncounterCatalogValidates(t *testing.T) {
	if err := defaultEncounterCatalog.Validate(defaultMonsterCatalog); err != nil {
		t.Fatalf("default encounter catalog is invalid: %v", err)
	}
}

func TestEncounterCatalogInstantiatesStableSlotsAndPartyVariants(t *testing.T) {
	tests := []struct {
		name       string
		partySize  int
		encounter  string
		scaling    MonsterScaling
		wantIDs    []string
		wantHealth []int
	}{
		{
			name: "co-op reliquary", partySize: 2, encounter: "catacombs-reliquary", scaling: MonsterScaling{HealthMultiplier: 1, PartySize: 2},
			wantIDs: []string{"guardian", "scout"}, wantHealth: []int{20, 15},
		},
		{
			name: "solo reliquary", partySize: 1, encounter: "catacombs-reliquary", scaling: MonsterScaling{HealthMultiplier: 0.75, RoundDown: true, PartySize: 1},
			wantIDs: []string{"guardian", "scout"}, wantHealth: []int{15, 11},
		},
		{
			name: "solo flooded crossing variant", partySize: 1, encounter: "catacombs-flooded-crossing", scaling: MonsterScaling{HealthMultiplier: 1, PartySize: 1},
			wantIDs: []string{"scout"}, wantHealth: []int{11},
		},
		{
			name: "co-op flooded crossing variant", partySize: 2, encounter: "catacombs-flooded-crossing", scaling: MonsterScaling{HealthMultiplier: 1, PartySize: 2},
			wantIDs: []string{"scout"}, wantHealth: []int{14},
		},
		{
			name: "solo boss variant", partySize: 1, encounter: "catacombs-warden-boss", scaling: MonsterScaling{HealthMultiplier: 1, PartySize: 1},
			wantIDs: []string{"warden"}, wantHealth: []int{36},
		},
		{
			name: "co-op boss variant", partySize: 2, encounter: "catacombs-warden-boss", scaling: MonsterScaling{HealthMultiplier: 1, PartySize: 2},
			wantIDs: []string{"warden"}, wantHealth: []int{42},
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			encounter, err := defaultEncounterCatalog.Instantiate(test.encounter, "test-", test.scaling)
			if err != nil {
				t.Fatal(err)
			}
			if encounter.DefinitionID != test.encounter || len(encounter.Enemies) != len(test.wantIDs) {
				t.Fatalf("unexpected encounter instance: %+v", encounter)
			}
			for i, enemy := range encounter.Enemies {
				if enemy.ID != "test-"+test.wantIDs[i] || enemy.Health != test.wantHealth[i] || enemy.DefinitionID == "" {
					t.Errorf("enemy %d = %+v, want id=%s health=%d and definition reference", i, enemy, "test-"+test.wantIDs[i], test.wantHealth[i])
				}
			}
		})
	}
}

func TestEncounterCatalogRejectsInvalidBudgetAndMonsterReferences(t *testing.T) {
	tests := []struct {
		name       string
		definition EncounterDefinition
	}{
		{
			name:       "budget mismatch",
			definition: EncounterDefinition{ID: "broken", Budget: 3, Enemies: []EncounterMonsterDefinition{{ID: "enemy", MonsterID: "scout", BudgetCost: 2}}},
		},
		{
			name:       "unknown monster",
			definition: EncounterDefinition{ID: "broken", Budget: 2, Enemies: []EncounterMonsterDefinition{{ID: "enemy", MonsterID: "missing", BudgetCost: 2}}},
		},
		{
			name:       "duplicate slot",
			definition: EncounterDefinition{ID: "broken", Budget: 2, Enemies: []EncounterMonsterDefinition{{ID: "enemy", MonsterID: "scout", BudgetCost: 1}, {ID: "enemy", MonsterID: "guardian", BudgetCost: 1}}},
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			catalog := EncounterCatalog{Encounters: map[string]EncounterDefinition{"broken": test.definition}}
			if err := catalog.Validate(defaultMonsterCatalog); err == nil {
				t.Fatal("expected invalid encounter catalog to be rejected")
			}
		})
	}
}
