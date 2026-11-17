package game

import "testing"

func traitEncounter(enemies ...Enemy) *Encounter {
	for i := range enemies {
		if enemies[i].MaxHealth == 0 {
			enemies[i].Health, enemies[i].MaxHealth = 20, 20
		}
	}
	return &Encounter{Enemies: enemies, Status: EncounterActive}
}

func TestBodyguardPhasingAndShieldsReduceDamage(t *testing.T) {
	run := &Run{}
	encounter := traitEncounter(Enemy{ID: "a", Name: "A"}, Enemy{ID: "b", Name: "B", Traits: []MonsterTrait{{Kind: TraitBodyguard, Amount: 2}}})
	a, b := &encounter.Enemies[0], &encounter.Enemies[1]
	if got := traitDamageTaken(run, encounter, a, 10, 1, true); got != 8 {
		t.Fatalf("a standing bodyguard should take 2 off a hit on its ally, got %d", got)
	}
	if got := traitDamageTaken(run, encounter, b, 10, 1, true); got != 10 {
		t.Fatalf("a bodyguard does not guard itself, got %d", got)
	}
	a.Phased = true
	if got := traitDamageTaken(run, encounter, a, 10, 1, true); got != 3 {
		t.Fatalf("out of phase halves the hit before the bodyguard: want 3, got %d", got)
	}
	a.Phased, a.Shield = false, 5
	if got := traitDamageTaken(run, encounter, a, 10, 1, false); got != 3 || a.Shield != 5 {
		t.Fatalf("an estimate must not spend the shield: got %d, shield %d", got, a.Shield)
	}
	if got := traitDamageTaken(run, encounter, a, 10, 1, true); got != 3 || a.Shield != 0 {
		t.Fatalf("a shield absorbs what it can: got %d, shield %d", got, a.Shield)
	}
	b.Health = 0
	if got := traitDamageTaken(run, encounter, a, 10, 1, true); got != 10 {
		t.Fatalf("a fallen bodyguard guards no one, got %d", got)
	}
}

func TestSpikesHurtBasicAttacksButNotSkills(t *testing.T) {
	room, _ := newClassCombatTestRoom(t, ClassRanger)
	run := room.Run
	ranger := run.Players["player-1"]
	enemy := &run.Rooms["entry"].Encounter.Enemies[0]
	enemy.Health, enemy.MaxHealth = 200, 200
	enemy.Traits = []MonsterTrait{{Kind: TraitSpiked, Amount: 2}}
	enemy.Intent = nil
	castSkill(t, room, "player-1", "ranger.quick-shot", enemy.ID)
	if ranger.Health != ranger.MaxHealth-2 || combatEvent(run, "trait_spiked") == nil {
		t.Fatalf("a basic attack on a spiked monster should cost 2 health, health %d/%d", ranger.Health, ranger.MaxHealth)
	}
	enemy.Intent = nil
	castSkill(t, room, "player-1", "ranger.aimed-shot", enemy.ID)
	if ranger.Health != ranger.MaxHealth-2 {
		t.Fatalf("a skill should not touch the spikes, health %d", ranger.Health)
	}
	ranger.Health = 1
	enemy.Intent = nil
	castSkill(t, room, "player-1", "ranger.quick-shot", enemy.ID)
	if ranger.Health != 1 {
		t.Fatalf("spikes never down an adventurer, health %d", ranger.Health)
	}
}

func TestAFuseDetonatesOnItsTurnAndDestroysTheMonster(t *testing.T) {
	enemy := &Enemy{ID: "bomb", Traits: []MonsterTrait{{Kind: TraitFuse, Every: 3, Amount: 5, Label: "Boom"}}}
	normal := &EnemyIntent{Kind: "strike", Damage: 2}
	enemy.TurnsTaken = 2
	if got := traitIntentOverride(enemy, normal, 1); got != normal {
		t.Fatalf("the fuse should not blow early: %+v", got)
	}
	enemy.TurnsTaken = 3
	got := traitIntentOverride(enemy, normal, 1)
	if got.Kind != "detonate" || !got.TargetAll || got.Damage != 5 || got.Interruptible {
		t.Fatalf("on its turn the fuse detonates on the whole party: %+v", got)
	}
	if larger := traitIntentOverride(enemy, normal, 4); larger.Damage <= 5 {
		t.Fatalf("the blast scales with the party like any party-wide move: %+v", larger)
	}

	room, _ := newClassCombatTestRoom(t, ClassRanger)
	run := room.Run
	bomb := &run.Rooms["entry"].Encounter.Enemies[0]
	bomb.Health, bomb.MaxHealth = 200, 200
	bomb.Traits = enemy.Traits
	bomb.Intent = &EnemyIntent{Kind: "detonate", Label: "Boom", Damage: 5, TargetAll: true}
	castSkill(t, room, "player-1", "ranger.quick-shot", bomb.ID)
	if bomb.Health != 0 {
		t.Fatalf("a monster that detonates is destroyed, health %d", bomb.Health)
	}
	if ranger := run.Players["player-1"]; ranger.Health != ranger.MaxHealth-5 {
		t.Fatalf("the blast should hit for 5, health %d/%d", ranger.Health, ranger.MaxHealth)
	}
}

func TestRegenerationIsStoppedByBleeding(t *testing.T) {
	run := &Run{}
	encounter := traitEncounter(Enemy{ID: "a", Name: "A", Health: 10, MaxHealth: 20, Traits: []MonsterTrait{{Kind: TraitRegenerate, Amount: 2}}})
	a := &encounter.Enemies[0]
	applyTraitRegeneration(run, encounter, 1)
	if a.Health != 12 {
		t.Fatalf("regenerate should heal 2, health %d", a.Health)
	}
	a.Bleed, a.BleedRounds = 1, 2
	applyTraitRegeneration(run, encounter, 2)
	if a.Health != 12 {
		t.Fatalf("a bleeding monster must not regenerate, health %d", a.Health)
	}
}

func TestASplittingMonsterSplitsOnce(t *testing.T) {
	run := &Run{}
	encounter := traitEncounter(Enemy{ID: "heap", Name: "Heap", Health: 0, MaxHealth: 20, TurnsTaken: 2, Traits: []MonsterTrait{{Kind: TraitSplits, Amount: 50}}})
	applyTraitSplits(run, encounter, 1)
	if len(encounter.Enemies) != 2 {
		t.Fatalf("the heap should split into a copy, enemies %d", len(encounter.Enemies))
	}
	half := &encounter.Enemies[1]
	if half.Health != 10 || half.MaxHealth != 10 || !half.Split || half.TurnsTaken != 2 {
		t.Fatalf("the copy has half the health and keeps the rhythm: %+v", half)
	}
	if allEnemiesDefeated(encounter) {
		t.Fatal("the fight is not over while the copy stands")
	}
	half.Health = 0
	applyTraitSplits(run, encounter, 2)
	if len(encounter.Enemies) != 2 {
		t.Fatalf("neither the heap nor its copy splits again, enemies %d", len(encounter.Enemies))
	}
}

func TestWardersShieldTheMostWoundedAllyAndAvengersSwearVengeance(t *testing.T) {
	room, _ := newClassCombatTestRoom(t, ClassRanger)
	encounter := traitEncounter(
		Enemy{ID: "warder", Name: "Warder", TurnsTaken: 2, Traits: []MonsterTrait{{Kind: TraitWarder, Amount: 4, Every: 2}}},
		Enemy{ID: "hurt", Name: "Hurt", Health: 5, MaxHealth: 20},
		Enemy{ID: "avenger", Name: "Avenger", Traits: []MonsterTrait{{Kind: TraitAvenger, Amount: 2}}},
		Enemy{ID: "phaser", Name: "Phaser", TurnsTaken: 2, Traits: []MonsterTrait{{Kind: TraitPhasing}}},
	)
	applyTraitRoundStart(room, encounter, 1)
	if encounter.Enemies[1].Shield != 4 || encounter.Enemies[0].Shield != 0 {
		t.Fatalf("the warder should shield its most wounded ally: %+v", encounter.Enemies[:2])
	}
	if encounter.Enemies[2].Avenged || !encounter.Enemies[3].Phased {
		t.Fatalf("no one has fallen yet, and the phaser is out of phase on even turns: %+v", encounter.Enemies[2:])
	}
	encounter.Enemies[1].Health = 0
	encounter.Enemies[3].TurnsTaken = 3
	applyTraitRoundStart(room, encounter, 2)
	if avenger := encounter.Enemies[2]; !avenger.Avenged || avenger.DamageBonus != 2 {
		t.Fatalf("an ally fell: the avenger should hit 2 harder: %+v", avenger)
	}
	if encounter.Enemies[3].Phased {
		t.Fatal("the phaser is back in phase on odd turns")
	}
	applyTraitRoundStart(room, encounter, 3)
	if encounter.Enemies[2].DamageBonus != 2 {
		t.Fatal("vengeance is sworn once per fight")
	}
}

func TestSomeFloorsHoldALairWithAnArmedBossThatDoesNotEnrage(t *testing.T) {
	for _, themeID := range defaultDungeonThemeCatalog.IDs() {
		theme, err := defaultExpeditionThemeCatalog.Theme(themeID)
		if err != nil {
			continue
		}
		found := false
		for seed := uint64(1); seed <= 200 && !found; seed++ {
			if _, rooms := generateExpeditionFloor(themeID, seed, 1, 3, 1, nil); hasLair(rooms) {
				t.Fatalf("%s: the first floor of a dungeon never has a lair", themeID)
			}
			_, rooms := generateExpeditionFloor(themeID, seed, 2, 3, 1, nil)
			for _, room := range rooms {
				if room.RoomType != "lair" {
					continue
				}
				found = true
				boss := room.Encounter.Enemies[0]
				if room.Name != theme.Lair.RoomName || len(boss.Mechanics) == 0 || boss.hasMechanic(BossMechanicEnrage) || len(boss.Traits) == 0 {
					t.Fatalf("%s: the lair boss should be armed with its mechanics and traits, without enrage: %+v", themeID, boss)
				}
			}
		}
		if !found {
			t.Errorf("%s: no lair on a second floor in 200 seeds", themeID)
		}
	}
}

func hasLair(rooms map[string]*DungeonRoom) bool {
	for _, room := range rooms {
		if room.RoomType == "lair" {
			return true
		}
	}
	return false
}
