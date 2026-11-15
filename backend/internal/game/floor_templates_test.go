package game

import (
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/swarkentin/heart-of-the-beast/backend/internal/art"
)

func TestDefaultFloorTemplatesValidate(t *testing.T) {
	if err := defaultFloorTemplateCatalog.Validate(defaultDungeonThemeCatalog, defaultEncounterCatalog, defaultMonsterCatalog); err != nil {
		t.Fatalf("default floor templates are invalid: %v", err)
	}
}

func TestFloorTemplateCatalogRejectsInconsistentContent(t *testing.T) {
	cases := map[string]func(*FloorTemplate){
		"encounter from another theme": func(f *FloorTemplate) { f.GuardEncounterID = "catacombs-warden-gate" },
		"unknown encounter":            func(f *FloorTemplate) { f.EntryEncounterID = "nope" },
		"boss encounter without boss":  func(f *FloorTemplate) { f.Bosses = []FloorBossTemplate{{RoomName: "x", EncounterID: "scifi-outpost"}} },
		"unknown event effect":         func(f *FloorTemplate) { f.ShrineEvents[0].Choices[0].Effect = "free_gold" },
		"no bosses":                    func(f *FloorTemplate) { f.Bosses = nil },
	}
	for name, mutate := range cases {
		t.Run(name, func(t *testing.T) {
			template := scifiFloorTemplate()
			mutate(&template)
			catalog := FloorTemplateCatalog{Templates: map[string]FloorTemplate{"scifi": template, "catacombs": catacombsFloorTemplate()}}
			if err := catalog.Validate(defaultDungeonThemeCatalog, defaultEncounterCatalog, defaultMonsterCatalog); err == nil {
				t.Fatal("expected validation to fail")
			}
		})
	}
	t.Run("playable theme without a template", func(t *testing.T) {
		catalog := FloorTemplateCatalog{Templates: map[string]FloorTemplate{"catacombs": catacombsFloorTemplate()}}
		if err := catalog.Validate(defaultDungeonThemeCatalog, defaultEncounterCatalog, defaultMonsterCatalog); err == nil {
			t.Fatal("expected a playable theme without a template to be rejected")
		}
	})
}

// Floors for the original theme must stay exactly as they were before floor generation became data-driven.
// The fingerprint covers 400 seeds x 3 depths x 4 party sizes, ignoring the later-added themeId field. Change it
// only as a deliberate Catacombs content migration.
func TestCatacombsFloorsAreUnchangedByThemedGeneration(t *testing.T) {
	const golden = "1e7c2fcc8fffe87e65216f1735afd8beb1b6ca25d07c3345129ebc717fb54588"
	hash := sha256.New()
	for seed := uint64(1); seed <= 400; seed++ {
		for depth := 1; depth <= 3; depth++ {
			for party := 1; party <= 4; party++ {
				entry, rooms := generateDungeonFloor(seed*7919, depth, party)
				ids := make([]string, 0, len(rooms))
				for id, room := range rooms {
					ids = append(ids, id)
					room.ThemeID = ""
				}
				sort.Strings(ids)
				hash.Write([]byte(entry))
				for _, id := range ids {
					encoded, _ := json.Marshal(rooms[id])
					hash.Write(encoded)
				}
			}
		}
	}
	if got := fmt.Sprintf("%x", hash.Sum(nil)); got != golden {
		t.Fatalf("Catacombs floor generation changed: fingerprint %s, want %s", got, golden)
	}
}

func playableThemeIDs() []string {
	var ids []string
	for _, id := range defaultDungeonThemeCatalog.IDs() {
		if theme, _ := defaultDungeonThemeCatalog.Theme(id); theme.Playable {
			ids = append(ids, id)
		}
	}
	return ids
}

// Every playable theme must produce small, fully connected, deterministic floors with the right boss, whatever
// the seed, depth and party size.
func TestThemedFloorsAreConnectedBoundedDeterministicAndThemed(t *testing.T) {
	for _, themeID := range playableThemeIDs() {
		template, err := defaultFloorTemplateCatalog.Template(themeID)
		if err != nil {
			t.Fatal(err)
		}
		theme, _ := defaultDungeonThemeCatalog.Theme(themeID)
		reached := map[string]bool{}
		minibosses := 0
		for seed := uint64(1); seed <= 300; seed++ {
			for depth := InitialDungeonDepth; depth <= MaximumDungeonDepth; depth++ {
				for party := 1; party <= 4; party++ {
					where := fmt.Sprintf("%s seed=%d depth=%d party=%d", themeID, seed, depth, party)
					entry, rooms := generateFloorForTheme(themeID, seed, depth, party)
					entryB, roomsB := generateFloorForTheme(themeID, seed, depth, party)
					a, _ := json.Marshal(rooms)
					b, _ := json.Marshal(roomsB)
					if entry != entryB || string(a) != string(b) {
						t.Fatalf("%s: generation is not deterministic", where)
					}
					if len(rooms) < 6 || len(rooms) > 9 {
						t.Fatalf("%s: %d rooms, want 6-9", where, len(rooms))
					}
					visited := map[string]bool{entry: true}
					queue := []string{entry}
					bosses := 0
					for len(queue) > 0 {
						id := queue[0]
						queue = queue[1:]
						room := rooms[id]
						if room == nil {
							t.Fatalf("%s: missing room %q", where, id)
						}
						if room.ID != id || room.ThemeID != themeID {
							t.Fatalf("%s: room %q has id=%q theme=%q", where, id, room.ID, room.ThemeID)
						}
						if !strings.HasPrefix(id, fmt.Sprintf("d%d-", depth)) {
							t.Fatalf("%s: room id %q is not scoped to its floor", where, id)
						}
						if room.RoomType == "boss" {
							bosses++
							if len(room.Exits) != 0 {
								t.Fatalf("%s: boss room has exits", where)
							}
						} else if len(room.Exits) == 0 {
							t.Fatalf("%s: dead-end room %q is not the boss room", where, id)
						}
						if room.RoomType == "miniboss" {
							minibosses++
						}
						if room.Encounter != nil {
							reached[room.Encounter.DefinitionID] = true
							for _, enemy := range room.Encounter.Enemies {
								definition, err := defaultMonsterCatalog.Monster(enemy.DefinitionID)
								if err != nil {
									t.Fatalf("%s: %v", where, err)
								}
								if monsterTheme, _ := art.ThemeOf(definition.Sprite); monsterTheme != theme.Art {
									t.Fatalf("%s: %q spawns %q from art theme %q", where, id, enemy.DefinitionID, monsterTheme)
								}
							}
						}
						for _, exit := range room.Exits {
							if !visited[exit.Destination] {
								visited[exit.Destination] = true
								queue = append(queue, exit.Destination)
							}
						}
					}
					if len(visited) != len(rooms) || bosses != 1 {
						t.Fatalf("%s: reached %d of %d rooms with %d boss rooms", where, len(visited), len(rooms), bosses)
					}
					if want := template.bossForDepth(depth); rooms[fmt.Sprintf("d%d-boss", depth)].Encounter.DefinitionID != want.EncounterID {
						t.Fatalf("%s: boss encounter %q, want %q", where, rooms[fmt.Sprintf("d%d-boss", depth)].Encounter.DefinitionID, want.EncounterID)
					}
				}
			}
		}
		for _, id := range template.encounterIDs() {
			if !reached[id] {
				t.Errorf("theme %q: encounter %q is never placed on any floor", themeID, id)
			}
		}
		if minibosses == 0 {
			t.Errorf("theme %q never generated a miniboss room", themeID)
		}
	}
}

func TestSciFiBossesProgressWithDepthAndEndWithTheOverseer(t *testing.T) {
	want := map[int]string{1: "scifi-boss-containment-mech", 2: "scifi-boss-patient-zero", 3: "scifi-boss-overseer-core"}
	for depth, encounterID := range want {
		_, rooms := generateFloorForTheme("scifi", 99, depth, 2)
		if got := rooms[fmt.Sprintf("d%d-boss", depth)].Encounter.DefinitionID; got != encounterID {
			t.Errorf("depth %d: boss encounter %q, want %q", depth, got, encounterID)
		}
	}
}

func TestSciFiAndCatacombsFloorsDiffer(t *testing.T) {
	_, catacombs := generateFloorForTheme("catacombs", 7, 1, 2)
	_, scifi := generateFloorForTheme("scifi", 7, 1, 2)
	if catacombs["d1-entry"].Name == scifi["d1-entry"].Name || scifi["d1-entry"].ThemeID != "scifi" {
		t.Fatal("themes should produce distinct, correctly themed floors")
	}
}

func TestStartRunInAThemeUsesItsFirstFloorAndRecordsTheTheme(t *testing.T) {
	now := time.Date(2026, 11, 15, 12, 0, 0, 0, time.UTC)

	room := newTestRoom()
	if err := StartMultiLevelRunForTheme(room, "scifi-run", "scifi", now); err != nil {
		t.Fatal(err)
	}
	run := room.Run
	if run.ThemeID != "scifi" || run.Theme() != "scifi" || run.Depth != 1 || run.MaxDepth != MaximumDungeonDepth || run.Seed == 0 {
		t.Fatalf("unexpected run metadata: %+v", run)
	}
	if run.CurrentRoomID != "d1-entry" || run.Phase != PhaseCombat || run.CombatRound == nil {
		t.Fatalf("scifi run should start in combat in its generated entry room, got room=%q phase=%s", run.CurrentRoomID, run.Phase)
	}
	for id, dungeonRoom := range run.Rooms {
		if dungeonRoom.ThemeID != "scifi" {
			t.Errorf("room %q theme %q", id, dungeonRoom.ThemeID)
		}
	}
	encoded, _ := json.Marshal(run)
	if !strings.Contains(string(encoded), `"themeId":"scifi"`) {
		t.Fatal("themeId must be part of the run snapshot")
	}

	for _, themeID := range []string{"", "catacombs"} {
		room := newTestRoom()
		if err := StartMultiLevelRunForTheme(room, "default-run", themeID, now); err != nil {
			t.Fatal(err)
		}
		if room.Run.Theme() != "catacombs" || room.Run.ThemeID != "catacombs" || room.Run.CurrentRoomID != "entry" || room.Run.Rooms["warden"].ThemeID != "catacombs" {
			t.Fatalf("theme %q should start the authored Catacombs floor", themeID)
		}
	}
}

func TestStartRunRejectsUnknownAndUnplayableThemes(t *testing.T) {
	now := time.Date(2026, 11, 15, 12, 0, 0, 0, time.UTC)
	for themeID, want := range map[string]error{"atlantis": ErrUnknownDungeonTheme, "sunken": ErrThemeNotPlayable} {
		room := newTestRoom()
		err := StartMultiLevelRunForTheme(room, "run", themeID, now)
		if !errors.Is(err, want) || room.Run != nil {
			t.Errorf("theme %q: err=%v run=%v, want %v and no run", themeID, err, room.Run, want)
		}
	}
	room := newTestRoom()
	if err := StartMultiLevelRunForTheme(room, "run", "scifi", now); err != nil {
		t.Fatal(err)
	}
	if err := StartMultiLevelRunForTheme(room, "run-2", "scifi", now); !errors.Is(err, ErrRunAlreadyStarted) {
		t.Fatalf("starting twice: %v", err)
	}
}

func TestRunsPersistedWithoutAThemeAreCatacombs(t *testing.T) {
	var run Run
	if err := json.Unmarshal([]byte(`{"id":"old","phase":"combat","currentRoomId":"entry","rooms":{"entry":{"id":"entry","name":"x"}}}`), &run); err != nil {
		t.Fatal(err)
	}
	if run.Theme() != "catacombs" {
		t.Fatalf("legacy run theme = %q", run.Theme())
	}
	var nilRun *Run
	if nilRun.Theme() != "catacombs" {
		t.Fatal("nil run should default to catacombs")
	}
}

// A Sci-Fi run descends through generated Sci-Fi floors and ends with the Sci-Fi victory message.
func TestSciFiRunDescendsThroughThemedFloorsToVictory(t *testing.T) {
	now := time.Date(2026, 11, 15, 12, 0, 0, 0, time.UTC)
	room := newTestRoom()
	if err := StartMultiLevelRunForTheme(room, "scifi-descent", "scifi", now); err != nil {
		t.Fatal(err)
	}
	run := room.Run
	for depth := 1; depth <= MaximumDungeonDepth; depth++ {
		boss := run.Rooms[fmt.Sprintf("d%d-boss", depth)]
		run.CurrentRoomID = boss.ID
		run.Phase = PhaseCombat
		for i := range boss.Encounter.Enemies {
			boss.Encounter.Enemies[i].Health = 1
		}
		startCombatRound(room, now)
		if err := ApplyCommand(room, "player-1", Command{Type: "combat", Round: run.CombatRound.Number, Action: "attack", TargetID: boss.Encounter.Enemies[0].ID}, now); err != nil {
			t.Fatalf("depth %d: %v", depth, err)
		}
		if depth < MaximumDungeonDepth {
			if run.Phase != PhaseIntermission {
				t.Fatalf("depth %d: phase %s, want intermission", depth, run.Phase)
			}
			if err := ApplyCommand(room, "player-1", Command{Type: "choose_inter_floor", ChoiceID: "restore"}, now); err != nil {
				t.Fatal(err)
			}
			if run.Depth != depth+1 || run.ThemeID != "scifi" || run.Rooms[fmt.Sprintf("d%d-entry", depth+1)].ThemeID != "scifi" {
				t.Fatalf("descent after depth %d left the theme: depth=%d theme=%q", depth, run.Depth, run.ThemeID)
			}
		}
	}
	if run.Phase != PhaseCompleted {
		t.Fatalf("final boss should complete the run, phase=%s", run.Phase)
	}
	last := run.LastCombatEvents[len(run.LastCombatEvents)-1]
	foundVictory := false
	for _, event := range run.LastCombatEvents {
		if event.Kind == "victory" && strings.Contains(event.Message, "research facility") {
			foundVictory = true
		}
	}
	if !foundVictory {
		t.Fatalf("expected a themed victory message, last event %+v", last)
	}
}
