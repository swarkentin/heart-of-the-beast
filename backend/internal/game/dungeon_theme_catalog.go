package game

import (
	"fmt"
	"sort"

	"github.com/swarkentin/heart-of-the-beast/backend/internal/art"
)

// DungeonThemeDefinition is an authored dungeon theme. Each theme is backed by one pixel-art theme, and the
// monsters and encounters that belong to it are the ones whose art comes from that theme.
type DungeonThemeDefinition struct {
	// ID is the stable theme identifier. It matches the art theme folder name and EncounterDefinition.ThemeID.
	ID      string
	Name    string
	Tagline string
	// Art is the pixel-art theme. Use the generated art.Theme* variables; a theme without art does not compile.
	Art art.ThemeID
	// Playable themes have expedition content (see ExpeditionThemeCatalog) and can be chosen when starting a run.
	Playable bool
}

type DungeonThemeCatalog struct {
	Themes map[string]DungeonThemeDefinition
	// order is the authored presentation order.
	order []string
}

var defaultDungeonThemeCatalog = newDungeonThemeCatalog()

func newDungeonThemeCatalog() DungeonThemeCatalog {
	definitions := []DungeonThemeDefinition{
		{ID: "catacombs", Name: "Forgotten Catacombs", Tagline: "Ancient ruins, undead, and forgotten horrors", Art: art.ThemeCatacombs, Playable: true},
		{ID: "scifi", Name: "Sci-Fi Research Facility", Tagline: "High-tech experiments and rogue AI", Art: art.ThemeScifi, Playable: true},
		{ID: "mobster", Name: "1930s Mobster Underworld", Tagline: "Crime, corruption and organized chaos", Art: art.ThemeMobster, Playable: true},
		{ID: "sunken", Name: "Sunken Kingdom", Tagline: "Lost cities and aquatic horrors", Art: art.ThemeSunken, Playable: true},
		{ID: "clockwork", Name: "Clockwork Empire", Tagline: "Machines, precision and steam power", Art: art.ThemeClockwork, Playable: true},
		{ID: "carnival", Name: "Haunted Carnival", Tagline: "A twisted show where nightmares perform", Art: art.ThemeCarnival, Playable: true},
		{ID: "jungle", Name: "Alien Jungle", Tagline: "Bioluminescent predators and strange organic life", Art: art.ThemeJungle, Playable: true},
		{ID: "dreamscape", Name: "Dreamscapes", Tagline: "Surreal creatures whose shapes obey no rules", Art: art.ThemeDreamscape, Playable: true},
		{ID: "arctic", Name: "Arctic Station", Tagline: "Frozen experiments, ice creatures and abandoned technology", Art: art.ThemeArctic, Playable: true},
		{ID: "ghosttown", Name: "Ghost Town", Tagline: "Western frontier atmosphere, revenants and cursed settlements", Art: art.ThemeGhosttown, Playable: true},
		{ID: "wasteland", Name: "Post-Apocalyptic Settlement", Tagline: "Scavengers, improvised machines and mutated wildlife", Art: art.ThemeWasteland, Playable: true},
	}
	themes := make(map[string]DungeonThemeDefinition, len(definitions))
	order := make([]string, 0, len(definitions))
	for _, definition := range definitions {
		if _, duplicate := themes[definition.ID]; duplicate {
			panic(fmt.Sprintf("duplicate built-in dungeon theme %q", definition.ID))
		}
		themes[definition.ID] = definition
		order = append(order, definition.ID)
	}
	return DungeonThemeCatalog{Themes: themes, order: order}
}

func (catalog DungeonThemeCatalog) Theme(id string) (DungeonThemeDefinition, error) {
	theme, ok := catalog.Themes[id]
	if !ok {
		return DungeonThemeDefinition{}, fmt.Errorf("unknown dungeon theme %q", id)
	}
	return theme, nil
}

// PlayableDungeonThemes returns the themes a run can be started in, in authored order.
func PlayableDungeonThemes() []DungeonThemeDefinition {
	var themes []DungeonThemeDefinition
	for _, id := range defaultDungeonThemeCatalog.order {
		if theme := defaultDungeonThemeCatalog.Themes[id]; theme.Playable {
			themes = append(themes, theme)
		}
	}
	return themes
}

// IDs returns theme IDs in authored order.
func (catalog DungeonThemeCatalog) IDs() []string { return append([]string(nil), catalog.order...) }

// MonsterIDs returns the IDs of every monster whose art belongs to the theme, sorted.
func (catalog DungeonThemeCatalog) MonsterIDs(themeID string, monsters MonsterCatalog) []string {
	theme, ok := catalog.Themes[themeID]
	if !ok {
		return nil
	}
	var ids []string
	for id, monster := range monsters.Monsters {
		if artTheme, _ := art.ThemeOf(monster.Sprite); artTheme == theme.Art {
			ids = append(ids, id)
		}
	}
	sort.Strings(ids)
	return ids
}

// Validate checks that the theme, monster and encounter catalogs agree with each other and with the art:
//   - themes are backed by distinct, known art themes, and every art theme is used by a theme;
//   - every sprite the art pipeline produced is used by at least one monster, so no art is orphaned;
//   - every encounter belongs to a known theme and only spawns monsters from that theme's art;
//   - every theme has at least one boss monster and one boss encounter, and every monster of a theme other
//     than the original Catacombs appears in at least one of its encounters.
func (catalog DungeonThemeCatalog) Validate(monsters MonsterCatalog, encounters EncounterCatalog) error {
	artThemes := make(map[art.ThemeID]string, len(catalog.Themes))
	for id, theme := range catalog.Themes {
		if id == "" || theme.ID != id || theme.Name == "" {
			return fmt.Errorf("invalid dungeon theme %q", id)
		}
		if !art.KnownTheme(theme.Art) || theme.Art.String() != id {
			return fmt.Errorf("dungeon theme %q is not backed by the art theme of the same name", id)
		}
		if previous, taken := artThemes[theme.Art]; taken {
			return fmt.Errorf("dungeon themes %q and %q share art theme %q", previous, id, theme.Art)
		}
		artThemes[theme.Art] = id
	}
	for _, theme := range art.Themes() {
		if _, ok := artThemes[theme.ID]; !ok {
			return fmt.Errorf("art theme %q has no dungeon theme", theme.ID)
		}
	}

	spriteUsed := make(map[art.SpriteID]bool, len(monsters.Monsters))
	bossMonsters := make(map[string]bool)
	for id, monster := range monsters.Monsters {
		spriteUsed[monster.Sprite] = true
		if monster.Role == MonsterRoleBoss {
			if theme, ok := art.ThemeOf(monster.Sprite); ok {
				bossMonsters[artThemes[theme]] = true
			}
		}
		if _, ok := art.ThemeOf(monster.Sprite); !ok {
			return fmt.Errorf("monster %q has no pixel art", id)
		}
	}
	for _, sprite := range art.Sprites() {
		if !spriteUsed[sprite.ID] {
			return fmt.Errorf("sprite %s (%s) is not used by any monster", sprite.ID, sprite.Name)
		}
	}

	bossEncounters := make(map[string]bool)
	spawned := make(map[string]bool)
	for id, encounter := range encounters.Encounters {
		theme, ok := catalog.Themes[encounter.ThemeID]
		if !ok {
			return fmt.Errorf("encounter %q belongs to unknown dungeon theme %q", id, encounter.ThemeID)
		}
		for _, spawn := range encounter.Enemies {
			for _, monsterID := range []string{spawn.MonsterID, spawn.SoloMonsterID} {
				if monsterID == "" {
					continue
				}
				monster, err := monsters.Monster(monsterID)
				if err != nil {
					return fmt.Errorf("encounter %q: %w", id, err)
				}
				if artTheme, _ := art.ThemeOf(monster.Sprite); artTheme != theme.Art {
					return fmt.Errorf("encounter %q is in theme %q but spawns %q, whose art is from theme %q", id, theme.ID, monsterID, artTheme)
				}
				spawned[monsterID] = true
				if monster.Role == MonsterRoleBoss {
					bossEncounters[theme.ID] = true
				}
			}
		}
	}
	for id, theme := range catalog.Themes {
		if !bossEncounters[id] || !bossMonsters[id] {
			return fmt.Errorf("dungeon theme %q needs a boss monster and a boss encounter", id)
		}
		if id == "catacombs" {
			continue
		}
		for _, monsterID := range catalog.MonsterIDs(id, monsters) {
			if !spawned[monsterID] {
				return fmt.Errorf("monster %q of theme %q appears in no encounter", monsterID, theme.ID)
			}
		}
	}
	return nil
}
