package game

import (
	"errors"
	"fmt"
	"hash/fnv"
	"sort"
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

// descendExpedition moves the party from camp to the next floor, with the modifiers the camp showed.
func descendExpedition(room *Room, now time.Time) {
	run := room.Run
	modifiers := []ActiveFloorModifier(nil)
	if run.Camp != nil {
		modifiers = run.Camp.NextModifiers
	}
	run.Camp = nil
	run.Depth++
	run.MusicIntensity = run.Depth
	if run.MusicIntensity > MaximumDungeonDepth {
		// The soundtrack was written for three levels of intensity; deeper floors stay at its peak.
		run.MusicIntensity = MaximumDungeonDepth
	}
	run.FloorModifiers = modifiers
	entryID, rooms := generateExpeditionFloor(run.Theme(), run.Seed, run.Depth, run.MaxDepth, len(eligibleCombatPlayers(room)), modifiers)
	for id, dungeonRoom := range rooms {
		run.Rooms[id] = dungeonRoom
	}
	run.CurrentRoomID = entryID
	run.Phase = PhaseCombat
	run.CombatRound = nil
	run.NavigationVote = nil
	run.LastCombatEvents = nil
	message := fmt.Sprintf("The party descends to floor %d of %d.", run.Depth, run.MaxDepth)
	if run.Depth == run.MaxDepth {
		message = fmt.Sprintf("The party descends to floor %d, the last. The master of this dungeon is waiting.", run.Depth)
	}
	addCombatEvent(run, 0, "descent", message)
	for _, modifier := range modifiers {
		addCombatEvent(run, 0, "floor_modifier", modifier.Name+": "+modifier.Description)
	}
	applyFloorEntryDamage(room)
	startCombatRound(room, now)
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
	gold := EncounterGold(current.Encounter.Budget, run.Depth) * (100 + floorRulesFor(run).GoldPct) / 100
	if gold < 1 {
		gold = 1
	}
	playerIDs := append([]string(nil), room.PlayerIDs...)
	sort.Strings(playerIDs)
	paid := false
	for _, playerID := range playerIDs {
		if player := run.Players[playerID]; player != nil && room.Presence[playerID].LeftAt == nil {
			player.Gold += gold
			paid = true
		}
	}
	if paid {
		addCombatEvent(run, round, "gold", "Every adventurer collects "+itoa(gold)+" gold.")
	}
}
