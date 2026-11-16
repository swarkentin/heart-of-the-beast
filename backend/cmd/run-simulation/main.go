package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"strings"

	"github.com/swarkentin/heart-of-the-beast/backend/internal/game"
)

func main() {
	runs := flag.Int("runs", 100, "number of full dungeon runs to simulate")
	firstSeed := flag.Int64("first-seed", 1, "first deterministic run seed")
	party := flag.String("party", "bulwark", "comma-separated class IDs for the party (1-4 characters)")
	theme := flag.String("theme", game.DefaultDungeonThemeID, "dungeon theme ID, or \"random\" for a seeded mix of themes")
	maxSteps := flag.Int("max-steps", 4000, "maximum simulation decisions per run")
	policy := flag.String("policy", string(game.RunPolicyTactical), "decision policy: \"tactical\" (attentive play, used for balance targets) or \"random\" (unskilled floor)")
	jsonPath := flag.String("json", "", "optional path for the machine-readable JSON report")
	flag.Parse()

	classes := make([]string, 0, 4)
	for _, value := range strings.Split(*party, ",") {
		if classID := strings.TrimSpace(value); classID != "" {
			classes = append(classes, classID)
		}
	}
	report, err := game.SimulateRunBatchWithPolicy(*runs, *firstSeed, *theme, classes, *maxSteps, game.RunPolicy(*policy))
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	fmt.Printf("# Full-run simulation\n\n")
	fmt.Printf("- Policy: %s\n- Runs: %d (seeds %d–%d)\n- Theme: %s\n- Party: %s\n", report.Policy, report.SeedCount, report.FirstSeed, report.LastSeed, report.ThemeID, strings.Join(report.PartyClasses, ", "))
	fmt.Printf("- First dungeon cleared: %.1f%% (%d/%d)\n- Wipe rate: %.1f%% (%d/%d)\n- Median depth reached: %d; P90: %d\n- Median rooms visited: %d; median combat rounds: %d\n\n", report.CompletionRate*100, report.Completed, report.SeedCount, report.WipeRate*100, report.Wiped, report.SeedCount, report.MedianDepth, report.P90Depth, report.MedianRooms, report.MedianRounds)
	fmt.Printf("| Floors reached (all dungeons) | Probability |\n|---:|---:|\n")
	for depth := 1; depth <= game.SimulationDepthLimit; depth++ {
		fmt.Printf("| %d+ | %.1f%% |\n", depth, report.DepthReachRates[depth]*100)
	}
	fmt.Printf("\n> Neither policy models human play. \"random\" is the unskilled floor; \"tactical\" stands in for attentive play and is what the targets in docs/game-design/encounter-scaling-and-tuning.md use. Confirm balance changes in playtests.\n")

	if *jsonPath != "" {
		data, err := json.MarshalIndent(report, "", "  ")
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
		if err := os.WriteFile(*jsonPath, append(data, '\n'), 0644); err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
	}
}
