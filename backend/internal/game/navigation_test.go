package game

import (
	"testing"
	"time"
)

func coopExploringRoom(t *testing.T, playerIDs ...string) (*Room, time.Time) {
	t.Helper()
	now := time.Date(2026, 11, 14, 12, 0, 0, 0, time.UTC)
	room := newTestRoom()
	room.PlayerIDs = playerIDs
	if err := StartRun(room, "run-navigation", now); err != nil {
		t.Fatal(err)
	}
	withoutReinforcements(room, "entry")
	room.Run.Rooms["entry"].Encounter.Enemies[0].Health = 2 * PlayerStrikeDamage
	for index, playerID := range playerIDs {
		action := Command{Type: "combat", Round: 1, Action: "defend"}
		if index < 2 {
			action = Command{Type: "combat", Round: 1, Action: "attack", TargetID: "sentinel"}
		}
		if err := ApplyCommand(room, playerID, action, now); err != nil {
			t.Fatal(err)
		}
	}
	if room.Run.Phase != PhaseExploring || room.Run.NavigationVote == nil {
		t.Fatalf("expected an active party path vote after the encounter, got phase=%s vote=%+v", room.Run.Phase, room.Run.NavigationVote)
	}
	return room, now
}

func TestCoopNavigationVoteUsesMajority(t *testing.T) {
	room, now := coopExploringRoom(t, "player-1", "player-2", "player-3")
	if err := ApplyCommand(room, "player-1", Command{Type: "choose_exit", ExitID: "north"}, now); err != nil {
		t.Fatal(err)
	}
	if err := ApplyCommand(room, "player-2", Command{Type: "choose_exit", ExitID: "north"}, now); err != nil {
		t.Fatal(err)
	}
	if room.Run.Phase != PhaseExploring {
		t.Fatal("the party should continue voting until every eligible player has voted or the deadline passes")
	}
	if err := ApplyCommand(room, "player-3", Command{Type: "choose_exit", ExitID: "south"}, now); err != nil {
		t.Fatal(err)
	}
	if room.Run.CurrentRoomID != "reliquary" || room.Run.Phase != PhaseCombat {
		t.Fatalf("two votes for north should win, current room=%q phase=%q", room.Run.CurrentRoomID, room.Run.Phase)
	}
	if room.Run.NavigationVote != nil {
		t.Fatal("resolved navigation vote should be cleared")
	}
}

func TestCoopNavigationTieBreakSelectsOneOfTiedPathsAtRandom(t *testing.T) {
	room, now := coopExploringRoom(t, "player-1", "player-2")
	if err := ApplyCommand(room, "player-1", Command{Type: "choose_exit", ExitID: "north"}, now); err != nil {
		t.Fatal(err)
	}
	if err := ApplyCommand(room, "player-2", Command{Type: "choose_exit", ExitID: "south"}, now); err != nil {
		t.Fatal(err)
	}
	if room.Run.Phase != PhaseCombat || room.Run.NavigationVote != nil {
		t.Fatal("a fully submitted tie should resolve immediately")
	}
	if room.Run.CurrentRoomID != "reliquary" && room.Run.CurrentRoomID != "flooded-crossing" {
		t.Fatalf("random tie-break selected an unknown destination %q", room.Run.CurrentRoomID)
	}
}

func TestNavigationVoteDeadlineResolvesSubmittedVotes(t *testing.T) {
	room, now := coopExploringRoom(t, "player-1", "player-2")
	if err := ApplyCommand(room, "player-1", Command{Type: "choose_exit", ExitID: "north"}, now); err != nil {
		t.Fatal(err)
	}
	if !AdvanceNavigationVote(room, now.Add(NavigationVoteWindow)) {
		t.Fatal("navigation vote should resolve at its deadline")
	}
	if room.Run.CurrentRoomID != "reliquary" || room.Run.Phase != PhaseCombat {
		t.Fatalf("the only submitted vote should win at timeout, current room=%q phase=%q", room.Run.CurrentRoomID, room.Run.Phase)
	}
}

func TestNavigationVoteWithNoVotesUsesRandomAvailablePath(t *testing.T) {
	room, now := coopExploringRoom(t, "player-1", "player-2")
	if !AdvanceNavigationVote(room, now.Add(NavigationVoteWindow)) {
		t.Fatal("navigation vote should resolve at its deadline")
	}
	if room.Run.CurrentRoomID != "reliquary" && room.Run.CurrentRoomID != "flooded-crossing" {
		t.Fatalf("no-vote fallback selected an unknown destination %q", room.Run.CurrentRoomID)
	}
}

func TestNavigationVoteRejectsUnavailableExit(t *testing.T) {
	room, now := coopExploringRoom(t, "player-1", "player-2")
	if err := ApplyCommand(room, "player-1", Command{Type: "choose_exit", ExitID: "missing"}, now); err != ErrInvalidExit {
		t.Fatalf("expected invalid exit, got %v", err)
	}
	if len(room.Run.NavigationVote.Votes) != 0 {
		t.Fatal("invalid path must not be recorded as a vote")
	}
}
