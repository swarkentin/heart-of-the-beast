package game

import "testing"

func TestGenerateBalanceReportCoversClassesAndPartySizesDeterministically(t *testing.T) {
	first, err := GenerateBalanceReport(1, 41)
	if err != nil {
		t.Fatal(err)
	}
	second, err := GenerateBalanceReport(1, 41)
	if err != nil {
		t.Fatal(err)
	}
	if len(first.Scenarios) != len(balanceEncounterIDs)*(len(ClassCatalog())+2) {
		t.Fatalf("got %d scenarios", len(first.Scenarios))
	}
	if first.Version != BalanceReportVersion || first.FirstSeed != 41 || first.LastSeed != 41 || first.SeedCount != 1 {
		t.Fatalf("unexpected report metadata: %+v", first)
	}
	for i := range first.Scenarios {
		got, again := first.Scenarios[i], second.Scenarios[i]
		if got.ID != again.ID || got.Summary != again.Summary {
			t.Fatalf("same fixed seed produced different scenario %q", got.ID)
		}
		if got.PartySize != 1 && got.PartySize != 2 && got.PartySize != 4 {
			t.Fatalf("unexpected party size: %+v", got)
		}
		if len(got.Snapshot.Players) != got.PartySize {
			t.Errorf("scenario %q snapshot has %d players, want %d", got.ID, len(got.Snapshot.Players), got.PartySize)
		}
		if len(got.Snapshot.Enemies) == 0 {
			t.Errorf("scenario %q snapshot has no enemies", got.ID)
		}
		if got.Snapshot.ExperienceReward != EncounterExperienceReward {
			t.Errorf("scenario %q snapshot lost experience reward: %d", got.ID, got.Snapshot.ExperienceReward)
		}
		if len(got.ClassIDs) != got.PartySize {
			t.Errorf("scenario %q has %d class IDs, want %d", got.ID, len(got.ClassIDs), got.PartySize)
		}
		for _, player := range got.Snapshot.Players {
			if player.ClassBuild == nil || len(player.Skills) == 0 || player.MaxHealth <= 0 {
				t.Errorf("scenario %q has incomplete effective player input: %+v", got.ID, player)
			}
		}
		for _, enemy := range got.Snapshot.Enemies {
			if enemy.DefinitionID == "" || enemy.MaxHealth <= 0 {
				t.Errorf("scenario %q has incomplete effective enemy input: %+v", got.ID, enemy)
			}
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
