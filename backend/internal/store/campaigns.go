package store

import (
	"context"
	"time"
)

// CampaignRecord is a profile's trophy for one campaign (ADR 0041): when it was first won and how often.
type CampaignRecord struct {
	CampaignID       string    `json:"campaignId"`
	Completions      int       `json:"completions"`
	FirstCompletedAt time.Time `json:"firstCompletedAt"`
	LastCompletedAt  time.Time `json:"lastCompletedAt"`
}

// CampaignRepository records campaign wins. A (profile, run) pair is credited once, so banking a won run after
// every request never counts it twice.
type CampaignRepository interface {
	RecordCampaignCompletion(ctx context.Context, profileID, campaignID, runID string, now time.Time) error
}
