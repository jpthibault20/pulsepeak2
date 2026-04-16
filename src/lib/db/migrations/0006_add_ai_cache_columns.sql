-- Cache AI summary and deviation metrics to avoid recalculating on every view
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS ai_summary text;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS ai_deviation_cache jsonb;
