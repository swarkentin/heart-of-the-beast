package game

import "testing"

func TestDefaultMonsterCatalogValidates(t *testing.T) {
	if err := defaultMonsterCatalog.Validate(); err != nil {
		t.Fatalf("default monster catalog is invalid: %v", err)
	}
}

func TestDefaultMonsterCatalogPreservesCurrentAbilityCadence(t *testing.T) {
	tests := []struct {
		monster string
		turn    int
		kind    string
		damage  int
		heal    int
	}{
		{"scout", 1, "quick_strike", 3, 0},
		{"guardian", 1, "heavy_strike", 8, 0},
		{"guardian", 2, "strike", 4, 0},
		{"miniboss", 1, "stone_strike", 5, 0},
		{"miniboss", 2, "crusher", 8, 0},
		{"warden", 1, "soul_drain", 5, 2},
		{"warden", 3, "soul_sweep", 3, 0},
		{"warden", 4, "soul_drain", 5, 2},
	}
	for _, test := range tests {
		ability, err := defaultMonsterCatalog.SelectAbility(test.monster, test.turn)
		if err != nil {
			t.Fatalf("%s turn %d: %v", test.monster, test.turn, err)
		}
		if ability.Kind != test.kind || ability.Damage != test.damage || ability.Heal != test.heal {
			t.Errorf("%s turn %d: got %+v, want kind=%s damage=%d heal=%d", test.monster, test.turn, ability, test.kind, test.damage, test.heal)
		}
	}
}
