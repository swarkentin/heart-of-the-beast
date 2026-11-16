package main

import (
	"fmt"\n\t"strings"\n\t"github.com/swarkentin/heart-of-the-beast/backend/internal/game"
	"testing"
)

func TestPartyCompositionsCoverAllSizesAndAreDeterministic(t *testing.T) {
	first := partyCompositions()
	second := partyCompositions()
	if len(first) != 126 {
		t.Fatalf("got %d compositions, want 126", len(first))
	}
	counts := map[int]int{}
	seen := map[string]bool{}
	for i, party := range first {
		if len(party) < 1 || len(party) > 4 {
			t.Fatalf("composition %d has invalid size %d", i, len(party))
		}
		key := fmt.Sprint(party)
		if seen[key] {
			t.Fatalf("duplicate composition %v", party)
		}
		seen[key] = true
		counts[len(party)]++
		if fmt.Sprint(party) != fmt.Sprint(second[i]) {
			t.Fatalf("composition generation is not deterministic at index %d", i)
		}
	}
	if counts[1] != 9 || counts[2] != 45 || counts[3] != 36 || counts[4] != 36 {
		t.Fatalf("unexpected composition distribution: %v", counts)
	}
}

func TestRenderMarkdownStopsSurvivalTableAtZeroReachAndOmitsSuggestions(t *testing.T) {
	report := Report{
		Theme: "random", CompositionCount: 1, RunsPerCase: 2,
		Scenarios: []Scenario{{
			Party: []string{"arcanist"}, PartySize: 1, Policy: "tactical",
			Runs: 2, Results: []game.RunSimulationReport{
				{ReachedDepth: 1},
				{ReachedDepth: 2},
			},
		}},
	}

	markdown := renderMarkdown(report)
	if strings.Contains(markdown, "Reading the results") ||
		strings.Contains(markdown, "Treat this as comparative evidence") {
		t.Fatalf("report still contains explanatory suggestions:\n%s", markdown)
	}
	if strings.Contains(markdown, "| 1 | tactical | 3 |") {
		t.Fatalf("survival table continued past zero reach:\n%s", markdown)
	}
	if !strings.Contains(markdown, "| 1 | tactical | 2 | 50.0% (1/2) |") {
		t.Fatalf("survival table omitted the last non-zero depth:\n%s", markdown)
	}
}
