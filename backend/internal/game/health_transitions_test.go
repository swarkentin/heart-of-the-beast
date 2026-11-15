package game

import "testing"

func TestResolveHealthDamage(t *testing.T) {
	tests := []struct {
		name     string
		health   int
		damage   int
		wantHP   int
		wantLoss int
	}{
		{name: "partial damage", health: 20, damage: 7, wantHP: 13, wantLoss: 7},
		{name: "lethal damage clamps to zero", health: 5, damage: 9, wantHP: 0, wantLoss: 5},
		{name: "zero damage", health: 20, damage: 0, wantHP: 20, wantLoss: 0},
		{name: "negative damage is ignored", health: 20, damage: -4, wantHP: 20, wantLoss: 0},
		{name: "already defeated target", health: 0, damage: 5, wantHP: 0, wantLoss: 0},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got := resolveHealthDamage(test.health, test.damage)
			if got.Health != test.wantHP || got.Applied != test.wantLoss {
				t.Fatalf("resolveHealthDamage(%d, %d) = %+v, want health %d and applied %d", test.health, test.damage, got, test.wantHP, test.wantLoss)
			}
		})
	}
}

func TestResolveHealthHealing(t *testing.T) {
	tests := []struct {
		name      string
		health    int
		maxHealth int
		healing   int
		wantHP    int
		wantGain  int
	}{
		{name: "partial healing", health: 12, maxHealth: 30, healing: 7, wantHP: 19, wantGain: 7},
		{name: "healing clamps to max health", health: 27, maxHealth: 30, healing: 8, wantHP: 30, wantGain: 3},
		{name: "full health", health: 30, maxHealth: 30, healing: 8, wantHP: 30, wantGain: 0},
		{name: "negative healing is ignored", health: 12, maxHealth: 30, healing: -5, wantHP: 12, wantGain: 0},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got := resolveHealthHealing(test.health, test.maxHealth, test.healing)
			if got.Health != test.wantHP || got.Applied != test.wantGain {
				t.Fatalf("resolveHealthHealing(%d, %d, %d) = %+v, want health %d and applied %d", test.health, test.maxHealth, test.healing, got, test.wantHP, test.wantGain)
			}
		})
	}
}
