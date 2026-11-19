package store

import (
    "context"
    "time"
)

func (p *Postgres) RecordEnemyKill(ctx context.Context, profileID, runID, enemyInstanceID string, kill EnemyKill, now time.Time) error {
    tx, err := p.db.BeginTx(ctx, nil)
    if err != nil { return err }
    defer tx.Rollback()

    result, err := tx.ExecContext(ctx, `
        INSERT INTO player_profile_enemy_kill_awards (profile_id, run_id, enemy_instance_id, awarded_at)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (profile_id, run_id, enemy_instance_id) DO NOTHING
    `, profileID, runID, enemyInstanceID, now.UTC())
    if err != nil { return err }
    rows, err := result.RowsAffected()
    if err != nil { return err }
    if rows == 0 { return tx.Commit() }

    _, err = tx.ExecContext(ctx, `
        INSERT INTO player_profile_enemy_kills
            (profile_id, enemy_key, enemy_name, theme_id, sprite_id, kill_count, elite_kill_count, first_killed_at, last_killed_at)
        VALUES ($1, $2, $3, $4, $5, 1, CASE WHEN $6 THEN 1 ELSE 0 END, $7, $7)
        ON CONFLICT (profile_id, enemy_key) DO UPDATE SET
            enemy_name = EXCLUDED.enemy_name,
            sprite_id = CASE WHEN EXCLUDED.sprite_id <> '' THEN EXCLUDED.sprite_id ELSE player_profile_enemy_kills.sprite_id END,
            theme_id = CASE WHEN EXCLUDED.theme_id <> '' THEN EXCLUDED.theme_id ELSE player_profile_enemy_kills.theme_id END,
            kill_count = player_profile_enemy_kills.kill_count + 1,
            elite_kill_count = player_profile_enemy_kills.elite_kill_count + CASE WHEN $5 THEN 1 ELSE 0 END,
            last_killed_at = EXCLUDED.last_killed_at
    `, profileID, kill.EnemyKey, kill.Name, kill.ThemeID, kill.SpriteID, kill.Elite, now.UTC())
    if err != nil { return err }
    if err := tx.Commit(); err != nil { return err }
    return nil
}

func (p *Postgres) loadBestiary(ctx context.Context, profile *Profile) error {
    rows, err := p.db.QueryContext(ctx, `
        SELECT enemy_key, enemy_name, theme_id, sprite_id, kill_count, elite_kill_count
        FROM player_profile_enemy_kills WHERE profile_id = $1 ORDER BY kill_count DESC, enemy_name
    `, profile.ID)
    if err != nil { return err }
    defer rows.Close()
    profile.Bestiary = map[string]BestiaryEntry{}
    for rows.Next() {
        var entry BestiaryEntry
        if err := rows.Scan(&entry.EnemyKey, &entry.Name, &entry.ThemeID, &entry.SpriteID, &entry.Kills, &entry.EliteKills); err != nil { return err }
        profile.Bestiary[entry.EnemyKey] = entry
    }
    return rows.Err()
}

