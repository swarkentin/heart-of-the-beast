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
	if got := room.Run.Players["player-1"].Health; got != 25 {
		t.Fatalf("guard should reduce the guardian's 8 damage blow by 6, then the scout should deal 3, health=%d", got)
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
	if next := room.Run.Rooms["entry"].Encounter.Enemies[0].Intent; next == nil || next.TargetPlayerID != "player-1" {
		t.Fatalf("the next single-target intent should rotate to the first player, got %+v", next)
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

func TestPartyDefeatEndsTheRun(t *testing.T) {
	now := time.Date(2026, 11, 15, 12, 0, 0, 0, time.UTC)
	room := newTestRoom()
	if err := StartRun(room, "run-defeat", now); err != nil {
		t.Fatal(err)
	}
	room.Run.Players["player-1"].Health = 1
	room.Run.Rooms["entry"].Encounter.Enemies[0].Intent.Damage = 8
	room.Run.Rooms["entry"].Encounter.Enemies[0].Intent.Label = "Heavy blow"
	if err := ApplyCommand(room, "player-1", Command{Type: "combat", Round: 1, Action: "defend"}, now); err != nil {
		t.Fatal(err)
	}
	if room.Run.Phase != PhaseFailed || room.Run.CompletedAt == nil {
		t.Fatalf("the run should end when every player is down, phase=%s", room.Run.Phase)
	}
}

func TestPartyWideIntentAppliesGuardIndependently(t *testing.T) {
	now := time.Date(2026, 11, 15, 12, 0, 0, 0, time.UTC)
	room := newTestRoom()
	room.PlayerIDs = []string{"player-1", "player-2"}
	if err := StartRun(room, "run-sweep", now); err != nil {
		t.Fatal(err)
	}
	enemy := &room.Run.Rooms["entry"].Encounter.Enemies[0]
	enemy.Health = 20
	enemy.Intent = &EnemyIntent{Kind: "soul_sweep", Label: "Soul sweep", Damage: 3, TargetAll: true}

	if err := ApplyCommand(room, "player-1", Command{Type: "combat", Round: 1, Action: "defend"}, now); err != nil {
		t.Fatal(err)
	}
	if err := ApplyCommand(room, "player-2", Command{Type: "combat", Round: 1, Action: "attack", TargetID: "sentinel"}, now); err != nil {
		t.Fatal(err)
	}
	if got := room.Run.Players["player-1"].Health; got != 30 {
		t.Fatalf("guard should block the party-wide hit for player one, health=%d", got)
	}
	if got := room.Run.Players["player-2"].Health; got != 27 {
		t.Fatalf("unguarded player two should take the party-wide hit, health=%d", got)
	}
}

func TestInterruptCancelsEnemyIntentWithoutDamageOrHealing(t *testing.T) {
	now := time.Date(2026, 11, 15, 12, 0, 0, 0, time.UTC)
	room := newTestRoom()
	if err := StartRun(room, "run-interrupt", now); err != nil {
		t.Fatal(err)
	}
	enemy := &room.Run.Rooms["entry"].Encounter.Enemies[0]
	enemy.Health = 10
	enemy.Intent = &EnemyIntent{Kind: "soul_drain", Label: "Soul drain", Damage: 5, Heal: 2, Interruptible: true, TargetPlayerID: "player-1"}
	if err := SubmitCombatAction(room, "player-1", Command{Type: "combat", Round: 1, Action: "interrupt", TargetID: enemy.ID}, now); err != nil {
		t.Fatal(err)
	}
	if got := room.Run.Players["player-1"].Health; got != 30 {
		t.Fatalf("interrupted move should deal no damage, health=%d", got)
	}
	if got := enemy.Health; got != 10 {
		t.Fatalf("interrupted move should not heal enemy, health=%d", got)
	}
	interrupted := false
	for _, event := range room.Run.LastCombatEvents {
		if event.Kind == "player_interrupt" {
			interrupted = true
		}
		if event.Kind == "enemy_attack" || event.Kind == "enemy_heal" {
			t.Fatalf("interrupted intent should not resolve: %+v", event)
		}
	}
	if !interrupted {
		t.Fatalf("expected interrupt feedback, events=%+v", room.Run.LastCombatEvents)
	}
}

func TestInterruptIsRejectedForNonInterruptibleIntent(t *testing.T) {
	now := time.Date(2026, 11, 15, 12, 0, 0, 0, time.UTC)
	room := newTestRoom()
	if err := StartRun(room, "run-no-interrupt", now); err != nil {
		t.Fatal(err)
	}
	err := SubmitCombatAction(room, "player-1", Command{Type: "combat", Round: 1, Action: "interrupt", TargetID: "sentinel"}, now)
	if err != ErrInvalidTarget {
		t.Fatalf("expected non-interruptible target to be rejected, got %v", err)
	}
}


func TestReliquaryPairCreatesTwoReadableThreats(t *testing.T) {
	now := time.Date(2026, 11, 15, 12, 0, 0, 0, time.UTC)
	room := newTestRoom()
	if err := StartRun(room, "run-pair", now); err != nil { t.Fatal(err) }
	if err := ApplyCommand(room, "player-1", Command{Type: "combat", Round: 1, Action: "attack", TargetID: "sentinel"}, now); err != nil { t.Fatal(err) }
	if err := ApplyCommand(room, "player-1", Command{Type: "choose_exit", ExitID: "north"}, now); err != nil { t.Fatal(err) }
	encounter := room.Run.Rooms["reliquary"].Encounter
	if len(encounter.Enemies) != 2 { t.Fatalf("reliquary should contain a complementary pair, got %d enemies", len(encounter.Enemies)) }
	guardian, scout := encounter.Enemies[0], encounter.Enemies[1]
	if guardian.Behavior != "guardian" || guardian.Intent == nil || guardian.Intent.Damage != 8 { t.Fatalf("guardian should telegraph its heavy opening, got %+v", guardian) }
	if scout.Behavior != "scout" || scout.Intent == nil || scout.Intent.Damage != 3 { t.Fatalf("scout should telegraph its quick jab, got %+v", scout) }
}

func TestDefeatingOneEnemyOnlyCancelsItsOwnIntent(t *testing.T) {
	now := time.Date(2026, 11, 15, 12, 0, 0, 0, time.UTC)
	room := newTestRoom()
	if err := StartRun(room, "run-focus-fire", now); err != nil { t.Fatal(err) }
	if err := ApplyCommand(room, "player-1", Command{Type: "combat", Round: 1, Action: "attack", TargetID: "sentinel"}, now); err != nil { t.Fatal(err) }
	if err := ApplyCommand(room, "player-1", Command{Type: "choose_exit", ExitID: "north"}, now); err != nil { t.Fatal(err) }
	encounter := room.Run.Rooms["reliquary"].Encounter
	encounter.Enemies[0].Health = 10
	if err := ApplyCommand(room, "player-1", Command{Type: "combat", Round: 2, Action: "attack", TargetID: "guardian"}, now); err != nil { t.Fatal(err) }
	if encounter.Enemies[0].Health != 0 || encounter.Enemies[0].Intent != nil { t.Fatalf("defeated guardian should have no remaining intent, got %+v", encounter.Enemies[0]) }
	if encounter.Enemies[1].Health <= 0 { t.Fatal("the scout should remain alive after focusing the guardian") }
	if got := room.Run.Players["player-1"].Health; got != 27 { t.Fatalf("the surviving scout should still resolve its 3-damage jab, health=%d", got) }
}
