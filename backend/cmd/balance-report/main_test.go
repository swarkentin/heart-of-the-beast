package main

import (
	"strings"
	"testing"

	"github.com/swarkentin/heart-of-the-beast/backend/internal/game"
)

func TestRenderMarkdownOmitsFindingsAndSuggestedInvestigations(t *testing.T) {
	report := game.BalanceReport{
		Version:   2,
		SeedCount: 1,
		FirstSeed: 7,
		LastSeed:  7,
		Policy:    "test policy",
		Scenarios: []game.BalanceScenarioReport{{
			ID:                       "sample/party-1/warrior",
			PartySize:                1,
			Summary:                  game.CombatSimulationBatchReport{WinRate: 0.75},
			WipeRate:                 0.25,
			MedianRemainingHealthPct: 40,
		}},
	}

	markdown := renderMarkdown(report)
	if strings.Contains(markdown, "Findings and suggested investigations") {
		t.Fatal("balance report still includes the findings section")
	}
	if !strings.Contains(markdown, "| Scenario | Party | Win rate |") {
		t.Fatal("balance report is missing the scenario summary table")
	}
	if !strings.Contains(markdown, "## Interpretation") {
		t.Fatal("balance report is missing the interpretation guidance")
	}
}
