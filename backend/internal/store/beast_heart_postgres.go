package store

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	"github.com/swarkentin/heart-of-the-beast/backend/internal/game"
)

func (p *Postgres) BeastHeart(ctx context.Context) (BeastHeart, error) {
	heart := BeastHeart{MaxHealth: game.BeastHeartInitialHealth}
	err := p.db.QueryRowContext(ctx, `SELECT max_health, damage, strikes, updated_at FROM beast_heart WHERE id = 1`).
		Scan(&heart.MaxHealth, &heart.Damage, &heart.Strikes, &heart.UpdatedAt)
	return heart, err
}

func (p *Postgres) RecordHeartStrike(ctx context.Context, record HeartStrikeRecord, now time.Time) error {
	tx, err := p.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	result, err := tx.ExecContext(ctx, `
        INSERT INTO beast_heart_strikes (run_id, encounter_id, theme_id, dungeon, struck_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $5)
        ON CONFLICT (run_id, encounter_id) DO NOTHING
    `, record.RunID, record.EncounterID, record.ThemeID, record.Dungeon, now.UTC())
	if err != nil {
		return err
	}
	created, err := result.RowsAffected()
	if err != nil {
		return err
	}
	// Serialise every write to one fight, so two requests cannot both count the same new damage.
	if _, err := tx.ExecContext(ctx, `SELECT 1 FROM beast_heart_strikes WHERE run_id = $1 AND encounter_id = $2 FOR UPDATE`, record.RunID, record.EncounterID); err != nil {
		return err
	}
	var added int64
	for _, contribution := range record.Contributions {
		if contribution.Damage <= 0 {
			continue
		}
		var previous int64
		err := tx.QueryRowContext(ctx, `
            SELECT damage FROM beast_heart_contributions WHERE run_id = $1 AND encounter_id = $2 AND contributor = $3
        `, record.RunID, record.EncounterID, contribution.Contributor).Scan(&previous)
		if err != nil && !isNoRows(err) {
			return err
		}
		if contribution.Damage <= previous {
			continue
		}
		if _, err := tx.ExecContext(ctx, `
            INSERT INTO beast_heart_contributions (run_id, encounter_id, contributor, profile_id, damage, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (run_id, encounter_id, contributor) DO UPDATE SET damage = EXCLUDED.damage, profile_id = EXCLUDED.profile_id, updated_at = EXCLUDED.updated_at
        `, record.RunID, record.EncounterID, contribution.Contributor, contribution.ProfileID, contribution.Damage, now.UTC()); err != nil {
			return err
		}
		added += contribution.Damage - previous
	}
	if added == 0 && created == 0 && !record.DrivenOff {
		return tx.Commit()
	}
	if _, err := tx.ExecContext(ctx, `
        UPDATE beast_heart_strikes SET damage = damage + $3, driven_off = driven_off OR $4, updated_at = $5
        WHERE run_id = $1 AND encounter_id = $2
    `, record.RunID, record.EncounterID, added, record.DrivenOff, now.UTC()); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `
        INSERT INTO beast_heart (id, max_health, damage, strikes, updated_at) VALUES (1, $1, $2, $3, $4)
        ON CONFLICT (id) DO UPDATE SET damage = beast_heart.damage + EXCLUDED.damage, strikes = beast_heart.strikes + EXCLUDED.strikes, updated_at = EXCLUDED.updated_at
    `, game.BeastHeartInitialHealth, added, created, now.UTC()); err != nil {
		return err
	}
	return tx.Commit()
}

// heartNameSeparator joins a party's names in one column; it cannot appear in a display name.
const heartNameSeparator = "\x1f"

func (p *Postgres) HeartLeaderboard(ctx context.Context, limit int) (HeartLeaderboard, error) {
	board := HeartLeaderboard{Players: []HeartPlayerScore{}, Parties: []HeartPartyScore{}}
	rows, err := p.db.QueryContext(ctx, `
        SELECT c.profile_id, COALESCE(NULLIF(MAX(pp.display_name), ''), 'Adventurer'), SUM(c.damage), COUNT(*)
        FROM beast_heart_contributions c LEFT JOIN player_profiles pp ON pp.id = c.profile_id
        WHERE c.profile_id <> '' AND c.damage > 0
        GROUP BY c.profile_id ORDER BY SUM(c.damage) DESC, 2 LIMIT $1
    `, limit)
	if err != nil {
		return board, err
	}
	for rows.Next() {
		var score HeartPlayerScore
		if err := rows.Scan(&score.ProfileID, &score.Name, &score.Damage, &score.Fights); err != nil {
			rows.Close()
			return board, err
		}
		board.Players = append(board.Players, score)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return board, err
	}
	rows, err = p.db.QueryContext(ctx, `
        SELECT s.run_id, s.theme_id, s.dungeon, s.damage, s.driven_off, s.struck_at,
            COALESCE((SELECT string_agg(COALESCE(NULLIF(pp.display_name, ''), 'Adventurer'), $2 ORDER BY c.damage DESC)
                FROM beast_heart_contributions c LEFT JOIN player_profiles pp ON pp.id = c.profile_id
                WHERE c.run_id = s.run_id AND c.encounter_id = s.encounter_id AND c.contributor <> $3 AND c.damage > 0), '')
        FROM beast_heart_strikes s WHERE s.damage > 0 ORDER BY s.damage DESC, s.struck_at LIMIT $1
    `, limit, heartNameSeparator, HeartPartyContributor)
	if err != nil {
		return board, err
	}
	defer rows.Close()
	for rows.Next() {
		var score HeartPartyScore
		var names string
		if err := rows.Scan(&score.RunID, &score.ThemeID, &score.Dungeon, &score.Damage, &score.DrivenOff, &score.At, &names); err != nil {
			return board, err
		}
		if names != "" {
			score.Names = strings.Split(names, heartNameSeparator)
		}
		board.Parties = append(board.Parties, score)
	}
	return board, rows.Err()
}

func isNoRows(err error) bool { return errors.Is(err, sql.ErrNoRows) }
