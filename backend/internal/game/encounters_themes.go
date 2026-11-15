package game

// themedEncounters returns the authored encounters for the pixel-art themes beyond the original Forgotten
// Catacombs content. Each non-catacombs theme has an outpost (one monster), a patrol, an ambush and a
// vanguard (two monsters each), and one single-monster boss encounter per boss. Budgets are provisional
// relative scores (striker 2, support 2, disruptor 2, protector 3, bruiser 4, boss 8) pending simulation.
//
// These are catalog content only: the floor generator still builds Catacombs floors, so nothing here is
// reachable in a run until a theme gets its room graphs. Encounters stay at two enemies or fewer, which is
// what the current scene layout can place.
func themedEncounters() []EncounterDefinition {
	return []EncounterDefinition{
		// Forgotten Catacombs additions
		{ID: "catacombs-wraith-patrol", ThemeID: "catacombs", Budget: 3, Enemies: []EncounterMonsterDefinition{{ID: "slot-a", MonsterID: "hooded-wraith", BudgetCost: 2}, {ID: "slot-b", MonsterID: "restless-sentinel", BudgetCost: 1}}},
		{ID: "catacombs-boss-pale-archivist", ThemeID: "catacombs", Budget: 8, Enemies: []EncounterMonsterDefinition{{ID: "boss", MonsterID: "pale-archivist", BudgetCost: 8}}},
		// Sci-Fi Research Facility
		{ID: "scifi-outpost", ThemeID: "scifi", Budget: 2, Enemies: []EncounterMonsterDefinition{{ID: "slot-a", MonsterID: "crab-drone", BudgetCost: 2}}},
		{ID: "scifi-patrol", ThemeID: "scifi", Budget: 6, Enemies: []EncounterMonsterDefinition{{ID: "slot-a", MonsterID: "security-bot", BudgetCost: 2}, {ID: "slot-b", MonsterID: "mutated-subject", BudgetCost: 4}}},
		{ID: "scifi-ambush", ThemeID: "scifi", Budget: 4, Enemies: []EncounterMonsterDefinition{{ID: "slot-a", MonsterID: "vat-specimen", BudgetCost: 2}, {ID: "slot-b", MonsterID: "sentry-drone", BudgetCost: 2}}},
		{ID: "scifi-vanguard", ThemeID: "scifi", Budget: 4, Enemies: []EncounterMonsterDefinition{{ID: "slot-a", MonsterID: "crab-drone", BudgetCost: 2}, {ID: "slot-b", MonsterID: "sentry-drone", BudgetCost: 2}}},
		{ID: "scifi-breach", ThemeID: "scifi", Budget: 6, Enemies: []EncounterMonsterDefinition{{ID: "slot-a", MonsterID: "mutated-subject", BudgetCost: 4}, {ID: "slot-b", MonsterID: "crab-drone", BudgetCost: 2}}},
		{ID: "scifi-boss-containment-mech", ThemeID: "scifi", Budget: 8, Enemies: []EncounterMonsterDefinition{{ID: "boss", MonsterID: "containment-mech", BudgetCost: 8}}},
		{ID: "scifi-boss-overseer-core", ThemeID: "scifi", Budget: 8, Enemies: []EncounterMonsterDefinition{{ID: "boss", MonsterID: "overseer-core", BudgetCost: 8}}},
		{ID: "scifi-boss-patient-zero", ThemeID: "scifi", Budget: 8, Enemies: []EncounterMonsterDefinition{{ID: "boss", MonsterID: "patient-zero", BudgetCost: 8}}},
		// 1930s Mobster Underworld
		{ID: "mobster-outpost", ThemeID: "mobster", Budget: 2, Enemies: []EncounterMonsterDefinition{{ID: "slot-a", MonsterID: "goon-gunner", BudgetCost: 2}}},
		{ID: "mobster-patrol", ThemeID: "mobster", Budget: 4, Enemies: []EncounterMonsterDefinition{{ID: "slot-a", MonsterID: "trench-hitman", BudgetCost: 2}, {ID: "slot-b", MonsterID: "spectral-enforcer", BudgetCost: 2}}},
		{ID: "mobster-ambush", ThemeID: "mobster", Budget: 6, Enemies: []EncounterMonsterDefinition{{ID: "slot-a", MonsterID: "bruiser", BudgetCost: 4}, {ID: "slot-b", MonsterID: "velvet-viper", BudgetCost: 2}}},
		{ID: "mobster-vanguard", ThemeID: "mobster", Budget: 4, Enemies: []EncounterMonsterDefinition{{ID: "slot-a", MonsterID: "goon-gunner", BudgetCost: 2}, {ID: "slot-b", MonsterID: "velvet-viper", BudgetCost: 2}}},
		{ID: "mobster-boss-the-don", ThemeID: "mobster", Budget: 8, Enemies: []EncounterMonsterDefinition{{ID: "boss", MonsterID: "the-don", BudgetCost: 8}}},
		{ID: "mobster-boss-spectral-kingpin", ThemeID: "mobster", Budget: 8, Enemies: []EncounterMonsterDefinition{{ID: "boss", MonsterID: "spectral-kingpin", BudgetCost: 8}}},
		{ID: "mobster-boss-black-sedan", ThemeID: "mobster", Budget: 8, Enemies: []EncounterMonsterDefinition{{ID: "boss", MonsterID: "black-sedan", BudgetCost: 8}}},
		// Sunken Kingdom
		{ID: "sunken-outpost", ThemeID: "sunken", Budget: 3, Enemies: []EncounterMonsterDefinition{{ID: "slot-a", MonsterID: "drowned-knight", BudgetCost: 3}}},
		{ID: "sunken-patrol", ThemeID: "sunken", Budget: 4, Enemies: []EncounterMonsterDefinition{{ID: "slot-a", MonsterID: "reef-lurker", BudgetCost: 2}, {ID: "slot-b", MonsterID: "ghost-jelly", BudgetCost: 2}}},
		{ID: "sunken-ambush", ThemeID: "sunken", Budget: 6, Enemies: []EncounterMonsterDefinition{{ID: "slot-a", MonsterID: "tide-brute", BudgetCost: 4}, {ID: "slot-b", MonsterID: "drowned-siren", BudgetCost: 2}}},
		{ID: "sunken-vanguard", ThemeID: "sunken", Budget: 5, Enemies: []EncounterMonsterDefinition{{ID: "slot-a", MonsterID: "drowned-knight", BudgetCost: 3}, {ID: "slot-b", MonsterID: "drowned-siren", BudgetCost: 2}}},
		{ID: "sunken-boss-drowned-king", ThemeID: "sunken", Budget: 8, Enemies: []EncounterMonsterDefinition{{ID: "boss", MonsterID: "drowned-king", BudgetCost: 8}}},
		{ID: "sunken-boss-abyssal-angler", ThemeID: "sunken", Budget: 8, Enemies: []EncounterMonsterDefinition{{ID: "boss", MonsterID: "abyssal-angler", BudgetCost: 8}}},
		{ID: "sunken-boss-ancient-guardian", ThemeID: "sunken", Budget: 8, Enemies: []EncounterMonsterDefinition{{ID: "boss", MonsterID: "ancient-guardian", BudgetCost: 8}}},
		// Clockwork Empire
		{ID: "clockwork-outpost", ThemeID: "clockwork", Budget: 2, Enemies: []EncounterMonsterDefinition{{ID: "slot-a", MonsterID: "windup-scamp", BudgetCost: 2}}},
		{ID: "clockwork-patrol", ThemeID: "clockwork", Budget: 4, Enemies: []EncounterMonsterDefinition{{ID: "slot-a", MonsterID: "gilded-dancer", BudgetCost: 2}, {ID: "slot-b", MonsterID: "cog-spider", BudgetCost: 2}}},
		{ID: "clockwork-ambush", ThemeID: "clockwork", Budget: 6, Enemies: []EncounterMonsterDefinition{{ID: "slot-a", MonsterID: "brass-assassin", BudgetCost: 2}, {ID: "slot-b", MonsterID: "boiler-brute", BudgetCost: 4}}},
		{ID: "clockwork-vanguard", ThemeID: "clockwork", Budget: 6, Enemies: []EncounterMonsterDefinition{{ID: "slot-a", MonsterID: "windup-scamp", BudgetCost: 2}, {ID: "slot-b", MonsterID: "boiler-brute", BudgetCost: 4}}},
		{ID: "clockwork-boss-brass-colossus", ThemeID: "clockwork", Budget: 8, Enemies: []EncounterMonsterDefinition{{ID: "boss", MonsterID: "brass-colossus", BudgetCost: 8}}},
		{ID: "clockwork-boss-the-clockmaker", ThemeID: "clockwork", Budget: 8, Enemies: []EncounterMonsterDefinition{{ID: "boss", MonsterID: "the-clockmaker", BudgetCost: 8}}},
		{ID: "clockwork-boss-leviathan-boiler", ThemeID: "clockwork", Budget: 8, Enemies: []EncounterMonsterDefinition{{ID: "boss", MonsterID: "leviathan-boiler", BudgetCost: 8}}},
		// Haunted Carnival
		{ID: "carnival-outpost", ThemeID: "carnival", Budget: 2, Enemies: []EncounterMonsterDefinition{{ID: "slot-a", MonsterID: "jester-cutthroat", BudgetCost: 2}}},
		{ID: "carnival-patrol", ThemeID: "carnival", Budget: 4, Enemies: []EncounterMonsterDefinition{{ID: "slot-a", MonsterID: "carousel-specter", BudgetCost: 2}, {ID: "slot-b", MonsterID: "balloon-horror", BudgetCost: 2}}},
		{ID: "carnival-ambush", ThemeID: "carnival", Budget: 6, Enemies: []EncounterMonsterDefinition{{ID: "slot-a", MonsterID: "candy-ooze", BudgetCost: 2}, {ID: "slot-b", MonsterID: "strongman-brute", BudgetCost: 4}}},
		{ID: "carnival-vanguard", ThemeID: "carnival", Budget: 6, Enemies: []EncounterMonsterDefinition{{ID: "slot-a", MonsterID: "jester-cutthroat", BudgetCost: 2}, {ID: "slot-b", MonsterID: "strongman-brute", BudgetCost: 4}}},
		{ID: "carnival-boss-the-ringmaster", ThemeID: "carnival", Budget: 8, Enemies: []EncounterMonsterDefinition{{ID: "boss", MonsterID: "the-ringmaster", BudgetCost: 8}}},
		{ID: "carnival-boss-laughing-big-top", ThemeID: "carnival", Budget: 8, Enemies: []EncounterMonsterDefinition{{ID: "boss", MonsterID: "laughing-big-top", BudgetCost: 8}}},
		{ID: "carnival-boss-harlequin-horror", ThemeID: "carnival", Budget: 8, Enemies: []EncounterMonsterDefinition{{ID: "boss", MonsterID: "harlequin-horror", BudgetCost: 8}}},
		// Alien Jungle
		{ID: "jungle-outpost", ThemeID: "jungle", Budget: 2, Enemies: []EncounterMonsterDefinition{{ID: "slot-a", MonsterID: "lumen-stalker", BudgetCost: 2}}},
		{ID: "jungle-patrol", ThemeID: "jungle", Budget: 5, Enemies: []EncounterMonsterDefinition{{ID: "slot-a", MonsterID: "spore-bloom", BudgetCost: 2}, {ID: "slot-b", MonsterID: "thorn-walker", BudgetCost: 3}}},
		{ID: "jungle-ambush", ThemeID: "jungle", Budget: 4, Enemies: []EncounterMonsterDefinition{{ID: "slot-a", MonsterID: "lantern-moth", BudgetCost: 2}, {ID: "slot-b", MonsterID: "razor-mantis", BudgetCost: 2}}},
		{ID: "jungle-vanguard", ThemeID: "jungle", Budget: 4, Enemies: []EncounterMonsterDefinition{{ID: "slot-a", MonsterID: "lumen-stalker", BudgetCost: 2}, {ID: "slot-b", MonsterID: "razor-mantis", BudgetCost: 2}}},
		{ID: "jungle-boss-heartroot-titan", ThemeID: "jungle", Budget: 8, Enemies: []EncounterMonsterDefinition{{ID: "boss", MonsterID: "heartroot-titan", BudgetCost: 8}}},
		{ID: "jungle-boss-mother-lantern", ThemeID: "jungle", Budget: 8, Enemies: []EncounterMonsterDefinition{{ID: "boss", MonsterID: "mother-lantern", BudgetCost: 8}}},
		{ID: "jungle-boss-apex-maw", ThemeID: "jungle", Budget: 8, Enemies: []EncounterMonsterDefinition{{ID: "boss", MonsterID: "apex-maw", BudgetCost: 8}}},
		// Dreamscapes
		{ID: "dreamscape-outpost", ThemeID: "dreamscape", Budget: 2, Enemies: []EncounterMonsterDefinition{{ID: "slot-a", MonsterID: "wandering-eye", BudgetCost: 2}}},
		{ID: "dreamscape-patrol", ThemeID: "dreamscape", Budget: 4, Enemies: []EncounterMonsterDefinition{{ID: "slot-a", MonsterID: "chatterhead", BudgetCost: 2}, {ID: "slot-b", MonsterID: "palm-crawler", BudgetCost: 2}}},
		{ID: "dreamscape-ambush", ThemeID: "dreamscape", Budget: 6, Enemies: []EncounterMonsterDefinition{{ID: "slot-a", MonsterID: "hourless-slug", BudgetCost: 2}, {ID: "slot-b", MonsterID: "stilt-walker", BudgetCost: 4}}},
		{ID: "dreamscape-vanguard", ThemeID: "dreamscape", Budget: 6, Enemies: []EncounterMonsterDefinition{{ID: "slot-a", MonsterID: "wandering-eye", BudgetCost: 2}, {ID: "slot-b", MonsterID: "stilt-walker", BudgetCost: 4}}},
		{ID: "dreamscape-boss-moon-sovereign", ThemeID: "dreamscape", Budget: 8, Enemies: []EncounterMonsterDefinition{{ID: "boss", MonsterID: "moon-sovereign", BudgetCost: 8}}},
		{ID: "dreamscape-boss-hungry-grin", ThemeID: "dreamscape", Budget: 8, Enemies: []EncounterMonsterDefinition{{ID: "boss", MonsterID: "hungry-grin", BudgetCost: 8}}},
		{ID: "dreamscape-boss-hollow-child", ThemeID: "dreamscape", Budget: 8, Enemies: []EncounterMonsterDefinition{{ID: "boss", MonsterID: "hollow-child", BudgetCost: 8}}},
		// Arctic Station
		{ID: "arctic-outpost", ThemeID: "arctic", Budget: 2, Enemies: []EncounterMonsterDefinition{{ID: "slot-a", MonsterID: "frostbitten-researcher", BudgetCost: 2}}},
		{ID: "arctic-patrol", ThemeID: "arctic", Budget: 4, Enemies: []EncounterMonsterDefinition{{ID: "slot-a", MonsterID: "husk-hound", BudgetCost: 2}, {ID: "slot-b", MonsterID: "ice-wraith", BudgetCost: 2}}},
		{ID: "arctic-ambush", ThemeID: "arctic", Budget: 6, Enemies: []EncounterMonsterDefinition{{ID: "slot-a", MonsterID: "icesaw-drone", BudgetCost: 2}, {ID: "slot-b", MonsterID: "rimefur-brute", BudgetCost: 4}}},
		{ID: "arctic-vanguard", ThemeID: "arctic", Budget: 6, Enemies: []EncounterMonsterDefinition{{ID: "slot-a", MonsterID: "frostbitten-researcher", BudgetCost: 2}, {ID: "slot-b", MonsterID: "rimefur-brute", BudgetCost: 4}}},
		{ID: "arctic-boss-glacier-titan", ThemeID: "arctic", Budget: 8, Enemies: []EncounterMonsterDefinition{{ID: "boss", MonsterID: "glacier-titan", BudgetCost: 8}}},
		{ID: "arctic-boss-thing-in-the-ice", ThemeID: "arctic", Budget: 8, Enemies: []EncounterMonsterDefinition{{ID: "boss", MonsterID: "thing-in-the-ice", BudgetCost: 8}}},
		{ID: "arctic-boss-cryo-warden", ThemeID: "arctic", Budget: 8, Enemies: []EncounterMonsterDefinition{{ID: "boss", MonsterID: "cryo-warden", BudgetCost: 8}}},
		// Ghost Town
		{ID: "ghosttown-outpost", ThemeID: "ghosttown", Budget: 2, Enemies: []EncounterMonsterDefinition{{ID: "slot-a", MonsterID: "revenant-gunslinger", BudgetCost: 2}}},
		{ID: "ghosttown-patrol", ThemeID: "ghosttown", Budget: 7, Enemies: []EncounterMonsterDefinition{{ID: "slot-a", MonsterID: "tumbleweed-haunt", BudgetCost: 3}, {ID: "slot-b", MonsterID: "cursed-prospector", BudgetCost: 4}}},
		{ID: "ghosttown-ambush", ThemeID: "ghosttown", Budget: 4, Enemies: []EncounterMonsterDefinition{{ID: "slot-a", MonsterID: "carrion-vulture", BudgetCost: 2}, {ID: "slot-b", MonsterID: "phantom-coyote", BudgetCost: 2}}},
		{ID: "ghosttown-vanguard", ThemeID: "ghosttown", Budget: 4, Enemies: []EncounterMonsterDefinition{{ID: "slot-a", MonsterID: "revenant-gunslinger", BudgetCost: 2}, {ID: "slot-b", MonsterID: "phantom-coyote", BudgetCost: 2}}},
		{ID: "ghosttown-boss-the-undertaker", ThemeID: "ghosttown", Budget: 8, Enemies: []EncounterMonsterDefinition{{ID: "boss", MonsterID: "the-undertaker", BudgetCost: 8}}},
		{ID: "ghosttown-boss-sheriff-of-the-damned", ThemeID: "ghosttown", Budget: 8, Enemies: []EncounterMonsterDefinition{{ID: "boss", MonsterID: "sheriff-of-the-damned", BudgetCost: 8}}},
		{ID: "ghosttown-boss-hanging-tree", ThemeID: "ghosttown", Budget: 8, Enemies: []EncounterMonsterDefinition{{ID: "boss", MonsterID: "hanging-tree", BudgetCost: 8}}},
		// Post-Apocalyptic Settlement
		{ID: "wasteland-outpost", ThemeID: "wasteland", Budget: 2, Enemies: []EncounterMonsterDefinition{{ID: "slot-a", MonsterID: "scrap-raider", BudgetCost: 2}}},
		{ID: "wasteland-patrol", ThemeID: "wasteland", Budget: 4, Enemies: []EncounterMonsterDefinition{{ID: "slot-a", MonsterID: "rust-hound", BudgetCost: 2}, {ID: "slot-b", MonsterID: "flame-rig", BudgetCost: 2}}},
		{ID: "wasteland-ambush", ThemeID: "wasteland", Budget: 6, Enemies: []EncounterMonsterDefinition{{ID: "slot-a", MonsterID: "rad-roach", BudgetCost: 2}, {ID: "slot-b", MonsterID: "bloated-brute", BudgetCost: 4}}},
		{ID: "wasteland-vanguard", ThemeID: "wasteland", Budget: 6, Enemies: []EncounterMonsterDefinition{{ID: "slot-a", MonsterID: "scrap-raider", BudgetCost: 2}, {ID: "slot-b", MonsterID: "bloated-brute", BudgetCost: 4}}},
		{ID: "wasteland-boss-warlord-rig", ThemeID: "wasteland", Budget: 8, Enemies: []EncounterMonsterDefinition{{ID: "boss", MonsterID: "warlord-rig", BudgetCost: 8}}},
		{ID: "wasteland-boss-fallout-behemoth", ThemeID: "wasteland", Budget: 8, Enemies: []EncounterMonsterDefinition{{ID: "boss", MonsterID: "fallout-behemoth", BudgetCost: 8}}},
		{ID: "wasteland-boss-scrap-heap-king", ThemeID: "wasteland", Budget: 8, Enemies: []EncounterMonsterDefinition{{ID: "boss", MonsterID: "scrap-heap-king", BudgetCost: 8}}},
	}
}
