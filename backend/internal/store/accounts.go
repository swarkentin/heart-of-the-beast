package store

import (
	"context"
	"time"
)

// LinkedAccount is an external identity attached to a profile (ADR 0034).
// Only the provider and a display username are exposed to the browser.
type LinkedAccount struct {
	Provider string    `json:"provider"`
	Username string    `json:"username"`
	LinkedAt time.Time `json:"linkedAt"`
}

// SignIn is a short-lived, single-use sign-in attempt. It is bound to the
// guest credential that started it. Subject and Username are set only while
// the player is choosing between this device's progress and the account.
type SignIn struct {
	StateHash      string
	Provider       string
	CredentialHash string
	Subject        string
	Username       string
	ExpiresAt      time.Time
}

// AccountRepository stores optional sign-in identities. Accounts never merge
// profiles: a device either links its guest profile to a new identity or
// switches to the profile the identity already owns.
type AccountRepository interface {
	SaveSignIn(context.Context, SignIn, time.Time) error
	GetSignIn(context.Context, string) (*SignIn, error)
	SetSignInIdentity(context.Context, string, string, string) error
	DeleteSignIn(context.Context, string) error
	ProfileIDForIdentity(context.Context, string, string) (string, error)
	LinkIdentity(context.Context, string, string, string, string, time.Time) error
	AddProfileCredential(context.Context, string, string, time.Time) error
	GetProfileByID(context.Context, string) (*Profile, error)
	LinkedAccounts(context.Context, string) ([]LinkedAccount, error)
}

// HasProgress reports whether a profile has earned anything worth keeping.
func (p *Profile) HasProgress() bool {
	if len(p.Bestiary) > 0 {
		return true
	}
		return true
	}
	if p.AdventurerXP > 0 {
		return true
	}
	for _, mastery := range p.ClassMastery {
		if mastery.Experience > 0 {
			return true
		}
	}
	return false
}
