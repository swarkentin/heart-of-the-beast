package game

import (
	"errors"
	"fmt"
	"testing"
	"time"
)

// capstoneBossRoom starts a castle directly (only simulations and tests may) and puts the party in front of the
// boss of floor depth, with plenty of health.
func capstoneBossRoom(t *testing.T, themeID string, players, depth int) (*Room, *Encounter) {
	t.Helper()
	room := newPartyRoom(players)
	if err := startExpeditionWithSeed(room, "castle-"+themeID, themeID, 7, expeditionNow); err != nil {
		t.Fatal(err)
	}
	run := room.Run
	run.Depth = depth
	_, rooms := generateExpeditionFloor(themeID, run.Seed, depth, run.MaxDepth, players, nil, CapstoneExtraDepth)
	for id, dungeonRoom := range rooms {
		run.Rooms[id] = dungeonRoom
	}
	run.CurrentRoomID = fmt.Sprintf("d%d-boss", depth)
	run.Phase = PhaseCombat
	for _, player := range run.Players {
		player.Health, player.MaxHealth = 500, 500
	}
	startCombatRound(room, expeditionNow)
	return room, run.Rooms[run.CurrentRoomID].Encounter
}

func TestCastlesAreNotOfferedInTheLobbyOrAtOrdinaryCrossroads(t *testing.T) {
	for _, theme := range PlayableDungeonThemes() {
		if theme.Capstone {
			t.Fatalf("capstone %q is offered in the lobby", theme.ID)
		}
	}
	room := newPartyRoom(1)
	if err := StartMultiLevelRunForTheme(room, "castle-first", "eldritch", expeditionNow); !errors.Is(err, ErrThemeNotPlayable) {
		t.Fatalf("starting in a castle: %v", err)
	}
	for seed := uint64(1); seed <= 40; seed++ {
		for dungeon := 2; dungeon <= 16; dungeon++ {
			choices := rollDungeonChoices(seed, "catacombs", dungeon)
			if len(choices) != DungeonChoiceCount {
				t.Fatalf("seed %d dungeon %d: %d choices", seed, dungeon, len(choices))
			}
			for _, choice := range choices {
				if choice.Capstone != IsCapstoneDungeon(dungeon) || IsCapstoneTheme(choice.ThemeID) != choice.Capstone {
					t.Fatalf("seed %d dungeon %d offers %+v", seed, dungeon, choice)
				}
				if choice.Capstone && choice.Floors != CapstoneFloors {
					t.Fatalf("a castle has %d floors, want %d", choice.Floors, CapstoneFloors)
				}
			}
			if IsCapstoneDungeon(dungeon) && choices[0].ThemeID == choices[1].ThemeID {
				t.Fatalf("both castles should be offered: %+v", choices)
			}
		}
	}
	if !IsCapstoneDungeon(5) || !IsCapstoneDungeon(10) || IsCapstoneDungeon(4) || IsCapstoneDungeon(6) {
		t.Fatal("castles crown every group of four dungeons: 5, 10, 15...")
	}
}

func TestEveryCastleBossIsArmedAndCastlesFightDeeper(t *testing.T) {
	for _, themeID := range []string{"eldritch", "infernal"} {
		for depth := 1; depth <= CapstoneFloors; depth++ {
			_, rooms := generateExpeditionFloor(themeID, 11, depth, CapstoneFloors, 1, nil, CapstoneExtraDepth)
			boss := rooms[fmt.Sprintf("d%d-boss", depth)].Encounter.Enemies[0]
			if len(boss.Mechanics) == 0 {
				t.Errorf("%s floor %d boss %s has no mechanics", themeID, depth, boss.Name)
			}
			if boss.hasMechanic(BossMechanicEnrage) != (depth == CapstoneFloors) {
				t.Errorf("%s floor %d: only the castle's master enrages: %v", themeID, depth, boss.Mechanics)
			}
		}
	}
	room := newPartyRoom(1)
	if err := startExpeditionWithSeed(room, "deeper", "infernal", 3, expeditionNow); err != nil {
		t.Fatal(err)
	}
	if room.Run.MaxDepth != CapstoneFloors || dungeonExtraDepth(room.Run) != CapstoneExtraDepth {
		t.Fatalf("castle depth %d, extra %d", room.Run.MaxDepth, dungeonExtraDepth(room.Run))
	}
}

func TestAnchoredBossTakesHalfDamageUntilItsAnchorsFall(t *testing.T) {
	room, encounter := capstoneBossRoom(t, "eldritch", 1, CapstoneFloors)
	boss := &encounter.Enemies[0]
	if !boss.Anchored || livingAnchors(encounter, 0) != BossAnchorCount || !hasEvent(room.Run, "boss_anchor") {
		t.Fatalf("the Sleeper should raise %d anchors on its first turn: %+v", BossAnchorCount, encounter.Enemies)
	}
	if got := traitDamageTaken(room.Run, encounter, boss, 10, 0, false); got != 5 {
		t.Fatalf("anchored damage %d, want 5", got)
	}
	for i := range encounter.Enemies {
		if encounter.Enemies[i].Anchor {
			encounter.Enemies[i].Health = 0
		}
	}
	if got := traitDamageTaken(room.Run, encounter, boss, 10, 0, false); got != 10 {
		t.Fatalf("unanchored damage %d, want 10", got)
	}
	// The anchors grow back on the next anchor turn while none stand, until the waves run out.
	for boss.TurnsTaken < BossAnchorEveryTurns+1 {
		bossRound(t, room, Command{Action: "defend"})
		boss = &encounter.Enemies[0]
	}
	if livingAnchors(encounter, 0) != BossAnchorCount || boss.AnchorWavesLeft != BossAnchorWaves-2 {
		t.Fatalf("anchors should regrow on turn %d: %d standing, %d waves left", boss.TurnsTaken, livingAnchors(encounter, 0), boss.AnchorWavesLeft)
	}
	if len(encounter.Enemies) > MaxEncounterEnemies {
		t.Fatalf("regrown anchors must reuse fallen slots: %d enemies", len(encounter.Enemies))
	}
}

func TestRebirthBossRisesOnceBeforeTheFightIsWon(t *testing.T) {
	room, encounter := capstoneBossRoom(t, "eldritch", 1, 1) // the Dreaming Bishop
	run := room.Run
	boss := &encounter.Enemies[0]
	if !boss.hasMechanic(BossMechanicRebirth) {
		t.Fatalf("floor 1 of the castle should be the Dreaming Bishop: %+v", boss)
	}
	boss.Health = 1
	bossRound(t, room, Command{Action: "skill", Skill: SkillStrike, TargetID: boss.ID})
	boss = &encounter.Enemies[0]
	if run.Phase != PhaseCombat || !boss.Reborn || boss.Health != boss.MaxHealth*BossRebirthHealthPercent/100 || !hasEvent(run, "boss_rebirth") {
		t.Fatalf("the bishop should rise again at half health: phase=%s %+v", run.Phase, boss)
	}
	boss.Health = 1
	bossRound(t, room, Command{Action: "skill", Skill: SkillStrike, TargetID: boss.ID})
	if encounter.Status != EncounterCleared {
		t.Fatalf("the second death is final: %+v", encounter.Enemies[0])
	}
}

func TestLegionBossCallsServantsAndDevoursThem(t *testing.T) {
	room, encounter := capstoneBossRoom(t, "infernal", 1, 2) // the Chain Duke
	run := room.Run
	boss := &encounter.Enemies[0]
	if !boss.hasMechanic(BossMechanicLegion) || !boss.hasMechanic(BossMechanicDevour) || boss.DevourIn != BossDevourEveryTurns-1 {
		t.Fatalf("floor 2 of the citadel should be the Chain Duke: %+v", boss)
	}
	for boss.TurnsTaken < BossLegionEveryTurns {
		bossRound(t, room, Command{Action: "defend"})
		boss = &encounter.Enemies[0]
	}
	if livingServants(encounter, 0) != 1 || !hasEvent(run, "boss_legion") || !hasEvent(run, "boss_hunger") {
		t.Fatalf("on turn %d the duke calls an imp and warns that it is hungry: %+v", boss.TurnsTaken, encounter.Enemies)
	}
	boss.Health = boss.MaxHealth / 2
	before, bonus := boss.Health, boss.DamageBonus
	bossRound(t, room, Command{Action: "defend"})
	boss = &encounter.Enemies[0]
	if livingServants(encounter, 0) != 0 || boss.Devoured != 1 || boss.DamageBonus != bonus+1 || !hasEvent(run, "boss_devour") {
		t.Fatalf("on turn %d the duke devours its imp: %+v", boss.TurnsTaken, encounter.Enemies)
	}
	if healed := boss.Health - before; healed < BossDevourHeal-2*3 { // its drain may also have healed or the imp's
		t.Fatalf("devouring healed %d", healed)
	}
	// Devour never raises damage past its cap.
	boss.Devoured = BossDevourMaxBonus
	encounter.Enemies = append(encounter.Enemies, Enemy{ID: "spare", DefinitionID: "cackling-imp", Name: "Cackling Imp", Health: 5, MaxHealth: 5})
	devourServants(run, encounter, 0, 0)
	if encounter.Enemies[0].Devoured != BossDevourMaxBonus {
		t.Fatalf("devour bonus over the cap: %d", encounter.Enemies[0].Devoured)
	}
}

func TestCastleBossesOfferBoonsAndTheChoiceIsTimeBoxed(t *testing.T) {
	room, encounter := capstoneBossRoom(t, "infernal", 2, 1)
	run := room.Run
	for i := range encounter.Enemies {
		encounter.Enemies[i].Health = 0
	}
	encounter.Enemies[0].Health = 1
	encounter.Enemies[0].Mechanics = nil
	bossRound(t, room, Command{Action: "skill", Skill: SkillStrike, TargetID: encounter.Enemies[0].ID})
	camp := run.Camp
	if run.Phase != PhaseIntermission || camp == nil || camp.Stage != CampStageBoon || !camp.BoonOnly || camp.Deadline == nil {
		t.Fatalf("floor 1 of a castle has no camp, but its boss is worth a boon: %+v", camp)
	}
	offers := camp.BoonOffers["player-1"]
	if len(offers) != BoonOfferCount || len(camp.BoonOffers["player-2"]) != BoonOfferCount {
		t.Fatalf("each adventurer is offered %d boons: %+v", BoonOfferCount, camp.BoonOffers)
	}
	if err := ApplyCommand(room, "player-1", Command{Type: "choose_boon", ChoiceID: "not-offered"}, expeditionNow); err == nil {
		t.Fatal("only an offered boon can be claimed")
	}
	if err := ApplyCommand(room, "player-1", Command{Type: "choose_boon", ChoiceID: offers[1].ID}, expeditionNow); err != nil {
		t.Fatal(err)
	}
	if err := ApplyCommand(room, "player-1", Command{Type: "choose_boon", ChoiceID: offers[2].ID}, expeditionNow); err == nil {
		t.Fatal("one boon per boss")
	}
	if run.Phase != PhaseIntermission {
		t.Fatal("the party waits for everyone until the deadline")
	}
	AdvanceCamp(room, camp.Deadline.Add(time.Second))
	if run.Phase != PhaseCombat || run.Depth != 2 || run.Camp != nil {
		t.Fatalf("after the boons the party goes straight down: phase=%s depth=%d", run.Phase, run.Depth)
	}
	if got := run.Players["player-1"].Boons; len(got) != 1 || got[0] != offers[1].ID {
		t.Fatalf("player-1 boons %v", got)
	}
	if got := run.Players["player-2"].Boons; len(got) != 1 || got[0] != camp.BoonOffers["player-2"][0].ID {
		t.Fatalf("a player who did not choose gets the first offer: %v", got)
	}
}

func TestCastleCampsChooseBoonsBeforeTheGame(t *testing.T) {
	room, encounter := capstoneBossRoom(t, "eldritch", 1, CapstoneFloors/2)
	run := room.Run
	for i := range encounter.Enemies {
		encounter.Enemies[i].Health = 0
		encounter.Enemies[i].Reborn = true
		encounter.Enemies[i].Barrier = 0
		encounter.Enemies[i].Mechanics = nil
	}
	encounter.Enemies[0].Health = 1
	bossRound(t, room, Command{Action: "skill", Skill: SkillStrike, TargetID: encounter.Enemies[0].ID})
	if run.Camp == nil || run.Camp.Stage != CampStageBoon || run.Camp.BoonOnly {
		t.Fatalf("the castle's midpoint camp opens with boons: %+v", run.Camp)
	}
	if err := ApplyCommand(room, "player-1", Command{Type: "choose_boon", ChoiceID: run.Camp.BoonOffers["player-1"][0].ID}, expeditionNow); err != nil {
		t.Fatal(err)
	}
	if run.Camp.Stage != CampStageGame {
		t.Fatalf("a solo choice moves straight on to the game: %s", run.Camp.Stage)
	}
}

func TestBoonOffersNeverRepeatAnOwnedBoon(t *testing.T) {
	room, _ := capstoneBossRoom(t, "infernal", 1, 1)
	player := room.Run.Players["player-1"]
	for _, boon := range boonCatalog {
		if !boon.Repeatable {
			player.Boons = append(player.Boons, boon.ID)
		}
	}
	offers := rollBoonOffers(room)["player-1"]
	if len(offers) == 0 {
		t.Fatal("a repeatable boon keeps the offer from running dry")
	}
	for _, offer := range offers {
		if !offer.Repeatable {
			t.Fatalf("offered an owned boon: %s", offer.ID)
		}
	}
}

func TestBoonsChangeHowAFightPlays(t *testing.T) {
	player := &PlayerState{ID: "p", Health: 10, MaxHealth: 40, GuardReduction: 0}
	room := &Room{PlayerIDs: []string{"p"}, Run: &Run{Players: map[string]*PlayerState{"p": player}}}

	grantBoon(room, "p", Boon{ID: BoonStoneHeart, Name: "Stone Heart"})
	if player.MaxHealth != 40+BoonStoneHeartHealth || player.Health != 10+BoonStoneHeartHealth || player.GuardReduction != BoonStoneHeartGuard {
		t.Fatalf("stone heart: %+v", player)
	}

	player.Boons = append(player.Boons, BoonUndyingOath, BoonPactOfRuin)
	if got := boonIncomingDamage(room, player, 100, 1); got != player.Health-1 || !player.ClassCombat.OathSpent {
		t.Fatalf("the oath should leave its owner at 1: took %d", got)
	}
	if got := boonIncomingDamage(room, player, 100, 1); got != 100+BoonPactPenalty {
		t.Fatalf("the oath holds once per fight: took %d", got)
	}
	resetFightStatuses(room.Run)
	if player.ClassCombat.OathSpent {
		t.Fatal("the oath renews every fight")
	}

	enemy := &Enemy{Health: 9, MaxHealth: 30, TurnsTaken: 2}
	player.Boons = append(player.Boons, BoonExecutioner)
	if got := boonDamageMultiplier(player, enemy, 10); got != 10+10*BoonExecutionerPercent/100 {
		t.Fatalf("executioner on a wounded enemy: %d", got)
	}
	enemy.Health = 20
	if got := boonDamageMultiplier(player, enemy, 10); got != 10 {
		t.Fatalf("executioner on a healthy enemy: %d", got)
	}

	player.Boons = append(player.Boons, BoonOpeningGambit)
	fresh := &Encounter{Enemies: []Enemy{{Health: 5, TurnsTaken: 1}}}
	later := &Encounter{Enemies: []Enemy{{Health: 5, TurnsTaken: 2}}}
	if boonStrikeBonus(player, fresh) != BoonPactDamage+BoonOpeningGambitDamage || boonStrikeBonus(player, later) != BoonPactDamage {
		t.Fatalf("opening gambit: %d / %d", boonStrikeBonus(player, fresh), boonStrikeBonus(player, later))
	}

	player.Boons = append(player.Boons, BoonQuickMind)
	if boonCooldown(player, 4) != 3 || boonCooldown(player, 2) != 2 {
		t.Fatal("quickened mind shortens cooldowns, but never to the same round")
	}
}

func TestBoonCatalogValidates(t *testing.T) {
	if err := validateBoonCatalog(); err != nil {
		t.Fatal(err)
	}
}

func TestExpeditionRecordsTheThemeOfEveryDungeon(t *testing.T) {
	room := startExpedition(t, 1, "noir", "history")
	run := room.Run
	if len(run.DungeonThemes) != 1 || run.DungeonThemes[0] != "noir" {
		t.Fatalf("history %v", run.DungeonThemes)
	}
	run.Depth = run.MaxDepth
	boss := *run.Rooms["d1-boss"]
	boss.ID = bossRoomID(run)
	run.Rooms[boss.ID] = &boss
	clearFloorBoss(t, room)
	finishCamp(t, room)
	if run.Dungeon != 2 || len(run.DungeonThemes) != 2 || run.DungeonThemes[1] != run.ThemeID {
		t.Fatalf("dungeon %d history %v theme %s", run.Dungeon, run.DungeonThemes, run.ThemeID)
	}
}
