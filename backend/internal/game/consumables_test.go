package game

import (
	"errors"
	"testing"
)

func TestHealingHerbUseAndFullHealthNoOp(t *testing.T) {
	room := startExpedition(t, 1, "catacombs", "herb-use")
	player := room.Run.Players["player-1"]
	if got := player.Consumables[ConsumableHealingHerb]; got != StartingHealingHerbs {
		t.Fatalf("starting herbs = %d, want %d", got, StartingHealingHerbs)
	}
	if err := ApplyCommand(room, player.ID, Command{Type: "use_consumable", ChoiceID: ConsumableHealingHerb}, expeditionNow); !errors.Is(err, ErrConsumableUnavailable) {
		t.Fatalf("using a herb at full health: %v", err)
	}
	if player.Consumables[ConsumableHealingHerb] != StartingHealingHerbs {
		t.Fatal("full-health use must not consume a herb")
	}
	player.Health -= 10
	before := player.Health
	want := (player.MaxHealth*HealingHerbHealingPercent + 99) / 100
	if err := ApplyCommand(room, player.ID, Command{Type: "use_consumable", ChoiceID: ConsumableHealingHerb}, expeditionNow); err != nil {
		t.Fatalf("use herb: %v", err)
	}
	if player.Health != before+want || player.Consumables[ConsumableHealingHerb] != StartingHealingHerbs-1 {
		t.Fatalf("herb use: health=%d inventory=%d, want health=%d inventory=%d", player.Health, player.Consumables[ConsumableHealingHerb], before+want, StartingHealingHerbs-1)
	}
}

func TestBlightedHerbsHalvesHerbHealing(t *testing.T) {
	room := startExpedition(t, 1, "catacombs", "blighted-herbs")
	player := room.Run.Players["player-1"]
	player.Health -= 12
	if !addFloorModifier(room.Run, "blighted-herbs") {
		t.Fatal("could not apply Blighted Herbs")
	}
	before := player.Health
	base := (player.MaxHealth*HealingHerbHealingPercent + 99) / 100
	want := base * 50 / 100
	if want < 1 {
		want = 1
	}
	if err := ApplyCommand(room, player.ID, Command{Type: "use_consumable", ChoiceID: ConsumableHealingHerb}, expeditionNow); err != nil {
		t.Fatalf("use blighted herb: %v", err)
	}
	if got := player.Health - before; got != want {
		t.Fatalf("blighted herb healed %d, want %d", got, want)
	}
}

func TestHealingHerbShopAndDiscoveryTrade(t *testing.T) {
	room := openTestShop(t, 1, "herb-shop")
	player := room.Run.Players["player-1"]
	player.Gold = 100
	if err := ApplyCommand(room, player.ID, Command{Type: "buy", ChoiceID: "healing-herb"}, expeditionNow); err != nil {
		t.Fatalf("buy herb: %v", err)
	}
	if player.Consumables[ConsumableHealingHerb] != StartingHealingHerbs+1 {
		t.Fatalf("shop inventory = %d", player.Consumables[ConsumableHealingHerb])
	}

	player.Consumables[ConsumableHealingHerb] = MaxHealingHerbs - 1
	player.Health -= 12
	before := player.Health
	if ok, _ := applyRoomEventEffect(room, "herb_cache"); !ok {
		t.Fatal("herb cache effect did not resolve")
	}
	if player.Consumables[ConsumableHealingHerb] != MaxHealingHerbs || player.Health != before-5 {
		t.Fatalf("herb trade: inventory=%d health=%d, want inventory=%d health=%d", player.Consumables[ConsumableHealingHerb], player.Health, MaxHealingHerbs, before-5)
	}

	player.Health = before
	if ok, _ := applyRoomEventEffect(room, "herb_cache"); !ok {
		t.Fatal("herb cache effect did not resolve at carry cap")
	}
	if player.Consumables[ConsumableHealingHerb] != MaxHealingHerbs || player.Health != before {
		t.Fatal("a full pack must not pay health for an herb it cannot carry")
	}
}


func TestHealingHerbsRefillAtDungeonEnd(t *testing.T) {
	room := startExpedition(t, 1, "catacombs", "herb-refill")
	run := room.Run
	player := run.Players["player-1"]
	player.Consumables[ConsumableHealingHerb] = 0
	run.Depth = run.MaxDepth
	openCamp(room, 1, expeditionNow)
	if got := player.Consumables[ConsumableHealingHerb]; got != StartingHealingHerbs {
		t.Fatalf("dungeon-end herb supply = %d, want %d", got, StartingHealingHerbs)
	}
}

func TestHerbCacheIsAnOccasionalSeededDiscoveryChoice(t *testing.T) {
	for _, theme := range defaultExpeditionThemeCatalog.Themes {
		for _, discovery := range theme.Discoveries {
			for _, choice := range discovery.Event.Choices {
				if choice.ID == "herb_cache" {
					t.Errorf("theme %q discovery %q should not always offer herbs", theme.ThemeID, discovery.Event.Title)
				}
			}
		}
		for _, choice := range theme.Vault.Event.Choices {
			if choice.ID == "herb_cache" {
				t.Errorf("theme %q vault should not offer the discovery-only herb trade", theme.ThemeID)
			}
		}
	}

	discoveries, offers := 0, 0
	for seed := uint64(1); seed <= 300; seed++ {
		_, rooms := generateExpeditionFloor("catacombs", seed, 1, 4, 1, nil)
		for _, room := range rooms {
			if room.RoomType == string(floorRoomDiscovery) && room.Event != nil {
				discoveries++
				for _, choice := range room.Event.Choices {
					if choice.ID == "herb_cache" {
						offers++
					}
				}
			}
			if room.RoomType == string(floorRoomVault) && room.Event != nil {
				for _, choice := range room.Event.Choices {
					if choice.ID == "herb_cache" {
						t.Fatalf("vault %q unexpectedly offered the herb cache", room.Name)
					}
				}
			}
		}
	}
	rate := float64(offers) / float64(discoveries)
	if rate < 0.15 || rate > 0.25 {
		t.Fatalf("herb cache appeared in %.1f%% of discovery rooms (%d/%d), want approximately %d%%", rate*100, offers, discoveries, DiscoveryHerbChance)
	}
}

func TestHerbalistBoonIsADeepDungeonPerk(t *testing.T) {
	definition, ok := defaultFloorModifierCatalog.Modifier("herbalist-boon")
	if !ok || !definition.DungeonRollable || definition.Rollable || definition.ConsumableHealingPct != 100 {
		t.Fatalf("Herbalist's Boon definition is incorrect: %+v", definition)
	}
	found := false
	for seed := uint64(1); seed <= 1000 && !found; seed++ {
		for _, choice := range rollDungeonChoices(seed, "catacombs", 2) {
			for _, modifier := range choice.Modifiers {
				if modifier.ID == "herbalist-boon" {
					found = true
				}
			}
		}
	}
	if !found {
		t.Fatal("Herbalist's Boon never appeared in random dungeon perks")
	}
	for seed := uint64(1); seed <= 100; seed++ {
		for _, modifier := range rollFloorModifiers(seed, 4) {
			if modifier.ID == "herbalist-boon" {
				t.Fatal("dungeon-only Herbalist's Boon appeared as a floor perk")
			}
		}
	}

	room := startExpedition(t, 1, "catacombs", "herbalist-boon-healing")
	player := room.Run.Players["player-1"]
	player.Health -= player.MaxHealth
	if !addFloorModifier(room.Run, "herbalist-boon") {
		t.Fatal("could not apply Herbalist's Boon")
	}
	before := player.Health
	if err := ApplyCommand(room, player.ID, Command{Type: "use_consumable", ChoiceID: ConsumableHealingHerb}, expeditionNow); err != nil {
		t.Fatalf("use herb with Herbalist's Boon: %v", err)
	}
	if got := player.Health - before; got != player.MaxHealth {
		t.Fatalf("Herbalist's Boon healed %d, want full maximum health %d", got, player.MaxHealth)
	}
}


func TestTacticalPolicyUsesHerbForPartialHealing(t *testing.T) {
	room := startExpedition(t, 1, "catacombs", "tactical-herb")
	player := room.Run.Players["player-1"]
	amount := (player.MaxHealth*HealingHerbHealingPercent + 99) / 100
	missing := (amount + 1) / 2
	player.Health -= missing
	command, ok := tacticalExplorationConsumableCommand(room, player.ID)
	if !ok || command.Type != "use_consumable" || command.ChoiceID != ConsumableHealingHerb {
		t.Fatalf("tactical policy should use a partially effective herb between encounters, got %+v, ok=%v", command, ok)
	}
	if err := ApplyCommand(room, player.ID, command, expeditionNow); err != nil {
		t.Fatalf("tactical herb use: %v", err)
	}
	if player.Health != player.MaxHealth || player.Consumables[ConsumableHealingHerb] != StartingHealingHerbs-1 {
		t.Fatalf("tactical herb result: health=%d herbs=%d", player.Health, player.Consumables[ConsumableHealingHerb])
	}
}

func TestTacticalPolicyDoesNotWasteHerbForTinyHeal(t *testing.T) {
	room := startExpedition(t, 1, "catacombs", "tactical-herb-tiny-heal")
	player := room.Run.Players["player-1"]
	amount := (player.MaxHealth*HealingHerbHealingPercent + 99) / 100
	player.Health -= (amount+1)/2 - 1
	if command, ok := tacticalExplorationConsumableCommand(room, player.ID); ok {
		t.Fatalf("tactical policy should save the herb when less than half its healing is useful, got %+v", command)
	}
}

func TestTacticalCombatPolicyUsesHerbOnlyWhenCriticallyWounded(t *testing.T) {
	room := startExpedition(t, 1, "catacombs", "tactical-herb-combat-threshold")
	player := room.Run.Players["player-1"]
	amount := (player.MaxHealth*HealingHerbHealingPercent + 99) / 100
	player.Health -= (amount + 1) / 2
	if command, ok := tacticalConsumableCommand(room, player.ID); ok {
		t.Fatalf("combat policy should save a herb rather than spend an action on a modest heal, got %+v", command)
	}

	player.Health = player.MaxHealth / 3
	if command, ok := tacticalConsumableCommand(room, player.ID); !ok || command.Type != "use_consumable" {
		t.Fatalf("combat policy should use a herb when critically wounded, got %+v, ok=%v", command, ok)
	}
}
