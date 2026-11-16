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
		if depth < InitialDungeonDepth || depth > MaximumExpeditionDepth || rate < 0 || rate > 1 {
			t.Fatalf("invalid depth reach rate %d: %f", depth, rate)
		}
	}
	if report.DepthReachRates[InitialDungeonDepth] != 1 {
		t.Fatalf("every started run should reach depth one: %+v", report.DepthReachRates)
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
