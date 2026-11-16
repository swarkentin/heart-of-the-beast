package game

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func TestEveryClassHasSixArmourTiersOnAnAscendingLadder(t *testing.T) {
	catalog := ClassSkinCatalogSnapshot()
	if len(catalog.Classes) != len(ClassCatalog()) {
		t.Fatalf("every class needs a skin set: %d sets for %d classes", len(catalog.Classes), len(ClassCatalog()))
	}
	names := map[string]bool{}
	for _, set := range catalog.Classes {
		if len(set.Tiers) != MaxSkinTier {
			t.Fatalf("%s has %d tiers, want %d", set.ClassID, len(set.Tiers), MaxSkinTier)
		}
		for i, tier := range set.Tiers {
			if tier.Tier != i+1 || tier.Name == "" || tier.Description == "" || tier.Rank == "" {
				t.Fatalf("%s tier %d is incomplete: %+v", set.ClassID, i+1, tier)
			}
			if i == 0 && tier.MasteryLevel != 1 {
				t.Fatalf("%s must start with its tier 1 look unlocked", set.ClassID)
			}
			if i > 0 && tier.MasteryLevel <= set.Tiers[i-1].MasteryLevel {
				t.Fatalf("%s tier %d does not need more mastery than tier %d", set.ClassID, tier.Tier, i)
			}
			if names[tier.Name] {
				t.Fatalf("duplicate armour set name %q", tier.Name)
			}
			names[tier.Name] = true
		}
	}
	if catalog.Variants[0].ID != DefaultSkinColour || catalog.Variants[0].MasteryLevel != 1 {
		t.Fatalf("the class colours must be the free first variant: %+v", catalog.Variants[0])
	}
}

func TestSkinUnlocksFollowClassMastery(t *testing.T) {
	cases := []struct {
		skin    PlayerSkin
		mastery int
		want    error
	}{
		{PlayerSkin{1, "heraldic"}, 1, nil},
		{PlayerSkin{2, "heraldic"}, 1, ErrSkinLocked},
		{PlayerSkin{2, "heraldic"}, 2, nil},
		{PlayerSkin{1, "ember"}, 2, ErrSkinLocked},
		{PlayerSkin{1, "ember"}, 3, nil},
		{PlayerSkin{6, "heraldic"}, 15, ErrSkinLocked},
		{PlayerSkin{6, "dusk"}, 16, nil},
		{PlayerSkin{6, "voidstar"}, 19, ErrSkinLocked},
		{PlayerSkin{6, "voidstar"}, 20, nil},
		{PlayerSkin{0, "heraldic"}, 99, ErrInvalidSkin},
		{PlayerSkin{7, "heraldic"}, 99, ErrInvalidSkin},
		{PlayerSkin{1, "plaid"}, 99, ErrInvalidSkin},
	}
	for _, c := range cases {
		if err := ValidatePlayerSkin(c.skin, c.mastery); !errors.Is(err, c.want) && !(err == nil && c.want == nil) {
			t.Errorf("ValidatePlayerSkin(%+v, mastery %d) = %v, want %v", c.skin, c.mastery, err, c.want)
		}
	}
	for mastery, want := range map[int]int{1: 1, 2: 2, 3: 2, 4: 3, 7: 4, 11: 5, 15: 5, 16: 6, 40: 6} {
		if got := HighestUnlockedSkinTier(mastery); got != want {
			t.Errorf("HighestUnlockedSkinTier(%d) = %d, want %d", mastery, got, want)
		}
	}
}

func TestChangingClassResetsTheLookAndRunsLockIt(t *testing.T) {
	room := &Room{PlayerIDs: []string{"p1"}}
	if err := SelectClass(room, "p1", ClassBulwark); err != nil {
		t.Fatal(err)
	}
	if err := SelectPlayerSkin(room, "p1", PlayerSkin{Tier: 3, Variant: "frost"}, 6); err != nil {
		t.Fatal(err)
	}
	if err := SelectClass(room, "p1", ClassBulwark); err != nil || room.PlayerSkins["p1"].Tier != 3 {
		t.Fatalf("re-choosing the same class should keep the look: %v %+v", err, room.PlayerSkins)
	}
	if err := SelectClass(room, "p1", ClassCleric); err != nil {
		t.Fatal(err)
	}
	if _, ok := room.PlayerSkins["p1"]; ok {
		t.Fatalf("a new class should not inherit the previous class's look: %+v", room.PlayerSkins)
	}
	room.Run = &Run{}
	if err := SelectPlayerSkin(room, "p1", DefaultPlayerSkin(), 1); !errors.Is(err, ErrArchetypeLocked) {
		t.Fatalf("looks are locked once the run starts, got %v", err)
	}
}

// The art pipeline renders a sheet for every tier and variant the catalog offers.
func TestSkinCatalogMatchesGeneratedHeroArt(t *testing.T) {
	raw, err := os.ReadFile(filepath.Join("..", "..", "..", "frontend", "public", "art", "heroes", "manifest.json"))
	if err != nil {
		t.Fatal(err)
	}
	var manifest struct {
		Heroes []struct {
			ID string `json:"id"`
		} `json:"heroes"`
		Skins struct {
			Tiers    []int    `json:"tiers"`
			Variants []string `json:"variants"`
		} `json:"skins"`
	}
	if err := json.Unmarshal(raw, &manifest); err != nil {
		t.Fatal(err)
	}
	if len(manifest.Skins.Tiers) != MaxSkinTier {
		t.Fatalf("art has %d tiers, catalog has %d", len(manifest.Skins.Tiers), MaxSkinTier)
	}
	catalog := ClassSkinCatalogSnapshot()
	if len(manifest.Skins.Variants) != len(catalog.Variants) {
		t.Fatalf("art variants %v do not match catalog %+v", manifest.Skins.Variants, catalog.Variants)
	}
	for i, variant := range catalog.Variants {
		if manifest.Skins.Variants[i] != variant.ID {
			t.Fatalf("art variant %d is %q, catalog has %q", i, manifest.Skins.Variants[i], variant.ID)
		}
	}
	art := map[string]bool{}
	for _, hero := range manifest.Heroes {
		art[hero.ID] = true
	}
	for _, set := range catalog.Classes {
		if !art[set.ClassID] {
			t.Fatalf("class %s has skins but no hero art", set.ClassID)
		}
	}
}
