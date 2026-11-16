package game

import (
	"strings"
	"testing"
)

func TestGenerateBalanceReportCoversClassesAndPartySizesDeterministically(t *testing.T) {
	first, err := GenerateBalanceReport(1, 41)
	if err != nil {
		t.Fatal(err)
	}
	second, err := GenerateBalanceReport(1, 41)
	if err != nil {
		t.Fatal(err)
	}
	if len(first.Scenarios) != len(balanceEncounterIDs)*(len(ClassCatalog())+2)*2 {
		t.Fatalf("got %d scenarios", len(first.Scenarios))
	}
	if first.FirstSeed != 41 || first.LastSeed != 41 || first.SeedCount != 1 {
		t.Fatalf("unexpected seed metadata: %+v", first)
	}
	for i := range first.Scenarios {
		if first.Scenarios[i].ID != second.Scenarios[i].ID || first.Scenarios[i].Summary.Runs != second.Scenarios[i].Summary.Runs || first.Scenarios[i].Summary.Wins != second.Scenarios[i].Summary.Wins || first.Scenarios[i].Summary.Wipes != second.Scenarios[i].Summary.Wipes || first.Scenarios[i].Summary.Stalled != second.Scenarios[i].Summary.Stalled {
			t.Fatalf("same fixed seed produced different scenario %q", first.Scenarios[i].ID)
		}
		if first.Scenarios[i].PartySize != 1 && first.Scenarios[i].PartySize != 2 && first.Scenarios[i].PartySize != 4 {
			t.Fatalf("unexpected party size: %+v", first.Scenarios[i])
		}
	}
	var hasRandom, hasTactical bool
	for _, scenario := range first.Scenarios {
		if strings.HasSuffix(scenario.ID, "/random") {
			hasRandom = true
		}
		if strings.HasSuffix(scenario.ID, "/tactical") {
			hasTactical = true
		}
	}
	if !hasRandom || !hasTactical {
		t.Fatal("expected both random and tactical policy scenarios")
	}
}

func TestTuningOverridesAreReportedAndApplied(t *testing.T) {
	report, err := GenerateBalanceReportWithTuning(2, 1, BalanceTuning{BlockAmount: 3, EnemyHealthMultiplier: 1.25, PlayerDamage: 8})
	if err != nil {
		t.Fatal(err)
	}
	if report.Tuning.BlockAmount != 3 || report.Tuning.EnemyHealthMultiplier != 1.25 || report.Tuning.PlayerDamage != 8 {
		t.Fatalf("tuning not recorded: %+v", report.Tuning)
	}
	for _, scenario := range report.Scenarios {
		if scenario.Summary.Runs != 2 {
			t.Fatalf("unexpected run count: %+v", scenario)
		}
		if scenario.Summary.Wins+scenario.Summary.Wipes+scenario.Summary.Stalled != scenario.Summary.Runs {
			t.Fatalf("outcomes do not account for all runs: %+v", scenario.Summary)
		}
	}
}

func TestCompareBalanceReportsFindsRegressionsAndDifficultyExtremes(t *testing.T) {
	baseline := BalanceReport{Version: 1, Scenarios: []BalanceScenarioReport{
		{ID: "hard", Summary: CombatSimulationBatchReport{Runs: 100, WinRate: 0.80, P90Rounds: 8}, WipeRate: 0.05},
		{ID: "easy", EncounterBudget: 3, Summary: CombatSimulationBatchReport{Runs: 100, WinRate: 0.90}, WipeRate: 0.01},
	}}
	current := BalanceReport{Version: 1, Scenarios: []BalanceScenarioReport{
		{ID: "hard", Summary: CombatSimulationBatchReport{Runs: 100, WinRate: 0.65, P90Rounds: 11}, WipeRate: 0.20},
		{ID: "easy", EncounterBudget: 3, Summary: CombatSimulationBatchReport{Runs: 100, WinRate: 1}, WipeRate: 0},
		{ID: "new", Summary: CombatSimulationBatchReport{Runs: 100, WinRate: 0.40}, WipeRate: 0.35},
	}}
	result := CompareBalanceReports(baseline, current)
	if result.Regressions != 2 {
		t.Fatalf("got %d regressions, want 2: %+v", result.Regressions, result)
	}
	if len(result.Findings) < 5 {
		t.Fatalf("expected drift, extreme-difficulty, and coverage findings: %+v", result.Findings)
	}
}
