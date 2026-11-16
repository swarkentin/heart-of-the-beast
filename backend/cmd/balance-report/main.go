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
	seeds := flag.Int("seeds", 30, "number of deterministic seeds per scenario")
	firstSeed := flag.Int64("first-seed", 1, "first deterministic seed")
	baselinePath := flag.String("baseline", "", "optional baseline report JSON to compare against")
	jsonPath := flag.String("json", "balance-report.json", "JSON report output path")
	markdownPath := flag.String("markdown", "balance-report.md", "Markdown summary output path")
	failOnRegression := flag.Bool("fail-on-regression", false, "exit non-zero when regression thresholds are crossed")
	flag.Parse()

	report, err := game.GenerateBalanceReport(*seeds, *firstSeed)
	if err != nil { fatal(err) }
	var comparison *game.BalanceComparison
	if *baselinePath != "" {
		data, err := os.ReadFile(*baselinePath)
		if err != nil { fatal(fmt.Errorf("read baseline: %w", err)) }
		var baseline game.BalanceReport
		if err := json.Unmarshal(data, &baseline); err != nil { fatal(fmt.Errorf("decode baseline: %w", err)) }
		value := game.CompareBalanceReports(baseline, report)
		comparison = &value
	}

	encoded, err := json.MarshalIndent(report, "", "  ")
	if err != nil { fatal(err) }
	if err := os.WriteFile(*jsonPath, append(encoded, '\n'), 0644); err != nil { fatal(err) }
	markdown := renderMarkdown(report, comparison)
	if err := os.WriteFile(*markdownPath, []byte(markdown), 0644); err != nil { fatal(err) }
	fmt.Print(markdown)
	if *failOnRegression && comparison != nil && comparison.Regressions > 0 { os.Exit(2) }
}

func renderMarkdown(report game.BalanceReport, comparison *game.BalanceComparison) string {
	var b strings.Builder
	fmt.Fprintf(&b, "# Combat balance report\n\n")
	fmt.Fprintf(&b, "- Report version: %d\n- Scenarios: %d\n- Seeds per scenario: %d (seeds %d–%d)\n- Simulated encounters: %d\n\n", report.Version, len(report.Scenarios), report.SeedCount, report.FirstSeed, report.LastSeed, len(report.Scenarios)*report.SeedCount)
	fmt.Fprintf(&b, "> Policy limitation: %s. This is a deterministic baseline policy, not a model of optimal or human play. Treat findings as investigation prompts and validate with playtests.\n\n", report.Policy)
	fmt.Fprintf(&b, "| Scenario | Party | Win rate | Wipe rate | Median rounds | P90 rounds | Median health left | Median healing |\n|---|---:|---:|---:|---:|---:|---:|---:|\n")
	for _, s := range report.Scenarios {
		fmt.Fprintf(&b, "| %s | %d | %.0f%% | %.0f%% | %d | %d | %d%% | %d |\n", s.ID, s.PartySize, s.Summary.WinRate*100, s.WipeRate*100, s.Summary.MedianRounds, s.Summary.P90Rounds, s.MedianRemainingHealthPct, s.MedianHealing)
	}
	b.WriteString("\n## Findings and suggested investigations\n\n")
	if comparison == nil {
		b.WriteString("No historical baseline supplied. This report is suitable as the first recorded baseline. Extreme win/wipe rates should still be reviewed before accepting it.\n")
	} else if len(comparison.Findings) == 0 {
		b.WriteString("No findings.\n")
	} else {
		for _, finding := range comparison.Findings {
			fmt.Fprintf(&b, "- **%s — %s (%s):** %s\n", strings.ToUpper(finding.Severity), finding.ScenarioID, finding.Metric, finding.Message)
		}
	}
	b.WriteString("\n## Interpretation\n\n")
	b.WriteString("A changed metric is not automatically a balance defect. Review the scenario, compare the relevant class/party composition, inspect combat logs and shared transition tests, then validate candidate changes with solo and co-op playtests. Do not automatically modify authored stats from this report.\n")
	return b.String()
}

func fatal(err error) {
	fmt.Fprintln(os.Stderr, err)
	os.Exit(1)
}
