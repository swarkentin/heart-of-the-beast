package game

import (
	"encoding/json"
	"errors"
	"math/rand"
	"os"
	"strings"
	"testing"
)

func castSkill(t *testing.T, room *Room, playerID, skillID, targetID string) {
	t.Helper()
	command := Command{Type: "combat", Round: room.Run.CombatRound.Number, Action: "skill", Skill: skillID, TargetID: targetID}
	if err := ApplyCommand(room, playerID, command, room.Run.CombatRound.StartedAt); err != nil {
		t.Fatalf("cast %s: %v", skillID, err)
	}
}

func combatEvent(run *Run, kind string) *CombatEvent {
	for i := len(run.LastCombatEvents) - 1; i >= 0; i-- {
		if run.LastCombatEvents[i].Kind == kind {
			return &run.LastCombatEvents[i]
		}
	}
	return nil
}

func TestEveryClassHasTenSkillsOnTheMasteryLadderWithRulesText(t *testing.T) {
	if err := ValidateSkillCatalog(ClassCatalog()); err != nil {
		t.Fatal(err)
	}
	for _, class := range ClassCatalog() {
		skills := SkillsForClass(class.ID)
		if len(skills) != 11 { // ten class skills and Defend
			t.Fatalf("%s has %d skills", class.ID, len(skills))
		}
		for _, definition := range skills {
			if definition.Rules == "" || definition.Icon == "" || definition.Description == "" {
				t.Fatalf("%s is missing its rules, icon or description: %+v", definition.ID, definition)
			}
		}
		if got := DefaultLoadout(class.ID, 1); len(got) != 4 || got[3] != SkillDefend {
			t.Fatalf("%s starts with %v, want three class skills and Defend", class.ID, got)
		}
		if got := DefaultLoadout(class.ID, 15); len(got) != MaxLoadoutSkills {
			t.Fatalf("%s at mastery 15 has a bar of %d", class.ID, len(got))
		}
	}
	if !strings.Contains(mustSkill(t, "cleric.resurrection").Rules, "Once per fight") {
		t.Fatalf("a once-a-fight skill should say so: %q", mustSkill(t, "cleric.resurrection").Rules)
	}
}

func TestBulwarkStartingLoadoutIncludesSoloCounterplay(t *testing.T) {
	loadout := DefaultLoadout(ClassBulwark, 1)
	if !contains(loadout, "bulwark.shield-bash") {
		t.Fatalf("Bulwark's starting loadout should include Shield Bash: %v", loadout)
	}
	if contains(loadout, "bulwark.challenge") {
		t.Fatalf("Challenge should unlock at mastery 2, not occupy a solo starting slot: %v", loadout)
	}
	if err := ValidateLoadout(ClassBulwark, 1, []string{
		"bulwark.mace-strike", "bulwark.shield-wall", "bulwark.shield-bash", SkillDefend,
	}); err != nil {
		t.Fatalf("Shield Bash should be available at mastery 1: %v", err)
	}
	if err := ValidateLoadout(ClassBulwark, 1, []string{
		"bulwark.mace-strike", "bulwark.shield-wall", "bulwark.challenge", SkillDefend,
	}); !errors.Is(err, ErrSkillLocked) {
		t.Fatalf("Challenge should remain locked until mastery 2, got %v", err)
	}
	if err := ValidateLoadout(ClassBulwark, 2, []string{
		"bulwark.mace-strike", "bulwark.shield-wall", "bulwark.challenge", SkillDefend,
	}); err != nil {
		t.Fatalf("Challenge should unlock at mastery 2: %v", err)
	}

	room, _ := newClassCombatTestRoom(t, ClassBulwark)
	enemy := &room.Run.Rooms["entry"].Encounter.Enemies[0]
	enemy.Intent = &EnemyIntent{
		Kind: "heavy", Label: "Crushing blow", Damage: 8,
		Interruptible: true, TargetPlayerID: "player-1",
	}
	command := skillPolicyCommand(room, "player-1", room.Run.CombatRound.Number, rand.New(rand.NewSource(1)))
	if command.Skill != "bulwark.shield-bash" || command.TargetID != enemy.ID {
		t.Fatalf("tactical policy should answer a dangerous telegraph with Shield Bash, got %+v", command)
	}
}

func mustSkill(t *testing.T, id string) SkillDefinition {
	t.Helper()
	definition, ok := findSkill(id)
	if !ok {
		t.Fatalf("missing skill %s", id)
	}
	return definition
}

func TestLoadoutValidationRespectsClassMasteryAndSize(t *testing.T) {
	cases := []struct {
		name    string
		mastery int
		ids     []string
		want    error
	}{
		{"starting bar", 1, []string{"ranger.quick-shot", "ranger.aimed-shot", SkillDefend}, nil},
		{"empty", 1, nil, ErrInvalidLoadout},
		{"too many", 15, []string{"ranger.quick-shot", "ranger.aimed-shot", "ranger.pinning-shot", "ranger.volley", "ranger.hunters-mark", "ranger.barbed-arrow", SkillDefend}, ErrInvalidLoadout},
		{"duplicate", 1, []string{"ranger.quick-shot", "ranger.quick-shot"}, ErrInvalidLoadout},
		{"other class", 15, []string{"ranger.quick-shot", "cleric.renewal"}, ErrInvalidLoadout},
		{"classless strike", 1, []string{SkillStrike}, ErrInvalidLoadout},
		{"locked", 2, []string{"ranger.quick-shot", "ranger.hunters-mark"}, ErrSkillLocked},
		{"nothing ready every round", 15, []string{"ranger.aimed-shot", "ranger.pinning-shot"}, ErrInvalidLoadout},
	}
	for _, test := range cases {
		if err := ValidateLoadout(ClassRanger, test.mastery, test.ids); !errors.Is(err, test.want) {
			t.Errorf("%s: got %v, want %v", test.name, err, test.want)
		}
	}
}

func TestLobbyLoadoutFollowsMasteryAndClassChanges(t *testing.T) {
	room := &Room{PlayerIDs: []string{"player-1"}, Presence: map[string]PlayerPresence{}}
	if err := SelectClass(room, "player-1", ClassAssassin); err != nil {
		t.Fatal(err)
	}
	bar := []string{"assassin.twin-slash", "assassin.rupture"}
	if err := SetPlayerLoadout(room, "player-1", bar); !errors.Is(err, ErrSkillLocked) {
		t.Fatalf("a rank-3 skill should be locked at mastery 1, got %v", err)
	}
	SetPlayerMastery(room, "player-1", 3)
	if err := SetPlayerLoadout(room, "player-1", bar); err != nil {
		t.Fatal(err)
	}
	SetPlayerMastery(room, "player-1", 1)
	if room.PlayerLoadouts["player-1"] != nil {
		t.Fatal("a loadout the recorded mastery no longer allows must be dropped")
	}
	SetPlayerMastery(room, "player-1", 3)
	if err := SetPlayerLoadout(room, "player-1", bar); err != nil {
		t.Fatal(err)
	}
	if err := SelectClass(room, "player-1", ClassRanger); err != nil {
		t.Fatal(err)
	}
	if room.PlayerLoadouts["player-1"] != nil {
		t.Fatal("changing class should forget the old class's skills")
	}
}

func TestCooldownsCountDownAndResetAfterEachFight(t *testing.T) {
	room, _ := newClassCombatTestRoom(t, ClassRanger)
	run := room.Run
	enemy := &run.Rooms["entry"].Encounter.Enemies[0]
	enemy.Health, enemy.MaxHealth = 200, 200
	castSkill(t, room, "player-1", "ranger.aimed-shot", enemy.ID) // cooldown 2
	ranger := run.Players["player-1"]
	if got := ranger.ClassCombat.Cooldowns["ranger.aimed-shot"]; got != 2 {
		t.Fatalf("after the round Aimed Shot should have 2 rounds left, got %d", got)
	}
	err := SubmitCombatAction(room, "player-1", Command{Type: "combat", Round: run.CombatRound.Number, Action: "skill", Skill: "ranger.aimed-shot", TargetID: enemy.ID}, run.CombatRound.StartedAt)
	if !errors.Is(err, ErrSkillCoolingDown) {
		t.Fatalf("expected Aimed Shot to be recovering, got %v", err)
	}
	castSkill(t, room, "player-1", "ranger.quick-shot", enemy.ID)
	castSkill(t, room, "player-1", "ranger.quick-shot", enemy.ID)
	if _, cooling := ranger.ClassCombat.Cooldowns["ranger.aimed-shot"]; cooling {
		t.Fatal("Aimed Shot should be ready two rounds after it was used")
	}
	castSkill(t, room, "player-1", "ranger.aimed-shot", enemy.ID)
	enemy.Health = 1
	castSkill(t, room, "player-1", "ranger.quick-shot", enemy.ID)
	if run.Rooms["entry"].Encounter.Status != EncounterCleared || len(ranger.ClassCombat.Cooldowns) != 0 {
		t.Fatalf("winning a fight should make every skill ready: %+v", ranger.ClassCombat.Cooldowns)
	}
}

func TestInterruptCancelsInterruptibleMovesAndBluntsTheRest(t *testing.T) {
	room, _ := newClassCombatTestRoom(t, ClassRanger)
	run := room.Run
	enemy := &run.Rooms["entry"].Encounter.Enemies[0]
	enemy.Health, enemy.MaxHealth = 100, 100
	enemy.Intent = &EnemyIntent{Kind: "soul_drain", Label: "Soul drain", Damage: 5, Heal: 2, Interruptible: true, TargetPlayerID: "player-1"}
	castSkill(t, room, "player-1", "ranger.pinning-shot", enemy.ID)
	if got := run.Players["player-1"].Health; got != run.Players["player-1"].MaxHealth {
		t.Fatalf("an interrupted move should deal no damage, health=%d", got)
	}
	if event := combatEvent(run, "player_interrupt"); event == nil || event.TargetID != enemy.ID {
		t.Fatalf("expected an interrupt event on the enemy, events=%+v", run.LastCombatEvents)
	}
	if combatEvent(run, "enemy_heal") != nil {
		t.Fatal("an interrupted soul drain must not heal")
	}

	run.Players["player-1"].ClassCombat.Cooldowns = nil
	enemy.Intent = &EnemyIntent{Kind: "heavy", Label: "Crushing blow", Damage: 8, TargetPlayerID: "player-1"}
	before := run.Players["player-1"].Health
	castSkill(t, room, "player-1", "ranger.pinning-shot", enemy.ID)
	if lost := before - run.Players["player-1"].Health; lost != 5 {
		t.Fatalf("Pinning Shot should blunt an uninterruptible 8-damage blow by 3, lost %d", lost)
	}
}

func TestStunSkipsAMinionsTurnButOnlyStaggersABoss(t *testing.T) {
	room, _ := newClassCombatTestRoom(t, ClassBulwark)
	run := room.Run
	run.Players["player-1"].Skills = append(run.Players["player-1"].Skills, "bulwark.shield-slam")
	enemy := &run.Rooms["entry"].Encounter.Enemies[0]
	enemy.Health, enemy.MaxHealth = 100, 100
	castSkill(t, room, "player-1", "bulwark.shield-slam", enemy.ID)
	if enemy.Intent != nil || combatEvent(run, "enemy_stunned") == nil {
		t.Fatalf("a stunned minion should telegraph nothing next round: %+v", enemy.Intent)
	}

	boss, ok := findBossMonster()
	if !ok {
		t.Skip("no boss monster in the catalog")
	}
	enemy.DefinitionID, enemy.Stun = boss, 1
	intent := &EnemyIntent{Damage: 9, TargetPlayerID: "player-1"}
	if got := applyEnemyRoundStart(room, enemy, intent, 5); got == nil || got.Damage != 5 {
		t.Fatalf("a staggered boss should still act, for half damage: %+v", got)
	}
}

func findBossMonster() (string, bool) {
	for _, monster := range defaultMonsterCatalog.Monsters {
		if monster.Role == MonsterRoleBoss {
			return monster.ID, true
		}
	}
	return "", false
}

func TestBulwarkShieldWallProvidesSustainWhenWounded(t *testing.T) {
	room, _ := newClassCombatTestRoom(t, ClassBulwark)
	run := room.Run
	player := run.Players["player-1"]
	player.Health = 15
	enemy := &run.Rooms["entry"].Encounter.Enemies[0]
	enemy.Health, enemy.MaxHealth = 200, 200
	enemy.Intent = &EnemyIntent{Kind: "heavy", Label: "Crushing blow", Damage: 8, TargetPlayerID: player.ID}

	command := skillPolicyCommand(room, player.ID, run.CombatRound.Number, rand.New(rand.NewSource(1)))
	if command.Skill != "bulwark.shield-wall" {
		t.Fatalf("a wounded Bulwark should use Shield Wall to recover, got %+v", command)
	}
	before := player.Health
	if err := SubmitCombatAction(room, player.ID, command, run.CombatRound.StartedAt); err != nil {
		t.Fatalf("submit Shield Wall: %v", err)
	}
	if player.Health != before+2 {
		t.Fatalf("Shield Wall should restore 2 health after the guarded round: before %d, after %d", before, player.Health)
	}
}

func TestTauntDrawsSingleTargetAttacksForItsDuration(t *testing.T) {
	room, _ := newClassCombatTestRoom(t, ClassBulwark, "player-1", "player-2")
	run := room.Run
	// Challenge is an early mastery unlock, not part of a new Bulwark's starting bar.
	run.Players["player-1"].Skills = append(run.Players["player-1"].Skills, "bulwark.challenge")
	enemy := &run.Rooms["entry"].Encounter.Enemies[0]
	enemy.Health, enemy.MaxHealth = 200, 200
	enemy.Intent = &EnemyIntent{Kind: "strike", Label: "Strike", Damage: 6, TargetPlayerID: "player-2"}
	ally := run.Players["player-2"]
	castSkill(t, room, "player-1", "bulwark.challenge", "")
	castSkill(t, room, "player-2", SkillStrike, enemy.ID)
	if ally.Health != ally.MaxHealth {
		t.Fatalf("Challenge should pull the hit off the ally: ally health %d", ally.Health)
	}
	if enemy.TauntedBy != "" {
		t.Fatalf("a one-round taunt should not outlast its round: %+v", enemy)
	}
}

func TestBleedTicksThroughBarriersAndBasicAttacksDoNot(t *testing.T) {
	room, _ := newClassCombatTestRoom(t, ClassAssassin)
	run := room.Run
	run.Players["player-1"].Skills = append(run.Players["player-1"].Skills, "assassin.rupture")
	enemy := &run.Rooms["entry"].Encounter.Enemies[0]
	enemy.Health, enemy.MaxHealth = 100, 100
	enemy.Barrier, enemy.BarrierLabel = 50, "Test Barrier"
	castSkill(t, room, "player-1", "assassin.twin-slash", enemy.ID)
	if enemy.Health != 100 {
		t.Fatalf("a basic attack should be absorbed by the barrier, health=%d", enemy.Health)
	}
	castSkill(t, room, "player-1", "assassin.rupture", enemy.ID)
	if event := combatEvent(run, "bleed"); event == nil || event.Amount != 4 {
		t.Fatalf("Rupture should bleed for 4 at the end of the round: %+v", event)
	}
	if enemy.BleedRounds != 2 {
		t.Fatalf("Rupture bleeds for three rounds, %d left after the first", enemy.BleedRounds)
	}
}

func TestResurrectionRevivesAFallenAllyOncePerFight(t *testing.T) {
	room, _ := newClassCombatTestRoom(t, ClassCleric, "player-1", "player-2")
	run := room.Run
	cleric := run.Players["player-1"]
	cleric.Skills = append(cleric.Skills, "cleric.resurrection")
	ally := run.Players["player-2"]
	ally.Health = 0
	enemy := &run.Rooms["entry"].Encounter.Enemies[0]
	enemy.Health, enemy.MaxHealth = 200, 200
	enemy.Intent = nil
	castSkill(t, room, "player-1", "cleric.resurrection", "player-2")
	if ally.Health != ally.MaxHealth*40/100 {
		t.Fatalf("Resurrection should restore 40%% health, got %d/%d", ally.Health, ally.MaxHealth)
	}
	if err := validateSkillCommand(room, cleric, run.Rooms["entry"].Encounter, Command{Skill: "cleric.resurrection", TargetID: "player-2"}); err == nil {
		t.Fatal("Resurrection must not work twice in a fight or on a living ally")
	}
}

func TestRenewalHealsAChosenAllyAndCommandingStrikeMarksForTheParty(t *testing.T) {
	room, _ := newClassCombatTestRoom(t, ClassCleric, "player-1", "player-2")
	run := room.Run
	enemy := &run.Rooms["entry"].Encounter.Enemies[0]
	enemy.Health, enemy.MaxHealth, enemy.Intent = 200, 200, nil
	ally := run.Players["player-2"]
	ally.Health = 10
	castSkill(t, room, "player-1", "cleric.renewal", "player-2")
	castSkill(t, room, "player-2", SkillStrike, enemy.ID)
	cleric := run.Players["player-1"]
	if want := 10 + 7 + cleric.Stats.Focus; ally.Health != want {
		t.Fatalf("Renewal should heal the ally for 7 plus Focus: %d, want %d", ally.Health, want)
	}

	room, _ = newClassCombatTestRoom(t, ClassTactician, "player-1", "player-2")
	run = room.Run
	enemy = &run.Rooms["entry"].Encounter.Enemies[0]
	enemy.Health, enemy.MaxHealth, enemy.Intent = 200, 200, nil
	castSkill(t, room, "player-1", "tactician.commanding-strike", enemy.ID)
	if err := ApplyCommand(room, "player-2", Command{Type: "combat", Round: run.CombatRound.Number, Action: "defend"}, run.CombatRound.StartedAt); err != nil {
		t.Fatal(err)
	}
	if enemy.MarkedDamage != 3 {
		t.Fatalf("Commanding Strike should leave a 3-damage mark, got %d", enemy.MarkedDamage)
	}
}

func TestLoadoutCanOnlyChangeAtTheCampBetweenDungeons(t *testing.T) {
	room := newPartyRoom(1)
	room.PlayerClasses = map[string]string{"player-1": ClassArcanist}
	room.PlayerMastery = map[string]int{"player-1": 5}
	if err := StartMultiLevelRunForTheme(room, "loadout-camp", "sunken", expeditionNow); err != nil {
		t.Fatal(err)
	}
	run := room.Run
	bar := []string{"arcanist.arcane-bolt", "arcanist.mana-shield", "arcanist.chain-lightning"}
	if err := ApplyCommand(room, "player-1", Command{Type: "set_loadout", SkillIDs: bar}, expeditionNow); !errors.Is(err, ErrInvalidPhase) && !errors.Is(err, ErrLoadoutUnavailable) {
		t.Fatalf("skills cannot change mid-dungeon, got %v", err)
	}
	if run.Briefing == nil || run.Briefing.ThemeID != "sunken" || run.Briefing.Boss == "" || len(run.Briefing.Advice) < 2 || len(run.Briefing.Lines) == 0 {
		t.Fatalf("an expedition should open with a briefing on its first dungeon: %+v", run.Briefing)
	}
	boss := *run.Rooms["d1-boss"]
	run.Depth = run.MaxDepth
	boss.ID = bossRoomID(run)
	run.Rooms[boss.ID] = &boss
	clearFloorBoss(t, room)
	for _, play := range run.Camp.Game.Players {
		play.Done = true
	}
	if !AdvanceCamp(room, expeditionNow) || run.Camp.Stage != CampStageCrossroads {
		t.Fatalf("expected the crossroads: %+v", run.Camp)
	}
	if err := ApplyCommand(room, "player-1", Command{Type: "set_loadout", SkillIDs: []string{"arcanist.meteor", "arcanist.arcane-bolt"}}, expeditionNow); !errors.Is(err, ErrSkillLocked) {
		t.Fatalf("a skill above the player's mastery must stay locked, got %v", err)
	}
	if err := ApplyCommand(room, "player-1", Command{Type: "set_loadout", SkillIDs: bar}, expeditionNow); err != nil {
		t.Fatal(err)
	}
	if strings.Join(run.Players["player-1"].Skills, ",") != strings.Join(bar, ",") {
		t.Fatalf("the new bar should be in place: %v", run.Players["player-1"].Skills)
	}
	first := run.Briefing.Dungeon
	finishCamp(t, room)
	if run.Briefing == nil || run.Briefing.Dungeon == first || run.Briefing.ThemeID != run.Theme() {
		t.Fatalf("entering a new dungeon should brief it: %+v", run.Briefing)
	}
	if want := run.CombatRound.StartedAt.Add(CombatActionWindow + DungeonBriefingWindow); !run.CombatRound.Deadline.Equal(want) {
		t.Fatalf("the first round of a dungeon should allow time to read the briefing: deadline %v, want %v", run.CombatRound.Deadline, want)
	}
}

func TestEveryPlayableDungeonHasABriefing(t *testing.T) {
	if err := validateThemeBriefings(); err != nil {
		t.Fatal(err)
	}
}

// Every skill has a hand-drawn cell on the skill icon sheet (scripts/pixel-art/skill-icons.mjs).
func TestEverySkillHasAPixelArtIcon(t *testing.T) {
	raw, err := os.ReadFile("../../../frontend/public/art/ui/manifest.json")
	if err != nil {
		t.Fatal(err)
	}
	var manifest struct {
		SkillIcons struct {
			Order []string `json:"order"`
		} `json:"skillIcons"`
	}
	if err := json.Unmarshal(raw, &manifest); err != nil {
		t.Fatal(err)
	}
	drawn := map[string]bool{}
	for _, id := range manifest.SkillIcons.Order {
		drawn[id] = true
	}
	for _, definition := range SkillCatalog() {
		if !drawn[definition.ID] {
			t.Errorf("skill %s has no icon: add it to scripts/pixel-art/skill-icons.mjs and run npm run art:build", definition.ID)
		}
	}
}

func TestTacticianCommandingStrikeHasTwoRoundCooldown(t *testing.T) {
	definition, ok := findSkill("tactician.commanding-strike")
	if !ok {
		t.Fatal("missing Commanding Strike")
	}
	if definition.Cooldown != 2 {
		t.Fatalf("Commanding Strike cooldown = %d, want 2", definition.Cooldown)
	}
}
