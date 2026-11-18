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

	markdown := renderMarkdown(report, nil)
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

func TestRenderMarkdownIncludesCombatAndEndlessClassCharts(t *testing.T) {
	report := game.BalanceReport{Scenarios: []game.BalanceScenarioReport{
		{PartySize: 1, ClassIDs: []string{"arcanist"}, Summary: game.CombatSimulationBatchReport{WinRate: 0.8}},
		{PartySize: 1, ClassIDs: []string{"bulwark"}, Summary: game.CombatSimulationBatchReport{WinRate: 0.6}},
	}}
	endless := &EndlessReport{}
	endless.Scenarios = append(endless.Scenarios,
		struct {
			Party []string `json:"party"`
			PartySize int `json:"partySize"`
			Policy string `json:"policy"`
			Runs int `json:"runs"`
			Completed int `json:"completed"`
			MedianDepth int `json:"medianDepth"`
		}{Party: []string{"arcanist"}, PartySize: 1, Policy: "tactical", Runs: 10, Completed: 7, MedianDepth: 6},
		struct {
			Party []string `json:"party"`
			PartySize int `json:"partySize"`
			Policy string `json:"policy"`
			Runs int `json:"runs"`
			Completed int `json:"completed"`
			MedianDepth int `json:"medianDepth"`
		}{Party: []string{"bulwark"}, PartySize: 1, Policy: "tactical", Runs: 10, Completed: 4, MedianDepth: 3},
	)

	markdown := renderMarkdown(report, endless)
	for _, expected := range []string{
		"## Class performance: combat vs endless expeditions",
		"xychart-beta",
		"bar [80.0, 60.0]",
		"line [70.0, 40.0]",
		"Endless expedition median depth by class",
		"bar [6, 3]",
	} {
		if !strings.Contains(markdown, expected) {
			t.Errorf("chart output missing %q:\\n%s", expected, markdown)
		}
	}
}
