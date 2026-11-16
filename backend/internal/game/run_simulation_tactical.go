package game

import "math/rand"

// tacticalCombatCommand is one adventurer's move under RunPolicyTactical. It reads the round the way an attentive
// player does, in priority order:
//
//  1. interrupt an interruptible telegraph no earlier adventurer has already claimed this round;
//  2. use the signature ability when the shared balance policy says it fits (simulationClassAbilityCommand);
//  3. defend when the hits telegraphed at this adventurer would down them;
//  4. otherwise strike the weakest living enemy, so the party focuses fire.
//
// Every candidate is checked with the same validation live play uses; an invalid one falls through to a Strike.
func tacticalCombatCommand(room *Room, playerID string, round int, rng *rand.Rand) Command {
	defend := Command{Type: "combat", Round: round, Action: "defend"}
	run := room.Run
	player := run.Players[playerID]
	current := run.Rooms[run.CurrentRoomID]
	if player == nil || current == nil || current.Encounter == nil {
		return defend
	}
	enemies := current.Encounter.Enemies
	targetIndex := simulationTarget(enemies, rng)
	if targetIndex < 0 {
		return defend
	}
	claimed := make(map[string]bool)
	if run.CombatRound != nil {
		for _, action := range run.CombatRound.Actions {
			if action.Action == "interrupt" {
				claimed[action.TargetID] = true
			}
		}
	}
	for _, enemy := range enemies {
		if enemy.Health > 0 && enemy.Intent != nil && enemy.Intent.Interruptible && !claimed[enemy.ID] {
			return Command{Type: "combat", Round: round, Action: "interrupt", TargetID: enemy.ID}
		}
	}
	incoming := simulationIncomingFor(playerID, enemies, player, bonusesFor(player).DamageReduction)
	// A guard blocks one hit, so it is worth a turn when the round is dangerous, or (half the time, the way people
	// hedge) when one heavy hit is coming. Guarding on every hit means never winning.
	// No one guards when a Strike finishes the fight's weakest enemy, or once a fight has dragged on: a perfect
	// block changes nothing, so guarding forever never ends a fight.
	finishing := enemies[targetIndex].Health <= strikeBaseDamage(run, player)
	longFight := enemies[targetIndex].TurnsTaken > 12
	danger := incoming > 0 && incoming >= player.Health && !finishing && !longFight
	brace := danger || heaviestHitOn(playerID, enemies) >= 7 && !finishing && !longFight && rng.Intn(2) == 0
	if command, ok := simulationClassAbilityCommand(player, run.Players, enemies, targetIndex, playerID); ok && tacticalSignatureFits(player, run.Players, command, brace) {
		command.Type, command.Round = "combat", round
		if validateClassAbilityCommand(player, current.Encounter, command, run.Players) == nil {
			return command
		}
	}
	if danger {
		return defend
	}
	return Command{Type: "combat", Round: round, Action: "attack", TargetID: enemies[targetIndex].ID}
}

// tacticalSignatureFits narrows the shared balance policy, which raises protective signatures against any hit and
// heals any wound. Over a whole run that means a solo tank never swings and a solo healer never stops healing, so
// protection waits for a round worth bracing for and healing waits for an ally below 60% health.
func tacticalSignatureFits(player *PlayerState, players map[string]*PlayerState, command Command, brace bool) bool {
	ability, ok := findClassAbility(player.ClassBuild.SignatureAbilityID)
	if !ok {
		return false
	}
	switch ability.EffectID {
	case "combat.guard", "combat.ward":
		return brace
	case "combat.companion":
		return command.Mode != "defend" || brace
	case "combat.heal":
		recipient := players[command.TargetID]
		return recipient != nil && recipient.Health*100 < recipient.MaxHealth*60
	}
	return true
}

// heaviestHitOn is the largest single telegraphed hit aimed at a player this round.
func heaviestHitOn(playerID string, enemies []Enemy) int {
	heaviest := 0
	for _, enemy := range enemies {
		if enemy.Health > 0 && enemy.Intent != nil && (enemy.Intent.TargetAll || enemy.Intent.TargetPlayerID == playerID) && enemy.Intent.Damage > heaviest {
			heaviest = enemy.Intent.Damage
		}
	}
	return heaviest
}

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
			offer.Kind == ShopFullHeal && missing*2 >= player.MaxHealth:
			return Command{Type: "buy", ChoiceID: offer.ID}, true
		}
	}
	return Command{}, false
}
