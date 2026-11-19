package game

import (
	"fmt"
	"hash/fnv"
	"sort"
)

// Permanent Strike upgrades are powerful because they compound with class Power. Cap their combined
// contribution from shops, room events, and rewards so a long expedition does not become a one-hit sweep.
const MaxPermanentStrikeBonus = 4

func applyPermanentStrikeBonus(player *PlayerState, amount int) {
	if player == nil || amount == 0 {
		return
	}
	player.StrikeDamage += amount
	if amount > 0 && player.StrikeDamage > PlayerStrikeDamage+MaxPermanentStrikeBonus {
		player.StrikeDamage = PlayerStrikeDamage + MaxPermanentStrikeBonus
	}
	if player.StrikeDamage < 1 {
		player.StrikeDamage = 1
	}
}

type RunEffectKind string

const (
	RunEffectNone        RunEffectKind = "none"
	RunEffectPartyHeal   RunEffectKind = "party_heal"
	RunEffectPartyStrike RunEffectKind = "party_strike"
	RunEffectPartyGuard  RunEffectKind = "party_guard"

	// The kinds below are only used in Operations, where amounts may be negative: a discovery can cost
	// something as well as give something.
	RunEffectPartyDamage     RunEffectKind = "party_damage"     // living adventurers lose health; never lethal
	RunEffectPartyMaxHealth  RunEffectKind = "party_max_health" // changes maximum health
	RunEffectPartyGold       RunEffectKind = "party_gold"       // every adventurer gains gold
	RunEffectFloorModifier   RunEffectKind = "floor_modifier"   // puts a floor modifier in force until the descent
	RunEffectPartyConsumable RunEffectKind = "party_consumable" // grants a carried consumable to every adventurer
	RunEffectPartyHerbTrade  RunEffectKind = "party_herb_trade" // trades nonlethal health for one herb, only when there is pack space
)

// RunEffectOperation is one step of a multi-part effect. Strike, guard and maximum-health amounts may be
// negative. ModifierID is the floor modifier a RunEffectFloorModifier step applies.
type RunEffectOperation struct {
	Kind       RunEffectKind
	Amount     int
	ModifierID string
}

type RunEffectDefinition struct {
	ID                string
	Kind              RunEffectKind
	FlagID            string
	Amount            int
	LivingPlayersOnly bool
	StrikeBonusRoomID string
	StrikeBonus       int

	// Operations are applied in order after the single Kind/Amount operation above. They let one choice both
	// give and take: the trade-offs of discovery rooms are authored here.
	Operations []RunEffectOperation
	// Chance makes the effect a gamble: the percent chance that Operations apply. Otherwise FailOperations
	// apply instead. Zero means the effect always succeeds. The roll is seeded by the run and the room.
	Chance         int
	FailOperations []RunEffectOperation
	// Outcome and FailOutcome tell the party what happened. Empty keeps the choice's own description.
	Outcome     string
	FailOutcome string
	// Summary states the whole trade in rules terms. Discovery choices show it, so no cost is ever hidden.
	Summary string
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
		{ID: "leave", Kind: RunEffectNone, Summary: "Nothing gained, nothing lost."},
	}
	definitions = append(definitions, discoveryEffects()...)
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
		if definition.Chance < 0 || definition.Chance >= 100 || (definition.Chance == 0 && len(definition.FailOperations) > 0) || (definition.Chance > 0 && (len(definition.Operations) == 0 || len(definition.FailOperations) == 0)) {
			return fmt.Errorf("run effect %q has an invalid gamble", definition.ID)
		}
		for _, operation := range append(append([]RunEffectOperation(nil), definition.Operations...), definition.FailOperations...) {
			switch operation.Kind {
			case RunEffectPartyHeal, RunEffectPartyDamage, RunEffectPartyGold, RunEffectPartyConsumable, RunEffectPartyHerbTrade:
				if operation.Amount <= 0 {
					return fmt.Errorf("run effect %q has a non-positive %s operation", definition.ID, operation.Kind)
				}
			case RunEffectPartyStrike, RunEffectPartyGuard, RunEffectPartyMaxHealth:
				if operation.Amount == 0 {
					return fmt.Errorf("run effect %q has a %s operation that changes nothing", definition.ID, operation.Kind)
				}
			case RunEffectFloorModifier:
				if _, ok := defaultFloorModifierCatalog.Modifier(operation.ModifierID); !ok {
					return fmt.Errorf("run effect %q applies unknown floor modifier %q", definition.ID, operation.ModifierID)
				}
			default:
				return fmt.Errorf("run effect %q has unknown operation kind %q", definition.ID, operation.Kind)
			}
		}
		if len(definition.Operations) > 0 {
			// Multi-part effects are resolved once per room by the event itself, so they need no flag.
			continue
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

// applyRoomEventEffect applies an authored effect to the party. It reports false for an unknown effect, and
// otherwise returns the outcome text to show, which is empty when the choice's own description says it all.
func applyRoomEventEffect(room *Room, effectID string) (bool, string) {
	if room == nil || room.Run == nil {
		return false, ""
	}
	definition, ok := defaultRunEffectCatalog.Effect(effectID)
	if !ok {
		return false, ""
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
			member.Health += floorRulesFor(run).healing(definition.Amount)
			if member.Health > member.MaxHealth {
				member.Health = member.MaxHealth
			}
			if member.Health > before {
				addCombatImpact(run, 0, "player_heal", adventurerLabel(room, playerID)+" recovers "+itoa(member.Health-before)+" health from the archivist's draughts.", "heal", playerID, "player", member.Health-before)
			}
		case RunEffectPartyStrike:
			applyPermanentStrikeBonus(member, definition.Amount)
		case RunEffectPartyGuard:
			member.GuardReduction += definition.Amount
		}
	}

	operations, outcome := definition.Operations, definition.Outcome
	if definition.Chance > 0 && int(mixSeed(run.Seed, uint64(run.Depth), hashString(run.CurrentRoomID+"/"+effectID))%100) >= definition.Chance {
		operations, outcome = definition.FailOperations, definition.FailOutcome
	}
	for _, operation := range operations {
		applyRunEffectOperation(room, operation, playerIDs)
	}
	return true, outcome
}

func applyRunEffectOperation(room *Room, operation RunEffectOperation, playerIDs []string) {
	run := room.Run
	if operation.Kind == RunEffectFloorModifier {
		if addFloorModifier(run, operation.ModifierID) {
			definition, _ := defaultFloorModifierCatalog.Modifier(operation.ModifierID)
			addCombatEvent(run, 0, "floor_modifier", definition.Name+": "+definition.Description)
		}
		return
	}
	for _, playerID := range playerIDs {
		member := run.Players[playerID]
		if member == nil {
			continue
		}
		label := adventurerLabel(room, playerID)
		switch operation.Kind {
		case RunEffectPartyHeal:
			if member.Health <= 0 {
				continue
			}
			transition := resolveHealthHealing(member.Health, member.MaxHealth, floorRulesFor(run).healing(operation.Amount))
			member.Health = transition.Health
			if transition.Applied > 0 {
				addCombatImpact(run, 0, "player_heal", label+" recovers "+itoa(transition.Applied)+" health.", "heal", playerID, "player", transition.Applied)
			}
		case RunEffectPartyDamage:
			if applied := damageWithoutKilling(member, operation.Amount); applied > 0 {
				addCombatImpact(run, 0, "event_damage", label+" loses "+itoa(applied)+" health.", "damage", playerID, "player", applied)
			}
		case RunEffectPartyMaxHealth:
			member.MaxHealth += operation.Amount
			if member.MaxHealth < 1 {
				member.MaxHealth = 1
			}
			if member.Health > member.MaxHealth {
				member.Health = member.MaxHealth
			}
			if operation.Amount > 0 && member.Health > 0 {
				member.Health += operation.Amount
			}
		case RunEffectPartyGold:
			member.Gold += operation.Amount
		case RunEffectPartyConsumable:
			if member.Consumables == nil {
				member.Consumables = make(map[string]int)
			}
			member.Consumables[ConsumableHealingHerb] += operation.Amount
			if member.Consumables[ConsumableHealingHerb] > MaxHealingHerbs {
				member.Consumables[ConsumableHealingHerb] = MaxHealingHerbs
			}
		case RunEffectPartyHerbTrade:
			if member.Health <= 0 || member.Consumables[ConsumableHealingHerb] >= MaxHealingHerbs {
				continue
			}
			if paid := damageWithoutKilling(member, operation.Amount); paid > 0 {
				if member.Consumables == nil {
					member.Consumables = make(map[string]int)
				}
				member.Consumables[ConsumableHealingHerb]++
				addCombatImpact(run, 0, "event_damage", label+" trades "+itoa(paid)+" health for a Healing Herb.", "damage", playerID, "player", paid)
			}
		case RunEffectPartyStrike:
			applyPermanentStrikeBonus(member, operation.Amount)
		case RunEffectPartyGuard:
			member.GuardReduction += operation.Amount
			if member.GuardReduction < 1 {
				member.GuardReduction = 1
			}
		}
	}
}

// damageWithoutKilling removes health from a living adventurer but always leaves at least 1. Costs paid outside
// combat must never end a run by themselves.
func damageWithoutKilling(member *PlayerState, amount int) int {
	if member == nil || member.Health <= 1 || amount <= 0 {
		return 0
	}
	if amount > member.Health-1 {
		amount = member.Health - 1
	}
	member.Health -= amount
	return amount
}

func hashString(value string) uint64 {
	hash := fnv.New64a()
	_, _ = hash.Write([]byte(value))
	return hash.Sum64()
}

// discoveryEffects are the trade-offs offered by the discovery and vault rooms of generated floors. Themes
// supply the prose (see expedition_content.go); the mechanics are shared so every choice is tested once.
func discoveryEffects() []RunEffectDefinition {
	op := func(kind RunEffectKind, amount int) RunEffectOperation {
		return RunEffectOperation{Kind: kind, Amount: amount}
	}
	curse := func(id string) RunEffectOperation {
		return RunEffectOperation{Kind: RunEffectFloorModifier, ModifierID: id}
	}
	effects := []RunEffectDefinition{
		{ID: "herb_cache", Summary: "Each adventurer with pack space trades up to 5 health for 1 Healing Herb. The trade cannot knock anyone out.", Operations: []RunEffectOperation{{Kind: RunEffectPartyHerbTrade, Amount: 5}}, Outcome: "The party pays in blood. Anyone with room in their pack gains a Healing Herb."},
		{ID: "blood_pact", Summary: "Each adventurer loses up to 6 health. +2 Strike for the rest of the run, up to the +4 permanent cap.", Operations: []RunEffectOperation{op(RunEffectPartyDamage, 6), op(RunEffectPartyStrike, 2)},
			Outcome: "The price is paid in blood. Every adventurer loses up to 6 health and gains up to +2 Strike, subject to the permanent upgrade cap."},
		{ID: "heavy_plate", Summary: "+2 Guard and -1 Strike for the rest of the run.", Operations: []RunEffectOperation{op(RunEffectPartyGuard, 2), op(RunEffectPartyStrike, -1)},
			Outcome: "The weight slows every swing. Defend blocks 2 more, and Strike deals 1 less, for the rest of the run."},
		{ID: "glass_edge", Summary: "+2 Strike and -1 Guard for the rest of the run, up to the +4 permanent cap.", Operations: []RunEffectOperation{op(RunEffectPartyStrike, 2), op(RunEffectPartyGuard, -1)},
			Outcome: "Sharper, and more fragile. Strike gains up to 2 damage subject to the permanent upgrade cap, and Defend blocks 1 less."},
		{ID: "vital_tithe", Summary: "-4 maximum health. +2 Guard for the rest of the run.", Operations: []RunEffectOperation{op(RunEffectPartyMaxHealth, -4), op(RunEffectPartyGuard, 2)},
			Outcome: "Something is taken and something is given. Maximum health falls by 4 and Defend blocks 2 more for the rest of the run."},
		{ID: "greedy_haul", Summary: "25 gold each. -3 maximum health for the rest of the run.", Operations: []RunEffectOperation{op(RunEffectPartyGold, 25), op(RunEffectPartyMaxHealth, -3)},
			Outcome: "Every adventurer pockets 25 gold. The burden costs each of them 3 maximum health."},
		{ID: "uneasy_rest", Summary: "Recover up to 10 health each. Enemies on this floor deal +1 damage.", Operations: []RunEffectOperation{op(RunEffectPartyHeal, 10), curse("alerted")},
			Outcome: "The party rests and recovers up to 10 health each, but the floor has heard them."},
		{ID: "cursed_boon", Summary: "+1 Strike and +1 Guard for the run, up to the +4 permanent Strike cap. Every fight left on this floor opens with 2 damage.", Operations: []RunEffectOperation{op(RunEffectPartyStrike, 1), op(RunEffectPartyGuard, 1), curse("cursed")},
			Outcome: "Power answers, and so does a curse. Strike gains up to 1 damage subject to the permanent upgrade cap, and Defend blocks 1 more."},
		{ID: "risky_draught", Summary: "60% chance: recover up to 12 health each. Otherwise each loses up to 5.", Chance: 60,
			Operations: []RunEffectOperation{op(RunEffectPartyHeal, 12)}, Outcome: "It was safe. Every living adventurer recovers up to 12 health.",
			FailOperations: []RunEffectOperation{op(RunEffectPartyDamage, 5)}, FailOutcome: "It was not safe. Every adventurer loses up to 5 health."},
		{ID: "trapped_cache", Summary: "55% chance: 40 gold each. Otherwise each loses up to 6 health.", Chance: 55,
			Operations: []RunEffectOperation{op(RunEffectPartyGold, 40)}, Outcome: "The lock gives. Every adventurer takes 40 gold.",
			FailOperations: []RunEffectOperation{op(RunEffectPartyDamage, 6)}, FailOutcome: "A trap fires. Every adventurer loses up to 6 health and the cache is ruined."},
		{ID: "vault_coin", Summary: "18 gold each. No risk.", Operations: []RunEffectOperation{op(RunEffectPartyGold, 18)},
			Outcome: "The party takes what is safe to carry: 18 gold each."},
		{ID: "vault_relic", Summary: "60% chance: +1 Strike and +1 Guard for the run, up to the +4 permanent Strike cap. Otherwise each loses up to 6 health and this floor is cursed.", Chance: 60,
			Operations: []RunEffectOperation{op(RunEffectPartyStrike, 1), op(RunEffectPartyGuard, 1)}, Outcome: "The relic accepts the party. Strike gains up to 1 damage subject to the permanent upgrade cap, and Defend blocks 1 more.",
			FailOperations: []RunEffectOperation{op(RunEffectPartyDamage, 6), curse("cursed")}, FailOutcome: "The relic rejects the party. Every adventurer loses up to 6 health and a curse follows them through this floor."},
	}
	for i := range effects {
		effects[i].Kind = RunEffectNone
	}
	return effects
}
