package store

import (
	"context"
	"time"
)

func (p *Postgres) RecordCampaignCompletion(ctx context.Context, profileID, campaignID, runID string, now time.Time) error {
	tx, err := p.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	result, err := tx.ExecContext(ctx, `
        INSERT INTO player_profile_campaign_awards (profile_id, run_id, campaign_id, awarded_at)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (profile_id, run_id) DO NOTHING
    `, profileID, runID, campaignID, now.UTC())
	if err != nil {
		return err
	}
	if rows, err := result.RowsAffected(); err != nil || rows == 0 {
		if err != nil {
			return err
		}
		return tx.Commit()
	}
	if _, err := tx.ExecContext(ctx, `
        INSERT INTO player_profile_campaigns (profile_id, campaign_id, completions, first_completed_at, last_completed_at)
        VALUES ($1, $2, 1, $3, $3)
        ON CONFLICT (profile_id, campaign_id) DO UPDATE SET
            completions = player_profile_campaigns.completions + 1,
            last_completed_at = EXCLUDED.last_completed_at
    `, profileID, campaignID, now.UTC()); err != nil {
		return err
	}
	return tx.Commit()
}

// loadProfileRecords fills in what a profile has earned beyond its own row: its bestiary and its campaign trophies.
func (p *Postgres) loadProfileRecords(ctx context.Context, profile *Profile) error {
	if err := p.loadBestiary(ctx, profile); err != nil {
		return err
	}
	rows, err := p.db.QueryContext(ctx, `
        SELECT campaign_id, completions, first_completed_at, last_completed_at
        FROM player_profile_campaigns WHERE profile_id = $1
    `, profile.ID)
	if err != nil {
		return err
	}
	defer rows.Close()
	profile.Campaigns = map[string]CampaignRecord{}
	for rows.Next() {
		var record CampaignRecord
		if err := rows.Scan(&record.CampaignID, &record.Completions, &record.FirstCompletedAt, &record.LastCompletedAt); err != nil {
			return err
		}
		profile.Campaigns[record.CampaignID] = record
	}
	return rows.Err()
}
