package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"
)

// insertOnce runs an INSERT ... ON CONFLICT DO NOTHING and reports a conflict
// when no row was written.
func insertOnce(result sql.Result, err error) error {
	if err != nil {
		return err
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return ErrConflict
	}
	return nil
}

func (p *Postgres) SaveSignIn(ctx context.Context, signIn SignIn, now time.Time) error {
	// Abandoned attempts are cleaned up opportunistically; there is no job.
	if _, err := p.db.ExecContext(ctx, `DELETE FROM profile_sign_ins WHERE expires_at <= $1`, now.UTC()); err != nil {
		return err
	}
	return insertOnce(p.db.ExecContext(ctx, `
		INSERT INTO profile_sign_ins (state_hash, provider, credential_hash, expires_at)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT DO NOTHING
	`, signIn.StateHash, signIn.Provider, signIn.CredentialHash, signIn.ExpiresAt.UTC()))
}

func (p *Postgres) GetSignIn(ctx context.Context, stateHash string) (*SignIn, error) {
	signIn := SignIn{StateHash: stateHash}
	err := p.db.QueryRowContext(ctx, `
		SELECT provider, credential_hash, provider_subject, username, expires_at
		FROM profile_sign_ins WHERE state_hash = $1
	`, stateHash).Scan(&signIn.Provider, &signIn.CredentialHash, &signIn.Subject, &signIn.Username, &signIn.ExpiresAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &signIn, nil
}

func (p *Postgres) SetSignInIdentity(ctx context.Context, stateHash, subject, username string) error {
	result, err := p.db.ExecContext(ctx, `
		UPDATE profile_sign_ins SET provider_subject = $2, username = $3 WHERE state_hash = $1
	`, stateHash, subject, username)
	if err != nil {
		return err
	}
	if rows, err := result.RowsAffected(); err != nil {
		return err
	} else if rows == 0 {
		return ErrNotFound
	}
	return nil
}

func (p *Postgres) DeleteSignIn(ctx context.Context, stateHash string) error {
	_, err := p.db.ExecContext(ctx, `DELETE FROM profile_sign_ins WHERE state_hash = $1`, stateHash)
	return err
}

func (p *Postgres) ProfileIDForIdentity(ctx context.Context, provider, subject string) (string, error) {
	var profileID string
	err := p.db.QueryRowContext(ctx, `
		SELECT profile_id FROM profile_identities WHERE provider = $1 AND provider_subject = $2
	`, provider, subject).Scan(&profileID)
	if errors.Is(err, sql.ErrNoRows) {
		return "", ErrNotFound
	}
	return profileID, err
}

func (p *Postgres) LinkIdentity(ctx context.Context, provider, subject, username, profileID string, now time.Time) error {
	return insertOnce(p.db.ExecContext(ctx, `
		INSERT INTO profile_identities (provider, provider_subject, profile_id, username, linked_at)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT DO NOTHING
	`, provider, subject, profileID, username, now.UTC()))
}

func (p *Postgres) AddProfileCredential(ctx context.Context, profileID, credentialHash string, now time.Time) error {
	return insertOnce(p.db.ExecContext(ctx, `
		INSERT INTO profile_credentials (credential_hash, profile_id, created_at) VALUES ($1, $2, $3)
		ON CONFLICT DO NOTHING
	`, credentialHash, profileID, now.UTC()))
}

func (p *Postgres) GetProfileByID(ctx context.Context, profileID string) (*Profile, error) {
	var profile Profile
	var masteryJSON, cosmeticsJSON []byte
	err := p.db.QueryRowContext(ctx, `
		SELECT id, display_name, adventurer_xp, adventurer_level, class_mastery, unlocked_cosmetics, created_at, updated_at
		FROM player_profiles WHERE id = $1
	`, profileID).Scan(
		&profile.ID, &profile.DisplayName, &profile.AdventurerXP, &profile.AdventurerLevel,
		&masteryJSON, &cosmeticsJSON, &profile.CreatedAt, &profile.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if err := json.Unmarshal(masteryJSON, &profile.ClassMastery); err != nil {
		return nil, err
	}
	if err := json.Unmarshal(cosmeticsJSON, &profile.UnlockedCosmetics); err != nil {
		return nil, err
	}
	return cloneProfile(&profile)
}

func (p *Postgres) LinkedAccounts(ctx context.Context, profileID string) ([]LinkedAccount, error) {
	rows, err := p.db.QueryContext(ctx, `
		SELECT provider, username, linked_at FROM profile_identities WHERE profile_id = $1 ORDER BY provider
	`, profileID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	accounts := []LinkedAccount{}
	for rows.Next() {
		var account LinkedAccount
		if err := rows.Scan(&account.Provider, &account.Username, &account.LinkedAt); err != nil {
			return nil, err
		}
		accounts = append(accounts, account)
	}
	return accounts, rows.Err()
}
