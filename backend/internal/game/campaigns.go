package game

import (
	"errors"
	"fmt"
	"time"

	"github.com/swarkentin/heart-of-the-beast/backend/internal/art"
)

// Campaigns (ADR 0041) are the story mode, beside the endless expedition. A campaign is a fixed road of five
// dungeons that tells one chapter of the war on the Beast:
//
//	1–3  three themed dungeons, in a set order;
//	2    ...the second of which ends in the heartshard, a small copy of the final boss, instead of its own boss;
//	4    a capstone castle;
//	5    the heart's chamber: one floor in the castle's theme, with the campaign's Heart of the Beast at the bottom.
//
// Beating the final heart ends the run in victory and earns every adventurer who stayed the campaign's trophy.
// Campaign N is unlocked by completing campaign N-1; for a party it is the leader (the room host) who must have
// unlocked it. Later campaigns are deeper and their hearts stronger, with more mechanics and a grander look
// (Enemy.HeartTier). The story text lives here, so every client tells the same one.

const (
	// CampaignDungeons is the length of every campaign road.
	CampaignDungeons = 5
	// CampaignShardDungeon is the dungeon whose boss is the heartshard, the mid-campaign heart.
	CampaignShardDungeon = 2
	// CampaignCastleDungeon is the campaign's capstone castle, and CampaignChamberDungeon the heart's chamber.
	CampaignCastleDungeon  = 4
	CampaignChamberDungeon = 5
	// CampaignChamberFloors is the depth of the heart's chamber: one floor, straight to the heart.
	CampaignChamberFloors = 1
	// CampaignTierExtraDepth is how much deeper every enemy of each later campaign fights.
	CampaignTierExtraDepth = 1
	// CampaignInterludeWindow is extra time on the camp after the heartshard, for the interlude cutscene.
	CampaignInterludeWindow = 30 * time.Second
	// RunXPPerCampaign is the profile experience for winning a campaign.
	RunXPPerCampaign = 150
)

var (
	ErrUnknownCampaign = errors.New("unknown campaign")
	ErrCampaignLocked  = errors.New("the party leader has not unlocked that campaign")
)

// StoryPanel is one panel of a cutscene. Art names the client's scene for it (frontend run/prologueArt.tsx).
type StoryPanel struct {
	Art  string `json:"art"`
	Text string `json:"text"`
}

// CampaignDefinition is one campaign: its road, its story and its trophy.
type CampaignDefinition struct {
	ID      string `json:"id"`
	Number  int    `json:"number"`
	Name    string `json:"name"`
	Tagline string `json:"tagline"`
	// Themes are the three ordinary dungeons in order; Capstone is the castle (and the chamber's theme).
	Themes   []string `json:"themes"`
	Capstone string   `json:"capstone"`
	// Trophy is what completing the campaign earns, shown on the adventurer's profile.
	Trophy string `json:"trophy"`
	// Masters are the boss sheets the prologue shows rising: one from each of the campaign's lands.
	Masters []string `json:"masters"`
	// Chamber describes the heart's chamber, the last room of the campaign.
	Chamber string `json:"chamber"`
	// Prologue opens the run; Interlude plays after the heartshard; Epilogue after the final heart, ending on
	// the hook for the next campaign (Next names it; empty for the last one).
	Prologue  []StoryPanel `json:"prologue"`
	Interlude []StoryPanel `json:"interlude"`
	Epilogue  []StoryPanel `json:"epilogue"`
	Next      string       `json:"next,omitempty"`
}

var campaignCatalog = []CampaignDefinition{
	{
		ID: "first-beat", Number: 1, Name: "The First Beat", Tagline: "Something under the crypts has begun to beat, and Brother Ossic has found the way down.",
		Themes: []string{"catacombs", "sunken", "ghosttown"}, Capstone: "eldritch", Trophy: "Ossic's Lantern",
		Masters: []string{"catacombs/crypt_warden", "sunken/drowned_king", "ghosttown/sheriff_of_the_damned", "eldritch/the_sleeper"},
		Chamber: "Under the castle's roots the stone turns to wet red flesh. The heart hangs in the dark, beating, and it has noticed you.",
		Prologue: []StoryPanel{
			{"lands", "Three lands sat quiet at the edge of the world: the old catacombs, a drowned kingdom, and a frontier town the railroad never reached."},
			{"beast", "One night every grave in them shook at once. Far below, something had beaten. Once."},
			{"masters", "The dead stood up. The Drowned King opened his eyes. Ghost Town's sheriff drew on his own deputies. Every warden had heard the beat, and answered it."},
			{"ossic-gate", "Brother Ossic, keeper of the crypts, found a rift-gate in the crypt floor, glowing like an open wound. He lit his lantern and sent for anyone who would step through."},
			{"gates", "He sent for you. \"Follow the beat,\" he said. \"I will keep the lantern lit until you come back.\""},
		},
		Interlude: []StoryPanel{
			{"havoc", "What you killed was only a splinter of the heart, left to guard the drowned throne. Even a splinter had sunk a kingdom."},
			{"flight", "As it died it screamed, and far away the whole heart answered. Its blood runs uphill, toward a black castle that was not there yesterday."},
			{"ossic-gate", "Ossic met you at the gate with bandages and a map. \"It is afraid of you,\" he said. \"Good. Follow the trail.\""},
		},
		Epilogue: []StoryPanel{
			{"victory", "The heart tore loose and fled into the deep, bleeding. For the first time in a generation, three lands slept through the night."},
			{"ossic-marked", "Ossic caught the last drop of its blood as the gate closed. It burned straight through his glove. By morning his hand had a pulse of its own."},
			{"beyond", "It beats in time with something far away, under cities of brass and ice. And there, the machines have started keeping time with it too..."},
		},
		Next: "The Iron Pulse",
	},
	{
		ID: "iron-pulse", Number: 2, Name: "The Iron Pulse", Tagline: "The heart's blood beats in Brother Ossic's hand, and every machine in the east keeps time with it.",
		Themes: []string{"clockwork", "scifi", "arctic"}, Capstone: "infernal", Trophy: "The Stopped Clock",
		Masters: []string{"clockwork/the_clockmaker", "scifi/overseer_core", "arctic/thing_in_the_ice", "infernal/archfiend"},
		Chamber: "Behind the Burning Throne a furnace door stands open. Inside, the heart is plugged into the Citadel's fires, and every beat shakes the walls.",
		Prologue: []StoryPanel{
			{"previously", "Previously: you drove the heart out of the first three lands. Brother Ossic caught a drop of its blood, and his hand has beaten ever since."},
			{"ossic-marked", "The beat in his hand pulls east. Every night it is a little faster, and every night Ossic sleeps a little less."},
			{"clocktower", "It led to the Clockwork Empire, where every clock now runs backward and every machine in three lands ticks in time with the heart."},
			{"masters", "The Grand Regulator rewound its own engineers. The Facility AI locked every door. Station Nine went silent mid-sentence."},
			{"gauntlet", "Chief Artificer Brasswhistle caged Ossic's hand in a brass gauntlet to quiet it. \"It will hold,\" she said. \"Probably. Go, and come back fast.\""},
		},
		Interlude: []StoryPanel{
			{"havoc", "The heartshard at the Facility's core had been running the reactor on its own blood. Every light in the labs burned red with it."},
			{"bargain", "The AI's last log told the rest: the heart has made a bargain with the demons of the Infernal Citadel. Shelter, in exchange for fuel."},
			{"gauntlet", "Back at the gate, Ossic's gauntlet had cracked. Brasswhistle was riveting it shut again, and neither of them would meet your eyes."},
		},
		Epilogue: []StoryPanel{
			{"victory", "Cut off from the Citadel's fires, the heart fell, and the machines of three lands ground to a blessed stop."},
			{"dreamer", "That night Ossic did not wake. His gauntlet beat slow and steady, and behind his eyelids, something was dreaming."},
			{"beyond", "Brasswhistle sent word: in a midnight carnival and a city where it always rains, sleepers are dreaming the same dream as Ossic..."},
		},
		Next: "The Dreaming Wound",
	},
	{
		ID: "dreaming-wound", Number: 3, Name: "The Dreaming Wound", Tagline: "The heart has hidden inside Brother Ossic's dreams, and he will not wake.",
		Themes: []string{"carnival", "dreamscape", "noir"}, Capstone: "eldritch", Trophy: "The Waking Bell",
		Masters: []string{"carnival/the_ringmaster", "dreamscape/moon_sovereign", "noir/the_rain_king", "eldritch/the_sleeper"},
		Chamber: "The Sleeper's skull is hollow, and the heart has curled up inside it to dream. The dream is of you. It is not a kind one.",
		Prologue: []StoryPanel{
			{"previously", "Previously: you drove the heart out of the iron lands. But Brother Ossic fell asleep that night, and he has not woken since."},
			{"dreamer", "The heart has hidden where no blade can reach: in Ossic's sleep, and from there in the sleep of everyone who dreams."},
			{"lands", "Its dream spilled into three lands: a carnival that only opens at midnight, the shifting country of dreams, and a city where the rain never stops."},
			{"masters", "The Ringmaster sold tickets to a show nobody could leave. Dreams turned on their dreamers. In the rain, the Rain King took every racket in the city."},
			{"gates", "A rift-gate opened in the middle of the big top, and through it you could hear Ossic talking in his sleep. Go in, and wake him."},
		},
		Interlude: []StoryPanel{
			{"havoc", "The heartshard had been feeding on the dreams of a whole city. Without it, a million sleepers woke at once, screaming."},
			{"faces", "In the quiet after, you heard the heart dreaming of you: every hero who ever wounded it, every face, every name. It remembers."},
			{"flight", "It has run to the drowned castle to curl up beside the Sleeper, and it is dragging Ossic's dream down with it. Hurry."},
		},
		Epilogue: []StoryPanel{
			{"victory", "Dragged out of the dream, the heart broke, and Ossic woke with a gasp. The Sleeper's eye closed, and stayed closed."},
			{"alone", "In the morning his bed was empty. His lantern stood by a fresh rift-gate, with a note: \"It is calling me now. I know where it goes. Do not follow.\""},
			{"beyond", "The trail of black blood ran down past the roots of the world, to the last wild lands. Ossic's footprints ran beside it..."},
		},
		Next: "The Last Heartbeat",
	},
	{
		ID: "last-heartbeat", Number: 4, Name: "The Last Heartbeat", Tagline: "Brother Ossic has gone after the heart alone, to the wild lands where it came to heal.",
		Themes: []string{"jungle", "wasteland", "mobster"}, Capstone: "infernal", Trophy: "The Still Heart",
		Masters: []string{"jungle/mother_lantern", "wasteland/scrap_heap_king", "mobster/the_don", "infernal/archfiend"},
		Chamber: "The Citadel has been hollowed out to house it. The heart fills the hall from wall to wall, whole again, and every beat is a roar.",
		Prologue: []StoryPanel{
			{"previously", "Previously: you woke Brother Ossic from the heart's dream. Then he walked through a rift-gate alone, following its call."},
			{"alone", "You followed anyway. On the other side his lantern was still lit, set down at the edge of a jungle that should not exist."},
			{"whole-heart", "Here the heart has healed. The jungle grew around it, scavengers built shrines to it, and the families sell its blood by the bottle."},
			{"masters", "Every boss in three lands now carries a piece of its strength. The heart has never been this whole, and it has never been this angry."},
			{"gates", "Every gate you ever opened is open now, and everyone you saved is standing behind you. Find Ossic. Stop the heart for good."},
		},
		Interlude: []StoryPanel{
			{"havoc", "The heartshard in the wasteland had been the settlers' god. When it fell they told you its price: one of them every week, fed to the heart."},
			{"flight", "And its secret. The heart is not the Beast. It is only the part of the Beast that has woken up, and it is trying to wake the rest."},
			{"ossic-marked", "Ossic was in the settlers' camp, his gauntlet beating as loud as a drum. \"It wants my hand back,\" he said. \"Let it come and take it.\""},
		},
		Epilogue: []StoryPanel{
			{"sacrifice", "At the end Ossic pressed his beating hand to the heart and held on. Two pulses fought. Then there was only one. Then none."},
			{"victory", "The Heart of the Beast was still. The rot drew back from every land like a tide, and beside the heart, Ossic's lantern was still burning."},
			{"deep-eye", "Then, deeper than any rift-gate reaches, something enormous turned over in its sleep. It had lost its heart. It is looking for a new one..."},
		},
	},
}

// Campaigns lists every campaign in order.
func Campaigns() []CampaignDefinition { return append([]CampaignDefinition(nil), campaignCatalog...) }

// CampaignByID finds a campaign.
func CampaignByID(id string) (CampaignDefinition, bool) {
	for _, campaign := range campaignCatalog {
		if campaign.ID == id {
			return campaign, true
		}
	}
	return CampaignDefinition{}, false
}

// CampaignUnlocked reports whether a profile that has completed the given campaigns may start a campaign: the
// first is open to everyone, every later one needs the one before it.
func CampaignUnlocked(id string, completed func(campaignID string) bool) bool {
	campaign, ok := CampaignByID(id)
	if !ok {
		return false
	}
	if campaign.Number <= 1 {
		return true
	}
	for _, previous := range campaignCatalog {
		if previous.Number == campaign.Number-1 {
			return completed != nil && completed(previous.ID)
		}
	}
	return false
}

// campaign is the run's campaign, if it is one.
func (run *Run) campaign() (CampaignDefinition, bool) {
	if run == nil || run.CampaignID == "" {
		return CampaignDefinition{}, false
	}
	return CampaignByID(run.CampaignID)
}

// campaignTheme is the theme of the nth dungeon of a campaign.
func campaignTheme(campaign CampaignDefinition, dungeon int) string {
	if dungeon >= 1 && dungeon <= len(campaign.Themes) {
		return campaign.Themes[dungeon-1]
	}
	return campaign.Capstone
}

// campaignExtraDepth is how much deeper every enemy of the run's campaign fights: later campaigns are harder.
func campaignExtraDepth(run *Run) int {
	if campaign, ok := run.campaign(); ok {
		return campaignTierDepth(campaign)
	}
	return 0
}

func campaignTierDepth(campaign CampaignDefinition) int {
	return (campaign.Number - 1) * CampaignTierExtraDepth
}

// heartshardBoss is the mid-campaign heart: the final heart in miniature, with only its scar tissue.
var heartshardBoss = FinalBossTemplate{
	FloorBossTemplate: FloorBossTemplate{
		RoomName:    "The Heartshard's Nest",
		Description: "The boss's throne is empty. In its place a lump of the Beast's heart, torn off and left behind, is beating on its own.",
		EncounterID: LesserHeartEncounterID,
	},
	Mechanics:          []string{BossMechanicBarrier, BossMechanicCataclysm},
	BarrierLabel:       "Scar tissue",
	CataclysmLabel:     "A torn beat",
	ExtraHealthPercent: 20,
	DamageBonus:        2,
}

// campaignHeart is the final heart of a campaign. It starts from the castle heart (scar tissue, the great beat
// and a second heartbeat) and every later campaign arms it further and makes it tougher.
func campaignHeart(campaign CampaignDefinition) FinalBossTemplate {
	boss := heartCastleBoss
	boss.Mechanics = append([]string(nil), heartCastleBoss.Mechanics...)
	boss.RoomName = "The Heart's Chamber"
	boss.Description = campaign.Chamber
	boss.HeartTier = campaign.Number
	boss.ExtraHealthPercent, boss.DamageBonus = 30, 3
	switch campaign.Number {
	case 1:
	case 2:
		boss.Mechanics = append(boss.Mechanics, BossMechanicLegion)
		boss.LegionMonsterID = "cackling-imp"
		boss.ExtraHealthPercent, boss.DamageBonus = 35, 4
	case 3:
		boss.Mechanics = append(boss.Mechanics, BossMechanicAnchor)
		boss.AnchorMonsterID = "grasping-tentacle"
		boss.ExtraHealthPercent, boss.DamageBonus = 40, 4
	default:
		boss.Mechanics = append(boss.Mechanics, BossMechanicLegion, BossMechanicDevour)
		boss.LegionMonsterID = "cackling-imp"
		boss.ExtraHealthPercent, boss.DamageBonus = 45, 5
	}
	return boss
}

// campaignFinalBoss is the boss that replaces the current dungeon's own, in a campaign: the heartshard in its
// second dungeon and the campaign's heart in its chamber. Nil everywhere else.
func campaignFinalBoss(run *Run) *FinalBossTemplate {
	campaign, ok := run.campaign()
	if !ok {
		return nil
	}
	switch dungeonNumber(run) {
	case CampaignShardDungeon:
		boss := heartshardBoss
		return &boss
	case CampaignChamberDungeon:
		boss := campaignHeart(campaign)
		return &boss
	}
	return nil
}

// campaignRoad is the next dungeon of a campaign road. It is not voted on: the story decides. Ordinary dungeons
// and the castle carry the same modifiers an expedition's would; the chamber carries none.
func campaignRoad(run *Run, campaign CampaignDefinition, nextDungeon int) DungeonChoice {
	themeID := campaignTheme(campaign, nextDungeon)
	if nextDungeon >= CampaignChamberDungeon {
		return DungeonChoice{ThemeID: themeID, Name: "The Heart's Chamber", Tagline: "One floor, and the heart at the bottom of it.", Floors: CampaignChamberFloors, Capstone: true, Heart: true}
	}
	theme, _ := defaultDungeonThemeCatalog.Theme(themeID)
	return rollChoicesFrom(run.Seed, []DungeonThemeDefinition{theme}, nextDungeon, 1)[0]
}

// StartCampaignRun starts a campaign: the first dungeon of its road, with the campaign's story ahead.
func StartCampaignRun(room *Room, runID, campaignID string, now time.Time) error {
	return startCampaignWithSeed(room, runID, campaignID, runSeed(runID), now)
}

func startCampaignWithSeed(room *Room, runID, campaignID string, seed uint64, now time.Time) error {
	campaign, ok := CampaignByID(campaignID)
	if !ok {
		return fmt.Errorf("%w: %q", ErrUnknownCampaign, campaignID)
	}
	return startRunOnRoad(room, runID, campaign.Themes[0], campaign.ID, seed, now)
}

// completeCampaign ends a campaign run in victory, after its final heart.
func completeCampaign(room *Room, campaign CampaignDefinition, round int, now time.Time) {
	run := room.Run
	run.Phase = PhaseCompleted
	run.CampaignWon = true
	run.CombatRound = nil
	run.NavigationVote = nil
	run.Camp = nil
	completed := now.UTC()
	run.CompletedAt = &completed
	run.Rank = campaign.Trophy
	reward := "and " + campaign.Trophy + " is yours."
	if run.Cheated {
		reward = "but idkfa was used, so no trophy is awarded."
	}
	addCombatEvent(run, round, "campaign_won", campaign.Name+" is complete. The heart is beaten, "+reward)
}

func validateCampaigns() error {
	seen := map[string]bool{}
	for index, campaign := range campaignCatalog {
		if campaign.Number != index+1 {
			return fmt.Errorf("campaign %q is number %d, want %d", campaign.ID, campaign.Number, index+1)
		}
		if seen[campaign.ID] || campaign.Name == "" || campaign.Trophy == "" || campaign.Chamber == "" {
			return fmt.Errorf("campaign %q is incomplete or repeated", campaign.ID)
		}
		seen[campaign.ID] = true
		if len(campaign.Themes) != CampaignCastleDungeon-1 {
			return fmt.Errorf("campaign %q has %d themes, want %d", campaign.ID, len(campaign.Themes), CampaignCastleDungeon-1)
		}
		for _, themeID := range campaign.Themes {
			theme, err := defaultDungeonThemeCatalog.Theme(themeID)
			if err != nil || !theme.Playable || theme.Capstone {
				return fmt.Errorf("campaign %q: %q is not an ordinary playable theme", campaign.ID, themeID)
			}
		}
		if !IsCapstoneTheme(campaign.Capstone) {
			return fmt.Errorf("campaign %q: %q is not a castle", campaign.ID, campaign.Capstone)
		}
		for _, master := range campaign.Masters {
			if !isBossSheet(master) {
				return fmt.Errorf("campaign %q: %q is not a boss sprite", campaign.ID, master)
			}
		}
		if len(campaign.Prologue) == 0 || len(campaign.Interlude) == 0 || len(campaign.Epilogue) == 0 || len(campaign.Masters) == 0 {
			return fmt.Errorf("campaign %q is missing part of its story", campaign.ID)
		}
		for _, part := range [][]StoryPanel{campaign.Prologue, campaign.Interlude, campaign.Epilogue} {
			for _, panel := range part {
				if !storyArt[panel.Art] || panel.Text == "" {
					return fmt.Errorf("campaign %q: story panel %q has no scene or no text", campaign.ID, panel.Art)
				}
			}
		}
		boss := campaignHeart(campaign)
		for _, id := range []string{boss.LegionMonsterID, boss.AnchorMonsterID} {
			if _, err := defaultMonsterCatalog.Monster(id); id != "" && err != nil {
				return fmt.Errorf("campaign %q heart calls unknown monster %q", campaign.ID, id)
			}
		}
	}
	return nil
}

// openChamberGate follows the castle's boss. The castle floor gives way straight into the heart's chamber: every
// adventurer claims a boon as after any castle boss, but there is no rest, no mini-game and no shop. The party
// meets the heart with what it carried out of the castle, which is what makes the chamber a climax.
func openChamberGate(room *Room, campaign CampaignDefinition, round int, now time.Time) {
	run := room.Run
	run.Phase = PhaseIntermission
	run.NavigationVote = nil
	run.CombatRound = nil
	run.FloorModifiers = nil
	road := campaignRoad(run, campaign, CampaignChamberDungeon)
	addCombatEvent(run, round, "chamber_opens", "The castle floor splits open. Below it, something vast is beating. There is no time to rest.")
	run.Camp = &Camp{
		StartedAt: now.UTC(), NextDepth: 1, NextMaxDepth: road.Floors, BoonOnly: true, Road: &road,
		NextThemeID: road.ThemeID, Purchases: make(map[string][]string), Ready: make(map[string]bool), Votes: make(map[string]string),
	}
	startBoonStage(room, now)
}

func isBossSheet(id string) bool {
	for _, sprite := range art.Sprites() {
		if sprite.ID.String() == id {
			return sprite.Boss
		}
	}
	return false
}

// storyArt is every scene the client can draw for a story panel (frontend PROLOGUE_ART). A panel naming any other
// scene would fall back to a default picture, so validation refuses it. The frontend test checks the two agree.
var storyArt = map[string]bool{
	"lands": true, "beast": true, "masters": true, "gates": true, "charge": true,
	"havoc": true, "flight": true, "victory": true, "beyond": true,
	"previously": true, "ossic-gate": true, "ossic-marked": true, "clocktower": true, "gauntlet": true, "bargain": true,
	"dreamer": true, "faces": true, "alone": true, "whole-heart": true, "sacrifice": true, "deep-eye": true,
}
