package game

import "errors"

const (
	ConsumableHealingHerb     = "healing-herb"
	StartingHealingHerbs      = 4
	MaxHealingHerbs           = 5
	HealingHerbHealingPercent = 50
)

var ErrConsumableUnavailable = errors.New("that consumable cannot be used right now")

// ConsumableDefinition describes an item carried in a player's run inventory. The catalog is deliberately
// generic so future consumables can add different effects without changing inventory persistence.
type ConsumableDefinition struct {
	ID             string
	Name           string
	Description    string
	HealingPercent int
}

var consumableCatalog = []ConsumableDefinition{
	{ID: ConsumableHealingHerb, Name: "Healing Herb", Description: "Recover up to 50% of your maximum health.", HealingPercent: HealingHerbHealingPercent},
}

func ConsumableCatalog() []ConsumableDefinition {
	return append([]ConsumableDefinition(nil), consumableCatalog...)
}

func consumableDefinition(id string) (ConsumableDefinition, bool) {
	for _, definition := range consumableCatalog {
		if definition.ID == id {
			return definition, true
		}
	}
	return ConsumableDefinition{}, false
}

// useConsumable is available in every active run phase. Full health is a no-op: the item remains in inventory.
func useConsumable(room *Room, playerID, itemID string) error {
	if room == nil || room.Run == nil {
		return ErrRunNotStarted
	}
	run := room.Run
	if run.Phase == PhaseLobby || run.Phase == PhaseCompleted || run.Phase == PhaseFailed {
		return ErrInvalidPhase
	}
	player := run.Players[playerID]
	if player == nil || player.Health <= 0 || room.Presence[playerID].LeftAt != nil {
		return ErrInvalidPhase
	}
	if player.Consumables == nil {
		player.Consumables = map[string]int{ConsumableHealingHerb: StartingHealingHerbs}
	}
	definition, ok := consumableDefinition(itemID)
	if !ok || player.Consumables[itemID] <= 0 || player.Health >= player.MaxHealth {
		return ErrConsumableUnavailable
	}
	amount := (player.MaxHealth*definition.HealingPercent + 99) / 100
	amount = floorRulesFor(run).consumableHealing(amount)
	transition := resolveHealthHealing(player.Health, player.MaxHealth, amount)
	if transition.Applied <= 0 {
		return ErrConsumableUnavailable
	}
	player.Health = transition.Health
	player.Consumables[itemID]--
	if player.Consumables[itemID] == 0 {
		delete(player.Consumables, itemID)
	}
	addCombatImpact(run, 0, "consumable_heal", adventurerLabel(room, playerID)+" uses a Healing Herb and recovers "+itoa(transition.Applied)+" health.", "heal", playerID, "player", transition.Applied)
	return nil
}
