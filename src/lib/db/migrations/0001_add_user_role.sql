-- Migration: Add user_role enum and role column to profiles
-- Run this against your Supabase/PostgreSQL database if using drizzle-kit push isn't available.

DO $$ BEGIN
    CREATE TYPE "public"."user_role" AS ENUM ('user', 'freeUse', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "profiles"
    ADD COLUMN IF NOT EXISTS "role" "user_role" NOT NULL DEFAULT 'user';
