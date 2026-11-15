package game

import (
	"fmt"
	"math/rand"
	"sort"
)

// CombatSimulationSnapshot is an explicit, persistence-free combat fixture.
// Callers provide already-built players and catalog-backed runtime enemies;
// the simulator copies both slices before resolving anything.
type CombatSimulationSnapshot struct {
	Players          []PlayerState `json:"players"`
	Enemies          []Enemy       `json:"enemies"`
	ExperienceReward int           `json:"experienceReward,omitempty"`
}

// CombatSimulationReport is a machine-readable summary for one reproducible run.
type CombatSimulationReport struct {
	Seed                  int64                            `json:"seed"`
	Won                   bool                             `json:"won"`
	Wiped                 bool                             `json:"wiped"`
	Rounds                int                              `json:"rounds"`
	PlayerDamageDealt     int                              `json:"playerDamageDealt"`
	PlayerDamageReceived  int                              `json:"playerDamageReceived"`
	PlayerHealing         int                              `json:"playerHealing"`
	MonsterHealing        int                              `json:"monsterHealing"`
	PlayersDowned         int                              `json:"playersDowned"`
	AbilityUses           map[string]int                   `json:"abilityUses"`
	RemainingPlayerHealth map[string]int                   `json:"remainingPlayerHealth"`
	RemainingEnemyHealth  map[string]int                   `json:"remainingEnemyHealth"`
	PlayerProgression     map[string]ProgressionTransition `json:"playerProgression,omitempty"`
}

// SimulateCombat runs a deterministic attack/defend/interrupt policy against a
// catalog-backed encounter. It intentionally has no room, clock, database,
// websocket, or event dependencies. The seed controls policy tie-breaking.
func SimulateCombat(snapshot CombatSimulationSnapshot, seed int64, maxRounds int) (CombatSimulationReport, error) {
	if maxRounds <= 0 {
		maxRounds = 100
	}
	players := make(map[string]*PlayerState, len(snapshot.Players))
	playerIDs := make([]string, 0, len(snapshot.Players))
	for _, value := range snapshot.Players {
		if value.ID == "" {
			return CombatSimulationReport{}, fmt.Errorf("simulation player ID cannot be empty")
		}
		if _, exists := players[value.ID]; exists {
			return CombatSimulationReport{}, fmt.Errorf("duplicate simulation player %q", value.ID)
		}
		player := value
		if player.MaxHealth <= 0 || player.Health < 0 || player.Health > player.MaxHealth {
			return CombatSimulationReport{}, fmt.Errorf("player %q has invalid health", player.ID)
		}
		players[player.ID] = &player
		playerIDs = append(playerIDs, player.ID)
	}
	if len(players) == 0 {
		return CombatSimulationReport{}, fmt.Errorf("simulation requires at least one player")
	}
	sort.Strings(playerIDs)

	enemies := make([]Enemy, len(snapshot.Enemies))
	copy(enemies, snapshot.Enemies)
	seenEnemies := make(map[string]bool, len(enemies))
	for i := range enemies {
		if enemies[i].ID == "" || seenEnemies[enemies[i].ID] {
			return CombatSimulationReport{}, fmt.Errorf("simulation enemy IDs must be non-empty and unique")
		}
		seenEnemies[enemies[i].ID] = true
		if enemies[i].MaxHealth <= 0 || enemies[i].Health < 0 || enemies[i].Health > enemies[i].MaxHealth {
			return CombatSimulationReport{}, fmt.Errorf("enemy %q has invalid health", enemies[i].ID)
		}
		if enemies[i].Behavior == "" && enemies[i].DefinitionID != "" {
			definition, err := defaultMonsterCatalog.Monster(enemies[i].DefinitionID)
			if err != nil {
				return CombatSimulationReport{}, err
			}
			enemies[i].Behavior = definition.BehaviorID
		}
		if enemies[i].Behavior == "" {
			return CombatSimulationReport{}, fmt.Errorf("enemy %q has no catalog behavior", enemies[i].ID)
		}
		if _, err := defaultMonsterCatalog.Monster(enemies[i].Behavior); err != nil {
			return CombatSimulationReport{}, fmt.Errorf("enemy %q: %w", enemies[i].ID, err)
		}
	}
	if len(enemies) == 0 {
		return CombatSimulationReport{}, fmt.Errorf("simulation requires at least one enemy")
	}

	report := CombatSimulationReport{
		Seed:                  seed,
		AbilityUses:           make(map[string]int),
		RemainingPlayerHealth: make(map[string]int, len(players)),
		RemainingEnemyHealth:  make(map[string]int, len(enemies)),
		PlayerProgression:     make(map[string]ProgressionTransition),
	}
	rng := rand.New(rand.NewSource(seed))

	for round := 1; round <= maxRounds; round++ {
		if allSimulationEnemiesDefeated(enemies) {
			report.Won = true
			break
		}
		if allSimulationPlayersDown(players) {
			report.Wiped = true
			break
		}
		report.Rounds = round

		eligibleIDs := make([]string, 0, len(players))
		for _, id := range playerIDs {
			if players[id].Health > 0 {
				eligibleIDs = append(eligibleIDs, id)
			}
		}
		for i := range enemies {
			enemy := &enemies[i]
			if enemy.Health <= 0 {
				enemy.Intent = nil
				continue
			}
			enemy.TurnsTaken++
			enemy.Intent = buildEnemyIntent(enemy, enemy.TurnsTaken, i, eligibleIDs)
		}

		// Players act in stable ID order, before any surviving enemy intent resolves.
		for _, playerID := range playerIDs {
			player := players[playerID]
			if player.Health <= 0 {
				continue
			}
			targetIndex := simulationTarget(enemies, rng)
			if targetIndex < 0 {
				break
			}
			target := &enemies[targetIndex]
			bonuses := bonusesFor(player)
			passive := classPassiveEffects(player, target, target.Intent)

			if target.Intent != nil && target.Intent.Interruptible && target.Intent.Damage >= 5 && player.Stats.Focus > 0 {
				interruptPassive := classPassiveEffects(player, target, target.Intent)
				damage := resolveInterruptDamage(player.Stats.Focus, bonuses.InterruptDamage, interruptPassive.InterruptDamage)
				transition := resolveHealthDamage(target.Health, damage)
				target.Health = transition.Health
				report.PlayerDamageDealt += transition.Applied
				target.Intent = nil
				continue
			}

			partyBonuses := simulationPartyBonuses(players)
			incoming := simulationIncomingFor(playerID, enemies, player, bonuses.DamageReduction)
			guard := player.GuardReduction
			if guard <= 0 {
				guard = GuardDamageReduction
			}
			guard += bonuses.GuardReduction + partyBonuses.PartyGuardReduction
			if incoming > guard && incoming >= 5 {
				player.Guarding = true
				continue
			}

			attack := resolveAttackDamage(AttackDamageInput{
				BaseDamage:          player.StrikeDamage + player.Stats.Power,
				BonusDamage:         bonuses.AttackDamage + passive.AttackDamage,
				TelegraphBonus:      bonuses.AttackVsTelegraph,
				MarkedDamage:        target.MarkedDamage,
				IncludeMarkedDamage: true,
				ConsumeMarkedDamage: true,
				ResolveReady:        player.ClassCombat.ResolveReady,
				UseResolve:          true,
				ResolveBonus:        3,
				Telegraph:           target.Intent != nil && target.Intent.Interruptible,
			})
			target.MarkedDamage = attack.RemainingMarkedDamage
			player.ClassCombat.ResolveReady = attack.ResolveReady
			transition := resolveHealthDamage(target.Health, attack.Damage)
			target.Health = transition.Health
			report.PlayerDamageDealt += transition.Applied
		}

		// Surviving enemies execute the same catalog intent and mitigation arithmetic as live combat.
		for i := range enemies {
			enemy := &enemies[i]
			if enemy.Health <= 0 || enemy.Intent == nil {
				continue
			}
			intent := *enemy.Intent
			report.AbilityUses[intent.Kind]++
			targetIDs := make([]string, 0, len(players))
			if intent.TargetAll {
				for _, id := range playerIDs {
					if players[id].Health > 0 {
						targetIDs = append(targetIDs, id)
					}
				}
			} else if intent.TargetPlayerID != "" && players[intent.TargetPlayerID] != nil && players[intent.TargetPlayerID].Health > 0 {
				targetIDs = append(targetIDs, intent.TargetPlayerID)
			}
			for _, playerID := range targetIDs {
				player := players[playerID]
				mitigation := resolveIncomingDamage(IncomingDamageInput{
					IntentDamage:          intent.Damage,
					AgilityReduction:      player.Stats.Agility,
					TalentReduction:       bonusesFor(player).DamageReduction,
					PassiveReduction:      classPassiveEffects(player, enemy, &intent).DamageReduction,
					Ward:                  player.ClassCombat.Ward,
					WardReflect:           player.ClassCombat.WardReflect,
					Guarding:              player.Guarding,
					GuardReduction:        player.GuardReduction,
					DefaultGuardReduction: GuardDamageReduction,
					GuardBonus:            player.ClassCombat.GuardBonus,
					TalentGuardReduction:  bonusesFor(player).GuardReduction,
					PartyGuardReduction:   simulationPartyBonuses(players).PartyGuardReduction,
				})
				player.ClassCombat.Ward = mitigation.WardRemaining
				player.ClassCombat.WardReflect = mitigation.WardReflectRemaining
				player.Guarding = mitigation.Guarding
				player.ClassCombat.GuardBonus = mitigation.GuardBonus
				onClassGuardBlocked(player, intent, mitigation.Guarded, mitigation.GuardBlocked)
				transition := resolveHealthDamage(player.Health, mitigation.Damage)
				player.Health = transition.Health
				report.PlayerDamageReceived += transition.Applied
				if player.Health == 0 {
					report.PlayersDowned++
				}
				reflectDamage := mitigation.WardReflect + bonusesFor(player).ReflectDamage
				if reflectDamage > 0 && enemy.Health > 0 {
					reflect := reflectDamage
					reflected := resolveHealthDamage(enemy.Health, reflect)
					enemy.Health = reflected.Health
					report.PlayerDamageDealt += reflected.Applied
				}
			}
			if intent.Heal > 0 && enemy.Health > 0 {
				healing := resolveHealthHealing(enemy.Health, enemy.MaxHealth, intent.Heal)
				enemy.Health = healing.Health
				report.MonsterHealing += healing.Applied
			}
			enemy.Intent = nil
		}
		report.PlayerHealing += applySimulationCompanionInstinct(players, playerIDs)
		for _, player := range players {
			player.Guarding = false
			player.ClassCombat.GuardBonus = 0
		}
	}

	if allSimulationEnemiesDefeated(enemies) {
		report.Won = true
	}
	if allSimulationPlayersDown(players) && !report.Won {
		report.Wiped = true
	}
	if report.Won {
		partyBonuses := simulationPartyBonuses(players)
		for _, player := range players {
			if player.Health <= 0 {
				continue
			}
			heal := bonusesFor(player).EncounterHeal + classPassiveEffects(player, nil, nil).EncounterHeal + partyBonuses.PartyEncounterHeal
			if heal > 0 {
				transition := resolveHealthHealing(player.Health, player.MaxHealth, heal)
				player.Health = transition.Health
				report.PlayerHealing += transition.Applied
			}
		}
		if snapshot.ExperienceReward > 0 {
			for id, player := range players {
				report.PlayerProgression[id] = resolveExperienceGain(*player, snapshot.ExperienceReward)
			}
		}
	}
	for id, player := range players {
		report.RemainingPlayerHealth[id] = player.Health
	}
	for _, enemy := range enemies {
		report.RemainingEnemyHealth[enemy.ID] = enemy.Health
	}
	if len(report.PlayerProgression) == 0 {
		report.PlayerProgression = nil
	}
	return report, nil
}

// SimulateCombatBatch runs independent seeds in caller-provided order.
func SimulateCombatBatch(snapshot CombatSimulationSnapshot, seeds []int64, maxRounds int) ([]CombatSimulationReport, error) {
	reports := make([]CombatSimulationReport, 0, len(seeds))
	for _, seed := range seeds {
		report, err := SimulateCombat(snapshot, seed, maxRounds)
		if err != nil {
			return nil, err
		}
		reports = append(reports, report)
	}
	return reports, nil
}

func simulationTarget(enemies []Enemy, rng *rand.Rand) int {
	lowestHealth := -1
	candidates := make([]int, 0, len(enemies))
	for i := range enemies {
		if enemies[i].Health <= 0 {
			continue
		}
		if lowestHealth < 0 || enemies[i].Health < lowestHealth {
			lowestHealth = enemies[i].Health
			candidates = candidates[:0]
			candidates = append(candidates, i)
		} else if enemies[i].Health == lowestHealth {
			candidates = append(candidates, i)
		}
	}
	if len(candidates) == 0 {
		return -1
	}
	return candidates[rng.Intn(len(candidates))]
}

func simulationIncomingFor(playerID string, enemies []Enemy, player *PlayerState, talentReduction int) int {
	total := 0
	for _, enemy := range enemies {
		if enemy.Health <= 0 || enemy.Intent == nil || (!enemy.Intent.TargetAll && enemy.Intent.TargetPlayerID != playerID) {
			continue
		}
		passive := classPassiveEffects(player, &enemy, enemy.Intent)
		damage := enemy.Intent.Damage - player.Stats.Agility - talentReduction - passive.DamageReduction
		if damage > 0 {
			total += damage
		}
	}
	return total
}

func simulationPartyBonuses(players map[string]*PlayerState) TalentBonuses {
	var bonuses TalentBonuses
	for _, player := range players {
		if player == nil || player.Health <= 0 {
			continue
		}
		bonuses = addTalentBonuses(bonuses, bonusesFor(player))
	}
	return bonuses
}

func applySimulationCompanionInstinct(players map[string]*PlayerState, playerIDs []string) int {
	healed := 0
	for _, ownerID := range playerIDs {
		owner := players[ownerID]
		if owner == nil || owner.Health <= 0 || !classPassiveHasTrigger(owner, ClassPassiveTriggerCompanionInstinct) {
			continue
		}
		var target *PlayerState
		for _, candidateID := range playerIDs {
			candidate := players[candidateID]
			if candidate == nil || candidate.Health <= 0 || candidate.Health >= candidate.MaxHealth {
				continue
			}
			if target == nil || candidate.Health*target.MaxHealth < target.Health*candidate.MaxHealth {
				target = candidate
			}
		}
		if target != nil {
			transition := resolveHealthHealing(target.Health, target.MaxHealth, 1)
			target.Health = transition.Health
			healed += transition.Applied
		}
	}
	return healed
}

func allSimulationEnemiesDefeated(enemies []Enemy) bool {
	for _, enemy := range enemies {
		if enemy.Health > 0 {
			return false
		}
	}
	return true
}

func allSimulationPlayersDown(players map[string]*PlayerState) bool {
	for _, player := range players {
		if player.Health > 0 {
			return false
		}
	}
	return true
}

// CombatSimulationBatchReport summarizes the outcome distribution for a batch.
type CombatSimulationBatchReport struct {
	Runs                 int     `json:"runs"`
	Wins                 int     `json:"wins"`
	Wipes                int     `json:"wipes"`
	WinRate              float64 `json:"winRate"`
	MedianRounds         int     `json:"medianRounds"`
	P90Rounds            int     `json:"p90Rounds"`
	MedianDamageDealt    int     `json:"medianDamageDealt"`
	MedianDamageReceived int     `json:"medianDamageReceived"`
}

// SummarizeCombatBatch reports robust distribution statistics without changing
// the caller's report order or contents. Percentiles use nearest-rank semantics.
func SummarizeCombatBatch(reports []CombatSimulationReport) CombatSimulationBatchReport {
	summary := CombatSimulationBatchReport{Runs: len(reports)}
	if len(reports) == 0 {
		return summary
	}
	rounds := make([]int, len(reports))
	dealt := make([]int, len(reports))
	received := make([]int, len(reports))
	for i, report := range reports {
		if report.Won {
			summary.Wins++
		}
		if report.Wiped {
			summary.Wipes++
		}
		rounds[i] = report.Rounds
		dealt[i] = report.PlayerDamageDealt
		received[i] = report.PlayerDamageReceived
	}
	summary.WinRate = float64(summary.Wins) / float64(summary.Runs)
	sort.Ints(rounds)
	sort.Ints(dealt)
	sort.Ints(received)
	summary.MedianRounds = median(rounds)
	summary.P90Rounds = nearestRank(rounds, 0.90)
	summary.MedianDamageDealt = median(dealt)
	summary.MedianDamageReceived = median(received)
	return summary
}

func nearestRank(sortedValues []int, percentile float64) int {
	if len(sortedValues) == 0 {
		return 0
	}
	index := int(float64(len(sortedValues))*percentile+0.999999) - 1
	if index < 0 {
		index = 0
	}
	if index >= len(sortedValues) {
		index = len(sortedValues) - 1
	}
	return sortedValues[index]
}

func median(sortedValues []int) int {
	if len(sortedValues) == 0 {
		return 0
	}
	middle := len(sortedValues) / 2
	if len(sortedValues)%2 == 1 {
		return sortedValues[middle]
	}
	return (sortedValues[middle-1] + sortedValues[middle]) / 2
}
