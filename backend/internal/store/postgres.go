package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	"github.com/swarkentin/heart-of-the-beast/backend/internal/game"
)

type Postgres struct {
	db *sql.DB
}

func NewPostgres(db *sql.DB) *Postgres {
	return &Postgres{db: db}
}

func (p *Postgres) Create(ctx context.Context, room *game.Room) error {
	state, err := json.Marshal(room)
	if err != nil {
		return err
	}
	_, err = p.db.ExecContext(ctx,
		`INSERT INTO rooms (id, code, version, state) VALUES ($1, $2, $3, $4)`,
		room.ID, room.Code, room.Version, state)
	return err
}

func (p *Postgres) Get(ctx context.Context, id string) (*game.Room, error) {
	var state []byte
	err := p.db.QueryRowContext(ctx, `SELECT state FROM rooms WHERE id = $1`, id).Scan(&state)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	var room game.Room
	if err := json.Unmarshal(state, &room); err != nil {
		return nil, err
	}
	return &room, nil
}

func (p *Postgres) GetByCode(ctx context.Context, code string) (*game.Room, error) {
	var state []byte
	err := p.db.QueryRowContext(ctx, `SELECT state FROM rooms WHERE code = $1`, code).Scan(&state)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	var room game.Room
	if err := json.Unmarshal(state, &room); err != nil {
		return nil, err
	}
	return &room, nil
}

func (p *Postgres) TouchPlayer(ctx context.Context, roomID, playerID string, seenAt time.Time) error {
	result, err := p.db.ExecContext(ctx, `
		UPDATE rooms
		SET state = jsonb_set(
			state,
			'{presence}',
			COALESCE(state->'presence', '{}'::jsonb) ||
				jsonb_build_object($2, COALESCE(state->'presence'->$2, '{}'::jsonb) ||
					jsonb_build_object('lastSeenAt', to_jsonb($3::timestamptz))),
			true
		)
		WHERE id = $1
			AND (state->'playerTokenHashes') ? $2
			AND NOT (COALESCE(state->'presence'->$2, '{}'::jsonb) ? 'leftAt')`,
		roomID, playerID, seenAt)
	if err != nil {
		return err
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		var exists bool
		if err := p.db.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM rooms WHERE id = $1)`, roomID).Scan(&exists); err != nil {
			return err
		}
		if !exists {
			return ErrNotFound
		}
		return ErrPlayerLeft
	}
	return nil
}

func (p *Postgres) Save(ctx context.Context, room *game.Room, expectedVersion int64) error {
	state, err := json.Marshal(room)
	if err != nil {
		return err
	}
	result, err := p.db.ExecContext(ctx,
		`UPDATE rooms SET state = $1, version = $2 WHERE id = $3 AND version = $4`,
		state, room.Version, room.ID, expectedVersion)
	if err != nil {
		return err
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		var exists bool
		if err := p.db.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM rooms WHERE id = $1)`, room.ID).Scan(&exists); err != nil {
			return err
		}
		if !exists {
			return ErrNotFound
		}
		return ErrConflict
	}
	return nil
}

// profileIDForCredential resolves $1 (a credential hash) to a profile ID. A
// profile's first guest credential lives on player_profiles; devices that
// signed in to the same account have their own rows in profile_credentials.
const profileIDForCredential = `
	SELECT id FROM player_profiles WHERE credential_hash = $1
	UNION ALL
	SELECT profile_id FROM profile_credentials WHERE credential_hash = $1
	LIMIT 1`

func (p *Postgres) GetOrCreateProfile(ctx context.Context, id, credentialHash string, now time.Time) (*Profile, error) {
	// A device that switched to a signed-in account resumes that profile.
	var signedInProfileID string
	err := p.db.QueryRowContext(ctx, `SELECT profile_id FROM profile_credentials WHERE credential_hash = $1`, credentialHash).Scan(&signedInProfileID)
	if err == nil {
		if _, err := p.db.ExecContext(ctx, `UPDATE player_profiles SET last_seen_at = $2 WHERE id = $1`, signedInProfileID, now.UTC()); err != nil {
			return nil, err
		}
		return p.GetProfileByID(ctx, signedInProfileID)
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}
	var profile Profile
	var masteryJSON, cosmeticsJSON []byte
	err = p.db.QueryRowContext(ctx, `
		INSERT INTO player_profiles (id, credential_hash, created_at, updated_at, last_seen_at)
		VALUES ($1, $2, $3, $3, $3)
		ON CONFLICT (credential_hash) DO UPDATE SET last_seen_at = EXCLUDED.last_seen_at
		RETURNING id, display_name, adventurer_xp, adventurer_level, class_mastery, unlocked_cosmetics, created_at, updated_at
	`, id, credentialHash, now.UTC()).Scan(
		&profile.ID, &profile.DisplayName, &profile.AdventurerXP, &profile.AdventurerLevel,
		&masteryJSON, &cosmeticsJSON, &profile.CreatedAt, &profile.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	if err := json.Unmarshal(masteryJSON, &profile.ClassMastery); err != nil {
		return nil, err
	}
	if err := json.Unmarshal(cosmeticsJSON, &profile.UnlockedCosmetics); err != nil {
		return nil, err
	}
	if profile.ClassMastery == nil {
		profile.ClassMastery = map[string]ClassMastery{}
	}
	if profile.UnlockedCosmetics == nil {
		profile.UnlockedCosmetics = []string{}
	}
	if err := p.loadBestiary(ctx, &profile); err != nil { return nil, err }
	return &profile, nil
}

func (p *Postgres) GetProfile(ctx context.Context, credentialHash string) (*Profile, error) {
	var profile Profile
	var masteryJSON, cosmeticsJSON []byte
	err := p.db.QueryRowContext(ctx, `
		SELECT id, display_name, adventurer_xp, adventurer_level, class_mastery, unlocked_cosmetics, created_at, updated_at
		FROM player_profiles WHERE id = (`+profileIDForCredential+`)
	`, credentialHash).Scan(
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
	if profile.ClassMastery == nil {
		profile.ClassMastery = map[string]ClassMastery{}
	}
	if profile.UnlockedCosmetics == nil {
		profile.UnlockedCosmetics = []string{}
	}
	if err := p.loadBestiary(ctx, &profile); err != nil { return nil, err }
	return &profile, nil
}

func (p *Postgres) UpdateProfileName(ctx context.Context, credentialHash, name string, now time.Time) (*Profile, error) {
	var profile Profile
	var masteryJSON, cosmeticsJSON []byte
	err := p.db.QueryRowContext(ctx, `
		UPDATE player_profiles SET display_name = $2, updated_at = $3
		WHERE id = (`+profileIDForCredential+`)
		RETURNING id, display_name, adventurer_xp, adventurer_level, class_mastery, unlocked_cosmetics, created_at, updated_at
	`, credentialHash, name, now.UTC()).Scan(
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
	if err := p.loadBestiary(ctx, &profile); err != nil { return nil, err }
	return &profile, nil
}

func (p *Postgres) AwardRunXP(ctx context.Context, profileID, runID, playerID, classID string, xp int64, now time.Time) (*Profile, error) {
	tx, err := p.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	key := profileID + ":" + runID
	result, err := tx.ExecContext(ctx, `
		INSERT INTO player_profile_run_awards (award_key, profile_id, run_id, player_id, xp, class_id, awarded_at)
		VALUES ($1, $2, $3, $4, $5, NULLIF($6, ''), $7)
		ON CONFLICT (award_key) DO NOTHING
	`, key, profileID, runID, playerID, xp, classID, now.UTC())
	if err != nil {
		return nil, err
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return nil, err
	}
	if rows > 0 {
		// The "/ 100" below is game.ProfileXPPerLevel.
		if classID == "" {
			_, err = tx.ExecContext(ctx, `
				UPDATE player_profiles
				SET adventurer_xp = adventurer_xp + $2,
				    adventurer_level = ((adventurer_xp + $2) / 100)::integer + 1,
				    updated_at = $3
				WHERE id = $1
			`, profileID, xp, now.UTC())
		} else {
			_, err = tx.ExecContext(ctx, `
				UPDATE player_profiles
				SET adventurer_xp = adventurer_xp + $2,
				    adventurer_level = ((adventurer_xp + $2) / 100)::integer + 1,
				    class_mastery = jsonb_set(
				        class_mastery,
				        ARRAY[$3],
				        jsonb_build_object(
				            'experience', COALESCE((class_mastery->$3->>'experience')::bigint, 0) + $2,
				            'level', ((COALESCE((class_mastery->$3->>'experience')::bigint, 0) + $2) / 100)::integer + 1
				        ),
				        true
				    ),
				    updated_at = $4
				WHERE id = $1
			`, profileID, xp, classID, now.UTC())
		}
		if err != nil {
			return nil, err
		}
	}
	var profile Profile
	var masteryJSON, cosmeticsJSON []byte
	err = tx.QueryRowContext(ctx, `
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
	if applyProfileRewardUnlocks(&profile) {
		updatedCosmetics, err := json.Marshal(profile.UnlockedCosmetics)
		if err != nil {
			return nil, err
		}
		if _, err := tx.ExecContext(ctx, `
			UPDATE player_profiles SET unlocked_cosmetics = $2::jsonb WHERE id = $1
		`, profileID, updatedCosmetics); err != nil {
			return nil, err
		}
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	if profile.ClassMastery == nil {
		profile.ClassMastery = map[string]ClassMastery{}
	}
	if profile.UnlockedCosmetics == nil {
		profile.UnlockedCosmetics = []string{}
	}
	if err := p.loadBestiary(ctx, &profile); err != nil { return nil, err }
	return &profile, nil
}
