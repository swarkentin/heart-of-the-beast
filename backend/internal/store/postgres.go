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
