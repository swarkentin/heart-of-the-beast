package store

import (
	"context"
	"encoding/json"
	"time"
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
	ID                string                  `json:"id"`
	AdventurerXP      int64                   `json:"adventurerXp"`
	AdventurerLevel   int                     `json:"adventurerLevel"`
	ClassMastery      map[string]ClassMastery `json:"classMastery"`
	UnlockedCosmetics []string                `json:"unlockedCosmetics"`
	CreatedAt         time.Time               `json:"createdAt"`
	UpdatedAt         time.Time               `json:"updatedAt"`
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
	if copy.ClassMastery == nil {
		copy.ClassMastery = map[string]ClassMastery{}
	}
	if copy.UnlockedCosmetics == nil {
		copy.UnlockedCosmetics = []string{}
	}
	return &copy, nil
}

// ProfileRepository is separate from room membership: a guest can retain the
// same profile across unrelated rooms and future character lives.
type ProfileRepository interface {
	GetOrCreateProfile(context.Context, string, string, time.Time) (*Profile, error)
	GetProfile(context.Context, string) (*Profile, error)
}
