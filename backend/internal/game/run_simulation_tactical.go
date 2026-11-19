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
	for _, offer := range camp.Offers {
		if offer.Price > player.Gold || (!offer.Repeatable && contains(camp.Purchases[playerID], offer.ID)) {
			continue
		}
		switch {
		case offer.Kind == ShopRevive && fallenAlly(room, playerID) != "",
			offer.Kind == ShopHeal && missing >= offer.Amount,
			offer.Kind == ShopConsumable && player.Consumables[offer.ConsumableID] < MaxHealingHerbs && missing >= (player.MaxHealth*HealingHerbHealingPercent+99)/100,
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
