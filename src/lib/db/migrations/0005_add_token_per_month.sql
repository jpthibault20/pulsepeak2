-- Monthly AI token consumption tracking
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS token_per_month integer NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS token_per_month_reset_date date;
