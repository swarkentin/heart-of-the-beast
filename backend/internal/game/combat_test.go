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
	guardedMessage := false
	for _, event := range room.Run.LastCombatEvents {
		if event.Kind == "enemy_attack" && strings.Contains(event.Message, "Guarded") {
			guardedMessage = true
		}
	}
	if !guardedMessage {
		t.Fatalf("expected combat feedback to explain the blocked hit, events=%+v", room.Run.LastCombatEvents)
	}
	var blocked *CombatEvent
	for i := range room.Run.LastCombatEvents {
		if room.Run.LastCombatEvents[i].Effect == "block" {
			blocked = &room.Run.LastCombatEvents[i]
			break
		}
	}
	if blocked == nil || blocked.TargetID != "player-1" || blocked.TargetType != "player" || blocked.Amount != 4 {
		t.Fatalf("expected structured blocked-damage feedback for the targeted player, got %+v", blocked)
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
	var dealt *CombatEvent
	for i := range room.Run.LastCombatEvents {
		if room.Run.LastCombatEvents[i].Effect == "damage" && room.Run.LastCombatEvents[i].TargetType == "enemy" {
			dealt = &room.Run.LastCombatEvents[i]
			break
		}
	}
	if dealt == nil || dealt.TargetID != "sentinel" || dealt.Amount != 10 {
		t.Fatalf("expected structured damage dealt feedback for the sentinel, got %+v", dealt)
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
	var impact *CombatEvent
	for i := range room.Run.LastCombatEvents {
		if room.Run.LastCombatEvents[i].Effect == "damage" && room.Run.LastCombatEvents[i].TargetType == "player" {
			impact = &room.Run.LastCombatEvents[i]
			break
		}
	}
	if impact == nil || impact.TargetID != "player-1" || impact.Amount != 1 {
		t.Fatalf("incoming damage feedback should report the one health actually lost, got %+v", impact)
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
	if err := StartRun(room, "run-pair", now); err != nil {
		t.Fatal(err)
	}
	if err := ApplyCommand(room, "player-1", Command{Type: "combat", Round: 1, Action: "attack", TargetID: "sentinel"}, now); err != nil {
		t.Fatal(err)
	}
	if err := ApplyCommand(room, "player-1", Command{Type: "choose_exit", ExitID: "north"}, now); err != nil {
		t.Fatal(err)
	}
	encounter := room.Run.Rooms["reliquary"].Encounter
	if len(encounter.Enemies) != 2 {
		t.Fatalf("reliquary should contain a complementary pair, got %d enemies", len(encounter.Enemies))
	}
	guardian, scout := encounter.Enemies[0], encounter.Enemies[1]
	if guardian.Behavior != "guardian" || guardian.Intent == nil || guardian.Intent.Damage != 8 {
		t.Fatalf("guardian should telegraph its heavy opening, got %+v", guardian)
	}
	if scout.Behavior != "scout" || scout.Intent == nil || scout.Intent.Damage != 3 {
		t.Fatalf("scout should telegraph its quick jab, got %+v", scout)
	}
}

func TestDefeatingOneEnemyOnlyCancelsItsOwnIntent(t *testing.T) {
	now := time.Date(2026, 11, 15, 12, 0, 0, 0, time.UTC)
	room := newTestRoom()
	if err := StartRun(room, "run-focus-fire", now); err != nil {
		t.Fatal(err)
	}
	if err := ApplyCommand(room, "player-1", Command{Type: "combat", Round: 1, Action: "attack", TargetID: "sentinel"}, now); err != nil {
		t.Fatal(err)
	}
	if err := ApplyCommand(room, "player-1", Command{Type: "choose_exit", ExitID: "north"}, now); err != nil {
		t.Fatal(err)
	}
	encounter := room.Run.Rooms["reliquary"].Encounter
	encounter.Enemies[0].Health = 10
	if err := ApplyCommand(room, "player-1", Command{Type: "combat", Round: 2, Action: "attack", TargetID: "guardian"}, now); err != nil {
		t.Fatal(err)
	}
	if encounter.Enemies[0].Health != 0 || encounter.Enemies[0].Intent != nil {
		t.Fatalf("defeated guardian should have no remaining intent, got %+v", encounter.Enemies[0])
	}
	if encounter.Enemies[1].Health <= 0 {
		t.Fatal("the scout should remain alive after focusing the guardian")
	}
	if got := room.Run.Players["player-1"].Health; got != 27 {
		t.Fatalf("the surviving scout should still resolve its 3-damage jab, health=%d", got)
	}
}

func newClassCombatTestRoom(t *testing.T, classID string, playerIDs ...string) (*Room, time.Time) {
	t.Helper()
	now := time.Date(2026, 11, 15, 12, 0, 0, 0, time.UTC)
	if len(playerIDs) == 0 {
		playerIDs = []string{"player-1"}
	}
	room := newTestRoom()
	room.PlayerIDs = playerIDs
	room.PlayerClasses = map[string]string{playerIDs[0]: classID}
	room.PlayerArchetypes = map[string]string{playerIDs[0]: "damage"}
	if err := StartRun(room, "run-class-"+classID, now); err != nil {
		t.Fatalf("start class run: %v", err)
	}
	return room, now
}

func TestClassAbilityHandlersAreRegisteredAndCatalogValid(t *testing.T) {
	if err := ValidateCatalog(); err != nil {
		t.Fatalf("class catalog and effect handlers should validate: %v", err)
	}
	if len(classAbilityHandlers) != len(classAbilities) || len(classPassiveHandlers) != len(classPassives) {
		t.Fatalf("every catalog ability and passive must have a registered handler")
	}
}

func TestBulwarkShieldWallBlocksHeavyAttackAndEmpowersNextStrike(t *testing.T) {
	room, now := newClassCombatTestRoom(t, ClassBulwark)
	enemy := &room.Run.Rooms["entry"].Encounter.Enemies[0]
	enemy.Health, enemy.MaxHealth = 30, 30
	enemy.Intent = &EnemyIntent{Kind: "heavy_strike", Label: "Heavy blow", Damage: 8, TargetPlayerID: "player-1"}
	if err := ApplyCommand(room, "player-1", Command{Type: "combat", Round: 1, Action: "ability"}, now); err != nil {
		t.Fatal(err)
	}
	player := room.Run.Players["player-1"]
	if player.Health != player.MaxHealth || !player.ClassCombat.ResolveReady {
		t.Fatalf("Shield Wall should block the heavy hit and prime Resolve: player=%+v", player)
	}
	if err := ApplyCommand(room, "player-1", Command{Type: "combat", Round: 2, Action: "attack", TargetID: enemy.ID}, now); err != nil {
		t.Fatal(err)
	}
	var attack *CombatEvent
	for i := range room.Run.LastCombatEvents {
		event := &room.Run.LastCombatEvents[i]
		if event.Kind == "player_attack" {
			attack = event
		}
	}
	if attack == nil || attack.Amount != 15 {
		t.Fatalf("Resolve should add 3 damage to the next strike, got %+v", attack)
	}
}

func TestJuggernautReckoningUsesDamageAbsorbedInPreviousRound(t *testing.T) {
	room, now := newClassCombatTestRoom(t, ClassJuggernaut)
	enemy := &room.Run.Rooms["entry"].Encounter.Enemies[0]
	enemy.Health, enemy.MaxHealth = 50, 50
	enemy.Intent = &EnemyIntent{Kind: "strike", Label: "Strike", Damage: 12, TargetPlayerID: "player-1"}
	if err := ApplyCommand(room, "player-1", Command{Type: "combat", Round: 1, Action: "attack", TargetID: enemy.ID}, now); err != nil {
		t.Fatal(err)
	}
	player := room.Run.Players["player-1"]
	if player.ClassCombat.DamageTakenLastRound != 11 {
		t.Fatalf("expected 11 damage recorded for Reckoning, got %+v", player.ClassCombat)
	}
	if err := ApplyCommand(room, "player-1", Command{Type: "combat", Round: 2, Action: "ability", TargetID: enemy.ID}, now); err != nil {
		t.Fatal(err)
	}
	found := false
	for _, event := range room.Run.LastCombatEvents {
		if event.Kind == "reckoning" && event.Amount == 12 {
			found = true
		}
	}
	if !found || player.ClassCombat.DamageTakenLastRound != 3 {
		t.Fatalf("Reckoning should apply its 12-damage cap, consume the prior damage, then record the new 3-damage hit: events=%+v state=%+v", room.Run.LastCombatEvents, player.ClassCombat)
	}
}

func TestSpellguardRunicWardAbsorbsAndReflectsNextAttack(t *testing.T) {
	room, now := newClassCombatTestRoom(t, ClassSpellguard)
	enemy := &room.Run.Rooms["entry"].Encounter.Enemies[0]
	enemy.Intent = &EnemyIntent{Kind: "strike", Label: "Strike", Damage: 8, TargetPlayerID: "player-1"}
	if err := ApplyCommand(room, "player-1", Command{Type: "combat", Round: 1, Action: "ability"}, now); err != nil {
		t.Fatal(err)
	}
	player := room.Run.Players["player-1"]
	if player.Health != player.MaxHealth || enemy.Health != 8 || player.ClassCombat.Ward != 0 {
		t.Fatalf("Runic Ward should absorb the mitigated hit and reflect 2 damage: player=%+v enemy=%+v", player, enemy)
	}
}

func TestArcanistElementalSurgeBuildsArcaneFocusAndFrostCancelsIntent(t *testing.T) {
	room, now := newClassCombatTestRoom(t, ClassArcanist)
	enemy := &room.Run.Rooms["entry"].Encounter.Enemies[0]
	enemy.Health, enemy.MaxHealth = 30, 30
	if err := ApplyCommand(room, "player-1", Command{Type: "combat", Round: 1, Action: "ability", Mode: "fire", TargetID: enemy.ID}, now); err != nil {
		t.Fatal(err)
	}
	if player := room.Run.Players["player-1"]; player.ClassCombat.ArcaneCharges != 1 {
		t.Fatalf("first elemental cast should build one Arcane Focus charge, got %+v", player.ClassCombat)
	}
	enemy.Intent = &EnemyIntent{Kind: "strike", Label: "Strike", Damage: 4, TargetPlayerID: "player-1"}
	if err := ApplyCommand(room, "player-1", Command{Type: "combat", Round: 2, Action: "ability", Mode: "frost", TargetID: enemy.ID}, now); err != nil {
		t.Fatal(err)
	}
	frostStoppedIntent := false
	for _, event := range room.Run.LastCombatEvents {
		if event.Kind == "elemental_frost" {
			frostStoppedIntent = true
		}
	}
	if !frostStoppedIntent || enemy.Intent == nil || enemy.Health != 12 || room.Run.Players["player-1"].ClassCombat.ArcaneCharges != 2 {
		t.Fatalf("Frost should stop the current intent, deal 8 damage, and leave a fresh next-round telegraph: enemy=%+v player=%+v events=%+v", enemy, room.Run.Players["player-1"], room.Run.LastCombatEvents)
	}
}

func TestRangerPinningShotWeakensTelegraphedAttack(t *testing.T) {
	room, now := newClassCombatTestRoom(t, ClassRanger)
	enemy := &room.Run.Rooms["entry"].Encounter.Enemies[0]
	enemy.Health, enemy.MaxHealth = 20, 20
	enemy.Intent = &EnemyIntent{Kind: "strike", Label: "Strike", Damage: 6, TargetPlayerID: "player-1"}
	if err := ApplyCommand(room, "player-1", Command{Type: "combat", Round: 1, Action: "ability", TargetID: enemy.ID}, now); err != nil {
		t.Fatal(err)
	}
	if enemy.Health != 10 || room.Run.Players["player-1"].Health != room.Run.Players["player-1"].MaxHealth || enemy.Intent == nil {
		t.Fatalf("Pinning Shot should deal 10 damage and weaken the current hit before a fresh intent is telegraphed: enemy=%+v player=%+v", enemy, room.Run.Players["player-1"])
	}
	weakenedIntent := false
	for _, event := range room.Run.LastCombatEvents {
		if event.Kind == "pinning_shot" && strings.Contains(event.Message, "weakened by 3") {
			weakenedIntent = true
		}
	}
	if !weakenedIntent {
		t.Fatalf("Pinning Shot should report its 3-damage intent reduction: %+v", room.Run.LastCombatEvents)
	}
}

func TestClericRenewalCanHealAnotherPartyMember(t *testing.T) {
	room, now := newClassCombatTestRoom(t, ClassCleric, "player-1", "player-2")
	target := room.Run.Players["player-2"]
	target.Health = 10
	room.Run.Rooms["entry"].Encounter.Enemies[0].Intent.TargetPlayerID = "player-1"
	if err := ApplyCommand(room, "player-1", Command{Type: "combat", Round: 1, Action: "ability", TargetID: "player-2"}, now); err != nil {
		t.Fatal(err)
	}
	if err := ApplyCommand(room, "player-2", Command{Type: "combat", Round: 1, Action: "defend"}, now); err != nil {
		t.Fatal(err)
	}
	if target.Health != 21 {
		t.Fatalf("Renewal should restore 11 health to the selected ally, got %d", target.Health)
	}
}

func TestTacticianCommandingStrikeMarksTargetForNextPartyAttack(t *testing.T) {
	room, now := newClassCombatTestRoom(t, ClassTactician, "player-1", "player-2")
	enemy := &room.Run.Rooms["entry"].Encounter.Enemies[0]
	enemy.Health, enemy.MaxHealth = 30, 30
	if err := ApplyCommand(room, "player-1", Command{Type: "combat", Round: 1, Action: "ability", TargetID: enemy.ID}, now); err != nil {
		t.Fatal(err)
	}
	if err := ApplyCommand(room, "player-2", Command{Type: "combat", Round: 1, Action: "attack", TargetID: enemy.ID}, now); err != nil {
		t.Fatal(err)
	}
	if enemy.Health != 12 || enemy.MarkedDamage != 0 {
		t.Fatalf("Commanding Strike should deal 5, then empower the next party attack by 3: %+v", enemy)
	}
}

func TestBeastcallerCompanionCanAttackAndPassiveHealsLowestAlly(t *testing.T) {
	room, now := newClassCombatTestRoom(t, ClassBeastcaller, "player-1", "player-2")
	enemy := &room.Run.Rooms["entry"].Encounter.Enemies[0]
	enemy.Health, enemy.MaxHealth = 20, 20
	room.Run.Players["player-2"].Health = 10
	if err := ApplyCommand(room, "player-1", Command{Type: "combat", Round: 1, Action: "ability", Mode: "attack", TargetID: enemy.ID}, now); err != nil {
		t.Fatal(err)
	}
	if err := ApplyCommand(room, "player-2", Command{Type: "combat", Round: 1, Action: "attack", TargetID: enemy.ID}, now); err != nil {
		t.Fatal(err)
	}
	if enemy.Health != 3 {
		t.Fatalf("companion and player attacks should deal 17 combined damage, enemy health=%d", enemy.Health)
	}
	if room.Run.Players["player-2"].Health != 7 {
		t.Fatalf("Companion Instinct should heal the lowest-health ally after the enemy hit, health=%d", room.Run.Players["player-2"].Health)
	}
}

func TestClassPassiveModifiersAreResolvedByRegisteredEffectID(t *testing.T) {
	cases := []struct {
		name          string
		classID       string
		playerHealth  int
		enemyHealth   int
		enemyTurns    int
		intent        *EnemyIntent
		arcaneCharges int
		want          classPassiveBonuses
	}{
		{name: "bloodied strength", classID: ClassJuggernaut, playerHealth: 10, want: classPassiveBonuses{AttackDamage: 3}},
		{name: "arcane resistance", classID: ClassSpellguard, playerHealth: 20, intent: &EnemyIntent{Kind: "soul_drain"}, want: classPassiveBonuses{DamageReduction: 2}},
		{name: "executioner", classID: ClassAssassin, playerHealth: 20, enemyHealth: 5, want: classPassiveBonuses{AttackDamage: 3}},
		{name: "arcane focus", classID: ClassArcanist, playerHealth: 20, arcaneCharges: 2, want: classPassiveBonuses{ElementalDamage: 4}},
		{name: "first strike", classID: ClassRanger, playerHealth: 20, enemyHealth: 20, enemyTurns: 1, want: classPassiveBonuses{AttackDamage: 3}},
		{name: "recovery", classID: ClassCleric, playerHealth: 20, want: classPassiveBonuses{EncounterHeal: 2}},
		{name: "interrupt training", classID: ClassTactician, playerHealth: 20, want: classPassiveBonuses{InterruptDamage: 2}},
	}
	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			definition, ok := findClass(test.classID)
			if !ok {
				t.Fatalf("missing class %q", test.classID)
			}
			build, err := StartingBuildForClass(test.classID)
			if err != nil {
				t.Fatal(err)
			}
			player := newPlayerStateForClass("player-1", definition)
			player.ClassBuild = &build
			player.Health = test.playerHealth
			player.ClassCombat.ArcaneCharges = test.arcaneCharges
			enemy := &Enemy{Health: test.enemyHealth, MaxHealth: 20, TurnsTaken: test.enemyTurns}
			got := classPassiveEffects(player, enemy, test.intent)
			if got != test.want {
				t.Fatalf("passive modifiers = %+v, want %+v", got, test.want)
			}
		})
	}
}

func TestAssassinExploitWeaknessPunishesEnemyTelegraph(t *testing.T) {
	room, now := newClassCombatTestRoom(t, ClassAssassin)
	enemy := &room.Run.Rooms["entry"].Encounter.Enemies[0]
	enemy.Health, enemy.MaxHealth = 20, 20
	if err := ApplyCommand(room, "player-1", Command{Type: "combat", Round: 1, Action: "ability", TargetID: enemy.ID}, now); err != nil {
		t.Fatal(err)
	}
	if enemy.Health != 7 {
		t.Fatalf("Exploit Weakness should deal 13 damage to a preparing enemy, health=%d", enemy.Health)
	}
}

func TestClericRecoveryPassiveImprovesEncounterHealing(t *testing.T) {
	room, now := newClassCombatTestRoom(t, ClassCleric)
	player := room.Run.Players["player-1"]
	player.Health = 20
	enemy := &room.Run.Rooms["entry"].Encounter.Enemies[0]
	enemy.Health = 1
	if err := ApplyCommand(room, "player-1", Command{Type: "combat", Round: 1, Action: "attack", TargetID: enemy.ID}, now); err != nil {
		t.Fatal(err)
	}
	if player.Health != 22 {
		t.Fatalf("Recovery should restore 2 health after the encounter, health=%d", player.Health)
	}
}

func TestClassAbilityRejectsWrongModeAndArchetypeOnlyPlayers(t *testing.T) {
	room, now := newClassCombatTestRoom(t, ClassArcanist)
	enemy := room.Run.Rooms["entry"].Encounter.Enemies[0]
	if err := SubmitCombatAction(room, "player-1", Command{Type: "combat", Round: 1, Action: "ability", Mode: "lightning", TargetID: enemy.ID}, now); err != ErrInvalidAbility {
		t.Fatalf("unknown Elemental Surge mode should be rejected, got %v", err)
	}

	legacy := newTestRoom()
	if err := StartRun(legacy, "run-legacy-ability", now); err != nil {
		t.Fatal(err)
	}
	if err := SubmitCombatAction(legacy, "player-1", Command{Type: "combat", Round: 1, Action: "ability"}, now); err != ErrInvalidAbility {
		t.Fatalf("archetype-only legacy player should not gain an unassigned class ability, got %v", err)
	}
}
