package game

// Authored expedition content for all eleven dungeon themes: room names and prose, discovery and vault choices,
// which encounters fill which rooms, the two floor guardians and the dungeon boss with its mechanics.
//
// Discovery choices are a themed label on a shared effect (discoveryEffects in run_effect_catalog.go). The
// description players read is the effect's Summary, so the full trade is always stated in rules terms.

func hall(name, description string) FloorRoomTemplate {
	return FloorRoomTemplate{Name: name, Description: description}
}

// option is one discovery choice: a themed label for a shared effect. The effect ID doubles as the choice ID.
func option(label, effectID string) EventChoice {
	effect, ok := defaultRunEffectCatalog.Effect(effectID)
	if !ok {
		panic("expedition content uses unknown run effect " + effectID)
	}
	return EventChoice{ID: effectID, Label: label, Description: effect.Summary, Effect: effectID}
}

func discovery(roomName, roomDescription, title, prompt string, choices ...EventChoice) DiscoveryTemplate {
	return DiscoveryTemplate{
		Room:  hall(roomName, roomDescription),
		Event: FloorEventTemplate{Title: title, Description: prompt, Choices: append(choices, option("Gather healing herbs", "herb_cache"))},
	}
}

func guardian(roomName, encounterID, description string) FloorBossTemplate {
	return FloorBossTemplate{RoomName: roomName, EncounterID: encounterID, Description: description}
}

func expeditionThemes() []ExpeditionTheme {
	return []ExpeditionTheme{
		{
			ThemeID: "catacombs",
			Entries: []FloorRoomTemplate{
				hall("The Lower Threshold", "The air grows colder. Old warding marks pulse beneath the dust as the next descent stirs awake."),
				hall("The Watcher's Stair", "A dead watchfire gutters at the foot of the stair. Something stirs in the ash."),
			},
			Halls: []FloorRoomTemplate{
				hall("The Silted Cloister", "Ancient defenders block the cloister, their movements deliberate and practised."),
				hall("The Ashen Stair", "Ash drifts down the steps. Shapes stand up out of it as the party passes."),
				hall("The Drowned Archive", "Black water laps at toppled shelves. The readers never left."),
				hall("The Hollow Nave", "Every footstep in the nave is answered from the dark between the pillars."),
				hall("The Shattered Ossuary", "Bone crunches underfoot. Not all of it stays where it fell."),
				hall("The Gallery of Bones", "Pillars of fused bone frame a dais, and its keepers attack whatever disturbs the dead."),
			},
			Discoveries: []DiscoveryTemplate{
				discovery("The Echoing Shrine", "A low harmonic runs through the stone. The shrine still answers those who pay.", "A Resonance in the Stone", "The altar is stained dark. It has always wanted the same thing.",
					option("Bleed on the altar", "blood_pact"), option("Take the stone ward", "vital_tithe"), option("Leave it untouched", "leave")),
				discovery("The Embalmers' Cellar", "Clay jars line the walls, sealed with wax and labelled in a dead script.", "Jars in the Dark", "Some of these were medicine. Some of them were not.",
					option("Drink from a sealed jar", "risky_draught"), option("Make camp among the jars", "uneasy_rest"), option("Touch nothing", "leave")),
				discovery("The Knight's Rest", "A knight lies in state, armour whole, sword honed to a hair.", "Arms of the Dead", "The knight has no more use for them. The knight may still object.",
					option("Strap on the grave plate", "heavy_plate"), option("Take the honed blade", "glass_edge"), option("Let the knight rest", "leave")),
			},
			Vault: discovery("The Reliquary Vault", "A sealed vault opens on grave goods and one relic under glass, etched with warding runes.", "Grave Goods", "The coin is only coin. The relic is watching.",
				option("Gather the grave coin", "vault_coin"), option("Break the glass", "vault_relic"), option("Seal the vault again", "leave")),
			Elite:    hall("The Sealed Reliquary", "A hulking champion tears free of its stone bindings. Defeating it will strengthen the whole party."),
			Guard:    hall("The Guarded Descent", "The last defenders of this level stand between the party and the way down."),
			Light:    []string{"depth-entry"},
			Standard: []string{"depth-left-scout", "depth-left-guardian", "catacombs-wraith-patrol"},
			Heavy:    []string{"depth-guard"},
			EliteID:  "depth-miniboss",
			Guardians: []FloorBossTemplate{
				guardian("The Ossuary Champion", "depth-boss-ossuary", "A vast chamber opens around a colossus of bone. The dungeon's deeper rhythm pounds through the walls."),
				guardian("The Archivist's Stacks", "catacombs-boss-pale-archivist", "Shelves rise out of sight. The Pale Archivist closes its book and looks up."),
			},
			Final: FinalBossTemplate{
				FloorBossTemplate: guardian("The Warden's Sanctum", "depth-boss-warden", "A throne of black iron stands at the bottom of everything. The Crypt Warden rises, dragging its chains across the stone."),
				Mechanics:         []string{BossMechanicSummon}, SummonMonsterID: "gravebound-scout",
			},
			ClearedText: "The Crypt Warden falls. The catacombs are cleared!",
		},
		{
			ThemeID: "scifi",
			Entries: []FloorRoomTemplate{
				hall("The Decontamination Airlock", "Sterilising mist hangs in the air as warning strobes pulse across the wet floor. Something inside the walls is awake."),
				hall("The Freight Elevator", "The lift shudders to a halt between levels. The doors are forced from the other side."),
			},
			Halls: []FloorRoomTemplate{
				hall("The Containment Wing", "Cell doors stand open down the length of the ward. Not everything left."),
				hall("The Cryo Storage Ward", "Frost-rimmed pods line the walls. Several are empty and still dripping."),
				hall("The Reactor Gantry", "A catwalk crosses the reactor well. The security systems still consider it restricted."),
				hall("The Maintenance Crawlway", "Cables hang like vines in the crawlway, and something skitters along them."),
				hall("The Observation Deck", "Cracked glass looks down on the labs. The watchers are on this side of it now."),
				hall("The Specimen Lab", "Benches of broken glassware. The specimens have been busy."),
			},
			Discoveries: []DiscoveryTemplate{
				discovery("The Terminal Alcove", "A lone console still runs on emergency power, offering a brief window into the facility's systems.", "A Console Still Humming", "Suit power can be rerouted, but only from one system to another.",
					option("Reroute power to shields", "heavy_plate"), option("Overclock the weapons", "glass_edge"), option("Leave the console alone", "leave")),
				discovery("The Quiet Medical Station", "An autodoc unfolds from the ceiling. Its logs show it has failed before.", "Field Treatment", "The machine offers treatment. It does not offer a second opinion.",
					option("Accept the injection", "risky_draught"), option("Rest in the recovery bay", "uneasy_rest"), option("Walk past it", "leave")),
				discovery("The Prototype Bay", "Half-finished augments hang in sterile racks, labelled NOT FOR HUMAN TRIALS.", "Not For Human Trials", "The interface needs a blood sample. A generous one.",
					option("Jack into the prototype", "blood_pact"), option("Strip the bay for parts", "greedy_haul"), option("Leave the racks sealed", "leave")),
			},
			Vault: discovery("The Secure Storage Vault", "A blast door grinds open on shelves of credit chits and one humming containment case.", "Secure Storage", "The chits are safe. The case has a warning in six languages.",
				option("Pocket the credit chits", "vault_coin"), option("Open the containment case", "vault_relic"), option("Close the blast door", "leave")),
			Elite:    hall("The Breached Cell", "A test subject has torn free of its restraints and its keeper drone is still active. Defeating them will strengthen the whole party."),
			Guard:    hall("The Security Checkpoint", "The last defenders of this level hold the lift to the lower sectors. Their targeting lights sweep the room."),
			Light:    []string{"scifi-outpost"},
			Standard: []string{"scifi-outpost", "scifi-ambush", "scifi-vanguard"},
			Heavy:    []string{"scifi-patrol"},
			EliteID:  "scifi-breach",
			Guardians: []FloorBossTemplate{
				guardian("The Containment Bay", "scifi-boss-containment-mech", "Hydraulic locks release and Containment Unit-9 stands up inside its bay. Its piston arms are still counting."),
				guardian("The Outbreak Chamber", "scifi-boss-patient-zero", "The walls are grown over with something that was once a patient. It turns toward the party all at once."),
			},
			Final: FinalBossTemplate{
				FloorBossTemplate: guardian("The Overseer's Core", "scifi-boss-overseer-core", "Banks of servers rise into the dark around a single burning lens. The facility's mind has been waiting for visitors."),
				Mechanics:         []string{BossMechanicSummon, BossMechanicBarrier}, SummonMonsterID: "sentry-drone", BarrierLabel: "Hard-Light Firewall",
			},
			ClearedText: "The Overseer goes dark. The research facility is cleared!",
		},
		{
			ThemeID: "mobster",
			Entries: []FloorRoomTemplate{
				hall("The Speakeasy Door", "A slot in the door slides open, then shut. The password was never going to work."),
				hall("The Delivery Alley", "Rain, an idling truck, and a lookout who has already whistled."),
			},
			Halls: []FloorRoomTemplate{
				hall("The Back Room", "A card game stops mid-hand. Nobody reaches for their chips."),
				hall("The Bottling Cellar", "Rows of stills hiss in the dark. The night shift does not like visitors."),
				hall("The Counting House", "Ledgers, adding machines, and men who are paid to see nobody reads them."),
				hall("The Smoke-Filled Lounge", "A piano plays itself in the corner. The regulars turn on their stools."),
				hall("The Loading Dock", "Crates marked FURNITURE. The stevedores carry violin cases."),
				hall("The Wire Room", "A wall of telephones, all ringing. Somebody is calling in the party's description."),
			},
			Discoveries: []DiscoveryTemplate{
				discovery("The Doc's Back Office", "A struck-off doctor keeps office hours behind the laundry, no questions asked.", "No Questions Asked", "The doc has two bottles and cannot remember which is which.",
					option("Take the doc's tonic", "risky_draught"), option("Lie low in the back", "uneasy_rest"), option("Find another doctor", "leave")),
				discovery("The Armourer's Bench", "A gunsmith's bench under a single bulb, with work laid out half-finished.", "A Favour From the Armourer", "The armourer does good work. It always costs something.",
					option("Take the steel vest", "heavy_plate"), option("File down the trigger", "glass_edge"), option("Keep what you have", "leave")),
				discovery("The Bookie's Window", "A caged window, a chalkboard of odds, and an open till nobody is watching.", "Easy Money", "The till is right there. The syndicate remembers faces.",
					option("Empty the till", "greedy_haul"), option("Crack the strongbox", "trapped_cache"), option("Walk on by", "leave")),
			},
			Vault: discovery("The Don's Safe", "Behind a painting, a wall safe stands ajar. Bundled cash, and a ring in a velvet box.", "Behind the Painting", "The cash is only cash. The ring belonged to the last Don.",
				option("Take the bundled cash", "vault_coin"), option("Put on the ring", "vault_relic"), option("Hang the painting back", "leave")),
			Elite:    hall("The Enforcer's Garage", "The syndicate's heaviest hitters wait among the parked cars. Defeating them will strengthen the whole party."),
			Guard:    hall("The Velvet Rope", "The Don's own doormen stand at the last door. They are not checking names."),
			Light:    []string{"mobster-outpost"},
			Standard: []string{"mobster-outpost", "mobster-patrol", "mobster-vanguard"},
			Heavy:    []string{"mobster-ambush"},
			EliteID:  "mobster-ambush",
			Guardians: []FloorBossTemplate{
				guardian("The Parking Structure", "mobster-boss-black-sedan", "Headlights come on in the dark. The Black Sedan has no driver, and it has been waiting."),
				guardian("The Séance Parlour", "mobster-boss-spectral-kingpin", "The table rises. The Spectral Kingpin still runs this town from the other side."),
			},
			Final: FinalBossTemplate{
				FloorBossTemplate: guardian("The Don's Penthouse", "mobster-boss-the-don", "A long table, a skyline, and one man who does not stand up. The Don adjusts his rings."),
				Mechanics:         []string{BossMechanicSummon, BossMechanicCataclysm}, SummonMonsterID: "goon-gunner", CataclysmLabel: "Tommy-Gun Massacre",
			},
			ClearedText: "The Don is finished. The underworld is cleared!",
		},
		{
			ThemeID: "sunken",
			Entries: []FloorRoomTemplate{
				hall("The Tidal Gate", "The sea drains from the gatehouse just long enough to enter. Its sentries never left their posts."),
				hall("The Barnacled Stair", "Steps descend into green light. Something rises to meet the party."),
			},
			Halls: []FloorRoomTemplate{
				hall("The Coral Colonnade", "Coral has swallowed the pillars, and things nest in the coral."),
				hall("The Flooded Court", "Waist-deep water where a king once held court. The courtiers circle."),
				hall("The Kelp Gardens", "Kelp sways without a current. Shapes move behind it."),
				hall("The Pearl Market", "Stalls of rotted silk and open shells. The merchants never closed."),
				hall("The Drowned Barracks", "Racks of rusted tridents, and the garrison still on watch."),
				hall("The Whalebone Bridge", "A bridge of ribs over a black trench. The crossing is contested."),
			},
			Discoveries: []DiscoveryTemplate{
				discovery("The Singing Font", "A basin of perfectly clear water in a room where nothing else is clean.", "The Clear Water", "It looks like the only pure water in the kingdom. It may be bait.",
					option("Drink from the font", "risky_draught"), option("Rest beside it", "uneasy_rest"), option("Leave it undisturbed", "leave")),
				discovery("The Tide-Priest's Altar", "A drowned altar where the old priests bargained with the deep.", "A Bargain With the Deep", "The deep gives strength. It is paid in breath.",
					option("Offer your breath", "vital_tithe"), option("Offer your blood", "blood_pact"), option("Offer nothing", "leave")),
				discovery("The Sunken Treasury", "Chests burst by pressure, coin scattered through the silt, and one chest still locked.", "Silt and Silver", "The loose coin is heavy to carry. The locked chest is rigged.",
					option("Fill your packs with silver", "greedy_haul"), option("Force the locked chest", "trapped_cache"), option("Swim on", "leave")),
			},
			Vault: discovery("The King's Reliquary", "A vaulted chamber kept dry by old magic. Royal coin, and a crown of black coral on a plinth.", "The Coral Crown", "The coin is free for the taking. The crown has drowned everyone who wore it but one.",
				option("Take the royal coin", "vault_coin"), option("Lift the coral crown", "vault_relic"), option("Leave the dead their crown", "leave")),
			Elite:    hall("The Leviathan's Pen", "A brute of the deep and its handler guard a flooded arena. Defeating them will strengthen the whole party."),
			Guard:    hall("The Royal Guardhouse", "The king's last knights form up before the inner doors."),
			Light:    []string{"sunken-skirmish"},
			Standard: []string{"sunken-outpost", "sunken-patrol", "sunken-vanguard"},
			Heavy:    []string{"sunken-ambush"},
			EliteID:  "sunken-ambush",
			Guardians: []FloorBossTemplate{
				guardian("The Hall of the Colossus", "sunken-boss-ancient-guardian", "A statue the size of a tower turns its head. The Ancient Guardian has woken."),
				guardian("The Lightless Trench", "sunken-boss-abyssal-angler", "A single warm light bobs in the dark. Behind it, teeth."),
			},
			Final: FinalBossTemplate{
				FloorBossTemplate: guardian("The Drowned Throne", "sunken-boss-drowned-king", "The throne room is a cathedral of black water. The Drowned King rises from his seat, trident in hand."),
				Mechanics:         []string{BossMechanicCataclysm, BossMechanicBarrier}, CataclysmLabel: "Wrath of the Tides", BarrierLabel: "Wall of Water",
			},
			ClearedText: "The Drowned King sinks for the last time. The sunken kingdom is cleared!",
		},
		{
			ThemeID: "clockwork",
			Entries: []FloorRoomTemplate{
				hall("The Brass Vestibule", "Gears turn behind every wall. The doormen wind themselves up."),
				hall("The Pneumatic Lift", "The lift hisses to a stop. Something is already cranking the doors open."),
			},
			Halls: []FloorRoomTemplate{
				hall("The Gear Gallery", "A hall of turning wheels, and automata that keep them oiled."),
				hall("The Escapement Works", "Everything here ticks. Some of it ticks toward the party."),
				hall("The Steam Foundry", "Molten brass and hissing valves. The foundry hands do not stop for visitors."),
				hall("The Music-Box Ballroom", "A waltz plays, slightly flat. The dancers have blades for arms."),
				hall("The Pendulum Hall", "Great pendulums sweep the floor, and sentries step between them in perfect time."),
				hall("The Winding Stair", "A spiral of brass steps that turns as it is climbed. It is guarded at every landing."),
			},
			Discoveries: []DiscoveryTemplate{
				discovery("The Tinker's Workbench", "A cluttered bench of springs and plates, with tools laid out for the next job.", "Spare Parts", "There is enough here to rebuild something. Not to rebuild it well.",
					option("Rivet on brass plating", "heavy_plate"), option("Fit a hair-trigger spring", "glass_edge"), option("Leave the bench as it is", "leave")),
				discovery("The Boiler Shrine", "A boiler the size of a chapel, tended like one, with offerings at its grate.", "The Engine Must Be Fed", "The boiler gives power to those who feed it.",
					option("Feed the grate", "blood_pact"), option("Rest in its warmth", "uneasy_rest"), option("Step away", "leave")),
				discovery("The Coin Press", "A mint press still stamping blanks. A jammed hopper is full of finished coin.", "A Jammed Hopper", "The coin is real. So is the press above it.",
					option("Reach into the hopper", "trapped_cache"), option("Carry off the heavy dies", "greedy_haul"), option("Leave the press running", "leave")),
			},
			Vault: discovery("The Clockmaker's Safe", "A vault door of a thousand tumblers stands open. Trays of gold cogs, and one small ticking heart.", "A Ticking Heart", "The gold cogs are only gold. The heart is still keeping time for someone.",
				option("Take the gold cogs", "vault_coin"), option("Wind the ticking heart", "vault_relic"), option("Shut the vault", "leave")),
			Elite:    hall("The Proving Floor", "The Empire's newest war machines are being tested here. Defeating them will strengthen the whole party."),
			Guard:    hall("The Regulator Gate", "The gate's keepers move in perfect step, and they have been wound tight."),
			Light:    []string{"clockwork-outpost"},
			Standard: []string{"clockwork-outpost", "clockwork-patrol"},
			Heavy:    []string{"clockwork-ambush", "clockwork-vanguard"},
			EliteID:  "clockwork-vanguard",
			Guardians: []FloorBossTemplate{
				guardian("The Assembly Cathedral", "clockwork-boss-brass-colossus", "Cranes swing aside. The Brass Colossus steps down from its gantry."),
				guardian("The Great Furnace", "clockwork-boss-leviathan-boiler", "The furnace doors open like a jaw. The Leviathan Boiler is fully stoked."),
			},
			Final: FinalBossTemplate{
				FloorBossTemplate: guardian("The Clockmaker's Atelier", "clockwork-boss-the-clockmaker", "A workshop at the heart of the mechanism. The Clockmaker sets down a loupe and stops every clock in the room."),
				Mechanics:         []string{BossMechanicSummon, BossMechanicBarrier}, SummonMonsterID: "windup-scamp", BarrierLabel: "Stopped Time",
			},
			ClearedText: "The Clockmaker winds down. The clockwork empire is cleared!",
		},
		{
			ThemeID: "carnival",
			Entries: []FloorRoomTemplate{
				hall("The Ticket Booth", "ADMIT ONE. The booth is empty, and the turnstile turns by itself."),
				hall("The Midway Gate", "Bulbs flicker on down the midway, one by one, toward the party."),
			},
			Halls: []FloorRoomTemplate{
				hall("The Hall of Mirrors", "Every reflection is a little late. Some of them step out."),
				hall("The Carousel", "The horses rise and fall with nobody riding. The music is slowing down."),
				hall("The Shooting Gallery", "The tin ducks have stopped moving. The prizes have not."),
				hall("The Funhouse Corridor", "The floor tilts, the walls laugh, and something laughs back."),
				hall("The Candy Kitchen", "Vats of sugar boil over. What crawls out is still sticky."),
				hall("The Freak Show Tent", "The placards promise wonders. The wonders are out of their cages."),
			},
			Discoveries: []DiscoveryTemplate{
				discovery("The Fortune Teller's Booth", "A wax fortune teller in a glass case. Her eyes follow the party.", "Your Fortune, Told", "She offers a reading. She has never once been wrong.",
					option("Cross her palm with blood", "blood_pact"), option("Accept the charm she offers", "cursed_boon"), option("Decline politely", "leave")),
				discovery("The Elixir Wagon", "A painted wagon: DR. MARVEL'S MIRACLE TONIC, CURES ALL ILLS.", "Miracle Tonic", "Cures all ills. Results may vary.",
					option("Drink the miracle tonic", "risky_draught"), option("Sleep it off in the wagon", "uneasy_rest"), option("Read the small print and leave", "leave")),
				discovery("The Prize Counter", "Shelves of prizes nobody ever won, and a cash box under the counter.", "Everyone's a Winner", "The game was rigged. So is the counter.",
					option("Grab the cash box", "trapped_cache"), option("Load up on prizes", "greedy_haul"), option("Take nothing", "leave")),
			},
			Vault: discovery("The Ringmaster's Trunk", "A steamer trunk covered in old show bills. The night's takings, and a mask wrapped in silk.", "The Night's Takings", "The takings are fair game. The mask is smiling.",
				option("Count out the takings", "vault_coin"), option("Try on the mask", "vault_relic"), option("Close the trunk", "leave")),
			Elite:    hall("The Strongman's Ring", "The star attractions are warming up. Defeating them will strengthen the whole party."),
			Guard:    hall("The Performers' Entrance", "The whole troupe waits in the wings. The show must go on."),
			Light:    []string{"carnival-outpost"},
			Standard: []string{"carnival-outpost", "carnival-patrol"},
			Heavy:    []string{"carnival-ambush", "carnival-vanguard"},
			EliteID:  "carnival-vanguard",
			Guardians: []FloorBossTemplate{
				guardian("The Laughing Big Top", "carnival-boss-laughing-big-top", "The tent itself draws breath. The entrance was a mouth all along."),
				guardian("The Harlequin's Stage", "carnival-boss-harlequin-horror", "A spotlight snaps on. The Harlequin Horror takes a bow with too many arms."),
			},
			Final: FinalBossTemplate{
				FloorBossTemplate: guardian("The Centre Ring", "carnival-boss-the-ringmaster", "Sawdust, a drumroll, and a voice from everywhere: the Ringmaster welcomes tonight's final act."),
				Mechanics:         []string{BossMechanicSummon, BossMechanicCataclysm}, SummonMonsterID: "jester-cutthroat", CataclysmLabel: "The Grand Finale",
			},
			ClearedText: "The Ringmaster takes a last bow. The carnival is cleared!",
		},
		{
			ThemeID: "jungle",
			Entries: []FloorRoomTemplate{
				hall("The Glowing Treeline", "The canopy closes overhead and lights wake in the undergrowth. They are eyes."),
				hall("The Crash Clearing", "A scorched clearing, already overgrown. The jungle has noticed the party."),
			},
			Halls: []FloorRoomTemplate{
				hall("The Lumen Thicket", "Every leaf glows faintly. The things hunting here glow brighter."),
				hall("The Hanging Roots", "Roots trail from above like a curtain. Some of them reach."),
				hall("The Spore Meadow", "A meadow of pale blooms that turn to face the party."),
				hall("The Chitin Hollow", "A hollow tiled in shed shells. Their owners have grown."),
				hall("The Mirror Pools", "Still pools reflect a sky that is not there. Something drinks."),
				hall("The Vine Bridge", "A living bridge across a gorge. It tightens when stepped on."),
			},
			Discoveries: []DiscoveryTemplate{
				discovery("The Nectar Bloom", "A flower as tall as a house, its cup brimming with luminous nectar.", "Luminous Nectar", "Everything in this jungle that looks delicious is hunting.",
					option("Drink the nectar", "risky_draught"), option("Sleep under its petals", "uneasy_rest"), option("Back away slowly", "leave")),
				discovery("The Symbiote Pods", "Pods pulse on a fallen trunk. Each holds something that wants a host.", "Something Wants a Host", "It would make you stronger. It would also be eating.",
					option("Let one bond with you", "blood_pact"), option("Wear the pod husks as armour", "heavy_plate"), option("Burn the trunk and go", "leave")),
				discovery("The Resin Hive", "An abandoned hive, its cells full of amber resin worth a fortune off-world.", "Amber Resin", "The hive looks abandoned. Hives usually do.",
					option("Cut out the resin", "greedy_haul"), option("Break open the queen's cell", "trapped_cache"), option("Leave the hive be", "leave")),
			},
			Vault: discovery("The Heartwood Hollow", "Inside a hollow giant, amber beads litter the floor around a seed that beats like a heart.", "The Beating Seed", "The amber is safe to carry. The seed is deciding.",
				option("Collect the amber beads", "vault_coin"), option("Take the beating seed", "vault_relic"), option("Leave the hollow", "leave")),
			Elite:    hall("The Apex Den", "Two of the jungle's best hunters share this den. Defeating them will strengthen the whole party."),
			Guard:    hall("The Thorn Gate", "A wall of thorns parts just enough to show what guards it."),
			Light:    []string{"jungle-outpost"},
			Standard: []string{"jungle-outpost", "jungle-ambush", "jungle-vanguard"},
			Heavy:    []string{"jungle-patrol"},
			EliteID:  "jungle-patrol",
			Guardians: []FloorBossTemplate{
				guardian("The Heartroot Grove", "jungle-boss-heartroot-titan", "The oldest tree in the grove opens its eyes and pulls its roots out of the ground."),
				guardian("The Feeding Ground", "jungle-boss-apex-maw", "The clearing is ringed with bones. The Apex Maw unhinges."),
			},
			Final: FinalBossTemplate{
				FloorBossTemplate: guardian("The Lantern Canopy", "jungle-boss-mother-lantern", "The canopy is one creature. Mother Lantern unfurls, and every light in the jungle turns to watch."),
				Mechanics:         []string{BossMechanicSummon, BossMechanicBarrier}, SummonMonsterID: "lantern-moth", BarrierLabel: "Chrysalis of Light",
			},
			ClearedText: "Mother Lantern goes dark. The alien jungle is cleared!",
		},
		{
			ThemeID: "dreamscape",
			Entries: []FloorRoomTemplate{
				hall("The Falling-Asleep Stair", "The stairs go down and also sideways. Something at the bottom is already dreaming of the party."),
				hall("The Door in the Field", "A door stands alone in tall grass. On the other side it is later, and things are waiting."),
			},
			Halls: []FloorRoomTemplate{
				hall("The Upside-Down Parlour", "Furniture hangs from the ceiling. The guests have not noticed, and they have noticed you."),
				hall("The Hall of Clocks", "None of the clocks agree, and each insists. Their keepers are short of time."),
				hall("The Endless Corridor", "The same four doors, again and again. Something has been following for a while."),
				hall("The Paper Sea", "Waves of torn pages roll in. Things swim under the words."),
				hall("The Schoolroom", "Rows of small desks. Whatever sits in them turns around all together."),
				hall("The Staring Gallery", "The portraits watch. Then the frames are empty."),
			},
			Discoveries: []DiscoveryTemplate{
				discovery("The Tea Party", "A table laid for more guests than there are chairs. The pot is still warm.", "Do Have Some Tea", "The host insists. The host is not at the table.",
					option("Drink the tea", "risky_draught"), option("Doze off at the table", "uneasy_rest"), option("Make your excuses", "leave")),
				discovery("The Mirror That Bargains", "A tall mirror in which the party looks stronger, and thinner.", "The Better Reflection", "The reflection offers to trade places, a little at a time.",
					option("Trade a little of yourself", "vital_tithe"), option("Take its sharper edge", "glass_edge"), option("Cover the mirror", "leave")),
				discovery("The Wishing Well", "A well in the middle of a bedroom. Coins glitter a long way down.", "Other People's Wishes", "Every coin down there was somebody's wish.",
					option("Take the wishes back up", "greedy_haul"), option("Make a wish of your own", "cursed_boon"), option("Let them lie", "leave")),
			},
			Vault: discovery("The Toy Chest", "A toy chest as big as a room. Marbles of solid gold, and a music box that is already playing.", "A Tune You Almost Know", "The marbles are only marbles. The tune is one you were told to forget.",
				option("Pocket the gold marbles", "vault_coin"), option("Open the music box", "vault_relic"), option("Close the lid", "leave")),
			Elite:    hall("The Recurring Nightmare", "This one always ends the same way. Defeating it will strengthen the whole party."),
			Guard:    hall("The Edge of Waking", "The dream thins here, and its last defenders are the ones that feel most real."),
			Light:    []string{"dreamscape-outpost"},
			Standard: []string{"dreamscape-outpost", "dreamscape-patrol"},
			Heavy:    []string{"dreamscape-ambush", "dreamscape-vanguard"},
			EliteID:  "dreamscape-ambush",
			Guardians: []FloorBossTemplate{
				guardian("The Smiling Dark", "dreamscape-boss-hungry-grin", "There is nothing in the room but a smile. Then the smile opens."),
				guardian("The Nursery", "dreamscape-boss-hollow-child", "A child stands facing the corner. It asks, without turning, whether you came to play."),
			},
			Final: FinalBossTemplate{
				FloorBossTemplate: guardian("The Court of Sleep", "dreamscape-boss-moon-sovereign", "A throne beneath a moon that is far too close. The Sovereign of Sleep has been dreaming all of this."),
				Mechanics:         []string{BossMechanicCataclysm, BossMechanicBarrier}, CataclysmLabel: "Endless Night", BarrierLabel: "Veil of Dreams",
			},
			ClearedText: "The Sovereign of Sleep wakes, and is gone. The dreamscape is cleared!",
		},
		{
			ThemeID: "arctic",
			Entries: []FloorRoomTemplate{
				hall("The Buried Airlock", "The outer door is frozen open. Drifted snow leads inside, and so do tracks."),
				hall("The Vehicle Bay", "Snowcats sit under tarps of frost. One tarp is moving."),
			},
			Halls: []FloorRoomTemplate{
				hall("The Mess Hall", "Meals frozen mid-bite. The crew is still seated, until it is not."),
				hall("The Core-Sample Lab", "Racks of ice cores, and whatever thawed out of them."),
				hall("The Generator Room", "The generators cough and the lights dip. In the dark, movement."),
				hall("The Kennels", "Rows of empty cages with the doors bent outward."),
				hall("The Radio Shack", "The radio repeats one word in a voice that is almost human."),
				hall("The Ice Tunnel", "A tunnel bored through blue ice. Shapes are frozen in the walls, and one is missing."),
			},
			Discoveries: []DiscoveryTemplate{
				discovery("The Infirmary", "Cabinets of frost-cracked vials, and a field kit somebody labelled by hand.", "Hand-Labelled Vials", "The labels have smudged. One of these is a stimulant.",
					option("Inject the unlabelled vial", "risky_draught"), option("Warm up by the stove", "uneasy_rest"), option("Leave the cabinets shut", "leave")),
				discovery("The Expedition Lockers", "Lockers of cold-weather gear, left in a hurry.", "Cold-Weather Gear", "Good gear, made for the cold and nothing else.",
					option("Layer on the heavy parkas", "heavy_plate"), option("Strip down to move fast", "glass_edge"), option("Take nothing", "leave")),
				discovery("The Specimen Freezer", "A walk-in freezer. Something is frozen in a block at the back, and the block is cracked.", "Subject Zero", "The research notes call it promising. The last entry is one word.",
					option("Take a sample", "blood_pact"), option("Loot the research grant safe", "trapped_cache"), option("Lock the freezer", "leave")),
			},
			Vault: discovery("The Director's Strongroom", "A strongroom in the ice. Payroll in cash, and a sealed flask rimed with frost.", "Payroll and a Flask", "The payroll is safe. The flask is colder than the room.",
				option("Take the payroll", "vault_coin"), option("Unseal the flask", "vault_relic"), option("Seal the strongroom", "leave")),
			Elite:    hall("The Thaw Chamber", "The station's worst specimens were kept here. Defeating them will strengthen the whole party."),
			Guard:    hall("The Pressure Door", "What is left of the security detail holds the last door, frozen to their posts."),
			Light:    []string{"arctic-outpost"},
			Standard: []string{"arctic-outpost", "arctic-patrol"},
			Heavy:    []string{"arctic-ambush", "arctic-vanguard"},
			EliteID:  "arctic-ambush",
			Guardians: []FloorBossTemplate{
				guardian("The Glacier Face", "arctic-boss-glacier-titan", "The wall of the cavern calves away and stands up. The Glacier Titan has been asleep a long time."),
				guardian("The Cryo Vault", "arctic-boss-cryo-warden", "Coolant floods the floor. The Cryo Warden's lamps come on one by one."),
			},
			Final: FinalBossTemplate{
				FloorBossTemplate: guardian("The Excavation Pit", "arctic-boss-thing-in-the-ice", "At the bottom of the dig, the ice is empty. The Thing that was in it is behind you."),
				Mechanics:         []string{BossMechanicCataclysm, BossMechanicSummon}, SummonMonsterID: "husk-hound", CataclysmLabel: "Whiteout",
			},
			ClearedText: "The Thing in the Ice is still at last. The arctic station is cleared!",
		},
		{
			ThemeID: "ghosttown",
			Entries: []FloorRoomTemplate{
				hall("The Town Limits", "A sign, shot through: POPULATION, and a number scratched out. Dust devils walk the road."),
				hall("The Livery Stable", "The horses are long gone. Something still paws at the straw."),
			},
			Halls: []FloorRoomTemplate{
				hall("The Dusty Main Street", "Shutters bang. Somebody calls the party out by name."),
				hall("The Saloon", "The piano stops. Every chair scrapes back at once."),
				hall("The General Store", "Shelves of tins and a shopkeeper who never got paid."),
				hall("The Assay Office", "Scales, ledgers, and prospectors who died arguing over the weights."),
				hall("The Boot Hill Path", "A hill of crooked markers. Several graves are open from the inside."),
				hall("The Mine Head", "A cage lift over a black shaft. The night shift is coming up."),
			},
			Discoveries: []DiscoveryTemplate{
				discovery("The Snake-Oil Wagon", "A painted wagon with one bottle left on the shelf.", "The Last Bottle", "GOOD FOR WHAT AILS YOU. The salesman is buried out back.",
					option("Drink the last bottle", "risky_draught"), option("Bed down in the wagon", "uneasy_rest"), option("Ride on", "leave")),
				discovery("The Crossroads", "Two roads meet under a dead tree. A stranger in a good suit is waiting.", "A Deal at the Crossroads", "The stranger deals fair, and the stranger always collects.",
					option("Sign in blood", "blood_pact"), option("Shake on a lesser deal", "cursed_boon"), option("Tip your hat and go", "leave")),
				discovery("The Bank", "The vault door hangs off one hinge. The robbers are still here, more or less.", "An Unfinished Robbery", "They never got the strongbox open. They never left, either.",
					option("Finish the job", "trapped_cache"), option("Shoulder the gold bars", "greedy_haul"), option("Leave the dead their loot", "leave")),
			},
			Vault: discovery("The Sheriff's Lockup", "An evidence locker: confiscated gold, and a tin star that has not tarnished.", "The Tin Star", "The gold is nobody's now. The star is still on duty.",
				option("Take the confiscated gold", "vault_coin"), option("Pin on the star", "vault_relic"), option("Lock it back up", "leave")),
			Elite:    hall("The Hanging Judge's Court", "The worst of the town's dead hold court here. Defeating them will strengthen the whole party."),
			Guard:    hall("The Gallows Square", "A posse of the damned forms a line across the square."),
			Light:    []string{"ghosttown-outpost"},
			Standard: []string{"ghosttown-outpost", "ghosttown-ambush", "ghosttown-vanguard"},
			Heavy:    []string{"ghosttown-showdown"},
			EliteID:  "ghosttown-patrol",
			Guardians: []FloorBossTemplate{
				guardian("The Undertaker's Parlour", "ghosttown-boss-the-undertaker", "Coffins stand ready along the wall, already measured. The Undertaker tips his hat."),
				guardian("The Hanging Tree", "ghosttown-boss-hanging-tree", "The tree on the hill creaks without wind. Its ropes begin to sway toward the party."),
			},
			Final: FinalBossTemplate{
				FloorBossTemplate: guardian("The Street at High Noon", "ghosttown-boss-sheriff-of-the-damned", "The clock strikes twelve and keeps striking. The Sheriff of the Damned steps into the street."),
				Mechanics:         []string{BossMechanicSummon, BossMechanicCataclysm}, SummonMonsterID: "revenant-gunslinger", CataclysmLabel: "High Noon",
			},
			ClearedText: "The Sheriff of the Damned is laid to rest. The ghost town is cleared!",
		},
		{
			ThemeID: "wasteland",
			Entries: []FloorRoomTemplate{
				hall("The Scrap Gate", "A wall of welded car doors. The lookouts have already rung the bell."),
				hall("The Dry Culvert", "A drainage pipe under the wall. Something has made a nest in it."),
			},
			Halls: []FloorRoomTemplate{
				hall("The Shanty Rows", "Tin shacks lean together over a narrow lane. Raiders watch from the roofs."),
				hall("The Fuel Depot", "Rusted tanks and the stink of petrol. Nobody here wants to share."),
				hall("The Chop Shop", "Engines hang from chains. The mechanics pick up their tools."),
				hall("The Rad Pits", "Green water in old foundations. What lives in it has too many legs."),
				hall("The Market Under the Overpass", "Stalls of salvage and a crowd that goes quiet."),
				hall("The Water Works", "The only clean water for a hundred miles, and it is guarded like it."),
			},
			Discoveries: []DiscoveryTemplate{
				discovery("The Chem Den", "Bubbling glassware, a stained mattress, and a tray of unlabelled injectors.", "Unlabelled Injectors", "The cook swears by them. The cook has three teeth.",
					option("Take a hit", "risky_draught"), option("Crash on the mattress", "uneasy_rest"), option("Keep clean", "leave")),
				discovery("The Armour Tinker", "A stall hung with road signs hammered into plate, and blades ground from leaf springs.", "Road-Sign Plate", "Everything here was something else first. It all has a price.",
					option("Bolt on the sign plate", "heavy_plate"), option("Take the leaf-spring blade", "glass_edge"), option("Just browsing", "leave")),
				discovery("The Old-World Bunker", "A sealed hatch in the dirt, pried half open. A dosimeter by the door is ticking fast.", "Still Ticking", "There is salvage down there worth a fortune, and a reason it was sealed.",
					option("Haul out the salvage", "greedy_haul"), option("Sleep in the rad-shelter", "vital_tithe"), option("Seal the hatch", "leave")),
			},
			Vault: discovery("The Warlord's Stash", "A shipping container welded shut, now cut open. Bottle caps by the sack, and a pre-war case with a lit keypad.", "A Lit Keypad", "The caps spend anywhere. The case has not been opened since the bombs.",
				option("Carry off the caps", "vault_coin"), option("Punch in a code", "vault_relic"), option("Weld it shut again", "leave")),
			Elite:    hall("The Thunder Pit", "The settlement's champions fight here for sport. Defeating them will strengthen the whole party."),
			Guard:    hall("The Throne Road", "The king's own war band lines the last stretch of road, revving."),
			Light:    []string{"wasteland-outpost"},
			Standard: []string{"wasteland-outpost", "wasteland-patrol"},
			Heavy:    []string{"wasteland-ambush", "wasteland-vanguard"},
			EliteID:  "wasteland-ambush",
			Guardians: []FloorBossTemplate{
				guardian("The Arena Flats", "wasteland-boss-warlord-rig", "An engine roars behind a wall of dust. The Warlord's War-Rig comes through it."),
				guardian("The Crater", "wasteland-boss-fallout-behemoth", "The ground at the bottom of the crater is warm. The Fallout Behemoth climbs out of it."),
			},
			Final: FinalBossTemplate{
				FloorBossTemplate: guardian("The Scrap Throne", "wasteland-boss-scrap-heap-king", "A mountain of wrecks with a throne at the top. The Scrap-Heap King stands, and the mountain stands with him."),
				Mechanics:         []string{BossMechanicBarrier, BossMechanicCataclysm}, CataclysmLabel: "Avalanche of Scrap", BarrierLabel: "Scrap Plating",
			},
			ClearedText: "The Scrap-Heap King comes crashing down. The wasteland settlement is cleared!",
		},
	}
}
