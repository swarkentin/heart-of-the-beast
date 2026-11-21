package store

import (
	"context"
	"time"
)

// BeastHeart is the shared Heart of the Beast (ADR 0040): one health pool for every party, kept across runs.
type BeastHeart struct {
	MaxHealth int64     `json:"maxHealth"`
	Damage    int64     `json:"damage"`
	Strikes   int64     `json:"strikes"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// Health is what is left of the pool. Damage past the pool is kept (so a retune never loses it) but shows as zero.
func (h BeastHeart) Health() int64 {
	if h.Damage >= h.MaxHealth {
		return 0
	}
	return h.MaxHealth - h.Damage
}

// BeastHeartRepository reads the shared heart and banks a party's strike against it. RecordHeartStrike must count
// each (run, encounter) once, so retries, polls and reconnects cannot inflate it.
type BeastHeartRepository interface {
	BeastHeart(context.Context) (BeastHeart, error)
	RecordHeartStrike(ctx context.Context, runID, encounterID string, damage int64, now time.Time) error
}
