package game

import "testing"

func TestProfileRewardCatalogHasStableUniqueIDsAndValidMilestones(t *testing.T) {
	catalog := ProfileRewardCatalog()
	skins := ClassSkinCatalogSnapshot()
	want := 11 + len(skins.Classes)*((MaxSkinTier-1)+(len(skins.Variants)-1))
	if len(catalog) != want {
		t.Fatalf("expected %d profile rewards (11 titles and badges plus armour and dyes), got %d", want, len(catalog))
	}
	seen := make(map[string]bool, len(catalog))
	for _, reward := range catalog {
		if reward.ID == "" || seen[reward.ID] {
			t.Fatalf("empty or duplicate profile reward ID %q", reward.ID)
		}
		seen[reward.ID] = true
		if reward.Name == "" || reward.Description == "" || (reward.Category != "title" && reward.Category != "badge" && reward.Category != "armor" && reward.Category != "dye") {
			t.Fatalf("invalid profile reward definition: %+v", reward)
		}
		if reward.ProfileLevel == 0 && (reward.ClassID == "" || reward.ClassMasteryLevel == 0) {
			t.Fatalf("reward %q has no unlock milestone", reward.ID)
		}
	}
}

func TestProfileRewardUnlocksAreMilestoneBasedAndIdempotent(t *testing.T) {
	mastery := map[string]int{ClassRanger: 2}
	first := ProfileRewardUnlocks(2, mastery, nil)
	if len(first) != 3 || first[0] != "title.catacomb-wayfinder" || first[1] != "title.mastery.ranger" || first[2] != "armor.ranger.t2" {
		t.Fatalf("unexpected newly unlocked rewards: %#v", first)
	}
	repeated := ProfileRewardUnlocks(2, mastery, append([]string(nil), first...))
	if len(repeated) != 0 {
		t.Fatalf("already-unlocked rewards should not be granted again: %#v", repeated)
	}
	veteran := ProfileRewardUnlocks(5, mastery, first)
	if len(veteran) != 1 || veteran[0] != "badge.crypt-veteran" {
		t.Fatalf("rank-five milestone should unlock the veteran badge: %#v", veteran)
	}
}
