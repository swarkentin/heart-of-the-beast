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

func TestMonsterCatalogCreatesNamedEnemiesAndAppliesScaling(t *testing.T) {
	tests := []struct {
		name       string
		monsterID  string
		scaling    MonsterScaling
		wantName   string
		wantHealth int
	}{
		{"legacy guardian", "reliquary-guardian", MonsterScaling{HealthMultiplier: 1}, "Reliquary Guardian", 20},
		{"solo guardian", "bonebound-guardian", MonsterScaling{HealthMultiplier: 0.75, RoundDown: true}, "Bonebound Guardian", 16},
		{"solo crossing scout", "drowned-scout-crossing-solo", MonsterScaling{HealthMultiplier: 1}, "Drowned Scout", 11},
		{"depth two boss solo", "warden", MonsterScaling{Depth: 2, PartySize: 1}, "Crypt Warden", 40},
		{"depth three boss duo", "warden", MonsterScaling{Depth: 3, PartySize: 2}, "Crypt Warden", 80},
		{"depth two miniboss solo", "depth-reliquary-brute", MonsterScaling{Depth: 2, PartySize: 1}, "Reliquary Brute", 31},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			enemy, err := defaultMonsterCatalog.NewEnemy("instance", test.monsterID, test.scaling)
			if err != nil {
				t.Fatal(err)
			}
			if enemy.Name != test.wantName || enemy.Health != test.wantHealth || enemy.MaxHealth != test.wantHealth {
				t.Fatalf("got name=%q health=%d max=%d, want name=%q health=%d", enemy.Name, enemy.Health, enemy.MaxHealth, test.wantName, test.wantHealth)
			}
			if enemy.DefinitionID != test.monsterID {
				t.Fatalf("definition reference = %q, want %q", enemy.DefinitionID, test.monsterID)
			}
		})
	}
}
