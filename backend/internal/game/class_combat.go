package game

import (
	"errors"
	"fmt"
	"strings"
)

var ErrInvalidAbility = errors.New("class ability is not available or its target is invalid")

type classAbilityHandler struct {
	target string
	modes  []string
	apply  func(*Room, *PlayerState, Command, *Enemy, *PlayerState, int) error
}

type classPassiveBonuses struct {
	AttackDamage    int
	InterruptDamage int
	DamageReduction int
	EncounterHeal   int
}

var classAbilityHandlers = map[string]classAbilityHandler{
	"combat.guard": {
		target: "none",
		apply: func(room *Room, player *PlayerState, _ Command, _ *Enemy, _ *PlayerState, round int) error {
			player.Guarding = true
			player.ClassCombat.GuardBonus = 6
			addCombatEvent(room.Run, round, "class_ability", adventurerLabel(room, player.ID)+" raises a Shield Wall, bracing for the next hit.")
			return nil
		},
	},
	"combat.counter": {
		target: "enemy",
		apply: func(room *Room, player *PlayerState, _ Command, enemy *Enemy, _ *PlayerState, round int) error {
			damage := 4 + player.ClassCombat.DamageTakenLastRound
			if damage > 12 {
				damage = 12
			}
			player.ClassCombat.DamageTakenLastRound = 0
			dealClassAbilityDamage(room, player, enemy, round, "reckoning", damage, "turns the punishment it endured into a counterattack")
			return nil
		},
	},
	"combat.ward": {
		target: "none",
		apply: func(room *Room, player *PlayerState, _ Command, _ *Enemy, _ *PlayerState, round int) error {
			player.ClassCombat.Ward = 7
			player.ClassCombat.WardReflect = 2
			addCombatEvent(room.Run, round, "class_ability", adventurerLabel(room, player.ID)+" conjures a Runic Ward to absorb and reflect the next attack.")
			return nil
		},
	},
	"combat.precision": {
		target: "enemy",
		apply: func(room *Room, player *PlayerState, _ Command, enemy *Enemy, _ *PlayerState, round int) error {
			damage := 5 + player.Stats.Agility
			if enemy.Health*2 <= enemy.MaxHealth || enemy.Intent != nil {
				damage += 4
			}
			dealClassAbilityDamage(room, player, enemy, round, "exploit_weakness", damage, "exploits an opening")
			return nil
		},
	},
	"combat.elemental": {
		target: "enemy",
		modes:  []string{"fire", "frost"},
		apply: func(room *Room, player *PlayerState, command Command, enemy *Enemy, _ *PlayerState, round int) error {
			charges := player.ClassCombat.ArcaneCharges
			if charges > 2 {
				charges = 2
			}
			damage := player.Stats.Focus + charges*2
			if command.Mode == "fire" {
				damage += 6
				dealClassAbilityDamage(room, player, enemy, round, "elemental_fire", damage, "unleashes an Elemental Surge of fire")
			} else {
				damage += 2
				if enemy.Intent != nil {
					label := enemy.Intent.Label
					enemy.Intent = nil
					addCombatEvent(room.Run, round, "elemental_frost", adventurerLabel(room, player.ID)+" freezes "+enemy.Name+", stopping "+label+".")
				} else {
					addCombatEvent(room.Run, round, "elemental_frost", adventurerLabel(room, player.ID)+" chills "+enemy.Name+" with a frost surge.")
				}
				dealClassAbilityDamage(room, player, enemy, round, "elemental_frost_damage", damage, "deals frost damage to")
			}
			if player.ClassCombat.ArcaneCharges < 2 {
				player.ClassCombat.ArcaneCharges++
			}
			return nil
		},
	},
	"combat.disrupt": {
		target: "enemy",
		apply: func(room *Room, player *PlayerState, _ Command, enemy *Enemy, _ *PlayerState, round int) error {
			damage := 4 + player.Stats.Agility
			dealClassAbilityDamage(room, player, enemy, round, "pinning_shot", damage, "pins")
			if enemy.Health > 0 && enemy.Intent != nil {
				before := enemy.Intent.Damage
				enemy.Intent.Damage -= 3
				if enemy.Intent.Damage < 0 {
					enemy.Intent.Damage = 0
				}
				addCombatEvent(room.Run, round, "pinning_shot", enemy.Name+"'s next attack is weakened by "+itoa(before-enemy.Intent.Damage)+".")
			}
			return nil
		},
	},
	"combat.heal": {
		target: "player_optional",
		apply: func(room *Room, player *PlayerState, _ Command, _ *Enemy, target *PlayerState, round int) error {
			if target == nil {
				target = player
			}
			amount := 7 + player.Stats.Focus
			before := target.Health
			target.Health += amount
			if target.Health > target.MaxHealth {
				target.Health = target.MaxHealth
			}
			actual := target.Health - before
			if actual > 0 {
				addCombatImpact(room.Run, round, "renewal", adventurerLabel(room, player.ID)+" uses Renewal on "+adventurerLabel(room, target.ID)+" for "+itoa(actual)+" health.", "heal", target.ID, "player", actual)
			} else {
				addCombatEvent(room.Run, round, "renewal", adventurerLabel(room, player.ID)+" uses Renewal, but "+adventurerLabel(room, target.ID)+" is already at full health.")
			}
			return nil
		},
	},
	"combat.command": {
		target: "enemy",
		apply: func(room *Room, player *PlayerState, _ Command, enemy *Enemy, _ *PlayerState, round int) error {
			dealClassAbilityDamage(room, player, enemy, round, "commanding_strike", 3+player.Stats.Power, "lands a Commanding Strike on")
			if enemy.Health > 0 {
				enemy.MarkedDamage += 3
				if enemy.Intent != nil {
					enemy.Intent.Damage -= 2
					if enemy.Intent.Damage < 0 {
						enemy.Intent.Damage = 0
					}
				}
				addCombatEvent(room.Run, round, "command_mark", enemy.Name+" is exposed; the next party strike against it deals 3 bonus damage.")
			}
			return nil
		},
	},
	"combat.companion": {
		target: "mode_target",
		modes:  []string{"attack", "defend", "disrupt"},
		apply: func(room *Room, player *PlayerState, command Command, enemy *Enemy, target *PlayerState, round int) error {
			switch command.Mode {
			case "attack":
				dealClassAbilityDamage(room, player, enemy, round, "companion_attack", 4+player.Stats.Focus, "sends its companion to strike")
			case "defend":
				if target == nil {
					target = player
				}
				target.Guarding = true
				target.ClassCombat.GuardBonus += 3
				addCombatEvent(room.Run, round, "companion_defend", adventurerLabel(room, player.ID)+"'s companion guards "+adventurerLabel(room, target.ID)+".")
			case "disrupt":
				if enemy.Intent != nil {
					label := enemy.Intent.Label
					if enemy.Intent.Interruptible {
						enemy.Intent = nil
						addCombatEvent(room.Run, round, "companion_disrupt", "The companion interrupts "+label+" from "+enemy.Name+".")
					} else {
						enemy.Intent.Damage -= 3
						if enemy.Intent.Damage < 0 {
							enemy.Intent.Damage = 0
						}
						addCombatEvent(room.Run, round, "companion_disrupt", "The companion disrupts "+enemy.Name+", weakening "+label+".")
					}
				}
			}
			return nil
		},
	},
}

var classPassiveHandlers = map[string]func(*PlayerState, *Enemy, *EnemyIntent) classPassiveBonuses{
	"passive.resolve": func(player *PlayerState, _ *Enemy, _ *EnemyIntent) classPassiveBonuses {
		return classPassiveBonuses{}
	},
	"passive.low-health": func(player *PlayerState, _ *Enemy, _ *EnemyIntent) classPassiveBonuses {
		if player.Health*2 <= player.MaxHealth {
			return classPassiveBonuses{AttackDamage: 3}
		}
		return classPassiveBonuses{}
	},
	"passive.magic-resist": func(_ *PlayerState, _ *Enemy, intent *EnemyIntent) classPassiveBonuses {
		if intent != nil && (intent.Kind == "soul_drain" || intent.Kind == "soul_sweep") {
			return classPassiveBonuses{DamageReduction: 2}
		}
		return classPassiveBonuses{}
	},
	"passive.wounded-target": func(_ *PlayerState, enemy *Enemy, _ *EnemyIntent) classPassiveBonuses {
		if enemy != nil && enemy.Health*2 <= enemy.MaxHealth {
			return classPassiveBonuses{AttackDamage: 3}
		}
		return classPassiveBonuses{}
	},
	"passive.elemental-chain": func(*PlayerState, *Enemy, *EnemyIntent) classPassiveBonuses {
		return classPassiveBonuses{}
	},
	"passive.unacted-target": func(_ *PlayerState, enemy *Enemy, _ *EnemyIntent) classPassiveBonuses {
		if enemy != nil && enemy.TurnsTaken <= 1 {
			return classPassiveBonuses{AttackDamage: 3}
		}
		return classPassiveBonuses{}
	},
	"passive.encounter-recovery": func(*PlayerState, *Enemy, *EnemyIntent) classPassiveBonuses {
		return classPassiveBonuses{EncounterHeal: 2}
	},
	"passive.interrupt": func(*PlayerState, *Enemy, *EnemyIntent) classPassiveBonuses {
		return classPassiveBonuses{InterruptDamage: 2}
	},
	"passive.companion": func(*PlayerState, *Enemy, *EnemyIntent) classPassiveBonuses {
		return classPassiveBonuses{}
	},
}

func validateRegisteredClassEffects() error {
	for _, ability := range classAbilities {
		if _, ok := classAbilityHandlers[ability.EffectID]; !ok {
			return fmt.Errorf("ability %q has no handler for effect %q", ability.ID, ability.EffectID)
		}
	}
	for _, passive := range classPassives {
		if _, ok := classPassiveHandlers[passive.EffectID]; !ok {
			return fmt.Errorf("passive %q has no handler for effect %q", passive.ID, passive.EffectID)
		}
	}
	return nil
}

func validateClassAbilityCommand(player *PlayerState, encounter *Encounter, command Command, players map[string]*PlayerState) error {
	if player == nil || player.ClassBuild == nil {
		return ErrInvalidAbility
	}
	ability, ok := findClassAbility(player.ClassBuild.SignatureAbilityID)
	if !ok {
		return ErrInvalidAbility
	}
	handler, ok := classAbilityHandlers[ability.EffectID]
	if !ok || !contains(handler.modes, command.Mode) && len(handler.modes) > 0 {
		return ErrInvalidAbility
	}
	switch handler.target {
	case "none":
		if command.TargetID != "" {
			return ErrInvalidAbility
		}
	case "enemy":
		if encounter == nil || !hasLivingEnemy(encounter, command.TargetID) {
			return ErrInvalidAbility
		}
	case "mode_target":
		if command.Mode == "defend" {
			if command.TargetID != "" {
				target := players[command.TargetID]
					if target == nil || target.Health <= 0 { return ErrInvalidAbility }
				}
		} else if encounter == nil || !hasLivingEnemy(encounter, command.TargetID) {
			return ErrInvalidAbility
		}
	case "player_optional":
		if command.TargetID != "" {
			target := players[command.TargetID]
			if target == nil || target.Health <= 0 {
				return ErrInvalidAbility
			}
		}
	default:
		return ErrInvalidAbility
	}
	return nil
}

func applyClassAbility(room *Room, player *PlayerState, command Command, round int) error {
	if player == nil || player.ClassBuild == nil {
		return ErrInvalidAbility
	}
	ability, ok := findClassAbility(player.ClassBuild.SignatureAbilityID)
	if !ok {
		return ErrInvalidAbility
	}
	handler, ok := classAbilityHandlers[ability.EffectID]
	if !ok {
		return ErrInvalidAbility
	}
	var enemy *Enemy
	var target *PlayerState
	switch handler.target {
	case "enemy":
		enemy = findLivingEnemy(room.Run.Rooms[room.Run.CurrentRoomID].Encounter, command.TargetID)
	case "mode_target":
		if command.Mode == "defend" {
			if command.TargetID != "" { target = room.Run.Players[command.TargetID] }
		} else {
			enemy = findLivingEnemy(room.Run.Rooms[room.Run.CurrentRoomID].Encounter, command.TargetID)
		}
	case "player_optional":
		if command.TargetID != "" {
			target = room.Run.Players[command.TargetID]
		}
	}
	if handler.target == "mode_target" && command.Mode == "defend" && command.TargetID == "" {
		target = player
	}
	if err := handler.apply(room, player, command, enemy, target, round); err != nil {
		return err
	}
	if ability.EffectID != "combat.elemental" {
		player.ClassCombat.ArcaneCharges = 0
	}
	return nil
}

func classPassiveEffects(player *PlayerState, enemy *Enemy, intent *EnemyIntent) classPassiveBonuses {
	if player == nil || player.ClassBuild == nil {
		return classPassiveBonuses{}
	}
	passive, ok := findClassPassive(player.ClassBuild.PassiveID)
	if !ok {
		return classPassiveBonuses{}
	}
	handler, ok := classPassiveHandlers[passive.EffectID]
	if !ok {
		return classPassiveBonuses{}
	}
	return handler(player, enemy, intent)
}

func classPassiveEffectID(player *PlayerState) string {
	if player == nil || player.ClassBuild == nil {
		return ""
	}
	passive, ok := findClassPassive(player.ClassBuild.PassiveID)
	if !ok {
		return ""
	}
	return passive.EffectID
}

func dealClassAbilityDamage(room *Room, player *PlayerState, enemy *Enemy, round int, kind string, damage int, description string) {
	if enemy == nil || enemy.Health <= 0 {
		return
	}
	if damage < 0 {
		damage = 0
	}
	if enemy.MarkedDamage > 0 {
		damage += enemy.MarkedDamage
		enemy.MarkedDamage = 0
	}
	before := enemy.Health
	enemy.Health -= damage
	if enemy.Health < 0 {
		enemy.Health = 0
	}
	actual := before - enemy.Health
	addCombatImpact(room.Run, round, kind, adventurerLabel(room, player.ID)+" "+description+" "+enemy.Name+" for "+itoa(actual)+" damage.", "damage", enemy.ID, "enemy", actual)
	if enemy.Health == 0 {
		enemy.Intent = nil
		addCombatEvent(room.Run, round, "enemy_defeated", enemy.Name+" is defeated. Its attack is stopped.")
	}
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
		if classPassiveEffectID(player) != "passive.companion" {
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
		target.Health++
		addCombatImpact(room.Run, round, "companion_instinct", adventurerLabel(room, playerID)+"'s companion tends "+adventurerLabel(room, target.ID)+" for 1 health.", "heal", target.ID, "player", 1)
	}
}

func onClassGuardBlocked(player *PlayerState, intent EnemyIntent, guarded bool, blocked int) {
	if !guarded || blocked <= 0 || intent.Damage < 7 {
		return
	}
	if classPassiveEffectID(player) == "passive.resolve" {
		player.ClassCombat.ResolveReady = true
	}
}

func (e classAbilityHandler) supportsMode(mode string) bool {
	return len(e.modes) == 0 && mode == "" || contains(e.modes, mode)
}

func (e classAbilityHandler) String() string {
	return strings.Join(e.modes, ",")
}
