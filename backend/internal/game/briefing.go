package game

import (
	"fmt"
	"sort"
	"time"
)

// A dungeon briefing is the intro the party sees on entering a dungeon: a few lines in the voice of whoever sent
// them down there, what lives inside, and a dossier on the boss at the bottom with advice drawn from the boss's
// real mechanics. It is generated once per dungeon and stored on the run, so every client shows the same one.

// DungeonBriefingWindow is extra time on the first round of every dungeon, so reading the briefing never costs
// anyone their first turn.
const DungeonBriefingWindow = 25 * time.Second

// FloorTransitionWindow is extra time on the first round of every new floor, for the descent the clients play
// between floors (ADR 0039). It is a little longer than the animation, so arriving never costs a turn.
const FloorTransitionWindow = 3 * time.Second

// RunPrologueWindow is extra time on the very first round of a run, for the prologue cutscene the clients play
// before the first briefing (ADR 0039). Players who skip it can act at once; the round still resolves as soon as
// everyone has chosen.
const RunPrologueWindow = 50 * time.Second

// extendFirstRound holds the round the party has just been placed into, if there is one, while the clients play
// what comes before it: its countdown is pushed back by window, and starts as soon as every player is ready
// (markCombatReady) if that is sooner. The windows add up, so they are the most a party can be kept waiting.
func extendFirstRound(run *Run, window time.Duration) {
	if run.CombatRound != nil {
		run.CombatRound.StartedAt = run.CombatRound.StartedAt.Add(window)
		run.CombatRound.Deadline = run.CombatRound.Deadline.Add(window)
		run.CombatRound.Held = true
	}
}

// markCombatReady records that a player's screen is ready for a held round (the prologue, briefing or descent has
// closed, or they have already chosen an action). When every player who can act is ready, the countdown starts now.
func markCombatReady(room *Room, actorID string, now time.Time) {
	round := room.Run.CombatRound
	if round == nil || !round.Held {
		return
	}
	if round.Ready == nil {
		round.Ready = map[string]bool{}
	}
	round.Ready[actorID] = true
	for _, playerID := range eligibleCombatPlayers(room) {
		if !round.Ready[playerID] {
			if _, acted := round.Actions[playerID]; !acted {
				return
			}
		}
	}
	round.Held = false
	if now.Before(round.StartedAt) {
		round.StartedAt = now.UTC()
		round.Deadline = round.StartedAt.Add(CombatActionWindow)
	}
}

// SubmitCombatReady is the "combat_ready" command: this player's screen has finished what it played before a held
// round, so their countdown can begin.
func SubmitCombatReady(room *Room, actorID string, command Command, now time.Time) error {
	run := room.Run
	if run == nil || run.Phase != PhaseCombat || run.CombatRound == nil {
		return ErrInvalidPhase
	}
	if _, ok := run.Players[actorID]; !ok {
		return ErrNotPlayer
	}
	if command.Round != run.CombatRound.Number {
		return ErrStaleCombatRound
	}
	markCombatReady(room, actorID, now)
	return nil
}

type DungeonBriefing struct {
	Dungeon  int      `json:"dungeon"`
	ThemeID  string   `json:"themeId"`
	Name     string   `json:"name"`
	Tagline  string   `json:"tagline"`
	Narrator string   `json:"narrator"`
	Lines    []string `json:"lines"`
	Floors   int      `json:"floors"`
	// Threats are the names of the creatures the dungeon's halls hold.
	Threats  []string `json:"threats"`
	Boss     string   `json:"boss"`
	BossLair string   `json:"bossLair"`
	// Advice is one tip per boss mechanic, naming the boss's own moves.
	Advice    []string              `json:"advice"`
	Modifiers []ActiveFloorModifier `json:"modifiers,omitempty"`
	// Campaign names the campaign this dungeon belongs to, and Chapter which of its Chapters it is (ADR 0041).
	Campaign string `json:"campaign,omitempty"`
	Chapter  int    `json:"chapter,omitempty"`
	Chapters int    `json:"chapters,omitempty"`
}

type themeBriefing struct {
	narrator string
	lines    []string
}

var themeBriefings = map[string]themeBriefing{
	"catacombs": {"Brother Ossic, last keeper of the upper crypts", []string{
		"Right. Torches lit? Good. Down there the dead have stopped staying dead, and frankly it is ruining the ambience.",
		"Bring your own light, mind the bones that move, and if something asks you to bleed on an altar, consider saying no.",
	}},
	"scifi": {"FACILITY AI, cheerfully", []string{
		"Welcome, unauthorised personnel! Containment has been breached on every level. This is fine.",
		"Please do not feed the specimens. Please do not let the specimens feed on you. Please enjoy your visit.",
	}},
	"mobster": {"A nervous informant in a wet trench coat", []string{
		"Listen, you didn't hear it from me. The family's got the whole underworld locked down tighter than a speakeasy door.",
		"Goons on every corner, tommy guns in every violin case. Hit 'em fast, and whatever you do, don't owe 'em money.",
	}},
	"sunken": {"The Tide-Herald, gurgling", []string{
		"The old kingdom sank in a single night, and its people learned to breathe water. They did not learn to be friendly.",
		"Hold your breath when you must, keep your blade dry when you can, and never answer the singing.",
	}},
	"clockwork": {"Chief Artificer Brasswhistle", []string{
		"Every gear in the Empire turns on schedule, and you, I'm afraid, are not on the schedule.",
		"Its guardians strike with perfect timing. Learn the rhythm, break the rhythm, then break the guardians.",
	}},
	"carnival": {"The Ringmaster's voice, from everywhere at once", []string{
		"Step right up, step right down, step right into the GREATEST SHOW BELOW THE EARTH!",
		"Tickets are free. Leaving is extra. Do clap for the clowns; they get so very upset when you don't.",
	}},
	"jungle": {"Xenobiologist Dr. Imre Vash, whispering", []string{
		"Everything in this jungle glows, and everything that glows is hungry. I have catalogued four hundred species of teeth.",
		"Move quietly. Strike first. If the plants start following you, that is normal. If they start talking, run.",
	}},
	"dreamscape": {"A voice that sounds a lot like your own", []string{
		"You fell asleep. Don't worry, everyone does. The trouble is that here, the nightmares are awake.",
		"Up may be down. Doors may be mouths. Trust your party, not your eyes, and try very hard not to blink.",
	}},
	"arctic": {"Station Commander Halvorsen, over crackling radio", []string{
		"Station Nine went dark three weeks ago. The last transmission was screaming and the sound of ice cracking.",
		"It's minus sixty down there and whatever they were growing in the labs likes it that way. Keep moving or freeze.",
	}},
	"ghosttown": {"An old prospector, rocking on a porch that isn't there", []string{
		"This town died at high noon, partner, and it's been reliving that noon ever since.",
		"The sheriff's a revenant, the saloon's haunted and the gunslingers never miss twice. Draw quick, or join 'em.",
	}},
	"wasteland": {"Mayor Rustjaw of the last settlement", []string{
		"Out past the fence it's scavengers, scrap-beasts and things that used to be dogs. Mostly used to be.",
		"Take what you can carry, burn what you can't, and if you see the Junk King, give him our regards. With a hammer.",
	}},
	"noir": {"A private eye with a voice like gravel in a coffee cup", []string{
		"It was raining, the way it always rains in this city. The kind of rain that washes nothing clean.",
		"Every alley has a gun in it and every gun has a story. Keep your hat low, your back to the wall, and trust nobody in a nice suit.",
	}},
	"arcade": {"A blinking INSERT COIN sign", []string{
		"PLAYER ONE, PRESS START. PLAYER TWO, PRESS START. EVERYBODY ELSE, PLEASE STOP TOUCHING THE SCREEN.",
		"Learn the patterns, grab the power-ups, and remember: the boss always has a weak point. Probably.",
	}},
	"eldritch": {"A cartographer whose maps keep redrawing themselves", []string{
		"Four dungeons deep, the roads all bend toward the same black castle. It was not there yesterday. It is always there.",
		"Something sleeps under the keep and the walls dream for it. Cut its limbs before you cut it, and do not be surprised when it wakes a second time.",
	}},
	"infernal": {"A demon notary, stamping your soul in triplicate", []string{
		"Congratulations on your fourth conquest. The Archfiend requests the pleasure of your company, and your company's screaming.",
		"His servants are lunch. Kill them before he eats them, or he grows fat on every one you leave alive.",
	}},
}

// newDungeonBriefing describes the dungeon a run has just entered.
func newDungeonBriefing(run *Run) *DungeonBriefing {
	themeID := run.Theme()
	theme, _ := defaultDungeonThemeCatalog.Theme(themeID)
	voice := themeBriefings[themeID]
	briefing := &DungeonBriefing{
		Dungeon: dungeonNumber(run), ThemeID: themeID, Name: theme.Name, Tagline: theme.Tagline,
		Narrator: voice.narrator, Lines: append([]string(nil), voice.lines...), Floors: run.MaxDepth,
		Modifiers: append([]ActiveFloorModifier(nil), run.DungeonModifiers...),
	}
	expedition, err := defaultExpeditionThemeCatalog.Theme(themeID)
	if err != nil {
		return briefing
	}
	briefing.Threats = expeditionThreats(expedition)
	final := expedition.Final
	if campaign, ok := run.campaign(); ok {
		briefing.Campaign = campaign.Name
		briefing.Chapter = dungeonNumber(run)
		briefing.Chapters = CampaignDungeons
		if override := campaignFinalBoss(run); override != nil {
			// The campaign's hearts take this dungeon's boss's place, and the briefing says so.
			final = *override
		}
		if dungeonNumber(run) == CampaignChamberDungeon {
			briefing.Name = "The Heart's Chamber"
			briefing.Tagline = "One floor, and the heart at the bottom of it."
			briefing.Lines = []string{campaign.Chamber}
			briefing.Threats = nil
		}
	}
	briefing.BossLair = final.RoomName
	boss := ""
	if encounter, err := defaultEncounterCatalog.Encounter(final.EncounterID); err == nil {
		for _, spawn := range encounter.Enemies {
			if monster, err := defaultMonsterCatalog.Monster(spawn.MonsterID); err == nil && monster.Role == MonsterRoleBoss {
				boss = monster.Name
			}
		}
	}
	briefing.Boss = boss
	briefing.Advice = bossAdvice(boss, final)
	return briefing
}

// expeditionThreats lists the distinct non-boss creatures of a dungeon's ordinary encounters, up to five.
func expeditionThreats(theme ExpeditionTheme) []string {
	seen := map[string]bool{}
	var names []string
	for _, encounterID := range append(append(append([]string(nil), theme.Light...), theme.Standard...), theme.Heavy...) {
		encounter, err := defaultEncounterCatalog.Encounter(encounterID)
		if err != nil {
			continue
		}
		for _, spawn := range encounter.Enemies {
			monster, err := defaultMonsterCatalog.Monster(spawn.MonsterID)
			if err != nil || monster.Role == MonsterRoleBoss || seen[monster.Name] {
				continue
			}
			seen[monster.Name] = true
			names = append(names, monster.Name)
		}
	}
	sort.Strings(names)
	if len(names) > 5 {
		names = names[:5]
	}
	return names
}

func bossAdvice(boss string, final FinalBossTemplate) []string {
	if boss == "" {
		boss = "The boss"
	}
	advice := []string{fmt.Sprintf("Below %d%% health %s enrages and every hit lands %d harder. Save your big skills for the finish.", BossEnrageHealthPercent, boss, BossEnrageDamageBonus)}
	for _, mechanic := range final.Mechanics {
		switch mechanic {
		case BossMechanicBarrier:
			advice = append(advice, fmt.Sprintf("Every %d turns it raises %s. Basic attacks bounce off it; every other skill cuts straight through.", BossBarrierEveryTurns, final.BarrierLabel))
		case BossMechanicCataclysm:
			advice = append(advice, fmt.Sprintf("Every %d turns it unleashes %s on the whole party. Bring an interrupt, and keep it off cooldown for that turn.", BossCataclysmEveryTurns, final.CataclysmLabel))
		case BossMechanicSummon:
			name := "reinforcements"
			if monster, err := defaultMonsterCatalog.Monster(final.SummonMonsterID); err == nil {
				name = "a " + monster.Name
			}
			advice = append(advice, fmt.Sprintf("At %d%% health it calls %s. Skills that hit every enemy earn their slot here.", BossSummonHealthPercent, name))
		default:
			if line := capstoneAdvice(mechanic, final); line != "" {
				advice = append(advice, line)
			}
		}
	}
	return advice
}

// briefDungeon records the briefing of the dungeon a run has just entered and gives its first round the
// briefing window.
func briefDungeon(run *Run) {
	run.Briefing = newDungeonBriefing(run)
	extendFirstRound(run, DungeonBriefingWindow)
}

func validateThemeBriefings() error {
	for _, theme := range append(PlayableDungeonThemes(), CapstoneDungeonThemes()...) {
		voice, ok := themeBriefings[theme.ID]
		if !ok || voice.narrator == "" || len(voice.lines) == 0 {
			return fmt.Errorf("playable theme %q has no briefing", theme.ID)
		}
	}
	return nil
}
