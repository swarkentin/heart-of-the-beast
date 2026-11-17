package game

import (
	"fmt"
	"sort"
)

type RunRewardKind string

const (
	RunRewardExperience RunRewardKind = "experience"
	RunRewardHeal       RunRewardKind = "heal"
	RunRewardStrike     RunRewardKind = "strike"
	RunRewardGuard      RunRewardKind = "guard"
)

type RunRewardTarget string

const (
	RunRewardParticipants RunRewardTarget = "participants"
	RunRewardLiving       RunRewardTarget = "living"
	RunRewardActiveLiving RunRewardTarget = "active_living"
	RunRewardAllMembers   RunRewardTarget = "all_members"
)

type RunRewardOperation struct {
	Kind       RunRewardKind   `json:"kind"`
	Target     RunRewardTarget `json:"target"`
	Amount     int             `json:"amount"`
	ImpactKind string          `json:"impactKind,omitempty"`
	ImpactText string          `json:"impactText,omitempty"`
}

type RunRewardDefinition struct {
	ID         string               `json:"id"`
	FlagID     string               `json:"flagId,omitempty"`
	EventKind  string               `json:"eventKind,omitempty"`
	EventText  string               `json:"eventText,omitempty"`
	Operations []RunRewardOperation `json:"operations"`
}

type RunRewardCatalog struct {
	Definitions []RunRewardDefinition
	byID        map[string]RunRewardDefinition
}

var defaultRunRewardCatalog = newRunRewardCatalog()

func newRunRewardCatalog() RunRewardCatalog {
	definitions := []RunRewardDefinition{
		{ID: "encounter.regular_xp", Operations: []RunRewardOperation{{Kind: RunRewardExperience, Target: RunRewardParticipants, Amount: EncounterExperienceReward}}},
		{ID: "encounter.boss_xp", Operations: []RunRewardOperation{{Kind: RunRewardExperience, Target: RunRewardParticipants, Amount: BossExperienceReward}}},
		{ID: "room.reliquary", FlagID: "reliquary_sigil", EventKind: "room_reward", EventText: "The Reliquary Guardian's sigil empowers every living adventurer's Strike, up to the permanent upgrade cap.", Operations: []RunRewardOperation{{Kind: RunRewardStrike, Target: RunRewardLiving, Amount: 1}}},
		{ID: "room.flooded_cache", FlagID: "crossing_cache", EventKind: "room_reward", EventText: "The party finds healing draughts in the flooded cache.", Operations: []RunRewardOperation{{Kind: RunRewardHeal, Target: RunRewardLiving, Amount: 8, ImpactKind: "player_heal", ImpactText: "%s recovers %d health from the flooded cache."}}},
		{ID: "encounter.miniboss", EventKind: "miniboss_reward", EventText: "The reliquary brute falls. Every adventurer gains +1 Strike damage for the rest of the run, up to the permanent upgrade cap.", Operations: []RunRewardOperation{{Kind: RunRewardStrike, Target: RunRewardAllMembers, Amount: 1}}},
		{ID: "encounter.champion", EventKind: "miniboss_reward", EventText: "The champion falls. Every adventurer gains +1 Strike damage for the rest of the run, up to the permanent upgrade cap.", Operations: []RunRewardOperation{{Kind: RunRewardStrike, Target: RunRewardAllMembers, Amount: 1}}},
		{ID: "encounter.lair", EventKind: "lair_reward", EventText: "The lair falls silent. Every adventurer gains +1 Guard for the rest of the run, and the living catch their breath.", Operations: []RunRewardOperation{{Kind: RunRewardGuard, Target: RunRewardAllMembers, Amount: 1}, {Kind: RunRewardHeal, Target: RunRewardLiving, Amount: 10, ImpactKind: "lair_heal", ImpactText: "%s recovers %d health in the quiet of the lair."}}},
		{ID: "floor.restore", EventKind: "floor_restoration", Operations: []RunRewardOperation{{Kind: RunRewardHeal, Target: RunRewardActiveLiving, Amount: 10, ImpactKind: "floor_restoration", ImpactText: "%s recovers %d health before descending."}}},
		{ID: "floor.perk", Operations: []RunRewardOperation{{Kind: RunRewardStrike, Target: RunRewardAllMembers, Amount: 1}, {Kind: RunRewardGuard, Target: RunRewardAllMembers, Amount: 1}}},
	}
	catalog := RunRewardCatalog{Definitions: definitions, byID: make(map[string]RunRewardDefinition, len(definitions))}
	for _, definition := range definitions {
		catalog.byID[definition.ID] = definition
	}
	return catalog
}

func (catalog RunRewardCatalog) Reward(id string) (RunRewardDefinition, bool) {
	definition, ok := catalog.byID[id]
	return definition, ok
}

func (catalog RunRewardCatalog) Validate() error {
	seen := make(map[string]bool, len(catalog.Definitions))
	for _, definition := range catalog.Definitions {
		if definition.ID == "" || seen[definition.ID] {
			return fmt.Errorf("duplicate or empty run reward ID %q", definition.ID)
		}
		seen[definition.ID] = true
		if len(definition.Operations) == 0 {
			return fmt.Errorf("run reward %q has no operations", definition.ID)
		}
		for _, operation := range definition.Operations {
			if operation.Amount <= 0 {
				return fmt.Errorf("run reward %q has a non-positive operation amount", definition.ID)
			}
			switch operation.Kind {
			case RunRewardExperience, RunRewardHeal, RunRewardStrike, RunRewardGuard:
			default:
				return fmt.Errorf("run reward %q has unknown operation kind %q", definition.ID, operation.Kind)
			}
			switch operation.Target {
			case RunRewardParticipants, RunRewardLiving, RunRewardActiveLiving, RunRewardAllMembers:
			default:
				return fmt.Errorf("run reward %q has invalid target policy %q", definition.ID, operation.Target)
			}
			if operation.Kind == RunRewardHeal && operation.ImpactKind != "" && operation.ImpactText == "" {
				return fmt.Errorf("run reward %q has impact kind without impact text", definition.ID)
			}
		}
		if definition.FlagID == "" && (definition.ID == "room.reliquary" || definition.ID == "room.flooded_cache") {
			return fmt.Errorf("room reward %q must be idempotent", definition.ID)
		}
	}
	return nil
}

func applyRunReward(room *Room, definition RunRewardDefinition, round int, flagID string) {
	if room == nil || room.Run == nil {
		return
	}
	run := room.Run
	if run.Flags == nil {
		run.Flags = make(map[string]bool)
	}
	if flagID == "" {
		flagID = definition.FlagID
	}
	if flagID != "" {
		if run.Flags[flagID] {
			return
		}
		run.Flags[flagID] = true
	}

	for _, operation := range definition.Operations {
		playerIDs := rewardPlayerIDs(room, operation.Target)
		for _, playerID := range playerIDs {
			member := run.Players[playerID]
			if member == nil || !rewardTargetIncludes(room, playerID, member, operation.Target) {
				continue
			}
			switch operation.Kind {
			case RunRewardExperience:
				grantExperience(member, room, playerID, round, operation.Amount)
			case RunRewardHeal:
				transition := resolveHealthHealing(member.Health, member.MaxHealth, floorRulesFor(run).healing(operation.Amount))
				member.Health = transition.Health
				actual := transition.Applied
				if actual > 0 && operation.ImpactKind != "" {
					addCombatImpact(run, round, operation.ImpactKind, fmt.Sprintf(operation.ImpactText, adventurerLabel(room, playerID), actual), "heal", playerID, "player", actual)
				}
			case RunRewardStrike:
				applyPermanentStrikeBonus(member, operation.Amount)
			case RunRewardGuard:
				member.GuardReduction += operation.Amount
			}
		}
	}
	if definition.EventKind != "" && definition.EventText != "" {
		addCombatEvent(run, round, definition.EventKind, definition.EventText)
	}
}

func rewardTargetIncludes(room *Room, playerID string, player *PlayerState, target RunRewardTarget) bool {
	switch target {
	case RunRewardParticipants:
		return room.Presence[playerID].LeftAt == nil
	case RunRewardLiving:
		return player.Health > 0
	case RunRewardActiveLiving:
		return player.Health > 0 && room.Presence[playerID].LeftAt == nil
	case RunRewardAllMembers:
		return true
	default:
		return false
	}
}

func rewardPlayerIDs(room *Room, target RunRewardTarget) []string {
	if target == RunRewardParticipants {
		return append([]string(nil), room.PlayerIDs...)
	}
	ids := make([]string, 0, len(room.Run.Players))
	for playerID := range room.Run.Players {
		ids = append(ids, playerID)
	}
	sort.Strings(ids)
	return ids
}
