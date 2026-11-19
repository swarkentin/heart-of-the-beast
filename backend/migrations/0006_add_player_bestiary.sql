-- Lifetime bestiary progress is profile-wide and survives every run.
CREATE TABLE IF NOT EXISTS player_profile_enemy_kills (
    profile_id TEXT NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
    enemy_key TEXT NOT NULL,
    enemy_name TEXT NOT NULL,
    theme_id TEXT NOT NULL DEFAULT '',
    sprite_id TEXT NOT NULL DEFAULT '',
    kill_count INTEGER NOT NULL DEFAULT 0 CHECK (kill_count >= 0),
    elite_kill_count INTEGER NOT NULL DEFAULT 0 CHECK (elite_kill_count >= 0),
    first_killed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_killed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (profile_id, enemy_key)
);

-- A kill can be credited only once to a profile, even if a command is retried.
CREATE TABLE IF NOT EXISTS player_profile_enemy_kill_awards (
    profile_id TEXT NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
    run_id TEXT NOT NULL,
    enemy_instance_id TEXT NOT NULL,
    awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (profile_id, run_id, enemy_instance_id)
);

CREATE INDEX IF NOT EXISTS player_profile_enemy_kills_profile_idx
    ON player_profile_enemy_kills (profile_id, kill_count DESC);
