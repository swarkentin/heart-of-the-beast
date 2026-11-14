package game

import (
	"errors"
	"testing"
	"time"
)

func newTestRoom() *Room {
	return &Room{ID: "room-1", PlayerIDs: []string{"player-1"}, Version: 1}
}

func TestSoloRunLifecycle(t *testing.T) {
	now := time.Date(2026, 11, 14, 12, 0, 0, 0, time.UTC)
	room := newTestRoom()
	if err := StartRun(room, "run-1", now); err != nil {
		t.Fatal(err)
	}
	if room.Run.Phase != PhaseCombat || room.Run.CurrentRoomID != "entry" {
		t.Fatalf("unexpected initial run state: %#v", room.Run)
	}
	if err := ApplyCommand(room, "player-1", Command{Type: "combat", Action: "attack", TargetID: "sentinel"}, now); err != nil {
		t.Fatal(err)
	}
	if room.Run.Phase != PhaseExploring || !room.Run.Rooms["entry"].Cleared {
		t.Fatal("defeating the sentinel should unlock exploration")
	}
	if err := ApplyCommand(room, "player-1", Command{Type: "choose_exit", ExitID: "north"}, now); err != nil {
		t.Fatal(err)
	}
	if room.Run.CurrentRoomID != "reliquary" || room.Run.Phase != PhaseCombat {
		t.Fatal("choosing the north exit should start the next encounter")
	}
}

func TestRunRejectsInvalidTransitionsAndActors(t *testing.T) {
	now := time.Now().UTC()
	room := newTestRoom()
	if err := ApplyCommand(room, "player-1", Command{Type: "choose_exit", ExitID: "north"}, now); !errors.Is(err, ErrRunNotStarted) {
		t.Fatalf("expected run-not-started error, got %v", err)
	}
	if err := StartRun(room, "run-1", now); err != nil {
		t.Fatal(err)
	}
	if err := ApplyCommand(room, "outsider", Command{Type: "combat", Action: "attack", TargetID: "sentinel"}, now); !errors.Is(err, ErrNotPlayer) {
		t.Fatalf("expected not-player error, got %v", err)
	}
	if err := ApplyCommand(room, "player-1", Command{Type: "choose_exit", ExitID: "north"}, now); !errors.Is(err, ErrInvalidPhase) {
		t.Fatalf("expected invalid-phase error, got %v", err)
	}
	if err := ApplyCommand(room, "player-1", Command{Type: "combat", Action: "attack", TargetID: "missing"}, now); !errors.Is(err, ErrInvalidTarget) {
		t.Fatalf("expected invalid-target error, got %v", err)
	}
}

func TestBossDefeatCompletesRun(t *testing.T) {
	now := time.Now().UTC()
	room := newTestRoom()
	if err := StartRun(room, "run-1", now); err != nil {
		t.Fatal(err)
	}
	if err := ApplyCommand(room, "player-1", Command{Type: "combat", Action: "attack", TargetID: "sentinel"}, now); err != nil {
		t.Fatal(err)
	}
	if err := ApplyCommand(room, "player-1", Command{Type: "choose_exit", ExitID: "north"}, now); err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 2; i++ {
		if err := ApplyCommand(room, "player-1", Command{Type: "combat", Action: "attack", TargetID: "guardian"}, now); err != nil {
			t.Fatal(err)
		}
	}
	if err := ApplyCommand(room, "player-1", Command{Type: "choose_exit", ExitID: "east"}, now); err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 3; i++ {
		if err := ApplyCommand(room, "player-1", Command{Type: "combat", Action: "attack", TargetID: "warden"}, now); err != nil {
			t.Fatal(err)
		}
	}
	if room.Run.Phase != PhaseCompleted || room.Run.CompletedAt == nil {
		t.Fatal("defeating the boss should complete the run")
	}
}
