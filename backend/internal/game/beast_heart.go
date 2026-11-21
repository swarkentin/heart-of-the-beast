package game

import (
	"sort"

	"github.com/swarkentin/heart-of-the-beast/backend/internal/art"
)

// The Heart of the Beast (ADR 0040) is the shared objective behind every run. Its true health is one pool for
// every party on the server, kept across runs in the server's store (store.BeastHeartRepository).
//
// In a run the heart is a dungeon boss like any other, balanced like one: it has a boss's health, moves and
// mechanics, and the party wins the fight by bringing that health to zero, which drives the heart off. It turns up
// in place of a dungeon's boss one time in HeartChanceDenominator, or always after someone buys a Beast Lure.
//
// Every point of damage dealt to it is tallied per player on the run (Run.HeartStrikes), win or lose, and the HTTP
// layer banks those tallies into the shared pool and the high scores after every saved transition.

// BeastHeartInitialHealth is the size of the shared pool when a server first starts. It lives in the store after
// that, so retuning it is a data change, not a deploy.
const BeastHeartInitialHealth int64 = 1_000_000

const (
	// HeartMonsterID and HeartEncounterID are the heart's catalog entries.
	HeartMonsterID   = "heart-of-the-beast"
	HeartEncounterID = "beast-heart"
	// LesserHeartMonsterID and LesserHeartEncounterID are the heartshard, the mid-campaign heart (campaigns.go).
	LesserHeartMonsterID   = "heartshard"
	LesserHeartEncounterID = "beast-heartshard"
	// HeartThemeID is the heart's own art theme. It is not a dungeon theme; the heart appears in every one.
	HeartThemeID = "beast"
	// HeartChanceDenominator: the heart takes a dungeon boss's place one time in this many.
	HeartChanceDenominator = 8
	// HeartLurePrice is the gold a Beast Lure costs. It makes the next dungeon boss the heart.
	HeartLurePrice = 250
	// HeartPartyKey is the tally key for damage no single player dealt (damage over time, the party's effects).
	HeartPartyKey = ""
)

// heartMoves are the heart's moves; their labels match the sprite's attack and special (scripts/pixel-art/themes/beast.mjs).
// It fights from the boss-drain template every dungeon boss of that kind uses, so it is exactly as hard to hit and
// to survive as one; its mechanics (heartFinalBoss) are what make it a fight of its own.
func heartMonsterContent() ([]AbilityDefinition, []MonsterDefinition) {
	moves, ids := roleMoves(HeartMonsterID, "boss-drain", "Arterial lash", "Heartquake", 0)
	// The heartshard is the mid-campaign heart (campaigns.go): a torn-off piece of the real one, smaller and weaker.
	shardMoves, shardIDs := roleMoves(LesserHeartMonsterID, "boss-drain", "Arterial lash", "Heartquake", -1)
	return append(moves, shardMoves...), []MonsterDefinition{
		defineMonster(art.BeastHeartOfTheBeast, MonsterDefinition{
			ID: HeartMonsterID, Name: "The Heart of the Beast", Role: MonsterRoleBoss, BehaviorID: HeartMonsterID, BaseHealth: 30, HealthPerDepth: 4, AbilityIDs: ids,
		}),
		defineMonster(art.BeastHeartOfTheBeast, MonsterDefinition{
			ID: LesserHeartMonsterID, Name: "The Heartshard", Role: MonsterRoleBoss, BehaviorID: HeartMonsterID, BaseHealth: 24, HealthPerDepth: 3, AbilityIDs: shardIDs,
		}),
	}
}

func heartEncounters() []EncounterDefinition {
	return []EncounterDefinition{
		{ID: HeartEncounterID, ThemeID: HeartThemeID, Budget: 8, Enemies: []EncounterMonsterDefinition{{ID: "boss", MonsterID: HeartMonsterID, BudgetCost: 8}}},
		{ID: LesserHeartEncounterID, ThemeID: HeartThemeID, Budget: 8, Enemies: []EncounterMonsterDefinition{{ID: "boss", MonsterID: LesserHeartMonsterID, BudgetCost: 8}}},
	}
}

// heartFinalBoss is the heart as a dungeon boss: it scars over (a barrier against basic attacks) and, at low health,
// beats so hard the whole party is struck (cataclysm). Every dungeon boss also enrages.
var heartFinalBoss = FinalBossTemplate{
	FloorBossTemplate: FloorBossTemplate{
		RoomName:    "The Heart of the Beast",
		Description: "The floor gives way to a cavern of wet red stone. Something vast is beating in the dark, and every land the party has crossed beats with it.",
		EncounterID: HeartEncounterID,
	},
	Mechanics:      []string{BossMechanicBarrier, BossMechanicCataclysm},
	BarrierLabel:   "Scar tissue",
	CataclysmLabel: "The great beat",
}

// heartCastleBoss is the heart in place of a castle's boss. Castle bosses carry a second capstone mechanic
// (ADR 0033), so here the heart also rises once more after it first falls ("A second heartbeat").
var heartCastleBoss = func() FinalBossTemplate {
	boss := heartFinalBoss
	boss.Mechanics = append(append([]string(nil), heartFinalBoss.Mechanics...), BossMechanicRebirth)
	boss.RebirthLabel = "A second heartbeat"
	return boss
}()

// summonHeart decides whether the dungeon boss the party is about to meet is the heart. A Beast Lure always summons
// it (and is spent); otherwise each dungeon has a fixed, seeded one-in-HeartChanceDenominator chance.
func summonHeart(run *Run) bool {
	if run.CampaignID != "" {
		// A campaign's hearts are part of its story (campaigns.go): they never turn up by chance.
		return false
	}
	if run.HeartLured {
		run.HeartLured = false
		return true
	}
	return mixSeed(run.Seed, uint64(dungeonNumber(run)), 0xbea57)%HeartChanceDenominator == 0
}

// HeartStrike is what one party did to the heart in one fight: the damage each player dealt (HeartPartyKey for
// damage no one player dealt) and whether they drove it off.
type HeartStrike struct {
	EncounterID string           `json:"encounterId"`
	ThemeID     string           `json:"themeId,omitempty"`
	Dungeon     int              `json:"dungeon,omitempty"`
	ByPlayer    map[string]int64 `json:"byPlayer"`
	DrivenOff   bool             `json:"drivenOff,omitempty"`
}

// Damage is the strike's total.
func (strike HeartStrike) Damage() int64 {
	var total int64
	for _, amount := range strike.ByPlayer {
		total += amount
	}
	return total
}

// PlayerIDs are the players who dealt damage in the strike, sorted.
func (strike HeartStrike) PlayerIDs() []string {
	ids := make([]string, 0, len(strike.ByPlayer))
	for id, amount := range strike.ByPlayer {
		if id != HeartPartyKey && amount > 0 {
			ids = append(ids, id)
		}
	}
	sort.Strings(ids)
	return ids
}

// heartIndex is the index of the heart in an encounter, or -1.
func heartIndex(encounter *Encounter) int {
	if encounter == nil {
		return -1
	}
	for i := range encounter.Enemies {
		// The heartshard is a piece of the same heart: its wounds count toward the shared pool too.
		if id := encounter.Enemies[i].DefinitionID; id == HeartMonsterID || id == LesserHeartMonsterID {
			return i
		}
	}
	return -1
}

// heartTally follows the heart's health through a round and credits each fall in health to whoever caused it.
type heartTally struct {
	run     *Run
	room    *DungeonRoom
	index   int
	round   int
	checked int
}

func newHeartTally(run *Run, room *DungeonRoom, round int) heartTally {
	tally := heartTally{run: run, room: room, index: heartIndex(room.Encounter), round: round}
	tally.checked = tally.health()
	return tally
}

func (t *heartTally) health() int {
	if t.index < 0 {
		return 0
	}
	return t.room.Encounter.Enemies[t.index].Health
}

// credit gives the heart's health lost since the last check to playerID. Healing is not a credit and not a debt.
func (t *heartTally) credit(playerID string) {
	if t.index < 0 {
		return
	}
	now := t.health()
	if lost := t.checked - now; lost > 0 {
		t.strike().ByPlayer[playerID] += int64(lost)
	}
	t.checked = now
}

// won records that the party drove the heart off: the fight is over and the heart is gone (after any rebirth).
func (t *heartTally) won() {
	if t.index < 0 {
		return
	}
	if strike := t.strike(); !strike.DrivenOff {
		strike.DrivenOff = true
		addCombatEvent(t.run, t.round, "heart_driven_off", "The Heart of the Beast tears free and sinks into the dark. Every wound the party dealt it stays.")
	}
}

func (t *heartTally) strike() *HeartStrike {
	for i := range t.run.HeartStrikes {
		if t.run.HeartStrikes[i].EncounterID == t.room.ID {
			return &t.run.HeartStrikes[i]
		}
	}
	t.run.HeartStrikes = append(t.run.HeartStrikes, HeartStrike{EncounterID: t.room.ID, ThemeID: t.room.ThemeID, Dungeon: dungeonNumber(t.run), ByPlayer: map[string]int64{}})
	return &t.run.HeartStrikes[len(t.run.HeartStrikes)-1]
}

// beastLure is the shop item that makes the next dungeon boss the heart. It is always on the shelf until bought.
var beastLure = ShopItem{ID: "beast-lure", Name: "Beast Lure", Kind: ShopHeartLure, Price: HeartLurePrice,
	Description: "A bleeding lure the Beast cannot ignore. The next dungeon boss will be the Heart of the Beast itself."}
