package game

import "fmt"

// Monster traits are small rules an ordinary monster fights by, on top of its moves. Each one gives the party
// something to notice and answer, and each is shown on the monster's nameplate:
//
//	bodyguard   while it stands, every hit on its allies deals Amount less damage (at least 1). Drop it first.
//	warder      every Every turns it wraps its most wounded ally (or itself) in a shield of Amount that absorbs
//	            any damage. Shields do not stack: a new one only tops the old one up.
//	regenerate  at the end of every round it heals Amount, unless it is bleeding.
//	spiked      a basic attack against it deals Amount back to the attacker (never a killing blow). Skills
//	            are safe.
//	avenger     the first time one of its allies falls, it gains +Amount damage for the rest of the fight.
//	fuse        on turn Every it detonates for Amount damage to the whole party and is destroyed. Kill it first,
//	            or stun it to put the blast off for a turn.
//	splits      the first time it falls, a copy with Amount% of its health takes its place. The copy does not
//	            split again.
//	phasing     on every second turn it is out of phase and takes half damage from every hit.
const (
	TraitBodyguard  = "bodyguard"
	TraitWarder     = "warder"
	TraitRegenerate = "regenerate"
	TraitSpiked     = "spiked"
	TraitAvenger    = "avenger"
	TraitFuse       = "fuse"
	TraitSplits     = "splits"
	TraitPhasing    = "phasing"
)

// MonsterTrait is one trait of a monster. Amount and Every mean what the trait's rule above says; Label names a
// fuse's detonation in telegraphs and the log.
type MonsterTrait struct {
	Kind   string `json:"kind"`
	Amount int    `json:"amount,omitempty"`
	Every  int    `json:"every,omitempty"`
	Label  string `json:"label,omitempty"`
}

func validateMonsterTraits(monster MonsterDefinition) error {
	seen := make(map[string]bool, len(monster.Traits))
	for _, trait := range monster.Traits {
		if seen[trait.Kind] {
			return fmt.Errorf("monster %q repeats trait %q", monster.ID, trait.Kind)
		}
		seen[trait.Kind] = true
		ok := false
		switch trait.Kind {
		case TraitBodyguard, TraitRegenerate, TraitSpiked, TraitAvenger:
			ok = trait.Amount > 0 && trait.Every == 0
		case TraitWarder:
			ok = trait.Amount > 0 && trait.Every > 1
		case TraitFuse:
			ok = trait.Amount > 0 && trait.Every > 1 && trait.Label != ""
		case TraitSplits:
			ok = trait.Amount > 0 && trait.Amount < 100 && trait.Every == 0
		case TraitPhasing:
			ok = trait.Amount == 0 && trait.Every == 0
		}
		if !ok {
			return fmt.Errorf("monster %q has an unknown or malformed trait %+v", monster.ID, trait)
		}
	}
	return nil
}

func (enemy *Enemy) trait(kind string) (MonsterTrait, bool) {
	for _, trait := range enemy.Traits {
		if trait.Kind == kind {
			return trait, true
		}
	}
	return MonsterTrait{}, false
}

// applyTraitRoundStart resolves the start-of-round traits. It runs after boss mechanics and before intents are
// built, with each enemy's TurnsTaken already advanced for the round that is starting.
func applyTraitRoundStart(room *Room, encounter *Encounter, round int) {
	run := room.Run
	for index := range encounter.Enemies {
		enemy := &encounter.Enemies[index]
		if enemy.Health <= 0 || len(enemy.Traits) == 0 {
			enemy.Phased, enemy.FuseIn = false, 0
			continue
		}
		_, phasing := enemy.trait(TraitPhasing)
		enemy.Phased = phasing && enemy.TurnsTaken%2 == 0
		if fuse, ok := enemy.trait(TraitFuse); ok {
			enemy.FuseIn = fuse.Every - enemy.TurnsTaken
			if enemy.FuseIn < 0 {
				enemy.FuseIn = 0
			}
		}
		if avenger, ok := enemy.trait(TraitAvenger); ok && !enemy.Avenged && anyAllyFallen(encounter, index) {
			enemy.Avenged = true
			enemy.DamageBonus += avenger.Amount
			addCombatImpact(run, round, "trait_avenger", enemy.Name+" swears vengeance for the fallen: every hit it lands deals "+itoa(avenger.Amount)+" more damage.", "", enemy.ID, "enemy", 0)
		}
		if warder, ok := enemy.trait(TraitWarder); ok && enemy.TurnsTaken%warder.Every == 0 {
			ward := wardTarget(encounter, index)
			if ward.Shield < warder.Amount {
				ward.Shield = warder.Amount
				who := ward.Name
				if ward == enemy {
					who = "itself"
				}
				addCombatImpact(run, round, "trait_ward", enemy.Name+" shields "+who+": the next "+itoa(warder.Amount)+" damage is absorbed.", "block", ward.ID, "enemy", 0)
			}
		}
	}
}

func anyAllyFallen(encounter *Encounter, self int) bool {
	for i := range encounter.Enemies {
		if i != self && encounter.Enemies[i].Health <= 0 {
			return true
		}
	}
	return false
}

// wardTarget is the living ally with the smallest share of its health left, or the warder itself when it is alone.
func wardTarget(encounter *Encounter, self int) *Enemy {
	best := &encounter.Enemies[self]
	for i := range encounter.Enemies {
		ally := &encounter.Enemies[i]
		if i == self || ally.Health <= 0 {
			continue
		}
		if best == &encounter.Enemies[self] || ally.Health*best.MaxHealth < best.Health*ally.MaxHealth {
			best = ally
		}
	}
	return best
}

// traitIntentOverride turns a fused monster's move into its detonation once the fuse has run down.
func traitIntentOverride(enemy *Enemy, intent *EnemyIntent, partySize int) *EnemyIntent {
	fuse, ok := enemy.trait(TraitFuse)
	if !ok || enemy.TurnsTaken < fuse.Every {
		return intent
	}
	damage := fuse.Amount
	if partySize > 1 {
		damage = int(float64(damage)*(1+float64(partySize-1)*PartyEnemyDamageMultiplierStep) + 0.5)
	}
	return &EnemyIntent{Kind: "detonate", Label: fuse.Label, Damage: damage, TargetAll: true}
}

// traitDamageTaken is the damage a hit on an enemy deals after its traits and its allies' traits: out of phase it
// takes half, a standing bodyguard takes some off, and a ward shield absorbs what it can. apply spends the shield
// and logs it; without apply this only estimates.
func traitDamageTaken(run *Run, encounter *Encounter, enemy *Enemy, damage, round int, apply bool) int {
	if damage <= 0 {
		return damage
	}
	if enemy.Phased {
		damage = (damage + 1) / 2
	}
	damage = anchoredDamage(encounter, enemy, damage)
	if encounter != nil {
		guard := 0
		for i := range encounter.Enemies {
			ally := &encounter.Enemies[i]
			if ally == enemy || ally.ID == enemy.ID || ally.Health <= 0 {
				continue
			}
			if bodyguard, ok := ally.trait(TraitBodyguard); ok && bodyguard.Amount > guard {
				guard = bodyguard.Amount
			}
		}
		if guard > 0 {
			damage -= guard
			if damage < 1 {
				damage = 1
			}
		}
	}
	if enemy.Shield > 0 {
		absorbed := damage
		if absorbed > enemy.Shield {
			absorbed = enemy.Shield
		}
		damage -= absorbed
		if apply {
			enemy.Shield -= absorbed
			addCombatImpact(run, round, "trait_shield_absorb", enemy.Name+"'s shield absorbs "+itoa(absorbed)+" damage.", "block", enemy.ID, "enemy", absorbed)
		}
	}
	return damage
}

// applySpikes hurts an adventurer whose basic attack landed on a spiked monster. Spikes never down anyone.
func applySpikes(room *Room, player *PlayerState, enemy *Enemy, round int) {
	spiked, ok := enemy.trait(TraitSpiked)
	if !ok || player.Health <= 1 {
		return
	}
	damage := spiked.Amount
	if damage >= player.Health {
		damage = player.Health - 1
	}
	player.Health -= damage
	player.ClassCombat.DamageTakenThisRound += damage
	addCombatImpact(room.Run, round, "trait_spiked", adventurerLabel(room, player.ID)+" is cut on "+enemy.Name+"'s spikes for "+itoa(damage)+" damage.", "damage", player.ID, "player", damage)
}

// applyTraitRegeneration heals regenerating monsters. It runs before bleeds tick, so a bleeding one does not
// heal. applyTraitSplits runs after the round's deaths and lets splitting monsters split.
func applyTraitRegeneration(run *Run, encounter *Encounter, round int) {
	for i := range encounter.Enemies {
		enemy := &encounter.Enemies[i]
		regenerate, ok := enemy.trait(TraitRegenerate)
		if !ok || enemy.Health <= 0 || enemy.Health >= enemy.MaxHealth {
			continue
		}
		if enemy.BleedRounds > 0 {
			addCombatEvent(run, round, "trait_regen_blocked", enemy.Name+" is bleeding and cannot knit itself back together.")
			continue
		}
		transition := resolveHealthHealing(enemy.Health, enemy.MaxHealth, regenerate.Amount)
		enemy.Health = transition.Health
		if transition.Applied > 0 {
			addCombatImpact(run, round, "trait_regen", enemy.Name+" regenerates "+itoa(transition.Applied)+" health.", "heal", enemy.ID, "enemy", transition.Applied)
		}
	}
}

func applyTraitSplits(run *Run, encounter *Encounter, round int) {
	count := len(encounter.Enemies)
	for i := 0; i < count; i++ {
		enemy := &encounter.Enemies[i]
		splits, ok := enemy.trait(TraitSplits)
		if !ok || enemy.Health > 0 || enemy.Split || len(encounter.Enemies) >= MaxEncounterEnemies {
			continue
		}
		enemy.Split = true
		half := Enemy{
			ID: enemy.ID + "-split", DefinitionID: enemy.DefinitionID, Name: enemy.Name, Behavior: enemy.Behavior, SpriteID: enemy.SpriteID,
			TurnsTaken: enemy.TurnsTaken, Traits: enemy.Traits, Split: true, Summoned: true,
		}
		half.MaxHealth = enemy.MaxHealth * splits.Amount / 100
		if half.MaxHealth < 1 {
			half.MaxHealth = 1
		}
		half.Health = half.MaxHealth
		name := enemy.Name
		encounter.Enemies = append(encounter.Enemies, half)
		addCombatEvent(run, round, "trait_split", name+" splits apart! A smaller one keeps fighting.")
	}
}
