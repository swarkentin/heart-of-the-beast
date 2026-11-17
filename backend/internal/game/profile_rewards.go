package game

// ProfileXPPerLevel is the persistent experience in each Adventurer Rank and each class-mastery level: both start
// at 1 and go up one per this much XP. The Postgres store writes the same rule in SQL.
const ProfileXPPerLevel = 100

// ProfileLevelFor is the Adventurer Rank or mastery level that this much persistent experience reaches.
func ProfileLevelFor(xp int64) int {
	return int(xp/ProfileXPPerLevel) + 1
}

// ProfileRewardDefinition describes a persistent cosmetic earned through
// Adventurer Rank or class mastery. Rewards never change run power.
type ProfileRewardDefinition struct {
	ID                string `json:"id"`
	Name              string `json:"name"`
	Description       string `json:"description"`
	Category          string `json:"category"`
	ProfileLevel      int    `json:"profileLevel,omitempty"`
	ClassID           string `json:"classId,omitempty"`
	ClassMasteryLevel int    `json:"classMasteryLevel,omitempty"`
}

var profileRewardCatalog = []ProfileRewardDefinition{
	{ID: "title.catacomb-wayfinder", Name: "Catacomb Wayfinder", Description: "Earned by reaching Adventurer Rank 2.", Category: "title", ProfileLevel: 2},
	{ID: "badge.crypt-veteran", Name: "Crypt Veteran", Description: "A mark of reaching Adventurer Rank 5.", Category: "badge", ProfileLevel: 5},
	{ID: "title.mastery.bulwark", Name: "Bulwark Adept", Description: "Master the Bulwark class.", Category: "title", ClassID: ClassBulwark, ClassMasteryLevel: 2},
	{ID: "title.mastery.juggernaut", Name: "Juggernaut Adept", Description: "Master the Juggernaut class.", Category: "title", ClassID: ClassJuggernaut, ClassMasteryLevel: 2},
	{ID: "title.mastery.spellguard", Name: "Spellguard Adept", Description: "Master the Spellguard class.", Category: "title", ClassID: ClassSpellguard, ClassMasteryLevel: 2},
	{ID: "title.mastery.assassin", Name: "Assassin Adept", Description: "Master the Assassin class.", Category: "title", ClassID: ClassAssassin, ClassMasteryLevel: 2},
	{ID: "title.mastery.arcanist", Name: "Arcanist Adept", Description: "Master the Arcanist class.", Category: "title", ClassID: ClassArcanist, ClassMasteryLevel: 2},
	{ID: "title.mastery.ranger", Name: "Ranger Adept", Description: "Master the Ranger class.", Category: "title", ClassID: ClassRanger, ClassMasteryLevel: 2},
	{ID: "title.mastery.cleric", Name: "Cleric Adept", Description: "Master the Cleric class.", Category: "title", ClassID: ClassCleric, ClassMasteryLevel: 2},
	{ID: "title.mastery.tactician", Name: "Tactician Adept", Description: "Master the Tactician class.", Category: "title", ClassID: ClassTactician, ClassMasteryLevel: 2},
	{ID: "title.mastery.beastcaller", Name: "Beastcaller Adept", Description: "Master the Beastcaller class.", Category: "title", ClassID: ClassBeastcaller, ClassMasteryLevel: 2},
}

// Armour tiers and dyes for every class join the catalog after the hand-written rewards.
func init() {
	profileRewardCatalog = append(profileRewardCatalog, classSkinRewards()...)
}

func ProfileRewardCatalog() []ProfileRewardDefinition {
	return append([]ProfileRewardDefinition(nil), profileRewardCatalog...)
}

// ProfileRewardUnlocks returns newly eligible rewards in catalog order. The
// caller persists the IDs atomically with the progression change.
func ProfileRewardUnlocks(profileLevel int, classMasteryLevels map[string]int, alreadyUnlocked []string) []string {
	unlocked := make(map[string]bool, len(alreadyUnlocked))
	for _, id := range alreadyUnlocked {
		unlocked[id] = true
	}
	var newlyUnlocked []string
	for _, reward := range profileRewardCatalog {
		eligible := reward.ProfileLevel > 0 && profileLevel >= reward.ProfileLevel
		if reward.ClassID != "" && reward.ClassMasteryLevel > 0 {
			eligible = classMasteryLevels[reward.ClassID] >= reward.ClassMasteryLevel
		}
		if eligible && !unlocked[reward.ID] {
			newlyUnlocked = append(newlyUnlocked, reward.ID)
			unlocked[reward.ID] = true
		}
	}
	return newlyUnlocked
}
