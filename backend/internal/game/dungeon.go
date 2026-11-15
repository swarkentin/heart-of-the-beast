package game

import (
	"errors"
	"fmt"
	"hash/fnv"
	"math/rand"
	"math/rand/v2"
	"time"
)

const InitialDungeonDepth = 1
const MaximumDungeonDepth = 3

var ErrInvalidInterFloorChoice = errors.New("choose either health restoration or a run perk")

// StartMultiLevelRun starts the existing authored Catacombs floor as the first
// floor of a seeded three-floor expedition. Later floors are generated from
// the persisted run seed and depth.
func StartMultiLevelRun(room *Room, runID string, now time.Time) error {
	if err := StartRun(room, runID, now); err != nil {
		return err
	}
	hash := fnv.New64a()
	_, _ = hash.Write([]byte(runID))
	room.Run.Seed = hash.Sum64()
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
	if perkVotes > restoreVotes || perkVotes == restoreVotes && rand.IntN(2) == 1 {
		choice = "perk"
	}
	applyInterFloorChoice(room, choice, now)
}

func applyInterFloorChoice(room *Room, choiceID string, now time.Time) {
	run := room.Run
	if run.Flags == nil {
		run.Flags = make(map[string]bool)
	}
	switch choiceID {
	case "restore":
		for playerID, member := range run.Players {
			if member == nil || member.Health <= 0 || room.Presence[playerID].LeftAt != nil {
				continue
			}
			before := member.Health
			member.Health += 10
			if member.Health > member.MaxHealth {
				member.Health = member.MaxHealth
			}
			if member.Health > before {
				addCombatImpact(run, 0, "floor_restoration", adventurerLabel(room, playerID)+" recovers "+itoa(member.Health-before)+" health before descending.", "heal", playerID, "player", member.Health-before)
			}
		}
		run.Flags[fmt.Sprintf("floor-%d-restored", run.Depth)] = true
	case "perk":
		for _, member := range run.Players {
			if member != nil {
				member.StrikeDamage++
				member.GuardReduction++
			}
		}
		run.Flags[fmt.Sprintf("floor-%d-perk", run.Depth)] = true
	}

	run.PendingInterFloorChoice = false
	run.InterFloorVote = nil
	run.Depth++
	run.MusicIntensity = run.Depth
	entryID, rooms := generateDungeonFloor(run.Seed, run.Depth, len(eligibleCombatPlayers(room)))
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

// generateDungeonFloor uses only authored encounter/event templates. The seed
// and depth fully determine its branch, optional miniboss, and enemy mix.
func generateDungeonFloor(seed uint64, depth, partySize int) (string, map[string]*DungeonRoom) {
	rng := rand.New(rand.NewSource(int64(seed + uint64(depth)*0x9e3779b97f4a7c15)))
	prefix := fmt.Sprintf("d%d-", depth)
	floor := fmt.Sprintf("%02d", depth)
	scale := 1.0 + float64(depth-1)*0.18
	if partySize > 1 {
		scale += float64(partySize-1) * 0.12
	} else {
		scale -= 0.12
	}
	health := func(base int) int {
		value := int(float64(base)*scale + 0.5)
		if value < 1 {
			return 1
		}
		return value
	}
	names := []string{"The Silted Cloister", "The Ashen Stair", "The Drowned Archive", "The Hollow Nave", "The Shattered Ossuary"}
	routeName := names[rng.Intn(len(names))]
	hasMiniboss := rng.Intn(100) < 48
	leftEnemy := Enemy{ID: prefix + "left-guardian", Name: "Ashbound Guardian", Behavior: "guardian", Health: health(13), MaxHealth: health(13)}
	rightEnemy := Enemy{ID: prefix + "right-scout", Name: "Crypt Stalker", Behavior: "scout", Health: health(11), MaxHealth: health(11)}
	if rng.Intn(2) == 0 {
		leftEnemy, rightEnemy = rightEnemy, leftEnemy
		leftEnemy.ID, rightEnemy.ID = prefix+"left-enemy", prefix+"right-enemy"
	}
	rooms := map[string]*DungeonRoom{
		prefix + "entry": {
			ID: prefix + "entry", Name: "The Lower Threshold", Floor: floor, RoomType: "encounter",
			Description: "The air grows colder. Old warding marks pulse beneath the dust as the next descent stirs awake.",
			Exits:       []Exit{{ID: "left", Destination: prefix + "left", Label: "The Broken Cloister", Description: "A guarded passage through collapsed stone."}, {ID: "right", Destination: prefix + "right", Label: "The Silted Stair", Description: "A narrow route where something moves below the water."}},
			Encounter:   &Encounter{Status: EncounterActive, Enemies: []Enemy{{ID: prefix + "threshold-guard", Name: "Threshold Warden", Behavior: "sentinel", Health: health(12), MaxHealth: health(12)}}},
		},
		prefix + "left": {
			ID: prefix + "left", Name: routeName, Floor: floor, RoomType: "encounter",
			Description: "A formation of ancient defenders blocks the route. Their movements are deliberate and practiced.",
			Exits:       []Exit{{ID: "forward", Destination: prefix + "shrine", Label: "The Echoing Shrine"}},
			Encounter:   &Encounter{Status: EncounterActive, Enemies: []Enemy{leftEnemy}},
		},
		prefix + "right": {
			ID: prefix + "right", Name: "The Silted Stair", Floor: floor, RoomType: "encounter",
			Description: "Black water spills down the steps. A quick-moving crypt stalker waits in the dark.",
			Exits:       []Exit{{ID: "forward", Destination: prefix + "shrine", Label: "The Echoing Shrine"}},
			Encounter:   &Encounter{Status: EncounterActive, Enemies: []Enemy{rightEnemy}},
		},
		prefix + "shrine": {
			ID: prefix + "shrine", Name: "The Echoing Shrine", Floor: floor, RoomType: "event",
			Description: "A low harmonic vibrates through the stone. The shrine offers a brief moment of power, but its blessing is uncertain.",
			Exits:       []Exit{{ID: "deeper", Destination: prefix + "guard", Label: "The Guarded Descent"}},
			Event:       &RoomEvent{ID: prefix + "shrine-event", Title: "A Resonance in the Stone", Description: "The party can draw strength from the shrine before continuing.", Choices: []EventChoice{{ID: "ward", Label: "Take the ward", Description: "Gain a small defensive blessing for the rest of the run.", Effect: "shrine_ward"}, {ID: "leave", Label: "Leave it untouched", Description: "Keep moving without disturbing the shrine.", Effect: "leave"}}},
		},
		prefix + "guard": {
			ID: prefix + "guard", Name: "The Guarded Descent", Floor: floor, RoomType: "encounter",
			Description: "The final defenders of this level stand between the party and the next descent.",
			Exits:     []Exit{{ID: "down", Destination: prefix + "boss", Label: "The Floor Guardian"}},
			Encounter: &Encounter{Status: EncounterActive, Enemies: []Enemy{{ID: prefix + "guard-a", Name: "Stonebound Guard", Behavior: "guardian", Health: health(14), MaxHealth: health(14)}, {ID: prefix + "guard-b", Name: "Gravebound Scout", Behavior: "scout", Health: health(10), MaxHealth: health(10)}}},
		},
		prefix + "boss": {
			ID: prefix + "boss", Name: map[bool]string{true: "The Warden Below", false: "The Ossuary Champion"}[depth == MaximumDungeonDepth], Floor: floor, RoomType: "boss",
			Description: "A vast chamber opens around an ancient guardian. The dungeon's deeper rhythm pounds through the walls.",
			Encounter:   &Encounter{Status: EncounterActive, Enemies: []Enemy{{ID: prefix + "boss-enemy", Name: map[bool]string{true: "Crypt Warden", false: "Ossuary Champion"}[depth == MaximumDungeonDepth], Behavior: "warden", Health: health(30 + depth*4), MaxHealth: health(30 + depth*4)}}},
		},
	}
	if hasMiniboss {
		miniHealth := health(23 + depth*3)
		rooms[prefix+"shrine"].Exits = append(rooms[prefix+"shrine"].Exits, Exit{ID: "challenge", Destination: prefix + "miniboss", Label: "The Sealed Reliquary", Description: "A dangerous optional challenge with a run reward."})
		rooms[prefix+"miniboss"] = &DungeonRoom{ID: prefix + "miniboss", Name: "The Sealed Reliquary", Floor: floor, RoomType: "miniboss", Description: "A hulking champion tears free from its stone bindings. Defeating it will strengthen the whole party.", Exits: []Exit{{ID: "rejoin", Destination: prefix + "boss", Label: "Return to the Descent"}}, Encounter: &Encounter{Status: EncounterActive, Enemies: []Enemy{{ID: prefix + "miniboss-enemy", Name: "Reliquary Brute", Behavior: "miniboss", Health: miniHealth, MaxHealth: miniHealth}}}}
	}
	return prefix + "entry", rooms
}

func isBossRoom(room *DungeonRoom) bool {
	return room != nil && (room.RoomType == "boss" || room.ID == "warden")
}