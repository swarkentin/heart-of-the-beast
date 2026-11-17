-- Optional sign-in (ADR 0034). A profile keeps its original guest credential in
-- player_profiles.credential_hash; each extra device that signs in to the same
-- account gets its own credential here.
CREATE TABLE IF NOT EXISTS profile_credentials (
    credential_hash CHAR(64) PRIMARY KEY,
    profile_id TEXT NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS profile_credentials_profile_idx
    ON profile_credentials (profile_id);

-- One external identity per provider account, and at most one per provider for
-- each profile.
CREATE TABLE IF NOT EXISTS profile_identities (
    provider TEXT NOT NULL,
    provider_subject TEXT NOT NULL,
    profile_id TEXT NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
    username TEXT NOT NULL DEFAULT '',
    linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (provider, provider_subject),
    UNIQUE (profile_id, provider)
);

-- Short-lived, single-use sign-in attempts. The state is bound to the guest
-- credential that started it; provider_subject is filled in when the player
-- must choose between this device's progress and the account's profile.
CREATE TABLE IF NOT EXISTS profile_sign_ins (
    state_hash CHAR(64) PRIMARY KEY,
    provider TEXT NOT NULL,
    credential_hash CHAR(64) NOT NULL,
    provider_subject TEXT NOT NULL DEFAULT '',
    username TEXT NOT NULL DEFAULT '',
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS profile_sign_ins_expires_idx
    ON profile_sign_ins (expires_at);
