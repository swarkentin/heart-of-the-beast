package game

import (
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
	if report.Completed+report.Wiped+report.Stalled != report.SeedCount {
		t.Fatalf("outcomes do not account for every run: %+v", report)
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
		{ClassRanger},
		{ClassBulwark},
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

func TestSimulateRunRejectsUnknownPolicy(t *testing.T) {
	if _, err := SimulateRunWithPolicy(1, DefaultDungeonThemeID, []string{ClassRanger}, 10, RunPolicy("optimal")); err == nil {
		t.Fatal("expected an unknown policy to be rejected")
	}
}
