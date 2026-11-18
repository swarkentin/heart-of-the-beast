package game

import (
	"errors"
	"fmt"
	"strings"
)

// Skills are what an adventurer does in combat. Every class has its own list; a player takes up to
// MaxLoadoutSkills of them into a run (the loadout) and can swap them at the camp between two dungeons. New
// skills unlock with class mastery, so playing a class more widens what a run can look like, not how strong a
// single skill is.
//
// A skill is data: a target policy, a cooldown and a list of effects. skill_combat.go interprets the effects
// with the same arithmetic for every class, so a new skill is a catalog row, not new combat code.

const (
	// MaxLoadoutSkills is how many skills fit on the combat bar.
	MaxLoadoutSkills = 6
	// SkillDefend is the shared guard every class knows. It is also what the server does for a player who runs
	// out of time, whether or not it is on their bar.
	SkillDefend = "skill.defend"
)

var (
	ErrInvalidSkill       = errors.New("that skill is not on your bar or its target is invalid")
	ErrSkillCoolingDown   = errors.New("that skill is still recovering")
	ErrInvalidLoadout     = errors.New("a loadout needs one to six different skills of your class, including one that never needs to recover")
	ErrSkillLocked        = errors.New("that skill is not unlocked yet: keep playing this class to earn it")
	ErrLoadoutUnavailable = errors.New("skills can only be changed in the lobby or at the camp between two dungeons")
)

// SkillTarget says what a skill is aimed at.
type SkillTarget string

const (
	SkillTargetEnemy      SkillTarget = "enemy"       // one living enemy
	SkillTargetAllEnemies SkillTarget = "all_enemies" // every living enemy, no target needed
	SkillTargetSelf       SkillTarget = "self"
	SkillTargetAlly       SkillTarget = "ally"   // one living adventurer, yourself when no target is given
	SkillTargetParty      SkillTarget = "party"  // every living adventurer
	SkillTargetFallen     SkillTarget = "fallen" // one downed ally
)

// SkillEffectKind is one thing a skill does. Effects apply in order, so a lifesteal after a damage effect heals
// from the damage just dealt.
type SkillEffectKind string

const (
	// Enemy effects.
	EffectDamage    SkillEffectKind = "damage"    // Amount + Stat (+ Bonus When ...)
	EffectCounter   SkillEffectKind = "counter"   // Amount + the damage you took last round, that part capped at Cap
	EffectInterrupt SkillEffectKind = "interrupt" // cancels an interruptible move; any other move is weakened by Amount
	EffectWeaken    SkillEffectKind = "weaken"    // the target's telegraphed move deals Amount less
	EffectStun      SkillEffectKind = "stun"      // the target loses its next Rounds turns; a boss is staggered instead
	EffectMark      SkillEffectKind = "mark"      // the next party hit on the target deals Amount more
	EffectBleed     SkillEffectKind = "bleed"     // Amount damage at the end of each of the next Rounds rounds
	EffectTaunt     SkillEffectKind = "taunt"     // single-target moves turn on the caster, this round and Rounds-1 more
	// Adventurer effects.
	EffectGuard     SkillEffectKind = "guard"     // guard against the next hit, Amount more than a Defend
	EffectWard      SkillEffectKind = "ward"      // absorb the next Amount damage, reflecting Reflect when it absorbs
	EffectThorns    SkillEffectKind = "thorns"    // reflect Amount to anything that hits the target this round
	EffectHeal      SkillEffectKind = "heal"      // restore Amount + Stat
	EffectRegen     SkillEffectKind = "regen"     // restore Amount at the end of each of the next Rounds rounds
	EffectEmpower   SkillEffectKind = "empower"   // the target's next damaging skill deals Amount more
	EffectLifesteal SkillEffectKind = "lifesteal" // the caster recovers Amount% of the damage this skill dealt
	EffectRevive    SkillEffectKind = "revive"    // a downed ally stands back up with Amount% of their health
	EffectHasten    SkillEffectKind = "hasten"    // the target's other skills recover Amount rounds sooner
)

// Effect scopes override the skill's target for one effect, so a skill can strike a foe and shield the party.
const (
	ScopeSelf       = "self"
	ScopeParty      = "party"
	ScopeAllEnemies = "all_enemies"
)

// Conditions for an effect's Bonus.
const (
	WhenWounded      = "wounded"      // the target is at or below half health
	WhenTelegraphing = "telegraphing" // the target has a move telegraphed
	WhenSelfWounded  = "self_wounded" // the caster is at or below half health
)

type SkillEffect struct {
	Kind    SkillEffectKind `json:"kind"`
	Amount  int             `json:"amount,omitempty"`
	Stat    string          `json:"stat,omitempty"`
	Rounds  int             `json:"rounds,omitempty"`
	Bonus   int             `json:"bonus,omitempty"`
	When    string          `json:"when,omitempty"`
	Cap     int             `json:"cap,omitempty"`
	Reflect int             `json:"reflect,omitempty"`
	Scope   string          `json:"scope,omitempty"`
}

// SkillDefinition is one skill. ClassID is empty for a skill every class shares.
type SkillDefinition struct {
	ID          string `json:"id"`
	ClassID     string `json:"classId,omitempty"`
	Name        string `json:"name"`
	Description string `json:"description"`
	// Rules is the exact rule text, generated from Effects so it can never drift from what the skill does.
	Rules string `json:"rules"`
	// Icon and Tone are presentation hints for the combat bar.
	Icon         string      `json:"icon"`
	Tone         string      `json:"tone"`
	Target       SkillTarget `json:"target"`
	Cooldown     int         `json:"cooldown,omitempty"`
	MasteryLevel int         `json:"masteryLevel"`
	// Basic marks a class's plain weapon attack. Basic attacks scale with permanent Strike upgrades like every
	// damaging skill, but they are the only damage a boss barrier absorbs.
	Basic bool `json:"basic,omitempty"`
	// Elemental skills build and spend the Arcanist's Arcane Focus.
	Elemental bool          `json:"elemental,omitempty"`
	Effects   []SkillEffect `json:"effects"`
}

func dmg(amount int, stat string) SkillEffect {
	return SkillEffect{Kind: EffectDamage, Amount: amount, Stat: stat}
}
func dmgWhen(amount int, stat string, bonus int, when string) SkillEffect {
	return SkillEffect{Kind: EffectDamage, Amount: amount, Stat: stat, Bonus: bonus, When: when}
}
func interrupt(weaken int) SkillEffect { return SkillEffect{Kind: EffectInterrupt, Amount: weaken} }
func weaken(amount int) SkillEffect    { return SkillEffect{Kind: EffectWeaken, Amount: amount} }
func stun(rounds int) SkillEffect      { return SkillEffect{Kind: EffectStun, Rounds: rounds} }
func mark(amount int) SkillEffect      { return SkillEffect{Kind: EffectMark, Amount: amount} }
func bleed(amount, rounds int) SkillEffect {
	return SkillEffect{Kind: EffectBleed, Amount: amount, Rounds: rounds}
}
func taunt(rounds int) SkillEffect { return SkillEffect{Kind: EffectTaunt, Rounds: rounds} }
func guard(amount int) SkillEffect { return SkillEffect{Kind: EffectGuard, Amount: amount} }
func ward(amount, reflect int) SkillEffect {
	return SkillEffect{Kind: EffectWard, Amount: amount, Reflect: reflect}
}
func thorns(amount int) SkillEffect { return SkillEffect{Kind: EffectThorns, Amount: amount} }
func heal(amount int, stat string) SkillEffect {
	return SkillEffect{Kind: EffectHeal, Amount: amount, Stat: stat}
}
func regen(amount, rounds int) SkillEffect {
	return SkillEffect{Kind: EffectRegen, Amount: amount, Rounds: rounds}
}
func empower(amount int) SkillEffect    { return SkillEffect{Kind: EffectEmpower, Amount: amount} }
func lifesteal(percent int) SkillEffect { return SkillEffect{Kind: EffectLifesteal, Amount: percent} }
func revive(percent int) SkillEffect    { return SkillEffect{Kind: EffectRevive, Amount: percent} }
func hasten(rounds int) SkillEffect     { return SkillEffect{Kind: EffectHasten, Amount: rounds} }
func counter(amount, cap int) SkillEffect {
	return SkillEffect{Kind: EffectCounter, Amount: amount, Cap: cap}
}
func on(scope string, effect SkillEffect) SkillEffect {
	effect.Scope = scope
	return effect
}

const (
	statPower   = "power"
	statFocus   = "focus"
	statAgility = "agility"
)

// skill builds a catalog row. Effects follow the options.
func skill(classID, id, name string, mastery int, target SkillTarget, cooldown int, icon, tone, description string, effects ...SkillEffect) SkillDefinition {
	return SkillDefinition{ID: id, ClassID: classID, Name: name, MasteryLevel: mastery, Target: target, Cooldown: cooldown, Icon: icon, Tone: tone, Description: description, Effects: effects}
}

func basic(definition SkillDefinition) SkillDefinition {
	definition.Basic = true
	return definition
}

func elemental(definition SkillDefinition) SkillDefinition {
	definition.Elemental = true
	return definition
}

// Unlock ladder. Mastery 1 opens three class skills and Defend; ranks 2, 3, 5, 8, 10, 12 and 15 add one each.
// Armour and dyes unlock at 2, 3, 4, 6, 7, 9, 11, 16 and 20 (class_skins.go), so almost every rank to 12 brings
// something. A bar fills at rank 3; from rank 5 on there are more skills than slots and every run is a choice.
var skillUnlockRanks = []int{2, 3, 5, 8, 10, 12, 15}

// BasicAttackDamage is a basic attack's base, before its stat: the same as a Strike always was.
const BasicAttackDamage = PlayerStrikeDamage

// The catalog. Cooldown N means the skill can next be used N rounds after the one it was used in.
// Interrupts are deliberately on cooldowns of two or more: a party that wants to answer every telegraph has to
// bring more than one, or plan around which ones it lets through.
var skillCatalog = []SkillDefinition{
	skill("", SkillDefend, "Defend", 1, SkillTargetSelf, 0, "guard", "guard", "Brace yourself. This is also what you do when the timer runs out.", guard(0)),

	// ---- Bulwark: holds the line and protects allies. ----
	basic(skill(ClassBulwark, "bulwark.mace-strike", "Mace Strike", 1, SkillTargetEnemy, 0, "strike", "strike", "A heavy, dependable blow.", dmg(BasicAttackDamage, statPower))),
	skill(ClassBulwark, "bulwark.shield-wall", "Shield Wall", 1, SkillTargetSelf, 1, "guard", "guard", "Plant the tower shield and recover behind it.", guard(6), regen(2, 2)),
	skill(ClassBulwark, "bulwark.challenge", "Challenge", 2, SkillTargetSelf, 2, "threat", "control", "Bang the shield and dare them. Every single-target attack this round turns on you.", taunt(1), guard(2)),
	skill(ClassBulwark, "bulwark.shield-bash", "Shield Bash", 1, SkillTargetEnemy, 3, "control", "control", "Slam the shield rim into a foe mid-motion.", dmg(3, statPower), interrupt(2)),
	skill(ClassBulwark, "bulwark.intervene", "Intervene", 3, SkillTargetAlly, 2, "guard", "support", "Step in front of an ally.", guard(8)),
	skill(ClassBulwark, "bulwark.rallying-banner", "Rallying Banner", 5, SkillTargetParty, 3, "support", "support", "Plant the banner; the whole line braces.", guard(3)),
	skill(ClassBulwark, "bulwark.spiked-bulwark", "Spiked Bulwark", 8, SkillTargetSelf, 3, "ward", "guard", "Every spike on the shield is a promise.", guard(4), thorns(4)),
	skill(ClassBulwark, "bulwark.shield-slam", "Shield Slam", 10, SkillTargetEnemy, 4, "control", "control", "A full-weight slam that leaves the target reeling.", dmg(6, statPower), stun(1)),
	skill(ClassBulwark, "bulwark.last-stand", "Last Stand", 12, SkillTargetSelf, 6, "life", "guard", "Refuse to fall.", heal(8, statPower), guard(10)),
	skill(ClassBulwark, "bulwark.unbroken-citadel", "Unbroken Citadel", 15, SkillTargetParty, 6, "ward", "support", "Become the wall. The party shelters behind you while every foe is forced to face you.", ward(6, 0), on(ScopeAllEnemies, taunt(2))),

	// ---- Juggernaut: turns punishment into retaliation. ----
	basic(skill(ClassJuggernaut, "juggernaut.hammer-swing", "Hammer Swing", 1, SkillTargetEnemy, 0, "strike", "strike", "A huge, honest swing.", dmg(BasicAttackDamage, statPower))),
	skill(ClassJuggernaut, "juggernaut.reckoning", "Reckoning", 1, SkillTargetEnemy, 1, "damage", "strike", "Return every bruise you took last round.", counter(4, 12)),
	skill(ClassJuggernaut, "juggernaut.brutal-sweep", "Brutal Sweep", 1, SkillTargetAllEnemies, 2, "damage", "strike", "A wide arc through everything in reach.", dmg(2, statPower)),
	skill(ClassJuggernaut, "juggernaut.blood-frenzy", "Blood Frenzy", 2, SkillTargetEnemy, 3, "life", "strike", "Wade in and drink the fight.", dmg(8, statPower), lifesteal(50)),
	skill(ClassJuggernaut, "juggernaut.intimidating-roar", "Intimidating Roar", 3, SkillTargetAllEnemies, 3, "threat", "control", "A roar that makes the bravest flinch, then look at you.", weaken(3), taunt(1)),
	skill(ClassJuggernaut, "juggernaut.headbutt", "Headbutt", 5, SkillTargetEnemy, 4, "control", "control", "Crude. Effective.", dmg(2, statPower), interrupt(3)),
	skill(ClassJuggernaut, "juggernaut.unstoppable", "Unstoppable", 8, SkillTargetSelf, 4, "empower", "guard", "Shrug off the next blow and come back harder.", ward(8, 0), empower(6)),
	skill(ClassJuggernaut, "juggernaut.earthshaker", "Earthshaker", 10, SkillTargetAllEnemies, 6, "control", "control", "Bring the hammer down on the floor itself.", dmg(3, statPower), stun(1)),
	skill(ClassJuggernaut, "juggernaut.rampage", "Rampage", 12, SkillTargetEnemy, 4, "damage", "strike", "Finish what you started.", dmgWhen(10, statPower, 6, WhenWounded), dmgWhen(0, "", 4, WhenSelfWounded)),
	skill(ClassJuggernaut, "juggernaut.colossal-wrath", "Colossal Wrath", 15, SkillTargetEnemy, 5, "damage", "strike", "Everything they did to you, at once.", counter(8, 24)),

	// ---- Spellguard: wards, resistance and spell-breaking. ----
	basic(skill(ClassSpellguard, "spellguard.rune-cut", "Rune Cut", 1, SkillTargetEnemy, 0, "strike", "strike", "A quick cut with an etched blade.", dmg(BasicAttackDamage, statPower))),
	skill(ClassSpellguard, "spellguard.runic-ward", "Runic Ward", 1, SkillTargetSelf, 1, "ward", "guard", "A ward that drinks a blow and spits some back.", ward(7, 2)),
	skill(ClassSpellguard, "spellguard.spell-break", "Spell Break", 1, SkillTargetEnemy, 3, "control", "control", "Unpick a move before it lands.", dmg(2, statFocus), interrupt(3)),
	skill(ClassSpellguard, "spellguard.aegis-link", "Aegis Link", 2, SkillTargetAlly, 2, "ward", "support", "Tie a ward to an ally.", ward(6, 1)),
	skill(ClassSpellguard, "spellguard.arcane-rebuke", "Arcane Rebuke", 3, SkillTargetEnemy, 2, "arcane", "strike", "Punish anything that dares to wind up.", dmgWhen(6, statFocus, 4, WhenTelegraphing)),
	skill(ClassSpellguard, "spellguard.sigil-of-binding", "Sigil of Binding", 5, SkillTargetEnemy, 4, "control", "control", "A sigil that holds a foe in place and lays it open.", stun(1), mark(3)),
	skill(ClassSpellguard, "spellguard.mirror-ward", "Mirror Ward", 8, SkillTargetParty, 4, "ward", "support", "Every adventurer gets a sliver of mirror.", ward(4, 1)),
	skill(ClassSpellguard, "spellguard.nullfield", "Nullfield", 10, SkillTargetAllEnemies, 4, "control", "control", "Magic, muscle and malice all go quiet.", weaken(4)),
	skill(ClassSpellguard, "spellguard.runeblade-storm", "Runeblade Storm", 12, SkillTargetAllEnemies, 4, "arcane", "strike", "The runes leave the blade and keep cutting.", dmg(3, statFocus)),
	skill(ClassSpellguard, "spellguard.starforged-aegis", "Starforged Aegis", 15, SkillTargetParty, 6, "ward", "support", "A dome of starlight over the party, and every eye on you.", ward(8, 2), on(ScopeAllEnemies, taunt(1))),

	// ---- Assassin: openings, bleeding and the finishing blow. ----
	basic(skill(ClassAssassin, "assassin.twin-slash", "Twin Slash", 1, SkillTargetEnemy, 0, "strike", "strike", "Two quick cuts.", dmg(BasicAttackDamage, statAgility))),
	skill(ClassAssassin, "assassin.exploit-weakness", "Exploit Weakness", 1, SkillTargetEnemy, 1, "damage", "strike", "Find the gap in the guard.", dmgWhen(6, statAgility, 4, WhenWounded), dmgWhen(0, "", 3, WhenTelegraphing)),
	skill(ClassAssassin, "assassin.smoke-step", "Smoke Step", 1, SkillTargetSelf, 2, "agility", "guard", "Vanish, reappear somewhere better.", guard(5), empower(3)),
	skill(ClassAssassin, "assassin.throat-jab", "Throat Jab", 2, SkillTargetEnemy, 3, "control", "control", "Nobody finishes a spell with a crushed windpipe.", dmg(2, statAgility), interrupt(2)),
	skill(ClassAssassin, "assassin.rupture", "Rupture", 3, SkillTargetEnemy, 2, "poison", "strike", "A shallow cut that will not close.", dmg(2, statAgility), bleed(4, 3)),
	skill(ClassAssassin, "assassin.fan-of-knives", "Fan of Knives", 5, SkillTargetAllEnemies, 3, "damage", "strike", "Every knife you own, all at once.", dmg(2, statAgility)),
	skill(ClassAssassin, "assassin.ambush", "Ambush", 8, SkillTargetEnemy, 4, "control", "control", "Strike from behind; it will not know where to turn.", dmg(6, statAgility), stun(1)),
	skill(ClassAssassin, "assassin.mark-for-death", "Mark for Death", 10, SkillTargetEnemy, 3, "threat", "control", "Show the party exactly where to hit.", mark(8)),
	skill(ClassAssassin, "assassin.death-blossom", "Death Blossom", 12, SkillTargetAllEnemies, 4, "poison", "strike", "A spinning flurry that leaves everything bleeding.", dmg(2, ""), bleed(3, 3)),
	skill(ClassAssassin, "assassin.assassinate", "Assassinate", 15, SkillTargetEnemy, 5, "damage", "strike", "One perfect strike.", dmgWhen(11, statAgility, 12, WhenWounded)),

	// ---- Arcanist: elemental damage and control. ----
	elemental(basic(skill(ClassArcanist, "arcanist.arcane-bolt", "Arcane Bolt", 1, SkillTargetEnemy, 0, "arcane", "strike", "A bolt of raw magic.", dmg(BasicAttackDamage, statFocus)))),
	elemental(skill(ClassArcanist, "arcanist.fireball", "Fireball", 1, SkillTargetEnemy, 1, "arcane", "strike", "Simple, loud, effective.", dmg(9, statFocus))),
	elemental(skill(ClassArcanist, "arcanist.frost-surge", "Frost Surge", 1, SkillTargetEnemy, 3, "control", "control", "Freeze a foe mid-motion.", dmg(1, statFocus), interrupt(3))),
	elemental(skill(ClassArcanist, "arcanist.ignite", "Ignite", 2, SkillTargetEnemy, 2, "poison", "strike", "Set it alight and let it burn.", bleed(4, 3))),
	elemental(skill(ClassArcanist, "arcanist.chain-lightning", "Chain Lightning", 3, SkillTargetAllEnemies, 3, "arcane", "strike", "Lightning that jumps from foe to foe.", dmg(2, statFocus))),
	skill(ClassArcanist, "arcanist.mana-shield", "Mana Shield", 5, SkillTargetSelf, 3, "ward", "guard", "Spend magic as armour.", ward(8, 0)),
	elemental(skill(ClassArcanist, "arcanist.deep-freeze", "Deep Freeze", 8, SkillTargetEnemy, 4, "control", "control", "Encase it in ice.", dmg(3, statFocus), stun(1))),
	skill(ClassArcanist, "arcanist.empowerment", "Empowerment", 10, SkillTargetAlly, 3, "empower", "support", "Lend an ally a spark of your power.", empower(6)),
	elemental(skill(ClassArcanist, "arcanist.meteor", "Meteor", 12, SkillTargetAllEnemies, 5, "arcane", "strike", "Call down the sky.", dmg(6, statFocus))),
	skill(ClassArcanist, "arcanist.time-warp", "Time Warp", 15, SkillTargetParty, 8, "arcane", "support", "Bend the moment. Everyone's skills come back sooner.", hasten(2)),

	// ---- Ranger: precise ranged damage and disruption. ----
	basic(skill(ClassRanger, "ranger.quick-shot", "Quick Shot", 1, SkillTargetEnemy, 0, "strike", "strike", "Nock, draw, loose.", dmg(BasicAttackDamage, statAgility))),
	skill(ClassRanger, "ranger.pinning-shot", "Pinning Shot", 1, SkillTargetEnemy, 3, "control", "control", "Pin a foe before it can follow through.", dmg(3, statAgility), interrupt(3)),
	skill(ClassRanger, "ranger.aimed-shot", "Aimed Shot", 1, SkillTargetEnemy, 2, "damage", "strike", "Take a breath and make it count.", dmg(11, statAgility)),
	skill(ClassRanger, "ranger.volley", "Volley", 2, SkillTargetAllEnemies, 3, "damage", "strike", "A rain of arrows.", dmg(2, statAgility)),
	skill(ClassRanger, "ranger.hunters-mark", "Hunter's Mark", 3, SkillTargetEnemy, 2, "threat", "control", "Mark the prey for the whole party.", dmg(2, ""), mark(5)),
	skill(ClassRanger, "ranger.barbed-arrow", "Barbed Arrow", 5, SkillTargetEnemy, 2, "poison", "strike", "It hurts more coming out.", dmg(3, ""), bleed(3, 3)),
	skill(ClassRanger, "ranger.concussive-shot", "Concussive Shot", 8, SkillTargetEnemy, 4, "control", "control", "A blunt arrow to the head.", dmg(4, ""), stun(1)),
	skill(ClassRanger, "ranger.camouflage", "Camouflage", 10, SkillTargetSelf, 4, "agility", "guard", "Melt into the shadows and line up the next shot.", ward(6, 0), empower(5)),
	skill(ClassRanger, "ranger.arrow-storm", "Arrow Storm", 12, SkillTargetAllEnemies, 5, "damage", "strike", "Empty the quiver.", dmg(5, statAgility)),
	skill(ClassRanger, "ranger.heartseeker", "Heartseeker", 15, SkillTargetEnemy, 5, "damage", "strike", "The arrow finds the heart.", dmgWhen(12, statAgility, 5, WhenTelegraphing)),

	// ---- Cleric: healing and protection. ----
	basic(skill(ClassCleric, "cleric.smite", "Smite", 1, SkillTargetEnemy, 0, "strike", "strike", "Righteous light, at short range.", dmg(BasicAttackDamage, statFocus))),
	skill(ClassCleric, "cleric.renewal", "Renewal", 1, SkillTargetAlly, 3, "life", "support", "Close wounds on yourself or an ally.", heal(7, statFocus)),
	skill(ClassCleric, "cleric.sanctuary", "Sanctuary", 1, SkillTargetAlly, 2, "ward", "support", "A circle of light that turns the next blow.", ward(6, 0)),
	skill(ClassCleric, "cleric.prayer-of-mending", "Prayer of Mending", 2, SkillTargetParty, 4, "life", "support", "A prayer that reaches everyone.", heal(1, statFocus)),
	skill(ClassCleric, "cleric.rejuvenate", "Rejuvenate", 3, SkillTargetAlly, 3, "life", "support", "Healing that keeps working.", regen(4, 3)),
	skill(ClassCleric, "cleric.holy-fire", "Holy Fire", 5, SkillTargetEnemy, 2, "arcane", "strike", "Light that burns.", dmg(4, statFocus), bleed(2, 2)),
	skill(ClassCleric, "cleric.silence", "Silence", 8, SkillTargetEnemy, 5, "control", "control", "A word, and the enemy cannot speak.", dmg(1, statFocus), interrupt(3)),
	skill(ClassCleric, "cleric.divine-aegis", "Divine Aegis", 10, SkillTargetParty, 5, "ward", "support", "Every adventurer glows with a protective light.", ward(5, 0)),
	skill(ClassCleric, "cleric.purifying-light", "Purifying Light", 12, SkillTargetAllEnemies, 4, "arcane", "support", "Burn the enemy, mend the party.", dmg(2, statFocus), on(ScopeParty, heal(3, ""))),
	skill(ClassCleric, "cleric.resurrection", "Resurrection", 15, SkillTargetFallen, 99, "life", "support", "Call a fallen ally back to the fight. Once a fight.", revive(40)),

	// ---- Tactician: disruption and amplifying allies. ----
	basic(skill(ClassTactician, "tactician.rapier-thrust", "Rapier Thrust", 1, SkillTargetEnemy, 0, "strike", "strike", "Quick and precise.", dmg(BasicAttackDamage, statPower))),
	skill(ClassTactician, "tactician.commanding-strike", "Commanding Strike", 1, SkillTargetEnemy, 2, "control", "control", "Hit, weaken and expose a foe for the party, without dropping your guard.", dmg(5, statPower), weaken(2), mark(3), on(ScopeSelf, guard(2))),
	skill(ClassTactician, "tactician.countermand", "Countermand", 1, SkillTargetEnemy, 2, "control", "control", "See the move coming and call it off.", dmg(3, statPower), interrupt(4)),
	skill(ClassTactician, "tactician.rally", "Rally", 2, SkillTargetParty, 3, "empower", "support", "A shout that lifts every blade.", empower(3)),
	skill(ClassTactician, "tactician.coordinated-assault", "Coordinated Assault", 3, SkillTargetEnemy, 2, "threat", "control", "Point, and the whole party knows where to hit.", mark(6)),
	skill(ClassTactician, "tactician.disarm", "Disarm", 5, SkillTargetEnemy, 3, "control", "control", "Take its weapon away.", dmg(4, statPower), weaken(6)),
	skill(ClassTactician, "tactician.war-horn", "War Horn", 8, SkillTargetParty, 3, "support", "support", "Sound the horn: shields up.", guard(4)),
	skill(ClassTactician, "tactician.battle-plan", "Battle Plan", 10, SkillTargetParty, 5, "focus", "support", "Everyone knows their part. Skills come back sooner.", hasten(1)),
	skill(ClassTactician, "tactician.exploit-the-gap", "Exploit the Gap", 12, SkillTargetAllEnemies, 4, "threat", "control", "Their whole line is open.", mark(4)),
	skill(ClassTactician, "tactician.checkmate", "Checkmate", 15, SkillTargetEnemy, 5, "damage", "strike", "The move it was planning was its last.", dmgWhen(7, statPower, 10, WhenTelegraphing), interrupt(0)),

	// ---- Beastcaller: a companion that fights at your side. ----
	basic(skill(ClassBeastcaller, "beastcaller.maul", "Maul", 1, SkillTargetEnemy, 0, "strike", "strike", "Your companion goes for the throat.", dmg(BasicAttackDamage, statFocus))),
	skill(ClassBeastcaller, "beastcaller.pounce", "Pounce", 1, SkillTargetEnemy, 3, "control", "control", "Your companion knocks a foe off its feet mid-move.", dmg(2, statFocus), interrupt(3)),
	skill(ClassBeastcaller, "beastcaller.bristle-guard", "Bristle Guard", 1, SkillTargetAlly, 1, "guard", "support", "Your companion stands over an ally.", guard(5)),
	skill(ClassBeastcaller, "beastcaller.rending-claws", "Rending Claws", 2, SkillTargetEnemy, 2, "poison", "strike", "Deep, ragged wounds.", dmg(3, ""), bleed(3, 3)),
	skill(ClassBeastcaller, "beastcaller.pack-howl", "Pack Howl", 3, SkillTargetAllEnemies, 3, "support", "control", "A howl that cows the enemy and stirs the party.", weaken(2), on(ScopeParty, empower(2))),
	skill(ClassBeastcaller, "beastcaller.mending-spores", "Mending Spores", 5, SkillTargetAlly, 3, "life", "support", "Spores that knit flesh.", heal(3, ""), regen(3, 3)),
	skill(ClassBeastcaller, "beastcaller.stampede", "Stampede", 8, SkillTargetAllEnemies, 4, "damage", "strike", "Call the whole herd.", dmg(3, statFocus)),
	skill(ClassBeastcaller, "beastcaller.hamstring", "Hamstring", 10, SkillTargetEnemy, 4, "control", "control", "Your companion goes for the legs.", stun(1), bleed(2, 2)),
	skill(ClassBeastcaller, "beastcaller.alpha-strike", "Alpha Strike", 12, SkillTargetEnemy, 4, "life", "strike", "You and your companion strike as one.", dmg(10, statFocus), lifesteal(50)),
	skill(ClassBeastcaller, "beastcaller.spirit-of-the-wild", "Spirit of the Wild", 15, SkillTargetParty, 6, "life", "support", "The wild itself rises to protect the party.", regen(4, 3), guard(3)),
}

var skillIndex = func() map[string]int {
	index := make(map[string]int, len(skillCatalog))
	for i := range skillCatalog {
		skillCatalog[i].Rules = describeSkill(skillCatalog[i])
		index[skillCatalog[i].ID] = i
	}
	return index
}()

// SkillCatalog returns every skill, shared skills first, then each class's in unlock order.
func SkillCatalog() []SkillDefinition {
	result := make([]SkillDefinition, len(skillCatalog))
	for i, definition := range skillCatalog {
		result[i] = definition
		result[i].Effects = append([]SkillEffect(nil), definition.Effects...)
	}
	return result
}

func findSkill(id string) (SkillDefinition, bool) {
	i, ok := skillIndex[id]
	if !ok {
		return SkillDefinition{}, false
	}
	return skillCatalog[i], true
}

// SkillsForClass lists the skills a class can learn, in bar order: its starting skills, Defend, then the rest
// in unlock order.
func SkillsForClass(classID string) []SkillDefinition {
	var first, rest []SkillDefinition
	for _, definition := range skillCatalog {
		switch {
		case definition.ClassID == classID && definition.MasteryLevel <= 1:
			first = append(first, definition)
		case definition.ClassID == classID:
			rest = append(rest, definition)
		}
	}
	if defend, ok := findSkill(SkillDefend); ok {
		first = append(first, defend)
	}
	return append(first, rest...)
}

func skillAvailableToClass(definition SkillDefinition, classID string) bool {
	return definition.ID == SkillDefend || (classID != "" && definition.ClassID == classID)
}

// DefaultLoadout is the bar a class starts with at a mastery level: the first skills it has unlocked.
func DefaultLoadout(classID string, mastery int) []string {
	loadout := make([]string, 0, MaxLoadoutSkills)
	for _, definition := range SkillsForClass(classID) {
		if len(loadout) == MaxLoadoutSkills {
			break
		}
		if definition.MasteryLevel <= mastery {
			loadout = append(loadout, definition.ID)
		}
	}
	return loadout
}

// ValidateLoadout checks a bar: one to six different skills the class knows at this mastery, at least one of
// which never has to recover, so there is always something to do.
func ValidateLoadout(classID string, mastery int, skillIDs []string) error {
	if len(skillIDs) == 0 || len(skillIDs) > MaxLoadoutSkills {
		return ErrInvalidLoadout
	}
	seen := make(map[string]bool, len(skillIDs))
	ready := false
	for _, id := range skillIDs {
		definition, ok := findSkill(id)
		if !ok || seen[id] || !skillAvailableToClass(definition, classID) {
			return ErrInvalidLoadout
		}
		if definition.MasteryLevel > mastery {
			return ErrSkillLocked
		}
		seen[id] = true
		ready = ready || definition.Cooldown == 0
	}
	if !ready {
		return ErrInvalidLoadout
	}
	return nil
}

// SetPlayerLoadout records a lobby loadout. The mastery level is the server's record for the player's class.
func SetPlayerLoadout(room *Room, playerID string, skillIDs []string) error {
	if room.Run != nil {
		return ErrLoadoutUnavailable
	}
	classID := room.PlayerClasses[playerID]
	if classID == "" || !contains(room.PlayerIDs, playerID) {
		return ErrInvalidLoadout
	}
	if err := ValidateLoadout(classID, room.masteryOf(playerID), skillIDs); err != nil {
		return err
	}
	if room.PlayerLoadouts == nil {
		room.PlayerLoadouts = make(map[string][]string)
	}
	room.PlayerLoadouts[playerID] = append([]string(nil), skillIDs...)
	return nil
}

// SetPlayerMastery records the authoritative mastery level a player has in their selected class. The HTTP layer
// reads it from the player's profile; the game only ever lowers what a loadout may contain to match it.
func SetPlayerMastery(room *Room, playerID string, level int) {
	if level < 1 {
		level = 1
	}
	if room.PlayerMastery == nil {
		room.PlayerMastery = make(map[string]int)
	}
	room.PlayerMastery[playerID] = level
	if loadout := room.PlayerLoadouts[playerID]; loadout != nil {
		if err := ValidateLoadout(room.PlayerClasses[playerID], level, loadout); err != nil {
			delete(room.PlayerLoadouts, playerID)
		}
	}
}

func (room *Room) masteryOf(playerID string) int {
	if level := room.PlayerMastery[playerID]; level > 1 {
		return level
	}
	return 1
}

// runLoadout is the bar a player takes into a run: their chosen loadout if it is still valid, else the default.
func runLoadout(room *Room, playerID, classID string) []string {
	mastery := room.masteryOf(playerID)
	if loadout := room.PlayerLoadouts[playerID]; ValidateLoadout(classID, mastery, loadout) == nil {
		return append([]string(nil), loadout...)
	}
	return DefaultLoadout(classID, mastery)
}

// changeRunLoadout swaps a player's bar at the camp between two dungeons.
func changeRunLoadout(room *Room, playerID string, skillIDs []string) error {
	run := room.Run
	if run == nil || run.Phase != PhaseIntermission || run.Camp == nil || len(run.Camp.Choices) == 0 {
		return ErrLoadoutUnavailable
	}
	player := run.Players[playerID]
	if player == nil || player.ClassBuild == nil {
		return ErrInvalidLoadout
	}
	if err := ValidateLoadout(player.ClassBuild.ClassID, room.masteryOf(playerID), skillIDs); err != nil {
		return err
	}
	player.Skills = append([]string(nil), skillIDs...)
	return nil
}

// ValidateSkillCatalog checks the catalog's shape: valid targets, effects and unlocks, and that every class
// starts with a skill it can use every round.
func ValidateSkillCatalog(classes []ClassDefinition) error {
	classIDs := make(map[string]bool, len(classes))
	for _, class := range classes {
		classIDs[class.ID] = true
	}
	seen := make(map[string]bool, len(skillCatalog))
	for _, definition := range skillCatalog {
		if definition.ID == "" || seen[definition.ID] || definition.Name == "" || definition.Description == "" {
			return fmt.Errorf("skill %q is duplicated or missing a name or description", definition.ID)
		}
		seen[definition.ID] = true
		if definition.ClassID != "" && !classIDs[definition.ClassID] {
			return fmt.Errorf("skill %q belongs to unknown class %q", definition.ID, definition.ClassID)
		}
		if definition.MasteryLevel < 1 || definition.Cooldown < 0 || len(definition.Effects) == 0 {
			return fmt.Errorf("skill %q has an invalid unlock, cooldown or no effects", definition.ID)
		}
		if definition.Basic && (definition.Cooldown != 0 || definition.Target != SkillTargetEnemy) {
			return fmt.Errorf("basic attack %q must target an enemy with no cooldown", definition.ID)
		}
		switch definition.Target {
		case SkillTargetEnemy, SkillTargetAllEnemies, SkillTargetSelf, SkillTargetAlly, SkillTargetParty, SkillTargetFallen:
		default:
			return fmt.Errorf("skill %q has unknown target %q", definition.ID, definition.Target)
		}
		for _, effect := range definition.Effects {
			if err := validateSkillEffect(definition, effect); err != nil {
				return err
			}
		}
	}
	for _, class := range classes {
		skills := SkillsForClass(class.ID)
		starting, basics, ladder := 0, 0, map[int]int{}
		for _, definition := range skills {
			if definition.ClassID != class.ID {
				continue
			}
			if definition.Basic {
				basics++
			}
			if definition.MasteryLevel == 1 {
				starting++
			} else {
				ladder[definition.MasteryLevel]++
			}
		}
		if basics != 1 || starting != 3 {
			return fmt.Errorf("class %q needs one basic attack and three starting skills", class.ID)
		}
		for _, rank := range skillUnlockRanks {
			if ladder[rank] != 1 {
				return fmt.Errorf("class %q must unlock exactly one skill at mastery %d", class.ID, rank)
			}
		}
		if len(skills) != 1+3+len(skillUnlockRanks) {
			return fmt.Errorf("class %q has skills outside the unlock ladder", class.ID)
		}
		if err := ValidateLoadout(class.ID, 1, DefaultLoadout(class.ID, 1)); err != nil {
			return fmt.Errorf("class %q default loadout: %w", class.ID, err)
		}
	}
	return nil
}

func validateSkillEffect(definition SkillDefinition, effect SkillEffect) error {
	if effect.Amount < 0 || effect.Rounds < 0 || effect.Bonus < 0 || effect.Cap < 0 || effect.Reflect < 0 {
		return fmt.Errorf("skill %q has a negative effect value", definition.ID)
	}
	switch effect.Stat {
	case "", statPower, statFocus, statAgility:
	default:
		return fmt.Errorf("skill %q scales with unknown stat %q", definition.ID, effect.Stat)
	}
	switch effect.When {
	case "", WhenWounded, WhenTelegraphing, WhenSelfWounded:
	default:
		return fmt.Errorf("skill %q has unknown condition %q", definition.ID, effect.When)
	}
	if (effect.When == "") != (effect.Bonus == 0) {
		return fmt.Errorf("skill %q needs a bonus and a condition together", definition.ID)
	}
	switch effect.Scope {
	case "", ScopeSelf, ScopeParty, ScopeAllEnemies:
	default:
		return fmt.Errorf("skill %q has unknown effect scope %q", definition.ID, effect.Scope)
	}
	enemyEffect := isEnemyEffect(effect.Kind)
	switch effect.Kind {
	case EffectDamage, EffectCounter, EffectInterrupt, EffectWeaken, EffectMark, EffectTaunt, EffectGuard, EffectThorns,
		EffectHeal, EffectEmpower, EffectLifesteal, EffectWard:
	case EffectStun, EffectBleed, EffectRegen:
		if effect.Rounds <= 0 {
			return fmt.Errorf("skill %q has a %s effect without rounds", definition.ID, effect.Kind)
		}
	case EffectRevive:
		if definition.Target != SkillTargetFallen || effect.Amount <= 0 || effect.Amount > 100 {
			return fmt.Errorf("skill %q revives without targeting a fallen ally", definition.ID)
		}
	case EffectHasten:
		if effect.Amount <= 0 {
			return fmt.Errorf("skill %q hastens by nothing", definition.ID)
		}
	default:
		return fmt.Errorf("skill %q has unknown effect %q", definition.ID, effect.Kind)
	}
	if effect.Kind == EffectTaunt && effect.Rounds <= 0 {
		return fmt.Errorf("skill %q taunts for no rounds", definition.ID)
	}
	targetsEnemies := definition.Target == SkillTargetEnemy || definition.Target == SkillTargetAllEnemies
	if enemyEffect && effect.Kind != EffectTaunt && !targetsEnemies && effect.Scope != ScopeAllEnemies {
		return fmt.Errorf("skill %q has an enemy effect but no enemy target", definition.ID)
	}
	if !enemyEffect && effect.Scope == ScopeAllEnemies {
		return fmt.Errorf("skill %q aims an adventurer effect at enemies", definition.ID)
	}
	return nil
}

func isEnemyEffect(kind SkillEffectKind) bool {
	switch kind {
	case EffectDamage, EffectCounter, EffectInterrupt, EffectWeaken, EffectStun, EffectMark, EffectBleed, EffectTaunt:
		return true
	}
	return false
}

// SkillInterrupts reports whether a skill can cancel a telegraphed move.
func SkillInterrupts(definition SkillDefinition) bool {
	for _, effect := range definition.Effects {
		if effect.Kind == EffectInterrupt {
			return true
		}
	}
	return false
}

// describeSkill writes a skill's exact rules from its effects, e.g. "Deal 3 + Power damage. Interrupt its move;
// any other move deals 2 less. Recovers in 3 rounds."
func describeSkill(definition SkillDefinition) string {
	var parts []string
	subject := map[SkillTarget]string{
		SkillTargetEnemy: "", SkillTargetAllEnemies: " to every enemy", SkillTargetSelf: "", SkillTargetAlly: " (you or an ally)",
		SkillTargetParty: " for the whole party", SkillTargetFallen: "",
	}[definition.Target]
	amount := func(effect SkillEffect) string {
		text := itoa(effect.Amount)
		if effect.Stat != "" {
			label := strings.ToUpper(effect.Stat[:1]) + effect.Stat[1:]
			if effect.Amount == 0 {
				text = label
			} else {
				text += " + " + label
			}
		}
		return text
	}
	when := map[string]string{WhenWounded: "against a wounded foe", WhenTelegraphing: "against a foe winding up a move", WhenSelfWounded: "while you are below half health"}
	scoped := func(effect SkillEffect, text string) string {
		switch effect.Scope {
		case ScopeParty:
			return text + " for the whole party"
		case ScopeSelf:
			return text + " for you"
		case ScopeAllEnemies:
			return text + " on every enemy"
		}
		return text + subject
	}
	for _, effect := range definition.Effects {
		switch effect.Kind {
		case EffectDamage:
			switch {
			case definition.Basic:
				parts = append(parts, scoped(effect, "Deal "+amount(effect)+" damage, plus Strike upgrades"))
			case effect.Amount == 0 && effect.Stat == "":
				parts = append(parts, "+"+itoa(effect.Bonus)+" damage "+when[effect.When])
				continue
			default:
				parts = append(parts, scoped(effect, "Deal "+amount(effect)+" damage"))
			}
			if effect.Bonus > 0 {
				parts[len(parts)-1] += ", +" + itoa(effect.Bonus) + " " + when[effect.When]
			}
		case EffectCounter:
			parts = append(parts, scoped(effect, "Deal "+itoa(effect.Amount)+" damage plus the damage you took last round (up to +"+itoa(effect.Cap)+")"))
		case EffectInterrupt:
			if effect.Amount > 0 {
				parts = append(parts, "Interrupt its move; a move that cannot be interrupted deals "+itoa(effect.Amount)+" less instead")
			} else {
				parts = append(parts, "Interrupt its move")
			}
		case EffectWeaken:
			parts = append(parts, scoped(effect, "Its telegraphed move deals "+itoa(effect.Amount)+" less"))
		case EffectStun:
			parts = append(parts, scoped(effect, "Stun: it loses its next turn (a boss is staggered and hits for half)"))
		case EffectMark:
			parts = append(parts, scoped(effect, "Mark: the next party hit on it deals "+itoa(effect.Amount)+" more"))
		case EffectBleed:
			parts = append(parts, scoped(effect, itoa(effect.Amount)+" damage at the end of each of the next "+itoa(effect.Rounds)+" rounds"))
		case EffectTaunt:
			text := "Taunt: single-target attacks turn on you this round"
			if effect.Rounds > 1 {
				text += " and the next " + itoa(effect.Rounds-1)
			}
			parts = append(parts, text)
		case EffectGuard:
			if effect.Amount == 0 {
				parts = append(parts, scoped(effect, "Guard against the next hit"))
			} else {
				parts = append(parts, scoped(effect, "Guard against the next hit, blocking "+itoa(effect.Amount)+" more than Defend"))
			}
		case EffectWard:
			text := "A ward absorbs the next " + itoa(effect.Amount) + " damage"
			if effect.Reflect > 0 {
				text += " and reflects " + itoa(effect.Reflect)
			}
			parts = append(parts, scoped(effect, text))
		case EffectThorns:
			parts = append(parts, scoped(effect, "Reflect "+itoa(effect.Amount)+" to anything that hits you this round"))
		case EffectHeal:
			parts = append(parts, scoped(effect, "Restore "+amount(effect)+" health"))
		case EffectRegen:
			parts = append(parts, scoped(effect, "Restore "+itoa(effect.Amount)+" health at the end of each of the next "+itoa(effect.Rounds)+" rounds"))
		case EffectEmpower:
			parts = append(parts, scoped(effect, "The next damaging skill deals "+itoa(effect.Amount)+" more"))
		case EffectLifesteal:
			parts = append(parts, "You recover "+itoa(effect.Amount)+"% of the damage dealt")
		case EffectRevive:
			parts = append(parts, "A fallen ally stands back up with "+itoa(effect.Amount)+"% health")
		case EffectHasten:
			parts = append(parts, scoped(effect, "Every other skill recovers "+itoa(effect.Amount)+" round"+plural(effect.Amount)+" sooner"))
		}
	}
	switch {
	case definition.Cooldown >= 99:
		parts = append(parts, "Once per fight")
	case definition.Cooldown > 0:
		parts = append(parts, "Recovers in "+itoa(definition.Cooldown)+" round"+plural(definition.Cooldown))
	}
	if definition.Basic {
		parts = append(parts, "A boss barrier absorbs it")
	}
	return strings.Join(parts, ". ") + "."
}

func plural(n int) string {
	if n == 1 {
		return ""
	}
	return "s"
}
