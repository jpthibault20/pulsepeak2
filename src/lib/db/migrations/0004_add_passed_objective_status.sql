-- Add 'passed' to objective_status enum for objectives whose date has passed
ALTER TYPE objective_status ADD VALUE IF NOT EXISTS 'passed';
