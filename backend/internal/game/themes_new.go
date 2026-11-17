package game

import "github.com/swarkentin/heart-of-the-beast/backend/internal/art"

// Content for the four themes added after the first eleven: two ordinary themes (Noir City and the 8-Bit Arcade)
// and the two capstone castles (the Eldritch Castle and the Infernal Citadel, see capstone.go).
//
// Monsters follow the role templates of monster_catalog_themes.go and the trait templates of theme_variety.go.
// Capstone monsters are a step harder: +2 health and +1 damage on every move, and their encounters field three
// monsters where an ordinary theme fields two.

// capstoneHealthBonus and capstoneDamageBonus are what a capstone castle's monsters add to the role templates.
const (
	capstoneHealthBonus = 2
	capstoneDamageBonus = 1
)

// roleMoves builds the two moves of a role template for monster id, named attack and special. It returns the
// abilities and the monster's ability IDs in the order the behavior reads them.
func roleMoves(id, role, attack, special string, bonus int) ([]AbilityDefinition, []string) {
	a, b := id+"-attack", id+"-special"
	both := []string{b, a}
	only := []string{a}
	switch role {
	case "striker":
		return []AbilityDefinition{{ID: a, Label: attack, Kind: "quick_strike", Damage: 3 + bonus}, {ID: b, Label: special, Kind: "special_strike", Damage: 5 + bonus, EveryTurns: 3}}, both
	case "protector":
		return []AbilityDefinition{{ID: a, Label: attack, Kind: "heavy_strike", Damage: 7 + bonus, EveryTurns: 2, TurnRemainder: 1}, {ID: b, Label: special, Kind: "strike", Damage: 4 + bonus}}, []string{a, b}
	case "bruiser":
		return []AbilityDefinition{{ID: a, Label: attack, Kind: "crusher", Damage: 8 + bonus, Interruptible: true, EveryTurns: 2}, {ID: b, Label: special, Kind: "strike", Damage: 5 + bonus}}, []string{a, b}
	case "disruptor":
		return []AbilityDefinition{{ID: a, Label: attack, Kind: "bolt", Damage: 4 + bonus}, {ID: b, Label: special, Kind: "wail", Damage: 2 + bonus, TargetAll: true, EveryTurns: 3}}, both
	case "support":
		return []AbilityDefinition{{ID: a, Label: attack, Kind: "quick_strike", Damage: 3 + bonus}, {ID: b, Label: special, Kind: "cloud", Damage: 2, Heal: 2 + bonus, TargetAll: true, EveryTurns: 3}}, both
	case "boss-drain":
		return []AbilityDefinition{{ID: a, Label: attack, Kind: "drain", Damage: 5 + bonus, Heal: 2, Interruptible: true, ExceptEveryTurns: 3}, {ID: b, Label: special, Kind: "sweep", Damage: 3 + bonus, TargetAll: true, EveryTurns: 3}}, []string{a, b}
	case "boss-slam":
		return []AbilityDefinition{{ID: a, Label: attack, Kind: "crusher", Damage: 10 + bonus, Interruptible: true, EveryTurns: 2}, {ID: b, Label: special, Kind: "sweep", Damage: 3 + bonus, TargetAll: true, EveryTurns: 2, TurnRemainder: 1}}, []string{a, b}
	case "boss-relentless":
		return []AbilityDefinition{{ID: a, Label: attack, Kind: "strike", Damage: 4 + bonus}, {ID: b, Label: special, Kind: "heavy_strike", Damage: 9 + bonus, Interruptible: true, EveryTurns: 3}}, both
	case "lair":
		return []AbilityDefinition{{ID: a, Label: attack, Kind: "strike", Damage: 5 + bonus}, {ID: b, Label: special, Kind: "sweep", Damage: 2 + bonus, TargetAll: true, EveryTurns: 3}}, both
	// Trait monsters (theme_variety.go): a fuse or a warder only has its one move, the trait is the rest.
	case "fuse":
		return []AbilityDefinition{{ID: a, Label: attack, Kind: "quick_strike", Damage: 2 + bonus}}, only
	case "warder":
		return []AbilityDefinition{{ID: a, Label: attack, Kind: "quick_strike", Damage: 3 + bonus}}, only
	case "splits":
		return []AbilityDefinition{{ID: a, Label: attack, Kind: "quick_strike", Damage: 3 + bonus}, {ID: b, Label: special, Kind: "special_strike", Damage: 4 + bonus, EveryTurns: 3}}, both
	case "bodyguard":
		return []AbilityDefinition{{ID: a, Label: attack, Kind: "strike", Damage: 3 + bonus}, {ID: b, Label: special, Kind: "heavy_strike", Damage: 5 + bonus, EveryTurns: 3}}, both
	}
	panic("unknown role template " + role)
}

type newMonster struct {
	sprite          art.SpriteID
	id, name, role  string
	attack, special string
	traits          []MonsterTrait
	capstone        bool
	healthOverride  int
}

func newThemeMonsterContent() ([]AbilityDefinition, []MonsterDefinition) {
	fuse := func(label string) []MonsterTrait {
		return []MonsterTrait{{Kind: TraitFuse, Every: VarietyFuseTurns, Amount: VarietyFuseDamage, Label: label}}
	}
	one := func(kind string, amount, every int) []MonsterTrait {
		return []MonsterTrait{{Kind: kind, Amount: amount, Every: every}}
	}
	entries := []newMonster{
		// Noir City
		{sprite: art.NoirFedoraThug, id: "fedora-thug", name: "Fedora Thug", role: "striker", attack: "Pistol whip", special: "Snub-nose shot"},
		{sprite: art.NoirShadowDouble, id: "shadow-double", name: "Shadow Double", role: "disruptor", attack: "Cold shoulder", special: "Lights out"},
		{sprite: art.NoirCrookedCop, id: "crooked-cop", name: "Crooked Cop", role: "protector", attack: "Nightstick", special: "Book 'em"},
		{sprite: art.NoirSmokeDame, id: "smoke-dame", name: "Smoke Dame", role: "support", attack: "Ash flick", special: "Smoke screen"},
		{sprite: art.NoirAlleyBrute, id: "alley-brute", name: "Alley Brute", role: "bruiser", attack: "Brick to the jaw", special: "Shoulder check"},
		{sprite: art.NoirFlashbulbSnoop, id: "flashbulb-snoop", name: "Flashbulb Snoop", role: "fuse", attack: "Camera swing", traits: fuse("Flash powder")},
		{sprite: art.NoirTheMouthpiece, id: "the-mouthpiece", name: "The Mouthpiece", role: "warder", attack: "Objection", traits: one(TraitWarder, 3, 3)},
		{sprite: art.NoirTheCommissioner, id: "the-commissioner", name: "The Commissioner", role: "boss-slam", attack: "Gavel of the city", special: "Call the precinct"},
		{sprite: art.NoirTheRainKing, id: "the-rain-king", name: "The Rain King", role: "boss-drain", attack: "Downpour lance", special: "Flood the gutters"},
		{sprite: art.NoirManInShadow, id: "man-in-shadow", name: "The Man in the Shadow", role: "boss-relentless", attack: "Shadow strangle", special: "Blackout"},
		{sprite: art.NoirTheProjectionist, id: "the-projectionist", name: "The Projectionist", role: "lair", attack: "Reel lash", special: "The final reel", traits: one(TraitPhasing, 0, 0), healthOverride: VarietyPhasingLairHealth},
		// 8-Bit Arcade
		{sprite: art.ArcadePixelKnight, id: "pixel-knight", name: "Pixel Knight", role: "striker", attack: "Sword poke", special: "Dash slash"},
		{sprite: art.ArcadeBitBat, id: "bit-bat", name: "Bit Bat", role: "disruptor", attack: "Sonic beep", special: "Screech of static"},
		{sprite: art.ArcadeBrickGolem, id: "brick-golem", name: "Brick Golem", role: "protector", attack: "Brick drop", special: "Stack up"},
		{sprite: art.ArcadeOneUpSprite, id: "one-up-sprite", name: "1-Up Sprite", role: "support", attack: "Sparkle jab", special: "Power-up cloud"},
		{sprite: art.ArcadeChomperCube, id: "chomper-cube", name: "Chomper Cube", role: "bruiser", attack: "Mega chomp", special: "Bounce"},
		{sprite: art.ArcadeGlitchSlime, id: "glitch-slime", name: "Glitch Slime", role: "splits", attack: "Corrupt splash", special: "Extra life", traits: one(TraitSplits, 50, 0)},
		{sprite: art.ArcadeShieldBlock, id: "shield-block", name: "Shield Block", role: "bodyguard", attack: "Block bash", special: "Bounce back", traits: one(TraitBodyguard, 2, 0)},
		{sprite: art.ArcadeMechaDrake, id: "mecha-drake", name: "Mecha Drake", role: "boss-slam", attack: "Pixel flame", special: "Tail whip"},
		{sprite: art.ArcadeHighScorer, id: "high-scorer", name: "The High Scorer", role: "boss-drain", attack: "Combo multiplier", special: "Bonus round"},
		{sprite: art.ArcadeTheFinalBoss, id: "the-final-boss", name: "The Final Boss", role: "boss-relentless", attack: "Fist of the last level", special: "Game over beam"},
		{sprite: art.ArcadeGlitchKing, id: "glitch-king", name: "The Glitch King", role: "lair", attack: "Bit crush", special: "Corrupted save", traits: one(TraitPhasing, 0, 0), healthOverride: VarietyPhasingLairHealth},
		// The Eldritch Castle (capstone)
		{sprite: art.EldritchRobedCultist, id: "robed-cultist", name: "Robed Cultist", role: "support", attack: "Ritual knife", special: "Chant of the deep", capstone: true},
		{sprite: art.EldritchWhisperingEye, id: "whispering-eye", name: "Whispering Eye", role: "disruptor", attack: "Maddening gaze", special: "Whispers", capstone: true},
		{sprite: art.EldritchFacelessKnight, id: "faceless-knight", name: "Faceless Knight", role: "protector", attack: "Hollow cleave", special: "Empty stare", capstone: true},
		{sprite: art.EldritchGraspingTentacle, id: "grasping-tentacle", name: "Grasping Tentacle", role: "striker", attack: "Lash", special: "Constrict", capstone: true},
		{sprite: art.EldritchDeepSpawn, id: "deep-spawn", name: "Spawn of the Deep", role: "bruiser", attack: "Abyssal crush", special: "Gurgling roar", capstone: true},
		{sprite: art.EldritchMadScholar, id: "mad-scholar", name: "Mad Scholar", role: "warder", attack: "Forbidden page", traits: one(TraitWarder, 4, 3), capstone: true},
		{sprite: art.EldritchWrithingMass, id: "writhing-mass", name: "Writhing Mass", role: "splits", attack: "Engulf", special: "Bud off", traits: one(TraitSplits, 50, 0), capstone: true},
		{sprite: art.EldritchDreamingBishop, id: "dreaming-bishop", name: "The Dreaming Bishop", role: "boss-drain", attack: "Sermon of madness", special: "Wake the faithful", capstone: true},
		{sprite: art.EldritchChoirOfMouths, id: "choir-of-mouths", name: "The Choir of Mouths", role: "boss-slam", attack: "Discordant hymn", special: "Crescendo", capstone: true},
		{sprite: art.EldritchTheSleeper, id: "the-sleeper", name: "The Sleeper Beneath", role: "boss-relentless", attack: "Dream-crushing grasp", special: "The eye opens", capstone: true},
		{sprite: art.EldritchUnwrittenLibrarian, id: "unwritten-librarian", name: "The Unwritten Librarian", role: "lair", attack: "Paper cut of ages", special: "Unread chapter", traits: one(TraitRegenerate, 2, 0), capstone: true, healthOverride: VarietyLairHealth},
		// The Infernal Citadel (capstone)
		{sprite: art.InfernalCacklingImp, id: "cackling-imp", name: "Cackling Imp", role: "striker", attack: "Pitchfork jab", special: "Firebolt", capstone: true, healthOverride: 9},
		{sprite: art.InfernalHellhound, id: "hellhound", name: "Hellhound", role: "striker", attack: "Burning bite", special: "Brimstone breath", capstone: true},
		{sprite: art.InfernalBrimstoneKnight, id: "brimstone-knight", name: "Brimstone Knight", role: "protector", attack: "Hellblade", special: "Shield of cinders", capstone: true},
		{sprite: art.InfernalAshWitch, id: "ash-witch", name: "Ash Witch", role: "disruptor", attack: "Hex bolt", special: "Choir of ash", capstone: true},
		{sprite: art.InfernalPitBrute, id: "pit-brute", name: "Pit Brute", role: "bruiser", attack: "Molten fist", special: "Bellow", capstone: true},
		{sprite: art.InfernalSoulJailer, id: "soul-jailer", name: "Soul Jailer", role: "warder", attack: "Chain lash", traits: one(TraitWarder, 4, 3), capstone: true},
		{sprite: art.InfernalCinderWretch, id: "cinder-wretch", name: "Cinder Wretch", role: "fuse", attack: "Ash claw", traits: fuse("Immolate"), capstone: true},
		{sprite: art.InfernalHellforgeSmith, id: "hellforge-smith", name: "The Hellforge Smith", role: "boss-slam", attack: "Anvil strike", special: "Spray of slag", capstone: true},
		{sprite: art.InfernalChainDuke, id: "chain-duke", name: "The Chain Duke", role: "boss-drain", attack: "Hooked chains", special: "Lash of a thousand chains", capstone: true},
		{sprite: art.InfernalArchfiend, id: "archfiend", name: "Archfiend Malgareth", role: "boss-relentless", attack: "Hellfire claw", special: "Infernal judgement", capstone: true},
		{sprite: art.InfernalGluttonousMaw, id: "gluttonous-maw", name: "The Gluttonous Maw", role: "lair", attack: "Gnashing teeth", special: "Brimstone belch", traits: one(TraitSpiked, 2, 0), capstone: true, healthOverride: VarietyLairHealth},
	}
	baseHealth := map[string]int{"striker": 11, "protector": 14, "bruiser": 18, "disruptor": 10, "support": 12, "fuse": 8, "warder": 9, "splits": 8, "bodyguard": 12, "boss-drain": 30, "boss-slam": 30, "boss-relentless": 30, "lair": VarietyLairHealth}
	roleOf := map[string]MonsterRole{"striker": MonsterRoleStriker, "protector": MonsterRoleProtector, "bruiser": MonsterRoleBruiser, "disruptor": MonsterRoleDisruptor, "support": MonsterRoleSupport, "fuse": MonsterRoleStriker, "warder": MonsterRoleSupport, "splits": MonsterRoleStriker, "bodyguard": MonsterRoleProtector, "boss-drain": MonsterRoleBoss, "boss-slam": MonsterRoleBoss, "boss-relentless": MonsterRoleBoss, "lair": MonsterRoleBoss}
	var abilities []AbilityDefinition
	monsters := make([]MonsterDefinition, 0, len(entries))
	for _, e := range entries {
		bonus, healthBonus := 0, 0
		if e.capstone {
			healthBonus = capstoneHealthBonus
			if roleOf[e.role] == MonsterRoleBoss {
				bonus = capstoneDamageBonus
			}
		}
		moves, ids := roleMoves(e.id, e.role, e.attack, e.special, bonus)
		abilities = append(abilities, moves...)
		health := baseHealth[e.role]
		if e.healthOverride > 0 {
			health = e.healthOverride
		}
		perDepth := 0
		switch roleOf[e.role] {
		case MonsterRoleBoss:
			perDepth = 4
			if e.role == "lair" {
				perDepth = VarietyLairHealthPerDepth
			}
		}
		monsters = append(monsters, defineMonster(e.sprite, MonsterDefinition{
			ID: e.id, Name: e.name, Role: roleOf[e.role], BehaviorID: e.id, BaseHealth: health + healthBonus, HealthPerDepth: perDepth, AbilityIDs: ids, Traits: e.traits,
		}))
	}
	return abilities, monsters
}

func newThemeEncounters() []EncounterDefinition {
	type spawn struct {
		id   string
		cost int
	}
	enc := func(id, themeID string, spawns ...spawn) EncounterDefinition {
		definition := EncounterDefinition{ID: id, ThemeID: themeID}
		for i, s := range spawns {
			definition.Budget += s.cost
			definition.Enemies = append(definition.Enemies, EncounterMonsterDefinition{ID: "slot-" + string(rune('a'+i)), MonsterID: s.id, BudgetCost: s.cost})
		}
		return definition
	}
	boss := func(themeID, monsterID string) EncounterDefinition {
		return EncounterDefinition{ID: themeID + "-boss-" + monsterID, ThemeID: themeID, Budget: 8, Enemies: []EncounterMonsterDefinition{{ID: "boss", MonsterID: monsterID, BudgetCost: 8}}}
	}
	lair := func(themeID, monsterID string) EncounterDefinition {
		return EncounterDefinition{ID: themeID + "-lair", ThemeID: themeID, Budget: 8, Enemies: []EncounterMonsterDefinition{{ID: "boss", MonsterID: monsterID, BudgetCost: 8}}}
	}
	return []EncounterDefinition{
		// Noir City
		enc("noir-outpost", "noir", spawn{"fedora-thug", 2}),
		enc("noir-patrol", "noir", spawn{"shadow-double", 2}, spawn{"smoke-dame", 2}),
		enc("noir-vanguard", "noir", spawn{"fedora-thug", 2}, spawn{"crooked-cop", 3}),
		enc("noir-ambush", "noir", spawn{"alley-brute", 4}, spawn{"shadow-double", 2}),
		enc("noir-stakeout", "noir", spawn{"flashbulb-snoop", 2}, spawn{"fedora-thug", 2}),
		enc("noir-alibi", "noir", spawn{"the-mouthpiece", 2}, spawn{"fedora-thug", 2}),
		boss("noir", "the-commissioner"), boss("noir", "the-rain-king"), boss("noir", "man-in-shadow"), lair("noir", "the-projectionist"),
		// 8-Bit Arcade
		enc("arcade-outpost", "arcade", spawn{"pixel-knight", 2}),
		enc("arcade-patrol", "arcade", spawn{"bit-bat", 2}, spawn{"one-up-sprite", 2}),
		enc("arcade-vanguard", "arcade", spawn{"pixel-knight", 2}, spawn{"brick-golem", 3}),
		enc("arcade-ambush", "arcade", spawn{"chomper-cube", 4}, spawn{"bit-bat", 2}),
		enc("arcade-slime-level", "arcade", spawn{"glitch-slime", 2}, spawn{"pixel-knight", 2}),
		enc("arcade-shield-wall", "arcade", spawn{"shield-block", 3}, spawn{"bit-bat", 2}),
		boss("arcade", "mecha-drake"), boss("arcade", "high-scorer"), boss("arcade", "the-final-boss"), lair("arcade", "glitch-king"),
		// The Eldritch Castle: every fight but the opener fields three.
		enc("eldritch-vestibule", "eldritch", spawn{"grasping-tentacle", 2}, spawn{"robed-cultist", 2}),
		enc("eldritch-congregation", "eldritch", spawn{"robed-cultist", 2}, spawn{"whispering-eye", 2}, spawn{"grasping-tentacle", 2}),
		enc("eldritch-library", "eldritch", spawn{"mad-scholar", 2}, spawn{"grasping-tentacle", 2}, spawn{"whispering-eye", 2}),
		enc("eldritch-flooded-hall", "eldritch", spawn{"writhing-mass", 2}, spawn{"whispering-eye", 2}, spawn{"robed-cultist", 2}),
		enc("eldritch-honour-guard", "eldritch", spawn{"faceless-knight", 3}, spawn{"grasping-tentacle", 2}, spawn{"whispering-eye", 2}),
		enc("eldritch-well", "eldritch", spawn{"deep-spawn", 4}, spawn{"robed-cultist", 2}, spawn{"grasping-tentacle", 2}),
		boss("eldritch", "dreaming-bishop"), boss("eldritch", "choir-of-mouths"), boss("eldritch", "the-sleeper"), lair("eldritch", "unwritten-librarian"),
		// The Infernal Citadel
		enc("infernal-gate", "infernal", spawn{"cackling-imp", 2}, spawn{"hellhound", 2}),
		enc("infernal-kennels", "infernal", spawn{"hellhound", 2}, spawn{"cackling-imp", 2}, spawn{"ash-witch", 2}),
		enc("infernal-pyre", "infernal", spawn{"cinder-wretch", 2}, spawn{"cackling-imp", 2}, spawn{"ash-witch", 2}),
		enc("infernal-cells", "infernal", spawn{"soul-jailer", 2}, spawn{"hellhound", 2}, spawn{"cackling-imp", 2}),
		enc("infernal-barracks", "infernal", spawn{"brimstone-knight", 3}, spawn{"cackling-imp", 2}, spawn{"ash-witch", 2}),
		enc("infernal-pit", "infernal", spawn{"pit-brute", 4}, spawn{"hellhound", 2}, spawn{"cackling-imp", 2}),
		boss("infernal", "hellforge-smith"), boss("infernal", "chain-duke"), boss("infernal", "archfiend"), lair("infernal", "gluttonous-maw"),
	}
}

func newExpeditionThemes() []ExpeditionTheme {
	return []ExpeditionTheme{
		{
			ThemeID: "noir",
			Entries: []FloorRoomTemplate{
				hall("The Rain-Slick Street", "Neon that would be red if this city had colours buzzes over the gutter. Somebody in a doorway flicks away a cigarette."),
				hall("The Fire Escape", "An iron stair zigzags up the side of a tenement. Every landing has a window, and every window has a silhouette."),
			},
			Halls: []FloorRoomTemplate{
				hall("The All-Night Diner", "Coffee nobody drinks and pie nobody eats. The regulars look up from their papers all at once."),
				hall("The Detective Agency", "A frosted-glass door with a name painted on it. The name has been scratched out with a knife."),
				hall("The Pawn Shop", "Watches, wedding rings and a cabinet of revolvers, every one with a tag and a story."),
				hall("The Jazz Club Back Stairs", "A trumpet wails somewhere above. Down here the band's muscle is counting the take."),
				hall("The Railway Yard", "Steam, signal lamps and a freight car with its door open. Something in there is breathing."),
				hall("The Precinct Basement", "Evidence lockers, a single bulb on a cord, and cops who don't want what's down here found."),
			},
			Discoveries: []DiscoveryTemplate{
				discovery("The Druggist's Counter", "A pharmacist with steady hands and unsteady morals keeps a bottle under the counter.", "Under the Counter", "It'll fix what ails you. It'll also fix you to the floor for an hour.",
					option("Take the bottle", "risky_draught"), option("Sleep it off in the back", "uneasy_rest"), option("Pay for aspirin and go", "leave")),
				discovery("The Fence's Warehouse", "Crates of hot goods under a tarp. The fence is out. His dog is not.", "Hot Goods", "Everything here is somebody else's. Somebody who wants it back.",
					option("Load up on loot", "greedy_haul"), option("Jimmy the locked crate", "trapped_cache"), option("Leave it for the cops", "leave")),
				discovery("The Confessional", "A booth in a church that stays open all night. The voice on the other side is not a priest.", "A Voice Behind the Screen", "It offers absolution. It always takes something for it.",
					option("Confess in blood", "blood_pact"), option("Accept a lesser penance", "cursed_boon"), option("Walk out into the rain", "leave")),
			},
			Vault: discovery("The Safe-Deposit Box", "A bank vault after hours, one drawer pulled out. Banded bills, and a photograph that someone would kill to get back.", "Box 913", "The money spends. The photograph buys a favour from someone dangerous.",
				option("Take the money", "vault_coin"), option("Keep the photograph", "vault_relic"), option("Slide the drawer shut", "leave")),
			Elite:    hall("The Boxing Gym", "The city's hardest hitters train here after midnight. Defeating them will strengthen the whole party."),
			Guard:    hall("The Penthouse Lift", "Two men in good coats hold the elevator. It only goes up, and they decide who rides."),
			Light:    []string{"noir-outpost"},
			Standard: []string{"noir-patrol", "noir-stakeout", "noir-alibi"},
			Heavy:    []string{"noir-ambush", "noir-vanguard"},
			EliteID:  "noir-ambush",
			Guardians: []FloorBossTemplate{
				guardian("The Commissioner's Office", "noir-boss-the-commissioner", "Venetian blinds stripe the room in light and shadow. The Commissioner leans back, lights a cigar, and picks up his gavel."),
				guardian("The Storm Drain", "noir-boss-the-rain-king", "The whole city's rain ends up here. So does the thing that rules it, an umbrella for a crown."),
			},
			Final: FinalBossTemplate{
				FloorBossTemplate: guardian("The Last Streetlight", "noir-boss-man-in-shadow", "One lamp left burning at the end of the alley. The shadow under it stands up, and it is far too tall."),
				Mechanics:         []string{BossMechanicSummon, BossMechanicCataclysm}, SummonMonsterID: "shadow-double", CataclysmLabel: "Midnight",
			},
			Lair: FinalBossTemplate{
				FloorBossTemplate: guardian("The Picture Palace", "noir-lair", "A cinema with every seat empty and the projector running. The reel on the screen is of you, walking in."),
				Mechanics:         []string{BossMechanicBarrier}, BarrierLabel: "Silver Screen",
			},
			ClearedText: "The streetlight flickers out and the shadow goes with it. Noir City is cleared!",
		},
		{
			ThemeID: "arcade",
			Entries: []FloorRoomTemplate{
				hall("World 1-1", "A flat green field, a blue sky with three identical clouds, and a sign that says START. Something is already walking toward you."),
				hall("The Title Screen", "Big blinking letters fill the sky: PRESS START. You did not press anything. The game started anyway."),
			},
			Halls: []FloorRoomTemplate{
				hall("The Underground Level", "Blue bricks, a low ceiling and the same four notes of music on a loop. The floor is mostly pits."),
				hall("The Ice Stage", "Everything slides. The enemies were designed for this; you were not."),
				hall("The Lava Castle", "Rotating bars of fire and a bridge over molten pixels. The bridge looks suspiciously cuttable."),
				hall("The Moving Platforms", "Blocks drift left and right over nothing. Enemies ride them like they own them."),
				hall("The Warp Zone", "Three pipes, three numbers, and a guard who will not let you choose."),
				hall("The Bonus Room", "Coins everywhere, a timer counting down, and someone who wants the coins more than you do."),
			},
			Discoveries: []DiscoveryTemplate{
				discovery("The Question Block", "A floating block with a question mark on it, bobbing gently. Nobody knows what is inside. That is the point.", "?", "It might be a power-up. It might be the other thing.",
					option("Hit it from below", "risky_draught"), option("Stand on it and rest", "uneasy_rest"), option("Leave the mystery alone", "leave")),
				discovery("The Item Shop", "A shopkeeper behind a pixel counter, the same smile on every frame.", "IT'S DANGEROUS TO GO ALONE", "He sells armour and swords. The prices are in something other than gold.",
					option("Buy the heavy armour", "heavy_plate"), option("Buy the sharp sword", "glass_edge"), option("Just looking", "leave")),
				discovery("The Cheat Code Terminal", "A cabinet in the corner with its own little screen, waiting for a sequence of buttons.", "Up, Up, Down, Down", "Cheats always work. Cheats always cost you something.",
					option("Enter the infinite-power code", "blood_pact"), option("Enter the extra-gold code", "greedy_haul"), option("Play fair", "leave")),
			},
			Vault: discovery("The Treasure Chest Room", "A room with nothing in it but a chest and a fanfare that plays when you walk in.", "YOU GOT A CHEST!", "Coins are coins. The other item has no name, just a blinking icon.",
				option("Take the coins", "vault_coin"), option("Take the blinking item", "vault_relic"), option("Close the lid", "leave")),
			Elite:    hall("The Mini-Boss Arena", "The screen locks in place. Two health bars appear. Defeating them will strengthen the whole party."),
			Guard:    hall("The Castle Drawbridge", "The last soldiers of the level line the bridge, marching in perfect step."),
			Light:    []string{"arcade-outpost"},
			Standard: []string{"arcade-patrol", "arcade-vanguard", "arcade-slime-level"},
			Heavy:    []string{"arcade-ambush", "arcade-shield-wall"},
			EliteID:  "arcade-ambush",
			Guardians: []FloorBossTemplate{
				guardian("The Volcano Stage", "arcade-boss-mecha-drake", "The screen shakes, warning lights flash, and a robot dragon rises out of the lava with a riveted roar."),
				guardian("The High Score Table", "arcade-boss-high-scorer", "Every name on the leaderboard is the same three letters. The coin that owns them turns to face you."),
			},
			Final: FinalBossTemplate{
				FloorBossTemplate: guardian("The Last Level", "arcade-boss-the-final-boss", "The music changes. The screen goes dark. A crowned face fills it from edge to edge, and two fists rise into view."),
				Mechanics:         []string{BossMechanicBarrier, BossMechanicCataclysm}, BarrierLabel: "Power-Up Shield", CataclysmLabel: "Game Over",
			},
			Lair: FinalBossTemplate{
				FloorBossTemplate: guardian("The Corrupted Save", "arcade-lair", "The walls flicker between three different levels. A king made of bad data sits on a throne that is half missing."),
				Mechanics:         []string{BossMechanicSummon}, SummonMonsterID: "glitch-slime",
			},
			ClearedText: "THE FINAL BOSS IS DEFEATED. CONGRATULATIONS! The 8-Bit Arcade is cleared!",
		},
		eldritchExpeditionTheme(),
		infernalExpeditionTheme(),
	}
}
