package store

import (
	"context"
	"time"

	"github.com/swarkentin/heart-of-the-beast/backend/internal/game"
)

func (p *Postgres) BeastHeart(ctx context.Context) (BeastHeart, error) {
	heart := BeastHeart{MaxHealth: game.BeastHeartInitialHealth}
	err := p.db.QueryRowContext(ctx, `SELECT max_health, damage, strikes, updated_at FROM beast_heart WHERE id = 1`).
		Scan(&heart.MaxHealth, &heart.Damage, &heart.Strikes, &heart.UpdatedAt)
	return heart, err
}

func (p *Postgres) RecordHeartStrike(ctx context.Context, runID, encounterID string, damage int64, now time.Time) error {
	if damage <= 0 {
		return nil
	}
	tx, err := p.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	result, err := tx.ExecContext(ctx, `
        INSERT INTO beast_heart_strikes (run_id, encounter_id, damage, struck_at)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (run_id, encounter_id) DO NOTHING
    `, runID, encounterID, damage, now.UTC())
	if err != nil {
		return err
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return tx.Commit()
	}
	if _, err := tx.ExecContext(ctx, `
        INSERT INTO beast_heart (id, max_health, damage, strikes, updated_at) VALUES (1, $1, $2, 1, $3)
        ON CONFLICT (id) DO UPDATE SET damage = beast_heart.damage + EXCLUDED.damage, strikes = beast_heart.strikes + 1, updated_at = EXCLUDED.updated_at
    `, game.BeastHeartInitialHealth, damage, now.UTC()); err != nil {
		return err
	}
	return tx.Commit()
}
