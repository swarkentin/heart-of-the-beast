package game

import "fmt"

// Capstone castles. Every fifth dungeon of an expedition, after each group of four, the crossroads offers no
// ordinary themes: the party chooses between the two castles, the Eldritch Castle and the Infernal Citadel. A
// castle is the group's finale:
//
//   - it is always CapstoneFloors floors deep, and its enemies fight as if CapstoneExtraDepth floors deeper still;
//   - its monsters are a step tougher and its fights field three of them (themes_new.go);
//   - every one of its bosses has mechanics, floor guardians included, and the castles bring four mechanics no
//     other dungeon has (below);
//   - beating any of its bosses lets every adventurer choose a boon (boons.go).
//
// The capstone mechanics:
//
//	anchor   the boss is held to the world by anchors. On its first turn, and every BossAnchorEveryTurns turns
//	         after that while none stand, it raises BossAnchorCount anchor monsters (up to BossAnchorWaves waves).
//	         While any anchor stands the boss takes half damage. Cut the anchors, then the boss.
//	rebirth  the first time the boss falls it rises again at BossRebirthHealthPercent of its health. Save
//	         something for its second life.
//	legion   every BossLegionEveryTurns turns the boss calls one servant, while fewer than BossLegionMax stand.
//	devour   every BossDevourEveryTurns turns the boss eats every servant still standing: it heals
//	         BossDevourHeal and its hits land 1 harder for each (up to BossDevourMaxBonus). Kill the servants
//	         before it feeds.
const (
	BossMechanicAnchor  = "anchor"
	BossMechanicRebirth = "rebirth"
	BossMechanicLegion  = "legion"
	BossMechanicDevour  = "devour"

	BossAnchorCount          = 2
	BossAnchorEveryTurns     = 4
	BossAnchorWaves          = 3
	BossAnchorHealthPercent  = 60
	BossRebirthHealthPercent = 50
	BossLegionEveryTurns     = 3
	BossLegionMax            = 2
	BossDevourEveryTurns     = 4
	BossDevourHeal           = 6
	BossDevourMaxBonus       = 3

	// CapstoneEvery is the dungeon number of the first castle, and the spacing between castles: dungeons 5, 10,
	// 15... are castles, so each castle crowns a group of four ordinary dungeons.
	CapstoneEvery = 5
	// CapstoneFloors is the depth of every castle.
	CapstoneFloors = 4
	// CapstoneExtraDepth is how much deeper than its floor a castle's enemies fight, on top of the expedition's
	// usual scaling for later dungeons.
	CapstoneExtraDepth = 1
)

// IsCapstoneDungeon reports whether the nth dungeon of an expedition is a capstone castle.
func IsCapstoneDungeon(dungeon int) bool { return dungeon > 0 && dungeon%CapstoneEvery == 0 }

// dungeonFloors is the number of floors of the nth dungeon of an expedition, in a theme.
func dungeonFloors(seed uint64, dungeon int, themeID string) int {
	if IsCapstoneTheme(themeID) {
		return CapstoneFloors
	}
	return expeditionDepth(dungeonSeed(seed, dungeon))
}

func armCapstoneMechanics(enemy *Enemy, final FinalBossTemplate) {
	if enemy.hasMechanic(BossMechanicAnchor) {
		enemy.AnchorMonsterID = final.AnchorMonsterID
		enemy.AnchorWavesLeft = BossAnchorWaves
	}
	if enemy.hasMechanic(BossMechanicRebirth) {
		enemy.RebirthLabel = final.RebirthLabel
	}
	if enemy.hasMechanic(BossMechanicLegion) {
		enemy.LegionMonsterID = final.LegionMonsterID
	}
	if enemy.hasMechanic(BossMechanicDevour) {
		enemy.DevourIn = BossDevourEveryTurns
	}
}

// applyCapstoneMechanics resolves the start-of-round capstone mechanics of the boss at index. It runs with the
// rest of applyBossMechanics, before intents are built, so the party sees the round it has to answer.
func applyCapstoneMechanics(room *Room, encounter *Encounter, index, round int) {
	run := room.Run
	boss := &encounter.Enemies[index]
	turn := boss.TurnsTaken
	// A boss that both feeds and calls feeds first, so the servant it calls this turn lives to be next turn's meal.
	if boss.hasMechanic(BossMechanicDevour) && turn%BossDevourEveryTurns == 0 {
		devourServants(run, encounter, index, round)
		boss = &encounter.Enemies[index]
	}
	if boss.hasMechanic(BossMechanicLegion) && turn%BossLegionEveryTurns == 0 && livingServants(encounter, index) < BossLegionMax {
		if name, ok := callServant(run, encounter, index, boss.LegionMonsterID, "legion", 100); ok {
			addCombatEvent(run, round, "boss_legion", encounter.Enemies[index].Name+" calls its legion. "+name+" answers!")
		}
		boss = &encounter.Enemies[index]
	}
	if boss.hasMechanic(BossMechanicAnchor) && boss.AnchorWavesLeft > 0 && (turn == 1 || turn%BossAnchorEveryTurns == 1) && livingAnchors(encounter, index) == 0 {
		boss.AnchorWavesLeft--
		raised := 0
		for i := 0; i < BossAnchorCount; i++ {
			if _, ok := callServant(run, encounter, index, boss.AnchorMonsterID, "anchor", BossAnchorHealthPercent); ok {
				raised++
			}
		}
		boss = &encounter.Enemies[index]
		if raised > 0 {
			addCombatEvent(run, round, "boss_anchor", boss.Name+" anchors itself with "+itoa(raised)+" grasping limbs. While any stands it takes half damage.")
		}
	}
	boss.Anchored = boss.hasMechanic(BossMechanicAnchor) && livingAnchors(encounter, index) > 0
	if boss.hasMechanic(BossMechanicDevour) {
		boss.DevourIn = BossDevourEveryTurns - turn%BossDevourEveryTurns
		if boss.DevourIn == 1 && livingServants(encounter, index) > 0 {
			addCombatEvent(run, round, "boss_hunger", boss.Name+" eyes its servants hungrily. It will devour any still standing next turn.")
		}
	}
}

// livingServants counts the living enemies, other than the boss at index, that are not bosses themselves.
func livingServants(encounter *Encounter, index int) int {
	count := 0
	for i := range encounter.Enemies {
		if i != index && encounter.Enemies[i].Health > 0 && !encounter.Enemies[i].Anchor && !isBossEnemy(&encounter.Enemies[i]) {
			count++
		}
	}
	return count
}

func livingAnchors(encounter *Encounter, index int) int {
	count := 0
	for i := range encounter.Enemies {
		if i != index && encounter.Enemies[i].Anchor && encounter.Enemies[i].Health > 0 {
			count++
		}
	}
	return count
}

// callServant adds one monster to the boss's side, at healthPercent of its scaled health. It reuses the slot of a
// fallen summoned enemy before growing the encounter, so a long fight never runs out of room. It returns the new
// enemy's name.
func callServant(run *Run, encounter *Encounter, index int, monsterID, kind string, healthPercent int) (string, bool) {
	boss := &encounter.Enemies[index]
	boss.Calls++
	scaling := MonsterScaling{Depth: run.Depth + dungeonExtraDepth(run), PartySize: len(run.Players)}
	add, err := defaultMonsterCatalog.NewEnemy(fmt.Sprintf("%s-%s-%d", boss.ID, kind, boss.Calls), monsterID, scaling)
	if err != nil {
		return "", false
	}
	add.Health = int(float64(add.Health)*LiveEnemyHealthMultiplier*float64(healthPercent)/100 + 0.5)
	if add.Health < 1 {
		add.Health = 1
	}
	add.MaxHealth = add.Health
	add.Summoned = true
	add.Anchor = kind == "anchor"
	add.TurnsTaken = 1
	for i := range encounter.Enemies {
		if i != index && encounter.Enemies[i].Summoned && encounter.Enemies[i].Health <= 0 {
			encounter.Enemies[i] = add
			return add.Name, true
		}
	}
	if len(encounter.Enemies) >= MaxEncounterEnemies {
		return "", false
	}
	encounter.Enemies = append(encounter.Enemies, add)
	return add.Name, true
}

// devourServants lets the boss at index eat every servant still standing.
func devourServants(run *Run, encounter *Encounter, index, round int) {
	eaten := 0
	for i := range encounter.Enemies {
		servant := &encounter.Enemies[i]
		if i == index || servant.Health <= 0 || servant.Anchor || isBossEnemy(servant) {
			continue
		}
		servant.Health = 0
		servant.Intent = nil
		eaten++
	}
	boss := &encounter.Enemies[index]
	if eaten == 0 {
		addCombatEvent(run, round, "boss_devour", boss.Name+" reaches for its servants and finds none left. It goes hungry.")
		return
	}
	transition := resolveHealthHealing(boss.Health, boss.MaxHealth, BossDevourHeal*eaten)
	boss.Health = transition.Health
	bonus := eaten
	if boss.Devoured+bonus > BossDevourMaxBonus {
		bonus = BossDevourMaxBonus - boss.Devoured
	}
	boss.Devoured += bonus
	boss.DamageBonus += bonus
	message := fmt.Sprintf("%s devours %d of its servants, heals %d", boss.Name, eaten, transition.Applied)
	if bonus > 0 {
		message += fmt.Sprintf(" and hits %d harder from now on", bonus)
	}
	addCombatImpact(run, round, "boss_devour", message+".", "heal", boss.ID, "enemy", transition.Applied)
}

// anchoredDamage halves the damage a boss takes while one of its anchors stands.
func anchoredDamage(encounter *Encounter, enemy *Enemy, damage int) int {
	if encounter == nil || damage <= 0 || !enemy.hasMechanic(BossMechanicAnchor) {
		return damage
	}
	for i := range encounter.Enemies {
		if other := &encounter.Enemies[i]; other.Anchor && other.Health > 0 && other.ID != enemy.ID {
			return (damage + 1) / 2
		}
	}
	return damage
}

// applyBossRebirths raises every rebirth boss that fell this round, once. It runs after the round has resolved
// and before the encounter is checked for victory, so a fight is never won against a boss with a life left.
func applyBossRebirths(run *Run, encounter *Encounter, round int) {
	for i := range encounter.Enemies {
		boss := &encounter.Enemies[i]
		if boss.Health > 0 || boss.Reborn || !boss.hasMechanic(BossMechanicRebirth) {
			continue
		}
		boss.Reborn = true
		boss.Health = boss.MaxHealth * BossRebirthHealthPercent / 100
		if boss.Health < 1 {
			boss.Health = 1
		}
		boss.Bleed, boss.BleedRounds, boss.Stun, boss.Barrier = 0, 0, 0, 0
		boss.Intent = nil
		addCombatImpact(run, round, "boss_rebirth", boss.Name+" rises again: "+boss.RebirthLabel+"!", "heal", boss.ID, "enemy", boss.Health)
	}
}

// capstoneAdvice is the briefing line for a capstone mechanic.
func capstoneAdvice(mechanic string, final FinalBossTemplate) string {
	name := func(id string) string {
		if monster, err := defaultMonsterCatalog.Monster(id); err == nil {
			return monster.Name
		}
		return "servants"
	}
	switch mechanic {
	case BossMechanicAnchor:
		return fmt.Sprintf("It is anchored by %s. While any stands it takes half damage; cut them first, and again when they grow back.", name(final.AnchorMonsterID))
	case BossMechanicRebirth:
		return fmt.Sprintf("The first time it falls it rises again at %d%% health (%s). Keep a cooldown in hand.", BossRebirthHealthPercent, final.RebirthLabel)
	case BossMechanicLegion:
		return fmt.Sprintf("Every %d turns it calls a %s to its side.", BossLegionEveryTurns, name(final.LegionMonsterID))
	case BossMechanicDevour:
		return fmt.Sprintf("Every %d turns it devours every servant still standing, healing and growing stronger for each. Kill them before it feeds.", BossDevourEveryTurns)
	}
	return ""
}

func eldritchExpeditionTheme() ExpeditionTheme {
	return ExpeditionTheme{
		ThemeID: "eldritch",
		Entries: []FloorRoomTemplate{
			hall("The Drowned Causeway", "A road of black stone runs out across still water to the castle gate. The water has eyes in it."),
			hall("The Gatehouse of Teeth", "The portcullis is made of something that grew, not something that was forged. It opens like a jaw."),
		},
		Halls: []FloorRoomTemplate{
			hall("The Hall of Portraits", "Every painting is of the same face, and every face is a little less human than the last."),
			hall("The Flooded Chapel", "Pews stand knee-deep in black water. The congregation is still here, still chanting."),
			hall("The Spiral Stair", "It goes down further than the castle is tall. The steps are worn by something that did not walk."),
			hall("The Observatory", "A brass telescope points at the floor. Through it you can see the thing that sleeps below, turning over."),
			hall("The Banquet Hall", "The table is set for a hundred. The food has been rotting for a hundred years, and something is still eating it."),
			hall("The Weeping Gallery", "The stone walls weep a sick green ichor that pools into words nobody can read."),
		},
		Discoveries: []DiscoveryTemplate{
			discovery("The Dreaming Font", "A basin of water that shows not your reflection but your dream of yourself, larger and stranger.", "Drink of the Dream", "The dream is stronger than you. It would like to be you.",
				option("Drink deeply", "blood_pact"), option("Let a drop touch your tongue", "cursed_boon"), option("Look away", "leave")),
			discovery("The Anatomist's Table", "Instruments laid out in a careful row beside a body that is still, faintly, breathing.", "The Anatomist's Craft", "These tools could improve you. The last patient seems to have disagreed.",
				option("Accept the operation", "risky_draught"), option("Strip the armoury rack", "heavy_plate"), option("Leave the patient in peace", "leave")),
			discovery("The Reliquary of Eyes", "Jars of eyes on shelves, all of them turning to follow you. One shelf holds coins instead.", "They Are Watching", "Take what you like. They will remember.",
				option("Pocket the coins", "greedy_haul"), option("Pry open the sealed jar", "trapped_cache"), option("Back away slowly", "leave")),
		},
		Vault: discovery("The Treasury Below the Waterline", "A vault half full of water, gold glinting under the surface, and a crown floating on top.", "The Drowned Crown", "The gold is heavy. The crown is light, and it whispers.",
			option("Haul up the gold", "vault_coin"), option("Put on the crown", "vault_relic"), option("Let the water keep it", "leave")),
		Elite:    hall("The Knight-Chapter House", "The castle's sworn guard kneel in rows before a hollow altar. They rise as one. Defeating them will strengthen the whole party."),
		Guard:    hall("The Sunken Stair", "The stair down is guarded by things that came up from the water to stand watch."),
		Light:    []string{"eldritch-vestibule"},
		Standard: []string{"eldritch-congregation", "eldritch-library", "eldritch-flooded-hall"},
		Heavy:    []string{"eldritch-honour-guard", "eldritch-well"},
		EliteID:  "eldritch-well",
		ArmedGuardians: []FinalBossTemplate{
			{
				FloorBossTemplate: guardian("The Cathedral of Sleep", "eldritch-boss-dreaming-bishop", "The bishop sits on his throne with his eyes closed. The eyes on his robes open instead, all of them."),
				Mechanics:         []string{BossMechanicRebirth, BossMechanicCataclysm}, RebirthLabel: "He wakes from the dream", CataclysmLabel: "Mass of Madness",
			},
			{
				FloorBossTemplate: guardian("The Chapel Loft", "eldritch-boss-choir-of-mouths", "The organ pipes are throats. The choir in the loft is one creature, and it has been rehearsing for you."),
				Mechanics:         []string{BossMechanicAnchor}, AnchorMonsterID: "grasping-tentacle",
			},
		},
		Final: FinalBossTemplate{
			FloorBossTemplate: guardian("The Sleeper's Cistern", "eldritch-boss-the-sleeper", "At the root of the castle the floor ends in black water, and the castle's foundations are a skull. The eye in it opens."),
			Mechanics:         []string{BossMechanicAnchor, BossMechanicRebirth, BossMechanicCataclysm}, AnchorMonsterID: "grasping-tentacle", RebirthLabel: "It dreams itself whole", CataclysmLabel: "The Drowning Dream",
		},
		Lair: FinalBossTemplate{
			FloorBossTemplate: guardian("The Unwritten Stacks", "eldritch-lair", "Shelves of blank books, and a librarian made of the stories nobody finished. It is writing you in."),
			Mechanics:         []string{BossMechanicBarrier}, BarrierLabel: "Margin Notes",
		},
		ClearedText: "The eye closes, and this time it does not open. The Eldritch Castle is cleared!",
	}
}

func infernalExpeditionTheme() ExpeditionTheme {
	return ExpeditionTheme{
		ThemeID: "infernal",
		Entries: []FloorRoomTemplate{
			hall("The Gate of Brass", "Two brass doors the height of a cathedral, warm to the touch and getting warmer. Something on the other side is laughing."),
			hall("The Bridge of Sighs", "A bridge of black glass over a river of fire. The sighs are coming from the bridge."),
		},
		Halls: []FloorRoomTemplate{
			hall("The Hall of Contracts", "Scrolls hang from the ceiling like bats, every one signed in blood. A few still have room for a name."),
			hall("The Torture Garden", "Iron trees, thorned with hooks, in beds of glowing coal. The gardeners are proud of their work."),
			hall("The Brimstone Mine", "Imps with picks hack yellow crystal out of the walls, under the whip of something bigger."),
			hall("The Kennels", "Chains, bones, and the smell of burnt fur. The hounds are not in their cages."),
			hall("The Throne Antechamber", "Petitioners in rags wait in a line that has not moved in a thousand years."),
			hall("The Molten Cloister", "A courtyard where the paving stones float on lava. Step lightly, and step on the right ones."),
		},
		Discoveries: []DiscoveryTemplate{
			discovery("The Infernal Notary", "A desk, a quill and a demon in spectacles who would be delighted to draw up an agreement.", "Terms and Conditions", "Everything is negotiable. The fine print is not.",
				option("Sign the full contract", "blood_pact"), option("Sign the trial agreement", "cursed_boon"), option("Decline politely", "leave")),
			discovery("The Hellforge Rack", "A rack of freshly forged arms, still glowing, each one etched with a name that is not yours.", "Borrowed Arms", "They were made for demons. They do not like human hands.",
				option("Take the demon plate", "heavy_plate"), option("Take the burning blade", "glass_edge"), option("Leave them to cool", "leave")),
			discovery("The Fountain of Fire", "A fountain that pours liquid flame. Imps dip their cups in it and come back healed. Mostly.", "Drink the Fire", "It heals. It also burns. Sometimes it only burns.",
				option("Drink from the fountain", "risky_draught"), option("Rest by its warmth", "vital_tithe"), option("Keep your distance", "leave")),
		},
		Vault: discovery("The Archfiend's Treasury", "A hoard of every gold coin ever sold for a soul, and in the middle of it a ring of black iron.", "The Price of Souls", "The gold is cursed only a little. The ring is cursed exactly enough.",
			option("Take a fistful of gold", "vault_coin"), option("Wear the black ring", "vault_relic"), option("Leave the hoard to its owner", "leave")),
		Elite:    hall("The Fighting Pits", "Demons bet on blood here. Tonight the main event is you. Defeating the champions will strengthen the whole party."),
		Guard:    hall("The Throne Stair", "The Archfiend's household guard holds the stair. They have been waiting all eternity for a fight."),
		Light:    []string{"infernal-gate"},
		Standard: []string{"infernal-kennels", "infernal-pyre", "infernal-cells"},
		Heavy:    []string{"infernal-barracks", "infernal-pit"},
		EliteID:  "infernal-pit",
		ArmedGuardians: []FinalBossTemplate{
			{
				FloorBossTemplate: guardian("The Hellforge", "infernal-boss-hellforge-smith", "An anvil the size of a wagon sits in a lake of slag. The smith looks up from the blade it is hammering, and smiles."),
				Mechanics:         []string{BossMechanicBarrier, BossMechanicCataclysm}, BarrierLabel: "Forged Plate", CataclysmLabel: "Hellforge Eruption",
			},
			{
				FloorBossTemplate: guardian("The Hall of Chains", "infernal-boss-chain-duke", "Chains hang from the vaulted ceiling, each holding a cage, each cage holding a servant. The Duke rattles them and they wake."),
				Mechanics:         []string{BossMechanicLegion, BossMechanicDevour}, LegionMonsterID: "cackling-imp",
			},
		},
		Final: FinalBossTemplate{
			FloorBossTemplate: guardian("The Burning Throne", "infernal-boss-archfiend", "A throne of wings and fire at the heart of the citadel. Archfiend Malgareth stands, and the imps at its feet start to scream."),
			Mechanics:         []string{BossMechanicLegion, BossMechanicDevour, BossMechanicCataclysm}, LegionMonsterID: "cackling-imp", CataclysmLabel: "Rain of Hellfire",
		},
		Lair: FinalBossTemplate{
			FloorBossTemplate: guardian("The Gullet", "infernal-lair", "The floor of this hall is a mouth. It has been fed everything the citadel throws away, and it is still hungry."),
			Mechanics:         []string{BossMechanicSummon}, SummonMonsterID: "cinder-wretch",
		},
		ClearedText: "Archfiend Malgareth burns down to ash. The Infernal Citadel is cleared!",
	}
}
