package game

import "testing"

func TestResolveAttackDamage(t *testing.T) {
	tests := []struct {
		name  string
		input AttackDamageInput
		want  AttackDamageTransition
	}{
		{
			name: "combines base bonuses marked damage resolve telegraph and room strike",
			input: AttackDamageInput{
				BaseDamage: 8, BonusDamage: 2, MarkedDamage: 3, IncludeMarkedDamage: true,
				ConsumeMarkedDamage: true, ResolveReady: true, UseResolve: true,
				ResolveBonus: 3, Telegraph: true, TelegraphBonus: 2, StrikeBonus: 1,
			},
			want: AttackDamageTransition{Damage: 19, RemainingMarkedDamage: 0, ResolveReady: false},
		},
		{
			name:  "ordinary attack preserves resolve when it is not enabled",
			input: AttackDamageInput{BaseDamage: 5, ResolveReady: true},
			want:  AttackDamageTransition{Damage: 5, ResolveReady: true},
		},
		{
			name: "class attack consumes positive mark without consuming resolve",
			input: AttackDamageInput{
				BaseDamage: 4, MarkedDamage: 3, IncludeMarkedDamage: true,
				ConsumeMarkedDamage: true, ResolveReady: true,
			},
			want: AttackDamageTransition{Damage: 7, RemainingMarkedDamage: 0, ResolveReady: true},
		},
		{
			name: "negative marked damage remains part of basic attack arithmetic",
			input: AttackDamageInput{
				BaseDamage: 5, MarkedDamage: -2, IncludeMarkedDamage: true, ConsumeMarkedDamage: true,
			},
			want: AttackDamageTransition{Damage: 3, RemainingMarkedDamage: 0},
		},
		{
			name:  "class ability ignores and preserves a non-positive mark",
			input: AttackDamageInput{BaseDamage: 5, MarkedDamage: -2},
			want:  AttackDamageTransition{Damage: 5, RemainingMarkedDamage: -2},
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := resolveAttackDamage(test.input); got != test.want {
				t.Fatalf("resolveAttackDamage(%+v) = %+v, want %+v", test.input, got, test.want)
			}
		})
	}
}

func TestResolveInterruptDamage(t *testing.T) {
	if got := resolveInterruptDamage(4, 2, 3); got != 9 {
		t.Fatalf("resolveInterruptDamage = %d, want 9", got)
	}
}

func TestResolveIncomingDamage(t *testing.T) {
	tests := []struct {
		name  string
		input IncomingDamageInput
		want  IncomingDamageTransition
	}{
		{
			name: "talent and passive reductions apply before ward, without treating agility as armor",
			input: IncomingDamageInput{
				IntentDamage: 12, TalentReduction: 1, PassiveReduction: 1, Ward: 3, WardReflect: 2,
			},
			want: IncomingDamageTransition{Damage: 7, Blocked: 5, WardAbsorbed: 3, WardRemaining: 0, WardReflect: 2},
		},
		{
			name: "ward absorbs before guard and guard consumes one hit",
			input: IncomingDamageInput{
				IntentDamage: 10, Ward: 3, WardReflect: 2, Guarding: true,
				GuardReduction: 4, GuardBonus: 1, TalentGuardReduction: 1, PartyGuardReduction: 1,
			},
			want: IncomingDamageTransition{
				Damage: 0, Blocked: 10, WardAbsorbed: 3, WardRemaining: 0, WardReflect: 2,
				GuardBlocked: 7, Guarded: true, Guarding: false, GuardBonus: 0,
			},
		},
		{
			name:  "guard uses default reduction when player reduction is zero",
			input: IncomingDamageInput{IntentDamage: 8, Guarding: true, DefaultGuardReduction: 6},
			want:  IncomingDamageTransition{Damage: 2, Blocked: 6, GuardBlocked: 6, Guarded: true, Guarding: false},
		},
		{
			name:  "ward is consumed even when prior mitigation reduces damage to zero",
			input: IncomingDamageInput{IntentDamage: 2, Ward: 5, WardReflect: 3},
			want:  IncomingDamageTransition{Damage: 0, Blocked: 2, WardRemaining: 0, WardReflect: 3},
		},
		{
			name: "guard blocks only its configured amount from an 8-damage hit",
			input: IncomingDamageInput{IntentDamage: 8, Guarding: true, GuardReduction: 4},
			want: IncomingDamageTransition{Damage: 4, Blocked: 4, GuardBlocked: 4, Guarded: true, Guarding: false},
		},
		{
			name: "guard fully blocks a hit smaller than its configured amount",
			input: IncomingDamageInput{IntentDamage: 3, Guarding: true, GuardReduction: 4},
			want: IncomingDamageTransition{Damage: 0, Blocked: 3, GuardBlocked: 3, Guarded: true, Guarding: false},
		},
		{
			name:  "unguarded player retains guard bonus",
			input: IncomingDamageInput{IntentDamage: 5, GuardBonus: 3},
			want:  IncomingDamageTransition{Damage: 5, Blocked: 0, GuardBonus: 3},
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := resolveIncomingDamage(test.input); got != test.want {
				t.Fatalf("resolveIncomingDamage(%+v) = %+v, want %+v", test.input, got, test.want)
			}
		})
	}
}

func TestResolveEnemyIntent(t *testing.T) {
	ability := AbilityDefinition{Kind: "heavy_strike", Label: "Heavy strike", Damage: 8, Heal: 2, Interruptible: true}
	players := []string{"player-1", "player-2", "player-3"}
	for _, test := range []struct {
		round int
		enemy int
		want  string
	}{
		{round: 1, enemy: 0, want: "player-2"},
		{round: 2, enemy: 1, want: "player-1"},
	} {
		got := resolveEnemyIntent(ability, test.round, test.enemy, players)
		if got.TargetPlayerID != test.want || got.Kind != ability.Kind || got.Damage != ability.Damage || got.Heal != ability.Heal || !got.Interruptible {
			t.Fatalf("resolveEnemyIntent produced %+v, want target %s and ability %+v", got, test.want, ability)
		}
	}
	ability.TargetAll = true
	if got := resolveEnemyIntent(ability, 1, 0, players); !got.TargetAll || got.TargetPlayerID != "" {
		t.Fatalf("party-wide intent should not select a single target, got %+v", got)
	}
}

func TestBuildEnemyIntentPreservesLegacyBehaviorFallback(t *testing.T) {
	got := buildEnemyIntent(&Enemy{Behavior: "unknown-legacy-behavior"}, 1, 0, []string{"player-1"})
	if got.Kind != "strike" || got.Label != "Strike" || got.Damage != 4 || got.TargetPlayerID != "player-1" {
		t.Fatalf("legacy behavior fallback changed: %+v", got)
	}
}

func TestBuildEnemyIntentScalesDamageWithPartySize(t *testing.T) {
	players := []string{"player-1", "player-2", "player-3", "player-4"}
	got := buildEnemyIntent(&Enemy{Behavior: "guardian"}, 1, 0, players)
	if got.Damage != 24 {
		t.Fatalf("four-player guardian heavy intent damage = %d, want 24", got.Damage)
	}
}
