package game

import (
	"strings"
	"testing"
	"time"
)

func TestEnemyIntentIsVisibleAndDefendReducesIncomingDamage(t *testing.T) {
	now := time.Date(2026, 11, 15, 12, 0, 0, 0, time.UTC)
	room := newTestRoom()
	if err := StartRun(room, "run-telegraph", now); err != nil {
		t.Fatal(err)
	}
	intent := room.Run.Rooms["entry"].Encounter.Enemies[0].Intent
	if intent == nil || intent.Kind != "strike" || intent.TargetPlayerID != "player-1" || intent.Damage != 4 {
		t.Fatalf("expected a targeted sentinel strike telegraph, got %+v", intent)
	}

	if err := ApplyCommand(room, "player-1", Command{Type: "combat", Round: 1, Action: "defend"}, now); err != nil {
		t.Fatal(err)
	}
	if got := room.Run.Players["player-1"].Health; got != 30 {
		t.Fatalf("guard should fully block the sentinel's 4 damage strike, health=%d", got)
	}
	if len(room.Run.LastCombatEvents) < 2 || !strings.Contains(room.Run.LastCombatEvents[1].Message, "Guarded") {
		t.Fatalf("expected combat feedback to explain the blocked hit, events=%+v", room.Run.LastCombatEvents)
	}
	if next := room.Run.Rooms["entry"].Encounter.Enemies[0].Intent; next == nil {
		t.Fatal("the enemy should telegraph its next intent after resolving the round")
	}
}

func TestHeavyEnemyIntentCanBePartiallyBlocked(t *testing.T) {
	now := time.Date(2026, 11, 15, 12, 0, 0, 0, time.UTC)
	room := newTestRoom()
	if err := StartRun(room, "run-heavy", now); err != nil {
		t.Fatal(err)
	}
	if err := ApplyCommand(room, "player-1", Command{Type: "combat", Round: 1, Action: "attack", TargetID: "sentinel"}, now); err != nil {
		t.Fatal(err)
	}
	if err := ApplyCommand(room, "player-1", Command{Type: "choose_exit", ExitID: "north"}, now); err != nil {
		t.Fatal(err)
	}
	guardian := room.Run.Rooms["reliquary"].Encounter.Enemies[0]
	if guardian.Intent == nil || guardian.Intent.Kind != "heavy_strike" || guardian.Intent.Damage != 8 {
		t.Fatalf("guardian should telegraph its heavy blow, got %+v", guardian.Intent)
	}
	if err := ApplyCommand(room, "player-1", Command{Type: "combat", Round: 2, Action: "defend"}, now); err != nil {
		t.Fatal(err)
	}
	if got := room.Run.Players["player-1"].Health; got != 28 {
		t.Fatalf("guard should reduce the guardian's 8 damage blow by 6, health=%d", got)
	}
}

func TestCoopEnemyIntentTargetsOnePlayerAndGuardProtectsThatPlayer(t *testing.T) {
	now := time.Date(2026, 11, 15, 12, 0, 0, 0, time.UTC)
	room := newTestRoom()
	room.PlayerIDs = []string{"player-1", "player-2"}
	if err := StartRun(room, "run-targeting", now); err != nil {
		t.Fatal(err)
	}
	room.Run.Rooms["entry"].Encounter.Enemies[0].Health = 20
	intent := room.Run.Rooms["entry"].Encounter.Enemies[0].Intent
	if intent == nil || intent.TargetPlayerID != "player-2" {
		t.Fatalf("first enemy intent should target the second player in a two-player party, got %+v", intent)
	}
	if err := ApplyCommand(room, "player-1", Command{Type: "combat", Round: 1, Action: "attack", TargetID: "sentinel"}, now); err != nil {
		t.Fatal(err)
	}
	if err := ApplyCommand(room, "player-2", Command{Type: "combat", Round: 1, Action: "defend"}, now); err != nil {
		t.Fatal(err)
	}
	if got := room.Run.Players["player-1"].Health; got != 30 {
		t.Fatalf("untargeted player should take no damage, health=%d", got)
	}
	if got := room.Run.Players["player-2"].Health; got != 30 {
		t.Fatalf("targeted player should block the 4 damage strike, health=%d", got)
	}
}

func TestWardenSoulSweepTelegraphsPartyWideDamage(t *testing.T) {
	intent := buildEnemyIntent(&Enemy{Behavior: "warden"}, 3, 0, []string{"player-1", "player-2"})
	if intent.Kind != "soul_sweep" || !intent.TargetAll || intent.Damage != 3 {
		t.Fatalf("expected a party-wide soul sweep on every third round, got %+v", intent)
	}
}

func TestDefeatingEnemyCancelsItsTelegraphedIntent(t *testing.T) {
	now := time.Date(2026, 11, 15, 12, 0, 0, 0, time.UTC)
	room := newTestRoom()
	if err := StartRun(room, "run-interrupt", now); err != nil {
		t.Fatal(err)
	}
	if err := ApplyCommand(room, "player-1", Command{Type: "combat", Round: 1, Action: "attack", TargetID: "sentinel"}, now); err != nil {
		t.Fatal(err)
	}
	if got := room.Run.Players["player-1"].Health; got != 30 {
		t.Fatalf("defeating the sentinel should cancel its telegraphed strike, health=%d", got)
	}
	for _, event := range room.Run.LastCombatEvents {
		if event.Kind == "enemy_attack" {
			t.Fatalf("defeated enemy should not resolve an attack: %+v", event)
		}
	}
}
