package game

import (
	"fmt"
	"math/rand"
)

// ExpeditionTheme is the authored content the expedition floor generator draws on for one dungeon theme. The
// generator decides the shape of a floor (how many rooms, how they connect, what kind each is); the theme
// supplies every name, line of prose, encounter and choice. Seeded randomness only ever picks among authored
// options.
type ExpeditionTheme struct {
	ThemeID string

	// Entries are alternative first rooms of a floor. Every floor opens with a light fight.
	Entries []FloorRoomTemplate
	// Halls are the ordinary encounter rooms. A floor uses up to MaxHallsPerFloor of them without repeating.
	Halls []FloorRoomTemplate
	// Discoveries are rooms with a choice instead of a fight. Every choice that gives something costs something.
	Discoveries []DiscoveryTemplate
	// Vault is the treasure room: safe coin, or a gamble on a relic.
	Vault DiscoveryTemplate
	// Elite is the optional champion room: a hard fight for a party-wide reward.
	Elite FloorRoomTemplate
	// Guard is the last room before the floor's boss.
	Guard FloorRoomTemplate

	// Light encounters open a floor. Standard and Heavy fill its halls; Heavy also holds the guard room. Elite is
	// fought in the champion room with extra health.
	Light    []string
	Standard []string
	Heavy    []string
	EliteID  string

	// Guardians are the bosses of every floor but the last, used in rotation.
	Guardians []FloorBossTemplate
	// ArmedGuardians, when set, replace Guardians with floor bosses that have mechanics of their own. Only the
	// capstone castles use them: there, every boss is a fight with rules.
	ArmedGuardians []FinalBossTemplate
	// Final is the dungeon boss on the last floor, with the mechanics that set it apart.
	Final FinalBossTemplate
	// Lair is the optional lair boss some floors hold (theme_variety.go). It does not enrage.
	Lair FinalBossTemplate

	ClearedText string
}

const DiscoveryHerbChance = 20 // percent chance that a generated discovery room offers the risky herb cache

type DiscoveryTemplate struct {
	Room  FloorRoomTemplate
	Event FloorEventTemplate
}

// FinalBossTemplate is the boss at the bottom of a dungeon. Mechanics are boss mechanic IDs (boss_mechanics.go);
// every dungeon boss also enrages. BarrierLabel and CataclysmLabel name those two moves, and SummonMonsterID is
// the reinforcement a summoning boss calls.
type FinalBossTemplate struct {
	FloorBossTemplate
	Mechanics       []string
	BarrierLabel    string
	CataclysmLabel  string
	SummonMonsterID string
	// AnchorMonsterID, RebirthLabel and LegionMonsterID configure the capstone mechanics (capstone.go).
	AnchorMonsterID string
	RebirthLabel    string
	LegionMonsterID string
}

const (
	// MaxHallsPerFloor is the most ordinary encounter rooms the middle of a floor can hold.
	MaxHallsPerFloor = 5
	// EliteHealthPercent is the extra health of a champion-room encounter.
	EliteHealthPercent = 30
	// FinalBossHealthPercent is the extra health of the dungeon boss.
	FinalBossHealthPercent = 30
)

type ExpeditionThemeCatalog struct {
	Themes map[string]ExpeditionTheme
}

var defaultExpeditionThemeCatalog = newExpeditionThemeCatalog()

func newExpeditionThemeCatalog() ExpeditionThemeCatalog {
	catalog := ExpeditionThemeCatalog{Themes: make(map[string]ExpeditionTheme)}
	for _, theme := range append(expeditionThemes(), newExpeditionThemes()...) {
		if _, duplicate := catalog.Themes[theme.ThemeID]; duplicate {
			panic(fmt.Sprintf("duplicate built-in expedition theme %q", theme.ThemeID))
		}
		if variety, ok := themeVarieties[theme.ThemeID]; ok {
			theme.Standard = append(append([]string(nil), theme.Standard...), variety.Standard...)
			theme.Heavy = append(append([]string(nil), theme.Heavy...), variety.Heavy...)
			theme.Lair = variety.Lair
		}
		if len(theme.ArmedGuardians) > 0 {
			theme.Guardians = make([]FloorBossTemplate, 0, len(theme.ArmedGuardians))
			for _, armed := range theme.ArmedGuardians {
				theme.Guardians = append(theme.Guardians, armed.FloorBossTemplate)
			}
		}
		catalog.Themes[theme.ThemeID] = theme
	}
	return catalog
}

func (catalog ExpeditionThemeCatalog) Theme(themeID string) (ExpeditionTheme, error) {
	theme, ok := catalog.Themes[themeID]
	if !ok {
		return ExpeditionTheme{}, fmt.Errorf("no expedition content for dungeon theme %q", themeID)
	}
	return theme, nil
}

func (theme ExpeditionTheme) encounterIDs() []string {
	ids := append([]string{theme.EliteID, theme.Final.EncounterID, theme.Lair.EncounterID}, theme.Light...)
	ids = append(ids, theme.Standard...)
	ids = append(ids, theme.Heavy...)
	for _, boss := range theme.Guardians {
		ids = append(ids, boss.EncounterID)
	}
	return ids
}

// Validate checks that every playable theme has complete expedition content, and that the content only places
// encounters of its own theme, real effects, real boss mechanics and rooms the art can draw.
func (catalog ExpeditionThemeCatalog) Validate(themes DungeonThemeCatalog, encounters EncounterCatalog, monsters MonsterCatalog) error {
	for _, themeID := range themes.IDs() {
		theme, _ := themes.Theme(themeID)
		if _, ok := catalog.Themes[themeID]; theme.Playable != ok {
			return fmt.Errorf("dungeon theme %q: playable is %v but expedition content present is %v", themeID, theme.Playable, ok)
		}
	}
	for themeID, content := range catalog.Themes {
		theme, err := themes.Theme(themeID)
		if err != nil || content.ThemeID != themeID {
			return fmt.Errorf("expedition content %q does not match a dungeon theme", themeID)
		}
		if err := validateBackdrops(theme); err != nil {
			return err
		}
		if len(content.Entries) == 0 || len(content.Halls) < MaxHallsPerFloor || len(content.Discoveries) < 2 || len(content.Light) == 0 || len(content.Standard) == 0 || len(content.Heavy) == 0 || len(content.Guardians) == 0 || content.ClearedText == "" {
			return fmt.Errorf("expedition content %q is incomplete", themeID)
		}
		rooms := append(append([]FloorRoomTemplate{content.Vault.Room, content.Elite, content.Guard, content.Final.FloorBossTemplate.room(), content.Lair.FloorBossTemplate.room()}, content.Entries...), content.Halls...)
		for _, guardian := range content.Guardians {
			rooms = append(rooms, guardian.room())
		}
		events := []FloorEventTemplate{content.Vault.Event}
		for _, discovery := range content.Discoveries {
			rooms = append(rooms, discovery.Room)
			events = append(events, discovery.Event)
		}
		names := make(map[string]bool, len(rooms))
		for _, room := range rooms {
			if room.Name == "" || room.Description == "" || names[room.Name] {
				return fmt.Errorf("expedition content %q has an unnamed, undescribed or duplicate room %q", themeID, room.Name)
			}
			names[room.Name] = true
		}
		for _, event := range events {
			if event.Title == "" || event.Description == "" || len(event.Choices) < 2 {
				return fmt.Errorf("expedition content %q has an incomplete event %q", themeID, event.Title)
			}
			free, seen := false, make(map[string]bool, len(event.Choices))
			for _, choice := range event.Choices {
				effect, ok := defaultRunEffectCatalog.Effect(choice.Effect)
				if !ok || choice.ID == "" || seen[choice.ID] || choice.Label == "" || choice.Description == "" {
					return fmt.Errorf("expedition content %q event %q has an invalid choice %q", themeID, event.Title, choice.ID)
				}
				seen[choice.ID] = true
				if effect.Kind == RunEffectNone && len(effect.Operations) == 0 {
					free = true
				}
			}
			if !free {
				return fmt.Errorf("expedition content %q event %q has no way to walk away", themeID, event.Title)
			}
		}
		for _, id := range content.encounterIDs() {
			encounter, err := encounters.Encounter(id)
			if err != nil {
				return fmt.Errorf("expedition content %q: %w", themeID, err)
			}
			if encounter.ThemeID != themeID {
				return fmt.Errorf("expedition content %q places encounter %q from theme %q", themeID, id, encounter.ThemeID)
			}
		}
		for _, boss := range append(append([]FloorBossTemplate(nil), content.Guardians...), content.Final.FloorBossTemplate, content.Lair.FloorBossTemplate) {
			if !encounterHasBoss(encounters, monsters, boss.EncounterID) {
				return fmt.Errorf("expedition content %q boss encounter %q has no boss monster", themeID, boss.EncounterID)
			}
		}
		if err := validateBossMechanics(content.Final, themes, monsters, themeID); err != nil {
			return fmt.Errorf("expedition content %q: %w", themeID, err)
		}
		if err := validateBossMechanics(content.Lair, themes, monsters, themeID); err != nil {
			return fmt.Errorf("expedition content %q lair: %w", themeID, err)
		}
		for _, armed := range content.ArmedGuardians {
			if err := validateBossMechanics(armed, themes, monsters, themeID); err != nil {
				return fmt.Errorf("expedition content %q guardian: %w", themeID, err)
			}
		}
		if theme.Capstone != (len(content.ArmedGuardians) > 0) {
			return fmt.Errorf("expedition content %q: capstone castles, and only they, arm their floor guardians", themeID)
		}
	}
	return nil
}

func (boss FloorBossTemplate) room() FloorRoomTemplate {
	return FloorRoomTemplate{Name: boss.RoomName, Description: boss.Description}
}

func encounterHasBoss(encounters EncounterCatalog, monsters MonsterCatalog, encounterID string) bool {
	encounter, err := encounters.Encounter(encounterID)
	if err != nil {
		return false
	}
	for _, spawn := range encounter.Enemies {
		if monster, err := monsters.Monster(spawn.MonsterID); err == nil && monster.Role == MonsterRoleBoss {
			return true
		}
	}
	return false
}

// floorShapes are the widths of the middle layers of a floor, between its entry and its guard room. Every room of
// a layer leads to one or two rooms of the next, so a shape is also the number of route decisions on the floor.
// No shape has more than six middle rooms, which keeps a floor inside its three-to-five minute target.
var floorShapes = [][]int{{2, 2}, {3, 2}, {2, 3}, {2, 1, 2}, {2, 2, 2}, {3, 2, 1}, {2, 3, 1}}

type floorRoomKind string

const (
	floorRoomHall      floorRoomKind = "encounter"
	floorRoomDiscovery floorRoomKind = "event"
	floorRoomVault     floorRoomKind = "reward"
	floorRoomElite     floorRoomKind = "miniboss"
	floorRoomLair      floorRoomKind = "lair"
)

// exitHints tell the party what kind of room a path leads to, so choosing a route is a decision and not a guess.
var exitHints = map[string]string{
	"light":    "A light fight. Little risk, little gold.",
	"standard": "A fight. Steady gold and experience.",
	"heavy":    "A hard fight. More gold for the trouble.",
	"event":    "No fight. A discovery, and every gift there has a price.",
	"reward":   "No fight. A sealed vault: safe coin, or a gamble.",
	"miniboss": "A champion. A dangerous fight that strengthens the whole party.",
	"lair":     "A lair. An optional boss with tricks of its own, guarding a rich reward.",
	"guard":    "The last defenders before this floor's guardian.",
	"boss":     "The guardian of this floor.",
	"final":    "The master of this dungeon. There is no way back.",
}

// generateExpeditionFloor builds one floor of an expedition. The theme, seed, depth, final depth, party size and
// modifiers fully determine it. Room IDs are "d<depth>-entry", "d<depth>-m<layer><index>", "d<depth>-guard" and
// "d<depth>-boss".
//
// extraDepth, if given, is added to the depth enemies are scaled for: later dungeons of an expedition are harder
// than their floor number alone says.
func generateExpeditionFloor(themeID string, seed uint64, depth, maxDepth, partySize int, modifiers []ActiveFloorModifier, extraDepth ...int) (string, map[string]*DungeonRoom) {
	theme, err := defaultExpeditionThemeCatalog.Theme(themeID)
	if err != nil {
		panic(err.Error())
	}
	rng := rand.New(rand.NewSource(int64(mixSeed(seed, uint64(depth), 0xd06e0))))
	prefix := fmt.Sprintf("d%d-", depth)
	floor := fmt.Sprintf("%02d", depth)
	scaling := MonsterScaling{Depth: depth, PartySize: partySize}
	for _, extra := range extraDepth {
		scaling.Depth += extra
	}
	healthPct := sumFloorModifiers(modifiers).EnemyHealthPct
	final := depth >= maxDepth

	encounter := func(roomID, encounterID string, extraHealthPct int) *Encounter {
		instance := newCatalogEncounter(encounterID, roomID+"-", scaling)
		scaleEncounterHealth(instance, healthPct+extraHealthPct)
		return instance
	}
	pick := func(ids []string) string { return ids[rng.Intn(len(ids))] }

	// 1. Shape, and what kind of room sits in each slot of the middle layers.
	// The finale is deliberately a compact gauntlet: entry, one signature bonus room, then the boss.
	shape := floorShapes[rng.Intn(len(floorShapes))]
	if final {
		shape = []int{1}
	}
	type slot struct {
		layer, index int
		kind         floorRoomKind
	}
	var slots []slot
	for layer, width := range shape {
		for index := 0; index < width; index++ {
			slots = append(slots, slot{layer: layer, index: index, kind: floorRoomHall})
		}
	}
	// Every layer keeps at least one fight, so no route can skip the floor. The other slots are candidates for
	// the special rooms: always one discovery, then sometimes a second discovery, a vault and a champion.
	var candidates []int
	if final {
		candidates = []int{0}
	} else {
		for layer, width := range shape {
			keep := rng.Intn(width)
			for index := 0; index < width; index++ {
				if index != keep {
					candidates = append(candidates, slotIndex(shape, layer, index))
				}
			}
		}
		rng.Shuffle(len(candidates), func(i, j int) { candidates[i], candidates[j] = candidates[j], candidates[i] })
	}
	specials := []floorRoomKind{floorRoomDiscovery}
	if final {
		// Every finale has exactly one signature bonus room before its mandatory dungeon boss.
		// Its seeded type varies between a vault, champion, lair boss, or discovery/puzzle.
		bonusKinds := []floorRoomKind{floorRoomVault, floorRoomElite, floorRoomDiscovery}
		if theme.Lair.EncounterID != "" {
			bonusKinds = append(bonusKinds, floorRoomLair)
		}
		specials = []floorRoomKind{bonusKinds[rng.Intn(len(bonusKinds))]}
	} else {
		if rng.Intn(100) < 35+5*depth {
			specials = append(specials, floorRoomVault)
		}
		if rng.Intn(100) < 45 {
			specials = append(specials, floorRoomElite)
		}
		if rng.Intn(100) < 50 {
			specials = append(specials, floorRoomDiscovery)
		}
	}
	for i, kind := range specials {
		if i >= len(candidates) {
			break
		}
		slots[candidates[i]].kind = kind
	}
	// A lair takes a slot the special rooms left free. It is rolled with its own generator so adding lairs did not
	// reshape every other floor.
	lairRoll := rand.New(rand.NewSource(int64(mixSeed(seed, uint64(depth), 0x1a12))))
	if !final && theme.Lair.EncounterID != "" && depth >= 2 && len(candidates) > len(specials) && lairRoll.Intn(100) < LairChance {
		slots[candidates[len(specials)]].kind = floorRoomLair
	}

	// 2. Rooms.
	rooms := make(map[string]*DungeonRoom, len(slots)+3)
	hints := make(map[string]string, len(slots)+3)
	entryID, guardID, bossID := prefix+"entry", prefix+"guard", prefix+"boss"
	entry := theme.Entries[rng.Intn(len(theme.Entries))]
	rooms[entryID] = &DungeonRoom{ID: entryID, ThemeID: themeID, Name: entry.Name, Floor: floor, RoomType: "encounter", Description: entry.Description, Encounter: encounter(entryID, pick(theme.Light), 0)}

	halls := rng.Perm(len(theme.Halls))
	discoveries := rng.Perm(len(theme.Discoveries))
	heavyChance := 20 + 8*depth
	layers := make([][]string, len(shape))
	for _, placed := range slots {
		id := fmt.Sprintf("%sm%d%d", prefix, placed.layer+1, placed.index+1)
		layers[placed.layer] = append(layers[placed.layer], id)
		room := &DungeonRoom{ID: id, ThemeID: themeID, Floor: floor, RoomType: string(placed.kind)}
		hints[id] = string(placed.kind)
		switch placed.kind {
		case floorRoomDiscovery:
			discovery := theme.Discoveries[discoveries[0]]
			discoveries = discoveries[1:]
			room.Name, room.Description = discovery.Room.Name, discovery.Room.Description
			room.Event = newRoomEvent(id, discovery.Event)
			if int(mixSeed(seed, uint64(depth), hashString(id+"/herb-cache"))%100) < DiscoveryHerbChance {
				room.Event.Choices = append(room.Event.Choices, option("Trade blood for herbs", "herb_cache"))
			}
		case floorRoomVault:
			room.Name, room.Description = theme.Vault.Room.Name, theme.Vault.Room.Description
			room.Event = newRoomEvent(id, theme.Vault.Event)
		case floorRoomElite:
			room.Name, room.Description = theme.Elite.Name, theme.Elite.Description
			room.Encounter = encounter(id, theme.EliteID, EliteHealthPercent)
		case floorRoomLair:
			room.Name, room.Description = theme.Lair.RoomName, theme.Lair.Description
			room.Encounter = encounter(id, theme.Lair.EncounterID, 0)
			armLairBoss(room.Encounter, theme.Lair)
		default:
			hall := theme.Halls[halls[0]]
			halls = halls[1:]
			room.Name, room.Description = hall.Name, hall.Description
			if rng.Intn(100) < heavyChance {
				room.Encounter = encounter(id, pick(theme.Heavy), 0)
				hints[id] = "heavy"
			} else {
				room.Encounter = encounter(id, pick(theme.Standard), 0)
				hints[id] = "standard"
			}
		}
		rooms[id] = room
	}
	if !final {
		rooms[guardID] = &DungeonRoom{ID: guardID, ThemeID: themeID, Name: theme.Guard.Name, Floor: floor, RoomType: "encounter", Description: theme.Guard.Description, Encounter: encounter(guardID, pick(theme.Heavy), 0)}
		hints[guardID] = "guard"
	}

	boss := theme.Guardians[(depth-1)%len(theme.Guardians)]
	hints[bossID] = "boss"
	if final {
		boss = theme.Final.FloorBossTemplate
		hints[bossID] = "final"
	}
	rooms[bossID] = &DungeonRoom{ID: bossID, ThemeID: themeID, Name: boss.RoomName, Floor: floor, RoomType: "boss", Description: boss.Description}
	if final {
		rooms[bossID].Encounter = encounter(bossID, boss.EncounterID, FinalBossHealthPercent)
		armDungeonBoss(rooms[bossID].Encounter, theme.Final)
	} else {
		rooms[bossID].Encounter = encounter(bossID, boss.EncounterID, 0)
		if len(theme.ArmedGuardians) > 0 {
			armLairBoss(rooms[bossID].Encounter, theme.ArmedGuardians[(depth-1)%len(theme.ArmedGuardians)])
		}
	}

	// 3. Connections. Each room leads to the room across from it in the next layer, every room is reachable, and
	// about half the rooms with a single way on get a second.
	connect := func(from string, to ...string) {
		room := rooms[from]
		for _, destination := range to {
			if roomLeadsTo(room, destination) || len(room.Exits) >= 3 {
				continue
			}
			target := rooms[destination]
			room.Exits = append(room.Exits, Exit{ID: fmt.Sprintf("path-%d", len(room.Exits)+1), Destination: destination, Label: target.Name, Description: exitHints[hints[destination]]})
		}
	}
	connect(entryID, layers[0]...)
	for layer := 0; layer+1 < len(layers); layer++ {
		from, to := layers[layer], layers[layer+1]
		reached := make(map[string]bool, len(to))
		for index, id := range from {
			across := 0
			if len(from) > 1 {
				across = (index*(len(to)-1)*2 + len(from) - 1) / ((len(from) - 1) * 2)
			}
			connect(id, to[across])
			reached[to[across]] = true
			if neighbour := across + 1 - 2*rng.Intn(2); neighbour >= 0 && neighbour < len(to) && rng.Intn(100) < 50 {
				connect(id, to[neighbour])
				reached[to[neighbour]] = true
			}
		}
		for index, id := range to {
			if !reached[id] {
				connect(from[index*len(from)/len(to)], id)
			}
		}
	}
	if final {
		for _, id := range layers[len(layers)-1] {
			connect(id, bossID)
		}
	} else {
		for _, id := range layers[len(layers)-1] {
			connect(id, guardID)
		}
		connect(guardID, bossID)
	}
	return entryID, rooms
}

func slotIndex(shape []int, layer, index int) int {
	offset := 0
	for i := 0; i < layer; i++ {
		offset += shape[i]
	}
	return offset + index
}

func roomLeadsTo(room *DungeonRoom, destination string) bool {
	for _, exit := range room.Exits {
		if exit.Destination == destination {
			return true
		}
	}
	return false
}

func newRoomEvent(roomID string, event FloorEventTemplate) *RoomEvent {
	return &RoomEvent{ID: roomID + "-event", Title: event.Title, Description: event.Description, Choices: append([]EventChoice(nil), event.Choices...)}
}

// scaleEncounterHealth changes the health of every enemy in an encounter by a percentage.
func scaleEncounterHealth(encounter *Encounter, percent int) {
	if percent == 0 {
		return
	}
	for i := range encounter.Enemies {
		health := (encounter.Enemies[i].MaxHealth*(100+percent) + 50) / 100
		if health < 1 {
			health = 1
		}
		encounter.Enemies[i].Health, encounter.Enemies[i].MaxHealth = health, health
	}
}
