CREATE TABLE IF NOT EXISTS player_profile_run_awards (
    award_key TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
    run_id TEXT NOT NULL,
    player_id TEXT NOT NULL,
    xp BIGINT NOT NULL CHECK (xp > 0),
    class_id TEXT,
    awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (profile_id, run_id)
);

CREATE INDEX IF NOT EXISTS player_profile_run_awards_profile_idx
    ON player_profile_run_awards (profile_id, awarded_at DESC);
