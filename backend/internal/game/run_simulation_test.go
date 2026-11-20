package game

import (
	"math/rand"
	"reflect"
	"testing"
)

func TestSimulateRunIsDeterministicAndTraversesDungeon(t *testing.T) {
	classes := []string{ClassBulwark, ClassCleric}
	first, err := SimulateRun(41, classes, 2000)
	if err != nil {
		t.Fatal(err)
	}
	second, err := SimulateRun(41, classes, 2000)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(first, second) {
		t.Fatalf("same seed produced different full-run reports:\nfirst: %#v\nsecond: %#v", first, second)
	}
	if first.PartySize != len(classes) || first.ReachedDepth < InitialDungeonDepth {
		t.Fatalf("unexpected party or depth result: %+v", first)
	}
	if first.RoomsVisited < 2 || first.CombatRounds == 0 {
		t.Fatalf("simulation did not meaningfully traverse and fight through the dungeon: %+v", first)
	}
	if first.Outcome != "completed" && first.Outcome != "wiped" && first.Outcome != "step_limit" {
		t.Fatalf("unknown run outcome %q", first.Outcome)
	}
	if first.Wiped && first.Outcome != "wiped" {
		t.Fatalf("a run that wiped after clearing a dungeon must still report a wipe, got %q", first.Outcome)
	}
}

func TestSimulateRunSupportsSoloAndFourCharacterParties(t *testing.T) {
	for _, classes := range [][]string{
		{ClassRanger},
		{ClassBulwark, ClassCleric, ClassArcanist, ClassBeastcaller},
	} {
		report, err := SimulateRun(2026, classes, 2000)
		if err != nil {
			t.Fatalf("party %v: %v", classes, err)
		}
		if report.PartySize != len(classes) {
			t.Fatalf("party %v produced party size %d", classes, report.PartySize)
		}
		if report.RemainingMaxHealth <= 0 || report.RemainingHealth < 0 || report.RemainingHealth > report.RemainingMaxHealth {
			t.Fatalf("invalid remaining health for party %v: %+v", classes, report)
		}
	}
}

func TestSimulateRunBatchSummarizesDepthReachProbability(t *testing.T) {
	classes := []string{ClassBulwark}
	report, err := SimulateRunBatch(4, 7, classes, 2000)
	if err != nil {
		t.Fatal(err)
	}
	if report.SeedCount != 4 || report.FirstSeed != 7 || report.LastSeed != 10 || len(report.Runs) != 4 {
		t.Fatalf("unexpected batch metadata: %+v", report)
	}
	// Completed (first boss beaten) and Wiped can both be true of one expedition, so account for every run by
	// its single Outcome instead.
	outcomes := map[string]int{}
	for _, run := range report.Runs {
		outcomes[run.Outcome]++
	}
	if outcomes["completed"]+outcomes["wiped"]+outcomes["step_limit"] != report.SeedCount || outcomes["wiped"] != report.Wiped || outcomes["step_limit"] != report.Stalled {
		t.Fatalf("outcomes do not account for every run: %v %+v", outcomes, report)
	}
	for depth, rate := range report.DepthReachRates {
		if depth < InitialDungeonDepth || depth > SimulationDepthLimit || rate < 0 || rate > 1 {
			t.Fatalf("invalid depth reach rate %d: %f", depth, rate)
		}
	}
	if report.DepthReachRates[InitialDungeonDepth] != 1 {
		t.Fatalf("every started run should reach depth one: %+v", report.DepthReachRates)
	}
}

func TestTacticalSpellguardWardsAgainstAKillingBlow(t *testing.T) {
	room, _ := newClassCombatTestRoom(t, ClassSpellguard, "player-1")
	enemy := &room.Run.Rooms["entry"].Encounter.Enemies[0]
	enemy.Intent = &EnemyIntent{Damage: 8, TargetPlayerID: "player-1"}
	room.Run.Players["player-1"].Health = 6

	command := skillPolicyCommand(room, "player-1", 1, rand.New(rand.NewSource(1)))
	if command.Skill != "spellguard.runic-ward" {
		t.Fatalf("Spellguard should raise Runic Ward against a killing blow, got %+v", command)
	}
}

func TestSimulateRunCapturesCombatDiagnostics(t *testing.T) {
	report, err := SimulateRunWithPolicy(41, DefaultDungeonThemeID, []string{ClassBulwark, ClassCleric}, 2000, RunPolicyTactical)
	if err != nil {
		t.Fatal(err)
	}
	if len(report.CombatMetrics) != 2 {
		t.Fatalf("got combat metrics for %d players, want 2: %+v", len(report.CombatMetrics), report.CombatMetrics)
	}
	damage, actions := 0, 0
	for _, metrics := range report.CombatMetrics {
		damage += metrics.DamageDealt
		actions += metrics.Attacks + metrics.Abilities + metrics.Interrupts + metrics.Defends
	}
	if damage <= 0 || actions <= 0 {
		t.Fatalf("expected combat contribution metrics, got damage=%d actions=%d", damage, actions)
	}
	if report.NetPartyHealthLoss < 0 {
		t.Fatalf("net party health loss cannot be negative: %d", report.NetPartyHealthLoss)
	}
	if report.EndEnemyHealth > report.EndEnemyMaxHealth {
		t.Fatalf("end encounter health exceeds maximum: %+v", report)
	}
	if report.Wiped && report.EndRoomType != "" {
		if report.EndRoomName == "" || report.EndEncounterID == "" || len(report.EndEnemies) == 0 {
			t.Fatalf("wiped encounter is missing terminal diagnostics: %+v", report)
		}
		for _, enemy := range report.EndEnemies {
			if enemy.Name == "" || enemy.DefinitionID == "" || enemy.Health < 0 || enemy.Health > enemy.MaxHealth {
				t.Fatalf("invalid terminal enemy diagnostics: %+v", enemy)
			}
		}
	}
}

func TestSimulateRunRejectsInvalidPartyAndSeedCount(t *testing.T) {
	if _, err := SimulateRun(1, nil, 10); err == nil {
		t.Fatal("expected empty party to be rejected")
	}
	if _, err := SimulateRun(1, []string{"not-a-class"}, 10); err == nil {
		t.Fatal("expected unknown class to be rejected")
	}
	if _, err := SimulateRunBatch(0, 1, []string{ClassBulwark}, 10); err == nil {
		t.Fatal("expected non-positive run count to be rejected")
	}
}

// TestTacticalPlayUsuallyClearsTheFirstFloor is a coarse balance guard, not a tuning target: an attentive party of
// any size should usually get through floor one. It fails if a content or scaling change makes the opening floor
// a wall again. Targets and the full matrix are in docs/game-design/encounter-scaling-and-tuning.md.
func TestTacticalPlayUsuallyClearsTheFirstFloor(t *testing.T) {
	if testing.Short() {
		t.Skip("simulates whole runs")
	}
	parties := [][]string{
		{ClassArcanist},
		{ClassAssassin},
		{ClassBeastcaller},
		{ClassBulwark},
		{ClassCleric},
		{ClassJuggernaut},
		{ClassRanger},
		{ClassSpellguard},
		{ClassTactician},
		{ClassRanger, ClassAssassin},
		{ClassJuggernaut, ClassAssassin, ClassTactician},
		{ClassSpellguard, ClassAssassin, ClassRanger, ClassTactician},
	}
	for _, party := range parties {
		report, err := SimulateRunBatchWithPolicy(40, 1, DefaultDungeonThemeID, party, 4000, RunPolicyTactical)
		if err != nil {
			t.Fatal(err)
		}
		t.Logf("party %v: floor one cleared in %.0f%% of runs", party, report.DepthReachRates[InitialDungeonDepth+1]*100)
		if rate := report.DepthReachRates[InitialDungeonDepth+1]; rate < 0.75 {
			t.Errorf("party %v cleared floor one in %.0f%% of tactical runs, want at least 75%%", party, rate*100)
		}
		if report.Stalled > 0 {
			t.Errorf("party %v stalled in %d tactical runs; the policy must always make progress", party, report.Stalled)
		}
	}
}

func TestBulwarkSoloTacticalCanClearFirstDungeon(t *testing.T) {
	if testing.Short() {
		t.Skip("simulates full expeditions")
	}
	report, err := SimulateRunBatchWithPolicy(40, 1, RandomDungeonThemeID, []string{ClassBulwark}, 4000, RunPolicyTactical)
	if err != nil {
		t.Fatal(err)
	}
	cleared := 0
	for _, run := range report.Runs {
		if run.DungeonsCleared >= 1 {
			cleared++
		}
	}
	rate := float64(cleared) / float64(len(report.Runs))
	t.Logf("solo Bulwark cleared the first dungeon in %d/%d tactical runs (%.0f%%)", cleared, len(report.Runs), rate*100)
	// With healing supplied by carried herbs instead of every-fight recovery, solo first-dungeon completion
	// should remain low but nonzero. This lower bound is a smoke test, not a tuning target.
	if rate < 0.10 {
		t.Fatalf("solo Bulwark cleared the first dungeon in %.0f%% of tactical runs, want at least 10%%", rate*100)
	}
}

func TestSimulateRunRejectsUnknownPolicy(t *testing.T) {
	if _, err := SimulateRunWithPolicy(1, DefaultDungeonThemeID, []string{ClassRanger}, 10, RunPolicy("optimal")); err == nil {
		t.Fatal("expected an unknown policy to be rejected")
	}
}

func TestTacticalShopInvestsInPermanentStrikeWhenAffordable(t *testing.T) {
	room := openTestShop(t, 1, "tactical-strike-shop")
	player := room.Run.Players["player-1"]
	player.Gold = 1000
	room.Run.Camp.Offers = []ShopItem{{ID: "whetstone", Name: "Whetstone", Kind: ShopStrike, Amount: 1, Price: 30}}

	command, ok := tacticalShopCommand(room, "player-1")
	if !ok || command.Type != "buy" || command.ChoiceID != "whetstone" {
		t.Fatalf("tactical policy should invest in an affordable Whetstone, got %+v, ok=%v", command, ok)
	}
	if err := buyShopItem(room, "player-1", command.ChoiceID); err != nil {
		t.Fatal(err)
	}
	if player.StrikeDamage != PlayerStrikeDamage+1 {
		t.Fatalf("tactical purchase did not increase Strike: %d", player.StrikeDamage)
	}
}

func TestRandomCampPolicySkipsWhetstoneAtStrikeCap(t *testing.T) {
	room := openTestShop(t, 1, "random-strike-cap-shop")
	player := room.Run.Players["player-1"]
	player.Gold = 1000
	player.StrikeDamage = PlayerStrikeDamage + MaxPermanentStrikeBonus
	room.Run.Camp.Offers = []ShopItem{{ID: "whetstone", Name: "Whetstone", Kind: ShopStrike, Amount: 1, Price: 30}}

	command, ok := randomCampCommand(room, "player-1", rand.New(rand.NewSource(1)))
	if !ok || command.Type != "ready" {
		t.Fatalf("random policy should skip a capped Whetstone and ready up, got %+v, ok=%v", command, ok)
	}
}

func TestTacticalShopPrioritizesUrgentHealingOverWhetstone(t *testing.T) {
	room := openTestShop(t, 1, "tactical-heal-before-strike")
	player := room.Run.Players["player-1"]
	player.Gold = 1000
	player.Health = player.MaxHealth - 15
	room.Run.Camp.Offers = []ShopItem{
		{ID: "whetstone", Name: "Whetstone", Kind: ShopStrike, Amount: 1, Price: 30},
		{ID: "healing-draught", Name: "Healing Draught", Kind: ShopHeal, Amount: 12, Price: 12, Repeatable: true},
	}

	command, ok := tacticalShopCommand(room, "player-1")
	if !ok || command.Type != "buy" || command.ChoiceID != "healing-draught" {
		t.Fatalf("tactical policy should buy urgent healing before a Whetstone, got %+v, ok=%v", command, ok)
	}
}

func TestTacticalShopBuysHerbWhenPartialHealingIsUseful(t *testing.T) {
	room := openTestShop(t, 1, "tactical-herb-shop")
	player := room.Run.Players["player-1"]
	player.Gold = 100
	heal := (player.MaxHealth*HealingHerbHealingPercent + 99) / 100
	player.Health -= (heal + 1) / 2
	room.Run.Camp.Offers = []ShopItem{{ID: "healing-herb", Name: "Healing Herb", Kind: ShopConsumable, ConsumableID: ConsumableHealingHerb, Amount: 1, Price: 8, Repeatable: true}}
	command, ok := tacticalShopCommand(room, player.ID)
	if !ok || command.Type != "buy" || command.ChoiceID != "healing-herb" {
		t.Fatalf("tactical policy should buy a useful herb, got %+v, ok=%v", command, ok)
	}
}
