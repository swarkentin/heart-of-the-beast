CREATE TABLE IF NOT EXISTS player_profiles (
    id TEXT PRIMARY KEY,
    credential_hash CHAR(64) NOT NULL UNIQUE,
    adventurer_xp BIGINT NOT NULL DEFAULT 0 CHECK (adventurer_xp >= 0),
    adventurer_level INTEGER NOT NULL DEFAULT 1 CHECK (adventurer_level >= 1),
    class_mastery JSONB NOT NULL DEFAULT '{}'::jsonb,
    unlocked_cosmetics JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS player_profiles_last_seen_at_idx
    ON player_profiles (last_seen_at);
