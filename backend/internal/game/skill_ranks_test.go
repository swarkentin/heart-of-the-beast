package game

import (
	"errors"
	"strings"
	"testing"
	"time"
)

func TestRankedSkillScalesOnlyScalingEffects(t *testing.T) {
	bash, _ := findSkill("bulwark.shield-bash") // dmg(3, power), interrupt(2)
	ranked := rankedSkill(bash, 3)
	if ranked.Effects[0].Amount != 4 || ranked.Effects[1].Amount != 3 {
		t.Fatalf("rank III shield bash effects = %+v, want damage 4 and interrupt 3", ranked.Effects)
	}
	if bash.Effects[0].Amount != 3 {
		t.Fatal("ranking a skill must not mutate the catalog")
	}
	if ranked.Rules == bash.Rules {
		t.Fatal("ranked rules should describe the stronger effects")
	}
	for _, definition := range SkillCatalog() {
		top := rankedSkill(definition, MaxSkillRank+3)
		// Ranks III and V append one flourish after the skill's own effects (Defend's lives in defend instead).
		wantExtra := 1
		if definition.ID == SkillDefend {
			wantExtra = 0
		}
		if len(top.Effects) != len(definition.Effects)+wantExtra {
			t.Fatalf("%s: want %d effects at rank V, got %+v", definition.ID, len(definition.Effects)+wantExtra, top.Effects)
		}
		for i, effect := range top.Effects[:len(definition.Effects)] {
			base := definition.Effects[i]
			if effect.Kind != base.Kind || effect.Rounds != base.Rounds || effect.Scope != base.Scope || effect.When != base.When {
				t.Fatalf("%s: ranks may only change amounts, got %+v from %+v", definition.ID, effect, base)
			}
			if effect.Kind == EffectRevive && effect.Amount > 100 {
				t.Fatalf("%s: revive above 100%%", definition.ID)
			}
		}
		if len(definition.RankRules) != MaxSkillRank {
			t.Fatalf("%s: want %d rank rules, got %d", definition.ID, MaxSkillRank, len(definition.RankRules))
		}
	}
}

func TestRanksThreeAndFiveAddAFlourishThatSuitsTheSkill(t *testing.T) {
	cases := []struct {
		id   string
		kind SkillEffectKind
		iii  int
		v    int
	}{
		{"assassin.twin-slash", EffectEcho, 2, 3},     // strike
		{"spellguard.runic-ward", EffectThorns, 1, 2}, // guard
		{"bulwark.challenge", EffectThorns, 1, 2},     // control that only targets you
		{"assassin.throat-jab", EffectMark, 1, 2},     // control aimed at an enemy
		{"cleric.renewal", EffectHeal, 2, 3},          // support
	}
	for _, c := range cases {
		definition, _ := findSkill(c.id)
		if two := rankedSkill(definition, 2); len(two.Effects) != len(definition.Effects) {
			t.Fatalf("%s: rank II must not add a flourish: %+v", c.id, two.Effects)
		}
		for rank, want := range map[int]int{3: c.iii, 4: c.iii, 5: c.v} {
			effects := rankedSkill(definition, rank).Effects
			last := effects[len(effects)-1]
			if len(effects) != len(definition.Effects)+1 || last.Kind != c.kind || last.Amount != want {
				t.Fatalf("%s rank %d: want %s %d last, got %+v", c.id, rank, c.kind, want, effects)
			}
		}
	}
	if rules := rankedSkill(mustSkill(t, "assassin.twin-slash"), 5).Rules; !strings.Contains(rules, "Echo: a 35% chance to strike again for 3") {
		t.Fatalf("rank V rules should describe the echo: %q", rules)
	}
	if !strings.Contains(defendRankRules(3), "Reflect 1") || strings.Contains(defendRankRules(2), "Reflect") {
		t.Fatalf("Defend gains thorns at III: %q / %q", defendRankRules(2), defendRankRules(3))
	}
}

func TestEchoRollIsStableAndNearItsChance(t *testing.T) {
	run := &Run{Seed: 42}
	player := &PlayerState{ID: "p1"}
	hits := 0
	for round := 1; round <= 2000; round++ {
		enemy := &Enemy{ID: "e" + itoa(round%7)}
		first := echoRoll(run, player, enemy, round, 25)
		if first != echoRoll(run, player, enemy, round, 25) {
			t.Fatal("the echo roll must be stable for the same action")
		}
		if first {
			hits++
		}
	}
	if hits < 400 || hits > 600 {
		t.Fatalf("25%% echo landed %d of 2000 times", hits)
	}
}

func TestLevelUpsGrantSkillPointsThatRankUpABarSkill(t *testing.T) {
	room := newRankRoom(t)
	player := room.Run.Players["p1"]
	grantExperience(player, room, "p1", 1, 150) // levels 2 and 3
	if player.SkillPoints != 2 {
		t.Fatalf("skill points = %d, want one per level-up", player.SkillPoints)
	}
	basic := player.Skills[0]
	if err := ApplyCommand(room, "p1", Command{Type: "upgrade_skill", Skill: basic}, room.Run.StartedAt); err != nil {
		t.Fatal(err)
	}
	if SkillRank(player, basic) != 2 || player.SkillPoints != 1 {
		t.Fatalf("rank %d points %d after one upgrade", SkillRank(player, basic), player.SkillPoints)
	}
	last := room.Run.LastCombatEvents[len(room.Run.LastCombatEvents)-1]
	if last.Kind != "skill_rank" || last.Skill != basic || last.Rank != 2 || !strings.Contains(last.Message, "rank II") {
		t.Fatalf("unexpected rank event %+v", last)
	}
	if err := upgradeSkill(room, "p1", "arcanist.fireball"); !errors.Is(err, ErrInvalidSkill) {
		t.Fatalf("upgrading a skill off the bar: %v", err)
	}
	player.SkillPoints = 10
	for i := 0; i < MaxSkillRank; i++ {
		_ = upgradeSkill(room, "p1", basic)
	}
	if SkillRank(player, basic) != MaxSkillRank {
		t.Fatalf("rank = %d", SkillRank(player, basic))
	}
	if err := upgradeSkill(room, "p1", basic); !errors.Is(err, ErrSkillMaxRank) {
		t.Fatalf("past max rank: %v", err)
	}
	player.SkillPoints = 0
	if err := upgradeSkill(room, "p1", SkillDefend); !errors.Is(err, ErrNoSkillPoints) {
		t.Fatalf("without points: %v", err)
	}
}

func TestRankedSkillHitsHarderAndTagsItsEvents(t *testing.T) {
	strike := func(rank int) (int, CombatEvent) {
		room := newRankRoom(t)
		player := room.Run.Players["p1"]
		basic := player.Skills[0]
		if rank > 1 {
			player.SkillRanks = map[string]int{basic: rank}
		}
		enemy := &room.Run.Rooms[room.Run.CurrentRoomID].Encounter.Enemies[0]
		enemy.Health, enemy.MaxHealth = 500, 500
		before := enemy.Health
		if err := applySkill(room, player, Command{Skill: basic, TargetID: enemy.ID}, 1); err != nil {
			t.Fatal(err)
		}
		var tagged CombatEvent
		echoed := 0
		for _, event := range room.Run.LastCombatEvents {
			if event.ActorID == "p1" && event.Skill == basic {
				tagged = event
			}
			if event.Kind == "skill_echo" {
				echoed += event.Amount
			}
		}
		// The rank V echo is a chance on top; compare the hit itself.
		return before - enemy.Health - echoed, tagged
	}
	base, _ := strike(1)
	top, event := strike(MaxSkillRank)
	if top-base != 2 {
		t.Fatalf("rank V dealt %d, rank I %d: want +2", top, base)
	}
	if event.Rank != MaxSkillRank {
		t.Fatalf("event not tagged with rank: %+v", event)
	}
}

func TestRankedDefendGuardsMoreEvenWhenAutomatic(t *testing.T) {
	room := newRankRoom(t)
	player := room.Run.Players["p1"]
	defend(room, player, false, 1)
	plain := guardFor(room, player)
	player.ClassCombat.GuardBonus, player.Guarding = 0, false
	player.SkillRanks = map[string]int{SkillDefend: 4}
	defend(room, player, false, 1)
	if got := guardFor(room, player); got != plain+2 {
		t.Fatalf("rank IV defend guards %d, want %d", got, plain+2)
	}
	last := room.Run.LastCombatEvents[len(room.Run.LastCombatEvents)-1]
	if last.Skill != SkillDefend || last.Rank != 4 || !last.Auto {
		t.Fatalf("auto defend event %+v", last)
	}
}

func TestSimulationPolicySpendsPointsBasicFirst(t *testing.T) {
	room := newRankRoom(t)
	player := room.Run.Players["p1"]
	player.SkillPoints = 3
	spendSkillPointsByPolicy(room, "p1")
	if player.SkillPoints != 0 || SkillRank(player, player.Skills[0]) < 2 || SkillRank(player, SkillDefend) != 1 {
		t.Fatalf("policy spent badly: ranks %v points %d", player.SkillRanks, player.SkillPoints)
	}
}

// newRankRoom is a one-player Bulwark run in its first combat.
func newRankRoom(t *testing.T) *Room {
	t.Helper()
	room := &Room{ID: "ranks", OwnerPlayerID: "p1", PlayerIDs: []string{"p1"}, PlayerClasses: map[string]string{"p1": ClassBulwark}, Presence: map[string]PlayerPresence{}}
	if err := startExpeditionWithSeed(room, "ranks", "", 7, time.Date(2026, 11, 15, 12, 0, 0, 0, time.UTC)); err != nil {
		t.Fatal(err)
	}
	if room.Run.Rooms[room.Run.CurrentRoomID].Encounter == nil {
		t.Fatal("expected the first room to be a fight")
	}
	return room
}
