package game

import (
	"errors"
	"fmt"
	"hash/fnv"
	randv2 "math/rand/v2"
	"time"
)

const InitialDungeonDepth = 1
const MaximumDungeonDepth = 3

var ErrInvalidInterFloorChoice = errors.New("choose either health restoration or a run perk")

// StartMultiLevelRun starts the existing authored Catacombs floor as the first
// floor of a seeded three-floor expedition. Later floors are generated from
// the persisted run seed and depth.
func StartMultiLevelRun(room *Room, runID string, now time.Time) error {
	return StartMultiLevelRunForTheme(room, runID, "", now)
}

// DefaultDungeonThemeID is the theme of runs that do not choose one, and of runs persisted before themes existed.
const DefaultDungeonThemeID = "catacombs"

var (
	ErrUnknownDungeonTheme = errors.New("unknown dungeon theme")
	ErrThemeNotPlayable    = errors.New("dungeon theme is not playable yet")
)

// Theme returns the run's dungeon theme, defaulting to Forgotten Catacombs for runs persisted before themes.
func (run *Run) Theme() string {
	if run == nil || run.ThemeID == "" {
		return DefaultDungeonThemeID
	}
	return run.ThemeID
}

// StartMultiLevelRunForTheme starts a seeded three-floor expedition in a playable dungeon theme; an empty
// themeID means Forgotten Catacombs. Catacombs keeps its authored first floor. Every other theme generates all
// of its floors from the run seed.
func StartMultiLevelRunForTheme(room *Room, runID, themeID string, now time.Time) error {
	if themeID == "" {
		themeID = DefaultDungeonThemeID
	}
	theme, err := defaultDungeonThemeCatalog.Theme(themeID)
	if err != nil {
		return fmt.Errorf("%w: %q", ErrUnknownDungeonTheme, themeID)
	}
	if !theme.Playable {
		return fmt.Errorf("%w: %q", ErrThemeNotPlayable, themeID)
	}
	hash := fnv.New64a()
	_, _ = hash.Write([]byte(runID))
	seed := hash.Sum64()
	if themeID == DefaultDungeonThemeID {
		if err := StartRun(room, runID, now); err != nil {
			return err
		}
	} else {
		if room.Run != nil {
			return ErrRunAlreadyStarted
		}
		if len(room.PlayerIDs) == 0 || runID == "" {
			return errors.New("room requires a player and run id")
		}
		entryID, rooms := generateFloorForTheme(themeID, seed, InitialDungeonDepth, len(room.PlayerIDs))
		if err := beginRun(room, runID, now, themeID, rooms, entryID); err != nil {
			return err
		}
	}
	room.Run.Seed = seed
	room.Run.Depth = InitialDungeonDepth
	room.Run.MaxDepth = MaximumDungeonDepth
	room.Run.MusicIntensity = InitialDungeonDepth
	return nil
}

const InterFloorChoiceWindow = 15 * time.Second

func resolveInterFloorChoice(room *Room, actorID, choiceID string, now time.Time) error {
	run := room.Run
	if run == nil || run.Phase != PhaseIntermission || !run.PendingInterFloorChoice {
		return ErrInvalidPhase
	}
	player := run.Players[actorID]
	if player == nil {
		return ErrNotPlayer
	}
	if player.Health <= 0 || room.Presence[actorID].LeftAt != nil {
		return ErrInvalidPhase
	}
	if choiceID != "restore" && choiceID != "perk" {
		return ErrInvalidInterFloorChoice
	}
	eligible := eligibleCombatPlayers(room)
	if len(eligible) <= 1 {
		applyInterFloorChoice(room, choiceID, now)
		return nil
	}
	if run.InterFloorVote == nil {
		run.InterFloorVote = &NavigationVote{StartedAt: now.UTC(), Deadline: now.UTC().Add(InterFloorChoiceWindow), Votes: make(map[string]string)}
	}
	if !now.Before(run.InterFloorVote.Deadline) {
		AdvanceInterFloorChoice(room, now)
		return ErrInvalidPhase
	}
	run.InterFloorVote.Votes[actorID] = choiceID
	if allInterFloorVotesSubmitted(room) {
		resolveInterFloorVote(room, now)
	}
	return nil
}

// AdvanceInterFloorChoice resolves a party choice when everyone has voted or
// the discussion window expires. It is safe to call from snapshot polling.
func AdvanceInterFloorChoice(room *Room, now time.Time) bool {
	run := room.Run
	if run == nil || run.Phase != PhaseIntermission || !run.PendingInterFloorChoice || run.InterFloorVote == nil {
		return false
	}
	if now.Before(run.InterFloorVote.Deadline) && !allInterFloorVotesSubmitted(room) {
		return false
	}
	resolveInterFloorVote(room, now)
	return true
}

func allInterFloorVotesSubmitted(room *Room) bool {
	run := room.Run
	if run == nil || run.InterFloorVote == nil {
		return false
	}
	eligible := eligibleCombatPlayers(room)
	if len(eligible) == 0 {
		return false
	}
	for _, playerID := range eligible {
		if _, voted := run.InterFloorVote.Votes[playerID]; !voted {
			return false
		}
	}
	return true
}

func resolveInterFloorVote(room *Room, now time.Time) {
	votes := room.Run.InterFloorVote.Votes
	restoreVotes, perkVotes := 0, 0
	for _, choice := range votes {
		switch choice {
		case "restore":
			restoreVotes++
		case "perk":
			perkVotes++
		}
	}
	choice := "restore"
	if perkVotes > restoreVotes || perkVotes == restoreVotes && randv2.IntN(2) == 1 {
		choice = "perk"
	}
	applyInterFloorChoice(room, choice, now)
}

func applyInterFloorChoice(room *Room, choiceID string, now time.Time) {
	run := room.Run
	rewardID := ""
	flagID := ""
	switch choiceID {
	case "restore":
		rewardID = "floor.restore"
		flagID = fmt.Sprintf("floor-%d-restored", run.Depth)
	case "perk":
		rewardID = "floor.perk"
		flagID = fmt.Sprintf("floor-%d-perk", run.Depth)
	}
	if reward, ok := defaultRunRewardCatalog.Reward(rewardID); ok {
		applyRunReward(room, reward, 0, flagID)
	}

	run.PendingInterFloorChoice = false
	run.InterFloorVote = nil
	run.Depth++
	run.MusicIntensity = run.Depth
	entryID, rooms := generateFloorForTheme(run.Theme(), run.Seed, run.Depth, len(eligibleCombatPlayers(room)))
	for id, dungeonRoom := range rooms {
		run.Rooms[id] = dungeonRoom
	}
	run.CurrentRoomID = entryID
	run.Phase = PhaseCombat
	run.CombatRound = nil
	run.NavigationVote = nil
	addCombatEvent(run, 0, "descent", fmt.Sprintf("The party descends to floor %d. The dungeon's song grows heavier.", run.Depth))
	startCombatRound(room, now)
}

// generateDungeonFloor builds a Forgotten Catacombs floor. It is the Catacombs case of generateFloorForTheme,
// kept as the original entry point.
func generateDungeonFloor(seed uint64, depth, partySize int) (string, map[string]*DungeonRoom) {
	return generateFloorForTheme("catacombs", seed, depth, partySize)
}

// generateFloorForTheme uses only authored encounter/event templates. The seed, depth and theme fully determine
// the floor's routes, event, optional miniboss, and enemy mix.
func generateFloorForTheme(themeID string, seed uint64, depth, partySize int) (string, map[string]*DungeonRoom) {
	template, err := defaultFloorTemplateCatalog.Template(themeID)
	if err != nil {
		panic(err.Error())
	}
	return generateThemedFloor(template, seed, depth, partySize)
}

func isBossRoom(room *DungeonRoom) bool {
	return room != nil && (room.RoomType == "boss" || room.ID == "warden")
}
