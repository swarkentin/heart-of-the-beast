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
	if err := ApplyCommand(room, "player-1", Command{Type: "combat", Round: 1, Action: "attack", TargetID: "sentinel"}, now); err != nil {
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
	if err := ApplyCommand(room, "outsider", Command{Type: "combat", Round: 1, Action: "attack", TargetID: "sentinel"}, now); !errors.Is(err, ErrNotPlayer) {
		t.Fatalf("expected not-player error, got %v", err)
	}
	if err := ApplyCommand(room, "player-1", Command{Type: "choose_exit", ExitID: "north"}, now); !errors.Is(err, ErrInvalidPhase) {
		t.Fatalf("expected invalid-phase error, got %v", err)
	}
	if err := ApplyCommand(room, "player-1", Command{Type: "combat", Round: 1, Action: "attack", TargetID: "missing"}, now); !errors.Is(err, ErrInvalidTarget) {
		t.Fatalf("expected invalid-target error, got %v", err)
	}
}

func TestBossDefeatCompletesRun(t *testing.T) {
	now := time.Date(2026, 11, 14, 12, 0, 0, 0, time.UTC)
	room := newTestRoom()
	if err := StartRun(room, "run-1", now); err != nil {
		t.Fatal(err)
	}
	clearEncounter := func() {
		for room.Run.Phase == PhaseCombat {
			current := room.Run.Rooms[room.Run.CurrentRoomID]
			for _, enemy := range current.Encounter.Enemies {
				if enemy.Health <= 0 {
					continue
				}
				room.Run.Players["player-1"].Health = 100
				if err := ApplyCommand(room, "player-1", Command{Type: "combat", Round: room.Run.CombatRound.Number, Action: "attack", TargetID: enemy.ID}, now); err != nil {
					t.Fatal(err)
				}
			}
		}
	}
	chooseExit := func(id string) {
		if err := ApplyCommand(room, "player-1", Command{Type: "choose_exit", ExitID: id}, now); err != nil {
			t.Fatal(err)
		}
	}
	chooseEvent := func(id string) {
		if err := ApplyCommand(room, "player-1", Command{Type: "choose_event", ChoiceID: id}, now); err != nil {
			t.Fatal(err)
		}
	}

	clearEncounter()
	chooseExit("north")
	clearEncounter()
	chooseExit("east")
	chooseEvent("study")
	chooseExit("north")
	clearEncounter()
	chooseExit("west")
	chooseEvent("rescue")
	chooseExit("east")
	chooseEvent("ember")
	chooseExit("north")
	clearEncounter()
	chooseExit("north")
	clearEncounter()

	if room.Run.Phase != PhaseCompleted || room.Run.CompletedAt == nil {
		t.Fatal("defeating the boss should complete the run")
	}
	if !room.Run.Flags["warden_weakness"] || !room.Run.Flags["archivist_rescued"] || !room.Run.Flags["emberheart"] {
		t.Fatalf("expected exploration, side mission, and relic rewards to persist: %#v", room.Run.Flags)
	}
}

func TestCoopCombatActionsResolveTogether(t *testing.T) {
	now := time.Date(2026, 11, 14, 12, 0, 0, 0, time.UTC)
	room := newTestRoom()
	room.PlayerIDs = []string{"player-1", "player-2"}
	if err := StartRun(room, "run-coop", now); err != nil {
		t.Fatal(err)
	}

	first := Command{Type: "combat", Round: 1, Action: "attack", TargetID: "sentinel"}
	if err := ApplyCommand(room, "player-1", first, now); err != nil {
		t.Fatal(err)
	}
	if got := room.Run.Rooms["entry"].Encounter.Enemies[0].Health; got != 10 {
		t.Fatalf("first player's action resolved before the party submitted: health=%d", got)
	}
	if err := ApplyCommand(room, "player-1", first, now); !errors.Is(err, ErrRoundActionSubmitted) {
		t.Fatalf("expected duplicate action to be rejected, got %v", err)
	}
	if err := ApplyCommand(room, "player-2", Command{Type: "combat", Round: 1, Action: "attack", TargetID: "sentinel"}, now); err != nil {
		t.Fatal(err)
	}
	if room.Run.Phase != PhaseExploring || room.Run.Rooms["entry"].Encounter.Enemies[0].Health != 0 {
		t.Fatal("both submitted attacks should resolve together and clear the encounter")
	}
	if room.Run.CombatRound != nil {
		t.Fatal("a cleared encounter should not retain an active combat round")
	}
}

func TestCombatRoundDeadlineDefaultsMissingPlayersToDefend(t *testing.T) {
	now := time.Date(2026, 11, 14, 12, 0, 0, 0, time.UTC)
	room := newTestRoom()
	room.PlayerIDs = []string{"player-1", "player-2"}
	if err := StartRun(room, "run-timeout", now); err != nil {
		t.Fatal(err)
	}
	room.Run.Players["player-2"].Health = 20
	room.Run.Rooms["entry"].Encounter.Enemies[0].Health = 20
	if err := ApplyCommand(room, "player-1", Command{Type: "combat", Round: 1, Action: "attack", TargetID: "sentinel"}, now); err != nil {
		t.Fatal(err)
	}
	if !AdvanceCombatRound(room, now.Add(CombatActionWindow)) {
		t.Fatal("round should resolve when its deadline is reached")
	}
	if got := room.Run.Players["player-2"].Health; got != 20 {
		t.Fatalf("missing action should default to guard and block the telegraphed hit, health=%d", got)
	}
	if got := room.Run.Rooms["entry"].Encounter.Enemies[0].Health; got != 10 {
		t.Fatalf("submitted attack should resolve at deadline, enemy health=%d", got)
	}
}

func TestCombatRejectsActionFromExpiredRound(t *testing.T) {
	now := time.Date(2026, 11, 14, 12, 0, 0, 0, time.UTC)
	room := newTestRoom()
	room.PlayerIDs = []string{"player-1", "player-2"}
	if err := StartRun(room, "run-stale", now); err != nil {
		t.Fatal(err)
	}
	room.Run.Rooms["entry"].Encounter.Enemies[0].Health = 20
	if err := ApplyCommand(room, "player-1", Command{Type: "combat", Round: 1, Action: "attack", TargetID: "sentinel"}, now); err != nil {
		t.Fatal(err)
	}
	err := ApplyCommand(room, "player-2", Command{Type: "combat", Round: 1, Action: "attack", TargetID: "sentinel"}, now.Add(CombatActionWindow))
	if !errors.Is(err, ErrStaleCombatRound) {
		t.Fatalf("expected stale round error, got %v", err)
	}
	if room.Run.CombatRound.Number != 2 {
		t.Fatalf("expected late command to advance to round 2, got %d", room.Run.CombatRound.Number)
	}
}
