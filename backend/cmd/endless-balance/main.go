package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"math/rand"
	"os"
	"sort"
	"strings"

	"github.com/swarkentin/heart-of-the-beast/backend/internal/game"
)

type Scenario struct {
	ID         string                     `json:"id"`
	Party      []string                   `json:"party"`
	PartySize  int                        `json:"partySize"`
	Policy     game.RunPolicy             `json:"policy"`
	Runs       int                        `json:"runs"`
	Wiped      int                        `json:"wiped"`
	Stalled    int                        `json:"stalled"`
	Completed  int                        `json:"completed"`
	WipeRate   float64                    `json:"wipeRate"`
	Median     int                        `json:"medianDepth"`
	P10        int                        `json:"p10Depth"`
	P90        int                        `json:"p90Depth"`
	DepthReach map[int]float64            `json:"depthReachRates"`
	Results    []game.RunSimulationReport `json:"results"`
}

type Report struct {
	Version          int        `json:"version"`
	Theme            string     `json:"theme"`
	FirstSeed        int64      `json:"firstSeed"`
	RunsPerCase      int        `json:"runsPerCase"`
	CompositionCount int        `json:"compositionCount"`
	Policies         []string   `json:"policies"`
	Scenarios        []Scenario `json:"scenarios"`
}

func main() {
	runs := flag.Int("runs", 12, "number of seeds per party and decision policy")
	firstSeed := flag.Int64("first-seed", 1, "first deterministic seed; identical seed ranges are paired across policies")
	theme := flag.String("theme", game.RandomDungeonThemeID, "dungeon theme, or random for a seeded mix of themes between dungeons")
	maxSteps := flag.Int("max-steps", 4000, "maximum simulation decisions per expedition")
	jsonPath := flag.String("json", "endless-balance-report.json", "JSON report output path")
	markdownPath := flag.String("markdown", "endless-balance-report.md", "Markdown report output path")
	flag.Parse()
	if *runs <= 0 {
		fatal(fmt.Errorf("runs must be positive"))
	}

	compositions := partyCompositions()
	policies := []game.RunPolicy{game.RunPolicyRandom, game.RunPolicyTactical}
	report := Report{
		Version: 1, Theme: *theme, FirstSeed: *firstSeed, RunsPerCase: *runs,
		CompositionCount: len(compositions),
		Policies:         []string{string(game.RunPolicyRandom), string(game.RunPolicyTactical)},
		Scenarios:        make([]Scenario, 0, len(compositions)*len(policies)),
	}
	for _, party := range compositions {
		for _, policy := range policies {
			batch, err := game.SimulateRunBatchWithPolicy(*runs, *firstSeed, *theme, party, *maxSteps, policy)
			if err != nil {
				fatal(fmt.Errorf("party %s policy %s: %w", strings.Join(party, "+"), policy, err))
			}
			depths := make([]int, 0, len(batch.Runs))
			scenario := Scenario{
				ID: strings.Join(party, "+") + "/" + string(policy), Party: append([]string(nil), party...),
				PartySize: len(party), Policy: policy, Runs: len(batch.Runs), Wiped: batch.Wiped,
				Stalled: batch.Stalled, Completed: batch.Completed, WipeRate: batch.WipeRate,
				DepthReach: make(map[int]float64), Results: batch.Runs,
			}
			for _, run := range batch.Runs {
				depths = append(depths, run.ReachedDepth)
			}
			sort.Ints(depths)
			scenario.Median = percentile(depths, 50)
			scenario.P10 = percentile(depths, 10)
			scenario.P90 = percentile(depths, 90)
			maxDepth := 0
			if len(depths) > 0 {
				maxDepth = depths[len(depths)-1]
			}
			for depth := 1; depth <= maxDepth; depth++ {
				reached := 0
				for _, run := range bucket.results {
					if run.ReachedDepth >= depth {
						reached++
					}
				}
				rate := float64(reached) / float64(len(bucket.results))
				if rate == 0 {
					break
				}
				fmt.Fprintf(&b, "| %d | %s | %d | %.1f%% (%d/%d) |\\n", size, policy, depth, rate*100, reached, len(bucket.results))
			}
		}
	}
	return b.String()
}

func fatal(err error) {
	fmt.Fprintln(os.Stderr, err)
	os.Exit(1)
}
