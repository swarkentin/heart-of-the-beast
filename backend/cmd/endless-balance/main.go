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
				for _, run := range batch.Runs {
					if run.ReachedDepth >= depth {
						reached++
					}
				}
				scenario.DepthReach[depth] = float64(reached) / float64(len(batch.Runs))
			}
			report.Scenarios = append(report.Scenarios, scenario)
		}
	}

	encoded, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		fatal(err)
	}
	if err := os.WriteFile(*jsonPath, append(encoded, '\n'), 0644); err != nil {
		fatal(err)
	}
	markdown := renderMarkdown(report)
	if err := os.WriteFile(*markdownPath, []byte(markdown), 0644); err != nil {
		fatal(err)
	}
	fmt.Print(markdown)
}

func partyCompositions() [][]string {
	classes := make([]string, 0, len(game.ClassCatalog()))
	for _, definition := range game.ClassCatalog() {
		classes = append(classes, definition.ID)
	}
	sort.Strings(classes)
	compositions := make([][]string, 0, 126)
	for _, classID := range classes {
		compositions = append(compositions, []string{classID})
	}
	// Every duo is represented, including duplicate-class parties.
	for i := range classes {
		for j := i; j < len(classes); j++ {
			compositions = append(compositions, []string{classes[i], classes[j]})
		}
	}
	// Sample a broad, reproducible spread of three- and four-player parties.
	// Sorting makes a composition independent of player slot order.
	rng := rand.New(rand.NewSource(0x484f5442))
	for _, size := range []int{3, 4} {
		seen := make(map[string]bool)
		added := 0
		for attempts := 0; added < 36 && attempts < 10000; attempts++ {
			party := make([]string, size)
			for i := range party {
				party[i] = classes[rng.Intn(len(classes))]
			}
			sort.Strings(party)
			key := strings.Join(party, "+")
			if seen[key] {
				continue
			}
			seen[key] = true
			compositions = append(compositions, party)
			added++
		}
	}
	return compositions
}

func percentile(sorted []int, p int) int {
	if len(sorted) == 0 {
		return 0
	}
	index := (p*len(sorted)+99)/100 - 1
	if index < 0 {
		index = 0
	}
	if index >= len(sorted) {
		index = len(sorted) - 1
	}
	return sorted[index]
}

func renderMarkdown(report Report) string {
	var b strings.Builder
	fmt.Fprintf(&b, "# Endless expedition balance report\n\n")
	fmt.Fprintf(&b, "- Theme selection: %s (random selects a seeded theme for each dungeon)\n- Party compositions: %d (all 9 solos, all 45 duos, 36 sampled trios, 36 sampled four-player parties)\n- Policies: random legal play and tactical play\n- Seeds per scenario: %d (starting at %d)\n- Total expeditions: %d\n\n",
		report.Theme, report.CompositionCount, report.RunsPerCase, report.FirstSeed, len(report.Scenarios)*report.RunsPerCase)
	b.WriteString("Each seed is run under both policies for paired comparisons. Dungeon generation, combat, rewards, navigation, events, camps, and progression use the authoritative game commands. Random decisions are seeded, so reports are reproducible while runs explore different routes and choices.\n\n")
	b.WriteString("## Party composition results\n\n")
	b.WriteString("| Party | Policy | Median depth | P10 | P90 | Wipe rate | First dungeon cleared | Stalled |\n|---|---|---:|---:|---:|---:|---:|---:|\n")
	for _, s := range report.Scenarios {
		completedRate := float64(s.Completed) / float64(s.Runs)
		fmt.Fprintf(&b, "| %s | %s | %d | %d | %d | %.0f%% | %.0f%% | %d |\n",
			strings.Join(s.Party, "+"), s.Policy, s.Median, s.P10, s.P90, s.WipeRate*100, completedRate*100, s.Stalled)
	}
	b.WriteString("\n## Survival by party size and policy\n\n")
	type bucket struct {
		size    int
		policy  game.RunPolicy
		results []game.RunSimulationReport
	}
	buckets := make(map[string]*bucket)
	maxDepth := 0
	for _, s := range report.Scenarios {
		key := fmt.Sprintf("%d/%s", s.PartySize, s.Policy)
		if buckets[key] == nil {
			buckets[key] = &bucket{size: s.PartySize, policy: s.Policy}
		}
		buckets[key].results = append(buckets[key].results, s.Results...)
		for _, run := range s.Results {
			if run.ReachedDepth > maxDepth {
				maxDepth = run.ReachedDepth
			}
		}
	}
	b.WriteString("| Party size | Policy | Depth | Expeditions reaching depth |\n|---:|---|---:|---:|\n")
	for size := 1; size <= 4; size++ {
		for _, policy := range []game.RunPolicy{game.RunPolicyRandom, game.RunPolicyTactical} {
			bucket := buckets[fmt.Sprintf("%d/%s", size, policy)]
			if bucket == nil {
				continue
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
				fmt.Fprintf(&b, "| %d | %s | %d | %.1f%% (%d/%d) |\n", size, policy, depth, rate*100, reached, len(bucket.results))
			}
		}
	}
	return b.String()
}

func fatal(err error) {
	fmt.Fprintln(os.Stderr, err)
	os.Exit(1)
}
