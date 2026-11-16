package game

// AttackDamageInput describes the deterministic modifiers applied to one
// player-originated attack. Callers decide eligibility and provide catalog-
// resolved bonuses; this transition owns only arithmetic and consumption.
type AttackDamageInput struct {
	BaseDamage          int
	BonusDamage         int
	MarkedDamage        int
	IncludeMarkedDamage bool
	ConsumeMarkedDamage bool
	ResolveReady        bool
	UseResolve          bool
	ResolveBonus        int
	Telegraph           bool
	TelegraphBonus      int
	StrikeBonus         int
}

// AttackDamageTransition returns the calculated damage and the consumable
// state left after the attack.
type AttackDamageTransition struct {
	Damage                int
	RemainingMarkedDamage int
	ResolveReady          bool
}

func resolveAttackDamage(input AttackDamageInput) AttackDamageTransition {
	damage := input.BaseDamage + input.BonusDamage + input.StrikeBonus
	if input.IncludeMarkedDamage {
		damage += input.MarkedDamage
	}
	if input.UseResolve && input.ResolveReady {
		damage += input.ResolveBonus
	}
	if input.Telegraph {
		damage += input.TelegraphBonus
	}
	remainingMarked := input.MarkedDamage
	if input.ConsumeMarkedDamage {
		remainingMarked = 0
	}
	resolveReady := input.ResolveReady
	if input.UseResolve && input.ResolveReady {
		resolveReady = false
	}
	return AttackDamageTransition{
		Damage:                damage,
		RemainingMarkedDamage: remainingMarked,
		ResolveReady:          resolveReady,
	}
}

// resolveInterruptDamage combines the stat and catalog bonuses for an
// interrupt without deciding whether the target is interruptible.
func resolveInterruptDamage(focus, talentBonus, passiveBonus int) int {
	return focus + talentBonus + passiveBonus
}

// IncomingDamageInput captures the ordered reductions applied to one enemy
// hit. Ward is consumed before guard, matching the live combat rules.
type IncomingDamageInput struct {
	IntentDamage          int
	AgilityReduction      int
	TalentReduction       int
	PassiveReduction      int
	Ward                  int
	WardReflect           int
	Guarding              bool
	GuardReduction        int
	DefaultGuardReduction int
	GuardBonus            int
	TalentGuardReduction  int
	PartyGuardReduction   int
}

// IncomingDamageTransition exposes both final damage and the intermediate
// mitigation/consumption results needed for authoritative feedback and state.
type IncomingDamageTransition struct {
	Damage               int
	Blocked              int
	Guarded              bool
	WardAbsorbed         int
	WardRemaining        int
	WardReflect          int
	WardReflectRemaining int
	GuardBlocked         int
	Guarding             bool
	GuardBonus           int
}

func resolveIncomingDamage(input IncomingDamageInput) IncomingDamageTransition {
	damage := input.IntentDamage - input.AgilityReduction - input.TalentReduction - input.PassiveReduction
	if damage < 0 {
		damage = 0
	}

	result := IncomingDamageTransition{
		Guarded:              input.Guarding,
		WardRemaining:        input.Ward,
		WardReflectRemaining: input.WardReflect,
		Guarding:             input.Guarding,
		GuardBonus:           input.GuardBonus,
	}
	if input.Ward > 0 {
		absorbed := damage
		if absorbed > input.Ward {
			absorbed = input.Ward
		}
		damage -= absorbed
		result.WardAbsorbed = absorbed
		result.WardRemaining = 0
		result.WardReflect = input.WardReflect
		result.WardReflectRemaining = 0
	}

	if input.Guarding {
		reduction := input.GuardReduction
		if reduction <= 0 {
			reduction = input.DefaultGuardReduction
		}
		reduction += input.GuardBonus + input.TalentGuardReduction + input.PartyGuardReduction
		beforeGuard := damage
		damage -= reduction
		if damage < 0 {
			damage = 0
		}
		result.GuardBlocked = beforeGuard - damage
		result.Guarding = false
		result.GuardBonus = 0
	}

	result.Damage = damage
	result.Blocked = input.IntentDamage - damage
	return result
}

// resolveEnemyIntent converts a catalog-selected ability into the immutable
// telegraph for this turn. Target rotation is deterministic over the already
// sorted eligible-player list supplied by the authoritative room flow.
func resolveEnemyIntent(ability AbilityDefinition, roundNumber, enemyIndex int, players []string) *EnemyIntent {
	intent := &EnemyIntent{
		Kind:          ability.Kind,
		Label:         ability.Label,
		Damage:        ability.Damage,
		Heal:          ability.Heal,
		TargetAll:     ability.TargetAll,
		Interruptible: ability.Interruptible,
	}
	if !intent.TargetAll && len(players) > 0 {
		targetIndex := (roundNumber + enemyIndex) % len(players)
		intent.TargetPlayerID = players[targetIndex]
	}
	return intent
}

func buildEnemyIntent(enemy *Enemy, roundNumber, enemyIndex int, players []string) *EnemyIntent {
	ability, err := defaultMonsterCatalog.SelectAbility(enemy.Behavior, roundNumber)
	if err != nil {
		// Persisted runs may contain legacy/unknown behavior IDs. Keep their
		// historical fallback until the explicit content-version migration.
		ability = AbilityDefinition{Kind: "strike", Label: "Strike", Damage: 4}
	}
	intent := resolveEnemyIntent(ability, roundNumber, enemyIndex, players)
	if len(players) > 1 {
		damageMultiplier := 1 + float64(len(players)-1)*PartyEnemyDamageMultiplierStep
		intent.Damage = int(float64(intent.Damage)*damageMultiplier + 0.5)
	}
	return intent
}
