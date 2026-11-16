package game

import (
	"errors"
	"fmt"
	"hash/fnv"
	"math/rand"
	"sort"
	"strings"
	"time"
)

// An expedition is one dungeon: four to six generated floors in one theme, each ending in a guardian, with a
// camp between floors and the dungeon's boss at the bottom. Floors below the first carry level-wide modifiers.

const (
	// ExpeditionGenerator is the Run.Generator value of expedition runs.
	ExpeditionGenerator = 2
	// MinimumExpeditionDepth and MaximumExpeditionDepth bound the number of floors in a dungeon.
	MinimumExpeditionDepth = 4
	MaximumExpeditionDepth = 6
	// RandomDungeonThemeID asks StartMultiLevelRunForTheme to choose a playable theme from the run seed.
	RandomDungeonThemeID = "random"
)

// expeditionDepth is the number of floors in the dungeon a seed describes.
func expeditionDepth(seed uint64) int {
	return MinimumExpeditionDepth + int(mixSeed(seed, 0, 0xdee9)%uint64(MaximumExpeditionDepth-MinimumExpeditionDepth+1))
}

func runSeed(runID string) uint64 {
	hash := fnv.New64a()
	_, _ = hash.Write([]byte(runID))
	return hash.Sum64()
}

// StartMultiLevelRunForTheme starts an expedition in a playable dungeon theme. An empty themeID means Forgotten
// Catacombs, and RandomDungeonThemeID lets the run seed choose. Every floor, the number of floors, and each
// floor's modifiers are generated from the run seed.
func StartMultiLevelRunForTheme(room *Room, runID, themeID string, now time.Time) error {
	if room.Run != nil {
		return ErrRunAlreadyStarted
	}
	if len(room.PlayerIDs) == 0 || runID == "" {
		return errors.New("room requires a player and run id")
	}
	return startExpeditionWithSeed(room, runID, themeID, runSeed(runID), now)
}

// startExpeditionWithSeed is StartMultiLevelRunForTheme with an explicit generation seed, for simulations.
func startExpeditionWithSeed(room *Room, runID, themeID string, seed uint64, now time.Time) error {
	if room.Run != nil {
		return ErrRunAlreadyStarted
	}
	switch themeID {
	case "":
		themeID = DefaultDungeonThemeID
	case RandomDungeonThemeID:
		playable := PlayableDungeonThemes()
		themeID = playable[mixSeed(seed, 0, 0x7e3e)%uint64(len(playable))].ID
	}
	theme, err := defaultDungeonThemeCatalog.Theme(themeID)
	if err != nil {
		return fmt.Errorf("%w: %q", ErrUnknownDungeonTheme, themeID)
	}
	if !theme.Playable {
		return fmt.Errorf("%w: %q", ErrThemeNotPlayable, themeID)
	}
	maxDepth := expeditionDepth(seed)
	entryID, rooms := generateExpeditionFloor(themeID, seed, InitialDungeonDepth, maxDepth, len(room.PlayerIDs), nil)
	if err := beginRun(room, runID, now, themeID, rooms, entryID); err != nil {
		return err
	}
	room.Run.Generator = ExpeditionGenerator
	room.Run.Seed = seed
	room.Run.Depth = InitialDungeonDepth
	room.Run.MaxDepth = maxDepth
	room.Run.MusicIntensity = InitialDungeonDepth
	return nil
}

// DescendDestination is the destination of the exit a cleared floor guardian leaves behind: the way down.
const DescendDestination = "@descend"

// FloorClearRestPercent is the share of maximum health a living adventurer recovers on clearing a floor that has
// no camp. The camp's own rest is CampRestPercent.
const FloorClearRestPercent = 15

// DungeonExtraDepthStep is how many floors harder each later dungeon of an expedition is.
const DungeonExtraDepthStep = 2

func dungeonNumber(run *Run) int {
	if run.Dungeon < 1 {
		return 1
	}
	return run.Dungeon
}

func dungeonExtraDepth(run *Run) int { return (dungeonNumber(run) - 1) * DungeonExtraDepthStep }

// dungeonSeed is the generation seed of one dungeon of an expedition. The first dungeon uses the run seed.
func dungeonSeed(seed uint64, dungeon int) uint64 {
	if dungeon <= 1 {
		return seed
	}
	return mixSeed(seed, uint64(dungeon), 0xd00d)
}

// campAfterFloor reports whether the party camps after clearing a floor: halfway through a dungeon, and after
// its boss. Every other floor leads straight down, so the loop is not interrupted on every floor.
func campAfterFloor(depth, maxDepth int) bool {
	return depth == maxDepth/2 || depth >= maxDepth
}

// nextFloorModifiers are the modifiers of a floor of the current dungeon: the dungeon's own, then the depth's.
func nextFloorModifiers(run *Run, depth int) []ActiveFloorModifier {
	return mergeModifiers(run.DungeonModifiers, rollFloorModifiers(dungeonSeed(run.Seed, dungeonNumber(run)), depth))
}

// mergeModifiers appends extra to base, skipping repeats and anything that opposes a modifier already present.
func mergeModifiers(base, extra []ActiveFloorModifier) []ActiveFloorModifier {
	merged := append([]ActiveFloorModifier(nil), base...)
	for _, candidate := range extra {
		definition, _ := defaultFloorModifierCatalog.Modifier(candidate.ID)
		clash := false
		for _, present := range merged {
			clash = clash || present.ID == candidate.ID || present.ID == definition.Opposes
		}
		if !clash {
			merged = append(merged, candidate)
		}
	}
	return merged
}

// finishExpeditionFloor runs when a floor's boss falls. A dungeon boss ends the dungeon; the party camps there
// and at the dungeon's midpoint. Any other floor simply opens the way down.
func finishExpeditionFloor(room *Room, boss *DungeonRoom, round int, now time.Time) {
	run := room.Run
	run.FloorsCleared++
	if run.Depth >= run.MaxDepth {
		run.DungeonsCleared++
		addCombatEvent(run, round, "dungeon_cleared", clearedText(run.Theme()))
	}
	if campAfterFloor(run.Depth, run.MaxDepth) {
		openCamp(room, round, now)
		return
	}
	// No camp on this floor, but beating its guardian is still a breather: without it the stretch between camps
	// is pure attrition.
	for _, playerID := range eligibleCombatPlayers(room) {
		player := run.Players[playerID]
		transition := resolveHealthHealing(player.Health, player.MaxHealth, floorRulesFor(run).healing((player.MaxHealth*FloorClearRestPercent+99)/100))
		player.Health = transition.Health
		if transition.Applied > 0 {
			addCombatImpact(run, round, "floor_restoration", adventurerLabel(room, playerID)+" recovers "+itoa(transition.Applied)+" health catching their breath.", "heal", playerID, "player", transition.Applied)
		}
	}
	next := nextFloorModifiers(run, run.Depth+1)
	hint := "The next floor carries no modifiers."
	if len(next) > 0 {
		names := make([]string, 0, len(next))
		for _, modifier := range next {
			names = append(names, modifier.Name)
		}
		hint = "The next floor carries: " + strings.Join(names, ", ") + "."
	}
	boss.Exits = []Exit{{ID: "descend", Destination: DescendDestination, Label: fmt.Sprintf("Descend to floor %d of %d", run.Depth+1, run.MaxDepth), Description: hint}}
	addCombatEvent(run, round, "floor_cleared", fmt.Sprintf("Floor %d of %d is cleared. The way down is open.", run.Depth, run.MaxDepth))
	run.Phase = PhaseExploring
	startNavigationVote(room, now)
}

// descendExpedition moves the party to the next floor. From a camp it uses the modifiers the camp showed, and
// from the camp after a dungeon boss it enters the dungeon the party voted for.
func descendExpedition(room *Room, now time.Time) {
	run := room.Run
	camp := run.Camp
	run.Camp = nil
	modifiers := []ActiveFloorModifier(nil)
	switch {
	case camp != nil && camp.NextThemeID != "":
		// A new dungeon: new theme, new depth, its own modifiers, and only its own rooms.
		run.Dungeon = dungeonNumber(run) + 1
		run.ThemeID = camp.NextThemeID
		run.DungeonModifiers = camp.NextDungeonModifiers
		run.Depth = 0
		run.MaxDepth = expeditionDepth(dungeonSeed(run.Seed, run.Dungeon))
		run.Rooms = make(map[string]*DungeonRoom)
		modifiers = camp.NextModifiers
	case camp != nil:
		modifiers = camp.NextModifiers
	default:
		modifiers = nextFloorModifiers(run, run.Depth+1)
	}
	run.Depth++
	run.MusicIntensity = run.Depth
	if run.MusicIntensity > MaximumDungeonDepth {
		// The soundtrack was written for three levels of intensity; deeper floors stay at its peak.
		run.MusicIntensity = MaximumDungeonDepth
	}
	run.FloorModifiers = modifiers
	entryID, rooms := generateExpeditionFloor(run.Theme(), dungeonSeed(run.Seed, dungeonNumber(run)), run.Depth, run.MaxDepth, len(eligibleCombatPlayers(room)), modifiers, dungeonExtraDepth(run))
	if tag := dungeonNumber(run); tag > 1 {
		entryID = tagDungeonRooms(rooms, entryID, fmt.Sprintf("x%d", tag))
	}
	for id, dungeonRoom := range rooms {
		run.Rooms[id] = dungeonRoom
	}
	run.CurrentRoomID = entryID
	run.Phase = PhaseCombat
	run.CombatRound = nil
	run.NavigationVote = nil
	run.LastCombatEvents = nil
	message := fmt.Sprintf("The party descends to floor %d of %d.", run.Depth, run.MaxDepth)
	if run.Depth == 1 {
		theme, _ := defaultDungeonThemeCatalog.Theme(run.Theme())
		message = fmt.Sprintf("Dungeon %d: %s. %d floors lie ahead.", dungeonNumber(run), theme.Name, run.MaxDepth)
	} else if run.Depth == run.MaxDepth {
		message = fmt.Sprintf("The party descends to floor %d, the last. The master of this dungeon is waiting.", run.Depth)
	}
	addCombatEvent(run, 0, "descent", message)
	for _, modifier := range modifiers {
		addCombatEvent(run, 0, "floor_modifier", modifier.Name+": "+modifier.Description)
	}
	applyFloorEntryDamage(room)
	startCombatRound(room, now)
}

// tagDungeonRooms prefixes every room, exit, event and enemy ID of a floor, so the rooms of a later dungeon never
// share an ID with the rooms of an earlier one. It returns the new entry ID.
func tagDungeonRooms(rooms map[string]*DungeonRoom, entryID, tag string) string {
	renamed := make(map[string]*DungeonRoom, len(rooms))
	for id, dungeonRoom := range rooms {
		dungeonRoom.ID = tag + "-" + id
		for i := range dungeonRoom.Exits {
			dungeonRoom.Exits[i].Destination = tag + "-" + dungeonRoom.Exits[i].Destination
		}
		if dungeonRoom.Event != nil {
			dungeonRoom.Event.ID = tag + "-" + dungeonRoom.Event.ID
		}
		if dungeonRoom.Encounter != nil {
			for i := range dungeonRoom.Encounter.Enemies {
				dungeonRoom.Encounter.Enemies[i].ID = tag + "-" + dungeonRoom.Encounter.Enemies[i].ID
			}
		}
		renamed[dungeonRoom.ID] = dungeonRoom
		delete(rooms, id)
	}
	for id, dungeonRoom := range renamed {
		rooms[id] = dungeonRoom
	}
	return tag + "-" + entryID
}

// ---- The crossroads: choosing the next dungeon ----------------------------------------------------------------

// DungeonChoice is one of the two dungeons offered after a dungeon boss, with the modifiers that would hold on
// every floor of it.
type DungeonChoice struct {
	ThemeID   string                `json:"themeId"`
	Name      string                `json:"name"`
	Tagline   string                `json:"tagline"`
	Floors    int                   `json:"floors"`
	Modifiers []ActiveFloorModifier `json:"modifiers"`
}

// DungeonChoiceCount is how many dungeons the crossroads offers.
const DungeonChoiceCount = 2

// rollDungeonChoices picks the themes offered after a dungeon, never the one just cleared, each with its own
// modifiers: always one perk, and one debuff for the second dungeon of an expedition, two for every later one.
func rollDungeonChoices(seed uint64, currentThemeID string, nextDungeon int) []DungeonChoice {
	rng := rand.New(rand.NewSource(int64(mixSeed(seed, uint64(nextDungeon), 0xc4055))))
	var themes []DungeonThemeDefinition
	for _, theme := range PlayableDungeonThemes() {
		if theme.ID != currentThemeID {
			themes = append(themes, theme)
		}
	}
	rng.Shuffle(len(themes), func(i, j int) { themes[i], themes[j] = themes[j], themes[i] })
	var debuffPool, perkPool []FloorModifierDefinition
	for _, definition := range defaultFloorModifierCatalog.Definitions {
		if definition.Rollable && definition.Kind == FloorModifierDebuff {
			debuffPool = append(debuffPool, definition)
		} else if definition.Rollable {
			perkPool = append(perkPool, definition)
		}
	}
	debuffs := nextDungeon - 1
	if debuffs > 2 {
		debuffs = 2
	}
	choices := make([]DungeonChoice, 0, DungeonChoiceCount)
	for _, theme := range themes[:DungeonChoiceCount] {
		rng.Shuffle(len(debuffPool), func(i, j int) { debuffPool[i], debuffPool[j] = debuffPool[j], debuffPool[i] })
		rng.Shuffle(len(perkPool), func(i, j int) { perkPool[i], perkPool[j] = perkPool[j], perkPool[i] })
		var modifiers, perk []ActiveFloorModifier
		for _, definition := range debuffPool[:debuffs] {
			modifiers = append(modifiers, definition.active())
		}
		for _, definition := range perkPool {
			if perk = mergeModifiers(modifiers, []ActiveFloorModifier{definition.active()}); len(perk) > len(modifiers) {
				break
			}
		}
		choices = append(choices, DungeonChoice{ThemeID: theme.ID, Name: theme.Name, Tagline: theme.Tagline, Floors: expeditionDepth(dungeonSeed(seed, nextDungeon)), Modifiers: perk})
	}
	return choices
}

// applyFloorEntryDamage applies the floor's hazard when a fight starts. It never takes a player below 1 health.
func applyFloorEntryDamage(room *Room) {
	run := room.Run
	damage := floorRulesFor(run).EntryDamage
	if damage <= 0 {
		return
	}
	for _, playerID := range eligibleCombatPlayers(room) {
		if applied := damageWithoutKilling(run.Players[playerID], damage); applied > 0 {
			addCombatImpact(run, 0, "floor_hazard", adventurerLabel(room, playerID)+" loses "+itoa(applied)+" health to the floor's hazards.", "damage", playerID, "player", applied)
		}
	}
}

// EncounterGold is the gold each adventurer earns for clearing an encounter, before floor modifiers: a base, plus
// the encounter's difficulty budget, plus a little for depth.
func EncounterGold(budget, depth int) int {
	return 4 + 2*budget + depth
}

// grantEncounterGold pays every present adventurer, downed or not, for a cleared encounter. Only expeditions
// have gold: runs persisted before them have nowhere to spend it.
func grantEncounterGold(room *Room, current *DungeonRoom, round int) {
	run := room.Run
	if run.Generator < ExpeditionGenerator || current.Encounter == nil {
		return
	}
	_ = round // Gold is shown on every adventurer's purse; a log line per fight would only be noise.
	gold := EncounterGold(current.Encounter.Budget, run.Depth+dungeonExtraDepth(run)) * (100 + floorRulesFor(run).GoldPct) / 100
	if gold < 1 {
		gold = 1
	}
	playerIDs := append([]string(nil), room.PlayerIDs...)
	sort.Strings(playerIDs)
	for _, playerID := range playerIDs {
		if player := run.Players[playerID]; player != nil && room.Presence[playerID].LeftAt == nil {
			player.Gold += gold
		}
	}
}

// An expedition has no last dungeon: it ends when the party falls, and how far it got is the result. Ranks name
// that distance, so a party always has a next title to go back for.
var expeditionRanks = []struct {
	Floors int
	Title  string
}{{0, "Wanderer"}, {1, "Delver"}, {3, "Pathfinder"}, {5, "Dungeon Breaker"}, {8, "Realm Walker"}, {12, "Beast Hunter"}, {17, "Legend of the Deep"}, {24, "Heart of the Beast"}}

// ExpeditionRank is the title earned by clearing a number of floors.
func ExpeditionRank(floorsCleared int) string {
	title := expeditionRanks[0].Title
	for _, rank := range expeditionRanks {
		if floorsCleared >= rank.Floors {
			title = rank.Title
		}
	}
	return title
}
