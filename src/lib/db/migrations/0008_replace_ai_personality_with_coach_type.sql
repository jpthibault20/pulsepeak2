-- Replace the unused ai_personality column with coach_type so each athlete can
-- pick the coach style that drives their AI prompts (cycling / running / swimming / triathlon).
DO $$ BEGIN
    CREATE TYPE "coach_type" AS ENUM ('cycling', 'running', 'swimming', 'triathlon');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS coach_type coach_type NOT NULL DEFAULT 'triathlon';

ALTER TABLE profiles DROP COLUMN IF EXISTS ai_personality;
DROP TYPE IF EXISTS ai_personality;
