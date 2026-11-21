package store

import (
	"context"
	"time"

	"github.com/swarkentin/heart-of-the-beast/backend/internal/game"
)

func (m *Memory) BeastHeart(_ context.Context) (BeastHeart, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return BeastHeart{MaxHealth: game.BeastHeartInitialHealth, Damage: m.heartDamage, Strikes: m.heartStrikes, UpdatedAt: m.heartUpdated}, nil
}

func (m *Memory) RecordHeartStrike(_ context.Context, runID, encounterID string, damage int64, now time.Time) error {
	if damage <= 0 {
		return nil
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	key := "heart-strike:" + runID + ":" + encounterID
	if m.awards[key] {
		return nil
	}
	m.awards[key] = true
	m.heartDamage += damage
	m.heartStrikes++
	m.heartUpdated = now.UTC()
	return nil
}
