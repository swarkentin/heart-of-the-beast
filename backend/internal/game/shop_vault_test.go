package game

import (
	"testing"
	"time"
)

func TestShopGoodsGetFinerDeeperIn(t *testing.T) {
	if got := []int{shopTier(1), shopTier(2), shopTier(3), shopTier(4), shopTier(5), shopTier(40)}; got[0] != 1 || got[1] != 1 || got[2] != 2 || got[3] != 2 || got[4] != 3 || got[5] != 3 {
		t.Fatalf("tiers by depth: %v", got)
	}
	draught := shopCatalog[0]
	if item := atTier(draught, 1); item.ID != "healing-draught" || item.Tier != 1 {
		t.Fatalf("tier 1 draught: %+v", item)
	}
	if item := atTier(draught, 3); item.ID != "elixir-of-mending" || item.Tier != 3 || item.Amount <= draught.Amount {
		t.Fatalf("tier 3 draught: %+v", item)
	}
	// The herb has no tier 3 version, so the finest shops sell its tier 2 bundle.
	if item := atTier(shopCatalog[1], 3); item.ID != "herb-bundle" || item.Tier != 2 {
		t.Fatalf("tier 3 herb: %+v", item)
	}
	if err := validateShopCatalog(); err != nil {
		t.Fatal(err)
	}
}

func TestDeepShopSellsFinerItemsAndNoBasicOnes(t *testing.T) {
	room := openTestShop(t, 1, "deep-shop")
	room.Run.Depth = 5
	openShop(room, expeditionNow)
	for _, offer := range room.Run.Camp.Offers {
		if offer.Tier < 2 && len(shopUpgrades[offer.ID]) > 0 {
			t.Fatalf("a deep shop still sells the basic %s: %+v", offer.ID, room.Run.Camp.Offers)
		}
	}
	if len(room.Run.Camp.Offers) < ShopOfferCount {
		t.Fatalf("offers: %+v", room.Run.Camp.Offers)
	}
}

func TestShopSellsSkillPointsExperienceAndBundlesUpToTheCap(t *testing.T) {
	room := openTestShop(t, 1, "new-items")
	run := room.Run
	buyer := run.Players["player-1"]
	run.Camp.Offers = []ShopItem{atTier(shopCatalog[1], 2), shopCatalog[len(shopCatalog)-1], shopCatalog[len(shopCatalog)-2]}
	buyer.Gold = 500
	buyer.Consumables = map[string]int{ConsumableHealingHerb: MaxHealingHerbs - 1}
	if err := buyShopItem(room, "player-1", "herb-bundle"); err != nil || buyer.Consumables[ConsumableHealingHerb] != MaxHealingHerbs {
		t.Fatalf("a bundle fills the pack to the cap and no further: %v %v", err, buyer.Consumables)
	}
	points := buyer.SkillPoints
	if err := buyShopItem(room, "player-1", "scroll-of-practice"); err != nil || buyer.SkillPoints != points+1 {
		t.Fatalf("scroll: %v points %d", err, buyer.SkillPoints)
	}
	experience := buyer.Experience
	if err := buyShopItem(room, "player-1", "field-journal"); err != nil || buyer.Experience == experience && buyer.Level == 1 {
		t.Fatalf("journal: %v xp %d", err, buyer.Experience)
	}
}

func TestEveryVaultHasAKeeperWithADeal(t *testing.T) {
	treasure := FloorEventTemplate{Title: "Grave Goods", Description: "Coin and a relic.", Choices: []EventChoice{option("Coin", "vault_coin"), option("Relic", "vault_relic"), option("Leave", "leave")}}
	seen := map[string]bool{}
	for pick := uint64(0); pick < uint64(len(vaultKeepers())); pick++ {
		event := newVaultEvent("m11", treasure, pick)
		seen[event.Keeper] = true
		if event.Keeper == "" || event.Title == "" || event.Description == "" || len(event.Choices) != 3 || event.Choices[2].Effect != "leave" {
			t.Fatalf("keeper %d: %+v", pick, event)
		}
		if event.Keeper == VaultKeeperWarden && event.Title != treasure.Title {
			t.Fatalf("the warden shows the dungeon's own treasure: %+v", event)
		}
	}
	if len(seen) != len(vaultKeepers()) {
		t.Fatalf("keepers seen: %v", seen)
	}
	if vaultChance(1) > 25 || vaultChance(50) > 33 {
		t.Fatalf("vaults should stay uncommon: %d%% at depth 1, %d%% deep", vaultChance(1), vaultChance(50))
	}
}

func TestOnlyPathIsTakenWithoutAVote(t *testing.T) {
	room := startExpedition(t, 2, "wasteland", "one-path")
	run := room.Run
	current := run.Rooms[run.CurrentRoomID]
	current.Exits = current.Exits[:1]
	current.Cleared = true
	run.Phase = PhaseExploring
	startNavigationVote(room, expeditionNow)
	if run.NavigationVote == nil || !run.NavigationVote.Auto || !run.NavigationVote.Deadline.Equal(expeditionNow.UTC().Add(SinglePathDelay)) {
		t.Fatalf("a single path should start the move-on countdown: %+v", run.NavigationVote)
	}
	from := run.CurrentRoomID
	if AdvanceNavigationVote(room, expeditionNow.Add(time.Second)) {
		t.Fatal("the party should get a moment before moving on")
	}
	if !AdvanceNavigationVote(room, expeditionNow.Add(SinglePathDelay)) || run.CurrentRoomID == from {
		t.Fatalf("the party should move on by itself: still in %s", run.CurrentRoomID)
	}
}
