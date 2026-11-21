package game

import (
	"testing"
)

// The Heart of the Beast (ADR 0040).

func TestTheHeartReplacesOneDungeonBossInEight(t *testing.T) {
	hearts := 0
	const dungeons = 4000
	for i := 0; i < dungeons; i++ {
		run := &Run{Seed: uint64(i) * 0x9e3779b97f4a7c15, Dungeon: 1 + i%7}
		if summonHeart(run) {
			hearts++
		}
	}
	if share := float64(hearts) / dungeons; share < 0.105 || share > 0.145 {
		t.Fatalf("the heart should take about one dungeon boss in %d, got %.3f", HeartChanceDenominator, share)
	}
	run := &Run{Seed: 7, Dungeon: 1, HeartLured: true}
	if !summonHeart(run) || run.HeartLured {
		t.Fatal("a Beast Lure always summons the heart, and is spent doing it")
	}
}

// descendToFinalFloor takes the party down to the last floor of the dungeon and returns its boss.
func descendToFinalFloor(t *testing.T, room *Room) *Enemy {
	t.Helper()
	run := room.Run
	run.Depth = run.MaxDepth - 1
	descendExpedition(room, expeditionNow)
	boss := run.Rooms[bossRoomID(run)]
	if run.Depth != run.MaxDepth || boss == nil || boss.Encounter == nil {
		t.Fatalf("expected the final floor's boss room, depth %d of %d", run.Depth, run.MaxDepth)
	}
	return &boss.Encounter.Enemies[0]
}

func TestABeastLureMakesTheNextDungeonBossTheHeart(t *testing.T) {
	room := startExpedition(t, 2, "arctic", "lure-run")
	run := room.Run
	clearToCamp(t, room)
	for _, play := range run.Camp.Game.Players {
		play.Done = true
	}
	AdvanceCamp(room, expeditionNow)
	run.Players["player-1"].Gold = HeartLurePrice + 5
	if err := ApplyCommand(room, "player-1", Command{Type: "buy", ChoiceID: "beast-lure"}, expeditionNow); err != nil {
		t.Fatal(err)
	}
	if !run.HeartLured || run.Players["player-1"].Gold != 5 {
		t.Fatalf("the lure costs %d gold and lures the heart: lured=%v gold=%d", HeartLurePrice, run.HeartLured, run.Players["player-1"].Gold)
	}
	for _, offer := range run.Camp.Offers {
		if offer.ID == "beast-lure" {
			t.Fatal("one lure is enough: it leaves the shelf once bought")
		}
	}
	run.Camp = nil
	heart := descendToFinalFloor(t, room)
	if heart.DefinitionID != HeartMonsterID || !heart.hasMechanic(BossMechanicEnrage) || !heart.hasMechanic(BossMechanicBarrier) || !heart.hasMechanic(BossMechanicCataclysm) {
		t.Fatalf("the lured dungeon boss should be the heart, armed like a dungeon boss: %+v", heart)
	}
	if run.HeartLured {
		t.Fatal("the lure is spent")
	}
}

func TestTheHeartIsAsToughAsTheDungeonBossItReplaces(t *testing.T) {
	for _, themeID := range []string{"noir", "arcade", "jungle"} {
		plain := startExpedition(t, 2, themeID, "plain-"+themeID)
		boss := descendToFinalFloor(t, plain)
		lured := startExpedition(t, 2, themeID, "plain-"+themeID)
		lured.Run.HeartLured = true
		heart := descendToFinalFloor(t, lured)
		if heart.DefinitionID != HeartMonsterID {
			t.Fatal("expected the heart")
		}
		// Within a quarter of the boss it replaces; the simulation in ADR 0040 checks the fight itself.
		if heart.MaxHealth*4 < boss.MaxHealth*3 || heart.MaxHealth*4 > boss.MaxHealth*5 {
			t.Errorf("%s: heart health %d should be close to the %s's %d", themeID, heart.MaxHealth, boss.Name, boss.MaxHealth)
		}
	}
}

func TestEveryWoundOnTheHeartIsTalliedPerPlayer(t *testing.T) {
	room := startExpedition(t, 2, "arctic", "tally-run")
	run := room.Run
	run.HeartLured = true
	heart := descendToFinalFloor(t, room)
	run.CurrentRoomID = bossRoomID(run)
	run.Phase = PhaseCombat
	startCombatRound(room, expeditionNow)
	heart = &run.Rooms[run.CurrentRoomID].Encounter.Enemies[0]
	heart.Barrier = 0
	start := heart.Health
	for _, playerID := range []string{"player-1", "player-2"} {
		command := Command{Type: "combat", Round: run.CombatRound.Number, Action: "skill", Skill: basicAttackOf(run.Players[playerID]), TargetID: heart.ID}
		if err := ApplyCommand(room, playerID, command, expeditionNow); err != nil {
			t.Fatal(err)
		}
	}
	if len(run.HeartStrikes) != 1 {
		t.Fatalf("one fight, one strike: %+v", run.HeartStrikes)
	}
	strike := run.HeartStrikes[0]
	if strike.ByPlayer["player-1"] <= 0 || strike.ByPlayer["player-2"] <= 0 {
		t.Fatalf("both players hit the heart: %+v", strike.ByPlayer)
	}
	if lost := int64(start - heart.Health); strike.Damage() < lost {
		t.Fatalf("every point the heart lost is tallied: tallied %d, lost at least %d", strike.Damage(), lost)
	}

	// Bring it to its knees: the last blow drives it off and wins the fight like any boss.
	heart.Health = 1
	command := Command{Type: "combat", Round: run.CombatRound.Number, Action: "skill", Skill: basicAttackOf(run.Players["player-1"]), TargetID: heart.ID}
	if err := ApplyCommand(room, "player-1", command, expeditionNow); err != nil {
		t.Fatal(err)
	}
	if err := ApplyCommand(room, "player-2", Command{Type: "combat", Round: run.CombatRound.Number, Action: "defend"}, expeditionNow); err != nil {
		t.Fatal(err)
	}
	if !run.HeartStrikes[0].DrivenOff || run.Rooms[bossRoomID(run)].Encounter.Status != EncounterCleared {
		t.Fatalf("driving the heart off ends the fight as a boss kill: %+v", run.HeartStrikes[0])
	}
	if run.DungeonsCleared != 1 {
		t.Fatalf("driving the heart off clears the dungeon, got %d", run.DungeonsCleared)
	}
}

func TestTheHeartTemplatesAreValidBossesAndCastlesGetTheirExtraMechanic(t *testing.T) {
	for _, template := range []FinalBossTemplate{heartFinalBoss, heartCastleBoss} {
		if err := validateBossMechanics(template, defaultDungeonThemeCatalog, defaultMonsterCatalog, "noir"); err != nil {
			t.Fatal(err)
		}
	}
	_, rooms := generateFloor(heartBossFor("eldritch"), "eldritch", 99, CapstoneFloors, CapstoneFloors, 2, nil)
	for _, room := range rooms {
		if room.RoomType == "boss" && room.Encounter != nil && !room.Encounter.Enemies[0].hasMechanic(BossMechanicRebirth) {
			t.Fatalf("a castle's heart rises again like a castle boss: %+v", room.Encounter.Enemies[0])
		}
	}
}
