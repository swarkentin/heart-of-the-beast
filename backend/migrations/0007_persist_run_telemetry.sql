-- Persist server-authored snapshots for every versioned run transition. The room update and
-- telemetry writes share one PostgreSQL transaction through this trigger.
CREATE TABLE IF NOT EXISTS run_telemetry_events (
    run_id TEXT NOT NULL,
    room_id TEXT NOT NULL,
    room_version BIGINT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    PRIMARY KEY (run_id, room_version)
);

CREATE INDEX IF NOT EXISTS run_telemetry_events_time_idx
    ON run_telemetry_events (occurred_at DESC);

CREATE TABLE IF NOT EXISTS run_telemetry_runs (
    run_id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ NOT NULL,
    outcome TEXT NOT NULL CHECK (outcome IN ('completed', 'failed')),
    theme_id TEXT NOT NULL DEFAULT '',
    seed NUMERIC(20, 0),
    depth INTEGER NOT NULL DEFAULT 0,
    floors_cleared INTEGER NOT NULL DEFAULT 0,
    encounters_cleared INTEGER NOT NULL DEFAULT 0,
    party_size INTEGER NOT NULL DEFAULT 0,
    duration_ms BIGINT,
    run_snapshot JSONB NOT NULL,
    participant_profiles JSONB NOT NULL DEFAULT '{}'::jsonb,
    participant_classes JSONB NOT NULL DEFAULT '{}'::jsonb,
    participant_archetypes JSONB NOT NULL DEFAULT '{}'::jsonb,
    participant_loadouts JSONB NOT NULL DEFAULT '{}'::jsonb,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS run_telemetry_runs_started_idx
    ON run_telemetry_runs (started_at DESC);
CREATE INDEX IF NOT EXISTS run_telemetry_runs_outcome_theme_depth_idx
    ON run_telemetry_runs (outcome, theme_id, depth);
CREATE INDEX IF NOT EXISTS run_telemetry_runs_party_size_idx
    ON run_telemetry_runs (party_size, started_at DESC);

COMMENT ON TABLE run_telemetry_events IS
    'Append-only authoritative run-state snapshots, one per persisted room version during a real run.';
COMMENT ON TABLE run_telemetry_runs IS
    'One immutable terminal record per real run; profile IDs are pseudonymous and no credentials or display names are stored.';

CREATE OR REPLACE FUNCTION capture_run_telemetry() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    run_state JSONB;
    run_identifier TEXT;
    run_started_at TIMESTAMPTZ;
    run_completed_at TIMESTAMPTZ;
    run_outcome TEXT;
BEGIN
    run_state := NEW.state->'run';
    IF run_state IS NULL OR run_state = 'null'::jsonb THEN
        RETURN NEW;
    END IF;

    run_identifier := NULLIF(run_state->>'id', '');
    IF run_identifier IS NULL THEN
        RETURN NEW;
    END IF;

    -- Store only gameplay state and pseudonymous profile/build references. In particular,
    -- never copy the room aggregate wholesale: it contains bearer-token hashes.
    INSERT INTO run_telemetry_events (
        run_id, room_id, room_version, occurred_at, event_type, payload
    ) VALUES (
        run_identifier,
        NEW.id,
        NEW.version,
        NEW.updated_at,
        'room_state_snapshot',
        jsonb_build_object(
            'run', run_state,
            'participantProfileIds', COALESCE(NEW.state->'playerProfileIds', '{}'::jsonb),
            'playerClasses', COALESCE(NEW.state->'playerClasses', '{}'::jsonb),
            'playerArchetypes', COALESCE(NEW.state->'playerArchetypes', '{}'::jsonb),
            'playerLoadouts', COALESCE(NEW.state->'playerLoadouts', '{}'::jsonb)
        )
    )
    ON CONFLICT (run_id, room_version) DO NOTHING;

    run_outcome := run_state->>'phase';
    IF run_outcome NOT IN ('completed', 'failed') THEN
        RETURN NEW;
    END IF;

    run_started_at := NULLIF(run_state->>'startedAt', '')::timestamptz;
    run_completed_at := NULLIF(run_state->>'completedAt', '')::timestamptz;
    IF run_started_at IS NULL OR run_completed_at IS NULL THEN
        RAISE EXCEPTION 'terminal run % is missing start or completion timestamp', run_identifier;
    END IF;

    INSERT INTO run_telemetry_runs (
        run_id, room_id, started_at, completed_at, outcome, theme_id, seed,
        depth, floors_cleared, encounters_cleared, party_size, duration_ms,
        run_snapshot, participant_profiles, participant_classes,
        participant_archetypes, participant_loadouts
    ) VALUES (
        run_identifier,
        NEW.id,
        run_started_at,
        run_completed_at,
        run_outcome,
        COALESCE(run_state->>'themeId', ''),
        NULLIF(run_state->>'seed', '')::numeric,
        COALESCE(NULLIF(run_state->>'depth', '')::integer, 0),
        COALESCE(NULLIF(run_state->>'floorsCleared', '')::integer, 0),
        COALESCE(NULLIF(run_state->>'encountersCleared', '')::integer, 0),
        jsonb_object_length(COALESCE(run_state->'players', '{}'::jsonb)),
        GREATEST(0, floor(extract(epoch FROM (run_completed_at - run_started_at)) * 1000)::bigint),
        run_state,
        COALESCE(NEW.state->'playerProfileIds', '{}'::jsonb),
        COALESCE(NEW.state->'playerClasses', '{}'::jsonb),
        COALESCE(NEW.state->'playerArchetypes', '{}'::jsonb),
        COALESCE(NEW.state->'playerLoadouts', '{}'::jsonb)
    )
    ON CONFLICT (run_id) DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rooms_capture_run_telemetry ON rooms;
CREATE TRIGGER rooms_capture_run_telemetry
    AFTER UPDATE OF state, version ON rooms
    FOR EACH ROW
    WHEN (NEW.version > OLD.version)
    EXECUTE FUNCTION capture_run_telemetry();
