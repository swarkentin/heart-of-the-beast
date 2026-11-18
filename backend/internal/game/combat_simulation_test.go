package game

import (
	"math/rand"
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

func TestSimulateCombatAppliesPassiveAttackBonuses(t *testing.T) {
	base := simulationFixture(t)
	base.Enemies[0].Health = 100
	base.Enemies[0].MaxHealth = 100

	passiveBuild := base
	passiveBuild.Players = append([]PlayerState(nil), base.Players...)
	passiveBuild.Players[0].Health = 10
	passiveBuild.Players[0].ClassBuild = &ClassBuildSnapshot{PassiveID: "passive.bloodied-strength"}
	passiveBuild.Players[0].Skills = []string{SkillStrike, SkillDefend}

	baseReport, err := SimulateCombat(base, 7, 1)
	if err != nil {
		t.Fatal(err)
	}
	passiveReport, err := SimulateCombat(passiveBuild, 7, 1)
	if err != nil {
		t.Fatal(err)
	}
	if got := passiveReport.PlayerDamageDealt - baseReport.PlayerDamageDealt; got != 3 {
		t.Fatalf("bloodied-strength should add 3 damage below half health, got delta %d", got)
	}
}

func TestSimulateCombatAppliesPassiveMitigation(t *testing.T) {
	base := simulationFixture(t)
	base.Players[0].Health = 30
	base.Players[0].MaxHealth = 30
	base.Enemies[0].Behavior = "warden"
	base.Players[0].Stats.Focus = 0
	base.Players[0].GuardReduction = 10
	base.Enemies[0].Health = 100
	base.Enemies[0].MaxHealth = 100

	passiveBuild := base
	passiveBuild.Players = append([]PlayerState(nil), base.Players...)
	passiveBuild.Enemies = append([]Enemy(nil), base.Enemies...)
	passiveBuild.Players[0].ClassBuild = &ClassBuildSnapshot{PassiveID: "passive.arcane-resistance"}
	passiveBuild.Players[0].Skills = []string{SkillStrike, SkillDefend}

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

// policyRoom is a one-encounter room for checking what the skill policy chooses.
func policyRoom(players map[string]*PlayerState, enemies []Enemy) *Room {
	ids := sortedPlayerIDs(players)
	room := &Room{
		ID: simulationRoomID, PlayerIDs: ids, Presence: map[string]PlayerPresence{},
		Run: &Run{
			ID: simulationRoomID, Phase: PhaseCombat, CurrentRoomID: simulationRoomID, Players: players, Flags: map[string]bool{},
			CombatRound: &CombatRound{Number: 1, Actions: map[string]Command{}},
			Rooms: map[string]*DungeonRoom{simulationRoomID: {ID: simulationRoomID, RoomType: "combat", Encounter: &Encounter{
				Status: EncounterActive, Enemies: enemies,
			}}},
		},
	}
	return room
}

func classPlayer(t *testing.T, id, classID string, mastery int) *PlayerState {
	t.Helper()
	definition, ok := findClass(classID)
	if !ok {
		t.Fatalf("unknown class %q", classID)
	}
	player := newPlayerStateForClass(id, definition)
	player.Skills = SkillIDsUpTo(classID, mastery)
	return player
}

// SkillIDsUpTo is every skill of a class unlocked at a mastery level, truncated to a bar.
func SkillIDsUpTo(classID string, mastery int) []string {
	var ids []string
	for _, definition := range SkillsForClass(classID) {
		if definition.MasteryLevel <= mastery && len(ids) < MaxLoadoutSkills {
			ids = append(ids, definition.ID)
		}
	}
	return ids
}

func TestSkillPolicyInterruptsHealsAndProtects(t *testing.T) {
	rng := rand.New(rand.NewSource(1))

	ranger := classPlayer(t, "hero", ClassRanger, 1)
	enemies := []Enemy{{ID: "foe", Name: "Foe", Health: 20, MaxHealth: 20, Behavior: "skeleton", Intent: &EnemyIntent{Damage: 8, Interruptible: true, Label: "Big Swing", TargetPlayerID: "hero"}}}
	command := skillPolicyCommand(policyRoom(map[string]*PlayerState{"hero": ranger}, enemies), "hero", 1, rng)
	if command.Skill != "ranger.pinning-shot" || command.TargetID != "foe" {
		t.Fatalf("ranger should interrupt the telegraph, chose %+v", command)
	}

	cleric := classPlayer(t, "cleric", ClassCleric, 1)
	ally := classPlayer(t, "ally", ClassBulwark, 1)
	ally.Health = 8
	enemies = []Enemy{{ID: "foe", Name: "Foe", Health: 20, MaxHealth: 20, Behavior: "skeleton", Intent: &EnemyIntent{Damage: 3, TargetPlayerID: "cleric"}}}
	command = skillPolicyCommand(policyRoom(map[string]*PlayerState{"cleric": cleric, "ally": ally}, enemies), "cleric", 1, rng)
	if command.Skill != "cleric.renewal" || command.TargetID != "ally" {
		t.Fatalf("cleric should heal the wounded ally, chose %+v", command)
	}

	bulwark := classPlayer(t, "tank", ClassBulwark, 1)
	bulwark.Health = 6
	enemies = []Enemy{{ID: "foe", Name: "Foe", Health: 40, MaxHealth: 40, Behavior: "skeleton", Intent: &EnemyIntent{Damage: 9, TargetPlayerID: "tank"}}}
	command = skillPolicyCommand(policyRoom(map[string]*PlayerState{"tank": bulwark}, enemies), "tank", 1, rng)
	if command.Skill != "bulwark.shield-wall" {
		t.Fatalf("bulwark facing a killing blow should raise Shield Wall, chose %+v", command)
	}
}

func TestSkillPolicyDoesNotSelfHealInsteadOfWoundedAlly(t *testing.T) {
	rng := rand.New(rand.NewSource(2))
	bulwark := classPlayer(t, "tank", ClassBulwark, 1)
	bulwark.Health = 15
	ally := classPlayer(t, "ally", ClassCleric, 1)
	ally.Health = 5
	enemies := []Enemy{{ID: "foe", Name: "Foe", Health: 40, MaxHealth: 40, Behavior: "skeleton"}}

	command := skillPolicyCommand(policyRoom(map[string]*PlayerState{
		"tank": bulwark, "ally": ally,
	}, enemies), "tank", 1, rng)
	if command.Skill == "bulwark.shield-wall" {
		t.Fatalf("Bulwark should not spend its action healing itself while an ally is more wounded: %+v", command)
	}
}

func TestSkillPolicyCommandsAreAlwaysValidForEveryClassAndRank(t *testing.T) {
	rng := rand.New(rand.NewSource(3))
	for _, class := range ClassCatalog() {
		for _, mastery := range []int{1, 5, 15} {
			hero := classPlayer(t, "hero", class.ID, mastery)
			ally := classPlayer(t, "ally", ClassCleric, 1)
			ally.Health = 0
			enemies := []Enemy{
				{ID: "a", Name: "A", Health: 9, MaxHealth: 20, Behavior: "skeleton", Intent: &EnemyIntent{Damage: 6, Interruptible: true, TargetPlayerID: "hero"}},
				{ID: "b", Name: "B", Health: 20, MaxHealth: 20, Behavior: "skeleton"},
			}
			room := policyRoom(map[string]*PlayerState{"hero": hero, "ally": ally}, enemies)
			for round := 0; round < 6; round++ {
				command := skillPolicyCommand(room, "hero", 1, rng)
				if command.Action == "skill" {
					if err := validateSkillCommand(room, hero, room.Run.Rooms[simulationRoomID].Encounter, command); err != nil {
						t.Fatalf("%s rank %d: policy chose invalid %+v: %v", class.ID, mastery, command, err)
					}
					definition, _ := findSkill(command.Skill)
					if definition.Cooldown > 0 {
						hero.ClassCombat.Cooldowns = map[string]int{command.Skill: definition.Cooldown + 1}
					}
				}
			}
		}
	}
}

func TestSimulateCombatExecutesClassSkillsAndReportsUse(t *testing.T) {
	snapshot := simulationFixture(t)
	snapshot.Players[0].ClassBuild = &ClassBuildSnapshot{ClassID: ClassArcanist, PassiveID: "passive.arcane-focus"}
	snapshot.Players[0].Skills = DefaultLoadout(ClassArcanist, 1)
	snapshot.Enemies[0].Health = 100
	snapshot.Enemies[0].MaxHealth = 100

	report, err := SimulateCombat(snapshot, 11, 1)
	if err != nil {
		t.Fatal(err)
	}
	if report.AbilityUses["arcanist.fireball"] != 1 {
		t.Fatalf("expected Fireball to be cast once, got %#v", report.AbilityUses)
	}
	if report.PlayerDamageDealt <= 0 {
		t.Fatalf("expected Fireball to deal damage, got %#v", report)
	}
}

func TestSimulateCombatRejectsUnknownMonsterBehavior(t *testing.T) {
	snapshot := simulationFixture(t)
	snapshot.Enemies[0].Behavior = "missing-monster"
	if _, err := SimulateCombat(snapshot, 1, 10); err == nil {
		t.Fatal("expected unknown monster behavior to be rejected")
	}
}
