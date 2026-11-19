package game

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/swarkentin/heart-of-the-beast/backend/internal/art"
)

var expeditionNow = time.Date(2026, 11, 16, 12, 0, 0, 0, time.UTC)

func newPartyRoom(players int) *Room {
	room := &Room{ID: "room-1", Version: 1}
	for i := 1; i <= players; i++ {
		room.PlayerIDs = append(room.PlayerIDs, fmt.Sprintf("player-%d", i))
	}
	return room
}

func startExpedition(t *testing.T, players int, themeID, runID string) *Room {
	t.Helper()
	room := newPartyRoom(players)
	if err := StartMultiLevelRunForTheme(room, runID, themeID, expeditionNow); err != nil {
		t.Fatal(err)
	}
	return room
}

// basicAttackOf is the skill on a player bar that is always ready: their basic attack.
func basicAttackOf(player *PlayerState) string {
	for _, id := range player.Skills {
		if definition, ok := findSkill(id); ok && definition.Basic {
			return id
		}
	}
	return SkillStrike
}

// defeatCurrentEncounter wins the fight in the current room with one Strike from player-1.
func defeatCurrentEncounter(t *testing.T, room *Room) {
	t.Helper()
	run := room.Run
	current := run.Rooms[run.CurrentRoomID]
	for i := range current.Encounter.Enemies {
		current.Encounter.Enemies[i].Health = 0
		current.Encounter.Enemies[i].Barrier = 0
	}
	current.Encounter.Enemies[0].Health = 1
	target := current.Encounter.Enemies[0].ID
	for _, playerID := range eligibleCombatPlayers(room) {
		command := Command{Type: "combat", Round: run.CombatRound.Number, Action: "skill", Skill: basicAttackOf(run.Players[playerID]), TargetID: target}
		if playerID != "player-1" {
			command = Command{Type: "combat", Round: run.CombatRound.Number, Action: "defend"}
		}
		if err := ApplyCommand(room, playerID, command, expeditionNow); err != nil {
			t.Fatalf("combat in %s: %v", current.ID, err)
		}
	}
	if current.Encounter.Status != EncounterCleared {
		t.Fatalf("encounter in %s was not cleared", current.ID)
	}
}

// clearFloorBoss jumps the party to the current floor's boss and defeats it.
func clearFloorBoss(t *testing.T, room *Room) {
	t.Helper()
	run := room.Run
	run.CurrentRoomID = bossRoomID(run)
	run.Phase = PhaseCombat
	startCombatRound(room, expeditionNow)
	defeatCurrentEncounter(t, room)
}

func bossRoomID(run *Run) string {
	id := fmt.Sprintf("d%d-boss", run.Depth)
	if dungeonNumber(run) > 1 {
		id = fmt.Sprintf("x%d-%s", dungeonNumber(run), id)
	}
	return id
}

// clearToCamp puts the party on the dungeon's midpoint floor and defeats its guardian, which opens a camp.
func clearToCamp(t *testing.T, room *Room) {
	t.Helper()
	run := room.Run
	boss := *run.Rooms[bossRoomID(run)]
	run.Depth = run.MaxDepth / 2
	boss.ID = bossRoomID(run)
	run.Rooms[boss.ID] = &boss
	clearFloorBoss(t, room)
	if run.Camp == nil || len(run.Camp.Choices) != 0 {
		t.Fatalf("the midpoint of a %d-floor dungeon (floor %d) should open a camp without a crossroads: %+v", run.MaxDepth, run.Depth, run.Camp)
	}
}

// finishCamp settles every mini-game and readies everyone, taking the party to the next floor.
func finishCamp(t *testing.T, room *Room) {
	t.Helper()
	run := room.Run
	for _, playerID := range eligibleCombatPlayers(room) {
		if run.Camp.Stage != CampStageGame {
			break
		}
		command := Command{Type: "minigame", Action: "bank"}
		if run.Camp.Game.Kind == MinigameEcho {
			command = Command{Type: "minigame", Action: "echo", ChoiceID: strings.Join(run.Camp.Game.Players[playerID].Sequence, ",")}
		}
		if err := ApplyCommand(room, playerID, command, expeditionNow); err != nil {
			t.Fatalf("mini-game: %v", err)
		}
	}
	if run.Camp != nil && run.Camp.Stage == CampStageCrossroads {
		for _, playerID := range eligibleCombatPlayers(room) {
			if run.Camp.Stage != CampStageCrossroads {
				break
			}
			if err := ApplyCommand(room, playerID, Command{Type: "choose_dungeon", ChoiceID: run.Camp.Choices[1].ThemeID}, expeditionNow); err != nil {
				t.Fatalf("crossroads: %v", err)
			}
		}
	}
	if run.Camp == nil || run.Camp.Stage != CampStageShop {
		t.Fatalf("camp should be at the shop, got %+v", run.Camp)
	}
	for _, playerID := range eligibleCombatPlayers(room) {
		if run.Phase != PhaseIntermission {
			break
		}
		if err := ApplyCommand(room, playerID, Command{Type: "ready"}, expeditionNow); err != nil {
			t.Fatalf("ready: %v", err)
		}
	}
}

func TestExpeditionContentValidates(t *testing.T) {
	if err := defaultExpeditionThemeCatalog.Validate(defaultDungeonThemeCatalog, defaultEncounterCatalog, defaultMonsterCatalog); err != nil {
		t.Fatal(err)
	}
	if err := defaultFloorModifierCatalog.Validate(); err != nil {
		t.Fatal(err)
	}
	if err := validateShopCatalog(); err != nil {
		t.Fatal(err)
	}
	mechanics := map[string]int{}
	for themeID, theme := range defaultExpeditionThemeCatalog.Themes {
		if len(theme.Discoveries) < 3 {
			t.Errorf("theme %q has %d discoveries, want at least 3", themeID, len(theme.Discoveries))
		}
		for _, mechanic := range theme.Final.Mechanics {
			mechanics[mechanic]++
		}
	}
	for _, mechanic := range []string{BossMechanicSummon, BossMechanicBarrier, BossMechanicCataclysm} {
		if mechanics[mechanic] < 3 {
			t.Errorf("mechanic %q is used by %d dungeon bosses, want at least 3", mechanic, mechanics[mechanic])
		}
	}
}

func TestExpeditionContentRejectsInconsistentContent(t *testing.T) {
	cases := map[string]func(*ExpeditionTheme){
		"encounter from another theme": func(theme *ExpeditionTheme) { theme.Heavy = []string{"scifi-patrol"} },
		"unknown encounter":            func(theme *ExpeditionTheme) { theme.Light = []string{"nope"} },
		"guardian without a boss":      func(theme *ExpeditionTheme) { theme.Guardians[0].EncounterID = "mobster-outpost" },
		"too few halls":                func(theme *ExpeditionTheme) { theme.Halls = theme.Halls[:3] },
		"duplicate room name":          func(theme *ExpeditionTheme) { theme.Halls[0].Name = theme.Guard.Name },
		"event without a way out": func(theme *ExpeditionTheme) {
			theme.Discoveries[0].Event.Choices = theme.Discoveries[0].Event.Choices[:2]
		},
		"unknown effect":        func(theme *ExpeditionTheme) { theme.Vault.Event.Choices[0].Effect = "free_gold" },
		"unknown mechanic":      func(theme *ExpeditionTheme) { theme.Final.Mechanics = []string{"teleport"} },
		"summon from elsewhere": func(theme *ExpeditionTheme) { theme.Final.SummonMonsterID = "crab-drone" },
		"cataclysm unnamed":     func(theme *ExpeditionTheme) { theme.Final.CataclysmLabel = "" },
		"no mechanics":          func(theme *ExpeditionTheme) { theme.Final.Mechanics = nil },
	}
	for name, mutate := range cases {
		t.Run(name, func(t *testing.T) {
			catalog := newExpeditionThemeCatalog()
			theme := catalog.Themes["mobster"]
			theme.Halls = append([]FloorRoomTemplate(nil), theme.Halls...)
			theme.Guardians = append([]FloorBossTemplate(nil), theme.Guardians...)
			mutate(&theme)
			catalog.Themes["mobster"] = theme
			if err := catalog.Validate(defaultDungeonThemeCatalog, defaultEncounterCatalog, defaultMonsterCatalog); err == nil {
				t.Fatal("expected validation to fail")
			}
		})
	}
	t.Run("playable theme without content", func(t *testing.T) {
		catalog := newExpeditionThemeCatalog()
		delete(catalog.Themes, "arctic")
		if err := catalog.Validate(defaultDungeonThemeCatalog, defaultEncounterCatalog, defaultMonsterCatalog); err == nil {
			t.Fatal("expected a playable theme without expedition content to be rejected")
		}
	})
}

// Every theme must produce connected, bounded, deterministic floors of its own monsters, whatever the seed,
// depth and party size, and across seeds the floors must actually vary.
func TestExpeditionFloorsAreConnectedBoundedDeterministicAndVaried(t *testing.T) {
	for _, definition := range PlayableDungeonThemes() {
		themeID := definition.ID
		theme := defaultExpeditionThemeCatalog.Themes[themeID]
		reached := map[string]bool{}
		kinds := map[string]int{}
		layouts := map[string]bool{}
		finalBonusRooms := 0
		for seed := uint64(1); seed <= 120; seed++ {
			for depth := 1; depth <= MaximumExpeditionDepth; depth++ {
				party := 1 + int(seed+uint64(depth))%4
				where := fmt.Sprintf("%s seed=%d depth=%d party=%d", themeID, seed, depth, party)
				modifiers := rollFloorModifiers(seed, depth)
				entry, rooms := generateExpeditionFloor(themeID, seed, depth, MaximumExpeditionDepth, party, modifiers)
				entryB, roomsB := generateExpeditionFloor(themeID, seed, depth, MaximumExpeditionDepth, party, modifiers)
				a, _ := json.Marshal(rooms)
				b, _ := json.Marshal(roomsB)
				if entry != entryB || string(a) != string(b) {
					t.Fatalf("%s: generation is not deterministic", where)
				}
				final := depth == MaximumExpeditionDepth
				if final && len(rooms) != 3 || !final && (len(rooms) < 7 || len(rooms) > 9) {
					t.Fatalf("%s: %d rooms; finale wants exactly 3, regular floors want 7-9", where, len(rooms))
				}
				shape := ""
				names := map[string]bool{}
				enemyIDs := map[string]bool{}
				fights, discoveries := 0, 0
				for id, room := range rooms {
					shape += id + ":" + room.RoomType + fmt.Sprint(len(room.Exits)) + " "
					if room.ID != id || room.ThemeID != themeID || !strings.HasPrefix(id, fmt.Sprintf("d%d-", depth)) {
						t.Fatalf("%s: room %q has id=%q theme=%q", where, id, room.ID, room.ThemeID)
					}
					if names[room.Name] || room.Name == "" || room.Description == "" {
						t.Fatalf("%s: room name %q is empty or repeated on one floor", where, room.Name)
					}
					names[room.Name] = true
					kinds[room.RoomType]++
					if (room.Encounter == nil) == (room.Event == nil) {
						t.Fatalf("%s: room %q must have exactly one of an encounter and an event", where, id)
					}
					if room.Event != nil {
						discoveries++
					}
					if room.Encounter != nil {
						fights++
						reached[room.Encounter.DefinitionID] = true
						for _, enemy := range room.Encounter.Enemies {
							if enemyIDs[enemy.ID] {
								t.Fatalf("%s: enemy id %q is used twice on one floor", where, enemy.ID)
							}
							enemyIDs[enemy.ID] = true
							monster, err := defaultMonsterCatalog.Monster(enemy.DefinitionID)
							if err != nil {
								t.Fatalf("%s: %v", where, err)
							}
							if monsterTheme, _ := art.ThemeOf(monster.Sprite); monsterTheme != definition.Art {
								t.Fatalf("%s: %q spawns %q from art theme %q", where, id, enemy.DefinitionID, monsterTheme)
							}
						}
					}
					if room.RoomType == "boss" && len(room.Exits) != 0 || room.RoomType != "boss" && (len(room.Exits) == 0 || len(room.Exits) > 3) {
						t.Fatalf("%s: room %q has %d exits", where, id, len(room.Exits))
					}
					for _, exit := range room.Exits {
						if rooms[exit.Destination] == nil || exit.Label != rooms[exit.Destination].Name || exit.Description == "" {
							t.Fatalf("%s: exit %+v from %q is broken or gives no hint", where, exit, id)
						}
					}
				}
				layouts[shape] = true
				if final {
					bonus := rooms[fmt.Sprintf("d%d-m11", depth)]
					if bonus == nil || bonus.RoomType == "encounter" || bonus.RoomType == "boss" || len(rooms[entry].Exits) != 1 || rooms[entry].Exits[0].Destination != bonus.ID || len(bonus.Exits) != 1 || bonus.Exits[0].Destination != fmt.Sprintf("d%d-boss", depth) {
						t.Fatalf("%s: finale must be entry -> one signature bonus room -> boss; bonus=%+v entry exits=%+v", where, bonus, rooms[entry].Exits)
					}
				} else if discoveries < 1 || fights < 5 {
					t.Fatalf("%s: %d discoveries and %d fights", where, discoveries, fights)
				}
				// Every room is reachable; the finale has one entry fight, one signature room, and its boss.
				visited := map[string]bool{entry: true}
				queue := []string{entry}
				for len(queue) > 0 {
					for _, exit := range rooms[queue[0]].Exits {
						if !visited[exit.Destination] {
							visited[exit.Destination] = true
							queue = append(queue, exit.Destination)
						}
					}
					queue = queue[1:]
				}
				if len(visited) != len(rooms) {
					t.Fatalf("%s: reached %d of %d rooms", where, len(visited), len(rooms))
				}
				minimumFights := 3
				if final {
					minimumFights = 2
				}
				if least := fewestFights(rooms, entry); least < minimumFights {
					t.Fatalf("%s: a route reaches the boss after only %d fights", where, least)
				}
				boss := rooms[fmt.Sprintf("d%d-boss", depth)]
				if final {
					signature := rooms[fmt.Sprintf("d%d-m11", depth)]
					if len(rooms) == 3 && signature != nil && signature.RoomType != "encounter" && signature.RoomType != "boss" {
						finalBonusRooms++
					}
				}
				if final != (boss.Encounter.DefinitionID == theme.Final.EncounterID) || final != (len(boss.Encounter.Enemies[0].Mechanics) > 0) {
					t.Fatalf("%s: wrong boss %q or mechanics %v", where, boss.Encounter.DefinitionID, boss.Encounter.Enemies[0].Mechanics)
				}
			}
		}
		if finalBonusRooms != 120 {
			t.Errorf("theme %q generated the compact finale layout on %d/120 fourth floors; want 120", themeID, finalBonusRooms)
		}
		for _, id := range theme.encounterIDs() {
			if !reached[id] {
				t.Errorf("theme %q: encounter %q is never placed on any floor", themeID, id)
			}
		}
		for _, kind := range []string{"encounter", "event", "reward", "miniboss", "boss"} {
			if kinds[kind] == 0 {
				t.Errorf("theme %q never generated a %s room", themeID, kind)
			}
		}
		if len(layouts) < 200 {
			t.Errorf("theme %q produced only %d distinct layouts from 720 floors", themeID, len(layouts))
		}
	}
}

func fewestFights(rooms map[string]*DungeonRoom, id string) int {
	room := rooms[id]
	own := 0
	if room.Encounter != nil {
		own = 1
	}
	best := -1
	for _, exit := range room.Exits {
		if next := fewestFights(rooms, exit.Destination); best < 0 || next < best {
			best = next
		}
	}
	if best < 0 {
		best = 0
	}
	return own + best
}

func TestExpeditionsAlwaysHaveFourFloors(t *testing.T) {
	for i := 0; i < 300; i++ {
		room := startExpedition(t, 1, "catacombs", fmt.Sprintf("run-%d", i))
		run := room.Run
		if run.Generator != ExpeditionGenerator || run.Depth != 1 || run.CurrentRoomID != "d1-entry" || run.Phase != PhaseCombat || run.CombatRound == nil || len(run.FloorModifiers) != 0 {
			t.Fatalf("unexpected new expedition: %+v", run)
		}
		if run.MaxDepth != ExpeditionFloorCount || run.MaxDepth != expeditionDepth(run.Seed) {
			t.Fatalf("run has %d floors, want exactly %d", run.MaxDepth, ExpeditionFloorCount)
		}
	}
}

func TestEveryThemeStartsAndRandomPicksAPlayableTheme(t *testing.T) {
	for _, theme := range PlayableDungeonThemes() {
		room := startExpedition(t, 2, theme.ID, "run-"+theme.ID)
		if room.Run.ThemeID != theme.ID || room.Run.Rooms["d1-entry"].ThemeID != theme.ID {
			t.Errorf("theme %q did not start its own floor", theme.ID)
		}
	}
	themes := map[string]bool{}
	for i := 0; i < 200; i++ {
		themes[startExpedition(t, 1, RandomDungeonThemeID, fmt.Sprintf("random-%d", i)).Run.ThemeID] = true
	}
	if len(themes) != len(PlayableDungeonThemes()) {
		t.Errorf("random start reached %d of %d themes", len(themes), len(PlayableDungeonThemes()))
	}
	room := newPartyRoom(1)
	if err := StartMultiLevelRunForTheme(room, "run", "atlantis", expeditionNow); !errors.Is(err, ErrUnknownDungeonTheme) || room.Run != nil {
		t.Fatalf("unknown theme: err=%v run=%v", err, room.Run)
	}
	room = startExpedition(t, 1, "scifi", "run")
	if err := StartMultiLevelRunForTheme(room, "run-2", "scifi", expeditionNow); !errors.Is(err, ErrRunAlreadyStarted) {
		t.Fatalf("starting twice: %v", err)
	}
}

func TestFloorModifiersGrowWithDepthAndNeverCancelOut(t *testing.T) {
	perks := 0
	for seed := uint64(1); seed <= 400; seed++ {
		if got := rollFloorModifiers(seed, 1); len(got) != 0 {
			t.Fatalf("the first floor must be clean, got %v", got)
		}
		for depth := 2; depth <= MaximumExpeditionDepth; depth++ {
			modifiers := rollFloorModifiers(seed, depth)
			again, _ := json.Marshal(rollFloorModifiers(seed, depth))
			first, _ := json.Marshal(modifiers)
			if string(first) != string(again) {
				t.Fatal("modifier rolls must be deterministic")
			}
			debuffs, ids := 0, map[string]bool{}
			for _, modifier := range modifiers {
				definition, ok := defaultFloorModifierCatalog.Modifier(modifier.ID)
				if !ok || !definition.Rollable || ids[modifier.ID] || modifier.Name == "" || modifier.Description == "" {
					t.Fatalf("seed %d depth %d rolled a bad modifier %+v", seed, depth, modifier)
				}
				ids[modifier.ID] = true
				if modifier.Kind == FloorModifierDebuff {
					debuffs++
				} else {
					perks++
				}
			}
			for id := range ids {
				if definition, _ := defaultFloorModifierCatalog.Modifier(id); ids[definition.Opposes] {
					t.Fatalf("seed %d depth %d rolled %q and its opposite", seed, depth, id)
				}
			}
			if debuffs != floorDebuffCount(depth) || len(modifiers)-debuffs > 1 {
				t.Fatalf("seed %d depth %d: %d debuffs and %d perks", seed, depth, debuffs, len(modifiers)-debuffs)
			}
		}
	}
	if want := []int{0, 1, 1, 2, 2, 3}; fmt.Sprint(want) != fmt.Sprint([]int{floorDebuffCount(1), floorDebuffCount(2), floorDebuffCount(3), floorDebuffCount(4), floorDebuffCount(5), floorDebuffCount(6)}) {
		t.Fatal("debuffs per depth changed")
	}
	if share := perks * 100 / (400 * (MaximumExpeditionDepth - 1)); share < FloorPerkChance-8 || share > FloorPerkChance+8 {
		t.Fatalf("perks on %d%% of floors, want about %d%%", share, FloorPerkChance)
	}
}

func TestFloorModifiersChangeCombatRules(t *testing.T) {
	baseline := startExpedition(t, 1, "catacombs", "modifier-run")
	entry := baseline.Run.Rooms["d1-entry"]
	baseDamage, baseHealth := entry.Encounter.Enemies[0].Intent.Damage, entry.Encounter.Enemies[0].Health

	room := startExpedition(t, 1, "catacombs", "modifier-run")
	run := room.Run
	run.FloorModifiers = []ActiveFloorModifier{{ID: "bloodlust"}, {ID: "dull-edges"}, {ID: "brittle-guard"}, {ID: "hazard"}, {ID: "withering"}, {ID: "fortune"}}
	player := run.Players["player-1"]
	player.Health = 20

	// Hazard: a fight opens with damage. Bloodlust: the telegraph itself is higher.
	run.Rooms["d1-entry"].Exits = []Exit{{ID: "loop", Destination: "d1-guard"}}
	run.Rooms["d1-entry"].Cleared = true
	run.Phase = PhaseExploring
	if err := ApplyCommand(room, "player-1", Command{Type: "choose_exit", ExitID: "loop"}, expeditionNow); err != nil {
		t.Fatal(err)
	}
	if player.Health != 18 {
		t.Fatalf("hazard should cost 2 health on entering a fight, health=%d", player.Health)
	}
	player.Health = 1
	applyFloorEntryDamage(room)
	if player.Health != 1 {
		t.Fatal("hazard must never kill")
	}
	player.Health = 20
	run.CurrentRoomID = "d1-entry"
	run.Phase = PhaseCombat
	entry = run.Rooms["d1-entry"]
	entry.Encounter.Enemies[0].TurnsTaken = 0
	startCombatRound(room, expeditionNow)
	enemy := &entry.Encounter.Enemies[0]
	if enemy.Intent.Damage != baseDamage+1 {
		t.Fatalf("bloodlust telegraph = %d, want %d", enemy.Intent.Damage, baseDamage+1)
	}

	// Dull Edges: Strike deals one less. Brittle Guard: Defend blocks one less.
	if err := ApplyCommand(room, "player-1", Command{Type: "combat", Round: run.CombatRound.Number, Action: "skill", Skill: SkillStrike, TargetID: enemy.ID}, expeditionNow); err != nil {
		t.Fatal(err)
	}
	if dealt := baseHealth - enemy.Health; dealt != PlayerStrikeDamage-1 {
		t.Fatalf("dull strike dealt %d, want %d", dealt, PlayerStrikeDamage-1)
	}
	before, incoming := player.Health, enemy.Intent.Damage
	if err := ApplyCommand(room, "player-1", Command{Type: "combat", Round: run.CombatRound.Number, Action: "defend"}, expeditionNow); err != nil {
		t.Fatal(err)
	}
	if taken, want := before-player.Health, incoming-(GuardDamageReduction-1); taken != want {
		t.Fatalf("brittle guard let through %d, want %d", taken, want)
	}

	// Fortune: more gold. Withering: the camp rest is halved.
	if rules := floorRulesFor(run); rules.GoldPct != 50 || rules.healing(10) != 5 || rules.healing(1) != 1 {
		t.Fatalf("unexpected floor rules %+v", rules)
	}
	gold := player.Gold
	defeatCurrentEncounter(t, room)
	if want := EncounterGold(entry.Encounter.Budget, 1) * 150 / 100; player.Gold-gold != want {
		t.Fatalf("fortune paid %d gold, want %d", player.Gold-gold, want)
	}

	// Ironhide and Frail Foes scale enemy health when the floor is generated.
	_, plain := generateExpeditionFloor("catacombs", 9, 2, 4, 1, nil)
	_, tough := generateExpeditionFloor("catacombs", 9, 2, 4, 1, []ActiveFloorModifier{{ID: "ironhide"}})
	_, frail := generateExpeditionFloor("catacombs", 9, 2, 4, 1, []ActiveFloorModifier{{ID: "frail-foes"}})
	health := func(rooms map[string]*DungeonRoom) int { return rooms["d2-boss"].Encounter.Enemies[0].MaxHealth }
	if health(tough) != (health(plain)*120+50)/100 || health(frail) != (health(plain)*85+50)/100 {
		t.Fatalf("boss health plain=%d ironhide=%d frail=%d", health(plain), health(tough), health(frail))
	}
}

func TestEncountersPayGoldToPresentAdventurersOnly(t *testing.T) {
	room := startExpedition(t, 3, "scifi", "gold-run")
	run := room.Run
	left := expeditionNow
	room.Presence = map[string]PlayerPresence{"player-3": {LeftAt: &left}}
	run.Players["player-2"].Health = 0
	budget := run.Rooms["d1-entry"].Encounter.Budget
	defeatCurrentEncounter(t, room)
	want := EncounterGold(budget, 1)
	if run.Players["player-1"].Gold != want || run.Players["player-2"].Gold != want || run.Players["player-3"].Gold != 0 {
		t.Fatalf("gold: p1=%d downed p2=%d departed p3=%d, want %d %d 0", run.Players["player-1"].Gold, run.Players["player-2"].Gold, run.Players["player-3"].Gold, want, want)
	}

	legacy := newTestRoom()
	if err := startLegacyMultiLevelRun(legacy, "legacy-gold", "scifi", expeditionNow); err != nil {
		t.Fatal(err)
	}
	defeatCurrentEncounter(t, legacy)
	if legacy.Run.Players["player-1"].Gold != 0 {
		t.Fatal("runs persisted before expeditions have no shop and must not earn gold")
	}
}

// The loop: floors lead straight down except at the dungeon's midpoint, where the party camps. The dungeon boss
// opens a camp with a crossroads, the party votes for one of two other dungeons with their own modifiers, and the
// expedition goes on there. Nothing ends it but the party falling.
func TestExpeditionLoopsThroughDungeonsUntilThePartyFalls(t *testing.T) {
	for _, players := range []int{1, 3} {
		room := startExpedition(t, players, "ghosttown", "full-descent")
		run := room.Run
		floors := 0
		for dungeon := 1; dungeon <= 3; dungeon++ {
			themeID, maxDepth := run.ThemeID, run.MaxDepth
			if dungeonNumber(run) != dungeon || maxDepth < MinimumExpeditionDepth || maxDepth > MaximumExpeditionDepth {
				t.Fatalf("dungeon %d: number=%d floors=%d", dungeon, run.Dungeon, maxDepth)
			}
			camps := 0
			for depth := 1; depth <= maxDepth; depth++ {
				boss := run.Rooms[bossRoomID(run)]
				if run.Depth != depth || boss == nil || boss.ThemeID != themeID {
					t.Fatalf("dungeon %d: expected floor %d of %s, depth=%d boss=%v", dungeon, depth, themeID, run.Depth, boss)
				}
				if (depth == maxDepth) != boss.Encounter.Enemies[0].hasMechanic(BossMechanicEnrage) {
					t.Fatalf("floor %d of %d: boss mechanics %v", depth, maxDepth, boss.Encounter.Enemies[0].Mechanics)
				}
				clearFloorBoss(t, room)
				floors++
				if run.FloorsCleared != floors || run.Phase == PhaseCompleted {
					t.Fatalf("floors cleared %d, want %d (phase %s)", run.FloorsCleared, floors, run.Phase)
				}
				if depth == maxDepth {
					break
				}
				want, _ := json.Marshal(nextFloorModifiers(run, depth+1))
				if depth != maxDepth/2 {
					// An ordinary floor: no camp, just the way down.
					if !hasEvent(run, "floor_restoration") && run.Players["player-1"].Health < run.Players["player-1"].MaxHealth {
						t.Fatal("clearing a floor should let the party catch its breath")
					}
					if run.Phase != PhaseExploring || run.Camp != nil || len(boss.Exits) != 1 || boss.Exits[0].Destination != DescendDestination {
						t.Fatalf("floor %d of %d should open the way down: phase=%s camp=%v exits=%v", depth, maxDepth, run.Phase, run.Camp, boss.Exits)
					}
					for _, playerID := range eligibleCombatPlayers(room) {
						if run.Depth != depth {
							break
						}
						if err := ApplyCommand(room, playerID, Command{Type: "choose_exit", ExitID: "descend"}, expeditionNow); err != nil {
							t.Fatal(err)
						}
					}
				} else {
					camps++
					camp := run.Camp
					if run.Phase != PhaseIntermission || camp == nil || camp.Stage != CampStageGame || camp.NextDepth != depth+1 || len(camp.Choices) != 0 || len(run.FloorModifiers) != 0 {
						t.Fatalf("the midpoint should be a camp: phase=%s camp=%+v", run.Phase, camp)
					}
					if (camp.Deadline == nil) != (players == 1) {
						t.Fatalf("camp deadline for %d players: %v", players, camp.Deadline)
					}
					if got, _ := json.Marshal(camp.NextModifiers); string(got) != string(want) {
						t.Fatalf("camp shows %s, want %s", got, want)
					}
					if err := ApplyCommand(room, "player-1", Command{Type: "choose_inter_floor", ChoiceID: "perk"}, expeditionNow); !errors.Is(err, ErrInvalidPhase) {
						t.Fatalf("the old restore-or-perk choice must not apply to expeditions: %v", err)
					}
					finishCamp(t, room)
				}
				if run.Phase != PhaseCombat || run.Camp != nil || run.Depth != depth+1 || run.CombatRound == nil {
					t.Fatalf("expected floor %d: phase=%s depth=%d", depth+1, run.Phase, run.Depth)
				}
				if got, _ := json.Marshal(run.FloorModifiers); string(got) != string(want) {
					t.Fatalf("floor %d modifiers %s, want %s", depth+1, got, want)
				}
			}
			if camps != 1 {
				t.Fatalf("a %d-floor dungeon had %d midpoint camps, want 1", maxDepth, camps)
			}

			// The dungeon boss is down: camp, then the crossroads.
			camp := run.Camp
			if run.DungeonsCleared != dungeon || run.Phase != PhaseIntermission || camp == nil || camp.Stage != CampStageGame || !hasEvent(run, "dungeon_cleared") {
				t.Fatalf("dungeon %d should end at a camp: phase=%s cleared=%d camp=%+v", dungeon, run.Phase, run.DungeonsCleared, camp)
			}
			if len(camp.Choices) != DungeonChoiceCount || camp.Choices[0].ThemeID == camp.Choices[1].ThemeID {
				t.Fatalf("the crossroads should offer two different dungeons: %+v", camp.Choices)
			}
			for _, choice := range camp.Choices {
				debuffs, perks := 0, 0
				for _, modifier := range choice.Modifiers {
					if modifier.Kind == FloorModifierDebuff {
						debuffs++
					} else {
						perks++
					}
					definition, _ := defaultFloorModifierCatalog.Modifier(modifier.ID)
					for _, other := range choice.Modifiers {
						if other.ID == definition.Opposes {
							t.Fatalf("choice %s carries %s and its opposite", choice.ThemeID, modifier.ID)
						}
					}
				}
				wantDebuffs := dungeon
				if wantDebuffs > 2 {
					wantDebuffs = 2
				}
				if choice.ThemeID == themeID || choice.Name == "" || debuffs != wantDebuffs || perks != 1 || choice.Floors < MinimumExpeditionDepth || choice.Floors > MaximumExpeditionDepth {
					t.Fatalf("after dungeon %d of %s, choice %+v", dungeon, themeID, choice)
				}
			}
			chosen := camp.Choices[1]
			if err := ApplyCommand(room, "player-1", Command{Type: "choose_dungeon", ChoiceID: chosen.ThemeID}, expeditionNow); !errors.Is(err, ErrInvalidCampAction) {
				t.Fatalf("voting before the mini-game is over: %v", err)
			}
			finishCamp(t, room) // votes for Choices[1]
			if dungeonNumber(run) != dungeon+1 || run.ThemeID != chosen.ThemeID || run.Depth != 1 || run.MaxDepth != chosen.Floors || run.Phase != PhaseCombat {
				t.Fatalf("expected dungeon %d in %s: number=%d theme=%s depth=%d", dungeon+1, chosen.ThemeID, run.Dungeon, run.ThemeID, run.Depth)
			}
			wantModifiers, _ := json.Marshal(chosen.Modifiers)
			if got, _ := json.Marshal(run.DungeonModifiers); string(got) != string(wantModifiers) {
				t.Fatalf("dungeon modifiers %s, want %s", got, wantModifiers)
			}
			if got, _ := json.Marshal(run.FloorModifiers); string(got) != string(wantModifiers) {
				t.Fatalf("the first floor carries the dungeon's modifiers: %s, want %s", got, wantModifiers)
			}
			prefix := fmt.Sprintf("x%d-d1-", dungeon+1)
			for id, dungeonRoom := range run.Rooms {
				if !strings.HasPrefix(id, prefix) || dungeonRoom.ID != id || dungeonRoom.ThemeID != chosen.ThemeID {
					t.Fatalf("room %q should belong to the new dungeon only", id)
				}
				for _, exit := range dungeonRoom.Exits {
					if run.Rooms[exit.Destination] == nil {
						t.Fatalf("exit %+v of %q leads nowhere", exit, id)
					}
				}
			}
			if run.CurrentRoomID != prefix+"entry" || RoomBackdropKind(run.Rooms[run.CurrentRoomID]) != art.RoomKindEntry {
				t.Fatalf("current room %q", run.CurrentRoomID)
			}
		}

		// Later dungeons are harder floor for floor, and every later floor keeps the dungeon's modifiers.
		_, plain := generateExpeditionFloor(run.ThemeID, dungeonSeed(run.Seed, 4), 1, run.MaxDepth, players, run.FloorModifiers)
		plainHealth := plain["d1-entry"].Encounter.Enemies[0].MaxHealth
		if got := run.Rooms[run.CurrentRoomID].Encounter.Enemies[0].MaxHealth; got <= plainHealth {
			t.Fatalf("dungeon 4 entry enemy health %d should exceed a first dungeon's %d", got, plainHealth)
		}
		for _, modifier := range run.DungeonModifiers {
			found := false
			for _, active := range nextFloorModifiers(run, 2) {
				found = found || active.ID == modifier.ID
			}
			if !found {
				t.Fatalf("floor 2 lost dungeon modifier %s", modifier.ID)
			}
		}

		// The expedition ends only when the party falls, and the distance earns a rank.
		for _, player := range run.Players {
			player.Health = 1
		}
		for i := range run.Rooms[run.CurrentRoomID].Encounter.Enemies {
			run.Rooms[run.CurrentRoomID].Encounter.Enemies[i].Health = 9999
		}
		for round := 0; round < 30 && run.Phase == PhaseCombat; round++ {
			bossRound(t, room, Command{Action: "skill", Skill: SkillStrike, TargetID: run.Rooms[run.CurrentRoomID].Encounter.Enemies[0].ID})
		}
		if run.Phase != PhaseFailed || run.Rank != ExpeditionRank(floors) || run.Rank == "Wanderer" || run.FloorsCleared != floors {
			t.Fatalf("the fall should end the expedition with a rank: phase=%s rank=%q floors=%d", run.Phase, run.Rank, run.FloorsCleared)
		}
	}
}

func TestExpeditionRanksRiseWithDistance(t *testing.T) {
	previous := ""
	titles := map[string]bool{}
	for floors := 0; floors <= 30; floors++ {
		rank := ExpeditionRank(floors)
		if rank == "" {
			t.Fatalf("no rank for %d floors", floors)
		}
		if rank != previous && titles[rank] {
			t.Fatalf("rank %q comes back at %d floors", rank, floors)
		}
		titles[rank], previous = true, rank
	}
	if ExpeditionRank(0) != "Wanderer" || ExpeditionRank(1) == "Wanderer" || ExpeditionRank(30) != "Heart of the Beast" || len(titles) != len(expeditionRanks) {
		t.Fatalf("unexpected rank ladder: %v", titles)
	}
}

func TestCampsOnlyAtTheMidpointAndAfterTheDungeonBoss(t *testing.T) {
	want := map[int][]int{4: {2, 4}}
	for maxDepth, floors := range want {
		var got []int
		for depth := 1; depth <= maxDepth; depth++ {
			if campAfterFloor(depth, maxDepth) {
				got = append(got, depth)
			}
		}
		if fmt.Sprint(got) != fmt.Sprint(floors) {
			t.Errorf("a %d-floor dungeon camps after floors %v, want %v", maxDepth, got, floors)
		}
	}
}

func TestCrossroadsVoteIsMajorityWithSeededTiesAndADeadline(t *testing.T) {
	atCrossroads := func(runID string) *Room {
		room := startExpedition(t, 3, "sunken", runID)
		run := room.Run
		boss := *run.Rooms["d1-boss"]
		run.Depth = run.MaxDepth
		boss.ID = bossRoomID(run)
		run.Rooms[boss.ID] = &boss
		clearFloorBoss(t, room)
		for _, play := range run.Camp.Game.Players {
			play.Done = true
		}
		if !AdvanceCamp(room, expeditionNow) || run.Camp.Stage != CampStageCrossroads || !run.Camp.Deadline.Equal(expeditionNow.Add(CampCrossroadsWindow)) {
			t.Fatalf("expected the crossroads: %+v", run.Camp)
		}
		return room
	}
	vote := func(room *Room, playerID, themeID string) error {
		return ApplyCommand(room, playerID, Command{Type: "choose_dungeon", ChoiceID: themeID}, expeditionNow)
	}

	room := atCrossroads("crossroads")
	camp := room.Run.Camp
	first, second := camp.Choices[0].ThemeID, camp.Choices[1].ThemeID
	if err := vote(room, "player-1", "sunken"); !errors.Is(err, ErrInvalidCampAction) {
		t.Fatalf("voting for a dungeon that is not offered: %v", err)
	}
	if err := ApplyCommand(room, "player-1", Command{Type: "ready"}, expeditionNow); !errors.Is(err, ErrInvalidCampAction) {
		t.Fatalf("readying up at the crossroads: %v", err)
	}
	for playerID, themeID := range map[string]string{"player-1": first, "player-2": second, "player-3": second} {
		if camp.Stage != CampStageCrossroads {
			t.Fatal("the vote closed before everyone had voted")
		}
		if err := vote(room, playerID, themeID); err != nil {
			t.Fatal(err)
		}
	}
	if camp.Stage != CampStageShop || camp.NextThemeID != second || camp.NextDepth != 1 || len(camp.NextModifiers) != len(camp.Choices[1].Modifiers) {
		t.Fatalf("two votes of three should win: %+v", camp)
	}

	// One vote at the deadline wins; no votes at all leaves it to the seed, which must be stable.
	room = atCrossroads("crossroads")
	if err := vote(room, "player-2", first); err != nil {
		t.Fatal(err)
	}
	if !AdvanceCamp(room, expeditionNow.Add(CampCrossroadsWindow)) || room.Run.Camp.NextThemeID != first {
		t.Fatalf("the only vote should win at the deadline: %+v", room.Run.Camp)
	}
	silent, again := atCrossroads("crossroads"), atCrossroads("crossroads")
	AdvanceCamp(silent, expeditionNow.Add(CampCrossroadsWindow))
	AdvanceCamp(again, expeditionNow.Add(CampCrossroadsWindow))
	if silent.Run.Camp.NextThemeID == "" || silent.Run.Camp.NextThemeID != again.Run.Camp.NextThemeID {
		t.Fatalf("an unvoted crossroads must resolve the same way every time: %q %q", silent.Run.Camp.NextThemeID, again.Run.Camp.NextThemeID)
	}
}

func TestCampRestsThePartyAndIsTimeBoxedForGroups(t *testing.T) {
	room := startExpedition(t, 2, "jungle", "camp-run")
	run := room.Run
	run.Players["player-1"].Health = 10
	run.Players["player-2"].Health = 0
	clearToCamp(t, room)
	// Camp rest remains; the boss fight itself no longer restores health.
	if got, maxHealth := run.Players["player-1"].Health, run.Players["player-1"].MaxHealth; got != 10+maxHealth*CampRestPercent/100 {
		t.Fatalf("camp rest left player-1 at %d", got)
	}
	if run.Players["player-2"].Health != 0 {
		t.Fatal("a downed adventurer does not recover by resting")
	}
	if run.Camp.Deadline != nil {
		t.Fatal("one adventurer left standing sets their own pace")
	}

	room = startExpedition(t, 2, "jungle", "camp-run")
	run = room.Run
	clearToCamp(t, room)
	deadline := *run.Camp.Deadline
	if !deadline.Equal(expeditionNow.Add(CampGameWindow)) || AdvanceCamp(room, deadline.Add(-time.Second)) {
		t.Fatal("the camp must wait for its deadline")
	}
	if err := ApplyCommand(room, "player-1", Command{Type: "ready"}, expeditionNow); !errors.Is(err, ErrInvalidCampAction) {
		t.Fatalf("readying up during the mini-game: %v", err)
	}
	if !AdvanceCamp(room, deadline) || run.Camp.Stage != CampStageShop || !run.Camp.Game.Players["player-1"].Done || !run.Camp.Game.Players["player-2"].Done {
		t.Fatalf("the game deadline should settle every game and open the shop: %+v", run.Camp)
	}
	shopDeadline := *run.Camp.Deadline
	if !shopDeadline.Equal(deadline.Add(CampShopWindow)) {
		t.Fatalf("shop deadline %v", shopDeadline)
	}
	if err := ApplyCommand(room, "player-1", Command{Type: "ready"}, deadline); err != nil || run.Phase != PhaseIntermission {
		t.Fatalf("one of two ready should wait: err=%v phase=%s", err, run.Phase)
	}
	if !AdvanceCamp(room, shopDeadline) || run.Phase != PhaseCombat || run.Depth != run.MaxDepth/2+1 {
		t.Fatalf("the shop deadline should start the descent: phase=%s depth=%d", run.Phase, run.Depth)
	}
	if err := ApplyCommand(room, "player-2", Command{Type: "ready"}, shopDeadline); !errors.Is(err, ErrInvalidPhase) {
		t.Fatalf("camp command after the descent: %v", err)
	}
}

func campWithGame(t *testing.T, kind string, players int) *Room {
	t.Helper()
	for i := 0; i < 200; i++ {
		room := startExpedition(t, players, "carnival", fmt.Sprintf("game-%s-%d", kind, i))
		clearToCamp(t, room)
		if room.Run.Camp.Game.Kind == kind {
			return room
		}
	}
	t.Fatalf("no seed dealt a %s game", kind)
	return nil
}

func TestBoneDiceIsPushYourLuck(t *testing.T) {
	bust, banked, full := false, false, false
	for i := 0; i < 400 && !(bust && banked && full); i++ {
		room := startExpedition(t, 1, "carnival", fmt.Sprintf("dice-%d", i))
		clearToCamp(t, room)
		run := room.Run
		if run.Camp.Game.Kind != MinigameDice {
			continue
		}
		play := run.Camp.Game.Players["player-1"]
		gold := run.Players["player-1"].Gold
		stopAfter := 1 + i%DiceMaxRolls
		for !play.Done {
			action := "roll"
			if len(play.Rolls) >= stopAfter {
				action = "bank"
			}
			pot := play.Pot
			if err := ApplyCommand(room, "player-1", Command{Type: "minigame", Action: action}, expeditionNow); err != nil {
				t.Fatal(err)
			}
			if action == "bank" {
				banked = true
				if play.Gold != pot || pot == 0 {
					t.Fatalf("banking paid %d of a %d pot", play.Gold, pot)
				}
			} else if last := play.Rolls[len(play.Rolls)-1]; last == 1 {
				bust = true
				if play.Gold != MinigameConsolationGold || !play.Done {
					t.Fatalf("a one should bust the pot: %+v", play)
				}
			} else if last < 2 || last > 6 || play.Pot+play.Gold != pot+run.Camp.Game.stake(2*last) {
				t.Fatalf("roll %d moved the pot from %d to %d", last, pot, play.Pot+play.Gold)
			} else if len(play.Rolls) == DiceMaxRolls {
				full = play.Done
			}
		}
		if run.Players["player-1"].Gold != gold+play.Gold || play.Pot != 0 || play.Result == "" {
			t.Fatalf("payout mismatch: %+v", play)
		}
		if run.Camp.Stage != CampStageShop {
			t.Fatal("a finished solo game should open the shop")
		}
	}
	if !bust || !banked || !full {
		t.Fatalf("expected to see a bust, a bank and a full run: %v %v %v", bust, banked, full)
	}
}

func TestMimicsRowHidesOneMimicAmongThreePurses(t *testing.T) {
	room := campWithGame(t, MinigameChests, 2)
	run := room.Run
	game := run.Camp.Game
	for _, playerID := range []string{"player-1", "player-2"} {
		play := game.Players[playerID]
		contents := game.chestContents(play.Index)
		mimics, total := 0, 0
		for _, purse := range contents {
			if purse == 0 {
				mimics++
			}
			total += purse
		}
		purses := game.stake(6) + game.stake(10) + game.stake(16)
		if len(contents) != ChestCount || mimics != 1 || total != purses {
			t.Fatalf("chests %v", contents)
		}
		encoded, _ := json.Marshal(play)
		if !strings.Contains(string(encoded), `"chests":[-1,-1,-1,-1]`) {
			t.Fatalf("unopened chests must not reveal their contents: %s", encoded)
		}
		gold := run.Players[playerID].Gold
		if playerID == "player-1" {
			// Open every purse: the game ends by itself with the whole pot.
			for index, purse := range contents {
				if purse > 0 {
					if err := ApplyCommand(room, playerID, Command{Type: "minigame", Action: "open", ChoiceID: fmt.Sprint(index)}, expeditionNow); err != nil {
						t.Fatal(err)
					}
				}
			}
			if !play.Done || play.Gold != purses || run.Players[playerID].Gold != gold+purses {
				t.Fatalf("clearing the row should pay %d: %+v", purses, play)
			}
			continue
		}
		safe, mimic := -1, -1
		for index, purse := range contents {
			if purse == 0 {
				mimic = index
			} else if safe < 0 {
				safe = index
			}
		}
		if err := ApplyCommand(room, playerID, Command{Type: "minigame", Action: "open", ChoiceID: fmt.Sprint(safe)}, expeditionNow); err != nil || play.Pot != contents[safe] {
			t.Fatalf("opening a purse: err=%v pot=%d", err, play.Pot)
		}
		for _, bad := range []string{fmt.Sprint(safe), "9", "x"} {
			if err := ApplyCommand(room, playerID, Command{Type: "minigame", Action: "open", ChoiceID: bad}, expeditionNow); !errors.Is(err, ErrInvalidCampAction) {
				t.Fatalf("opening chest %q: %v", bad, err)
			}
		}
		if err := ApplyCommand(room, playerID, Command{Type: "minigame", Action: "open", ChoiceID: fmt.Sprint(mimic)}, expeditionNow); err != nil {
			t.Fatal(err)
		}
		if !play.Done || play.Gold != MinigameConsolationGold || run.Players[playerID].Gold != gold+MinigameConsolationGold {
			t.Fatalf("the mimic should take the pot: %+v", play)
		}
	}
	if run.Camp.Stage != CampStageShop {
		t.Fatal("the shop opens when everyone has finished")
	}
}

func TestRuneEchoPaysForEveryRuneInOrder(t *testing.T) {
	room := campWithGame(t, MinigameEcho, 2)
	run := room.Run
	perfect, partial := run.Camp.Game.Players["player-1"], run.Camp.Game.Players["player-2"]
	game := run.Camp.Game
	if want := 4 + game.Depth/2; len(perfect.Sequence) != want || len(partial.Sequence) != want {
		t.Fatalf("sequences should have %d runes: %v %v", want, perfect.Sequence, partial.Sequence)
	}
	purse := run.Players["player-1"].Gold
	if err := ApplyCommand(room, "player-1", Command{Type: "minigame", Action: "echo", ChoiceID: "sun,moon"}, expeditionNow); !errors.Is(err, ErrInvalidCampAction) {
		t.Fatalf("a short answer: %v", err)
	}
	if err := ApplyCommand(room, "player-1", Command{Type: "minigame", Action: "bank"}, expeditionNow); !errors.Is(err, ErrInvalidCampAction) {
		t.Fatalf("banking is not a move in Rune Echo: %v", err)
	}
	if err := ApplyCommand(room, "player-1", Command{Type: "minigame", Action: "echo", ChoiceID: strings.Join(perfect.Sequence, ",")}, expeditionNow); err != nil {
		t.Fatal(err)
	}
	if perfect.Gold != game.stake(3*len(perfect.Sequence))+game.stake(8) || run.Players["player-1"].Gold != purse+perfect.Gold {
		t.Fatalf("a perfect echo paid %d", perfect.Gold)
	}
	if err := ApplyCommand(room, "player-1", Command{Type: "minigame", Action: "echo", ChoiceID: strings.Join(perfect.Sequence, ",")}, expeditionNow); !errors.Is(err, ErrInvalidCampAction) {
		t.Fatalf("playing twice: %v", err)
	}
	answer := append([]string(nil), partial.Sequence...)
	answer[2] = "wrong"
	if err := ApplyCommand(room, "player-2", Command{Type: "minigame", Action: "echo", ChoiceID: strings.Join(answer, ",")}, expeditionNow); err != nil {
		t.Fatal(err)
	}
	purse = run.Players["player-2"].Gold - partial.Gold
	if partial.Gold != game.stake(6) || partial.Gold == 0 {
		t.Fatalf("two runes in order should pay %d, paid %d", game.stake(6), partial.Gold)
	}
}

func openTestShop(t *testing.T, players int, runID string) *Room {
	t.Helper()
	room := startExpedition(t, players, "wasteland", runID)
	clearToCamp(t, room)
	for _, play := range room.Run.Camp.Game.Players {
		play.Done = true
	}
	if !AdvanceCamp(room, expeditionNow) || room.Run.Camp.Stage != CampStageShop {
		t.Fatal("expected the shop to open")
	}
	// Put the whole catalog on the shelf so every item can be exercised.
	room.Run.Camp.Offers = ShopCatalog()
	return room
}

func TestShopSellsBoonsForGold(t *testing.T) {
	room := openTestShop(t, 2, "shop-run")
	run := room.Run
	buyer, ally := run.Players["player-1"], run.Players["player-2"]
	buy := func(itemID string) error {
		return ApplyCommand(room, "player-1", Command{Type: "buy", ChoiceID: itemID}, expeditionNow)
	}

	buyer.Gold = 5
	if err := buy("whetstone"); !errors.Is(err, ErrNotEnoughGold) || buyer.StrikeDamage != PlayerStrikeDamage {
		t.Fatalf("buying without gold: %v", err)
	}
	if err := buy("crown-jewels"); !errors.Is(err, ErrItemUnavailable) {
		t.Fatalf("buying something not on the shelf: %v", err)
	}

	buyer.Gold = 500
	buyer.Health = buyer.MaxHealth - 20
	for _, itemID := range []string{"whetstone", "bracers", "heartstone", "ward-charm", "healing-draught", "healing-draught"} {
		if err := buy(itemID); err != nil {
			t.Fatalf("buy %s: %v", itemID, err)
		}
	}
	if buyer.StrikeDamage != PlayerStrikeDamage+1 || buyer.GuardReduction != GuardDamageReduction+1 || buyer.MaxHealth != 35 || buyer.ClassCombat.Ward != 8 {
		t.Fatalf("boons not applied: %+v", buyer)
	}
	if buyer.Health != buyer.MaxHealth {
		t.Fatalf("heartstone and two draughts should have healed fully, health=%d/%d", buyer.Health, buyer.MaxHealth)
	}
	if want := 500 - 30 - 24 - 26 - 14 - 12 - 12; buyer.Gold != want || len(buyer.Items) != 6 || len(run.Camp.Purchases["player-1"]) != 6 {
		t.Fatalf("gold=%d want %d, items=%v", buyer.Gold, want, buyer.Items)
	}
	for _, itemID := range []string{"whetstone", "healing-draught", "camp-feast", "ward-charm"} {
		if err := buy(itemID); !errors.Is(err, ErrItemUnavailable) {
			t.Errorf("%s should be sold out or useless now: %v", itemID, err)
		}
	}
	if buyer.Gold != 500-118 {
		t.Fatal("a refused purchase must not cost gold")
	}

	// Revival: only while someone is down, and never on yourself.
	if err := buy("revival-draught"); !errors.Is(err, ErrItemUnavailable) {
		t.Fatalf("reviving nobody: %v", err)
	}
	ally.Health = 0
	if err := buy("revival-draught"); err != nil || ally.Health != (ally.MaxHealth+1)/2 {
		t.Fatalf("revival: err=%v ally health=%d", err, ally.Health)
	}
	if run.Camp.Ready["player-2"] {
		t.Fatal("a revived ally still has to ready up")
	}

	// Cleansing salt lifts a debuff from the floor the camp is showing.
	run.Camp.NextModifiers = []ActiveFloorModifier{{ID: "fortune", Kind: FloorModifierPerk}, {ID: "bloodlust", Kind: FloorModifierDebuff}}
	if err := buy("cleansing-salt"); err != nil || len(run.Camp.NextModifiers) != 1 || run.Camp.NextModifiers[0].ID != "fortune" {
		t.Fatalf("cleansing: err=%v next=%v", err, run.Camp.NextModifiers)
	}
	for _, playerID := range []string{"player-1", "player-2"} {
		if err := ApplyCommand(room, playerID, Command{Type: "ready"}, expeditionNow); err != nil {
			t.Fatal(err)
		}
	}
	if run.Depth != run.MaxDepth/2+1 || len(run.FloorModifiers) != 1 || run.FloorModifiers[0].ID != "fortune" {
		t.Fatalf("the cleansed floor should carry only its perk: %+v", run.FloorModifiers)
	}
	if buyer.StrikeDamage != PlayerStrikeDamage+1 || buyer.ClassCombat.Ward != 8 {
		t.Fatal("purchases must carry into the next floor")
	}
}

func TestShopShelfIsSeededAndSituational(t *testing.T) {
	room := startExpedition(t, 2, "arctic", "shelf-run")
	run := room.Run
	run.Players["player-2"].Health = 0
	clearToCamp(t, room)
	for _, play := range run.Camp.Game.Players {
		play.Done = true
	}
	run.Camp.NextModifiers = []ActiveFloorModifier{{ID: "hazard", Kind: FloorModifierDebuff}}
	AdvanceCamp(room, expeditionNow)
	ids := map[string]ShopItem{}
	for _, offer := range run.Camp.Offers {
		ids[offer.ID] = offer
	}
	if len(run.Camp.Offers) != ShopOfferCount+2 || ids["healing-draught"].Price != 12 || ids["revival-draught"].ID == "" || ids["cleansing-salt"].ID == "" {
		t.Fatalf("offers: %+v", run.Camp.Offers)
	}
	for _, item := range ShopCatalog() {
		offer, offered := ids[item.ID]
		if !offered {
			continue
		}
		want := item.Price
		steps := run.Depth + dungeonExtraDepth(run) - 1
		if steps < 0 {
			steps = 0
		}
		switch item.Kind {
		case ShopStrike:
			want += 8*steps + 4*steps*steps
		case ShopGuard, ShopMaxHealth:
			want += 3 * steps
		}
		if offer.Price != want {
			t.Errorf("%s costs %d on floor %d, want %d", item.ID, offer.Price, run.Depth, want)
		}
	}

	calm := startExpedition(t, 1, "arctic", "shelf-run")
	clearToCamp(t, calm)
	for _, play := range calm.Run.Camp.Game.Players {
		play.Done = true
	}
	calm.Run.Camp.NextModifiers = nil
	AdvanceCamp(calm, expeditionNow)
	if len(calm.Run.Camp.Offers) != ShopOfferCount {
		t.Fatalf("with nobody down and no debuff ahead the shelf is %d items: %+v", ShopOfferCount, calm.Run.Camp.Offers)
	}
}

func finalBossRoom(t *testing.T, themeID string, players int) (*Room, *Enemy) {
	t.Helper()
	room := startExpedition(t, players, themeID, "boss-"+themeID)
	run := room.Run
	run.Depth = run.MaxDepth
	entryID, rooms := generateExpeditionFloor(themeID, run.Seed, run.Depth, run.MaxDepth, players, nil)
	for id, dungeonRoom := range rooms {
		run.Rooms[id] = dungeonRoom
	}
	_ = entryID
	run.CurrentRoomID = fmt.Sprintf("d%d-boss", run.Depth)
	run.Phase = PhaseCombat
	for _, player := range run.Players {
		player.Health, player.MaxHealth = 500, 500
	}
	startCombatRound(room, expeditionNow)
	return room, &run.Rooms[run.CurrentRoomID].Encounter.Enemies[0]
}

func bossRound(t *testing.T, room *Room, command Command) {
	t.Helper()
	command.Type, command.Round = "combat", room.Run.CombatRound.Number
	for _, playerID := range eligibleCombatPlayers(room) {
		if err := ApplyCommand(room, playerID, command, expeditionNow); err != nil {
			t.Fatal(err)
		}
	}
}

func hasEvent(run *Run, kind string) bool {
	for _, event := range run.LastCombatEvents {
		if event.Kind == kind {
			return true
		}
	}
	return false
}

func TestDungeonBossIsTougherThanAFloorGuardian(t *testing.T) {
	_, guardianFloor := generateExpeditionFloor("catacombs", 5, 4, 5, 1, nil)
	_, finalFloor := generateExpeditionFloor("catacombs", 5, 4, 4, 1, nil)
	plain := newCatalogEncounter("depth-boss-warden", "x-", MonsterScaling{Depth: 4, PartySize: 1})
	final := finalFloor["d4-boss"].Encounter.Enemies[0]
	if final.MaxHealth != (plain.Enemies[0].MaxHealth*(100+FinalBossHealthPercent)+50)/100 {
		t.Fatalf("dungeon boss health %d, plain %d", final.MaxHealth, plain.Enemies[0].MaxHealth)
	}
	if len(guardianFloor["d4-boss"].Encounter.Enemies[0].Mechanics) != 0 || !final.hasMechanic(BossMechanicEnrage) || !final.hasMechanic(BossMechanicSummon) {
		t.Fatalf("mechanics: guardian=%v final=%v", guardianFloor["d4-boss"].Encounter.Enemies[0].Mechanics, final.Mechanics)
	}
}

func TestDungeonBossEnragesAndSummonsOnce(t *testing.T) {
	room, boss := finalBossRoom(t, "catacombs", 1)
	run := room.Run
	encounter := run.Rooms[run.CurrentRoomID].Encounter
	if boss.Enraged || len(encounter.Enemies) != 1 || boss.SummonsLeft != 1 {
		t.Fatalf("a fresh boss should be calm and alone: %+v", boss)
	}
	boss.Health = boss.MaxHealth * (BossSummonHealthPercent - 5) / 100 // its drain heals a little each round
	bossRound(t, room, Command{Action: "defend"})
	boss = &encounter.Enemies[0]
	if len(encounter.Enemies) != 2 || !encounter.Enemies[1].Summoned || encounter.Enemies[1].DefinitionID != "gravebound-scout" || encounter.Enemies[1].Intent == nil || !hasEvent(run, "boss_summon") {
		t.Fatalf("at %d%% health the boss should call a reinforcement that acts this round: %+v", BossSummonHealthPercent, encounter.Enemies)
	}
	if boss.Enraged || boss.SummonsLeft != 0 {
		t.Fatalf("not yet enraged, no summons left: %+v", boss)
	}
	calm := boss.Intent.Damage
	turn := boss.TurnsTaken
	boss.Health = boss.MaxHealth * (BossEnrageHealthPercent - 5) / 100
	bossRound(t, room, Command{Action: "defend"})
	boss = &encounter.Enemies[0]
	if !boss.Enraged || boss.DamageBonus != BossEnrageDamageBonus || !hasEvent(run, "boss_enrage") || len(encounter.Enemies) != 2 {
		t.Fatalf("the boss should enrage once and not summon again: %+v", boss)
	}
	plain := buildEnemyIntent(boss, boss.TurnsTaken, 0, []string{"player-1"}).Damage
	if boss.Intent.Damage != plain+BossEnrageDamageBonus || boss.TurnsTaken != turn+1 {
		t.Fatalf("enraged telegraph %d, want %d (calm was %d)", boss.Intent.Damage, plain+BossEnrageDamageBonus, calm)
	}
	bossRound(t, room, Command{Action: "defend"})
	if encounter.Enemies[0].DamageBonus != BossEnrageDamageBonus {
		t.Fatal("enrage must not stack")
	}

	// The reinforcement has to fall too before the dungeon is cleared.
	encounter.Enemies[0].Health = 1
	bossRound(t, room, Command{Action: "skill", Skill: SkillStrike, TargetID: encounter.Enemies[0].ID})
	if run.Phase != PhaseCombat || encounter.Status != EncounterActive {
		t.Fatal("the fight should continue while the reinforcement stands")
	}
	encounter.Enemies[1].Health = 1
	bossRound(t, room, Command{Action: "skill", Skill: SkillStrike, TargetID: encounter.Enemies[1].ID})
	if run.Phase != PhaseIntermission || run.DungeonsCleared != 1 || run.Camp == nil || len(run.Camp.Choices) != DungeonChoiceCount {
		t.Fatalf("the dungeon boss should lead to the camp and its crossroads: phase=%s camp=%+v", run.Phase, run.Camp)
	}
}

func TestDungeonBossBarrierAbsorbsStrikesButNotAbilities(t *testing.T) {
	room, boss := finalBossRoom(t, "clockwork", 2)
	run := room.Run
	wantBarrier := BossBarrierBase + 2*BossBarrierPerPlayer
	if boss.Barrier != wantBarrier || !hasEvent(run, "boss_barrier") {
		t.Fatalf("the barrier goes up on turn 1: %d, want %d", boss.Barrier, wantBarrier)
	}
	health := boss.Health
	boss.Intent.Heal = 0 // keep the Clockmaker's drain out of the arithmetic
	bossRound(t, room, Command{Action: "skill", Skill: SkillStrike, TargetID: boss.ID})
	// Two Strikes of 6: the first is absorbed whole, the second breaks through.
	if dealt, want := health-boss.Health, 2*PlayerStrikeDamage-wantBarrier; dealt != want || boss.Barrier != 0 {
		t.Fatalf("strikes dealt %d through the barrier, want %d (barrier left %d)", dealt, want, boss.Barrier)
	}
	bossRound(t, room, Command{Action: "defend"})
	bossRound(t, room, Command{Action: "defend"})
	if boss.TurnsTaken != 4 || boss.Barrier != wantBarrier {
		t.Fatalf("the barrier returns every %d turns: turn %d barrier %d", BossBarrierEveryTurns, boss.TurnsTaken, boss.Barrier)
	}

	classRoom := newPartyRoom(1)
	classRoom.PlayerClasses = map[string]string{"player-1": "assassin"}
	if err := StartMultiLevelRunForTheme(classRoom, "barrier-class", "clockwork", expeditionNow); err != nil {
		t.Fatal(err)
	}
	classRun := classRoom.Run
	target := &classRun.Rooms["d1-entry"].Encounter.Enemies[0]
	target.Barrier, target.BarrierLabel, target.Health, target.MaxHealth = 50, "Test Barrier", 200, 200
	if err := ApplyCommand(classRoom, "player-1", Command{Type: "combat", Round: classRun.CombatRound.Number, Action: "skill", Skill: "assassin.exploit-weakness", TargetID: target.ID}, expeditionNow); err != nil {
		t.Fatal(err)
	}
	if target.Barrier != 50 || target.Health == 200 {
		t.Fatalf("a non-basic skill should pierce the barrier: barrier=%d health=%d", target.Barrier, target.Health)
	}
}

func TestDungeonBossCataclysmCanBeInterrupted(t *testing.T) {
	room, boss := finalBossRoom(t, "ghosttown", 2)
	run := room.Run
	for boss.TurnsTaken < BossCataclysmEveryTurns {
		if boss.Intent.Kind == "cataclysm" {
			t.Fatalf("cataclysm on turn %d", boss.TurnsTaken)
		}
		bossRound(t, room, Command{Action: "defend"})
		boss = &run.Rooms[run.CurrentRoomID].Encounter.Enemies[0]
	}
	step := PartyEnemyDamageMultiplierStep
	want := int(float64(BossCataclysmDamage)*(1+step) + 0.5)
	if boss.Intent.Kind != "cataclysm" || boss.Intent.Label != "High Noon" || !boss.Intent.TargetAll || !boss.Intent.Interruptible || boss.Intent.Damage != want {
		t.Fatalf("turn %d should telegraph the cataclysm: %+v", boss.TurnsTaken, boss.Intent)
	}
	before := run.Players["player-1"].Health + run.Players["player-2"].Health
	run.Players["player-1"].Skills = append(run.Players["player-1"].Skills, "ranger.pinning-shot")
	if err := ApplyCommand(room, "player-1", Command{Type: "combat", Round: run.CombatRound.Number, Action: "skill", Skill: "ranger.pinning-shot", TargetID: boss.ID}, expeditionNow); err != nil {
		t.Fatal(err)
	}
	if err := ApplyCommand(room, "player-2", Command{Type: "combat", Round: run.CombatRound.Number, Action: "skill", Skill: SkillStrike, TargetID: boss.ID}, expeditionNow); err != nil {
		t.Fatal(err)
	}
	if after := run.Players["player-1"].Health + run.Players["player-2"].Health; after != before {
		t.Fatalf("an interrupted cataclysm must deal no damage, party lost %d", before-after)
	}
	for boss.TurnsTaken < 2*BossCataclysmEveryTurns {
		bossRound(t, room, Command{Action: "defend"})
		boss = &run.Rooms[run.CurrentRoomID].Encounter.Enemies[0]
	}
	before = run.Players["player-1"].Health + run.Players["player-2"].Health
	bossRound(t, room, Command{Action: "skill", Skill: SkillStrike, TargetID: boss.ID})
	if after := run.Players["player-1"].Health + run.Players["player-2"].Health; before-after < 2*(want-1) {
		t.Fatalf("an unanswered cataclysm should hit everyone, party lost %d", before-after)
	}
}

// Every discovery choice that gives something takes something, the trade is stated in the choice, and no cost
// paid outside combat can end the run.
func TestDiscoveryChoicesAreTradeOffs(t *testing.T) {
	for _, effect := range discoveryEffects() {
		if effect.Summary == "" || effect.Outcome == "" || (effect.Chance > 0 && effect.FailOutcome == "") {
			t.Errorf("effect %q does not explain itself", effect.ID)
		}
		if effect.Chance > 0 || effect.ID == "vault_coin" || effect.ID == "herb_cache" {
			continue // a gamble's price is its failure; the vault's coin is the safe half of a gamble
		}
		gives, takes := false, false
		for _, operation := range effect.Operations {
			switch {
			case operation.Kind == RunEffectPartyDamage || operation.Kind == RunEffectFloorModifier || operation.Amount < 0:
				takes = true
			default:
				gives = true
			}
		}
		if !gives || !takes {
			t.Errorf("effect %q must both give and take (gives=%v takes=%v)", effect.ID, gives, takes)
		}
	}

	apply := func(effectID string, mutate func(*Run)) (*Run, string) {
		room := startExpedition(t, 2, "sunken", "discovery-"+effectID)
		run := room.Run
		run.CurrentRoomID = "d1-test"
		run.Rooms["d1-test"] = &DungeonRoom{ID: "d1-test", Exits: []Exit{{ID: "on", Destination: "d1-guard"}}, Event: &RoomEvent{ID: "e", Choices: []EventChoice{{ID: "take", Description: "choice text", Effect: effectID}}}}
		run.Phase = PhaseExploring
		run.CombatRound = nil
		if mutate != nil {
			mutate(run)
		}
		if err := ApplyCommand(room, "player-1", Command{Type: "choose_event", ChoiceID: "take"}, expeditionNow); err != nil {
			t.Fatalf("%s: %v", effectID, err)
		}
		return run, run.Rooms["d1-test"].Event.Result
	}

	run, result := apply("blood_pact", func(run *Run) { run.Players["player-2"].Health = 3 })
	if p1, p2 := run.Players["player-1"], run.Players["player-2"]; p1.Health != 24 || p2.Health != 1 || p1.StrikeDamage != PlayerStrikeDamage+2 || !strings.Contains(result, "blood") {
		t.Fatalf("blood pact: p1=%+v p2 health=%d result=%q", p1, p2.Health, result)
	}
	run, _ = apply("heavy_plate", nil)
	if p := run.Players["player-1"]; p.GuardReduction != GuardDamageReduction+2 || p.StrikeDamage != PlayerStrikeDamage-1 {
		t.Fatalf("heavy plate: %+v", p)
	}
	run, _ = apply("greedy_haul", nil)
	if p := run.Players["player-2"]; p.Gold != 25 || p.MaxHealth != 27 || p.Health != 27 {
		t.Fatalf("greedy haul: %+v", p)
	}
	run, _ = apply("uneasy_rest", func(run *Run) { run.Players["player-1"].Health = 5 })
	if run.Players["player-1"].Health != 15 || len(run.FloorModifiers) != 1 || run.FloorModifiers[0].ID != "alerted" || floorRulesFor(run).EnemyDamage != 1 {
		t.Fatalf("uneasy rest: health=%d modifiers=%+v", run.Players["player-1"].Health, run.FloorModifiers)
	}
	run, result = apply("leave", nil)
	if run.Players["player-1"].Health != 30 || result != "choice text" {
		t.Fatalf("leaving should change nothing and keep the choice's text, got %q", result)
	}

	// Gambles go both ways, depend only on the run and the room, and say which way they went.
	wins, losses := 0, 0
	for i := 0; i < 200; i++ {
		outcome := func() (int, string) {
			room := startExpedition(t, 1, "sunken", fmt.Sprintf("gamble-%d", i))
			run := room.Run
			run.CurrentRoomID = "d1-test"
			run.Rooms["d1-test"] = &DungeonRoom{ID: "d1-test", Exits: []Exit{{ID: "on", Destination: "d1-guard"}}, Event: &RoomEvent{ID: "e", Choices: []EventChoice{{ID: "take", Effect: "trapped_cache"}}}}
			run.Phase = PhaseExploring
			run.Players["player-1"].Health = 4
			if err := ApplyCommand(room, "player-1", Command{Type: "choose_event", ChoiceID: "take"}, expeditionNow); err != nil {
				t.Fatal(err)
			}
			if run.Players["player-1"].Health < 1 {
				t.Fatal("a sprung trap must not kill")
			}
			return run.Players["player-1"].Gold, run.Rooms["d1-test"].Event.Result
		}
		gold, text := outcome()
		goldAgain, _ := outcome()
		if gold != goldAgain {
			t.Fatal("a gamble must be deterministic for a given run and room")
		}
		if gold == 40 && strings.Contains(text, "lock gives") {
			wins++
		} else if gold == 0 && strings.Contains(text, "trap") {
			losses++
		} else {
			t.Fatalf("gamble gave %d gold and said %q", gold, text)
		}
	}
	if wins < 85 || wins > 135 {
		t.Fatalf("a 55%% gamble won %d of 200", wins)
	}
	_ = losses
}

func TestLegacyRunsKeepTheirRules(t *testing.T) {
	// A run persisted before expeditions has no generator field. It keeps its three floors, its restore-or-perk
	// choice, and generates its remaining floors from the old templates.
	var run Run
	if err := json.Unmarshal([]byte(`{"id":"old","themeId":"scifi","seed":77,"depth":1,"maxDepth":3,"phase":"combat","currentRoomId":"d1-boss","rooms":{},"players":{"player-1":{"id":"player-1","health":30,"maxHealth":30,"strikeDamage":6,"guardReduction":4}}}`), &run); err != nil {
		t.Fatal(err)
	}
	room := newTestRoom()
	room.Run = &run
	_, rooms := generateFloorForTheme("scifi", 77, 1, 1)
	run.Rooms = rooms
	startCombatRound(room, expeditionNow)
	defeatCurrentEncounter(t, room)
	if run.Phase != PhaseIntermission || !run.PendingInterFloorChoice || run.Camp != nil || run.Players["player-1"].Gold != 0 {
		t.Fatalf("legacy run should reach the old choice: phase=%s camp=%v", run.Phase, run.Camp)
	}
	if err := ApplyCommand(room, "player-1", Command{Type: "ready"}, expeditionNow); !errors.Is(err, ErrInvalidPhase) {
		t.Fatalf("camp commands must not apply to legacy runs: %v", err)
	}
	if err := ApplyCommand(room, "player-1", Command{Type: "choose_inter_floor", ChoiceID: "restore"}, expeditionNow); err != nil {
		t.Fatal(err)
	}
	if run.Depth != 2 || run.Rooms["d2-shrine"] == nil || len(run.FloorModifiers) != 0 {
		t.Fatalf("legacy descent should build an old-template floor: depth=%d", run.Depth)
	}
}

func TestRunProgressXPRewardsDistance(t *testing.T) {
	room := startExpedition(t, 1, "catacombs", "xp-run")
	run := room.Run
	if RunProgressXP(run) != 0 {
		t.Fatal("a run in progress is worth nothing yet")
	}
	defeatCurrentEncounter(t, room)
	run.Phase = PhaseFailed
	if got := RunProgressXP(run); got != RunXPPerEncounter {
		t.Fatalf("one fight won is worth %d, got %d", RunXPPerEncounter, got)
	}
	// Rooms of finished dungeons are gone from the snapshot; the counters still pay for them.
	run.Rooms = map[string]*DungeonRoom{}
	run.EncountersCleared, run.FloorsCleared, run.DungeonsCleared = 30, 6, 1
	if got, want := RunProgressXP(run), int64(30*RunXPPerEncounter+6*RunXPPerFloor+RunXPPerDungeon); got != want {
		t.Fatalf("a deep expedition is worth %d, got %d", want, got)
	}
	fresh := startExpedition(t, 1, "catacombs", "xp-none")
	fresh.Run.Phase = PhaseFailed
	if RunProgressXP(fresh.Run) != 0 {
		t.Fatal("a run that won no fight earns nothing")
	}
	legacy := &Run{Phase: PhaseCompleted, Rooms: map[string]*DungeonRoom{"a": {Encounter: &Encounter{Status: EncounterCleared}}, "b": {Encounter: &Encounter{Status: EncounterActive}}}}
	if got := RunProgressXP(legacy); got != RunXPPerEncounter+RunXPCompletionBonus {
		t.Fatalf("a completed older run is worth %d, got %d", RunXPPerEncounter+RunXPCompletionBonus, got)
	}
}

func TestRunProgressOfBreaksTheXPDown(t *testing.T) {
	run := &Run{Phase: PhaseCompleted, Rooms: map[string]*DungeonRoom{}, EncountersCleared: 7, FloorsCleared: 3, DungeonsCleared: 1}
	got := RunProgressOf(run)
	want := RunProgress{XP: int64(7*RunXPPerEncounter + 3*RunXPPerFloor + RunXPPerDungeon + RunXPCompletionBonus), Encounters: 7, Floors: 3, Dungeons: 1, CompletionBonus: RunXPCompletionBonus}
	if got == nil || *got != want {
		t.Fatalf("breakdown = %+v, want %+v", got, want)
	}
	if got.XP != RunProgressXP(run) {
		t.Fatal("the breakdown must add up to what is awarded")
	}
	run.Phase = PhaseExploring
	if RunProgressOf(run) != nil {
		t.Fatal("a run in progress has no breakdown yet")
	}
}

func TestShopStillWorksAfterTheCampIsSavedAndReloaded(t *testing.T) {
	room := openTestShop(t, 2, "shop-reload")
	data, err := json.Marshal(room.Run.Camp)
	if err != nil {
		t.Fatal(err)
	}
	var reloaded Camp
	if err := json.Unmarshal(data, &reloaded); err != nil {
		t.Fatal(err)
	}
	if reloaded.Purchases != nil || reloaded.Ready != nil {
		t.Fatal("expected an untouched camp to reload without its maps, as the store does")
	}
	room.Run.Camp = &reloaded
	buyer := room.Run.Players["player-1"]
	buyer.Gold = 100
	if err := ApplyCommand(room, "player-1", Command{Type: "buy", ChoiceID: "whetstone"}, expeditionNow); err != nil {
		t.Fatalf("buying at a reloaded camp: %v", err)
	}
	if err := ApplyCommand(room, "player-1", Command{Type: "ready"}, expeditionNow); err != nil {
		t.Fatalf("readying at a reloaded camp: %v", err)
	}
	if !room.Run.Camp.Ready["player-1"] || len(room.Run.Camp.Purchases["player-1"]) != 1 {
		t.Fatalf("purchase or ready was lost: %+v", room.Run.Camp)
	}
}

func TestPermanentStrikeUpgradesAreCappedAndWhetstonesScaleWithDepth(t *testing.T) {
	room := openTestShop(t, 1, "strike-cap-run")
	player := room.Run.Players["player-1"]
	player.Gold = 10000
	room.Run.Camp.Offers = []ShopItem{{ID: "whetstone", Name: "Whetstone", Kind: ShopStrike, Amount: 1, Price: 30}}
	for bonus := 0; bonus < MaxPermanentStrikeBonus; bonus++ {
		room.Run.Camp.Purchases["player-1"] = nil
		if err := buyShopItem(room, "player-1", "whetstone"); err != nil {
			t.Fatalf("buy upgrade %d: %v", bonus+1, err)
		}
	}
	if got, want := player.StrikeDamage, PlayerStrikeDamage+MaxPermanentStrikeBonus; got != want {
		t.Fatalf("Strike damage = %d, want cap %d", got, want)
	}
	room.Run.Camp.Purchases["player-1"] = nil
	if err := buyShopItem(room, "player-1", "whetstone"); !errors.Is(err, ErrItemUnavailable) {
		t.Fatalf("buying beyond the permanent Strike cap: %v", err)
	}

	depths := []int{1, 2, 4, 8}
	prices := make([]int, 0, len(depths))
	for _, depth := range depths {
		prices = append(prices, shopItemPriceAtDepth(ShopItem{Kind: ShopStrike, Price: 30}, depth))
	}
	if prices[0] != 30 || prices[1] != 42 {
		t.Fatalf("unexpected early Whetstone prices: %v", prices)
	}
	for i := 1; i < len(prices); i++ {
		if prices[i] <= prices[i-1] {
			t.Fatalf("Whetstone prices should rise with depth: %v", prices)
		}
	}
}

func TestGoldScalingTapersOffInLongExpeditions(t *testing.T) {
	if got, want := EncounterGold(5, 100), EncounterGold(5, 8); got != want {
		t.Fatalf("encounter gold should stop scaling after depth 8: got %d, want %d", got, want)
	}
	if got, want := (&Minigame{Depth: 100}).stake(100), (&Minigame{Depth: 9}).stake(100); got != want {
		t.Fatalf("mini-game gold should stop scaling after depth 9: got %d, want %d", got, want)
	}
	if got := (&Minigame{Depth: 9}).stake(100); got != 164 {
		t.Fatalf("depth 9 mini-game multiplier = %d, want 164", got)
	}
}
