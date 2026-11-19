package store

import (
    "context"
    "time"
)

func (m *Memory) RecordEnemyKill(_ context.Context, profileID, runID, enemyInstanceID string, kill EnemyKill, now time.Time) error {
    m.mu.Lock()
    defer m.mu.Unlock()
    awardKey := "enemy-kill:" + profileID + ":" + runID + ":" + enemyInstanceID
    if m.awards[awardKey] {
        return nil
    }
    var profile *Profile
    for _, candidate := range m.profiles {
        if candidate.ID == profileID {
            profile = candidate
            break
        }
    }
    if profile == nil {
        return ErrNotFound
    }
    if profile.Bestiary == nil {
        profile.Bestiary = map[string]BestiaryEntry{}
    }
    entry := profile.Bestiary[kill.EnemyKey]
    entry.EnemyKey = kill.EnemyKey
    entry.Name = kill.Name
    if kill.ThemeID != "" {
        entry.ThemeID = kill.ThemeID
    }
    if kill.SpriteID != "" { entry.SpriteID = kill.SpriteID }
    entry.Kills++
    if kill.Elite {
        entry.EliteKills++
    }
    profile.Bestiary[kill.EnemyKey] = entry
    profile.UpdatedAt = now.UTC()
    m.awards[awardKey] = true
    return nil
}
