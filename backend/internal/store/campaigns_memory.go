package store

import (
	"context"
	"time"
)

func (m *Memory) RecordCampaignCompletion(_ context.Context, profileID, campaignID, runID string, now time.Time) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	awardKey := "campaign:" + profileID + ":" + runID
	if m.awards[awardKey] {
		return nil
	}
	for _, profile := range m.profiles {
		if profile.ID != profileID {
			continue
		}
		if profile.Campaigns == nil {
			profile.Campaigns = map[string]CampaignRecord{}
		}
		record := profile.Campaigns[campaignID]
		if record.Completions == 0 {
			record.CampaignID, record.FirstCompletedAt = campaignID, now.UTC()
		}
		record.Completions++
		record.LastCompletedAt = now.UTC()
		profile.Campaigns[campaignID] = record
		profile.UpdatedAt = now.UTC()
		m.awards[awardKey] = true
		return nil
	}
	return ErrNotFound
}
