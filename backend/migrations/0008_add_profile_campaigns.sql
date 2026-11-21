-- Campaign trophies (ADR 0041): how many times each profile has won each campaign.
CREATE TABLE IF NOT EXISTS player_profile_campaigns (
    profile_id TEXT NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
    campaign_id TEXT NOT NULL,
    completions INTEGER NOT NULL DEFAULT 0 CHECK (completions >= 0),
    first_completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (profile_id, campaign_id)
);

-- A won run is credited to a profile once, however often it is banked.
CREATE TABLE IF NOT EXISTS player_profile_campaign_awards (
    profile_id TEXT NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
    run_id TEXT NOT NULL,
    campaign_id TEXT NOT NULL,
    awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (profile_id, run_id)
);
