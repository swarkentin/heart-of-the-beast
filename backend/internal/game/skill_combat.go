package game

// The skill interpreter. A cast resolves its effects in order against the targets its definition names, with
// the same damage, healing and mitigation arithmetic as the rest of combat. Statuses a skill leaves behind
// (stuns, bleeds, taunts, regeneration, cooldowns) tick at the start or end of a round in startCombatRound and
// endCombatRound.

const (
	// ResolveBonus is the Bulwark's Resolve: extra damage on the next damaging skill after guarding a heavy hit.
	ResolveBonus = 3
	// MaxEmpower caps stacked empowerment.
	MaxEmpower = 12
	// MaxArcaneCharges caps the Arcanist's Arcane Focus.
	MaxArcaneCharges = 2
	// SkillStrike is the plain attack of an adventurer who has no class (persisted pre-class runs).
	SkillStrike = "skill.strike"
)

func init() {
	// The classless strike shares the catalog so every lookup works the same way.
	skillCatalog = append(skillCatalog, basic(skill("", SkillStrike, "Strike", 1, SkillTargetEnemy, 0, "strike", "strike", "A plain weapon blow.", dmg(BasicAttackDamage, statPower))))
	index := len(skillCatalog) - 1
	skillCatalog[index].Rules = describeSkill(skillCatalog[index])
	skillIndex[SkillStrike] = index
}

type classPassiveBonuses struct {
	AttackDamage    int
	InterruptDamage int
	DamageReduction int
	EncounterHeal   int
	ElementalDamage int
}

// ensureSkills gives a player from a run persisted before skills a bar to fight with.
func ensureSkills(player *PlayerState) {
	if player == nil || len(player.Skills) > 0 {
		return
	}
	if player.ClassBuild != nil {
		player.Skills = DefaultLoadout(player.ClassBuild.ClassID, 1)
		return
	}
	player.Skills = []string{SkillStrike, SkillDefend}
}

func validateSkillCommand(room *Room, player *PlayerState, encounter *Encounter, command Command) error {
	if player == nil {
		return ErrInvalidSkill
	}
	ensureSkills(player)
	if !contains(player.Skills, command.Skill) {
		return ErrInvalidSkill
	}
	definition, ok := findSkill(command.Skill)
	if !ok {
		return ErrInvalidSkill
	}
	if player.ClassCombat.Cooldowns[definition.ID] > 0 {
		return ErrSkillCoolingDown
	}
	switch definition.Target {
	case SkillTargetEnemy:
		if encounter == nil || !hasLivingEnemy(encounter, command.TargetID) {
			return ErrInvalidTarget
		}
	case SkillTargetAlly:
		if command.TargetID != "" {
			if target := room.Run.Players[command.TargetID]; target == nil || target.Health <= 0 || room.Presence[command.TargetID].LeftAt != nil {
				return ErrInvalidTarget
			}
		}
	case SkillTargetFallen:
		target := room.Run.Players[command.TargetID]
		if target == nil || target.Health > 0 || command.TargetID == player.ID || room.Presence[command.TargetID].LeftAt != nil {
			return ErrInvalidTarget
		}
	}
	return nil
}

// skillCast is one skill being resolved.
type skillCast struct {
	room       *Room
	run        *Run
	player     *PlayerState
	definition SkillDefinition
	round      int
	encounter  *Encounter
	enemy      *Enemy       // the chosen enemy, for an enemy-targeted skill
	ally       *PlayerState // the chosen adventurer, for an ally or fallen-targeted skill
	dealt      int
	struck     bool
}

func applySkill(room *Room, player *PlayerState, command Command, round int) error {
	definition, ok := findSkill(command.Skill)
	if !ok {
		return ErrInvalidSkill
	}
	run := room.Run
	current := run.Rooms[run.CurrentRoomID]
	if current == nil || current.Encounter == nil {
		return ErrInvalidSkill
	}
	cast := &skillCast{room: room, run: run, player: player, definition: definition, round: round, encounter: current.Encounter}
	switch definition.Target {
	case SkillTargetEnemy:
		if cast.enemy = findLivingEnemy(current.Encounter, command.TargetID); cast.enemy == nil {
			return ErrInvalidSkill
		}
	case SkillTargetAlly:
		cast.ally = player
		if command.TargetID != "" {
			cast.ally = run.Players[command.TargetID]
		}
		if cast.ally == nil || cast.ally.Health <= 0 {
			return ErrInvalidSkill
		}
	case SkillTargetFallen:
		if cast.ally = run.Players[command.TargetID]; cast.ally == nil || cast.ally.Health > 0 {
			return ErrInvalidSkill
		}
	}
	first := len(run.LastCombatEvents)
	if definition.ID == SkillDefend {
		defend(room, player, true, round)
	}
	for i, effect := range definition.Effects {
		if isDamageRider(effect) {
			continue
		}
		riders := damageRiders(definition.Effects, i)
		switch {
		case definition.ID == SkillDefend:
		case isEnemyEffect(effect.Kind):
			for _, enemy := range cast.enemyTargets(effect) {
				cast.applyEnemyEffect(effect, riders, enemy)
			}
			if effect.Kind == EffectTaunt {
				cast.announceTaunt(effect)
			}
		default:
			for _, target := range cast.playerTargets(effect) {
				cast.applyPlayerEffect(effect, target)
			}
		}
	}
	if cast.struck {
		player.ClassCombat.Empower = 0
	}
	if definition.Elemental {
		if player.ClassCombat.ArcaneCharges < MaxArcaneCharges {
			player.ClassCombat.ArcaneCharges++
		}
	} else {
		player.ClassCombat.ArcaneCharges = 0
	}
	if definition.Cooldown > 0 {
		if player.ClassCombat.Cooldowns == nil {
			player.ClassCombat.Cooldowns = make(map[string]int)
		}
		// Counted down at the end of every round, this one included.
		player.ClassCombat.Cooldowns[definition.ID] = boonCooldown(player, definition.Cooldown+1)
	}
	boonAfterSkill(cast)
	for i := first; i < len(run.LastCombatEvents); i++ {
		run.LastCombatEvents[i].ActorID = player.ID
	}
	return nil
}

// A damage effect with no amount and no stat is a rider: a conditional bonus on the damage effect before it.
func isDamageRider(effect SkillEffect) bool {
	return effect.Kind == EffectDamage && effect.Amount == 0 && effect.Stat == ""
}

func damageRiders(effects []SkillEffect, index int) []SkillEffect {
	if effects[index].Kind != EffectDamage && effects[index].Kind != EffectCounter {
		return nil
	}
	var riders []SkillEffect
	for _, effect := range effects[index+1:] {
		if !isDamageRider(effect) {
			break
		}
		riders = append(riders, effect)
	}
	return riders
}

func (cast *skillCast) name() string {
	return adventurerLabel(cast.room, cast.player.ID) + "'s " + cast.definition.Name
}

func (cast *skillCast) enemyTargets(effect SkillEffect) []*Enemy {
	if cast.definition.Target == SkillTargetEnemy && effect.Scope != ScopeAllEnemies {
		if cast.enemy != nil && cast.enemy.Health > 0 {
			return []*Enemy{cast.enemy}
		}
		return nil
	}
	var targets []*Enemy
	for i := range cast.encounter.Enemies {
		if enemy := &cast.encounter.Enemies[i]; enemy.Health > 0 {
			targets = append(targets, enemy)
		}
	}
	return targets
}

func (cast *skillCast) playerTargets(effect SkillEffect) []*PlayerState {
	scope := effect.Scope
	if scope == "" {
		switch cast.definition.Target {
		case SkillTargetParty:
			scope = ScopeParty
		case SkillTargetAlly, SkillTargetFallen:
			return []*PlayerState{cast.ally}
		default:
			scope = ScopeSelf
		}
	}
	if scope == ScopeSelf {
		return []*PlayerState{cast.player}
	}
	var targets []*PlayerState
	for _, id := range eligibleCombatPlayers(cast.room) {
		targets = append(targets, cast.run.Players[id])
	}
	return targets
}

func statValue(player *PlayerState, stat string) int {
	switch stat {
	case statPower:
		return player.Stats.Power
	case statFocus:
		return player.Stats.Focus
	case statAgility:
		return player.Stats.Agility
	}
	return 0
}

func conditionHolds(when string, player *PlayerState, enemy *Enemy) bool {
	switch when {
	case WhenWounded:
		return enemy.MaxHealth > 0 && enemy.Health*2 <= enemy.MaxHealth
	case WhenTelegraphing:
		return enemy.Intent != nil
	case WhenSelfWounded:
		return player.MaxHealth > 0 && player.Health*2 <= player.MaxHealth
	}
	return false
}

// weaponBonus is what permanent Strike upgrades and the floor add to every damaging skill.
func weaponBonus(run *Run, player *PlayerState) int {
	strike := player.StrikeDamage
	if strike == 0 {
		strike = PlayerStrikeDamage
	}
	return strike - PlayerStrikeDamage + floorRulesFor(run).PlayerStrike
}

func (cast *skillCast) applyEnemyEffect(effect SkillEffect, riders []SkillEffect, enemy *Enemy) {
	if enemy.Health <= 0 {
		return
	}
	run, round := cast.run, cast.round
	switch effect.Kind {
	case EffectDamage, EffectCounter:
		cast.strike(effect, riders, enemy)
	case EffectInterrupt:
		switch {
		case enemy.Intent == nil:
			addCombatEvent(run, round, "skill_miss", cast.name()+" finds nothing to interrupt on "+enemy.Name+".")
		case enemy.Intent.Interruptible:
			label := enemy.Intent.Label
			enemy.Intent = nil
			addCombatImpact(run, round, "player_interrupt", cast.name()+" interrupts "+label+" from "+enemy.Name+"!", "", enemy.ID, "enemy", 0)
			if bonus := classPassiveEffects(cast.player, enemy, nil).InterruptDamage; bonus > 0 {
				transition := resolveHealthDamage(enemy.Health, bonus)
				enemy.Health = transition.Health
				addCombatImpact(run, round, "player_interrupt_damage", enemy.Name+" takes "+itoa(transition.Applied)+" interrupt damage.", "damage", enemy.ID, "enemy", transition.Applied)
				cast.checkDefeated(enemy)
			}
		case effect.Amount > 0:
			cast.weaken(enemy, effect.Amount, enemy.Intent.Label+" cannot be interrupted, but "+cast.name()+" blunts it")
		default:
			addCombatEvent(run, round, "skill_miss", enemy.Name+"'s "+enemy.Intent.Label+" cannot be interrupted.")
		}
	case EffectWeaken:
		if enemy.Intent != nil && enemy.Intent.Damage > 0 {
			cast.weaken(enemy, effect.Amount, cast.name()+" weakens "+enemy.Name+"'s "+enemy.Intent.Label)
		}
	case EffectStun:
		if effect.Rounds > enemy.Stun {
			enemy.Stun = effect.Rounds
		}
		if isBossEnemy(enemy) {
			addCombatImpact(run, round, "skill_control", cast.name()+" staggers "+enemy.Name+": its next move hits for half.", "", enemy.ID, "enemy", 0)
		} else {
			addCombatImpact(run, round, "skill_control", cast.name()+" stuns "+enemy.Name+": it loses its next turn.", "", enemy.ID, "enemy", 0)
		}
	case EffectMark:
		enemy.MarkedDamage += effect.Amount
		addCombatImpact(run, round, "skill_mark", cast.name()+" marks "+enemy.Name+": the next hit on it deals "+itoa(enemy.MarkedDamage)+" more.", "", enemy.ID, "enemy", 0)
	case EffectBleed:
		if effect.Amount > enemy.Bleed {
			enemy.Bleed = effect.Amount
		}
		if effect.Rounds > enemy.BleedRounds {
			enemy.BleedRounds = effect.Rounds
		}
		addCombatImpact(run, round, "skill_bleed", cast.name()+" leaves "+enemy.Name+" bleeding for "+itoa(enemy.Bleed)+" a round.", "", enemy.ID, "enemy", 0)
	case EffectTaunt:
		enemy.TauntedBy = cast.player.ID
		if rounds := effect.Rounds - 1; rounds > enemy.TauntRounds {
			enemy.TauntRounds = rounds
		}
		if enemy.Intent != nil && !enemy.Intent.TargetAll && enemy.Intent.Damage > 0 && enemy.Intent.TargetPlayerID != cast.player.ID {
			enemy.Intent.TargetPlayerID = cast.player.ID
		}
	}
}

func (cast *skillCast) announceTaunt(effect SkillEffect) {
	addCombatEvent(cast.run, cast.round, "skill_taunt", cast.name()+" draws every single-target attack onto "+adventurerLabel(cast.room, cast.player.ID)+".")
}

func (cast *skillCast) weaken(enemy *Enemy, amount int, message string) {
	before := enemy.Intent.Damage
	enemy.Intent.Damage -= amount
	if enemy.Intent.Damage < 0 {
		enemy.Intent.Damage = 0
	}
	addCombatImpact(cast.run, cast.round, "skill_weaken", message+" by "+itoa(before-enemy.Intent.Damage)+".", "", enemy.ID, "enemy", 0)
}

// strike deals one damage effect to one enemy.
func criticalHit(run *Run, player *PlayerState, enemy *Enemy, round int) bool {
	if run == nil || player == nil || enemy == nil {
		return false
	}
	// A stable per-action roll keeps live play and seeded simulations reproducible.
	seed := run.Seed ^ uint64(round*7919)
	for _, value := range []byte(player.ID + ":" + enemy.ID) {
		seed = seed*1099511628211 ^ uint64(value)
	}
	chance := 6 + player.Level*2
	if chance > 16 {
		chance = 16
	}
	return seed%100 < uint64(chance)
}

func (cast *skillCast) strike(effect SkillEffect, riders []SkillEffect, enemy *Enemy) {
	player, run := cast.player, cast.run
	base := effect.Amount + statValue(player, effect.Stat)
	if effect.Kind == EffectCounter {
		taken := player.ClassCombat.DamageTakenLastRound
		if taken > effect.Cap {
			taken = effect.Cap
		}
		base = effect.Amount + taken
	}
	bonus := 0
	for _, condition := range append([]SkillEffect{effect}, riders...) {
		if condition.Bonus > 0 && conditionHolds(condition.When, player, enemy) {
			bonus += condition.Bonus
		}
	}
	passive := classPassiveEffects(player, enemy, nil)
	bonus += passive.AttackDamage + player.ClassCombat.Empower + boonStrikeBonus(player, cast.encounter)
	if cast.definition.Elemental {
		bonus += passive.ElementalDamage
	}
	attack := resolveAttackDamage(AttackDamageInput{
		BaseDamage:          base + weaponBonus(run, player),
		BonusDamage:         bonus,
		MarkedDamage:        enemy.MarkedDamage,
		IncludeMarkedDamage: true,
		ConsumeMarkedDamage: true,
		ResolveReady:        player.ClassCombat.ResolveReady,
		UseResolve:          true,
		ResolveBonus:        ResolveBonus,
		StrikeBonus:         defaultRunEffectCatalog.StrikeBonus(run, run.CurrentRoomID),
	})
	enemy.MarkedDamage = attack.RemainingMarkedDamage
	player.ClassCombat.ResolveReady = attack.ResolveReady
	cast.struck = true
	critical := criticalHit(run, player, enemy, cast.round)
	damage := attack.Damage
	if critical {
		damage = (damage*3 + 1) / 2
	}
	damage = boonDamageMultiplier(player, enemy, damage)
	if damage < 1 {
		damage = 1
	}
	var encounter *Encounter
	if current := run.Rooms[run.CurrentRoomID]; current != nil {
		encounter = current.Encounter
	}
	damage = traitDamageTaken(run, encounter, enemy, damage, cast.round, true)
	if cast.definition.Basic {
		damage = absorbWithBarrier(run, enemy, damage, cast.round)
		applySpikes(cast.room, player, enemy, cast.round)
	}
	transition := resolveHealthDamage(enemy.Health, damage)
	enemy.Health = transition.Health
	cast.dealt += transition.Applied
	kind := "skill_damage"
	if cast.definition.Basic {
		kind = "player_attack"
	}
	message := cast.name() + " hits " + enemy.Name + " for " + itoa(transition.Applied) + " damage."
	if critical {
		message = "CRITICAL! " + message
	}
	addCombatImpact(run, cast.round, kind, message, "damage", enemy.ID, "enemy", transition.Applied)
	run.LastCombatEvents[len(run.LastCombatEvents)-1].Critical = critical
	cast.checkDefeated(enemy)
}

func (cast *skillCast) checkDefeated(enemy *Enemy) {
	if enemy.Health == 0 {
		enemy.Intent = nil
		addCombatEvent(cast.run, cast.round, "enemy_defeated", enemy.Name+" is defeated. Its attack is stopped.")
	}
}

func (cast *skillCast) applyPlayerEffect(effect SkillEffect, target *PlayerState) {
	if target == nil {
		return
	}
	run, round, room := cast.run, cast.round, cast.room
	who := adventurerLabel(room, target.ID)
	if target.Health <= 0 && effect.Kind != EffectRevive {
		return
	}
	switch effect.Kind {
	case EffectGuard:
		target.Guarding = true
		target.ClassCombat.GuardBonus += effect.Amount
		addCombatImpact(run, round, "skill_guard", cast.name()+" guards "+who+", blocking up to "+itoa(guardFor(room, target))+" from the next hit.", "", target.ID, "player", 0)
	case EffectWard:
		if effect.Amount > target.ClassCombat.Ward {
			target.ClassCombat.Ward = effect.Amount
		}
		if effect.Reflect > target.ClassCombat.WardReflect {
			target.ClassCombat.WardReflect = effect.Reflect
		}
		addCombatImpact(run, round, "skill_ward", cast.name()+" wards "+who+" against the next "+itoa(target.ClassCombat.Ward)+" damage.", "", target.ID, "player", 0)
	case EffectThorns:
		target.ClassCombat.Thorns += effect.Amount
		addCombatImpact(run, round, "skill_thorns", cast.name()+" bristles: anything that hits "+who+" this round takes "+itoa(target.ClassCombat.Thorns)+".", "", target.ID, "player", 0)
	case EffectHeal:
		cast.heal(target, effect.Amount+statValue(cast.player, effect.Stat))
	case EffectRegen:
		if effect.Amount > target.ClassCombat.Regen {
			target.ClassCombat.Regen = effect.Amount
		}
		if effect.Rounds > target.ClassCombat.RegenRounds {
			target.ClassCombat.RegenRounds = effect.Rounds
		}
		addCombatImpact(run, round, "skill_regen", cast.name()+" will restore "+itoa(target.ClassCombat.Regen)+" health to "+who+" each round.", "", target.ID, "player", 0)
	case EffectEmpower:
		target.ClassCombat.Empower += effect.Amount
		if target.ClassCombat.Empower > MaxEmpower {
			target.ClassCombat.Empower = MaxEmpower
		}
		addCombatImpact(run, round, "skill_empower", cast.name()+" empowers "+who+": their next damaging skill deals "+itoa(target.ClassCombat.Empower)+" more.", "", target.ID, "player", 0)
	case EffectLifesteal:
		if amount := cast.dealt * effect.Amount / 100; amount > 0 {
			cast.heal(cast.player, amount)
		}
	case EffectRevive:
		if target.Health > 0 {
			return
		}
		health := target.MaxHealth * effect.Amount / 100
		if health < 1 {
			health = 1
		}
		target.Health = health
		addCombatImpact(run, round, "player_revived", cast.name()+" brings "+who+" back to the fight with "+itoa(health)+" health!", "heal", target.ID, "player", health)
	case EffectHasten:
		for id, rounds := range target.ClassCombat.Cooldowns {
			if id == cast.definition.ID {
				continue
			}
			if rounds -= effect.Amount; rounds > 0 {
				target.ClassCombat.Cooldowns[id] = rounds
			} else {
				delete(target.ClassCombat.Cooldowns, id)
			}
		}
		addCombatImpact(run, round, "skill_hasten", cast.name()+" hurries "+who+": every skill recovers "+itoa(effect.Amount)+" round"+plural(effect.Amount)+" sooner.", "", target.ID, "player", 0)
	}
}

func (cast *skillCast) heal(target *PlayerState, amount int) {
	transition := resolveHealthHealing(target.Health, target.MaxHealth, floorRulesFor(cast.run).healing(amount))
	target.Health = transition.Health
	who := adventurerLabel(cast.room, target.ID)
	if transition.Applied > 0 {
		addCombatImpact(cast.run, cast.round, "skill_heal", cast.name()+" restores "+itoa(transition.Applied)+" health to "+who+".", "heal", target.ID, "player", transition.Applied)
	} else {
		addCombatEvent(cast.run, cast.round, "skill_heal", cast.name()+" finds "+who+" already at full health.")
	}
}

// guardFor is how much a guarding adventurer blocks from the next hit.
func guardFor(room *Room, player *PlayerState) int {
	guard := player.GuardReduction
	if guard <= 0 {
		guard = GuardDamageReduction
	}
	return guard + player.ClassCombat.GuardBonus + floorRulesFor(room.Run).PlayerGuard
}

// defend is Defend, whether chosen or taken automatically when the round's timer runs out.
func defend(room *Room, player *PlayerState, chosen bool, round int) {
	run := room.Run
	player.Guarding = true
	message := adventurerLabel(room, player.ID) + " braces, blocking up to " + itoa(guardFor(room, player)) + " damage from the next hit."
	if !chosen {
		message = adventurerLabel(room, player.ID) + " ran out of time and defends automatically, blocking up to " + itoa(guardFor(room, player)) + " damage from the next hit."
	}
	addCombatEvent(run, round, "player_defend", message)
	last := &run.LastCombatEvents[len(run.LastCombatEvents)-1]
	last.ActorID = player.ID
	last.Auto = !chosen
}

// isBossEnemy reports whether an enemy is a boss: bosses are staggered rather than stunned.
func isBossEnemy(enemy *Enemy) bool {
	if len(enemy.Mechanics) > 0 {
		return true
	}
	monster, err := defaultMonsterCatalog.Monster(enemy.DefinitionID)
	return err == nil && monster.Role == MonsterRoleBoss
}

// applyEnemyRoundStart resolves a stun or taunt on an enemy whose intent for the new round has just been built.
// It returns the intent the enemy will telegraph, or nil when it loses its turn.
func applyEnemyRoundStart(room *Room, enemy *Enemy, intent *EnemyIntent, round int) *EnemyIntent {
	run := room.Run
	if enemy.Stun > 0 {
		enemy.Stun--
		if !isBossEnemy(enemy) {
			addCombatImpact(run, round, "enemy_stunned", enemy.Name+" is stunned and loses its turn.", "", enemy.ID, "enemy", 0)
			return nil
		}
		if intent != nil && intent.Damage > 0 {
			intent.Damage = (intent.Damage + 1) / 2
		}
		addCombatImpact(run, round, "enemy_stunned", enemy.Name+" is staggered: its move hits for half.", "", enemy.ID, "enemy", 0)
	}
	if enemy.TauntedBy != "" {
		taunter := run.Players[enemy.TauntedBy]
		if enemy.TauntRounds <= 0 || taunter == nil || taunter.Health <= 0 || room.Presence[enemy.TauntedBy].LeftAt != nil {
			enemy.TauntedBy, enemy.TauntRounds = "", 0
		} else {
			if intent != nil && !intent.TargetAll && intent.Damage > 0 {
				intent.TargetPlayerID = enemy.TauntedBy
			}
			enemy.TauntRounds--
			if enemy.TauntRounds == 0 {
				enemy.TauntedBy = ""
			}
		}
	}
	return intent
}

// endCombatRound ticks bleeds and regeneration and counts cooldowns down after every enemy has acted.
func endCombatRound(room *Room, encounter *Encounter, round int) {
	run := room.Run
	applyTraitRegeneration(run, encounter, round)
	for i := range encounter.Enemies {
		enemy := &encounter.Enemies[i]
		if enemy.Health <= 0 || enemy.BleedRounds <= 0 {
			enemy.Bleed, enemy.BleedRounds = 0, 0
			continue
		}
		transition := resolveHealthDamage(enemy.Health, enemy.Bleed)
		enemy.Health = transition.Health
		addCombatImpact(run, round, "bleed", enemy.Name+" bleeds for "+itoa(transition.Applied)+" damage.", "damage", enemy.ID, "enemy", transition.Applied)
		if enemy.BleedRounds--; enemy.BleedRounds == 0 {
			enemy.Bleed = 0
		}
		if enemy.Health == 0 {
			enemy.Intent = nil
			addCombatEvent(run, round, "enemy_defeated", enemy.Name+" bleeds out.")
		}
	}
	applyTraitSplits(run, encounter, round)
	for _, playerID := range eligibleCombatPlayers(room) {
		player := run.Players[playerID]
		if player.ClassCombat.RegenRounds <= 0 {
			continue
		}
		transition := resolveHealthHealing(player.Health, player.MaxHealth, floorRulesFor(run).healing(player.ClassCombat.Regen))
		player.Health = transition.Health
		if transition.Applied > 0 {
			addCombatImpact(run, round, "regen", adventurerLabel(room, playerID)+" regenerates "+itoa(transition.Applied)+" health.", "heal", playerID, "player", transition.Applied)
		}
		if player.ClassCombat.RegenRounds--; player.ClassCombat.RegenRounds == 0 {
			player.ClassCombat.Regen = 0
		}
	}
	for _, player := range run.Players {
		player.Guarding = false
		player.ClassCombat.GuardBonus = 0
		player.ClassCombat.Thorns = 0
		for id, rounds := range player.ClassCombat.Cooldowns {
			if rounds <= 1 {
				delete(player.ClassCombat.Cooldowns, id)
			} else {
				player.ClassCombat.Cooldowns[id] = rounds - 1
			}
		}
	}
}

// resetFightStatuses runs when a fight is won: every skill is ready for the next one, and effects that belong
// to a fight end with it. Wards are kept: they are bought and cast ahead of a fight.
func resetFightStatuses(run *Run) {
	for _, player := range run.Players {
		player.ClassCombat.Cooldowns = nil
		player.ClassCombat.Empower = 0
		player.ClassCombat.Thorns = 0
		player.ClassCombat.Regen = 0
		player.ClassCombat.RegenRounds = 0
		player.ClassCombat.ArcaneCharges = 0
		player.ClassCombat.OathSpent = false
	}
}

// ---- class passives --------------------------------------------------------------------------------------------

func classPassiveEffects(player *PlayerState, enemy *Enemy, intent *EnemyIntent) classPassiveBonuses {
	if player == nil || player.ClassBuild == nil {
		return classPassiveBonuses{}
	}
	passive, ok := findClassPassive(player.ClassBuild.PassiveID)
	if !ok {
		return classPassiveBonuses{}
	}
	definition, ok := defaultClassPassiveEffectCatalog.Effect(passive.EffectID)
	if !ok {
		return classPassiveBonuses{}
	}
	return definition.Resolve(player, enemy, intent)
}

func findLivingEnemy(encounter *Encounter, id string) *Enemy {
	if encounter == nil {
		return nil
	}
	for i := range encounter.Enemies {
		if encounter.Enemies[i].ID == id && encounter.Enemies[i].Health > 0 {
			return &encounter.Enemies[i]
		}
	}
	return nil
}

func applyCompanionInstinct(room *Room, round int) {
	players := eligibleCombatPlayers(room)
	for _, playerID := range players {
		player := room.Run.Players[playerID]
		if !classPassiveHasTrigger(player, ClassPassiveTriggerCompanionInstinct) {
			continue
		}
		var target *PlayerState
		for _, candidateID := range players {
			candidate := room.Run.Players[candidateID]
			if candidate.Health >= candidate.MaxHealth {
				continue
			}
			if target == nil || candidate.Health*target.MaxHealth < target.Health*candidate.MaxHealth {
				target = candidate
			}
		}
		if target == nil {
			continue
		}
		transition := resolveHealthHealing(target.Health, target.MaxHealth, 1)
		target.Health = transition.Health
		if transition.Applied > 0 {
			addCombatImpact(room.Run, round, "companion_instinct", adventurerLabel(room, playerID)+"'s companion tends "+adventurerLabel(room, target.ID)+" for 1 health.", "heal", target.ID, "player", transition.Applied)
		}
	}
}

func onClassGuardBlocked(player *PlayerState, intent EnemyIntent, guarded bool, blocked int) {
	if !guarded || blocked <= 0 || intent.Damage < 7 {
		return
	}
	if classPassiveHasTrigger(player, ClassPassiveTriggerHeavyGuard) {
		player.ClassCombat.ResolveReady = true
	}
}
