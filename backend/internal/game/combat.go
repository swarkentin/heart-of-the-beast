package game

import (
	"errors"
	"fmt"
	"sort"
	"time"
)

const (
	CombatActionWindow             = 8 * time.Second
	PlayerStrikeDamage             = 6
	GuardDamageReduction           = 4
	LiveEnemyHealthMultiplier      = 1.2
	PartyEnemyHealthMultiplierStep = 0.15
	PartyEnemyDamageMultiplierStep = 0.1
)

// maxCombatEvents bounds the events a snapshot carries. Skills describe more of a round than three buttons did.
const maxCombatEvents = 48

var (
	ErrRoundActionSubmitted = errors.New("an action has already been submitted for this round")
	ErrStaleCombatRound     = errors.New("combat action belongs to an expired round")
)

func startCombatRound(room *Room, now time.Time) {
	run := room.Run
	run.CombatRoundNumber++
	run.CombatRound = &CombatRound{
		Number: run.CombatRoundNumber, StartedAt: now.UTC(),
		Deadline: now.UTC().Add(CombatActionWindow),
		Actions:  make(map[string]Command),
	}

	current := run.Rooms[run.CurrentRoomID]
	if current == nil || current.Encounter == nil {
		return
	}
	players := eligibleCombatPlayers(room)
	for enemyIndex := range current.Encounter.Enemies {
		if enemy := &current.Encounter.Enemies[enemyIndex]; enemy.Health > 0 {
			enemy.TurnsTaken++
		}
	}
	applyBossMechanics(room, current, run.CombatRoundNumber)
	applyTraitRoundStart(room, current.Encounter, run.CombatRoundNumber)
	if fightOpening(current.Encounter) {
		applyBoonFightOpening(room, run.CombatRoundNumber)
	}
	rules := floorRulesFor(run)
	for enemyIndex := range current.Encounter.Enemies {
		enemy := &current.Encounter.Enemies[enemyIndex]
		if enemy.Health <= 0 {
			enemy.Intent = nil
			continue
		}
		intent := traitIntentOverride(enemy, bossIntentOverride(enemy, buildEnemyIntent(enemy, enemy.TurnsTaken, enemyIndex, players), len(players)), len(players))
		if intent.Damage > 0 {
			// Floor modifiers and enrage are part of the telegraph, so what the party sees is what will land.
			intent.Damage += rules.EnemyDamage + enemy.DamageBonus
			if intent.Damage < 1 {
				intent.Damage = 1
			}
		}
		enemy.Intent = applyEnemyRoundStart(room, enemy, intent, run.CombatRoundNumber)
	}
}

// SubmitCombatAction records one player's choice. In co-op, the round resolves
// only when every living, non-departed player has submitted or the deadline passes.
func SubmitCombatAction(room *Room, actorID string, command Command, now time.Time) error {
	run := room.Run
	if run == nil || run.Phase != PhaseCombat {
		return ErrInvalidPhase
	}
	player, ok := run.Players[actorID]
	if !ok {
		return ErrNotPlayer
	}
	if player.Health <= 0 || room.Presence[actorID].LeftAt != nil {
		return ErrInvalidPhase
	}
	if run.CombatRound == nil {
		startCombatRound(room, now)
	}
	if !now.Before(run.CombatRound.Deadline) {
		AdvanceCombatRound(room, now)
		if run.Phase != PhaseCombat || run.CombatRound == nil {
			return ErrInvalidPhase
		}
	}
	if command.Round != run.CombatRound.Number {
		return ErrStaleCombatRound
	}
	if _, exists := run.CombatRound.Actions[actorID]; exists {
		return ErrRoundActionSubmitted
	}
	switch command.Action {
	case "defend":
		if command.Mode != "" || command.Skill != "" {
			return ErrInvalidAction
		}
	case "skill":
		current := run.Rooms[run.CurrentRoomID]
		if current == nil || current.Encounter == nil || current.Encounter.Status != EncounterActive {
			return ErrInvalidPhase
		}
		if err := validateSkillCommand(room, player, current.Encounter, command); err != nil {
			return err
		}
	default:
		return ErrInvalidAction
	}
	run.CombatRound.Actions[actorID] = command
	if allCombatActionsSubmitted(room) {
		resolveCombatRound(room, now)
	}
	return nil
}

// AdvanceCombatRound applies timeout fallbacks. It is safe to call on every
// player/spectator snapshot; it changes state only when a deadline has elapsed.
func AdvanceCombatRound(room *Room, now time.Time) bool {
	if room.Run == nil || room.Run.Phase != PhaseCombat || room.Run.CombatRound == nil {
		return false
	}
	if now.Before(room.Run.CombatRound.Deadline) {
		return false
	}
	resolveCombatRound(room, now)
	return true
}

func allCombatActionsSubmitted(room *Room) bool {
	for _, playerID := range room.PlayerIDs {
		player := room.Run.Players[playerID]
		if player == nil || player.Health <= 0 || room.Presence[playerID].LeftAt != nil {
			continue
		}
		if _, submitted := room.Run.CombatRound.Actions[playerID]; !submitted {
			return false
		}
	}
	return true
}

func resolveCombatRound(room *Room, now time.Time) {
	run := room.Run
	if run == nil || run.CombatRound == nil {
		return
	}
	current := run.Rooms[run.CurrentRoomID]
	if current == nil || current.Encounter == nil {
		run.CombatRound = nil
		return
	}

	roundNumber := run.CombatRound.Number
	run.LastCombatEvents = make([]CombatEvent, 0, len(room.PlayerIDs)+len(current.Encounter.Enemies)*2)
	playerIDs := append([]string(nil), room.PlayerIDs...)
	sort.Strings(playerIDs)

	// Resolve all player choices before enemy intents. An enemy defeated here
	// cannot carry out its already-telegraphed action.
	for _, playerID := range playerIDs {
		player := run.Players[playerID]
		if player == nil || player.Health <= 0 || room.Presence[playerID].LeftAt != nil {
			continue
		}
		action, submitted := run.CombatRound.Actions[playerID]
		if !submitted {
			action = Command{Type: "combat", Action: "defend"}
		}
		if action.Action == "skill" {
			if err := applySkill(room, player, action, roundNumber); err != nil {
				addCombatEvent(run, roundNumber, "class_ability_failed", adventurerLabel(room, playerID)+" could not use that skill.")
			}
			continue
		}
		player.ClassCombat.ArcaneCharges = 0
		defend(room, player, submitted, roundNumber)
	}

	// Surviving enemies execute the intentions players saw during the action
	// window. A guard protects against one incoming hit; area attacks test each
	// player's own guard independently.
	for enemyIndex := range current.Encounter.Enemies {
		enemy := &current.Encounter.Enemies[enemyIndex]
		if enemy.Health <= 0 || enemy.Intent == nil {
			continue
		}
		intent := *enemy.Intent
		targets := intentTargets(room, intent)
		if len(targets) == 0 {
			addCombatEvent(run, roundNumber, "enemy_miss", enemy.Name+"'s "+intent.Label+" finds no target.")
		}
		for _, playerID := range targets {
			player := run.Players[playerID]
			if player == nil || player.Health <= 0 || room.Presence[playerID].LeftAt != nil {
				continue
			}
			mitigation := resolveIncomingDamage(IncomingDamageInput{
				IntentDamage:          intent.Damage,
				PassiveReduction:      classPassiveEffects(player, enemy, &intent).DamageReduction,
				Ward:                  player.ClassCombat.Ward,
				WardReflect:           player.ClassCombat.WardReflect,
				Guarding:              player.Guarding,
				GuardReduction:        player.GuardReduction,
				DefaultGuardReduction: GuardDamageReduction,
				GuardBonus:            player.ClassCombat.GuardBonus,
				PartyGuardReduction:   floorRulesFor(run).PlayerGuard,
			})
			damage := mitigation.Damage
			wardReflect := mitigation.WardReflect
			guarded := mitigation.Guarded
			guardBlocked := mitigation.GuardBlocked
			player.ClassCombat.Ward = mitigation.WardRemaining
			player.ClassCombat.WardReflect = mitigation.WardReflectRemaining
			player.Guarding = mitigation.Guarding
			player.ClassCombat.GuardBonus = mitigation.GuardBonus
			if mitigation.WardAbsorbed > 0 {
				addCombatImpact(run, roundNumber, "runic_ward", "A Runic Ward absorbs "+itoa(mitigation.WardAbsorbed)+" damage.", "block", playerID, "player", mitigation.WardAbsorbed)
			}
			onClassGuardBlocked(player, intent, guarded, guardBlocked)
			damage = boonIncomingDamage(room, player, damage, roundNumber)
			transition := resolveHealthDamage(player.Health, damage)
			player.Health = transition.Health
			actualDamage := transition.Applied
			player.ClassCombat.DamageTakenThisRound += actualDamage
			message := enemy.Name + " uses " + intent.Label + " on " + adventurerLabel(room, playerID) + " for " + itoa(actualDamage) + " damage."
			if guarded {
				message += " Guarded."
			}
			if mitigation.Blocked > 0 {
				addCombatImpact(run, roundNumber, "enemy_block", enemy.Name+"'s attack is reduced by "+itoa(mitigation.Blocked)+" damage.", "block", playerID, "player", mitigation.Blocked)
			}
			if actualDamage > 0 {
				addCombatImpact(run, roundNumber, "enemy_attack", message, "damage", playerID, "player", actualDamage)
			} else {
				addCombatEvent(run, roundNumber, "enemy_attack", message)
			}
			reflectDamage := player.ClassCombat.Thorns + wardReflect
			if intent.Damage > 0 {
				reflectDamage += boonReflect(player)
			}
			if reflectDamage > 0 && enemy.Health > 0 {
				transition := resolveHealthDamage(enemy.Health, reflectDamage)
				enemy.Health = transition.Health
				reflected := transition.Applied
				if reflected > 0 {
					addCombatImpact(run, roundNumber, "thorns", enemy.Name+" takes "+itoa(reflected)+" reflected damage.", "damage", enemy.ID, "enemy", reflected)
				}
				if enemy.Health == 0 {
					enemy.Intent = nil
					addCombatEvent(run, roundNumber, "enemy_defeated", enemy.Name+" is defeated by reflected damage.")
				}
			}
			if player.Health == 0 {
				addCombatEvent(run, roundNumber, "player_down", adventurerLabel(room, playerID)+" is down!")
			}
		}
		if intent.Heal > 0 && enemy.Health > 0 {
			transition := resolveHealthHealing(enemy.Health, enemy.MaxHealth, intent.Heal)
			enemy.Health = transition.Health
			if transition.Applied > 0 {
				addCombatImpact(run, roundNumber, "enemy_heal", enemy.Name+" drains life and restores "+itoa(transition.Applied)+" health.", "heal", enemy.ID, "enemy", transition.Applied)
			}
		}
		if intent.Kind == "detonate" && enemy.Health > 0 {
			enemy.Health = 0
			addCombatEvent(run, roundNumber, "enemy_defeated", enemy.Name+" is destroyed in its own blast.")
		}
		enemy.Intent = nil
	}

	applyCompanionInstinct(room, roundNumber)
	endCombatRound(room, current.Encounter, roundNumber)
	applyBossRebirths(run, current.Encounter, roundNumber)

	if allEnemiesDefeated(current.Encounter) {
		current.Encounter.Status = EncounterCleared
		// Every fight starts with every skill ready.
		resetFightStatuses(run)
		applyEncounterReward(room, current, roundNumber)
		current.Cleared = true
		grantEncounterExperience(room, roundNumber)
		run.EncountersCleared++
		grantEncounterGold(room, current, roundNumber)
		run.CombatRound = nil
		if current.RoomType == "miniboss" {
			rewardID := "encounter.miniboss"
			if run.Generator >= ExpeditionGenerator {
				rewardID = "encounter.champion"
			}
			if reward, ok := defaultRunRewardCatalog.Reward(rewardID); ok {
				applyRunReward(room, reward, roundNumber, "miniboss-"+current.ID)
			}
		}
		if current.RoomType == string(floorRoomLair) {
			if reward, ok := defaultRunRewardCatalog.Reward("encounter.lair"); ok {
				applyRunReward(room, reward, roundNumber, "lair-"+current.ID)
			}
		}
		if isBossRoom(current) && run.Generator >= ExpeditionGenerator {
			finishExpeditionFloor(room, current, roundNumber, now)
		} else if isBossRoom(current) && run.MaxDepth > 0 && run.Depth < run.MaxDepth {
			run.Phase = PhaseIntermission
			run.PendingInterFloorChoice = true
			run.NavigationVote = nil
			run.InterFloorVote = &NavigationVote{StartedAt: now.UTC(), Deadline: now.UTC().Add(InterFloorChoiceWindow), Votes: make(map[string]string)}
			addCombatEvent(run, roundNumber, "floor_cleared", fmt.Sprintf("Floor %d is cleared. Choose health restoration or a run perk before descending.", run.Depth))
		} else if isBossRoom(current) {
			run.Phase = PhaseCompleted
			completed := now.UTC()
			run.CompletedAt = &completed
			addCombatEvent(run, roundNumber, "victory", clearedText(run.Theme()))
		} else {
			run.Phase = PhaseExploring
			startNavigationVote(room, now)
		}
		return
	}

	if len(eligibleCombatPlayers(room)) == 0 {
		run.CombatRound = nil
		run.Camp = nil
		run.Phase = PhaseFailed
		completed := now.UTC()
		run.CompletedAt = &completed
		if run.Generator >= ExpeditionGenerator {
			run.Rank = ExpeditionRank(run.FloorsCleared)
			addCombatEvent(run, roundNumber, "defeat", fmt.Sprintf("The party has fallen in dungeon %d, on floor %d. %d floors cleared: %s.", dungeonNumber(run), run.Depth, run.FloorsCleared, run.Rank))
		} else {
			addCombatEvent(run, roundNumber, "defeat", "The party has fallen. The run is over.")
		}
		return
	}

	for _, player := range run.Players {
		player.ClassCombat.DamageTakenLastRound = player.ClassCombat.DamageTakenThisRound
		player.ClassCombat.DamageTakenThisRound = 0
	}
	startCombatRound(room, now)
}

func intentTargets(room *Room, intent EnemyIntent) []string {
	if intent.TargetAll {
		return eligibleCombatPlayers(room)
	}
	if intent.TargetPlayerID == "" {
		return nil
	}
	player := room.Run.Players[intent.TargetPlayerID]
	if player == nil || player.Health <= 0 || room.Presence[intent.TargetPlayerID].LeftAt != nil {
		return nil
	}
	return []string{intent.TargetPlayerID}
}

func eligibleCombatPlayers(room *Room) []string {
	if room.Run == nil {
		return nil
	}
	players := make([]string, 0, len(room.PlayerIDs))
	for _, playerID := range room.PlayerIDs {
		player := room.Run.Players[playerID]
		if player == nil || player.Health <= 0 || room.Presence[playerID].LeftAt != nil {
			continue
		}
		players = append(players, playerID)
	}
	sort.Strings(players)
	return players
}

func adventurerLabel(room *Room, playerID string) string {
	for index, id := range room.PlayerIDs {
		if id == playerID {
			return "Adventurer " + itoa(index+1)
		}
	}
	return "Adventurer"
}

func addCombatEvent(run *Run, round int, kind, message string) {
	run.LastCombatEvents = append(run.LastCombatEvents, CombatEvent{Round: round, Kind: kind, Message: message})
	if len(run.LastCombatEvents) > maxCombatEvents {
		run.LastCombatEvents = append([]CombatEvent(nil), run.LastCombatEvents[len(run.LastCombatEvents)-maxCombatEvents:]...)
	}
}

func addCombatImpact(run *Run, round int, kind, message, effect, targetID, targetType string, amount int) {
	run.LastCombatEvents = append(run.LastCombatEvents, CombatEvent{
		Round: round, Kind: kind, Message: message, Effect: effect,
		TargetID: targetID, TargetType: targetType, Amount: amount,
	})
	if len(run.LastCombatEvents) > maxCombatEvents {
		run.LastCombatEvents = append([]CombatEvent(nil), run.LastCombatEvents[len(run.LastCombatEvents)-maxCombatEvents:]...)
	}
}

func itoa(value int) string {
	if value == 0 {
		return "0"
	}
	digits := make([]byte, 0, 3)
	for value > 0 {
		digits = append(digits, byte('0'+value%10))
		value /= 10
	}
	for left, right := 0, len(digits)-1; left < right; left, right = left+1, right-1 {
		digits[left], digits[right] = digits[right], digits[left]
	}
	return string(digits)
}

func hasLivingEnemy(encounter *Encounter, enemyID string) bool {
	for _, enemy := range encounter.Enemies {
		if enemy.ID == enemyID && enemy.Health > 0 {
			return true
		}
	}
	return false
}

func applyEncounterReward(room *Room, current *DungeonRoom, roundNumber int) {
	rewardID := ""
	switch current.ID {
	case "reliquary":
		rewardID = "room.reliquary"
	case "flooded-crossing":
		rewardID = "room.flooded_cache"
	}
	if rewardID == "" {
		return
	}
	definition, ok := defaultRunRewardCatalog.Reward(rewardID)
	if !ok {
		return
	}
	applyRunReward(room, definition, roundNumber, "")
}

// strikeBaseDamage is a player's Strike before talents, passives and marks: the stat, the run's permanent
// bonuses, and the floor's modifier. A Strike always deals at least 1.
func strikeBaseDamage(run *Run, player *PlayerState) int {
	damage := player.StrikeDamage + player.Stats.Power + floorRulesFor(run).PlayerStrike
	if damage < 1 {
		damage = 1
	}
	return damage
}
