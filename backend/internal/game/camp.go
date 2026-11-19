package game

import (
	"errors"
	"fmt"
	"math/rand"
	"sort"
	"strings"
	"time"
)

// The camp is the respite between two floors of an expedition. It has two stages:
//
//	game        every adventurer plays the same short mini-game for gold, each at their own pace;
//	crossroads  after a dungeon boss only: the party votes between two dungeons, each with its own modifiers;
//	shop        every adventurer spends their own gold, sees what the next floor holds, and readies up.
//
// The party camps twice per dungeon: halfway down, and after its boss. Other floors lead straight on.
//
// A party of one moves on when it is ready. A larger party is time-boxed, so nobody can stall the run: when a
// stage's deadline passes, unfinished mini-games are settled and the party moves on.

const (
	CampStageGame       = "game"
	CampStageCrossroads = "crossroads"
	CampStageShop       = "shop"

	CampGameWindow = 45 * time.Second
	CampShopWindow = 60 * time.Second
	// CampCrossroadsWindow is how long a party has to vote for its next dungeon.
	CampCrossroadsWindow = 30 * time.Second
	// CampRestPercent is the share of maximum health every living adventurer recovers on reaching camp.
	CampRestPercent = 20
)

var (
	ErrInvalidCampAction = errors.New("that is not possible at camp right now")
	ErrNotEnoughGold     = errors.New("not enough gold")
	ErrItemUnavailable   = errors.New("that item is not for sale")
)

type Camp struct {
	Stage     string    `json:"stage"`
	StartedAt time.Time `json:"startedAt"`
	// Deadline is when the current stage ends on its own. It is absent for a party of one.
	Deadline *time.Time `json:"deadline,omitempty"`
	Game     *Minigame  `json:"game,omitempty"`
	Offers   []ShopItem `json:"offers,omitempty"`
	// Purchases lists what each player has bought at this camp.
	Purchases map[string][]string `json:"purchases,omitempty"`
	Ready     map[string]bool     `json:"ready,omitempty"`
	// NextDepth and NextModifiers describe the floor the party is about to enter.
	NextDepth     int                   `json:"nextDepth"`
	NextMaxDepth  int                   `json:"nextMaxDepth"`
	NextModifiers []ActiveFloorModifier `json:"nextModifiers,omitempty"`
	// Between dungeons: the two dungeons on offer, the votes cast, and, once decided, the winner.
	Choices              []DungeonChoice       `json:"choices,omitempty"`
	Votes                map[string]string     `json:"votes,omitempty"`
	NextThemeID          string                `json:"nextThemeId,omitempty"`
	NextDungeonModifiers []ActiveFloorModifier `json:"nextDungeonModifiers,omitempty"`
	// After a capstone boss: each adventurer's boon offer and choice (boons.go). BoonOnly marks a camp that is
	// only the boon choice, after a castle floor that does not camp.
	BoonOffers  map[string][]Boon `json:"boonOffers,omitempty"`
	BoonChoices map[string]string `json:"boonChoices,omitempty"`
	BoonOnly    bool              `json:"boonOnly,omitempty"`
}

// ensureMaps restores the per-player maps. They are saved with omitempty, so a camp reloaded before anyone bought,
// readied or voted comes back with nil maps, and writing to one would panic.
func (camp *Camp) ensureMaps() {
	if camp.Purchases == nil {
		camp.Purchases = make(map[string][]string)
	}
	if camp.Ready == nil {
		camp.Ready = make(map[string]bool)
	}
	if camp.Votes == nil {
		camp.Votes = make(map[string]string)
	}
	if camp.BoonChoices == nil {
		camp.BoonChoices = make(map[string]string)
	}
}

// openCamp ends a floor: the party rests, learns what the next floor holds, and starts the camp mini-game.
func openCamp(room *Room, round int, now time.Time) {
	run := room.Run
	run.Phase = PhaseIntermission
	run.NavigationVote = nil
	run.CombatRound = nil
	between := run.Depth >= run.MaxDepth
	if between {
		for _, player := range run.Players {
			if player != nil {
				player.Consumables = map[string]int{ConsumableHealingHerb: StartingHealingHerbs}
			}
		}
	}
	if !between {
		addCombatEvent(run, round, "floor_cleared", fmt.Sprintf("Floor %d of %d is cleared. Halfway down, the party makes camp.", run.Depth, run.MaxDepth))
	}
	for _, playerID := range eligibleCombatPlayers(room) {
		player := run.Players[playerID]
		rest := floorRulesFor(run).healing((player.MaxHealth*CampRestPercent + 99) / 100)
		transition := resolveHealthHealing(player.Health, player.MaxHealth, rest)
		player.Health = transition.Health
		if transition.Applied > 0 {
			addCombatImpact(run, round, "floor_restoration", adventurerLabel(room, playerID)+" recovers "+itoa(transition.Applied)+" health resting at camp.", "heal", playerID, "player", transition.Applied)
		}
	}
	// The camp is outside the floor: its modifiers no longer apply, and the next floor's are already known.
	run.FloorModifiers = nil
	camp := &Camp{
		Stage: CampStageGame, StartedAt: now.UTC(), NextDepth: run.Depth + 1, NextMaxDepth: run.MaxDepth,
		Purchases: make(map[string][]string), Ready: make(map[string]bool),
	}
	if between {
		// The next floor is the first of whichever dungeon the party votes for at the crossroads.
		camp.NextDepth = 1
		camp.Choices = rollDungeonChoices(run.Seed, run.Theme(), dungeonNumber(run)+1)
		camp.NextMaxDepth = camp.Choices[0].Floors
		camp.Votes = make(map[string]string)
	} else {
		camp.NextModifiers = nextFloorModifiers(run, run.Depth+1)
	}
	camp.Game = newMinigame(dungeonSeed(run.Seed, dungeonNumber(run)), run.Depth+dungeonExtraDepth(run), eligibleCombatPlayers(room))
	run.Camp = camp
	if IsCapstoneTheme(run.Theme()) {
		// A castle boss was just beaten: boons come before the camp's game.
		startBoonStage(room, now)
		return
	}
	setCampDeadline(room, CampGameWindow, now)
}

func setCampDeadline(room *Room, window time.Duration, now time.Time) {
	camp := room.Run.Camp
	camp.StartedAt = now.UTC()
	camp.Deadline = nil
	if len(eligibleCombatPlayers(room)) > 1 {
		deadline := now.UTC().Add(window)
		camp.Deadline = &deadline
	}
}

// AdvanceCamp moves the camp on when its stage is finished or its deadline has passed. It is safe to call from
// snapshot polling.
func AdvanceCamp(room *Room, now time.Time) bool {
	run := room.Run
	if run == nil || run.Phase != PhaseIntermission || run.Camp == nil {
		return false
	}
	camp := run.Camp
	eligible := eligibleCombatPlayers(room)
	if len(eligible) == 0 {
		return false
	}
	expired := camp.Deadline != nil && !now.Before(*camp.Deadline)
	switch camp.Stage {
	case CampStageBoon:
		chosen := true
		for _, playerID := range eligible {
			chosen = chosen && (camp.BoonChoices[playerID] != "" || len(camp.BoonOffers[playerID]) == 0)
		}
		if !chosen && !expired {
			return false
		}
		settleBoons(room, eligible)
		if camp.BoonOnly {
			descendExpedition(room, now)
			return true
		}
		camp.Stage = CampStageGame
		setCampDeadline(room, CampGameWindow, now)
		return true
	case CampStageGame:
		finished := true
		for _, playerID := range eligible {
			if play := camp.Game.Players[playerID]; play != nil && !play.Done {
				finished = false
			}
		}
		if !finished && !expired {
			return false
		}
		for _, playerID := range eligible {
			if play := camp.Game.Players[playerID]; play != nil && !play.Done {
				settleMinigame(room, playerID, play, "Time ran out.")
			}
		}
		if len(camp.Choices) > 0 {
			camp.Stage = CampStageCrossroads
			setCampDeadline(room, CampCrossroadsWindow, now)
			return true
		}
		openShop(room, now)
		return true
	case CampStageCrossroads:
		cast := 0
		for _, playerID := range eligible {
			if camp.Votes[playerID] != "" {
				cast++
			}
		}
		if cast < len(eligible) && !expired {
			return false
		}
		chooseDungeon(room, eligible)
		openShop(room, now)
		return true
	case CampStageShop:
		ready := true
		for _, playerID := range eligible {
			ready = ready && camp.Ready[playerID]
		}
		if !ready && !expired {
			return false
		}
		descendExpedition(room, now)
		return true
	}
	return false
}

// chooseDungeon settles the crossroads vote: the dungeon with the most votes wins, the run seed breaks a tie, and
// if nobody voted the seed chooses.
func chooseDungeon(room *Room, eligible []string) {
	run := room.Run
	camp := run.Camp
	tally := make(map[string]int, len(camp.Choices))
	for _, playerID := range eligible {
		tally[camp.Votes[playerID]]++
	}
	order := []int{0, 1}
	if mixSeed(run.Seed, uint64(dungeonNumber(run)), 0x71e)%2 == 1 {
		order = []int{1, 0}
	}
	winner := camp.Choices[order[0]]
	if tally[camp.Choices[order[1]].ThemeID] > tally[winner.ThemeID] {
		winner = camp.Choices[order[1]]
	}
	camp.NextThemeID = winner.ThemeID
	camp.NextDungeonModifiers = winner.Modifiers
	camp.NextModifiers = append([]ActiveFloorModifier(nil), winner.Modifiers...)
	camp.NextMaxDepth = winner.Floors
	addCombatEvent(run, 0, "dungeon_chosen", "The party chooses "+winner.Name+".")
}

// applyCampCommand handles the camp commands: "choose_boon", "minigame", "choose_dungeon", "buy", "ready" and
// "set_loadout".
func applyCampCommand(room *Room, actorID string, command Command, now time.Time) error {
	run := room.Run
	if run == nil || run.Phase != PhaseIntermission || run.Camp == nil {
		return ErrInvalidPhase
	}
	player := run.Players[actorID]
	if player == nil {
		return ErrNotPlayer
	}
	if player.Health <= 0 || room.Presence[actorID].LeftAt != nil {
		return ErrInvalidPhase
	}
	run.Camp.ensureMaps()
	// A command that arrives after the deadline finds the camp already moved on.
	if AdvanceCamp(room, now) && (run.Phase != PhaseIntermission || run.Camp == nil) {
		return ErrInvalidPhase
	}
	camp := run.Camp
	switch command.Type {
	case "minigame":
		if camp.Stage != CampStageGame {
			return ErrInvalidCampAction
		}
		play := camp.Game.Players[actorID]
		if play == nil || play.Done {
			return ErrInvalidCampAction
		}
		if err := playMinigame(room, actorID, play, command); err != nil {
			return err
		}
	case "choose_boon":
		if camp.Stage != CampStageBoon {
			return ErrInvalidCampAction
		}
		if err := chooseBoon(room, actorID, command.ChoiceID); err != nil {
			return err
		}
	case "choose_dungeon":
		if camp.Stage != CampStageCrossroads {
			return ErrInvalidCampAction
		}
		offered := false
		for _, choice := range camp.Choices {
			offered = offered || choice.ThemeID == command.ChoiceID
		}
		if !offered {
			return ErrInvalidCampAction
		}
		camp.Votes[actorID] = command.ChoiceID
	case "buy":
		if camp.Stage != CampStageShop {
			return ErrInvalidCampAction
		}
		if err := buyShopItem(room, actorID, command.ChoiceID); err != nil {
			return err
		}
	case "ready":
		if camp.Stage != CampStageShop {
			return ErrInvalidCampAction
		}
		camp.Ready[actorID] = true
	case "set_loadout":
		// Between two dungeons, and only there, an adventurer can change their skills for the next one.
		if err := changeRunLoadout(room, actorID, command.SkillIDs); err != nil {
			return err
		}
	default:
		return ErrInvalidAction
	}
	AdvanceCamp(room, now)
	return nil
}

// ---- Mini-games -----------------------------------------------------------------------------------------------

const (
	MinigameDice   = "dice"
	MinigameChests = "chests"
	MinigameEcho   = "echo"

	MinigameConsolationGold = 3
	DiceMaxRolls            = 5
	ChestCount              = 4
)

// EchoRunes are the symbols of the Rune Echo sequence.
var EchoRunes = []string{"sun", "moon", "star", "wave"}

// Minigame is one camp's game. Every adventurer plays their own copy.
type Minigame struct {
	Kind  string `json:"kind"`
	Name  string `json:"name"`
	Rules string `json:"rules"`
	// Seed and Depth key the game's hidden draws. They are not secrets: the run seed is already public.
	Seed    uint64                   `json:"seed"`
	Depth   int                      `json:"depth"`
	Players map[string]*MinigamePlay `json:"players"`
}

// MinigamePlay is one adventurer's progress. Pot is gold at risk; Gold is what was finally won.
type MinigamePlay struct {
	// Index is the player's position in the party when the game was dealt; it keys their draws.
	Index int  `json:"index"`
	Done  bool `json:"done"`
	Gold  int  `json:"gold"`
	Pot   int  `json:"pot"`
	// Rolls are the dice thrown so far (Bone Dice).
	Rolls []int `json:"rolls,omitempty"`
	// Chests holds what each opened chest held: gold, or 0 for the mimic; -1 is a chest still shut (Mimic's Row).
	Chests []int `json:"chests,omitempty"`
	// Sequence is the pattern to repeat, and Answer what the player entered (Rune Echo).
	Sequence []string `json:"sequence,omitempty"`
	Answer   []string `json:"answer,omitempty"`
	Result   string   `json:"result,omitempty"`
}

var minigameKinds = []Minigame{
	{Kind: MinigameDice, Name: "Bone Dice", Rules: "Roll to grow the pot: every 2 to 6 adds twice its pips in gold. Roll a 1 and the pot is lost. Bank whenever you like; five rolls at most."},
	{Kind: MinigameChests, Name: "Mimic's Row", Rules: "Four chests: three hold gold, one is a mimic. Open as many as you dare, then walk away with the pot. Open the mimic and the pot is lost."},
	{Kind: MinigameEcho, Name: "Rune Echo", Rules: "The stones light up in order. Repeat the pattern from memory: gold for every rune right from the start, and a bonus for the whole pattern."},
}

func newMinigame(seed uint64, depth int, playerIDs []string) *Minigame {
	game := minigameKinds[mixSeed(seed, uint64(depth), 0x9a3e)%uint64(len(minigameKinds))]
	game.Seed, game.Depth = seed, depth
	game.Players = make(map[string]*MinigamePlay, len(playerIDs))
	for index, playerID := range playerIDs {
		play := &MinigamePlay{Index: index}
		switch game.Kind {
		case MinigameChests:
			play.Chests = []int{-1, -1, -1, -1}
		case MinigameEcho:
			rng := game.rng(index, 0)
			length := 4 + depth/2
			if length > 7 {
				length = 7
			}
			for i := 0; i < length; i++ {
				play.Sequence = append(play.Sequence, EchoRunes[rng.Intn(len(EchoRunes))])
			}
		}
		game.Players[playerID] = play
	}
	return &game
}

func (game *Minigame) rng(playerIndex, step int) *rand.Rand {
	return rand.New(rand.NewSource(int64(mixSeed(game.Seed, uint64(game.Depth)<<16|uint64(playerIndex)<<8|uint64(step), 0x6a3e))))
}

// stake gives mini-games a modest depth bonus without letting their payouts inflate in lockstep with
// permanent upgrades. The bonus tops out after the early expedition.
func (game *Minigame) stake(gold int) int {
	depthBonus := game.Depth - 1
	if depthBonus < 0 {
		depthBonus = 0
	}
	if depthBonus > 8 {
		depthBonus = 8
	}
	return gold * (100 + 8*depthBonus) / 100
}

// chestContents is what the four chests of one player hold: three purses and a mimic (0), in a seeded order.
func (game *Minigame) chestContents(playerIndex int) []int {
	contents := []int{0, game.stake(6), game.stake(10), game.stake(16)}
	game.rng(playerIndex, 0).Shuffle(len(contents), func(i, j int) { contents[i], contents[j] = contents[j], contents[i] })
	return contents
}

func playMinigame(room *Room, playerID string, play *MinigamePlay, command Command) error {
	game := room.Run.Camp.Game
	switch {
	case command.Action == "bank" && game.Kind != MinigameEcho:
		play.Gold = play.Pot
		settleMinigame(room, playerID, play, "Banked.")
	case command.Action == "roll" && game.Kind == MinigameDice:
		roll := 1 + game.rng(play.Index, len(play.Rolls)+1).Intn(6)
		play.Rolls = append(play.Rolls, roll)
		if roll == 1 {
			play.Pot, play.Gold = 0, MinigameConsolationGold
			settleMinigame(room, playerID, play, "A one. The pot is lost.")
			return nil
		}
		play.Pot += game.stake(2 * roll)
		if len(play.Rolls) >= DiceMaxRolls {
			play.Gold = play.Pot
			settleMinigame(room, playerID, play, "Five rolls. The pot is yours.")
		}
	case command.Action == "open" && game.Kind == MinigameChests:
		index := -1
		if _, err := fmt.Sscanf(command.ChoiceID, "%d", &index); err != nil || index < 0 || index >= ChestCount || play.Chests[index] >= 0 {
			return ErrInvalidCampAction
		}
		found := game.chestContents(play.Index)[index]
		play.Chests[index] = found
		if found == 0 {
			play.Pot, play.Gold = 0, MinigameConsolationGold
			settleMinigame(room, playerID, play, "The mimic! The pot is lost.")
			return nil
		}
		play.Pot += found
		opened := 0
		for _, chest := range play.Chests {
			if chest > 0 {
				opened++
			}
		}
		if opened == ChestCount-1 {
			play.Gold = play.Pot
			settleMinigame(room, playerID, play, "Every purse found, and the mimic left hungry.")
		}
	case command.Action == "echo" && game.Kind == MinigameEcho:
		answer := strings.Split(command.ChoiceID, ",")
		if len(answer) != len(play.Sequence) {
			return ErrInvalidCampAction
		}
		correct := 0
		for correct < len(answer) && answer[correct] == play.Sequence[correct] {
			correct++
		}
		play.Answer = answer
		play.Gold = game.stake(3 * correct)
		result := fmt.Sprintf("%d of %d runes in order.", correct, len(play.Sequence))
		if correct == len(play.Sequence) {
			play.Gold += game.stake(8)
			result = "The whole pattern, perfectly."
		}
		settleMinigame(room, playerID, play, result)
	default:
		return ErrInvalidCampAction
	}
	return nil
}

// settleMinigame ends a player's game and pays out. A game cut short by the deadline pays its pot.
func settleMinigame(room *Room, playerID string, play *MinigamePlay, result string) {
	if play.Done {
		return
	}
	if play.Gold == 0 && play.Pot > 0 {
		play.Gold = play.Pot
	}
	play.Done, play.Pot, play.Result = true, 0, result
	if player := room.Run.Players[playerID]; player != nil && play.Gold > 0 {
		player.Gold += play.Gold
	}
	addCombatEvent(room.Run, 0, "gold", adventurerLabel(room, playerID)+" wins "+itoa(play.Gold)+" gold at "+room.Run.Camp.Game.Name+".")
}

// ---- Shop -------------------------------------------------------------------------------------------------------

type ShopItemKind string

const (
	ShopHeal       ShopItemKind = "heal"
	ShopFullHeal   ShopItemKind = "full_heal"
	ShopStrike     ShopItemKind = "strike"
	ShopGuard      ShopItemKind = "guard"
	ShopMaxHealth  ShopItemKind = "max_health"
	ShopWard       ShopItemKind = "ward"
	ShopRevive     ShopItemKind = "revive"
	ShopCleanse    ShopItemKind = "cleanse"
	ShopConsumable ShopItemKind = "consumable"
)

// ShopItem is something a camp sells. Items take effect when bought; nothing is carried into combat as an action.
type ShopItem struct {
	ID          string       `json:"id"`
	Name        string       `json:"name"`
	Description string       `json:"description"`
	Kind        ShopItemKind `json:"kind"`
	Amount      int          `json:"amount,omitempty"`
	Price       int          `json:"price"`
	// Repeatable items can be bought more than once at the same camp.
	Repeatable   bool   `json:"repeatable,omitempty"`
	ConsumableID string `json:"consumableId,omitempty"`
}

var shopCatalog = []ShopItem{
	{ID: "healing-draught", Name: "Healing Draught", Kind: ShopHeal, Amount: 12, Price: 12, Repeatable: true, Description: "Recover 12 health now."},
	{ID: "healing-herb", Name: "Healing Herb", Kind: ShopConsumable, ConsumableID: ConsumableHealingHerb, Amount: 1, Price: 8, Repeatable: true, Description: "Carry one herb. Use it any time to recover up to 30% of your maximum health."},
	{ID: "camp-feast", Name: "Camp Feast", Kind: ShopFullHeal, Price: 30, Description: "Recover all of your health now."},
	{ID: "whetstone", Name: "Whetstone", Kind: ShopStrike, Amount: 1, Price: 30, Description: "+1 Strike damage for the rest of the run (up to +4 from permanent upgrades)."},
	{ID: "bracers", Name: "Banded Bracers", Kind: ShopGuard, Amount: 1, Price: 24, Description: "Defend blocks 1 more damage for the rest of the run."},
	{ID: "heartstone", Name: "Heartstone", Kind: ShopMaxHealth, Amount: 5, Price: 26, Description: "+5 maximum health, and recover 5 health."},
	{ID: "ward-charm", Name: "Ward Charm", Kind: ShopWard, Amount: 8, Price: 14, Description: "A ward that absorbs the next 8 damage you would take."},
	{ID: "revival-draught", Name: "Revival Draught", Kind: ShopRevive, Price: 40, Description: "Bring one fallen ally back at half health."},
	{ID: "cleansing-salt", Name: "Cleansing Salt", Kind: ShopCleanse, Price: 34, Description: "Lift one debuff from the next floor, for the whole party."},
}

// ShopCatalog returns every item a camp can sell.
func ShopCatalog() []ShopItem { return append([]ShopItem(nil), shopCatalog...) }

func validateShopCatalog() error {
	seen := make(map[string]bool, len(shopCatalog))
	for _, item := range shopCatalog {
		if item.ID == "" || seen[item.ID] || item.Name == "" || item.Description == "" || item.Price <= 0 || item.Amount < 0 {
			return fmt.Errorf("invalid or duplicate shop item %q", item.ID)
		}
		seen[item.ID] = true
	}
	return nil
}

// ShopOfferCount is how many items a camp puts on sale, before situational items.
const ShopOfferCount = 4

// openShop starts the shop stage. A healing draught and a healing herb are always for sale; the rest of the
// shelf is seeded. A revival draught appears only while someone is down, and cleansing salt only when the next floor carries a debuff.
func openShop(room *Room, now time.Time) {
	run := room.Run
	camp := run.Camp
	camp.Stage = CampStageShop
	rng := rand.New(rand.NewSource(int64(mixSeed(dungeonSeed(run.Seed, dungeonNumber(run)), uint64(run.Depth), 0x5409))))
	var shelf []ShopItem
	for _, item := range shopCatalog[2:] {
		if item.Kind != ShopRevive && item.Kind != ShopCleanse {
			shelf = append(shelf, item)
		}
	}
	rng.Shuffle(len(shelf), func(i, j int) { shelf[i], shelf[j] = shelf[j], shelf[i] })
	offers := append([]ShopItem{shopCatalog[0], shopCatalog[1]}, shelf[:ShopOfferCount-2]...)
	for _, item := range shopCatalog {
		if (item.Kind == ShopRevive && fallenAlly(room, "") != "") || (item.Kind == ShopCleanse && firstDebuff(camp.NextModifiers) >= 0) {
			offers = append(offers, item)
		}
	}
	// Permanent boons become progressively more expensive. Whetstones use a quadratic curve because
	// permanent damage compounds across every later fight; linear pricing let gold income keep pace.
	depth := run.Depth + dungeonExtraDepth(run)
	for i := range offers {
		offers[i].Price = shopItemPriceAtDepth(offers[i], depth)
	}
	camp.Offers = offers
	setCampDeadline(room, CampShopWindow, now)
}

// shopItemPriceAtDepth keeps defensive boons on a gentle linear curve, but prices permanent Strike
// upgrades quadratically because their value compounds across every later encounter.
func shopItemPriceAtDepth(item ShopItem, depth int) int {
	steps := depth - 1
	if steps < 0 {
		steps = 0
	}
	// Keep the endless-run price representable even at extreme expedition depths.
	if steps > 1000 {
		steps = 1000
	}
	switch item.Kind {
	case ShopStrike:
		return item.Price + 8*steps + 4*steps*steps
	case ShopGuard, ShopMaxHealth:
		return item.Price + 3*steps
	default:
		return item.Price
	}
}

func firstDebuff(modifiers []ActiveFloorModifier) int {
	for index, modifier := range modifiers {
		if modifier.Kind == FloorModifierDebuff {
			return index
		}
	}
	return -1
}

// fallenAlly returns a downed party member other than the buyer who has not left, or "".
func fallenAlly(room *Room, buyerID string) string {
	ids := append([]string(nil), room.PlayerIDs...)
	sort.Strings(ids)
	for _, playerID := range ids {
		if player := room.Run.Players[playerID]; playerID != buyerID && player != nil && player.Health <= 0 && room.Presence[playerID].LeftAt == nil {
			return playerID
		}
	}
	return ""
}

func buyShopItem(room *Room, buyerID, itemID string) error {
	run := room.Run
	camp := run.Camp
	buyer := run.Players[buyerID]
	var item *ShopItem
	for i := range camp.Offers {
		if camp.Offers[i].ID == itemID {
			item = &camp.Offers[i]
		}
	}
	if item == nil || (!item.Repeatable && contains(camp.Purchases[buyerID], itemID)) {
		return ErrItemUnavailable
	}
	if buyer.Gold < item.Price {
		return ErrNotEnoughGold
	}
	label := adventurerLabel(room, buyerID)
	message := label + " buys " + item.Name + "."
	switch item.Kind {
	case ShopConsumable:
		if buyer.Consumables == nil {
			buyer.Consumables = make(map[string]int)
		}
		if buyer.Consumables[item.ConsumableID] >= MaxHealingHerbs {
			return ErrItemUnavailable
		}
		buyer.Consumables[item.ConsumableID] += item.Amount
	case ShopHeal, ShopFullHeal:
		amount := item.Amount
		if item.Kind == ShopFullHeal {
			amount = buyer.MaxHealth
		}
		transition := resolveHealthHealing(buyer.Health, buyer.MaxHealth, amount)
		if transition.Applied == 0 {
			return ErrItemUnavailable
		}
		buyer.Health = transition.Health
		addCombatImpact(run, 0, "shop_heal", label+" recovers "+itoa(transition.Applied)+" health from a "+item.Name+".", "heal", buyerID, "player", transition.Applied)
		message = ""
	case ShopStrike:
		if buyer.StrikeDamage >= PlayerStrikeDamage+MaxPermanentStrikeBonus {
			return ErrItemUnavailable
		}
		applyPermanentStrikeBonus(buyer, item.Amount)
	case ShopGuard:
		buyer.GuardReduction += item.Amount
	case ShopMaxHealth:
		buyer.MaxHealth += item.Amount
		buyer.Health += item.Amount
	case ShopWard:
		if buyer.ClassCombat.Ward >= item.Amount {
			return ErrItemUnavailable
		}
		buyer.ClassCombat.Ward = item.Amount
	case ShopRevive:
		allyID := fallenAlly(room, buyerID)
		if allyID == "" {
			return ErrItemUnavailable
		}
		ally := run.Players[allyID]
		ally.Health = (ally.MaxHealth + 1) / 2
		message = label + " buys " + item.Name + ". " + adventurerLabel(room, allyID) + " is back on their feet!"
	case ShopCleanse:
		index := firstDebuff(camp.NextModifiers)
		if index < 0 {
			return ErrItemUnavailable
		}
		lifted := camp.NextModifiers[index]
		camp.NextModifiers = append(append([]ActiveFloorModifier(nil), camp.NextModifiers[:index]...), camp.NextModifiers[index+1:]...)
		message = label + " buys " + item.Name + ". " + lifted.Name + " is lifted from the next floor."
	default:
		return ErrItemUnavailable
	}
	buyer.Gold -= item.Price
	buyer.Items = append(buyer.Items, item.ID)
	camp.Purchases[buyerID] = append(camp.Purchases[buyerID], item.ID)
	if message != "" {
		addCombatEvent(run, 0, "shop", message)
	}
	return nil
}
