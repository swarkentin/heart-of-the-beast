package game

import (
	"fmt"
	"math/rand"
)

// FloorTemplate is the authored room content for one dungeon theme. The generator shares one topology across
// themes (entry, two alternative routes, an event room, a guard room, a boss room and an optional miniboss
// branch) and fills it from the template, so a new playable theme is data rather than a new generator.
// Seeded randomness only chooses among authored options: it never invents prose or mechanics.
type FloorTemplate struct {
	ThemeID string

	Entry FloorRoomTemplate
	// EntryExits describe the two routes leaving the entry, in order: left, right.
	EntryExits       [2]ExitTemplate
	EntryEncounterID string

	// LeftNames are alternative names for the left route room, chosen by the seed.
	LeftNames       []string
	LeftDescription string
	Right           FloorRoomTemplate
	// RouteEncounters are the two authored (left, right) encounter pairs; the seed picks the pair.
	RouteEncounters [2][2]string
	// ShrineExitLabel labels the exit from each route room to the event room.
	ShrineExitLabel string

	Shrine FloorRoomTemplate
	// ShrineEvents are alternative events for the event room, chosen by the seed when there is more than one.
	ShrineEvents []FloorEventTemplate

	Guard            FloorRoomTemplate
	GuardEncounterID string
	GuardExitLabel   string

	// Bosses are ordered by depth. Depth i uses Bosses[min(i-1, len-2)]; the final depth uses the last entry.
	Bosses []FloorBossTemplate

	Miniboss FloorMinibossTemplate

	// ClearedText is the victory message when the final boss falls.
	ClearedText string
}

type FloorRoomTemplate struct {
	Name        string
	Description string
}

type ExitTemplate struct {
	Label       string
	Description string
}

type FloorEventTemplate struct {
	Title       string
	Description string
	Choices     []EventChoice
}

type FloorBossTemplate struct {
	RoomName    string
	Description string
	EncounterID string
}

type FloorMinibossTemplate struct {
	// Chance is the percent probability, per floor, that the optional miniboss branch exists.
	Chance      int
	EncounterID string
	Name        string
	Description string
	// ChallengeExit is the exit from the event room into the miniboss room.
	ChallengeExit ExitTemplate
	// RejoinLabel labels the exit from the miniboss room back to the boss room.
	RejoinLabel string
}

type FloorTemplateCatalog struct {
	Templates map[string]FloorTemplate
}

var defaultFloorTemplateCatalog = newFloorTemplateCatalog()

func newFloorTemplateCatalog() FloorTemplateCatalog {
	templates := []FloorTemplate{catacombsFloorTemplate(), scifiFloorTemplate()}
	catalog := FloorTemplateCatalog{Templates: make(map[string]FloorTemplate, len(templates))}
	for _, template := range templates {
		if _, duplicate := catalog.Templates[template.ThemeID]; duplicate {
			panic(fmt.Sprintf("duplicate built-in floor template %q", template.ThemeID))
		}
		catalog.Templates[template.ThemeID] = template
	}
	return catalog
}

func (catalog FloorTemplateCatalog) Template(themeID string) (FloorTemplate, error) {
	template, ok := catalog.Templates[themeID]
	if !ok {
		return FloorTemplate{}, fmt.Errorf("no floor template for dungeon theme %q", themeID)
	}
	return template, nil
}

// encounterIDs lists every encounter a template can place on a floor.
func (template FloorTemplate) encounterIDs() []string {
	ids := []string{template.EntryEncounterID, template.GuardEncounterID, template.Miniboss.EncounterID}
	for _, pair := range template.RouteEncounters {
		ids = append(ids, pair[0], pair[1])
	}
	for _, boss := range template.Bosses {
		ids = append(ids, boss.EncounterID)
	}
	return ids
}

// Validate checks every playable theme has a template, and every template only places encounters that exist,
// belong to its theme, and (for bosses) spawn a boss monster.
func (catalog FloorTemplateCatalog) Validate(themes DungeonThemeCatalog, encounters EncounterCatalog, monsters MonsterCatalog) error {
	for _, themeID := range themes.IDs() {
		theme, _ := themes.Theme(themeID)
		if _, ok := catalog.Templates[themeID]; theme.Playable && !ok {
			return fmt.Errorf("playable dungeon theme %q has no floor template", themeID)
		}
	}
	for themeID, template := range catalog.Templates {
		theme, err := themes.Theme(themeID)
		if err != nil || template.ThemeID != themeID {
			return fmt.Errorf("floor template %q does not match a dungeon theme", themeID)
		}
		if !theme.Playable {
			return fmt.Errorf("floor template %q belongs to a theme that is not marked playable", themeID)
		}
		if len(template.LeftNames) == 0 || len(template.ShrineEvents) == 0 || len(template.Bosses) == 0 || template.ClearedText == "" {
			return fmt.Errorf("floor template %q is incomplete", themeID)
		}
		if template.Miniboss.Chance < 0 || template.Miniboss.Chance > 100 {
			return fmt.Errorf("floor template %q has an invalid miniboss chance", themeID)
		}
		for _, event := range template.ShrineEvents {
			if len(event.Choices) < 2 {
				return fmt.Errorf("floor template %q has an event with fewer than two choices", themeID)
			}
			for _, choice := range event.Choices {
				if _, ok := defaultRunEffectCatalog.Effect(choice.Effect); !ok {
					return fmt.Errorf("floor template %q event choice %q uses unknown effect %q", themeID, choice.ID, choice.Effect)
				}
			}
		}
		for _, id := range template.encounterIDs() {
			encounter, err := encounters.Encounter(id)
			if err != nil {
				return fmt.Errorf("floor template %q: %w", themeID, err)
			}
			if encounter.ThemeID != themeID {
				return fmt.Errorf("floor template %q places encounter %q from theme %q", themeID, id, encounter.ThemeID)
			}
		}
		for _, boss := range template.Bosses {
			encounter, _ := encounters.Encounter(boss.EncounterID)
			hasBoss := false
			for _, spawn := range encounter.Enemies {
				if monster, err := monsters.Monster(spawn.MonsterID); err == nil && monster.Role == MonsterRoleBoss {
					hasBoss = true
				}
			}
			if !hasBoss {
				return fmt.Errorf("floor template %q boss encounter %q has no boss monster", themeID, boss.EncounterID)
			}
		}
	}
	return nil
}

// clearedText is the victory message for a theme's final boss.
func clearedText(themeID string) string {
	if template, err := defaultFloorTemplateCatalog.Template(themeID); err == nil {
		return template.ClearedText
	}
	return "The final guardian falls. The dungeon is cleared!"
}

// bossForDepth returns the boss template for a floor.
func (template FloorTemplate) bossForDepth(depth int) FloorBossTemplate {
	if depth >= MaximumDungeonDepth || len(template.Bosses) == 1 {
		return template.Bosses[len(template.Bosses)-1]
	}
	index := depth - 1
	if index > len(template.Bosses)-2 {
		index = len(template.Bosses) - 2
	}
	if index < 0 {
		index = 0
	}
	return template.Bosses[index]
}

// generateThemedFloor builds one floor from a template. The seed and depth fully determine its routes, event,
// optional miniboss and boss. The first three random draws (route name, miniboss roll, route order) are in a
// fixed order that predates themes, so the Catacombs template reproduces its original floors exactly.
func generateThemedFloor(template FloorTemplate, seed uint64, depth, partySize int) (string, map[string]*DungeonRoom) {
	rng := rand.New(rand.NewSource(int64(seed + uint64(depth)*0x9e3779b97f4a7c15)))
	prefix := fmt.Sprintf("d%d-", depth)
	floor := fmt.Sprintf("%02d", depth)
	scaling := MonsterScaling{Depth: depth, PartySize: partySize}
	routeName := template.LeftNames[rng.Intn(len(template.LeftNames))]
	hasMiniboss := rng.Intn(100) < template.Miniboss.Chance
	routes := template.RouteEncounters[0]
	if rng.Intn(2) == 0 {
		routes = template.RouteEncounters[1]
	}
	leftEncounterID, rightEncounterID := routes[0], routes[1]
	event := template.ShrineEvents[0]
	if len(template.ShrineEvents) > 1 {
		event = template.ShrineEvents[rng.Intn(len(template.ShrineEvents))]
	}
	boss := template.bossForDepth(depth)
	themeID := template.ThemeID
	rooms := map[string]*DungeonRoom{
		prefix + "entry": {
			ID: prefix + "entry", ThemeID: themeID, Name: template.Entry.Name, Floor: floor, RoomType: "encounter",
			Description: template.Entry.Description,
			Exits: []Exit{
				{ID: "left", Destination: prefix + "left", Label: template.EntryExits[0].Label, Description: template.EntryExits[0].Description},
				{ID: "right", Destination: prefix + "right", Label: template.EntryExits[1].Label, Description: template.EntryExits[1].Description},
			},
			Encounter: newCatalogEncounter(template.EntryEncounterID, prefix, scaling),
		},
		prefix + "left": {
			ID: prefix + "left", ThemeID: themeID, Name: routeName, Floor: floor, RoomType: "encounter",
			Description: template.LeftDescription,
			Exits:       []Exit{{ID: "forward", Destination: prefix + "shrine", Label: template.ShrineExitLabel}},
			Encounter:   newCatalogEncounter(leftEncounterID, prefix, scaling),
		},
		prefix + "right": {
			ID: prefix + "right", ThemeID: themeID, Name: template.Right.Name, Floor: floor, RoomType: "encounter",
			Description: template.Right.Description,
			Exits:       []Exit{{ID: "forward", Destination: prefix + "shrine", Label: template.ShrineExitLabel}},
			Encounter:   newCatalogEncounter(rightEncounterID, prefix, scaling),
		},
		prefix + "shrine": {
			ID: prefix + "shrine", ThemeID: themeID, Name: template.Shrine.Name, Floor: floor, RoomType: "event",
			Description: template.Shrine.Description,
			Exits:       []Exit{{ID: "deeper", Destination: prefix + "guard", Label: template.Guard.Name}},
			Event:       &RoomEvent{ID: prefix + "shrine-event", Title: event.Title, Description: event.Description, Choices: append([]EventChoice(nil), event.Choices...)},
		},
		prefix + "guard": {
			ID: prefix + "guard", ThemeID: themeID, Name: template.Guard.Name, Floor: floor, RoomType: "encounter",
			Description: template.Guard.Description,
			Exits:       []Exit{{ID: "down", Destination: prefix + "boss", Label: template.GuardExitLabel}},
			Encounter:   newCatalogEncounter(template.GuardEncounterID, prefix, scaling),
		},
		prefix + "boss": {
			ID: prefix + "boss", ThemeID: themeID, Name: boss.RoomName, Floor: floor, RoomType: "boss",
			Description: boss.Description,
			Encounter:   newCatalogEncounter(boss.EncounterID, prefix, scaling),
		},
	}
	if hasMiniboss {
		mini := template.Miniboss
		rooms[prefix+"shrine"].Exits = append(rooms[prefix+"shrine"].Exits, Exit{ID: "challenge", Destination: prefix + "miniboss", Label: mini.ChallengeExit.Label, Description: mini.ChallengeExit.Description})
		rooms[prefix+"miniboss"] = &DungeonRoom{ID: prefix + "miniboss", ThemeID: themeID, Name: mini.Name, Floor: floor, RoomType: "miniboss", Description: mini.Description, Exits: []Exit{{ID: "rejoin", Destination: prefix + "boss", Label: mini.RejoinLabel}}, Encounter: newCatalogEncounter(mini.EncounterID, prefix, scaling)}
	}
	return prefix + "entry", rooms
}
