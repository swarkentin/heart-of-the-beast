// Command campaign-balance plays every campaign (ADR 0041) with the endless matrix's party compositions under
// the tactical policy, and reports how often each party size wins and where parties fall, chapter by chapter.
package main

import (
	"flag"
	"fmt"
	"math/rand"
	"os"
	"sort"
	"strings"

	"github.com/swarkentin/heart-of-the-beast/backend/internal/game"
)

func main() {
	runs := flag.Int("runs", 20, "seeds per party composition and campaign")
	firstSeed := flag.Int64("first-seed", 1, "first deterministic seed")
	only := flag.String("campaign", "", "simulate only this campaign ID")
	maxSteps := flag.Int("max-steps", 8000, "maximum simulation decisions per run")
	flag.Parse()

	compositions := partyCompositions()
	var b strings.Builder
	fmt.Fprintf(&b, "# Campaign balance\n\n%d compositions × %d seeds per campaign, tactical policy.\n\n", len(compositions), *runs)
	for _, campaign := range game.Campaigns() {
		if *only != "" && campaign.ID != *only {
			continue
		}
		// reached[size][n] counts runs that entered dungeon n; cleared[size][n] runs that beat it.
		reached := map[int]map[int]int{}
		cleared := map[int]map[int]int{}
		total := map[int]int{}
		won := map[int]int{}
		for _, party := range compositions {
			batch, err := game.SimulateRunBatchWithPolicy(*runs, *firstSeed, game.SimulationCampaignPrefix+campaign.ID, party, *maxSteps, game.RunPolicyTactical)
			if err != nil {
				fatal(err)
			}
			size := len(party)
			if reached[size] == nil {
				reached[size], cleared[size] = map[int]int{}, map[int]int{}
			}
			for _, run := range batch.Runs {
				total[size]++
				if run.CampaignWon {
					won[size]++
				}
				for n := 1; n <= len(run.DungeonThemes); n++ {
					reached[size][n]++
				}
				for n := 1; n <= run.DungeonsCleared; n++ {
					cleared[size][n]++
				}
			}
		}
		fmt.Fprintf(&b, "## %d. %s\n\n| Party | Win rate | D1 | D2 (heartshard) | D3 | D4 (castle) | D5 (heart) |\n|---|---|---|---|---|---|---|\n", campaign.Number, campaign.Name)
		sizes := make([]int, 0, len(total))
		for size := range total {
			sizes = append(sizes, size)
		}
		sort.Ints(sizes)
		for _, size := range sizes {
			fmt.Fprintf(&b, "| %d | %.1f%% |", size, 100*float64(won[size])/float64(total[size]))
			for n := 1; n <= game.CampaignDungeons; n++ {
				if reached[size][n] == 0 {
					b.WriteString(" – |")
					continue
				}
				fmt.Fprintf(&b, " %.1f%% |", 100*float64(cleared[size][n])/float64(reached[size][n]))
			}
			b.WriteString("\n")
		}
		b.WriteString("\nEach chapter column is the share of parties that entered that dungeon and beat it.\n\n")
	}
	fmt.Print(b.String())
}

// partyCompositions is the endless matrix's set: every solo, every duo and 36 seeded trios and quartets.
func partyCompositions() [][]string {
	classes := make([]string, 0, len(game.ClassCatalog()))
	for _, definition := range game.ClassCatalog() {
		classes = append(classes, definition.ID)
	}
	sort.Strings(classes)
	var compositions [][]string
	for _, classID := range classes {
		compositions = append(compositions, []string{classID})
	}
	for i := range classes {
		for j := i; j < len(classes); j++ {
			compositions = append(compositions, []string{classes[i], classes[j]})
		}
	}
	rng := rand.New(rand.NewSource(0x484f5442))
	for _, size := range []int{3, 4} {
		seen := map[string]bool{}
		for added, attempts := 0, 0; added < 36 && attempts < 10000; attempts++ {
			party := make([]string, size)
			for i := range party {
				party[i] = classes[rng.Intn(len(classes))]
			}
			sort.Strings(party)
			key := strings.Join(party, "+")
			if !seen[key] {
				seen[key] = true
				compositions = append(compositions, party)
				added++
			}
		}
	}
	return compositions
}

func fatal(err error) {
	fmt.Fprintln(os.Stderr, err)
	os.Exit(1)
}
