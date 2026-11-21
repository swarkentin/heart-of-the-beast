package game

import "testing"

// The clients play a prologue before the first briefing of a run and a descent between floors (ADR 0039). The
// server pays for both with time on the round they cover, so watching them never costs anyone a turn.

func TestFirstRoundOfARunAllowsForThePrologueAndTheBriefing(t *testing.T) {
	room := startExpedition(t, 2, DefaultDungeonThemeID, "prologue-run")
	round := room.Run.CombatRound
	if round == nil {
		t.Fatal("a run should open on a combat round")
	}
	if want := round.StartedAt.Add(CombatActionWindow + DungeonBriefingWindow + RunPrologueWindow); !round.Deadline.Equal(want) {
		t.Fatalf("first round deadline %v, want %v", round.Deadline, want)
	}
}

func TestFirstRoundOfANewFloorAllowsForTheDescent(t *testing.T) {
	room := startExpedition(t, 1, DefaultDungeonThemeID, "descent-run")
	if err := ApplyCommand(room, "player-1", Command{Type: "cheat_idkfa"}, expeditionNow); err != nil {
		t.Fatal(err)
	}
	run := room.Run
	if run.Depth != 2 || run.CombatRound == nil {
		t.Fatalf("expected a combat round on floor 2, got depth %d round %+v", run.Depth, run.CombatRound)
	}
	if want := run.CombatRound.StartedAt.Add(CombatActionWindow + FloorTransitionWindow); !run.CombatRound.Deadline.Equal(want) {
		t.Fatalf("first round on a new floor: deadline %v, want %v", run.CombatRound.Deadline, want)
	}
}
