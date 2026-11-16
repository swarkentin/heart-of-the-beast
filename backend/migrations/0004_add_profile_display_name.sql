ALTER TABLE player_profiles
    ADD COLUMN IF NOT EXISTS display_name TEXT NOT NULL DEFAULT 'Adventurer';
