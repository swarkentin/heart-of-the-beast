package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"sort"
	"strings"

	"github.com/swarkentin/heart-of-the-beast/backend/internal/game"
)

func main() {
	seeds := flag.Int("seeds", 30, "number of deterministic seeds per scenario")
	firstSeed := flag.Int64("first-seed", 1, "first deterministic seed")
	baselinePath := flag.String("baseline", "", "optional baseline report JSON to compare against")
	jsonPath := flag.String("json", "balance-report.json", "JSON report output path")
	markdownPath := flag.String("markdown", "balance-report.md", "Markdown summary output path")
	endlessPath := flag.String("endless-report", "", "optional endless expedition report JSON for class comparison charts")
	failOnRegression := flag.Bool("fail-on-regression", false, "exit non-zero when regression thresholds are crossed")
	flag.Parse()

	report, err := game.GenerateBalanceReport(*seeds, *firstSeed)
	if err != nil {
		fatal(err)
	}
	var comparison *game.BalanceComparison
	if *baselinePath != "" {
		data, err := os.ReadFile(*baselinePath)
		if err != nil {
			fatal(fmt.Errorf("read baseline: %w", err))
		}
		var baseline game.BalanceReport
		if err := json.Unmarshal(data, &baseline); err != nil {
			fatal(fmt.Errorf("decode baseline: %w", err))
		}
		value := game.CompareBalanceReports(baseline, report)
		comparison = &value
	}

	var endless *EndlessReport
	if *endlessPath != "" {
		data, err := os.ReadFile(*endlessPath)
		if err != nil {\n\t\t\tfatal(fmt.Errorf("read endless report: %w", err))\n\t\t}
		var value EndlessReport
		if err := json.Unmarshal(data, &value); err != nil {\n\t\t\tfatal(fmt.Errorf("decode endless report: %w", err))\n\t\t}
		endless = &value
	}

	encoded, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		fatal(err)
	}
	if err := os.WriteFile(*jsonPath, append(encoded, '\n'), 0644); err != nil {
		fatal(err)
	}
	markdown := renderMarkdown(report, endless)
	if err := os.WriteFile(*markdownPath, []byte(markdown), 0644); err != nil {
		fatal(err)
	}
	fmt.Print(markdown)
	if *failOnRegression && comparison != nil && comparison.Regressions > 0 {
		os.Exit(2)
	}
}

type EndlessReport struct {
	Scenarios []struct {
		Party []string `json:"party"`
		PartySize int `json:"partySize"`
		Policy string `json:"policy"`
		Runs int `json:"runs"`
		Completed int `json:"completed"`
		MedianDepth int `json:"medianDepth"`
	} `json:"scenarios"`
}

func renderMarkdown(report game.BalanceReport, endless *EndlessReport) string {
	var b strings.Builder
	fmt.Fprintf(&b, "# Combat balance report\n\n")
	fmt.Fprintf(&b, "- Report version: %d\n- Scenarios: %d\n- Seeds per scenario: %d (seeds %d–%d)\n- Simulated encounters: %d\n\n", report.Version, len(report.Scenarios), report.SeedCount, report.FirstSeed, report.LastSeed, len(report.Scenarios)*report.SeedCount)
	fmt.Fprintf(&b, "> Policy limitation: %s. This is a deterministic baseline policy, not a model of optimal or human play. Treat results as directional and validate with playtests.\n\n", report.Policy)
	fmt.Fprintf(&b, "| Scenario | Party | Win rate | Wipe rate | Median rounds | P90 rounds | Median health left | Median healing |\n|---|---:|---:|---:|---:|---:|---:|---:|\n")
	for _, s := range report.Scenarios {
		fmt.Fprintf(&b, "| %s | %d | %.0f%% | %.0f%% | %d | %d | %d%% | %d |\n", s.ID, s.PartySize, s.Summary.WinRate*100, s.WipeRate*100, s.Summary.MedianRounds, s.Summary.P90Rounds, s.MedianRemainingHealthPct, s.MedianHealing)
	}
	if endless != nil {
		b.WriteString("\n## Class performance: combat vs endless expeditions\n\n")
		b.WriteString("Solo class results only; combat is the mean win rate across the encounter suite, while endless is first-dungeon completion under the tactical policy. These are separate simulations, so compare directionally.\n\n")
		classes := make([]string, 0)
		combatRates := make(map[string][]float64)
		for _, scenario := range report.Scenarios {
			if scenario.PartySize == 1 && len(scenario.ClassIDs) == 1 {
				classID := scenario.ClassIDs[0]
				if _, ok := combatRates[classID]; !ok {\n\t\t\t\t\tclasses = append(classes, classID)\n\t\t\t\t}
				combatRates[classID] = append(combatRates[classID], scenario.Summary.WinRate*100)
			}
		}
		sort.Strings(classes)
		endlessClear := make(map[string]float64)
		endlessDepth := make(map[string]float64)
		for _, scenario := range endless.Scenarios {
			if scenario.PartySize == 1 && len(scenario.Party) == 1 && scenario.Policy == "tactical" && scenario.Runs > 0 {
				endlessClear[scenario.Party[0]] = float64(scenario.Completed) / float64(scenario.Runs) * 100
				endlessDepth[scenario.Party[0]] = float64(scenario.MedianDepth)
			}
		}
		labels := make([]string, 0, len(classes))
		combatValues := make([]string, 0, len(classes))
		clearValues := make([]string, 0, len(classes))
		depthValues := make([]string, 0, len(classes))
		for _, classID := range classes {
			values := combatRates[classID]; var total float64
			for _, value := range values { total += value }
			labels = append(labels, fmt.Sprintf("%q", strings.Title(strings.ReplaceAll(classID, "-", " "))))
			combatValues = append(combatValues, fmt.Sprintf("%.1f", total/float64(len(values))))
			clear, ok := endlessClear[classID]
			if !ok {\n\t\t\t\tclearValues = append(clearValues, "0")\n\t\t\t\tdepthValues = append(depthValues, "0")\n\t\t\t} else {\n\t\t\t\tclearValues = append(clearValues, fmt.Sprintf("%.1f", clear))\n\t\t\t\tdepthValues = append(depthValues, fmt.Sprintf("%d", int(endlessDepth[classID])))\n\t\t\t}
		}
		if len(classes) > 0 {
			fmt.Fprintf(&b, "### Win/completion rate by class (%%)\n\n```mermaid\nxychart-beta\n    x-axis [%s]\n    y-axis Rate 0 --> 100\n    bar [%s]\n    line [%s]\n```\n\n", strings.Join(labels, ", "), strings.Join(combatValues, ", "), strings.Join(clearValues, ", "))
			b.WriteString("Bars: mean solo combat encounter win rate. Line: solo endless first-dungeon completion rate (tactical policy).\n\n")
			fmt.Fprintf(&b, "### Endless expedition median depth by class (tactical policy)\n\n```mermaid\nxychart-beta\n    x-axis [%s]\n    y-axis MedianDepth 0 --> %d\n    bar [%s]\n```\n\n", strings.Join(labels, ", "), maxInt(endlessDepth), strings.Join(depthValues, ", "))
		}
	}

	b.WriteString("\n## Interpretation\n\n")
	b.WriteString("A changed metric is not automatically a balance defect. Review the scenario, compare the relevant class/party composition, inspect combat logs and shared transition tests, then validate candidate changes with solo and co-op playtests. Do not automatically modify authored stats from this report.\n")
	return b.String()
}

func maxInt(values map[string]float64) int {
	maximum := 1
	for _, value := range values {\n\t\tif int(value) > maximum {\n\t\t\tmaximum = int(value)\n\t\t}\n\t}
	return maximum
}

func fatal(err error) {
	fmt.Fprintln(os.Stderr, err)
	os.Exit(1)
}
