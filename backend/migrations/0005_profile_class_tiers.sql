ALTER TABLE player_profiles
    ADD COLUMN IF NOT EXISTS selected_class_tiers JSONB NOT NULL DEFAULT '{}'::jsonb;
