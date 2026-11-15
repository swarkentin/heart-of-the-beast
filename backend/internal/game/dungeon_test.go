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
	if err := ApplyCommand(room, "player-2", Command{Type: "choose_inter_floor", ChoiceID: "perk"}, now); err != nil {
		t.Fatal(err)
	}
	for _, id := range room.PlayerIDs {
		if run.Players[id].StrikeDamage != before+1 || run.Players[id].GuardReduction != GuardDamageReduction+1 {
			t.Fatalf("perk should grant every party member +1 strike and guard, player=%s state=%+v", id, run.Players[id])
		}
	}
}