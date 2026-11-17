package game

import (
	"errors"
	"testing"
	"time"
)

func TestRoomEventRewardsAreAuthoritativeAndPartyWide(t *testing.T) {
	now := time.Date(2026, 11, 14, 12, 0, 0, 0, time.UTC)
	room := newTestRoom()
	room.PlayerIDs = []string{"player-1", "player-2"}
	if err := StartRun(room, "run-events", now); err != nil {
		t.Fatal(err)
	}
	room.Run.CurrentRoomID = "archive"
	room.Run.Phase = PhaseExploring
	room.Run.CombatRound = nil
	if err := ChooseRoomEvent(room, "player-1", "study", now); err != nil {
		t.Fatal(err)
	}
	if !room.Run.Flags["warden_weakness"] {
		t.Fatal("studying the inscription should record the Warden weakness")
	}
	for _, player := range room.Run.Players {
		if player.StrikeDamage != PlayerStrikeDamage {
			t.Fatalf("studying the inscription should not change ordinary Strike damage, got %d", player.StrikeDamage)
		}
	}
	if !room.Run.Rooms["archive"].Cleared || !room.Run.Rooms["archive"].Event.Resolved {
		t.Fatal("resolving the inscription should clear the room")
	}
	if err := ChooseRoomEvent(room, "player-2", "leave", now); !errors.Is(err, ErrInvalidPhase) {
		t.Fatalf("a room event must only resolve once, got %v", err)
	}
}

func TestEventRoomCannotBeSkippedWithoutResolvingChoice(t *testing.T) {
	now := time.Date(2026, 11, 14, 12, 0, 0, 0, time.UTC)
	room := newTestRoom()
	if err := StartRun(room, "run-event-gate", now); err != nil {
		t.Fatal(err)
	}
	room.Run.CurrentRoomID = "archive"
	room.Run.Phase = PhaseExploring
	room.Run.CombatRound = nil
	if err := SubmitNavigationVote(room, "player-1", "north", now); !errors.Is(err, ErrInvalidPhase) {
		t.Fatalf("unresolved event should block navigation, got %v", err)
	}
	if room.Run.CurrentRoomID != "archive" {
		t.Fatal("unresolved event should keep the party in the room")
	}
}

func TestTreasureChoiceChangesCombatBuild(t *testing.T) {
	now := time.Date(2026, 11, 14, 12, 0, 0, 0, time.UTC)
	room := newTestRoom()
	if err := StartRun(room, "run-relic", now); err != nil {
		t.Fatal(err)
	}
	room.Run.CurrentRoomID = "reliquary-vault"
	room.Run.Phase = PhaseExploring
	room.Run.CombatRound = nil
	if err := ChooseRoomEvent(room, "player-1", "stone", now); err != nil {
		t.Fatal(err)
	}
	if got := room.Run.Players["player-1"].GuardReduction; got != GuardDamageReduction+4 {
		t.Fatalf("Stoneward should improve defense by four, got %d", got)
	}
	if !room.Run.Flags["stoneward"] {
		t.Fatal("the selected relic should be recorded on the run")
	}
}

func TestInscriptionBonusAppliesOnlyAgainstTheWarden(t *testing.T) {
	now := time.Date(2026, 11, 14, 12, 0, 0, 0, time.UTC)
	room := newTestRoom()
	if err := StartRun(room, "run-weakness", now); err != nil {
		t.Fatal(err)
	}
	room.Run.Flags["warden_weakness"] = true
	room.Run.CurrentRoomID = "warden"
	room.Run.Phase = PhaseCombat
	startCombatRound(room, now)
	if err := ApplyCommand(room, "player-1", Command{Type: "combat", Round: room.Run.CombatRound.Number, Action: "skill", Skill: SkillStrike, TargetID: "warden"}, now); err != nil {
		t.Fatal(err)
	}
	if got := room.Run.Rooms["warden"].Encounter.Enemies[0].Health; got != 37 {
		t.Fatalf("the Warden should lose 8 Strike damage, then recover 2 from Soul Drain, health=%d", got)
	}
	if len(room.Run.LastCombatEvents) == 0 || room.Run.LastCombatEvents[0].Message != "Adventurer 1's Strike hits Crypt Warden for 8 damage." {
		t.Fatalf("the inscription should add two Strike damage against the Warden, events=%+v", room.Run.LastCombatEvents)
	}
	var bossHeal *CombatEvent
	for i := range room.Run.LastCombatEvents {
		if room.Run.LastCombatEvents[i].Effect == "heal" && room.Run.LastCombatEvents[i].TargetType == "enemy" {
			bossHeal = &room.Run.LastCombatEvents[i]
			break
		}
	}
	if bossHeal == nil || bossHeal.TargetID != "warden" || bossHeal.Amount != 2 {
		t.Fatalf("Soul Drain should show the Warden healing for two, got %+v", bossHeal)
	}
}

func TestRescuingArchivistRestoresLivingPartyMembers(t *testing.T) {
	now := time.Date(2026, 11, 14, 12, 0, 0, 0, time.UTC)
	room := newTestRoom()
	room.PlayerIDs = []string{"player-1", "player-2"}
	if err := StartRun(room, "run-rescue", now); err != nil {
		t.Fatal(err)
	}
	room.Run.Players["player-1"].Health = 17
	room.Run.Players["player-2"].Health = 0
	room.Run.CurrentRoomID = "captive-cell"
	room.Run.Phase = PhaseExploring
	room.Run.CombatRound = nil
	if err := ChooseRoomEvent(room, "player-1", "rescue", now); err != nil {
		t.Fatal(err)
	}
	if got := room.Run.Players["player-1"].Health; got != 27 {
		t.Fatalf("rescue should restore ten health to living players, got %d", got)
	}
	if len(room.Run.LastCombatEvents) != 1 || room.Run.LastCombatEvents[0].Effect != "heal" || room.Run.LastCombatEvents[0].TargetID != "player-1" || room.Run.LastCombatEvents[0].Amount != 10 {
		t.Fatalf("rescue should emit a structured +10 healing impact, events=%+v", room.Run.LastCombatEvents)
	}
	if got := room.Run.Players["player-2"].Health; got != 0 {
		t.Fatalf("rescue should not revive a defeated player, got %d", got)
	}
	if !room.Run.Flags["archivist_rescued"] {
		t.Fatal("rescue objective should be recorded")
	}
}

func TestOpeningRoutesTradeDamageForRecovery(t *testing.T) {
	now := time.Date(2026, 11, 14, 12, 0, 0, 0, time.UTC)

	reliquary := newTestRoom()
	if err := StartRun(reliquary, "run-sigil", now); err != nil {
		t.Fatal(err)
	}
	reliquary.Run.CurrentRoomID = "reliquary"
	reliquary.Run.Phase = PhaseCombat
	startCombatRound(reliquary, now)
	for i := range reliquary.Run.Rooms["reliquary"].Encounter.Enemies {
		reliquary.Run.Rooms["reliquary"].Encounter.Enemies[i].Health = 0
	}
	resolveCombatRound(reliquary, now)
	if got := reliquary.Run.Players["player-1"].StrikeDamage; got != 7 {
		t.Fatalf("the harder Reliquary route should reward +1 Strike damage, got %d", got)
	}
	if !reliquary.Run.Flags["reliquary_sigil"] {
		t.Fatal("the Reliquary reward should be recorded")
	}

	crossing := newTestRoom()
	if err := StartRun(crossing, "run-cache", now); err != nil {
		t.Fatal(err)
	}
	crossing.Run.CurrentRoomID = "flooded-crossing"
	crossing.Run.Phase = PhaseCombat
	crossing.Run.Players["player-1"].Health = 20
	startCombatRound(crossing, now)
	crossing.Run.Rooms["flooded-crossing"].Encounter.Enemies[0].Health = 0
	resolveCombatRound(crossing, now)
	if got := crossing.Run.Players["player-1"].Health; got != 28 {
		t.Fatalf("the safer Crossing route should restore 8 health, got %d", got)
	}
	if !crossing.Run.Flags["crossing_cache"] {
		t.Fatal("the Crossing reward should be recorded")
	}
}
