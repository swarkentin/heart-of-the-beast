package game

import (
	"fmt"
	"sort"
)

type RunEffectKind string

const (
	RunEffectNone        RunEffectKind = "none"
	RunEffectPartyHeal   RunEffectKind = "party_heal"
	RunEffectPartyStrike RunEffectKind = "party_strike"
	RunEffectPartyGuard  RunEffectKind = "party_guard"
)

type RunEffectDefinition struct {
	ID                string
	Kind              RunEffectKind
	FlagID            string
	Amount            int
	LivingPlayersOnly bool
	StrikeBonusRoomID string
	StrikeBonus       int
}

type RunEffectCatalog struct {
	Definitions []RunEffectDefinition
	byID        map[string]RunEffectDefinition
}

var defaultRunEffectCatalog = newRunEffectCatalog()

func newRunEffectCatalog() RunEffectCatalog {
	definitions := []RunEffectDefinition{
		{ID: "study_weakness", Kind: RunEffectNone, FlagID: "warden_weakness", StrikeBonusRoomID: "warden", StrikeBonus: 2},
		{ID: "rescue_archivist", Kind: RunEffectPartyHeal, FlagID: "archivist_rescued", Amount: 10, LivingPlayersOnly: true},
		{ID: "ember_charm", Kind: RunEffectPartyStrike, FlagID: "emberheart", Amount: 3},
		{ID: "stone_charm", Kind: RunEffectPartyGuard, FlagID: "stoneward", Amount: 4},
		{ID: "shrine_ward", Kind: RunEffectPartyGuard, FlagID: "shrine_ward", Amount: 1},
		{ID: "leave", Kind: RunEffectNone},
	}
	catalog := RunEffectCatalog{Definitions: definitions, byID: make(map[string]RunEffectDefinition, len(definitions))}
	for _, definition := range definitions {
		catalog.byID[definition.ID] = definition
	}
	return catalog
}

func (catalog RunEffectCatalog) Effect(id string) (RunEffectDefinition, bool) {
	definition, ok := catalog.byID[id]
	return definition, ok
}

func (catalog RunEffectCatalog) Validate() error {
	seen := make(map[string]bool, len(catalog.Definitions))
	for _, definition := range catalog.Definitions {
		if definition.ID == "" || seen[definition.ID] {
			return fmt.Errorf("duplicate or empty run effect ID %q", definition.ID)
		}
		seen[definition.ID] = true
		switch definition.Kind {
		case RunEffectNone:
			if definition.Amount != 0 {
				return fmt.Errorf("run effect %q has an amount but no operation", definition.ID)
			}
		case RunEffectPartyHeal, RunEffectPartyStrike, RunEffectPartyGuard:
			if definition.Amount <= 0 {
				return fmt.Errorf("run effect %q must have a positive amount", definition.ID)
			}
		default:
			return fmt.Errorf("run effect %q has unknown kind %q", definition.ID, definition.Kind)
		}
		if definition.StrikeBonus < 0 || (definition.StrikeBonus > 0 && definition.StrikeBonusRoomID == "") {
			return fmt.Errorf("run effect %q has an invalid strike bonus", definition.ID)
		}
		if definition.FlagID == "" && (definition.Kind != RunEffectNone || definition.StrikeBonus > 0) {
			return fmt.Errorf("run effect %q has an operation without a persistent flag", definition.ID)
		}
	}
	return nil
}

func (catalog RunEffectCatalog) StrikeBonus(run *Run, roomID string) int {
	if run == nil {
		return 0
	}
	total := 0
	for _, definition := range catalog.Definitions {
		if definition.StrikeBonus > 0 && definition.StrikeBonusRoomID == roomID && run.Flags[definition.FlagID] {
			total += definition.StrikeBonus
		}
	}
	return total
}

func applyRoomEventEffect(room *Room, effectID string) bool {
	if room == nil || room.Run == nil {
		return false
	}
	definition, ok := defaultRunEffectCatalog.Effect(effectID)
	if !ok {
		return false
	}
	run := room.Run
	if run.Flags == nil {
		run.Flags = make(map[string]bool)
	}
	if definition.FlagID != "" {
		run.Flags[definition.FlagID] = true
	}
	playerIDs := append([]string(nil), room.PlayerIDs...)
	sort.Strings(playerIDs)
	for _, playerID := range playerIDs {
		member := run.Players[playerID]
		if member == nil {
			continue
		}
		if definition.LivingPlayersOnly && member.Health <= 0 {
			continue
		}
		switch definition.Kind {
		case RunEffectNone:
		case RunEffectPartyHeal:
			before := member.Health
			member.Health += definition.Amount
			if member.Health > member.MaxHealth {
				member.Health = member.MaxHealth
			}
			if member.Health > before {
				addCombatImpact(run, 0, "player_heal", adventurerLabel(room, playerID)+" recovers "+itoa(member.Health-before)+" health from the archivist's draughts.", "heal", playerID, "player", member.Health-before)
			}
		case RunEffectPartyStrike:
			member.StrikeDamage += definition.Amount
		case RunEffectPartyGuard:
			member.GuardReduction += definition.Amount
		}
	}
	return true
}
