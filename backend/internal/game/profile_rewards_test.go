package game

import "testing"

func TestProfileRewardCatalogHasStableUniqueIDsAndValidMilestones(t *testing.T) {
	catalog := ProfileRewardCatalog()
	if len(catalog) != 11 {
		t.Fatalf("expected 11 initial profile rewards, got %d", len(catalog))
	}
	seen := make(map[string]bool, len(catalog))
	for _, reward := range catalog {
		if reward.ID == "" || seen[reward.ID] {
			t.Fatalf("empty or duplicate profile reward ID %q", reward.ID)
		}
		seen[reward.ID] = true
		if reward.Name == "" || reward.Description == "" || (reward.Category != "title" && reward.Category != "badge") {
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
	if len(first) != 2 || first[0] != "title.catacomb-wayfinder" || first[1] != "title.mastery.ranger" {
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
