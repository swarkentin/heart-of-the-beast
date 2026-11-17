package game

import "github.com/swarkentin/heart-of-the-beast/backend/internal/art"

// Theme variety: every dungeon theme gets two monsters that fight by a trait (monster_traits.go), two encounters
// that put them in its halls, and an optional lair boss with boss mechanics of its own.
//
// Numbers follow the role templates of monster_catalog_themes.go, a little softer, since each trait already asks
// something of the party: a monster with a fuse or a warder is fragile, a bodyguard or a spiked monster hits less
// hard. Lair bosses use the boss template without the final boss's extra health and do not enrage.

// themeVariety is the per-theme content added to a dungeon's encounter pools, plus its lair.
type themeVariety struct {
	Standard []string
	Heavy    []string
	Lair     FinalBossTemplate
}

func varietyMonsterContent() ([]AbilityDefinition, []MonsterDefinition) {
	abilities := []AbilityDefinition{
		// Forgotten Catacombs
		{ID: "rattling-heap-attack", Label: "Bone avalanche", Kind: "strike", Damage: 4},
		{ID: "rattling-heap-special", Label: "Clatter", Kind: "heavy_strike", Damage: 6, EveryTurns: 3},
		{ID: "candle-acolyte-attack", Label: "Wax lash", Kind: "quick_strike", Damage: 3},
		{ID: "tolling-abbot-attack", Label: "Bell hammer", Kind: "strike", Damage: 5},
		{ID: "tolling-abbot-special", Label: "Knell", Kind: "sweep", Damage: 2, TargetAll: true, EveryTurns: 3},
		// Sci-Fi Research Facility
		{ID: "volatile-canister-attack", Label: "Coolant spray", Kind: "quick_strike", Damage: 2},
		{ID: "shield-projector-attack", Label: "Pulse tap", Kind: "quick_strike", Damage: 3},
		{ID: "shield-projector-special", Label: "Field surge", Kind: "heavy_strike", Damage: 5, EveryTurns: 3},
		{ID: "specimen-omega-attack", Label: "Engulf", Kind: "strike", Damage: 5},
		{ID: "specimen-omega-special", Label: "Acid bloom", Kind: "sweep", Damage: 2, TargetAll: true, EveryTurns: 3},
		// Noir Underworld
		{ID: "firebug-attack", Label: "Lit match", Kind: "quick_strike", Damage: 2},
		{ID: "hired-muscle-attack", Label: "Haymaker", Kind: "strike", Damage: 3},
		{ID: "hired-muscle-special", Label: "Crowbar swing", Kind: "heavy_strike", Damage: 5, EveryTurns: 3},
		{ID: "ledger-ghost-attack", Label: "Overdue notice", Kind: "bolt", Damage: 5},
		{ID: "ledger-ghost-special", Label: "Audit", Kind: "sweep", Damage: 2, TargetAll: true, EveryTurns: 3},
		// Sunken Kingdom
		{ID: "brine-polyp-attack", Label: "Stinging spray", Kind: "quick_strike", Damage: 3},
		{ID: "twin-eel-attack", Label: "Double bite", Kind: "quick_strike", Damage: 3},
		{ID: "twin-eel-special", Label: "Coil", Kind: "special_strike", Damage: 4, EveryTurns: 3},
		{ID: "pearl-leviathan-attack", Label: "Crushing maw", Kind: "strike", Damage: 5},
		{ID: "pearl-leviathan-special", Label: "Undertow", Kind: "sweep", Damage: 2, TargetAll: true, EveryTurns: 3},
		// Clockwork Citadel
		{ID: "windup-bomber-attack", Label: "Ram", Kind: "quick_strike", Damage: 2},
		{ID: "repair-automaton-attack", Label: "Wrench swing", Kind: "quick_strike", Damage: 3},
		{ID: "grand-orrery-attack", Label: "Orbital strike", Kind: "bolt", Damage: 5},
		{ID: "grand-orrery-special", Label: "Spin the spheres", Kind: "sweep", Damage: 2, TargetAll: true, EveryTurns: 3},
		// Carnival of Nightmares
		{ID: "mirror-jester-attack", Label: "Shard cut", Kind: "bolt", Damage: 4},
		{ID: "mirror-jester-special", Label: "Hall of mirrors", Kind: "wail", Damage: 2, TargetAll: true, EveryTurns: 3},
		{ID: "fire-eater-attack", Label: "Fire breath", Kind: "strike", Damage: 3},
		{ID: "fire-eater-special", Label: "Flame wreath", Kind: "heavy_strike", Damage: 5, EveryTurns: 3},
		{ID: "calliope-golem-attack", Label: "Organ slam", Kind: "strike", Damage: 5},
		{ID: "calliope-golem-special", Label: "Steam whistle", Kind: "sweep", Damage: 2, TargetAll: true, EveryTurns: 3},
		// Overgrown Jungle
		{ID: "thornback-beetle-attack", Label: "Horn charge", Kind: "strike", Damage: 3},
		{ID: "thornback-beetle-special", Label: "Trample", Kind: "heavy_strike", Damage: 5, EveryTurns: 3},
		{ID: "budding-mass-attack", Label: "Spore spit", Kind: "quick_strike", Damage: 3},
		{ID: "hive-queen-attack", Label: "Stinger", Kind: "strike", Damage: 5},
		{ID: "hive-queen-special", Label: "Swarm cloud", Kind: "sweep", Damage: 2, TargetAll: true, EveryTurns: 3},
		// Dreamscape
		{ID: "doppel-wisp-attack", Label: "Mimic bolt", Kind: "bolt", Damage: 4},
		{ID: "doppel-wisp-special", Label: "Swap faces", Kind: "wail", Damage: 2, TargetAll: true, EveryTurns: 3},
		{ID: "lullaby-moth-attack", Label: "Drowsy dust", Kind: "quick_strike", Damage: 3},
		{ID: "nightmare-mare-attack", Label: "Trample", Kind: "strike", Damage: 5},
		{ID: "nightmare-mare-special", Label: "Night terror", Kind: "sweep", Damage: 2, TargetAll: true, EveryTurns: 3},
		// Arctic Station
		{ID: "frostback-attack", Label: "Maul", Kind: "strike", Damage: 3},
		{ID: "frostback-special", Label: "Shard charge", Kind: "heavy_strike", Damage: 5, EveryTurns: 3},
		{ID: "overheating-generator-attack", Label: "Arc spark", Kind: "quick_strike", Damage: 2},
		{ID: "permafrost-maw-attack", Label: "Thawing grasp", Kind: "strike", Damage: 5},
		{ID: "permafrost-maw-special", Label: "Hailstorm", Kind: "sweep", Damage: 2, TargetAll: true, EveryTurns: 3},
		// Ghost Town
		{ID: "vengeful-deputy-attack", Label: "Six-shooter", Kind: "quick_strike", Damage: 3},
		{ID: "vengeful-deputy-special", Label: "Fan the hammer", Kind: "special_strike", Damage: 5, EveryTurns: 3},
		{ID: "dust-devil-attack", Label: "Grit lash", Kind: "bolt", Damage: 4},
		{ID: "dust-devil-special", Label: "Sandblast", Kind: "wail", Damage: 2, TargetAll: true, EveryTurns: 3},
		{ID: "hanging-judge-attack", Label: "Gavel", Kind: "strike", Damage: 5},
		{ID: "hanging-judge-special", Label: "Sentence", Kind: "sweep", Damage: 2, TargetAll: true, EveryTurns: 3},
		// Wasteland
		{ID: "rad-roach-brood-attack", Label: "Nibble", Kind: "quick_strike", Damage: 3},
		{ID: "rad-roach-brood-special", Label: "Rad spit", Kind: "special_strike", Damage: 4, EveryTurns: 3},
		{ID: "scrap-shieldbearer-attack", Label: "Shield bash", Kind: "strike", Damage: 3},
		{ID: "scrap-shieldbearer-special", Label: "Shove", Kind: "heavy_strike", Damage: 5, EveryTurns: 3},
		{ID: "rad-behemoth-attack", Label: "Crater stomp", Kind: "strike", Damage: 5},
		{ID: "rad-behemoth-special", Label: "Toxic belch", Kind: "sweep", Damage: 2, TargetAll: true, EveryTurns: 3},
	}
	type entry struct {
		sprite    art.SpriteID
		id, name  string
		role      MonsterRole
		health    int
		abilities []string
		traits    []MonsterTrait
	}
	fuse := func(label string) []MonsterTrait {
		return []MonsterTrait{{Kind: TraitFuse, Every: VarietyFuseTurns, Amount: VarietyFuseDamage, Label: label}}
	}
	one := func(kind string, amount, every int) []MonsterTrait {
		return []MonsterTrait{{Kind: kind, Amount: amount, Every: every}}
	}
	both := func(id string) []string { return []string{id + "-special", id + "-attack"} }
	only := func(id string) []string { return []string{id + "-attack"} }
	entries := []entry{
		{art.CatacombsRattlingHeap, "rattling-heap", "Rattling Heap", MonsterRoleProtector, 12, both("rattling-heap"), one(TraitSplits, 50, 0)},
		{art.CatacombsCandleAcolyte, "candle-acolyte", "Candle Acolyte", MonsterRoleSupport, 9, only("candle-acolyte"), one(TraitWarder, 3, 3)},
		{art.ScifiVolatileCanister, "volatile-canister", "Volatile Canister", MonsterRoleStriker, 8, only("volatile-canister"), fuse("Critical breach")},
		{art.ScifiShieldProjector, "shield-projector", "Shield Projector", MonsterRoleProtector, 12, both("shield-projector"), one(TraitBodyguard, 2, 0)},
		{art.MobsterFirebug, "firebug", "Firebug", MonsterRoleStriker, 8, only("firebug"), fuse("Dynamite bundle")},
		{art.MobsterHiredMuscle, "hired-muscle", "Hired Muscle", MonsterRoleProtector, 12, both("hired-muscle"), one(TraitBodyguard, 2, 0)},
		{art.SunkenBrinePolyp, "brine-polyp", "Brine Polyp", MonsterRoleSupport, 10, only("brine-polyp"), one(TraitRegenerate, 2, 0)},
		{art.SunkenTwinEel, "twin-eel", "Twin-Eel", MonsterRoleStriker, 8, both("twin-eel"), one(TraitSplits, 50, 0)},
		{art.ClockworkWindupBomber, "windup-bomber", "Wind-up Bomber", MonsterRoleStriker, 8, only("windup-bomber"), fuse("Spring release")},
		{art.ClockworkRepairAutomaton, "repair-automaton", "Repair Automaton", MonsterRoleSupport, 9, only("repair-automaton"), one(TraitWarder, 3, 3)},
		{art.CarnivalMirrorJester, "mirror-jester", "Mirror Jester", MonsterRoleDisruptor, 9, both("mirror-jester"), one(TraitPhasing, 0, 0)},
		{art.CarnivalFireEater, "fire-eater", "Fire Eater", MonsterRoleProtector, 12, both("fire-eater"), one(TraitSpiked, 2, 0)},
		{art.JungleThornbackBeetle, "thornback-beetle", "Thornback Beetle", MonsterRoleProtector, 12, both("thornback-beetle"), one(TraitSpiked, 2, 0)},
		{art.JungleBuddingMass, "budding-mass", "Budding Mass", MonsterRoleSupport, 10, only("budding-mass"), one(TraitSplits, 50, 0)},
		{art.DreamscapeDoppelWisp, "doppel-wisp", "Doppel Wisp", MonsterRoleDisruptor, 9, both("doppel-wisp"), one(TraitPhasing, 0, 0)},
		{art.DreamscapeLullabyMoth, "lullaby-moth", "Lullaby Moth", MonsterRoleSupport, 9, only("lullaby-moth"), one(TraitWarder, 3, 3)},
		{art.ArcticFrostback, "frostback", "Frostback", MonsterRoleProtector, 12, both("frostback"), one(TraitSpiked, 2, 0)},
		{art.ArcticOverheatingGenerator, "overheating-generator", "Overheating Generator", MonsterRoleStriker, 8, only("overheating-generator"), fuse("Meltdown")},
		{art.GhosttownVengefulDeputy, "vengeful-deputy", "Vengeful Deputy", MonsterRoleStriker, 10, both("vengeful-deputy"), one(TraitAvenger, 2, 0)},
		{art.GhosttownDustDevil, "dust-devil", "Dust Devil", MonsterRoleDisruptor, 9, both("dust-devil"), one(TraitPhasing, 0, 0)},
		{art.WastelandRadRoachBrood, "rad-roach-brood", "Rad-Roach Brood", MonsterRoleStriker, 10, both("rad-roach-brood"), one(TraitSplits, 50, 0)},
		{art.WastelandScrapShieldbearer, "scrap-shieldbearer", "Scrap Shield-bearer", MonsterRoleProtector, 12, both("scrap-shieldbearer"), one(TraitBodyguard, 2, 0)},
		// Lair bosses.
		{art.CatacombsTollingAbbot, "tolling-abbot", "The Tolling Abbot", MonsterRoleBoss, VarietyLairHealth, both("tolling-abbot"), one(TraitRegenerate, 2, 0)},
		{art.ScifiSpecimenOmega, "specimen-omega", "Specimen Omega", MonsterRoleBoss, VarietyPhasingLairHealth, both("specimen-omega"), one(TraitPhasing, 0, 0)},
		{art.MobsterLedgerGhost, "ledger-ghost", "The Ledger Ghost", MonsterRoleBoss, VarietyPhasingLairHealth, both("ledger-ghost"), one(TraitPhasing, 0, 0)},
		{art.SunkenPearlLeviathan, "pearl-leviathan", "The Pearl Leviathan", MonsterRoleBoss, VarietyLairHealth, both("pearl-leviathan"), one(TraitRegenerate, 1, 0)},
		{art.ClockworkGrandOrrery, "grand-orrery", "The Grand Orrery", MonsterRoleBoss, VarietyPhasingLairHealth, both("grand-orrery"), one(TraitPhasing, 0, 0)},
		{art.CarnivalCalliopeGolem, "calliope-golem", "The Calliope Golem", MonsterRoleBoss, VarietyLairHealth, both("calliope-golem"), one(TraitSpiked, 1, 0)},
		{art.JungleHiveQueen, "hive-queen", "The Hive Queen", MonsterRoleBoss, VarietyLairHealth, both("hive-queen"), one(TraitRegenerate, 1, 0)},
		{art.DreamscapeNightmareMare, "nightmare-mare", "The Nightmare Mare", MonsterRoleBoss, VarietyPhasingLairHealth, both("nightmare-mare"), one(TraitPhasing, 0, 0)},
		{art.ArcticPermafrostMaw, "permafrost-maw", "The Permafrost Maw", MonsterRoleBoss, VarietyLairHealth, both("permafrost-maw"), one(TraitRegenerate, 2, 0)},
		{art.GhosttownHangingJudge, "hanging-judge", "The Hanging Judge", MonsterRoleBoss, VarietyLairHealth, both("hanging-judge"), one(TraitAvenger, 1, 0)},
		{art.WastelandRadBehemoth, "rad-behemoth", "The Rad Behemoth", MonsterRoleBoss, VarietyLairHealth, both("rad-behemoth"), one(TraitRegenerate, 2, 0)},
	}
	monsters := make([]MonsterDefinition, 0, len(entries))
	for _, e := range entries {
		perDepth := 0
		if e.role == MonsterRoleBoss {
			perDepth = VarietyLairHealthPerDepth
		}
		monsters = append(monsters, defineMonster(e.sprite, MonsterDefinition{
			ID: e.id, Name: e.name, Role: e.role, BehaviorID: e.id, BaseHealth: e.health, HealthPerDepth: perDepth, AbilityIDs: e.abilities, Traits: e.traits,
		}))
	}
	return abilities, monsters
}

const (
	// VarietyFuseTurns is the turn a fused monster detonates on; VarietyFuseDamage is what the blast deals to
	// every adventurer (scaled up for larger parties like any party-wide move).
	VarietyFuseTurns  = 3
	VarietyFuseDamage = 5
	// VarietyLairHealth is a lair boss's base health.
	VarietyLairHealth = 24
	// A phasing lair boss takes half damage every other turn, so it starts with less.
	VarietyPhasingLairHealth = 18
	// VarietyLairHealthPerDepth is less than a dungeon boss's 4: a lair should stay optional, not a second final boss.
	VarietyLairHealthPerDepth = 3
	// LairChance is the percent chance, from the second floor of a dungeon on, that a floor has a lair.
	LairChance = 30
)

func varietyEncounters() []EncounterDefinition {
	pair := func(id, themeID string, a string, aCost int, b string, bCost int) EncounterDefinition {
		return EncounterDefinition{ID: id, ThemeID: themeID, Budget: aCost + bCost, Enemies: []EncounterMonsterDefinition{{ID: "slot-a", MonsterID: a, BudgetCost: aCost}, {ID: "slot-b", MonsterID: b, BudgetCost: bCost}}}
	}
	lair := func(themeID, monsterID string) EncounterDefinition {
		return EncounterDefinition{ID: themeID + "-lair", ThemeID: themeID, Budget: 8, Enemies: []EncounterMonsterDefinition{{ID: "boss", MonsterID: monsterID, BudgetCost: 8}}}
	}
	return []EncounterDefinition{
		pair("catacombs-candle-vigil", "catacombs", "candle-acolyte", 2, "restless-sentinel", 2),
		pair("catacombs-ossuary", "catacombs", "rattling-heap", 3, "candle-acolyte", 2),
		lair("catacombs", "tolling-abbot"),
		pair("scifi-hazmat-leak", "scifi", "volatile-canister", 2, "crab-drone", 2),
		pair("scifi-shield-escort", "scifi", "shield-projector", 3, "sentry-drone", 2),
		lair("scifi", "specimen-omega"),
		pair("mobster-arson-job", "mobster", "firebug", 2, "goon-gunner", 2),
		pair("mobster-protection-racket", "mobster", "hired-muscle", 3, "trench-hitman", 2),
		lair("mobster", "ledger-ghost"),
		pair("sunken-polyp-bed", "sunken", "brine-polyp", 2, "reef-lurker", 2),
		pair("sunken-eel-nest", "sunken", "twin-eel", 2, "drowned-knight", 3),
		lair("sunken", "pearl-leviathan"),
		pair("clockwork-demolition", "clockwork", "windup-bomber", 2, "cog-spider", 2),
		pair("clockwork-maintenance-crew", "clockwork", "repair-automaton", 2, "brass-assassin", 2),
		lair("clockwork", "grand-orrery"),
		pair("carnival-hall-of-mirrors", "carnival", "mirror-jester", 2, "jester-cutthroat", 2),
		pair("carnival-fire-show", "carnival", "fire-eater", 3, "balloon-horror", 2),
		lair("carnival", "calliope-golem"),
		pair("jungle-budding-grove", "jungle", "budding-mass", 2, "lumen-stalker", 2),
		pair("jungle-beetle-mound", "jungle", "thornback-beetle", 3, "razor-mantis", 2),
		lair("jungle", "hive-queen"),
		pair("dreamscape-doppel-dance", "dreamscape", "doppel-wisp", 2, "chatterhead", 2),
		pair("dreamscape-lullaby", "dreamscape", "lullaby-moth", 2, "palm-crawler", 2),
		lair("dreamscape", "nightmare-mare"),
		pair("arctic-generator-room", "arctic", "overheating-generator", 2, "frostbitten-researcher", 2),
		pair("arctic-frostback-den", "arctic", "frostback", 3, "husk-hound", 2),
		lair("arctic", "permafrost-maw"),
		pair("ghosttown-dust-storm", "ghosttown", "dust-devil", 2, "phantom-coyote", 2),
		pair("ghosttown-posse", "ghosttown", "vengeful-deputy", 2, "tumbleweed-haunt", 3),
		lair("ghosttown", "hanging-judge"),
		pair("wasteland-roach-nest", "wasteland", "rad-roach-brood", 2, "rust-hound", 2),
		pair("wasteland-shield-wall", "wasteland", "scrap-shieldbearer", 3, "scrap-raider", 2),
		lair("wasteland", "rad-behemoth"),
	}
}

// themeVarieties adds each theme's new encounters to its pools and gives it a lair.
var themeVarieties = map[string]themeVariety{
	"catacombs": {Standard: []string{"catacombs-candle-vigil"}, Heavy: []string{"catacombs-ossuary"}, Lair: FinalBossTemplate{
		FloorBossTemplate: guardian("The Bell Tower Crypt", "catacombs-lair", "A cracked bell hangs over an altar of candles. Something in a cowl is still ringing the hours for a service no one attends."),
		Mechanics:         []string{BossMechanicCataclysm}, CataclysmLabel: "Funeral Toll",
	}},
	"scifi": {Standard: []string{"scifi-hazmat-leak"}, Heavy: []string{"scifi-shield-escort"}, Lair: FinalBossTemplate{
		FloorBossTemplate: guardian("Containment Vat Omega", "scifi-lair", "The biggest tank in the facility is empty, and the glass is on the outside of the floor. Whatever grew here grew too large."),
		Mechanics:         []string{BossMechanicSummon}, SummonMonsterID: "volatile-canister",
	}},
	"mobster": {Standard: []string{"mobster-arson-job"}, Heavy: []string{"mobster-protection-racket"}, Lair: FinalBossTemplate{
		FloorBossTemplate: guardian("The Counting Room", "mobster-lair", "Ledgers are stacked to the ceiling and an adding machine clicks by itself. The bookkeeper never left, and he wants what you owe."),
		Mechanics:         []string{BossMechanicBarrier}, BarrierLabel: "Balanced Books",
	}},
	"sunken": {Standard: []string{"sunken-polyp-bed"}, Heavy: []string{"sunken-eel-nest"}, Lair: FinalBossTemplate{
		FloorBossTemplate: guardian("The Pearl Grotto", "sunken-lair", "A shell the size of a cottage rests on a bed of drowned treasure. It opens a crack, and something inside is watching."),
		Mechanics:         []string{BossMechanicBarrier}, BarrierLabel: "Pearl Shell",
	}},
	"clockwork": {Standard: []string{"clockwork-demolition", "clockwork-maintenance-crew"}, Lair: FinalBossTemplate{
		FloorBossTemplate: guardian("The Orrery Hall", "clockwork-lair", "Brass planets wheel around a burning gear under a glass dome. The orbits are lining up, and you are standing where the shadow falls."),
		Mechanics:         []string{BossMechanicCataclysm}, CataclysmLabel: "Eclipse",
	}},
	"carnival": {Standard: []string{"carnival-hall-of-mirrors"}, Heavy: []string{"carnival-fire-show"}, Lair: FinalBossTemplate{
		FloorBossTemplate: guardian("The Steam Organ Stage", "carnival-lair", "A steam organ with arms and a painted grin squats on the bandstand. Every pipe is aimed at the audience."),
		Mechanics:         []string{BossMechanicSummon}, SummonMonsterID: "mirror-jester",
	}},
	"jungle": {Standard: []string{"jungle-budding-grove"}, Heavy: []string{"jungle-beetle-mound"}, Lair: FinalBossTemplate{
		FloorBossTemplate: guardian("The Amber Hive", "jungle-lair", "The walls are honeycomb and the air hums. At the centre of the comb, the queen turns her many eyes toward you."),
		Mechanics:         []string{BossMechanicSummon}, SummonMonsterID: "lumen-stalker",
	}},
	"dreamscape": {Standard: []string{"dreamscape-doppel-dance", "dreamscape-lullaby"}, Lair: FinalBossTemplate{
		FloorBossTemplate: guardian("The Stable of Bad Dreams", "dreamscape-lair", "Hoofprints of starlight cross the ceiling. A mare made of midnight paws the floor, and the room forgets which way is up."),
		Mechanics:         []string{BossMechanicBarrier}, BarrierLabel: "Veil of Sleep",
	}},
	"arctic": {Standard: []string{"arctic-generator-room"}, Heavy: []string{"arctic-frostback-den"}, Lair: FinalBossTemplate{
		FloorBossTemplate: guardian("The Core Sample Vault", "arctic-lair", "A column of ancient ice stands in a ring of floodlights. The ice is cracked from the inside, and the cracks are growing."),
		Mechanics:         []string{BossMechanicCataclysm}, CataclysmLabel: "Glacier Crack",
	}},
	"ghosttown": {Standard: []string{"ghosttown-dust-storm"}, Heavy: []string{"ghosttown-posse"}, Lair: FinalBossTemplate{
		FloorBossTemplate: guardian("The Gallows Courthouse", "ghosttown-lair", "The jury box is full of dust and the noose still sways. The judge bangs his gavel: court is in session, and you are the accused."),
		Mechanics:         []string{BossMechanicSummon}, SummonMonsterID: "vengeful-deputy",
	}},
	"wasteland": {Standard: []string{"wasteland-roach-nest"}, Heavy: []string{"wasteland-shield-wall"}, Lair: FinalBossTemplate{
		FloorBossTemplate: guardian("The Glowing Crater", "wasteland-lair", "The ground slopes down into a crater that glows at night. Something enormous sleeps at the bottom, and its growths pulse as it breathes."),
		Mechanics:         []string{BossMechanicCataclysm}, CataclysmLabel: "Fallout Wave",
	}},
}

// armLairBoss gives a lair boss its mechanics. Unlike a dungeon boss, a lair boss does not enrage.
func armLairBoss(encounter *Encounter, lair FinalBossTemplate) {
	armDungeonBoss(encounter, lair)
	for i := range encounter.Enemies {
		enemy := &encounter.Enemies[i]
		if len(enemy.Mechanics) > 0 && enemy.Mechanics[0] == BossMechanicEnrage {
			enemy.Mechanics = enemy.Mechanics[1:]
		}
	}
}
