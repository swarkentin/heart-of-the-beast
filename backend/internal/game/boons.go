package game

import (
	"fmt"
	"math/rand"
	"sort"
	"time"
)

// Boons are the reward for beating a boss in a capstone castle. Each adventurer is offered BoonOfferCount boons
// they do not already have and keeps one for the rest of the run. A boon is not a bigger number: each one changes
// how its owner plays a fight, which is why they are worth a castle.
//
// The choice is a camp stage ("boon"). After a castle's midpoint or final boss it opens the camp; after any other
// castle boss the camp holds only the boon choice and then leads straight down.

const (
	CampStageBoon = "boon"
	// CampBoonWindow is how long a party has to choose its boons.
	CampBoonWindow = 30 * time.Second
	// BoonOfferCount is how many boons each adventurer is offered.
	BoonOfferCount = 3
)

const (
	BoonVampiricEdge  = "vampiric-edge"
	BoonUndyingOath   = "undying-oath"
	BoonExecutioner   = "executioner"
	BoonHellfireHide  = "hellfire-hide"
	BoonStoneHeart    = "stone-heart"
	BoonPactOfRuin    = "pact-of-ruin"
	BoonQuickMind     = "quickened-mind"
	BoonVoidVeil      = "void-veil"
	BoonSecondBreath  = "second-breath"
	BoonOpeningGambit = "opening-gambit"

	// Numbers the boons use.
	BoonVampiricPercent     = 25
	BoonExecutionerPercent  = 50
	BoonHellfireHideDamage  = 3
	BoonStoneHeartHealth    = 15
	BoonStoneHeartGuard     = 2
	BoonPactDamage          = 3
	BoonPactPenalty         = 1
	BoonVoidVeilWard        = 8
	BoonSecondBreathPercent = 15
	BoonOpeningGambitDamage = 5
)

// Boon is one boon as offered and owned.
type Boon struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	// Repeatable boons can be taken again; their effect stacks.
	Repeatable bool `json:"repeatable,omitempty"`
}

var boonCatalog = []Boon{
	{ID: BoonVampiricEdge, Name: "Vampiric Edge", Description: fmt.Sprintf("Your damaging skills heal you for %d%% of the damage they deal.", BoonVampiricPercent)},
	{ID: BoonUndyingOath, Name: "Undying Oath", Description: "Once per fight, a blow that would down you leaves you standing at 1 health."},
	{ID: BoonExecutioner, Name: "Executioner", Description: fmt.Sprintf("Your hits deal %d%% more damage to enemies below a third of their health.", BoonExecutionerPercent)},
	{ID: BoonHellfireHide, Name: "Hellfire Hide", Description: fmt.Sprintf("Every enemy that hits you takes %d damage.", BoonHellfireHideDamage)},
	{ID: BoonStoneHeart, Name: "Stone Heart", Description: fmt.Sprintf("+%d maximum health now, and Defend blocks %d more for the rest of the run.", BoonStoneHeartHealth, BoonStoneHeartGuard), Repeatable: true},
	{ID: BoonPactOfRuin, Name: "Pact of Ruin", Description: fmt.Sprintf("Your damaging skills deal %d more damage, but every hit you take deals %d more.", BoonPactDamage, BoonPactPenalty)},
	{ID: BoonQuickMind, Name: "Quickened Mind", Description: "Your skills come off cooldown a round sooner."},
	{ID: BoonVoidVeil, Name: "Void Veil", Description: fmt.Sprintf("You start every fight behind a ward that absorbs %d damage.", BoonVoidVeilWard)},
	{ID: BoonSecondBreath, Name: "Second Breath", Description: fmt.Sprintf("Recover an extra %d%% of your maximum health after every fight you win.", BoonSecondBreathPercent)},
	{ID: BoonOpeningGambit, Name: "Opening Gambit", Description: fmt.Sprintf("In the first round of every fight your damaging skills deal %d more.", BoonOpeningGambitDamage)},
}

// BoonCatalog returns every boon.
func BoonCatalog() []Boon { return append([]Boon(nil), boonCatalog...) }

func findBoon(id string) (Boon, bool) {
	for _, boon := range boonCatalog {
		if boon.ID == id {
			return boon, true
		}
	}
	return Boon{}, false
}

func validateBoonCatalog() error {
	seen := make(map[string]bool, len(boonCatalog))
	repeatable := false
	for _, boon := range boonCatalog {
		if boon.ID == "" || seen[boon.ID] || boon.Name == "" || boon.Description == "" {
			return fmt.Errorf("invalid or duplicate boon %q", boon.ID)
		}
		seen[boon.ID] = true
		repeatable = repeatable || boon.Repeatable
	}
	if !repeatable || len(boonCatalog) < BoonOfferCount {
		// A repeatable boon keeps the offer from ever running dry on a long expedition.
		return fmt.Errorf("the boon catalog needs at least %d boons and one repeatable boon", BoonOfferCount)
	}
	return nil
}

// hasBoon reports whether a player owns a boon.
func hasBoon(player *PlayerState, id string) bool {
	return player != nil && contains(player.Boons, id)
}

// boonCount is how many times a player has taken a boon.
func boonCount(player *PlayerState, id string) int {
	count := 0
	if player != nil {
		for _, owned := range player.Boons {
			if owned == id {
				count++
			}
		}
	}
	return count
}

// rollBoonOffers draws each eligible adventurer's offer for the boss just beaten: boons they do not own (or
// repeatable ones), shuffled from the run seed, the dungeon, the floor and the adventurer's seat.
func rollBoonOffers(room *Room) map[string][]Boon {
	run := room.Run
	offers := make(map[string][]Boon)
	players := eligibleCombatPlayers(room)
	for seat, playerID := range players {
		player := run.Players[playerID]
		var pool []Boon
		for _, boon := range boonCatalog {
			if boon.Repeatable || !hasBoon(player, boon.ID) {
				pool = append(pool, boon)
			}
		}
		rng := rand.New(rand.NewSource(int64(mixSeed(dungeonSeed(run.Seed, dungeonNumber(run)), uint64(run.Depth*8+seat), 0xb0011))))
		rng.Shuffle(len(pool), func(i, j int) { pool[i], pool[j] = pool[j], pool[i] })
		if len(pool) > BoonOfferCount {
			pool = pool[:BoonOfferCount]
		}
		offers[playerID] = pool
	}
	return offers
}

// startBoonStage begins the boon choice at a camp.
func startBoonStage(room *Room, now time.Time) {
	camp := room.Run.Camp
	camp.Stage = CampStageBoon
	camp.BoonOffers = rollBoonOffers(room)
	camp.BoonChoices = make(map[string]string)
	addCombatEvent(room.Run, 0, "boon_offered", "The castle's power is loose in the air. Every adventurer may claim one boon.")
	setCampDeadline(room, CampBoonWindow, now)
}

// openBoonCamp ends a castle floor that has no camp: the party catches its breath, chooses boons, and goes on
// down without the mini-game or the shop.
func openBoonCamp(room *Room, round int, now time.Time) {
	run := room.Run
	run.Phase = PhaseIntermission
	run.NavigationVote = nil
	run.CombatRound = nil
	addCombatEvent(run, round, "floor_cleared", fmt.Sprintf("Floor %d of %d is cleared. The way down is open.", run.Depth, run.MaxDepth))
	next := nextFloorModifiers(run, run.Depth+1)
	run.FloorModifiers = nil
	run.Camp = &Camp{
		StartedAt: now.UTC(), NextDepth: run.Depth + 1, NextMaxDepth: run.MaxDepth, NextModifiers: next, BoonOnly: true,
		Purchases: make(map[string][]string), Ready: make(map[string]bool),
	}
	startBoonStage(room, now)
}

// chooseBoon records an adventurer's boon and applies it.
func chooseBoon(room *Room, playerID, boonID string) error {
	camp := room.Run.Camp
	if camp.BoonChoices[playerID] != "" {
		return ErrInvalidCampAction
	}
	for _, offer := range camp.BoonOffers[playerID] {
		if offer.ID == boonID {
			camp.BoonChoices[playerID] = boonID
			grantBoon(room, playerID, offer)
			return nil
		}
	}
	return ErrInvalidCampAction
}

func grantBoon(room *Room, playerID string, boon Boon) {
	player := room.Run.Players[playerID]
	player.Boons = append(player.Boons, boon.ID)
	if boon.ID == BoonStoneHeart {
		player.MaxHealth += BoonStoneHeartHealth
		player.Health += BoonStoneHeartHealth
		player.GuardReduction += BoonStoneHeartGuard
	}
	addCombatEvent(room.Run, 0, "boon_chosen", adventurerLabel(room, playerID)+" claims "+boon.Name+".")
}

// settleBoons gives every adventurer who has not chosen the first boon of their offer, so a timed-out stage
// never costs anyone their reward.
func settleBoons(room *Room, eligible []string) {
	camp := room.Run.Camp
	sort.Strings(eligible)
	for _, playerID := range eligible {
		if camp.BoonChoices[playerID] == "" && len(camp.BoonOffers[playerID]) > 0 {
			offer := camp.BoonOffers[playerID][0]
			camp.BoonChoices[playerID] = offer.ID
			grantBoon(room, playerID, offer)
		}
	}
}

// ---- boon effects ------------------------------------------------------------------------------------------------

// boonStrikeBonus is the flat damage a player's boons add to one damaging effect against an enemy.
func boonStrikeBonus(player *PlayerState, encounter *Encounter) int {
	bonus := BoonPactDamage * boonCount(player, BoonPactOfRuin)
	if hasBoon(player, BoonOpeningGambit) && fightOpening(encounter) {
		bonus += BoonOpeningGambitDamage
	}
	return bonus
}

// boonDamageMultiplier applies Executioner to the damage of one hit.
func boonDamageMultiplier(player *PlayerState, enemy *Enemy, damage int) int {
	if hasBoon(player, BoonExecutioner) && enemy != nil && enemy.Health*3 < enemy.MaxHealth {
		damage += damage * BoonExecutionerPercent / 100
	}
	return damage
}

// boonAfterSkill applies Vampiric Edge once a skill has dealt its damage.
func boonAfterSkill(cast *skillCast) {
	if cast.dealt <= 0 || !hasBoon(cast.player, BoonVampiricEdge) || cast.player.Health <= 0 {
		return
	}
	heal := cast.dealt * BoonVampiricPercent / 100
	if heal < 1 {
		heal = 1
	}
	transition := resolveHealthHealing(cast.player.Health, cast.player.MaxHealth, heal)
	cast.player.Health = transition.Health
	if transition.Applied > 0 {
		addCombatImpact(cast.run, cast.round, "boon_lifesteal", adventurerLabel(cast.room, cast.player.ID)+"'s Vampiric Edge drinks "+itoa(transition.Applied)+" health.", "heal", cast.player.ID, "player", transition.Applied)
	}
}

// boonIncomingDamage applies Pact of Ruin and Undying Oath to a hit that has already been mitigated.
func boonIncomingDamage(room *Room, player *PlayerState, damage, round int) int {
	if damage > 0 {
		damage += BoonPactPenalty * boonCount(player, BoonPactOfRuin)
	}
	if damage >= player.Health && hasBoon(player, BoonUndyingOath) && !player.ClassCombat.OathSpent {
		player.ClassCombat.OathSpent = true
		damage = player.Health - 1
		addCombatEvent(room.Run, round, "boon_oath", adventurerLabel(room, player.ID)+"'s Undying Oath holds: they stay standing!")
	}
	return damage
}

// boonReflect is the damage Hellfire Hide deals back to an enemy that hits its owner.
func boonReflect(player *PlayerState) int {
	if hasBoon(player, BoonHellfireHide) {
		return BoonHellfireHideDamage
	}
	return 0
}

// boonCooldown shortens a skill's cooldown for Quickened Mind. A skill is never ready again in the same round.
func boonCooldown(player *PlayerState, rounds int) int {
	if hasBoon(player, BoonQuickMind) && rounds > 2 {
		return rounds - 1
	}
	return rounds
}

// boonFightRecovery is Second Breath's extra recovery after a fight is won.
func boonFightRecovery(player *PlayerState) int {
	if hasBoon(player, BoonSecondBreath) {
		return player.MaxHealth * BoonSecondBreathPercent / 100
	}
	return 0
}

// applyBoonFightOpening runs on the first round of every fight: Void Veil raises its ward.
func applyBoonFightOpening(room *Room, round int) {
	for _, playerID := range eligibleCombatPlayers(room) {
		player := room.Run.Players[playerID]
		if hasBoon(player, BoonVoidVeil) && player.ClassCombat.Ward < BoonVoidVeilWard {
			player.ClassCombat.Ward = BoonVoidVeilWard
			addCombatImpact(room.Run, round, "boon_ward", adventurerLabel(room, playerID)+"'s Void Veil wraps them in a ward of "+itoa(BoonVoidVeilWard)+".", "", playerID, "player", 0)
		}
	}
}

// fightOpening reports whether a round is the first of its fight: no living enemy has acted yet.
func fightOpening(encounter *Encounter) bool {
	if encounter == nil {
		return false
	}
	opening := false
	for _, enemy := range encounter.Enemies {
		if enemy.Health <= 0 || enemy.Summoned {
			continue
		}
		if enemy.TurnsTaken > 1 {
			return false
		}
		opening = true
	}
	return opening
}
