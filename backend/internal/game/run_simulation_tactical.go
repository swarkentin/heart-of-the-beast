package game

// tacticalShopCommand buys healing at camp when an adventurer is hurt, and a revival when an ally is down. It
// returns false when there is nothing worth buying, leaving the rest of the camp to the random policy.
func tacticalShopCommand(room *Room, playerID string) (Command, bool) {
	camp := room.Run.Camp
	if camp == nil || camp.Stage != CampStageShop || camp.Ready[playerID] {
		return Command{}, false
	}
	player := room.Run.Players[playerID]
	if player == nil {
		return Command{}, false
	}
	missing := player.MaxHealth - player.Health
	herbHealing := (player.MaxHealth*HealingHerbHealingPercent + 99) / 100
	herbHealing = floorRulesFor(room.Run).consumableHealing(herbHealing)
	for _, offer := range camp.Offers {
		if offer.Price > player.Gold || (!offer.Repeatable && contains(camp.Purchases[playerID], offer.ID)) {
			continue
		}
		switch {
		case offer.Kind == ShopRevive && fallenAlly(room, playerID) != "",
			offer.Kind == ShopHeal && missing >= offer.Amount,
			offer.Kind == ShopConsumable && offer.ConsumableID == ConsumableHealingHerb &&
				player.Consumables[offer.ConsumableID] < MaxHealingHerbs && missing >= (herbHealing+1)/2,
			offer.Kind == ShopFullHeal && missing*2 >= player.MaxHealth:
			return Command{Type: "buy", ChoiceID: offer.ID}, true
		}
	}
	// Invest in permanent damage when the adventurer is stable, but do not sacrifice an urgent recovery.
	if player.StrikeDamage < PlayerStrikeDamage+MaxPermanentStrikeBonus {
		for _, offer := range camp.Offers {
			if offer.Kind == ShopStrike && offer.Price <= player.Gold && !contains(camp.Purchases[playerID], offer.ID) {
				return Command{Type: "buy", ChoiceID: offer.ID}, true
			}
		}
	}
	return Command{}, false
}

// tacticalConsumableCommand uses a carried herb during combat only when the adventurer is critically wounded.
// Healing is otherwise deferred to exploration, where it does not consume a combat action.
func tacticalConsumableCommand(room *Room, playerID string) (Command, bool) {
	return tacticalConsumableCommandForPhase(room, playerID, true)
}

// tacticalExplorationConsumableCommand uses a carried herb between encounters when at least half its effective
// healing can be used. Live play allows partial healing, and exploration has no enemy turn to trade away.
func tacticalExplorationConsumableCommand(room *Room, playerID string) (Command, bool) {
	return tacticalConsumableCommandForPhase(room, playerID, false)
}

func tacticalConsumableCommandForPhase(room *Room, playerID string, inCombat bool) (Command, bool) {
	if room == nil || room.Run == nil {
		return Command{}, false
	}
	player := room.Run.Players[playerID]
	if player == nil || player.Health <= 0 || player.Consumables[ConsumableHealingHerb] <= 0 {
		return Command{}, false
	}
	if inCombat {
		if player.Health*3 > player.MaxHealth || tacticalLifestealCanReplaceHerb(room, player) {
			return Command{}, false
		}
	}
	amount := (player.MaxHealth*HealingHerbHealingPercent + 99) / 100
	amount = floorRulesFor(room.Run).consumableHealing(amount)
	if player.MaxHealth-player.Health < (amount+1)/2 {
		return Command{}, false
	}
	return Command{Type: "use_consumable", ChoiceID: ConsumableHealingHerb}, true
}
