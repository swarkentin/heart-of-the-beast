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

-- Each fight against the heart counts once, however often its result is saved, retried or polled.
CREATE TABLE IF NOT EXISTS beast_heart_strikes (
    run_id TEXT NOT NULL,
    encounter_id TEXT NOT NULL,
    damage BIGINT NOT NULL CHECK (damage >= 0),
    struck_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (run_id, encounter_id)
);
