package game

// catacombsFloorTemplate is the original generated-floor content for Forgotten Catacombs. Its text, encounters
// and random-draw order must not change without a deliberate content migration: persisted runs and the
// determinism regression test rely on it.
func catacombsFloorTemplate() FloorTemplate {
	return FloorTemplate{
		ThemeID: "catacombs",
		Entry:   FloorRoomTemplate{Name: "The Lower Threshold", Description: "The air grows colder. Old warding marks pulse beneath the dust as the next descent stirs awake."},
		EntryExits: [2]ExitTemplate{
			{Label: "The Broken Cloister", Description: "A guarded passage through collapsed stone."},
			{Label: "The Silted Stair", Description: "A narrow route where something moves below the water."},
		},
		EntryEncounterID: "depth-entry",
		LeftNames:        []string{"The Silted Cloister", "The Ashen Stair", "The Drowned Archive", "The Hollow Nave", "The Shattered Ossuary"},
		LeftDescription:  "A formation of ancient defenders blocks the route. Their movements are deliberate and practiced.",
		Right:            FloorRoomTemplate{Name: "The Silted Stair", Description: "Black water spills down the steps. A quick-moving crypt stalker waits in the dark."},
		RouteEncounters:  [2][2]string{{"depth-left-guardian", "depth-right-scout"}, {"depth-left-scout", "depth-right-guardian"}},
		ShrineExitLabel:  "The Echoing Shrine",
		Shrine:           FloorRoomTemplate{Name: "The Echoing Shrine", Description: "A low harmonic vibrates through the stone. The shrine offers a brief moment of power, but its blessing is uncertain."},
		ShrineEvents: []FloorEventTemplate{{
			Title: "A Resonance in the Stone", Description: "The party can draw strength from the shrine before continuing.",
			Choices: []EventChoice{
				{ID: "ward", Label: "Take the ward", Description: "Gain a small defensive blessing for the rest of the run.", Effect: "shrine_ward"},
				{ID: "leave", Label: "Leave it untouched", Description: "Keep moving without disturbing the shrine.", Effect: "leave"},
			},
		}},
		Guard:            FloorRoomTemplate{Name: "The Guarded Descent", Description: "The final defenders of this level stand between the party and the next descent."},
		GuardEncounterID: "depth-guard",
		GuardExitLabel:   "The Floor Guardian",
		Bosses: []FloorBossTemplate{
			{RoomName: "The Ossuary Champion", EncounterID: "depth-boss-ossuary", Description: "A vast chamber opens around an ancient guardian. The dungeon's deeper rhythm pounds through the walls."},
			{RoomName: "The Warden Below", EncounterID: "depth-boss-warden", Description: "A vast chamber opens around an ancient guardian. The dungeon's deeper rhythm pounds through the walls."},
		},
		Miniboss: FloorMinibossTemplate{
			Chance: 48, EncounterID: "depth-miniboss", Name: "The Sealed Reliquary",
			Description:   "A hulking champion tears free from its stone bindings. Defeating it will strengthen the whole party.",
			ChallengeExit: ExitTemplate{Label: "The Sealed Reliquary", Description: "A dangerous optional challenge with a run reward."},
			RejoinLabel:   "Return to the Descent",
		},
		ClearedText: "The final guardian falls. The catacombs are cleared!",
	}
}

// scifiFloorTemplate is the Sci-Fi Research Facility content: three floors of containment wings, crawlways and
// security checkpoints, with a different boss on each floor and the rogue AI Overseer at the bottom.
func scifiFloorTemplate() FloorTemplate {
	return FloorTemplate{
		ThemeID: "scifi",
		Entry:   FloorRoomTemplate{Name: "The Decontamination Airlock", Description: "Sterilising mist hangs in the air as warning strobes pulse across the wet floor. Something inside the walls is awake."},
		EntryExits: [2]ExitTemplate{
			{Label: "The Containment Wing", Description: "A sealed ward where the specimens were kept, held by those who stayed."},
			{Label: "The Maintenance Crawlway", Description: "A cramped service route still patrolled by security machines."},
		},
		EntryEncounterID: "scifi-outpost",
		LeftNames:        []string{"The Containment Wing", "The Specimen Gallery", "The Quarantine Ward", "The Cryo Archive", "The Bio-Lab Atrium"},
		LeftDescription:  "Rows of cracked specimen tanks glow green. Whatever escaped them is still moving between the aisles.",
		Right:            FloorRoomTemplate{Name: "The Maintenance Crawlway", Description: "Dripping conduits and flickering panels line a tight service route. Machines keep following their patrol orders."},
		RouteEncounters:  [2][2]string{{"scifi-patrol", "scifi-ambush"}, {"scifi-ambush", "scifi-patrol"}},
		ShrineExitLabel:  "The Terminal Alcove",
		Shrine:           FloorRoomTemplate{Name: "The Terminal Alcove", Description: "A lone console still runs on emergency power, offering a brief window to reroute the facility's systems."},
		ShrineEvents: []FloorEventTemplate{
			{
				Title: "A Console Still Humming", Description: "The emergency grid can be rerouted to your suits before the lockdown resumes.",
				Choices: []EventChoice{
					{ID: "ward", Label: "Reroute power to shields", Description: "Gain a small defensive blessing for the rest of the run.", Effect: "shrine_ward"},
					{ID: "leave", Label: "Leave it untouched", Description: "Keep moving without touching the system.", Effect: "leave"},
				},
			},
			{
				Title: "A Quiet Medical Station", Description: "An autodoc offers a field-grade shield treatment, though its logs show it has failed before.",
				Choices: []EventChoice{
					{ID: "ward", Label: "Accept the treatment", Description: "Gain a small defensive blessing for the rest of the run.", Effect: "shrine_ward"},
					{ID: "leave", Label: "Walk past it", Description: "Keep moving without trusting the machine.", Effect: "leave"},
				},
			},
		},
		Guard:            FloorRoomTemplate{Name: "The Security Checkpoint", Description: "The last defenders of this level hold the lift to the lower sectors. Their targeting lights sweep the room."},
		GuardEncounterID: "scifi-vanguard",
		GuardExitLabel:   "The Sector Core",
		Bosses: []FloorBossTemplate{
			{RoomName: "The Containment Bay", EncounterID: "scifi-boss-containment-mech", Description: "Hydraulic locks release and Containment Unit-9 stands up inside its bay. Its piston arms are still counting."},
			{RoomName: "The Outbreak Chamber", EncounterID: "scifi-boss-patient-zero", Description: "The walls are grown over with something that was once a patient. It turns toward the party all at once."},
			{RoomName: "The Overseer's Core", EncounterID: "scifi-boss-overseer-core", Description: "Banks of servers rise into the dark around a single burning lens. The facility's mind has been waiting for visitors."},
		},
		Miniboss: FloorMinibossTemplate{
			Chance: 48, EncounterID: "scifi-breach", Name: "The Breached Cell",
			Description:   "A test subject has torn free of its restraints and its keeper drone is still active. Defeating them will strengthen the whole party.",
			ChallengeExit: ExitTemplate{Label: "The Breached Cell", Description: "A dangerous optional challenge with a run reward."},
			RejoinLabel:   "Return to the Lift",
		},
		ClearedText: "The final guardian falls. The research facility is cleared!",
	}
}
