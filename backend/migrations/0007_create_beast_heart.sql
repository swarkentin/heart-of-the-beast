-- The Heart of the Beast (ADR 0040): one health pool shared by every party on the server and kept across runs.
-- It is a single row; max_health can be raised in place to retune the pool without losing the damage dealt.
CREATE TABLE IF NOT EXISTS beast_heart (
    id SMALLINT PRIMARY KEY CHECK (id = 1),
    max_health BIGINT NOT NULL CHECK (max_health > 0),
    damage BIGINT NOT NULL DEFAULT 0 CHECK (damage >= 0),
    strikes BIGINT NOT NULL DEFAULT 0 CHECK (strikes >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO beast_heart (id, max_health) VALUES (1, 1000000) ON CONFLICT (id) DO NOTHING;

-- One row per party fight against the heart: the party's high score.
CREATE TABLE IF NOT EXISTS beast_heart_strikes (
    run_id TEXT NOT NULL,
    encounter_id TEXT NOT NULL,
    theme_id TEXT NOT NULL DEFAULT '',
    dungeon INTEGER NOT NULL DEFAULT 0,
    damage BIGINT NOT NULL DEFAULT 0 CHECK (damage >= 0),
    driven_off BOOLEAN NOT NULL DEFAULT FALSE,
    struck_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (run_id, encounter_id)
);

CREATE INDEX IF NOT EXISTS beast_heart_strikes_damage_idx ON beast_heart_strikes (damage DESC);

-- What each player (or, for damage no one player dealt, the party) did in a fight. Damage only ever grows: it is
-- the running total of the fight, so retries, polls and reconnects can resend it without counting it twice.
CREATE TABLE IF NOT EXISTS beast_heart_contributions (
    run_id TEXT NOT NULL,
    encounter_id TEXT NOT NULL,
    contributor TEXT NOT NULL,
    profile_id TEXT NOT NULL DEFAULT '',
    damage BIGINT NOT NULL DEFAULT 0 CHECK (damage >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (run_id, encounter_id, contributor),
    FOREIGN KEY (run_id, encounter_id) REFERENCES beast_heart_strikes (run_id, encounter_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS beast_heart_contributions_profile_idx ON beast_heart_contributions (profile_id) WHERE profile_id <> '';
