package game

// Vault keepers (ADR 0038): every vault has someone in it offering the party a deal. The warden presents the
// dungeon's own treasure (safe coin, or a gamble on a relic); the others are wanderers who turn up in any dungeon
// with a trade-off of their own. Each keeper's deals reuse the discovery effects (run_effect_catalog.go), so every
// choice is already balanced and tested; the keeper decides which two are on the table.

// VaultKeeper is a character a vault can hold. ID is what the client draws.
type VaultKeeper struct {
	ID       string
	Name     string
	Greeting string
	Choices  []EventChoice
}

const VaultKeeperWarden = "warden"

func vaultKeepers() []VaultKeeper {
	return []VaultKeeper{
		{ID: VaultKeeperWarden},
		{ID: "broker", Name: "The Blood Broker", Greeting: "A smiling stranger in a red coat opens a ledger. \"Strength is for sale. The price is you.\"",
			Choices: []EventChoice{option("Sign in blood", "blood_pact"), option("Trade health for armour", "vital_tithe"), option("Close the ledger", "leave")}},
		{ID: "gambler", Name: "The Grinning Gambler", Greeting: "An imp shuffles cards on an upturned chest. \"Double or nothing, heroes?\"",
			Choices: []EventChoice{option("Take the bet", "trapped_cache"), option("Take the stake and walk", "vault_coin"), option("Walk away", "leave")}},
		{ID: "alchemist", Name: "The Masked Alchemist", Greeting: "A masked figure swirls two flasks, one bubbling, one blood-dark. \"Every cure has a cost.\"",
			Choices: []EventChoice{option("Drink the bubbling flask", "risky_draught"), option("Rest by the fire", "uneasy_rest"), option("Refuse both", "leave")}},
		{ID: "armourer", Name: "The Ghost Armourer", Greeting: "A pale smith hammers at an anvil that is not there. \"Heavier, or sharper? Not both.\"",
			Choices: []EventChoice{option("Heavier plate", "heavy_plate"), option("A keener edge", "glass_edge"), option("Keep your kit", "leave")}},
		{ID: "merchant", Name: "The Hollow Merchant", Greeting: "A merchant with no face lays out gold and a glowing charm. \"Both are heavy, in their way.\"",
			Choices: []EventChoice{option("Fill your purses", "greedy_haul"), option("Wear the glowing charm", "cursed_boon"), option("Take nothing", "leave")}},
	}
}

// newVaultEvent puts a seeded keeper in a vault. pick is any well-mixed number for this vault.
func newVaultEvent(roomID string, treasure FloorEventTemplate, pick uint64) *RoomEvent {
	keepers := vaultKeepers()
	keeper := keepers[pick%uint64(len(keepers))]
	if keeper.ID == VaultKeeperWarden {
		event := newRoomEvent(roomID, treasure)
		event.Keeper = VaultKeeperWarden
		return event
	}
	return &RoomEvent{ID: roomID + "-event", Keeper: keeper.ID, Title: keeper.Name, Description: keeper.Greeting, Choices: append([]EventChoice(nil), keeper.Choices...)}
}
