package game

// HealthTransition is the deterministic result of applying a health change.
// Applied is the effective amount after clamping, not the requested amount.
type HealthTransition struct {
	Health  int
	Applied int
}

// resolveHealthDamage applies non-negative damage without allowing health below
// zero. It is pure so live combat and simulations share identical arithmetic.
func resolveHealthDamage(currentHealth, requestedDamage int) HealthTransition {
	if currentHealth <= 0 {
		return HealthTransition{Health: 0}
	}
	if requestedDamage < 0 {
		requestedDamage = 0
	}
	applied := requestedDamage
	if applied > currentHealth {
		applied = currentHealth
	}
	return HealthTransition{Health: currentHealth - applied, Applied: applied}
}

// resolveHealthHealing applies healing up to maxHealth. Eligibility (for
// example, whether a target is alive or present) remains the caller's concern.
func resolveHealthHealing(currentHealth, maxHealth, requestedHealing int) HealthTransition {
	if requestedHealing < 0 {
		requestedHealing = 0
	}
	health := currentHealth + requestedHealing
	if health > maxHealth {
		health = maxHealth
	}
	if health < currentHealth {
		health = currentHealth
	}
	return HealthTransition{Health: health, Applied: health - currentHealth}
}
