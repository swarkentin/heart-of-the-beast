package store

import (
    "context"
    "time"
)

// BestiaryEntry is lifetime knowledge about one creature family, independent
// of any particular run or character.
type BestiaryEntry struct {
    EnemyKey string `json:"enemyKey"`
    Name string `json:"name"`
    ThemeID string `json:"themeId,omitempty"`
    Kills int `json:"kills"`
    EliteKills int `json:"eliteKills"`
}

type EnemyKill struct {
    EnemyKey string
    Name string
    ThemeID string
    Elite bool
}

// BestiaryRepository records a server-confirmed defeat. Implementations must
// make (profile, run, enemy instance) idempotent for retries/reconnects.
type BestiaryRepository interface {
    RecordEnemyKill(context.Context, string, string, string, EnemyKill, time.Time) error
}
