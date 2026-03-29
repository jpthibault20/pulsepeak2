-- Add 'other' to sport_type enum for custom sports (hiking, climbing, etc.)
ALTER TYPE sport_type ADD VALUE IF NOT EXISTS 'other';
