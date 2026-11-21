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

// An expedition is one dungeon: exactly four generated floors in one theme, each ending in a guardian, with a
// camp between floors and the dungeon's boss at the bottom. Floors below the first carry level-wide modifiers.

const (
	// ExpeditionGenerator is the Run.Generator value of expedition runs.
	ExpeditionGenerator = 2
	// ExpeditionFloorCount is the fixed number of floors in every ordinary dungeon.
	ExpeditionFloorCount   = 4
	MinimumExpeditionDepth = ExpeditionFloorCount
	MaximumExpeditionDepth = ExpeditionFloorCount
	// RandomDungeonThemeID asks StartMultiLevelRunForTheme to choose a playable theme from the run seed.
	RandomDungeonThemeID = "random"
)

// expeditionDepth is fixed so dungeon duration is predictable; the seed still controls room generation.
func expeditionDepth(_ uint64) int { return ExpeditionFloorCount }

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
	if IsCapstoneTheme(themeID) {
		// A castle is earned at the crossroads after four dungeons; it cannot be the first.
		return fmt.Errorf("%w: %q", ErrThemeNotPlayable, themeID)
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
	maxDepth := dungeonFloors(seed, 1, themeID)
	entryID, rooms := generateExpeditionFloor(themeID, seed, InitialDungeonDepth, maxDepth, len(room.PlayerIDs), nil, capstoneExtraDepth(themeID))
	if err := beginRun(room, runID, now, themeID, rooms, entryID); err != nil {
		return err
	}
	room.Run.Generator = ExpeditionGenerator
	room.Run.DungeonThemes = []string{themeID}
	room.Run.Seed = seed
	room.Run.Depth = InitialDungeonDepth
	room.Run.MaxDepth = maxDepth
	room.Run.MusicIntensity = InitialDungeonDepth
	briefDungeon(room.Run)
	extendFirstRound(room.Run, RunPrologueWindow)
	return nil
}

// DescendDestination is the destination of the exit a cleared floor guardian leaves behind: the way down.
const DescendDestination = "@descend"

// DungeonExtraDepthStep is how many floors harder each later dungeon of an expedition is.
const DungeonExtraDepthStep = 2

func dungeonNumber(run *Run) int {
	if run.Dungeon < 1 {
		return 1
	}
	return run.Dungeon
}

// dungeonExtraDepth is how much deeper than its floor the current dungeon's enemies fight: two floors per earlier
// dungeon, and more again inside a capstone castle.
func dungeonExtraDepth(run *Run) int {
	return (dungeonNumber(run)-1)*DungeonExtraDepthStep + capstoneExtraDepth(run.Theme())
}

func capstoneExtraDepth(themeID string) int {
	if IsCapstoneTheme(themeID) {
		return CapstoneExtraDepth
	}
	return 0
}

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
	if IsCapstoneTheme(run.Theme()) {
		// Every castle boss is worth a boon, camp or no camp.
		openBoonCamp(room, round, now)
		return
	}
	// No automatic recovery occurs between fights; consumables provide player-controlled healing.
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
		run.DungeonThemes = append(run.DungeonThemes, camp.NextThemeID)
		run.DungeonModifiers = camp.NextDungeonModifiers
		run.Depth = 0
		run.MaxDepth = dungeonFloors(run.Seed, run.Dungeon, run.ThemeID)
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
	heart := run.Depth >= run.MaxDepth && summonHeart(run)
	entryID, rooms := generateFloor(heart, run.Theme(), dungeonSeed(run.Seed, dungeonNumber(run)), run.Depth, run.MaxDepth, len(eligibleCombatPlayers(room)), modifiers, dungeonExtraDepth(run))
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
	extendFirstRound(run, FloorTransitionWindow)
	if camp != nil && camp.NextThemeID != "" {
		briefDungeon(run)
	}
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
	// Capstone marks a castle: harder, every boss armed, and a boon for every boss beaten.
	Capstone bool `json:"capstone,omitempty"`
}

// DungeonChoiceCount is how many dungeons the crossroads offers.
const DungeonChoiceCount = 2

// rollDungeonChoices picks the themes offered after a dungeon, never the one just cleared, each with its own
// modifiers: always one perk, and one debuff for the second dungeon of an expedition, two for every later one.
func rollDungeonChoices(seed uint64, currentThemeID string, nextDungeon int) []DungeonChoice {
	rng := rand.New(rand.NewSource(int64(mixSeed(seed, uint64(nextDungeon), 0xc4055))))
	var themes []DungeonThemeDefinition
	pool := PlayableDungeonThemes()
	if IsCapstoneDungeon(nextDungeon) {
		// After every fourth dungeon the road leads to a castle, and the party picks which.
		pool = CapstoneDungeonThemes()
	}
	for _, theme := range pool {
		if theme.ID != currentThemeID {
			themes = append(themes, theme)
		}
	}
	rng.Shuffle(len(themes), func(i, j int) { themes[i], themes[j] = themes[j], themes[i] })
	var debuffPool, perkPool []FloorModifierDefinition
	for _, definition := range defaultFloorModifierCatalog.Definitions {
		if definition.Rollable && definition.Kind == FloorModifierDebuff {
			debuffPool = append(debuffPool, definition)
		} else if definition.Rollable || definition.DungeonRollable {
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
		choices = append(choices, DungeonChoice{ThemeID: theme.ID, Name: theme.Name, Tagline: theme.Tagline, Floors: dungeonFloors(seed, nextDungeon, theme.ID), Modifiers: perk, Capstone: theme.Capstone})
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
	// Encounter payouts rise gently at first, then stop scaling. The old uncapped depth bonus
	// rewarded farming longer expeditions with enough gold to buy every permanent upgrade.
	if depth < 0 {
		depth = 0
	}
	if depth > 8 {
		depth = 8
	}
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

// Profile and class-mastery experience for a finished run (ADR 0028). Going further is worth more: every fight
// won counts, every floor cleared adds to it, and every dungeon conquered adds a milestone.
const (
	RunXPPerEncounter = 10
	RunXPPerFloor     = 15
	RunXPPerDungeon   = 50
	// RunXPCompletionBonus is the milestone for finishing a run persisted before expeditions, which could be won.
	RunXPCompletionBonus = 20
)

// RunProgress is what a finished run is worth, line by line, so the party can see where its experience came from.
type RunProgress struct {
	XP              int64 `json:"xp"`
	Encounters      int   `json:"encounters"`
	Floors          int   `json:"floors"`
	Dungeons        int   `json:"dungeons"`
	CompletionBonus int   `json:"completionBonus,omitempty"`
}

// RunProgressXP is the persistent experience a finished run is worth to each adventurer who stayed. It is zero
// until the run is over, and zero for a run that won no fight.
func RunProgressXP(run *Run) int64 {
	if progress := RunProgressOf(run); progress != nil {
		return progress.XP
	}
	return 0
}

// RunProgressOf breaks RunProgressXP down. It is nil until the run is over, and nil for a run that won no fight.
func RunProgressOf(run *Run) *RunProgress {
	if run == nil || (run.Phase != PhaseCompleted && run.Phase != PhaseFailed) {
		return nil
	}
	return runProgressSoFar(run)
}

// RunProgressEarned is the persistent experience the run has earned so far, whether or not it is over. The server
// banks it to each adventurer's profile as it grows, so leaving mid-run keeps everything earned before leaving.
func RunProgressEarned(run *Run) int64 {
	if progress := runProgressSoFar(run); progress != nil {
		return progress.XP
	}
	return 0
}

func runProgressSoFar(run *Run) *RunProgress {
	if run == nil || run.Cheated {
		return nil
	}
	encounters := 0
	for _, dungeonRoom := range run.Rooms {
		if dungeonRoom != nil && dungeonRoom.Encounter != nil && dungeonRoom.Encounter.Status == EncounterCleared {
			encounters++
		}
	}
	if run.EncountersCleared > encounters {
		encounters = run.EncountersCleared
	}
	if encounters == 0 {
		return nil
	}
	progress := &RunProgress{Encounters: encounters, Floors: run.FloorsCleared, Dungeons: run.DungeonsCleared}
	if run.Phase == PhaseCompleted {
		progress.CompletionBonus = RunXPCompletionBonus
	}
	progress.XP = int64(encounters*RunXPPerEncounter + run.FloorsCleared*RunXPPerFloor + run.DungeonsCleared*RunXPPerDungeon + progress.CompletionBonus)
	return progress
}
