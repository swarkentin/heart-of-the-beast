package game

import (
	"strings"
	"testing"

	"github.com/swarkentin/heart-of-the-beast/backend/internal/art"
)

func TestDefaultDungeonThemeContentValidates(t *testing.T) {
	if err := defaultDungeonThemeCatalog.Validate(defaultMonsterCatalog, defaultEncounterCatalog); err != nil {
		t.Fatalf("default dungeon content is invalid: %v", err)
	}
}

// Every sprite the art pipeline produces has a monster, and every monster has art the registry knows about.
func TestEveryMonsterHasArtAndEverySpriteHasAMonster(t *testing.T) {
	used := map[art.SpriteID]bool{}
	for id, monster := range defaultMonsterCatalog.Monsters {
		sprite, ok := art.Lookup(monster.Sprite)
		if !ok {
			t.Errorf("monster %q has no art", id)
			continue
		}
		used[monster.Sprite] = true
		if monster.Role == MonsterRoleBoss && !sprite.Boss {
			t.Errorf("boss %q uses the non-boss sprite %s", id, monster.Sprite)
		}
	}
	for _, sprite := range art.Sprites() {
		if !used[sprite.ID] {
			t.Errorf("sprite %s (%s) has no monster definition", sprite.ID, sprite.Name)
		}
	}
	if len(art.Sprites()) != 165 {
		t.Errorf("expected the 165-creature bestiary, registry has %d sprites", len(art.Sprites()))
	}
}

func TestEveryThemeHasMonstersAndFourBosses(t *testing.T) {
	for _, id := range defaultDungeonThemeCatalog.IDs() {
		bosses, others := 0, 0
		for _, monsterID := range defaultDungeonThemeCatalog.MonsterIDs(id, defaultMonsterCatalog) {
			sprite, _ := art.Lookup(defaultMonsterCatalog.Monsters[monsterID].Sprite)
			if sprite.Boss {
				bosses++
			} else {
				others++
			}
		}
		if others == 0 || bosses == 0 {
			t.Errorf("theme %q has %d monsters and %d bosses", id, others, bosses)
		}
	}
	for _, theme := range art.Themes() {
		bossSprites := 0
		for _, sprite := range art.Sprites() {
			if sprite.Theme == theme.ID && sprite.Boss {
				bossSprites++
			}
		}
		if bossSprites != 4 {
			t.Errorf("art theme %q has %d boss sprites, want 4 (three dungeon bosses and a lair boss)", theme.ID, bossSprites)
		}
	}
}

// Every monster must always have an ability to use, whatever turn it is.
func TestEveryMonsterHasAnAbilityOnEveryTurn(t *testing.T) {
	for id, monster := range defaultMonsterCatalog.Monsters {
		for turn := 1; turn <= 18; turn++ {
			if _, err := defaultMonsterCatalog.SelectAbility(monster.BehaviorID, turn); err != nil {
				t.Errorf("monster %q turn %d: %v", id, turn, err)
			}
		}
	}
}

func TestEveryEncounterInstantiatesForEveryPartySize(t *testing.T) {
	for id := range defaultEncounterCatalog.Encounters {
		previous := 0
		for partySize := 1; partySize <= MaxEncounterPartySize; partySize++ {
			encounter, err := defaultEncounterCatalog.Instantiate(id, "t-", MonsterScaling{Depth: 1, PartySize: partySize})
			if err != nil {
				t.Fatalf("%s party %d: %v", id, partySize, err)
			}
			// A larger party never meets fewer enemies, and no fight outgrows what the scene can lay out.
			if len(encounter.Enemies) == 0 || len(encounter.Enemies) > MaxEncounterEnemies || len(encounter.Enemies) < previous {
				t.Errorf("%s has %d enemies for a party of %d (%d for one fewer)", id, len(encounter.Enemies), partySize, previous)
			}
			previous = len(encounter.Enemies)
			for _, enemy := range encounter.Enemies {
				if _, ok := art.ParseSprite(enemy.SpriteID); !ok {
					t.Errorf("%s: enemy %q has unknown sprite %q", id, enemy.ID, enemy.SpriteID)
				}
			}
		}
	}
}

func TestThemedMonsterAbilityRhythms(t *testing.T) {
	tests := []struct {
		behavior string
		turn     int
		label    string
		kind     string
		damage   int
		all      bool
	}{
		{"ice-wraith", 1, "Shard bolt", "bolt", 4, false},
		{"ice-wraith", 3, "Rime wail", "wail", 2, true},
		{"crab-drone", 2, "Pincer snap", "quick_strike", 3, false},
		{"crab-drone", 3, "Arc discharge", "special_strike", 5, false},
		{"drowned-knight", 1, "Trident thrust", "heavy_strike", 7, false},
		{"drowned-knight", 2, "Tower-shield stance", "strike", 4, false},
		{"tide-brute", 2, "Crushing swing", "crusher", 8, false},
		{"tide-brute", 3, "Tidal bellow", "strike", 5, false},
		{"drowned-king", 1, "Trident of tides", "drain", 5, false},
		{"drowned-king", 3, "Call the deep", "sweep", 3, true},
		{"brass-colossus", 2, "Piston slam", "crusher", 10, false},
		{"brass-colossus", 3, "Overpressure blast", "sweep", 3, true},
		{"apex-maw", 1, "Engulfing snap", "strike", 4, false},
		{"apex-maw", 3, "Acid geyser", "heavy_strike", 9, false},
	}
	for _, test := range tests {
		ability, err := defaultMonsterCatalog.SelectAbility(test.behavior, test.turn)
		if err != nil {
			t.Fatalf("%s turn %d: %v", test.behavior, test.turn, err)
		}
		if ability.Label != test.label || ability.Kind != test.kind || ability.Damage != test.damage || ability.TargetAll != test.all {
			t.Errorf("%s turn %d: got %+v, want %q %s %d all=%v", test.behavior, test.turn, ability, test.label, test.kind, test.damage, test.all)
		}
	}
}

func TestEnemiesCarryTheirSprite(t *testing.T) {
	tests := []struct{ monster, sprite string }{
		{"scout", "catacombs/drowned_scout"},
		{"warden", "catacombs/crypt_warden"},
		{"ice-wraith", "arctic/ice_wraith"},
		{"the-don", "mobster/the_don"},
	}
	for _, test := range tests {
		enemy, err := defaultMonsterCatalog.NewEnemy("e", test.monster, MonsterScaling{Depth: 1, PartySize: 2})
		if err != nil {
			t.Fatal(err)
		}
		if enemy.SpriteID != test.sprite {
			t.Errorf("%s: sprite %q, want %q", test.monster, enemy.SpriteID, test.sprite)
		}
	}
}

func TestMonsterCatalogRejectsMissingOrWrongArt(t *testing.T) {
	cases := map[string]func(*MonsterCatalog){
		"no art": func(c *MonsterCatalog) {
			m := c.Monsters["ice-wraith"]
			m.Sprite = art.SpriteID{}
			c.Monsters["ice-wraith"] = m
		},
		"boss with a monster sprite": func(c *MonsterCatalog) {
			m := c.Monsters["the-don"]
			m.Sprite = art.MobsterGoonGunner
			c.Monsters["the-don"] = m
		},
		"undefined behavior": func(c *MonsterCatalog) {
			m := c.Monsters["ice-wraith"]
			m.BehaviorID = "nobody"
			c.Monsters["ice-wraith"] = m
		},
	}
	for name, mutate := range cases {
		t.Run(name, func(t *testing.T) {
			catalog := newMonsterCatalog()
			mutate(&catalog)
			if err := catalog.Validate(); err == nil {
				t.Fatal("expected validation to fail")
			}
		})
	}
}

func TestDungeonThemeCatalogRejectsInconsistentContent(t *testing.T) {
	t.Run("orphaned sprite", func(t *testing.T) {
		monsters := newMonsterCatalog()
		delete(monsters.Monsters, "ice-wraith")
		if err := defaultDungeonThemeCatalog.Validate(monsters, defaultEncounterCatalog); err == nil {
			t.Fatal("expected a sprite with no monster to be rejected")
		}
	})
	t.Run("encounter spawns another theme's monster", func(t *testing.T) {
		encounters := newEncounterCatalog()
		encounter := encounters.Encounters["arctic-outpost"]
		encounter.Enemies = []EncounterMonsterDefinition{{ID: "slot-a", MonsterID: "goon-gunner", BudgetCost: encounter.Budget}}
		encounters.Encounters["arctic-outpost"] = encounter
		if err := defaultDungeonThemeCatalog.Validate(defaultMonsterCatalog, encounters); err == nil || !strings.Contains(err.Error(), "arctic-outpost") {
			t.Fatalf("expected a theme mismatch error, got %v", err)
		}
	})
	t.Run("unknown theme", func(t *testing.T) {
		encounters := newEncounterCatalog()
		encounter := encounters.Encounters["arctic-outpost"]
		encounter.ThemeID = "atlantis"
		encounters.Encounters["arctic-outpost"] = encounter
		if err := defaultDungeonThemeCatalog.Validate(defaultMonsterCatalog, encounters); err == nil {
			t.Fatal("expected an unknown theme to be rejected")
		}
	})
	t.Run("theme without a boss encounter", func(t *testing.T) {
		encounters := newEncounterCatalog()
		for id := range encounters.Encounters {
			if strings.HasPrefix(id, "arctic-boss-") {
				delete(encounters.Encounters, id)
			}
		}
		if err := defaultDungeonThemeCatalog.Validate(defaultMonsterCatalog, encounters); err == nil {
			t.Fatal("expected a theme with no boss encounter to be rejected")
		}
	})
	t.Run("theme not backed by matching art", func(t *testing.T) {
		catalog := newDungeonThemeCatalog()
		theme := catalog.Themes["arctic"]
		theme.Art = art.ThemeScifi
		catalog.Themes["arctic"] = theme
		if err := catalog.Validate(defaultMonsterCatalog, defaultEncounterCatalog); err == nil {
			t.Fatal("expected a theme with the wrong art to be rejected")
		}
	})
}

// A theme is playable exactly when it has expedition content, and every theme with art is now playable.
func TestPlayableThemesMatchExpeditionContent(t *testing.T) {
	for _, id := range defaultDungeonThemeCatalog.IDs() {
		theme, err := defaultDungeonThemeCatalog.Theme(id)
		if err != nil {
			t.Fatal(err)
		}
		_, err = defaultExpeditionThemeCatalog.Theme(id)
		if theme.Playable != (err == nil) {
			t.Errorf("theme %q playable=%v but has expedition content=%v", id, theme.Playable, err == nil)
		}
		if !theme.Playable {
			t.Errorf("theme %q has art, monsters and bosses but cannot be played", id)
		}
	}
	if got := len(PlayableDungeonThemes()); got != 13 {
		t.Errorf("playable themes = %d, want all 13 ordinary themes", got)
	}
	if got := len(CapstoneDungeonThemes()); got != 2 {
		t.Errorf("capstone castles = %d, want 2", got)
	}
}
