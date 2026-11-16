package game

import (
	"fmt"
	"sort"
)

const BalanceReportVersion = 1

var balanceEncounterIDs = []string{
	"catacombs-entry",
	"catacombs-reliquary",
	"catacombs-flooded-crossing",
	"catacombs-bone-gallery",
	"catacombs-warden-gate",
	"catacombs-warden-boss",
	"depth-miniboss",
}

type BalanceScenarioReport struct {
	ID                       string                      `json:"id"`
	EncounterID              string                      `json:"encounterId"`
	PartySize                int                         `json:"partySize"`
	EncounterBudget          int                         `json:"encounterBudget"`
	ClassIDs                 []string                    `json:"classIds"`
	Summary                  CombatSimulationBatchReport `json:"summary"`
	WipeRate                 float64                     `json:"wipeRate"`
	MedianRemainingHealthPct int                         `json:"medianRemainingHealthPct"`
	MedianHealing            int                         `json:"medianHealing"`
	MedianPlayersDowned      int                         `json:"medianPlayersDowned"`
}

type BalanceReport struct {
	Version   int                     `json:"version"`
	SeedCount int                     `json:"seedCount"`
	FirstSeed int64                   `json:"firstSeed"`
	LastSeed  int64                   `json:"lastSeed"`
	Policy    string                  `json:"policy"`
	Scenarios []BalanceScenarioReport `json:"scenarios"`
}

type BalanceFinding struct {
	ScenarioID string  `json:"scenarioId"`
	Severity   string  `json:"severity"`
	Metric     string  `json:"metric"`
	Message    string  `json:"message"`
	Delta      float64 `json:"delta,omitempty"`
}

type BalanceComparison struct {
	BaselineVersion int              `json:"baselineVersion"`
	CurrentVersion  int              `json:"currentVersion"`
	Findings        []BalanceFinding `json:"findings"`
	Regressions     int              `json:"regressions"`
}

// GenerateBalanceReport runs a fixed, catalog-backed scenario suite. Solo
// scenarios cover every class; co-op scenarios use deterministic mixed-class
// parties. Fixed seeds make reports comparable across commits.
func GenerateBalanceReport(seedCount int, firstSeed int64) (BalanceReport, error) {
	if seedCount <= 0 {
		return BalanceReport{}, fmt.Errorf("seed count must be positive")
	}
	classes := ClassCatalog()
	if len(classes) == 0 {
		return BalanceReport{}, fmt.Errorf("class catalog is empty")
	}
	report := BalanceReport{
		Version:   BalanceReportVersion,
		SeedCount: seedCount,
		FirstSeed: firstSeed,
		LastSeed:  firstSeed + int64(seedCount) - 1,
		Policy:    "deterministic baseline policy: situational signature abilities, interrupt dangerous telegraphs, defend against high incoming pressure, otherwise focus lowest-health target",
	}
	for _, encounterID := range balanceEncounterIDs {
		for _, class := range classes {
			players, classIDs, err := balancePlayers([]ClassDefinition{class})
			if err != nil {
				return BalanceReport{}, err
			}
			if err := appendBalanceScenario(&report, encounterID, 1, players, classIDs, seedCount, firstSeed); err != nil {
				return BalanceReport{}, err
			}
		}
		for _, partySize := range []int{2, 4} {
			partyClasses := make([]ClassDefinition, partySize)
			for i := range partyClasses {
				partyClasses[i] = classes[i%len(classes)]
			}
			players, classIDs, err := balancePlayers(partyClasses)
			if err != nil {
				return BalanceReport{}, err
			}
			if err := appendBalanceScenario(&report, encounterID, partySize, players, classIDs, seedCount, firstSeed); err != nil {
				return BalanceReport{}, err
			}
		}
	}
	sort.Slice(report.Scenarios, func(i, j int) bool {
		return report.Scenarios[i].ID < report.Scenarios[j].ID
	})
	return report, nil
}

func balancePlayers(definitions []ClassDefinition) ([]PlayerState, []string, error) {
	players := make([]PlayerState, 0, len(definitions))
	classIDs := make([]string, 0, len(definitions))
	for i, definition := range definitions {
		build, err := StartingBuildForClass(definition.ID)
		if err != nil {
			return nil, nil, err
		}
		players = append(players, PlayerState{
			ID:             fmt.Sprintf("hero-%d", i+1),
			Health:         build.MaxHealth,
			MaxHealth:      build.MaxHealth,
			StrikeDamage:   PlayerStrikeDamage,
			GuardReduction: GuardDamageReduction,
			Archetype:      definition.ArchetypeID,
			ClassBuild:     &build,
			Level:          1,
			Talents:        []string{},
			Stats:          build.Stats,
		})
		classIDs = append(classIDs, definition.ID)
	}
	return players, classIDs, nil
}

func appendBalanceScenario(report *BalanceReport, encounterID string, partySize int, players []PlayerState, classIDs []string, seedCount int, firstSeed int64) error {
	encounter, err := defaultEncounterCatalog.Instantiate(encounterID, "balance-", MonsterScaling{PartySize: partySize})
	if err != nil {
		return err
	}
	snapshot := CombatSimulationSnapshot{
		Players:          players,
		Enemies:          encounter.Enemies,
		ExperienceReward: EncounterExperienceReward,
	}
	seeds := make([]int64, seedCount)
	for i := range seeds {
		seeds[i] = firstSeed + int64(i)
	}
	runs, err := SimulateCombatBatch(snapshot, seeds, 100)
	if err != nil {
		return fmt.Errorf("scenario %s: %w", encounterID, err)
	}
	summary := SummarizeCombatBatch(runs)
	maxHealth := 0
	for _, player := range players {
		maxHealth += player.MaxHealth
	}
	remaining := make([]int, 0, len(runs))
	healing := make([]int, 0, len(runs))
	downed := make([]int, 0, len(runs))
	for _, run := range runs {
		total := 0
		for _, health := range run.RemainingPlayerHealth {
			total += health
		}
		pct := 0
		if maxHealth > 0 {
			pct = total * 100 / maxHealth
		}
		remaining = append(remaining, pct)
		healing = append(healing, run.PlayerHealing)
		downed = append(downed, run.PlayersDowned)
	}
	sort.Ints(remaining)
	sort.Ints(healing)
	sort.Ints(downed)
	id := fmt.Sprintf("%s/party-%d/%s", encounterID, partySize, joinClassIDs(classIDs))
	wipeRate := float64(summary.Wipes) / float64(summary.Runs)
	report.Scenarios = append(report.Scenarios, BalanceScenarioReport{
		ID:                       id,
		EncounterID:              encounterID,
		PartySize:                partySize,
		EncounterBudget:          encounter.Budget,
		ClassIDs:                 classIDs,
		Summary:                  summary,
		WipeRate:                 wipeRate,
		MedianRemainingHealthPct: median(remaining),
		MedianHealing:            median(healing),
		MedianPlayersDowned:      median(downed),
	})
	return nil
}

func joinClassIDs(ids []string) string {
	result := ""
	for i, id := range ids {
		if i > 0 {
			result += "+"
		}
		result += id
	}
	return result
}

// CompareBalanceReports emits investigation prompts and flags large regressions.
// It never recommends or applies specific stat changes automatically.
func CompareBalanceReports(baseline, current BalanceReport) BalanceComparison {
	comparison := BalanceComparison{
		BaselineVersion: baseline.Version,
		CurrentVersion:  current.Version,
	}
	previous := make(map[string]BalanceScenarioReport, len(baseline.Scenarios))
	for _, scenario := range baseline.Scenarios {
		previous[scenario.ID] = scenario
	}
	for _, now := range current.Scenarios {
		before, ok := previous[now.ID]
		if !ok {
			comparison.Findings = append(comparison.Findings, BalanceFinding{
				ScenarioID: now.ID,
				Severity:   "info",
				Metric:     "coverage",
				Message:    "New scenario; establish its baseline before tuning.",
			})
		} else {
			deltaWin := now.Summary.WinRate - before.Summary.WinRate
			if deltaWin <= -0.10 {
				comparison.Findings = append(comparison.Findings, BalanceFinding{
					ScenarioID: now.ID,
					Severity:   "regression",
					Metric:     "winRate",
					Delta:      deltaWin,
					Message:    "Win rate dropped by at least 10 percentage points; inspect encounter pressure, class actions, and mitigation.",
				})
				comparison.Regressions++
			}
			if now.WipeRate-before.WipeRate >= 0.10 {
				comparison.Findings = append(comparison.Findings, BalanceFinding{
					ScenarioID: now.ID,
					Severity:   "regression",
					Metric:     "wipeRate",
					Delta:      now.WipeRate - before.WipeRate,
					Message:    "Wipe rate increased by at least 10 percentage points; inspect damage spikes and telegraph counterplay.",
				})
				comparison.Regressions++
			}
			if before.Summary.P90Rounds > 0 && float64(now.Summary.P90Rounds) >= float64(before.Summary.P90Rounds)*1.30 {
				comparison.Findings = append(comparison.Findings, BalanceFinding{
					ScenarioID: now.ID,
					Severity:   "warning",
					Metric:     "p90Rounds",
					Delta:      float64(now.Summary.P90Rounds - before.Summary.P90Rounds),
					Message:    "90th-percentile encounter length grew by at least 30%; inspect damage throughput and enemy healing.",
				})
			}
		}
		if now.EncounterBudget >= 3 && now.Summary.WinRate >= 0.99 && now.WipeRate == 0 {
			comparison.Findings = append(comparison.Findings, BalanceFinding{
				ScenarioID: now.ID,
				Severity:   "suggestion",
				Metric:     "winRate",
				Message:    "Baseline policy wins almost every run; consider whether this encounter offers enough pressure or meaningful decisions.",
			})
		}
		if now.Summary.WinRate < 0.60 || now.WipeRate >= 0.30 {
			comparison.Findings = append(comparison.Findings, BalanceFinding{
				ScenarioID: now.ID,
				Severity:   "suggestion",
				Metric:     "difficulty",
				Message:    "This scenario is unusually punishing for the baseline policy; review telegraph readability, solo counterplay, and party-size scaling.",
			})
		}
	}
	if len(comparison.Findings) == 0 {
		comparison.Findings = append(comparison.Findings, BalanceFinding{
			Severity: "info",
			Metric:   "overall",
			Message:  "No threshold-level balance drift detected. Continue validating against human playtests.",
		})
	}
	return comparison
}
