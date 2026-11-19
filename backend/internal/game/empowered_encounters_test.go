package game

import "testing"

func TestAssignEncounterModifierIsDeterministicAndPersisted(t *testing.T) {
	var seed uint64
	for seed = 1; seed < 10000; seed++ {
		roll := seed
		for _, char := range "floor-1-room-1" {
			roll = roll*33 + uint64(char)
		}
		if roll%8 == 0 {
			break
		}
	}
	run := &Run{Seed: seed}
	room := &DungeonRoom{
		ID: "floor-1-room-1", RoomType: "encounter",
		Encounter: &Encounter{Enemies: []Enemy{{ID: "a", Health: 10}, {ID: "b", Health: 10}}},
	}
	assignEncounterModifier(run, room)
	chosen := room.Encounter.Enemies[0].Modifier
	if chosen != "ambush" && chosen != "unyielding" {
		t.Fatalf("expected an empowered enemy, got %+v", room.Encounter.Enemies)
	}
	run.Seed++
	assignEncounterModifier(run, room)
	if room.Encounter.Enemies[0].Modifier != chosen {
		t.Fatal("re-entry rerolled the encounter modifier")
	}
	if room.Encounter.Enemies[1].Modifier != "" {
		t.Fatal("more than one enemy was empowered")
	}
}

func TestBossEncounterDoesNotReceiveRegularEmpowerment(t *testing.T) {
	room := &DungeonRoom{
		ID: "boss-room", RoomType: "boss",
		Encounter: &Encounter{Enemies: []Enemy{{ID: "boss", Health: 20}}},
	}
	assignEncounterModifier(&Run{Seed: 1}, room)
	if !room.Encounter.ModifierAssigned {
		t.Fatal("encounter assignment should be marked complete")
	}
	if room.Encounter.Enemies[0].Modifier != "" {
		t.Fatal("boss encounters should not receive regular modifiers")
	}
}

func TestAmbushActsBeforePartyAndConsumesOpeningIntent(t *testing.T) {
	player := &PlayerState{ID: "p1", Health: 30, MaxHealth: 30}
	room := &Room{
		PlayerIDs: []string{"p1"},
		Presence:  map[string]PlayerPresence{"p1": {}},
		Run:       &Run{CombatRoundNumber: 1, Players: map[string]*PlayerState{"p1": player}},
	}
	encounter := &DungeonRoom{Encounter: &Encounter{Enemies: []Enemy{{
		ID: "e1", Name: "Razor Vine", Health: 12, Modifier: "ambush",
		Intent: &EnemyIntent{Kind: "strike", Label: "Lash", Damage: 5, TargetPlayerID: "p1"},
	}}}}
	applyAmbush(room, encounter)
	enemy := encounter.Encounter.Enemies[0]
	if player.Health != 25 {
		t.Fatalf("ambush damage = %d, want 5", 30-player.Health)
	}
	if enemy.Intent == nil || enemy.Intent.Kind != "ambush_recovery" || !enemy.ModifierTriggered {
		t.Fatal("ambush should leave a harmless recovery intent and mark the modifier triggered")
	}
	if len(room.Run.LastCombatEvents) == 0 || room.Run.LastCombatEvents[0].Kind != "enemy_ambush" {
		t.Fatalf("missing ambush combat log: %+v", room.Run.LastCombatEvents)
	}
}

func TestUnyieldingModifierCannotBeInterrupted(t *testing.T) {
	enemy := &Enemy{Modifier: "unyielding", Intent: &EnemyIntent{Interruptible: true}}
	enforceUnyielding(enemy)
	if enemy.Intent.Interruptible {
		t.Fatal("unyielding intent remained interruptible")
	}
}

func TestAmbushCannotKnockOutPlayerBeforeFirstAction(t *testing.T) {
	player := &PlayerState{ID: "p1", Health: 3, MaxHealth: 30}
	room := &Room{
		PlayerIDs: []string{"p1"},
		Presence:  map[string]PlayerPresence{"p1": {}},
		Run:       &Run{CombatRoundNumber: 1, Players: map[string]*PlayerState{"p1": player}},
	}
	encounter := &DungeonRoom{Encounter: &Encounter{Enemies: []Enemy{{
		ID: "e1", Name: "Razor Vine", Health: 12, Modifier: "ambush",
		Intent: &EnemyIntent{Kind: "strike", Label: "Lash", Damage: 12, TargetPlayerID: "p1"},
	}}}}
	applyAmbush(room, encounter)
	if player.Health != 1 {
		t.Fatalf("ambush should leave the player at 1 HP, got %d", player.Health)
	}
}
