package game

import (
	"testing"
	"time"
)

// The clients play a prologue before the first briefing of a run, a briefing at each new dungeon and a descent
// between floors (ADR 0039). The round behind them is held: its countdown starts when every player's screen is
// ready, or when the hold runs out, so nobody is caught off guard.

func TestFirstRoundOfARunIsHeldForThePrologueAndTheBriefing(t *testing.T) {
	room := startExpedition(t, 2, DefaultDungeonThemeID, "prologue-run")
	round := room.Run.CombatRound
	if round == nil {
		t.Fatal("a run should open on a combat round")
	}
	if !round.Held || !round.StartedAt.Equal(expeditionNow.Add(DungeonBriefingWindow+RunPrologueWindow)) || !round.Deadline.Equal(round.StartedAt.Add(CombatActionWindow)) {
		t.Fatalf("held for the prologue and briefing, then a full action window: %+v", round)
	}
}

func TestFirstRoundOfANewFloorIsHeldForTheDescent(t *testing.T) {
	room := startExpedition(t, 1, DefaultDungeonThemeID, "descent-run")
	if err := ApplyCommand(room, "player-1", Command{Type: "cheat_idkfa"}, expeditionNow); err != nil {
		t.Fatal(err)
	}
	round := room.Run.CombatRound
	if room.Run.Depth != 2 || round == nil {
		t.Fatalf("expected a combat round on floor 2, got depth %d", room.Run.Depth)
	}
	if !round.Held || !round.StartedAt.Equal(expeditionNow.Add(FloorTransitionWindow)) || !round.Deadline.Equal(round.StartedAt.Add(CombatActionWindow)) {
		t.Fatalf("held for the descent, then a full action window: %+v", round)
	}
}

func TestTheCountdownStartsWhenEveryPlayerIsReady(t *testing.T) {
	room := startExpedition(t, 2, DefaultDungeonThemeID, "ready-run")
	round := room.Run.CombatRound
	held := round.StartedAt
	later := expeditionNow.Add(12 * time.Second)
	if err := ApplyCommand(room, "player-1", Command{Type: "combat_ready", Round: round.Number}, later); err != nil {
		t.Fatal(err)
	}
	if !round.Held || !round.StartedAt.Equal(held) {
		t.Fatalf("one player ready is not everyone: %+v", round)
	}
	// Choosing an action also counts as ready.
	command := Command{Type: "combat", Round: round.Number, Action: "defend"}
	if err := ApplyCommand(room, "player-2", command, later); err != nil {
		t.Fatal(err)
	}
	if round.Held || !round.StartedAt.Equal(later) || !round.Deadline.Equal(later.Add(CombatActionWindow)) {
		t.Fatalf("with everyone ready the countdown starts now, with a full window: %+v", round)
	}
	if err := ApplyCommand(room, "player-1", Command{Type: "combat_ready", Round: round.Number}, later.Add(time.Second)); err != nil {
		t.Fatal("being ready again is harmless:", err)
	}
	if !round.StartedAt.Equal(later) {
		t.Fatal("a late ready never restarts the countdown")
	}
	if err := ApplyCommand(room, "player-1", Command{Type: "combat_ready", Round: round.Number + 1}, later); err != ErrStaleCombatRound {
		t.Fatalf("ready for the wrong round: %v", err)
	}
}

func TestAHoldRunsOutEvenIfSomeoneNeverGetsReady(t *testing.T) {
	room := startExpedition(t, 2, DefaultDungeonThemeID, "afk-run")
	round := room.Run.CombatRound
	if err := ApplyCommand(room, "player-1", Command{Type: "combat_ready", Round: round.Number}, expeditionNow); err != nil {
		t.Fatal(err)
	}
	number := round.Number
	AdvanceCombatRound(room, round.Deadline)
	if room.Run.CombatRound != nil && room.Run.CombatRound.Number == number {
		t.Fatal("the held round still resolves at its deadline")
	}
}
