package game

import (
	"testing"
	"time"
)

func TestDefaultRunRewardCatalogValidatesAndCoversAuthoredRewards(t *testing.T) {
	if err := defaultRunRewardCatalog.Validate(); err != nil {
		t.Fatalf("default reward catalog is invalid: %v", err)
	}
	for _, id := range []string{
		"encounter.regular_xp", "encounter.boss_xp", "room.reliquary",
		"room.flooded_cache", "encounter.miniboss", "floor.restore", "floor.perk",
	} {
		if _, ok := defaultRunRewardCatalog.Reward(id); !ok {
			t.Errorf("missing reward definition %q", id)
		}
	}
}

func TestRunRewardCatalogRejectsInvalidDefinitions(t *testing.T) {
	tests := []struct {
		name       string
		definition RunRewardDefinition
	}{
		{name: "empty operations", definition: RunRewardDefinition{ID: "empty"}},
		{name: "unknown kind", definition: RunRewardDefinition{ID: "kind", Operations: []RunRewardOperation{{Kind: "mystery", Target: RunRewardLiving, Amount: 1}}}},
		{name: "invalid target", definition: RunRewardDefinition{ID: "target", Operations: []RunRewardOperation{{Kind: RunRewardHeal, Target: "everyone-ish", Amount: 1}}}},
		{name: "non-positive amount", definition: RunRewardDefinition{ID: "amount", Operations: []RunRewardOperation{{Kind: RunRewardStrike, Target: RunRewardAllMembers, Amount: 0}}}},
		{name: "missing impact text", definition: RunRewardDefinition{ID: "impact", Operations: []RunRewardOperation{{Kind: RunRewardHeal, Target: RunRewardLiving, Amount: 1, ImpactKind: "heal"}}}},
		{name: "room reward without flag", definition: RunRewardDefinition{ID: "room.reliquary", Operations: []RunRewardOperation{{Kind: RunRewardStrike, Target: RunRewardLiving, Amount: 1}}}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			catalog := RunRewardCatalog{Definitions: []RunRewardDefinition{test.definition}}
			if err := catalog.Validate(); err == nil {
				t.Fatal("expected invalid reward definition to fail validation")
			}
		})
	}
	catalog := RunRewardCatalog{Definitions: []RunRewardDefinition{
		{ID: "duplicate", Operations: []RunRewardOperation{{Kind: RunRewardStrike, Target: RunRewardAllMembers, Amount: 1}}},
		{ID: "duplicate", Operations: []RunRewardOperation{{Kind: RunRewardStrike, Target: RunRewardAllMembers, Amount: 1}}},
	}}
	if err := catalog.Validate(); err == nil {
		t.Fatal("expected duplicate reward IDs to fail validation")
	}
}

func rewardTestRoom() *Room {
	now := time.Date(2026, 11, 15, 12, 0, 0, 0, time.UTC)
	return &Room{
		PlayerIDs: []string{"player-1", "player-2", "player-3"},
		Presence: map[string]PlayerPresence{
			"player-1": {LastSeenAt: now},
			"player-2": {LastSeenAt: now},
			"player-3": {LastSeenAt: now, LeftAt: &now},
		},
		Run: &Run{
			Flags: make(map[string]bool),
			Players: map[string]*PlayerState{
				"player-1": newPlayerState("player-1", "damage"),
				"player-2": newPlayerState("player-2", "damage"),
				"player-3": newPlayerState("player-3", "damage"),
			},
		},
	}
}

func TestRoomRewardsPreserveLivingEligibilityAndIdempotency(t *testing.T) {
	room := rewardTestRoom()
	room.Run.Players["player-1"].Health = 20
	room.Run.Players["player-2"].Health = 0
	room.Run.Players["player-3"].Health = 20

	sigil, _ := defaultRunRewardCatalog.Reward("room.reliquary")
	applyRunReward(room, sigil, 1, "")
	if room.Run.Players["player-1"].StrikeDamage != 11 || room.Run.Players["player-2"].StrikeDamage != 10 || room.Run.Players["player-3"].StrikeDamage != 11 {
		t.Fatalf("reliquary reward should affect every living run member: %+v", room.Run.Players)
	}
	applyRunReward(room, sigil, 2, "")
	if room.Run.Players["player-1"].StrikeDamage != 11 {
		t.Fatal("reliquary reward must not be applied twice")
	}

	cache, _ := defaultRunRewardCatalog.Reward("room.flooded_cache")
	applyRunReward(room, cache, 3, "")
	if room.Run.Players["player-1"].Health != 28 || room.Run.Players["player-2"].Health != 0 || room.Run.Players["player-3"].Health != 28 {
		t.Fatalf("cache reward should heal living members only: %+v", room.Run.Players)
	}
}

func TestMinibossAndFloorRewardsPreserveTheirDistinctTargetPolicies(t *testing.T) {
	room := rewardTestRoom()
	room.Run.Players["player-1"].Health = 20
	room.Run.Players["player-2"].Health = 0
	room.Run.Players["player-3"].Health = 20

	miniboss, _ := defaultRunRewardCatalog.Reward("encounter.miniboss")
	applyRunReward(room, miniboss, 1, "miniboss-d2-mini")
	for id, player := range room.Run.Players {
		if player.StrikeDamage != 11 {
			t.Fatalf("miniboss reward should include all run members, %s: %+v", id, player)
		}
	}
	applyRunReward(room, miniboss, 2, "miniboss-d2-mini")
	if room.Run.Players["player-1"].StrikeDamage != 11 {
		t.Fatal("miniboss reward must be idempotent")
	}

	restore, _ := defaultRunRewardCatalog.Reward("floor.restore")
	applyRunReward(room, restore, 3, "floor-1-restored")
	if room.Run.Players["player-1"].Health != 30 || room.Run.Players["player-2"].Health != 0 || room.Run.Players["player-3"].Health != 20 {
		t.Fatalf("floor restoration should heal active living members only: %+v", room.Run.Players)
	}

	perk, _ := defaultRunRewardCatalog.Reward("floor.perk")
	applyRunReward(room, perk, 4, "floor-1-perk")
	for id, player := range room.Run.Players {
		if player.StrikeDamage != 12 || player.GuardReduction != GuardDamageReduction+1 {
			t.Fatalf("floor perk should affect all run members, %s: %+v", id, player)
		}
	}
}

func TestEncounterXPRewardIncludesDownedButExcludesDepartedPlayers(t *testing.T) {
	room := rewardTestRoom()
	room.Run.Rooms = map[string]*DungeonRoom{"boss": {ID: "boss", RoomType: "boss"}}
	room.Run.CurrentRoomID = "boss"
	room.Run.Players["player-2"].Health = 0
	grantEncounterExperience(room, 1)
	if room.Run.Players["player-1"].Experience != BossExperienceReward || room.Run.Players["player-2"].Experience != BossExperienceReward || room.Run.Players["player-3"].Experience != 0 {
		t.Fatalf("boss XP eligibility changed: %+v", room.Run.Players)
	}
}
