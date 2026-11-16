package game

import (
	"encoding/json"
	"testing"
	"time"
)

func TestGeneratedDungeonFloorIsDeterministicAndConnected(t *testing.T) {
	entryA, roomsA := generateDungeonFloor(12345, 2, 1)
	entryB, roomsB := generateDungeonFloor(12345, 2, 1)
	a, _ := json.Marshal(roomsA)
	b, _ := json.Marshal(roomsB)
	if entryA != entryB || string(a) != string(b) {
		t.Fatal("same seed, depth, and party size must produce the same floor")
	}
	var differs bool
	for seed := uint64(1); seed <= 32; seed++ {
		_, candidate := generateDungeonFloor(seed, 2, 1)
		encoded, _ := json.Marshal(candidate)
		if string(encoded) != string(a) {
			differs = true
			break
		}
	}
	if !differs {
		t.Fatal("different seeds should produce different authored combinations")
	}

	visited := map[string]bool{entryA: true}
	queue := []string{entryA}
	for len(queue) > 0 {
		id := queue[0]
		queue = queue[1:]
		room := roomsA[id]
		if room == nil {
			t.Fatalf("exit points to missing room %q", id)
		}
		for _, exit := range room.Exits {
			if roomsA[exit.Destination] == nil {
				t.Fatalf("room %q points to missing destination %q", id, exit.Destination)
			}
			if !visited[exit.Destination] {
				visited[exit.Destination] = true
				queue = append(queue, exit.Destination)
			}
		}
	}
	if len(visited) != len(roomsA) {
		t.Fatalf("all generated rooms should be reachable from %q: reached %d of %d", entryA, len(visited), len(roomsA))
	}
	if roomsA["d2-boss"] == nil || roomsA["d2-boss"].RoomType != "boss" {
		t.Fatal("every generated floor must have a reachable boss exit")
	}
}

func TestInterFloorChoicePreservesRunAndGeneratesNextFloor(t *testing.T) {
	now := time.Date(2026, 11, 15, 12, 0, 0, 0, time.UTC)
	room := newTestRoom()
	if err := StartMultiLevelRun(room, "multi-floor-run", now); err != nil {
		t.Fatal(err)
	}
	run := room.Run
	run.Phase = PhaseIntermission
	run.PendingInterFloorChoice = true
	run.Players["player-1"].Health = 12
	run.Players["player-1"].StrikeDamage = 14
	run.Flags["kept-discovery"] = true
	if err := ApplyCommand(room, "player-1", Command{Type: "choose_inter_floor", ChoiceID: "restore"}, now); err != nil {
		t.Fatal(err)
	}
	if run.Depth != 2 || run.Phase != PhaseCombat || run.CurrentRoomID != "d2-entry" {
		t.Fatalf("expected generated second floor, got depth=%d phase=%s room=%s", run.Depth, run.Phase, run.CurrentRoomID)
	}
	if run.Players["player-1"].Health != 22 || run.Players["player-1"].StrikeDamage != 14 || !run.Flags["kept-discovery"] {
		t.Fatal("floor transition should restore health while preserving build and run flags")
	}
	if run.MusicIntensity != 2 || run.PendingInterFloorChoice {
		t.Fatal("music progression and choice state should advance with the floor")
	}
	if err := ApplyCommand(room, "player-1", Command{Type: "choose_inter_floor", ChoiceID: "perk"}, now); err == nil {
		t.Fatal("inter-floor choice must not be claimable twice")
	}
}

func TestInterFloorPerkIsPartyWideAndInvalidChoicesDoNotAdvance(t *testing.T) {
	now := time.Date(2026, 11, 15, 12, 0, 0, 0, time.UTC)
	room := newTestRoom()
	room.PlayerIDs = []string{"player-1", "player-2"}
	if err := StartMultiLevelRun(room, "multi-floor-perk", now); err != nil {
		t.Fatal(err)
	}
	run := room.Run
	run.Phase = PhaseIntermission
	run.PendingInterFloorChoice = true
	before := run.Players["player-1"].StrikeDamage
	if err := ApplyCommand(room, "player-1", Command{Type: "choose_inter_floor", ChoiceID: "unknown"}, now); err == nil {
		t.Fatal("unknown choice should be rejected")
	}
	if run.Depth != 1 || !run.PendingInterFloorChoice {
		t.Fatal("invalid choice must not advance the run")
	}
	if err := ApplyCommand(room, "player-1", Command{Type: "choose_inter_floor", ChoiceID: "perk"}, now); err != nil {
		t.Fatal(err)
	}
	if run.Depth != 1 || run.Phase != PhaseIntermission {
		t.Fatal("the first co-op vote should wait for the rest of the party")
	}
	if err := ApplyCommand(room, "player-2", Command{Type: "choose_inter_floor", ChoiceID: "perk"}, now); err != nil {
		t.Fatal(err)
	}
	for _, id := range room.PlayerIDs {
		if run.Players[id].StrikeDamage != before+1 || run.Players[id].GuardReduction != GuardDamageReduction+1 {
			t.Fatalf("perk should grant every party member +1 strike and guard, player=%s state=%+v", id, run.Players[id])
		}
	}
}

func TestFloorBossesOpenIntermissionUntilFinalDepth(t *testing.T) {
	now := time.Date(2026, 11, 15, 12, 0, 0, 0, time.UTC)
	room := newTestRoom()
	if err := StartMultiLevelRun(room, "multi-floor-bosses", now); err != nil {
		t.Fatal(err)
	}
	run := room.Run
	run.CurrentRoomID = "warden"
	run.Phase = PhaseCombat
	run.Rooms["warden"].Encounter.Enemies[0].Health = 1
	startCombatRound(room, now)
	if err := ApplyCommand(room, "player-1", Command{Type: "combat", Round: run.CombatRound.Number, Action: "attack", TargetID: "warden"}, now); err != nil {
		t.Fatal(err)
	}
	if run.Phase != PhaseIntermission || !run.PendingInterFloorChoice || run.CompletedAt != nil {
		t.Fatal("a non-final floor boss should open an intermission, not complete the run")
	}
	if run.InterFloorVote == nil {
		t.Fatal("co-op choice window should be persisted at the floor boundary")
	}

	finalBoss := &DungeonRoom{ID: "d3-boss", RoomType: "boss", Encounter: &Encounter{Status: EncounterActive, Enemies: []Enemy{{ID: "d3-warden", Name: "Final Warden", Behavior: "warden", Health: 1, MaxHealth: 1}}}}
	run.Rooms[finalBoss.ID] = finalBoss
	run.Depth = MaximumDungeonDepth
	run.CurrentRoomID = finalBoss.ID
	run.Phase = PhaseCombat
	run.PendingInterFloorChoice = false
	run.InterFloorVote = nil
	startCombatRound(room, now)
	if err := ApplyCommand(room, "player-1", Command{Type: "combat", Round: run.CombatRound.Number, Action: "attack", TargetID: "d3-warden"}, now); err != nil {
		t.Fatal(err)
	}
	if run.Phase != PhaseCompleted || run.CompletedAt == nil {
		t.Fatal("only the final floor boss should complete the run")
	}
}

func TestInterFloorVoteResolvesAtDeadline(t *testing.T) {
	now := time.Date(2026, 11, 15, 12, 0, 0, 0, time.UTC)
	room := newTestRoom()
	room.PlayerIDs = []string{"player-1", "player-2"}
	if err := StartMultiLevelRun(room, "multi-floor-timeout", now); err != nil {
		t.Fatal(err)
	}
	run := room.Run
	run.Phase = PhaseIntermission
	run.PendingInterFloorChoice = true
	run.InterFloorVote = &NavigationVote{StartedAt: now, Deadline: now.Add(InterFloorChoiceWindow), Votes: map[string]string{"player-1": "restore"}}
	if AdvanceInterFloorChoice(room, now.Add(InterFloorChoiceWindow-time.Second)) {
		t.Fatal("choice should remain open before its deadline")
	}
	if !AdvanceInterFloorChoice(room, now.Add(InterFloorChoiceWindow)) {
		t.Fatal("choice should resolve when its deadline expires")
	}
	if run.Depth != 2 || run.Phase != PhaseCombat || run.Players["player-1"].Health != run.Players["player-1"].MaxHealth {
		t.Fatal("the submitted recovery vote should win when the other player times out")
	}
}

func TestGeneratedFloorEnemiesReferenceCatalogDefinitions(t *testing.T) {
	_, rooms := generateDungeonFloor(20261115, 3, 1)
	for roomID, room := range rooms {
		if room.Encounter == nil {
			continue
		}
		for _, enemy := range room.Encounter.Enemies {
			definition, err := defaultMonsterCatalog.Monster(enemy.DefinitionID)
			if err != nil {
				t.Fatalf("room %s enemy %s has no catalog definition: %v", roomID, enemy.ID, err)
			}
			if enemy.Name != definition.Name || enemy.Behavior != definition.BehaviorID {
				t.Fatalf("room %s enemy %s does not match definition %s: %+v", roomID, enemy.ID, definition.ID, enemy)
			}
		}
	}
}

func TestStartRunEnemiesReferenceCatalogDefinitionsAndPreserveSoloScaling(t *testing.T) {
	now := time.Date(2026, 11, 15, 12, 0, 0, 0, time.UTC)
	solo := newTestRoom()
	if err := StartRun(solo, "catalog-solo", now); err != nil {
		t.Fatal(err)
	}
	entryEnemy := solo.Run.Rooms["entry"].Encounter.Enemies[0]
	if entryEnemy.ID != "sentinel" || entryEnemy.Health != 18 || entryEnemy.DefinitionID == "" {
		t.Fatalf("initial enemy = %+v, want sentinel health 18 and catalog reference", entryEnemy)
	}
	if got := solo.Run.Rooms["reliquary"].Encounter.Enemies[0].Health; got != 26 {
		t.Fatalf("solo reliquary guardian health = %d, want 26", got)
	}
	if got := solo.Run.Rooms["bone-gallery"].Encounter.Enemies[0].Health; got != 28 {
		t.Fatalf("solo bonebound guardian health = %d, want 28", got)
	}
	if got := solo.Run.Rooms["flooded-crossing"].Encounter.Enemies[0].Health; got != 19 {
		t.Fatalf("solo crossing scout health = %d, want 19", got)
	}
	if got := solo.Run.Rooms["warden"].Encounter.Enemies[0].Health; got != 63 {
		t.Fatalf("solo warden health = %d, want 63", got)
	}

	coop := newTestRoom()
	coop.PlayerIDs = []string{"player-1", "player-2"}
	if err := StartRun(coop, "catalog-coop", now); err != nil {
		t.Fatal(err)
	}
	if got := coop.Run.Rooms["reliquary"].Encounter.Enemies[0].Health; got != 45 {
		t.Fatalf("co-op reliquary guardian health = %d, want 45", got)
	}
	if got := coop.Run.Rooms["warden"].Encounter.Enemies[0].Health; got != 95 {
		t.Fatalf("co-op warden health = %d, want 95", got)
	}
}

func TestGeneratedFloorEncountersReferenceCatalogDefinitions(t *testing.T) {
	_, rooms := generateDungeonFloor(20261115, 3, 1)
	for roomID, room := range rooms {
		if room.Encounter == nil {
			continue
		}
		definition, err := defaultEncounterCatalog.Encounter(room.Encounter.DefinitionID)
		if err != nil {
			t.Fatalf("room %s has unknown encounter definition %q: %v", roomID, room.Encounter.DefinitionID, err)
		}
		if room.Encounter.Budget != definition.Budget || len(room.Encounter.Enemies) != len(definition.Enemies) {
			t.Fatalf("room %s runtime encounter %+v does not match definition %+v", roomID, room.Encounter, definition)
		}
	}
}
