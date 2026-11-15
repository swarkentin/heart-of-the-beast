package game

import (
	"reflect"
	"testing"
)

func simulationFixture(t *testing.T) CombatSimulationSnapshot {
	t.Helper()
	encounter, err := defaultEncounterCatalog.Instantiate("catacombs-entry", "sim-", MonsterScaling{PartySize: 1})
	if err != nil {
		t.Fatal(err)
	}
	return CombatSimulationSnapshot{
		Players:          []PlayerState{{
			ID: "hero", Health: 30, MaxHealth: 30, StrikeDamage: 8,
			Level: 1, Stats: PlayerStats{Power: 2, Focus: 2, Agility: 1},
		}},
		Enemies:          encounter.Enemies,
		ExperienceReward: 60,
	}
}

func TestSimulateCombatIsDeterministicAndDoesNotMutateSnapshot(t *testing.T) {
	snapshot := simulationFixture(t)
	before := CombatSimulationSnapshot{
		Players:          append([]PlayerState(nil), snapshot.Players...),
		Enemies:          append([]Enemy(nil), snapshot.Enemies...),
		ExperienceReward: snapshot.ExperienceReward,
	}

	first, err := SimulateCombat(snapshot, 42, 20)
	if err != nil {
		t.Fatal(err)
	}
	second, err := SimulateCombat(snapshot, 42, 20)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(first, second) {
		t.Fatalf("same seed produced different reports:\nfirst: %#v\nsecond: %#v", first, second)
	}
	if !reflect.DeepEqual(snapshot, before) {
		t.Fatal("simulation mutated its input snapshot")
	}
	if !first.Won || first.Wiped {
		t.Fatalf("expected a victory, got %#v", first)
	}
	if first.Rounds != 2 {
		t.Fatalf("expected two rounds, got %d", first.Rounds)
	}
	if first.PlayerProgression["hero"].Level != 2 {
		t.Fatalf("expected encounter XP to advance the player to level 2: %#v", first.PlayerProgression)
	}
}

func TestSimulateCombatBatchPreservesSeedOrder(t *testing.T) {
	snapshot := simulationFixture(t)
	seeds := []int64{9, 3, 12}
	reports, err := SimulateCombatBatch(snapshot, seeds, 20)
	if err != nil {
		t.Fatal(err)
	}
	if len(reports) != len(seeds) {
		t.Fatalf("got %d reports for %d seeds", len(reports), len(seeds))
	}
	for i, seed := range seeds {
		if reports[i].Seed != seed {
			t.Fatalf("report %d has seed %d, want %d", i, reports[i].Seed, seed)
		}
	}
}

func TestSimulateCombatRejectsInvalidSnapshots(t *testing.T) {
	_, err := SimulateCombat(CombatSimulationSnapshot{}, 1, 10)
	if err == nil {
		t.Fatal("expected empty snapshot to be rejected")
	}
}

func TestSummarizeCombatBatchUsesNearestRankDistributions(t *testing.T) {
	reports := []CombatSimulationReport{
		{Won: true, Rounds: 2, PlayerDamageDealt: 20, PlayerDamageReceived: 4},
		{Won: false, Wiped: true, Rounds: 8, PlayerDamageDealt: 10, PlayerDamageReceived: 30},
		{Won: true, Rounds: 4, PlayerDamageDealt: 30, PlayerDamageReceived: 12},
		{Won: true, Rounds: 6, PlayerDamageDealt: 40, PlayerDamageReceived: 8},
	}
	summary := SummarizeCombatBatch(reports)
	if summary.Runs != 4 || summary.Wins != 3 || summary.Wipes != 1 || summary.WinRate != 0.75 {
		t.Fatalf("unexpected batch outcomes: %#v", summary)
	}
	if summary.MedianRounds != 5 || summary.P90Rounds != 8 {
		t.Fatalf("unexpected round distribution: %#v", summary)
	}
	if summary.MedianDamageDealt != 25 || summary.MedianDamageReceived != 10 {
		t.Fatalf("unexpected damage distribution: %#v", summary)
	}
}

func TestSimulateCombatRejectsUnknownMonsterBehavior(t *testing.T) {
	snapshot := simulationFixture(t)
	snapshot.Enemies[0].Behavior = "missing-monster"
	if _, err := SimulateCombat(snapshot, 1, 10); err == nil {
		t.Fatal("expected unknown monster behavior to be rejected")
	}
}
