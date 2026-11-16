package game

import (
	"fmt"
	"strings"
	"testing"
)

func TestReinforcementsGrowEncountersWithThePartyByShape(t *testing.T) {
	tests := []struct {
		encounterID string
		want        [MaxEncounterPartySize]int // enemies met by parties of one to four
	}{
		{"scifi-outpost", [MaxEncounterPartySize]int{1, 2, 2, 3}},
		{"scifi-ambush", [MaxEncounterPartySize]int{2, 3, 4, 5}},
		{"scifi-boss-overseer-core", [MaxEncounterPartySize]int{1, 1, 2, 3}},
		{"depth-guard", [MaxEncounterPartySize]int{2, 3, 4, 5}},
	}
	for _, test := range tests {
		definition, err := defaultEncounterCatalog.Encounter(test.encounterID)
		if err != nil {
			t.Fatal(err)
		}
		for partySize := 1; partySize <= MaxEncounterPartySize; partySize++ {
			encounter, err := defaultEncounterCatalog.Instantiate(test.encounterID, "t-", MonsterScaling{Depth: 1, PartySize: partySize})
			if err != nil {
				t.Fatal(err)
			}
			if got := len(encounter.Enemies); got != test.want[partySize-1] || got != definition.SpawnCount(partySize) {
				t.Errorf("%s for a party of %d spawns %d enemies (SpawnCount %d), want %d", test.encounterID, partySize, got, definition.SpawnCount(partySize), test.want[partySize-1])
			}
			// Gold follows the authored budget, so a larger party is not paid more for each extra minion.
			if encounter.Budget != definition.Budget {
				t.Errorf("%s budget for a party of %d = %d, want the authored %d", test.encounterID, partySize, encounter.Budget, definition.Budget)
			}
		}
	}
}

func TestReinforcementsComeFromTheEncountersOwnTheme(t *testing.T) {
	themeOf := make(map[string]string)
	for _, definition := range defaultEncounterCatalog.Encounters {
		for _, spawn := range definition.Enemies {
			if !spawn.isReinforcement() {
				themeOf[spawn.MonsterID] = definition.ThemeID
			}
		}
	}
	for id, definition := range defaultEncounterCatalog.Encounters {
		for _, spawn := range definition.Enemies {
			if !spawn.isReinforcement() {
				continue
			}
			if theme, ok := themeOf[spawn.MonsterID]; ok && theme != definition.ThemeID {
				t.Errorf("encounter %q (theme %s) is reinforced by %q from theme %s", id, definition.ThemeID, spawn.MonsterID, theme)
			}
			if !strings.HasPrefix(spawn.ID, "reinforcement-") {
				t.Errorf("encounter %q reinforcement slot %q should be named reinforcement-N", id, spawn.ID)
			}
		}
	}
	for themeID := range themeReinforcements {
		if _, err := defaultDungeonThemeCatalog.Theme(themeID); err != nil {
			t.Errorf("reinforcements are listed for unknown theme %q", themeID)
		}
	}
}

func TestEncounterValidationRejectsOversizedAndReinforcementOnlyFights(t *testing.T) {
	oversized := EncounterDefinition{ID: "broken", ThemeID: "catacombs", Budget: 2, Enemies: []EncounterMonsterDefinition{{ID: "base", MonsterID: "scout", BudgetCost: 2}}}
	for i := 0; i < MaxEncounterEnemies; i++ {
		oversized.Enemies = append(oversized.Enemies, EncounterMonsterDefinition{ID: fmt.Sprintf("extra-%d", i), MonsterID: "scout", BudgetCost: 2, MinPartySize: 4})
	}
	tests := map[string]EncounterDefinition{
		"more enemies than a fight holds": oversized,
		"only reinforcements": {ID: "broken", ThemeID: "catacombs", Budget: 2, Enemies: []EncounterMonsterDefinition{
			{ID: "late", MonsterID: "scout", BudgetCost: 2, MinPartySize: 2},
		}},
		"reinforcement for an impossible party": {ID: "broken", ThemeID: "catacombs", Budget: 2, Enemies: []EncounterMonsterDefinition{
			{ID: "base", MonsterID: "scout", BudgetCost: 2},
			{ID: "late", MonsterID: "scout", BudgetCost: 2, MinPartySize: MaxEncounterPartySize + 1},
		}},
	}
	for name, definition := range tests {
		t.Run(name, func(t *testing.T) {
			catalog := EncounterCatalog{Encounters: map[string]EncounterDefinition{"broken": definition}}
			if err := catalog.Validate(defaultMonsterCatalog); err == nil {
				t.Fatal("expected the encounter to be rejected")
			}
		})
	}
}

func TestAuthoredReinforcementsAreKeptAsWritten(t *testing.T) {
	authored := EncounterDefinition{ID: "authored", ThemeID: "catacombs", Budget: 2, Enemies: []EncounterMonsterDefinition{
		{ID: "base", MonsterID: "scout", BudgetCost: 2},
		{ID: "late", MonsterID: "sentinel", BudgetCost: 1, MinPartySize: 3},
	}}
	if got := withPartyReinforcements(authored); len(got.Enemies) != 2 {
		t.Fatalf("an encounter that authors its own reinforcements should not get the theme's: %+v", got.Enemies)
	}
}

func TestBossSummonsStopAtTheEncounterCap(t *testing.T) {
	room := startExpedition(t, 4, "catacombs", "summon-cap")
	run := room.Run
	current := run.Rooms[run.CurrentRoomID]
	boss := Enemy{ID: "boss", Name: "Boss", Behavior: "warden", Health: 10, MaxHealth: 100, Mechanics: []string{BossMechanicSummon}, SummonMonsterID: "scout", SummonsLeft: 1}
	current.Encounter.Enemies = []Enemy{boss}
	for len(current.Encounter.Enemies) < MaxEncounterEnemies {
		current.Encounter.Enemies = append(current.Encounter.Enemies, Enemy{ID: fmt.Sprintf("minion-%d", len(current.Encounter.Enemies)), Behavior: "scout", Health: 5, MaxHealth: 5})
	}
	applyBossMechanics(room, current, 1)
	if len(current.Encounter.Enemies) != MaxEncounterEnemies || current.Encounter.Enemies[0].SummonsLeft != 1 {
		t.Fatalf("a full fight should not take a summon: %d enemies, summons left %d", len(current.Encounter.Enemies), current.Encounter.Enemies[0].SummonsLeft)
	}
}

func TestWinningAnExpeditionFightRestoresPartOfEachSurvivorsHealth(t *testing.T) {
	room := startExpedition(t, 2, "catacombs", "recovery-run")
	run := room.Run
	run.Players["player-1"].Health = 5
	run.Players["player-2"].Health = 0
	defeatCurrentEncounter(t, room)
	player := run.Players["player-1"]
	if want := 5 + player.MaxHealth*EncounterRecoveryPercent/100; player.Health != want {
		t.Fatalf("a won fight should restore %d%% of maximum health: health=%d, want %d", EncounterRecoveryPercent, player.Health, want)
	}
	if run.Players["player-2"].Health != 0 {
		t.Fatal("recovery does not revive a downed adventurer")
	}
}
