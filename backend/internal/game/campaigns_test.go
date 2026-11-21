package game

import (
	"errors"
	"slices"
	"testing"
)

func TestCampaignCatalogIsValid(t *testing.T) {
	if err := validateCampaigns(); err != nil {
		t.Fatal(err)
	}
	if len(Campaigns()) < 2 {
		t.Fatalf("want several campaigns, got %d", len(Campaigns()))
	}
	// Every ordinary theme appears in at most one campaign, so each campaign visits lands of its own.
	seen := map[string]string{}
	for _, campaign := range Campaigns() {
		for _, themeID := range campaign.Themes {
			if other, ok := seen[themeID]; ok {
				t.Fatalf("%q is in both %q and %q", themeID, other, campaign.ID)
			}
			seen[themeID] = campaign.ID
		}
	}
	last := Campaigns()[len(Campaigns())-1]
	for _, campaign := range Campaigns() {
		if (campaign.Next == "") != (campaign.ID == last.ID) {
			t.Fatalf("%q: only the last campaign may have no next chapter", campaign.ID)
		}
	}
}

func TestCampaignUnlocksFollowTheStory(t *testing.T) {
	campaigns := Campaigns()
	none := func(string) bool { return false }
	if !CampaignUnlocked(campaigns[0].ID, none) {
		t.Fatal("the first campaign must be open to everyone")
	}
	if CampaignUnlocked(campaigns[1].ID, none) {
		t.Fatal("the second campaign must be locked until the first is won")
	}
	firstWon := func(id string) bool { return id == campaigns[0].ID }
	if !CampaignUnlocked(campaigns[1].ID, firstWon) || CampaignUnlocked(campaigns[2].ID, firstWon) {
		t.Fatal("winning a campaign must unlock exactly the next one")
	}
	if CampaignUnlocked("no-such-campaign", func(string) bool { return true }) {
		t.Fatal("an unknown campaign is never unlocked")
	}
}

func TestStartCampaignRunEntersItsFirstLand(t *testing.T) {
	room := newPartyRoom(2)
	campaign := Campaigns()[0]
	if err := StartCampaignRun(room, "campaign-run", campaign.ID, expeditionNow); err != nil {
		t.Fatal(err)
	}
	run := room.Run
	if run.CampaignID != campaign.ID || run.Theme() != campaign.Themes[0] {
		t.Fatalf("run is %q in %q, want %q in %q", run.CampaignID, run.Theme(), campaign.ID, campaign.Themes[0])
	}
	if run.Briefing == nil || run.Briefing.Campaign != campaign.Name || run.Briefing.Chapter != 1 || run.Briefing.Chapters != CampaignDungeons {
		t.Fatalf("briefing does not place the dungeon in the campaign: %+v", run.Briefing)
	}
	if err := StartCampaignRun(newPartyRoom(1), "bad", "no-such-campaign", expeditionNow); !errors.Is(err, ErrUnknownCampaign) {
		t.Fatalf("unknown campaign: got %v", err)
	}
}

func TestCampaignHeartsGrowWithTheCampaign(t *testing.T) {
	previous := FinalBossTemplate{}
	for _, campaign := range Campaigns() {
		heart := campaignHeart(campaign)
		if heart.HeartTier != campaign.Number || heart.EncounterID != HeartEncounterID {
			t.Fatalf("%q: heart tier %d encounter %q", campaign.ID, heart.HeartTier, heart.EncounterID)
		}
		if len(heart.Mechanics) < len(previous.Mechanics) || heart.ExtraHealthPercent < previous.ExtraHealthPercent {
			t.Fatalf("%q: the heart must not get weaker in a later campaign", campaign.ID)
		}
		previous = heart
	}
	if len(heartshardBoss.Mechanics) >= len(campaignHeart(Campaigns()[0]).Mechanics) {
		t.Fatal("the heartshard must be a lesser version of the final heart")
	}
}

func TestCampaignRoadEndsInTheHeartsChamber(t *testing.T) {
	campaign := Campaigns()[1]
	run := &Run{Seed: 11, CampaignID: campaign.ID}
	for dungeon, want := range map[int]string{2: campaign.Themes[1], 3: campaign.Themes[2], CampaignCastleDungeon: campaign.Capstone} {
		if road := campaignRoad(run, campaign, dungeon); road.ThemeID != want || road.Heart {
			t.Fatalf("dungeon %d road is %+v, want %q", dungeon, road, want)
		}
	}
	chamber := campaignRoad(run, campaign, CampaignChamberDungeon)
	if !chamber.Heart || chamber.ThemeID != campaign.Capstone || chamber.Floors != CampaignChamberFloors {
		t.Fatalf("chamber road is %+v", chamber)
	}
	run.Dungeon = CampaignShardDungeon
	if boss := campaignFinalBoss(run); boss == nil || boss.EncounterID != LesserHeartEncounterID {
		t.Fatalf("dungeon 2 boss is %+v, want the heartshard", boss)
	}
	run.Dungeon = 3
	if campaignFinalBoss(run) != nil {
		t.Fatal("dungeon 3 keeps its own boss")
	}
	run.Dungeon = CampaignChamberDungeon
	if boss := campaignFinalBoss(run); boss == nil || boss.HeartTier != campaign.Number {
		t.Fatalf("chamber boss is %+v, want the tier %d heart", boss, campaign.Number)
	}
	run.ThemeID = campaign.Capstone
	if briefing := newDungeonBriefing(run); briefing.Name != "The Heart's Chamber" || briefing.Chapter != CampaignChamberDungeon || len(briefing.Lines) != 1 || briefing.Lines[0] != campaign.Chamber {
		t.Fatalf("chamber briefing %+v should tell the chamber's own story", briefing)
	}
}

func TestCampaignHeartsAreBuiltIntoFloors(t *testing.T) {
	campaign := Campaigns()[2]
	heart := campaignHeart(campaign)
	entry, rooms := generateFloor(&heart, campaign.Capstone, 5, 1, 1, 2, nil, 9)
	if rooms[entry] == nil {
		t.Fatal("no entry room")
	}
	found := false
	for _, room := range rooms {
		if room.RoomType != "boss" || room.Encounter == nil {
			continue
		}
		for _, enemy := range room.Encounter.Enemies {
			if enemy.DefinitionID == HeartMonsterID {
				found = true
				if enemy.HeartTier != campaign.Number || !enemy.hasMechanic(BossMechanicAnchor) {
					t.Fatalf("chamber heart %+v lacks its tier or mechanics", enemy)
				}
			}
		}
	}
	if !found {
		t.Fatal("the chamber has no heart")
	}
}

// TestCampaignPlaysThroughToVictory drives whole campaign runs through the real commands: the road is the
// campaign's, the heartshard falls in dungeon 2, the shop never sells the lure and the final heart ends the run.
func TestCampaignPlaysThroughToVictory(t *testing.T) {
	campaign := Campaigns()[0]
	won := 0
	for seed := int64(1); seed <= 12 && won == 0; seed++ {
		report, err := SimulateRunWithPolicy(seed, SimulationCampaignPrefix+campaign.ID, []string{ClassBulwark, ClassCleric, ClassArcanist, ClassRanger}, 6000, RunPolicyTactical)
		if err != nil {
			t.Fatal(err)
		}
		road := append(append([]string(nil), campaign.Themes...), campaign.Capstone, campaign.Capstone)
		if !slices.Equal(report.DungeonThemes, road[:len(report.DungeonThemes)]) {
			t.Fatalf("seed %d took %v, not the campaign road %v", seed, report.DungeonThemes, road)
		}
		if report.CampaignWon {
			won++
			if report.DungeonsCleared != CampaignDungeons || report.Wiped {
				t.Fatalf("seed %d won after %d dungeons (wiped %v)", seed, report.DungeonsCleared, report.Wiped)
			}
		}
	}
	if won == 0 {
		t.Fatal("no simulated party of four won the first campaign in 12 seeds")
	}
}
