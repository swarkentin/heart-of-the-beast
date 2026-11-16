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
		Players: []PlayerState{{
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
		t.Fatalf("expected two rounds after the enemy health tuning, got %d", first.Rounds)
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

func TestSimulateCombatAppliesTalentAndPassiveAttackBonuses(t *testing.T) {
	base := simulationFixture(t)
	base.Enemies[0].Health = 100
	base.Enemies[0].MaxHealth = 100

	talentBuild := base
	talentBuild.Players = append([]PlayerState(nil), base.Players...)
	talentBuild.Players[0].Talents = []string{"damage-heavy-hands"}

	passiveBuild := base
	passiveBuild.Players = append([]PlayerState(nil), base.Players...)
	passiveBuild.Players[0].Health = 10
	passiveBuild.Players[0].ClassBuild = &ClassBuildSnapshot{PassiveID: "passive.bloodied-strength"}

	baseReport, err := SimulateCombat(base, 7, 1)
	if err != nil {
		t.Fatal(err)
	}
	talentReport, err := SimulateCombat(talentBuild, 7, 1)
	if err != nil {
		t.Fatal(err)
	}
	passiveReport, err := SimulateCombat(passiveBuild, 7, 1)
	if err != nil {
		t.Fatal(err)
	}

	if got := talentReport.PlayerDamageDealt - baseReport.PlayerDamageDealt; got != 3 {
		t.Fatalf("damage-heavy-hands should add 3 attack damage, got delta %d", got)
	}
	if got := passiveReport.PlayerDamageDealt - baseReport.PlayerDamageDealt; got != 3 {
		t.Fatalf("bloodied-strength should add 3 attack damage below half health, got delta %d", got)
	}
}

func TestSimulateCombatAppliesTalentAndPassiveMitigation(t *testing.T) {
	base := simulationFixture(t)
	base.Players[0].Health = 30
	base.Players[0].MaxHealth = 30
	base.Enemies[0].Behavior = "warden"
	base.Players[0].Stats.Focus = 0
	base.Enemies[0].Health = 100
	base.Enemies[0].MaxHealth = 100

	passiveBuild := base
	passiveBuild.Players = append([]PlayerState(nil), base.Players...)
	passiveBuild.Players[0].ClassBuild = &ClassBuildSnapshot{PassiveID: "passive.arcane-resistance"}

	baseReport, err := SimulateCombat(base, 11, 1)
	if err != nil {
		t.Fatal(err)
	}
	passiveReport, err := SimulateCombat(passiveBuild, 11, 1)
	if err != nil {
		t.Fatal(err)
	}

	if passiveReport.PlayerDamageReceived >= baseReport.PlayerDamageReceived {
		t.Fatalf("arcane resistance should reduce soul-drain damage: base=%d passive=%d", baseReport.PlayerDamageReceived, passiveReport.PlayerDamageReceived)
	}
}

func TestSimulationClassAbilityPolicyCoversEverySignatureEffect(t *testing.T) {
	tests := []struct {
		name       string
		effectID   string
		mode       string
		configure  func(*PlayerState, map[string]*PlayerState, []Enemy)
		wantTarget string
	}{
		{name: "guard", effectID: "combat.guard", configure: func(p *PlayerState, _ map[string]*PlayerState, enemies []Enemy) {
			enemies[0].Intent = &EnemyIntent{Damage: 10, TargetPlayerID: p.ID}
		}},
		{name: "counter", effectID: "combat.counter", configure: func(p *PlayerState, _ map[string]*PlayerState, _ []Enemy) {
			p.ClassCombat.DamageTakenLastRound = 4
		}, wantTarget: "enemy"},
		{name: "ward", effectID: "combat.ward", configure: func(p *PlayerState, _ map[string]*PlayerState, enemies []Enemy) {
			enemies[0].Intent = &EnemyIntent{Damage: 10, TargetPlayerID: p.ID}
		}},
		{name: "precision", effectID: "combat.precision", configure: func(_ *PlayerState, _ map[string]*PlayerState, enemies []Enemy) {
			enemies[0].Intent = &EnemyIntent{Damage: 4}
		}, wantTarget: "enemy"},
		{name: "elemental", effectID: "combat.elemental", mode: "frost", configure: func(_ *PlayerState, _ map[string]*PlayerState, enemies []Enemy) {
			enemies[0].Intent = &EnemyIntent{Damage: 8, Interruptible: true}
		}, wantTarget: "enemy"},
		{name: "disrupt", effectID: "combat.disrupt", configure: func(_ *PlayerState, _ map[string]*PlayerState, enemies []Enemy) {
			enemies[0].Intent = &EnemyIntent{Damage: 4}
		}, wantTarget: "enemy"},
		{name: "heal", effectID: "combat.heal", configure: func(p *PlayerState, _ map[string]*PlayerState, _ []Enemy) {
			p.Health = 20
		}, wantTarget: "hero"},
		{name: "command", effectID: "combat.command", configure: func(_ *PlayerState, _ map[string]*PlayerState, _ []Enemy) {}, wantTarget: "enemy"},
		{name: "companion", effectID: "combat.companion", mode: "disrupt", configure: func(_ *PlayerState, _ map[string]*PlayerState, enemies []Enemy) {
			enemies[0].Intent = &EnemyIntent{Damage: 8, Interruptible: true}
		}, wantTarget: "enemy"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			player := &PlayerState{ID: "hero", Health: 30, MaxHealth: 30, Stats: PlayerStats{Focus: 2}}
			players := map[string]*PlayerState{"hero": player, "ally": {ID: "ally", Health: 30, MaxHealth: 30}}
			enemies := []Enemy{{ID: "enemy", Health: 20, MaxHealth: 20}}
			player.ClassBuild = &ClassBuildSnapshot{SignatureAbilityID: signatureAbilityIDForEffect(test.effectID)}
			test.configure(player, players, enemies)
			command, ok := simulationClassAbilityCommand(player, players, enemies, 0, "hero")
			if !ok {
				t.Fatal("expected policy to select signature ability")
			}
			if command.Action != "ability" {
				t.Fatalf("got action %q", command.Action)
			}
			if test.mode != "" && command.Mode != test.mode {
				t.Fatalf("got mode %q, want %q", command.Mode, test.mode)
			}
			if test.wantTarget != "" && command.TargetID != test.wantTarget {
				t.Fatalf("got target %q, want %q", command.TargetID, test.wantTarget)
			}
		})
	}
}

func signatureAbilityIDForEffect(effectID string) string {
	for _, ability := range classAbilities {
		if ability.EffectID == effectID {
			return ability.ID
		}
	}
	return ""
}

func TestSimulateCombatExecutesSignatureAbilityAndReportsUse(t *testing.T) {
	snapshot := simulationFixture(t)
	snapshot.Players[0].ClassBuild = &ClassBuildSnapshot{SignatureAbilityID: "ability.elemental-surge"}
	snapshot.Enemies[0].Health = 100
	snapshot.Enemies[0].MaxHealth = 100

	report, err := SimulateCombat(snapshot, 11, 1)
	if err != nil {
		t.Fatal(err)
	}
	if report.AbilityUses["combat.elemental"] != 1 {
		t.Fatalf("expected elemental surge to be used once, got %#v", report.AbilityUses)
	}
	if report.PlayerDamageDealt <= 0 {
		t.Fatalf("expected signature ability to deal damage, got %#v", report)
	}
}

func TestSimulateCombatRejectsUnknownMonsterBehavior(t *testing.T) {
	snapshot := simulationFixture(t)
	snapshot.Enemies[0].Behavior = "missing-monster"
	if _, err := SimulateCombat(snapshot, 1, 10); err == nil {
		t.Fatal("expected unknown monster behavior to be rejected")
	}
}
