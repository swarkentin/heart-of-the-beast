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

func TestHealingHerbShopAndDiscoveryAcquisition(t *testing.T) {
	room := openTestShop(t, 1, "herb-shop")
	player := room.Run.Players["player-1"]
	player.Gold = 100
	if err := ApplyCommand(room, player.ID, Command{Type: "buy", ChoiceID: "healing-herb"}, expeditionNow); err != nil {
		t.Fatalf("buy herb: %v", err)
	}
	if player.Consumables[ConsumableHealingHerb] != StartingHealingHerbs+1 {
		t.Fatalf("shop inventory = %d", player.Consumables[ConsumableHealingHerb])
	}
	if ok, _ := applyRoomEventEffect(room, "herb_cache"); !ok {
		t.Fatal("herb cache effect did not resolve")
	}
	if player.Consumables[ConsumableHealingHerb] != StartingHealingHerbs+2 {
		t.Fatalf("discovery inventory = %d", player.Consumables[ConsumableHealingHerb])
	}
	if err := ApplyCommand(room, player.ID, Command{Type: "buy", ChoiceID: "healing-herb"}, expeditionNow); !errors.Is(err, ErrItemUnavailable) {
		t.Fatalf("buying above the carry cap: %v", err)
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

func TestHealingHerbIsOfferedInEveryDiscovery(t *testing.T) {
	for _, theme := range defaultExpeditionThemeCatalog.Themes {
		for _, discovery := range theme.Discoveries {
			found := false
			for _, choice := range discovery.Event.Choices {
				if choice.ID == "herb_cache" {
					found = true
				}
			}
			if !found {
				t.Errorf("theme %q discovery %q has no herb-cache option", theme.ThemeID, discovery.Event.Title)
			}
		}
		if discovery := theme.Vault; len(discovery.Event.Choices) > 0 {
			found := false
			for _, choice := range discovery.Event.Choices {
				if choice.ID == "herb_cache" {
					found = true
				}
			}
			if !found {
				t.Errorf("theme %q vault has no herb-cache option", theme.ThemeID)
			}
		}
	}
}

func TestTacticalPolicyUsesHerbWhenItCanHealFully(t *testing.T) {
	room := startExpedition(t, 1, "catacombs", "tactical-herb")
	player := room.Run.Players["player-1"]
	amount := (player.MaxHealth*HealingHerbHealingPercent + 99) / 100
	player.Health -= amount
	command, ok := tacticalConsumableCommand(room, player.ID)
	if !ok || command.Type != "use_consumable" || command.ChoiceID != ConsumableHealingHerb {
		t.Fatalf("tactical policy should use an effective herb, got %+v, ok=%v", command, ok)
	}
	if err := ApplyCommand(room, player.ID, command, expeditionNow); err != nil {
		t.Fatalf("tactical herb use: %v", err)
	}
	if player.Health != player.MaxHealth || player.Consumables[ConsumableHealingHerb] != StartingHealingHerbs-1 {
		t.Fatalf("tactical herb result: health=%d herbs=%d", player.Health, player.Consumables[ConsumableHealingHerb])
	}
}
