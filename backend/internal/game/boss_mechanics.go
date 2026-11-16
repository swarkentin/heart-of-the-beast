package game

import "fmt"

// Dungeon bosses, the boss on the last floor of an expedition, fight by more rules than a larger health pool.
// Each mechanic is resolved at the start of a round, before intents are telegraphed, so the party always sees
// what it is about to face and can answer it:
//
//	enrage     at 40% health the boss deals +2 damage with every hit for the rest of the fight.
//	summon     at 60% health the boss calls one reinforcement. It must also be defeated.
//	barrier    every third turn the boss raises a barrier that absorbs Strike damage. Signature abilities and
//	           interrupts pierce it, so a party that only Strikes loses a round to it.
//	cataclysm  every fourth turn the boss telegraphs a heavy, party-wide, interruptible attack in place of its
//	           normal move. Interrupt it or Defend.
const (
	BossMechanicEnrage    = "enrage"
	BossMechanicSummon    = "summon"
	BossMechanicBarrier   = "barrier"
	BossMechanicCataclysm = "cataclysm"

	BossEnrageHealthPercent = 40
	BossEnrageDamageBonus   = 2
	BossSummonHealthPercent = 60
	BossBarrierEveryTurns   = 3
	BossBarrierBase         = 4
	BossBarrierPerPlayer    = 3
	BossCataclysmEveryTurns = 4
	BossCataclysmDamage     = 6
)

func knownBossMechanic(id string) bool {
	switch id {
	case BossMechanicEnrage, BossMechanicSummon, BossMechanicBarrier, BossMechanicCataclysm:
		return true
	}
	return false
}

func validateBossMechanics(final FinalBossTemplate, themes DungeonThemeCatalog, monsters MonsterCatalog, themeID string) error {
	if len(final.Mechanics) == 0 {
		return fmt.Errorf("dungeon boss %q has no mechanics", final.EncounterID)
	}
	seen := make(map[string]bool, len(final.Mechanics))
	for _, mechanic := range final.Mechanics {
		if !knownBossMechanic(mechanic) || seen[mechanic] || mechanic == BossMechanicEnrage {
			return fmt.Errorf("dungeon boss %q has an unknown, repeated or implicit mechanic %q", final.EncounterID, mechanic)
		}
		seen[mechanic] = true
	}
	if seen[BossMechanicBarrier] != (final.BarrierLabel != "") || seen[BossMechanicCataclysm] != (final.CataclysmLabel != "") {
		return fmt.Errorf("dungeon boss %q needs a label for exactly the barrier and cataclysm it uses", final.EncounterID)
	}
	if seen[BossMechanicSummon] {
		summoned, err := monsters.Monster(final.SummonMonsterID)
		if err != nil || summoned.Role == MonsterRoleBoss {
			return fmt.Errorf("dungeon boss %q summons an unknown or boss monster %q", final.EncounterID, final.SummonMonsterID)
		}
		belongs := false
		for _, id := range themes.MonsterIDs(themeID, monsters) {
			belongs = belongs || id == final.SummonMonsterID
		}
		if !belongs {
			return fmt.Errorf("dungeon boss %q summons %q from another theme", final.EncounterID, final.SummonMonsterID)
		}
	}
	return nil
}

// armDungeonBoss gives the boss of a final-floor encounter its mechanics. Every dungeon boss enrages.
func armDungeonBoss(encounter *Encounter, final FinalBossTemplate) {
	for i := range encounter.Enemies {
		enemy := &encounter.Enemies[i]
		if monster, err := defaultMonsterCatalog.Monster(enemy.DefinitionID); err != nil || monster.Role != MonsterRoleBoss {
			continue
		}
		enemy.Mechanics = append([]string{BossMechanicEnrage}, final.Mechanics...)
		enemy.BarrierLabel, enemy.CataclysmLabel = final.BarrierLabel, final.CataclysmLabel
		if enemy.hasMechanic(BossMechanicSummon) {
			enemy.SummonMonsterID = final.SummonMonsterID
			enemy.SummonsLeft = 1
		}
	}
}

func (enemy *Enemy) hasMechanic(id string) bool {
	for _, mechanic := range enemy.Mechanics {
		if mechanic == id {
			return true
		}
	}
	return false
}

// applyBossMechanics resolves start-of-round boss mechanics for the current encounter. It runs before intents
// are built, with each enemy's TurnsTaken already advanced for the round that is starting.
func applyBossMechanics(room *Room, current *DungeonRoom, round int) {
	run := room.Run
	encounter := current.Encounter
	partySize := len(eligibleCombatPlayers(room))
	if partySize < 1 {
		partySize = 1
	}
	count := len(encounter.Enemies)
	for index := 0; index < count; index++ {
		enemy := &encounter.Enemies[index]
		if enemy.Health <= 0 || len(enemy.Mechanics) == 0 {
			continue
		}
		if enemy.hasMechanic(BossMechanicEnrage) && !enemy.Enraged && enemy.Health*100 <= enemy.MaxHealth*BossEnrageHealthPercent {
			enemy.Enraged = true
			enemy.DamageBonus += BossEnrageDamageBonus
			addCombatEvent(run, round, "boss_enrage", enemy.Name+" is enraged! Every hit it lands deals "+itoa(BossEnrageDamageBonus)+" more damage.")
		}
		if enemy.hasMechanic(BossMechanicBarrier) && enemy.TurnsTaken%BossBarrierEveryTurns == 1 {
			enemy.Barrier = BossBarrierBase + BossBarrierPerPlayer*partySize
			addCombatEvent(run, round, "boss_barrier", enemy.Name+" raises "+enemy.BarrierLabel+". It absorbs "+itoa(enemy.Barrier)+" Strike damage; signature abilities and interrupts pierce it.")
		}
		if enemy.hasMechanic(BossMechanicSummon) && enemy.SummonsLeft > 0 && len(encounter.Enemies) < MaxEncounterEnemies && enemy.Health*100 <= enemy.MaxHealth*BossSummonHealthPercent {
			enemy.SummonsLeft--
			scaling := MonsterScaling{Depth: run.Depth + dungeonExtraDepth(run), PartySize: len(room.PlayerIDs)}
			add, err := defaultMonsterCatalog.NewEnemy(fmt.Sprintf("%s-add-%d", enemy.ID, len(encounter.Enemies)), enemy.SummonMonsterID, scaling)
			if err != nil {
				continue
			}
			add.Health = int(float64(add.Health)*LiveEnemyHealthMultiplier + 0.5)
			add.MaxHealth = add.Health
			add.Summoned = true
			add.TurnsTaken = 1
			bossName := enemy.Name
			encounter.Enemies = append(encounter.Enemies, add)
			addCombatEvent(run, round, "boss_summon", bossName+" calls for help. "+add.Name+" joins the fight!")
		}
	}
}

// bossIntentOverride replaces a boss's normal move with its cataclysm on the turns it is due.
func bossIntentOverride(enemy *Enemy, intent *EnemyIntent, partySize int) *EnemyIntent {
	if !enemy.hasMechanic(BossMechanicCataclysm) || enemy.TurnsTaken%BossCataclysmEveryTurns != 0 {
		return intent
	}
	damage := BossCataclysmDamage
	if partySize > 1 {
		damage = int(float64(damage)*(1+float64(partySize-1)*PartyEnemyDamageMultiplierStep) + 0.5)
	}
	return &EnemyIntent{Kind: "cataclysm", Label: enemy.CataclysmLabel, Damage: damage, TargetAll: true, Interruptible: true}
}

// absorbWithBarrier spends a boss's barrier on incoming Strike damage and returns the damage that gets through.
func absorbWithBarrier(run *Run, enemy *Enemy, damage, round int) int {
	if enemy.Barrier <= 0 || damage <= 0 {
		return damage
	}
	absorbed := damage
	if absorbed > enemy.Barrier {
		absorbed = enemy.Barrier
	}
	enemy.Barrier -= absorbed
	message := enemy.BarrierLabel + " absorbs " + itoa(absorbed) + " damage."
	if enemy.Barrier == 0 {
		message = enemy.BarrierLabel + " absorbs " + itoa(absorbed) + " damage and shatters."
	}
	addCombatImpact(run, round, "boss_barrier_absorb", message, "block", enemy.ID, "enemy", absorbed)
	return damage - absorbed
}
