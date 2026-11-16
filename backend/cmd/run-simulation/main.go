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
	maxSteps := flag.Int("max-steps", 2000, "maximum simulation decisions per run")
	jsonPath := flag.String("json", "", "optional path for the machine-readable JSON report")
	flag.Parse()

	classes := make([]string, 0, 4)
	for _, value := range strings.Split(*party, ",") {
		if classID := strings.TrimSpace(value); classID != "" {
			classes = append(classes, classID)
		}
	}
	report, err := game.SimulateRunBatch(*runs, *firstSeed, classes, *maxSteps)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	fmt.Printf("# Random full-run simulation\n\n")
	fmt.Printf("- Policy: %s\n- Runs: %d (seeds %d–%d)\n- Party: %s\n", report.Policy, report.SeedCount, report.FirstSeed, report.LastSeed, strings.Join(report.PartyClasses, ", "))
	fmt.Printf("- Completion rate: %.1f%% (%d/%d)\n- Wipe rate: %.1f%% (%d/%d)\n- Median depth reached: %d; P90: %d\n- Median rooms visited: %d; median combat rounds: %d\n\n", report.CompletionRate*100, report.Completed, report.SeedCount, report.WipeRate*100, report.Wiped, report.SeedCount, report.MedianDepth, report.P90Depth, report.MedianRooms, report.MedianRounds)
	fmt.Printf("| Depth reached | Probability |\n|---:|---:|\n")
	for depth := 1; depth <= game.MaximumDungeonDepth; depth++ {
		fmt.Printf("| %d+ | %.1f%% |\n", depth, report.DepthReachRates[depth]*100)
	}
	fmt.Printf("\n> This is an intentionally unskilled random baseline, not a model of human play or optimal strategy. Use it to compare future decision policies; do not tune balance from this baseline alone.\n")

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
