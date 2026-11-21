package store

import (
	"context"
	"encoding/json"
	"time"

	"github.com/swarkentin/heart-of-the-beast/backend/internal/game"
)

// ClassMastery is profile-wide and intentionally independent of a character's
// temporary run level or lifetime record.
type ClassMastery struct {
	Experience int64 `json:"experience"`
	Level      int   `json:"level"`
}

// Profile is the persistent identity shared by a player's characters and runs.
// Credential hashes are kept in the repository and are never serialized.
type Profile struct {
	Bestiary          map[string]BestiaryEntry `json:"bestiary"`
	ID                string                   `json:"id"`
	DisplayName       string                   `json:"displayName"`
	AdventurerXP      int64                    `json:"adventurerXp"`
	AdventurerLevel   int                      `json:"adventurerLevel"`
	ClassMastery      map[string]ClassMastery  `json:"classMastery"`
	UnlockedCosmetics []string                 `json:"unlockedCosmetics"`
	// Accounts is filled in by the HTTP layer; repositories leave it empty.
	Accounts  []LinkedAccount `json:"accounts"`
	CreatedAt time.Time       `json:"createdAt"`
	UpdatedAt time.Time       `json:"updatedAt"`
}

func cloneProfile(profile *Profile) (*Profile, error) {
	encoded, err := json.Marshal(profile)
	if err != nil {
		return nil, err
	}
	var copy Profile
	if err := json.Unmarshal(encoded, &copy); err != nil {
		return nil, err
	}
	if copy.Bestiary == nil {
		copy.Bestiary = map[string]BestiaryEntry{}
	}
	if copy.ClassMastery == nil {
		copy.ClassMastery = map[string]ClassMastery{}
	}
	if copy.UnlockedCosmetics == nil {
		copy.UnlockedCosmetics = []string{}
	}
	if copy.Accounts == nil {
		copy.Accounts = []LinkedAccount{}
	}
	return &copy, nil
}

// ProfileRepository is separate from room membership: a guest can retain the
// same profile across unrelated rooms and future character lives.
type ProfileRepository interface {
	GetOrCreateProfile(context.Context, string, string, time.Time) (*Profile, error)
	GetProfile(context.Context, string) (*Profile, error)
	UpdateProfileName(context.Context, string, string, time.Time) (*Profile, error)
	// AwardRunXP banks a run's experience. xp is the run's total so far; only the part above what this profile
	// has already been awarded for the run is added, so it is safe to call after every fight and on repeats.
	AwardRunXP(context.Context, string, string, string, string, int64, time.Time) (*Profile, error)
}

func applyProfileRewardUnlocks(profile *Profile) bool {
	masteryLevels := make(map[string]int, len(profile.ClassMastery))
	for classID, mastery := range profile.ClassMastery {
		masteryLevels[classID] = mastery.Level
	}
	newUnlocks := game.ProfileRewardUnlocks(profile.AdventurerLevel, masteryLevels, profile.UnlockedCosmetics)
	if len(newUnlocks) == 0 {
		return false
	}
	profile.UnlockedCosmetics = append(profile.UnlockedCosmetics, newUnlocks...)
	return true
}
