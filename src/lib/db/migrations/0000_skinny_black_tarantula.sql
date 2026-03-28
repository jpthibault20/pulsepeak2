CREATE TYPE "public"."ai_personality" AS ENUM('Strict', 'Encourageant', 'Analytique');--> statement-breakpoint
CREATE TYPE "public"."experience" AS ENUM('Débutant', 'Intermédiaire', 'Avancé');--> statement-breakpoint
CREATE TYPE "public"."objective_priority" AS ENUM('principale', 'secondaire');--> statement-breakpoint
CREATE TYPE "public"."objective_status" AS ENUM('upcoming', 'completed', 'missed');--> statement-breakpoint
CREATE TYPE "public"."plan_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."sport_type" AS ENUM('cycling', 'running', 'swimming');--> statement-breakpoint
CREATE TYPE "public"."week_type" AS ENUM('Load', 'Recovery', 'Taper');--> statement-breakpoint
CREATE TYPE "public"."workout_mode" AS ENUM('Outdoor', 'Indoor');--> statement-breakpoint
CREATE TYPE "public"."workout_status" AS ENUM('pending', 'completed', 'missed');--> statement-breakpoint
CREATE TABLE "blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"order_index" integer NOT NULL,
	"type" varchar(50) NOT NULL,
	"theme" text,
	"week_count" integer NOT NULL,
	"start_date" date NOT NULL,
	"start_ctl" real,
	"target_ctl" real,
	"avg_weekly_tss" real
);
--> statement-breakpoint
CREATE TABLE "objectives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" varchar(255) NOT NULL,
	"date" date NOT NULL,
	"sport" varchar(50) NOT NULL,
	"distance_km" real,
	"elevation_gain_m" real,
	"priority" "objective_priority" DEFAULT 'secondaire' NOT NULL,
	"status" "objective_status" DEFAULT 'upcoming' NOT NULL,
	"comment" text
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" varchar(255) NOT NULL,
	"start_date" date NOT NULL,
	"goal_date" date,
	"macro_strategy_description" text,
	"status" "plan_status" DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	"first_name" varchar(100) DEFAULT '' NOT NULL,
	"last_name" varchar(100) DEFAULT '' NOT NULL,
	"email" varchar(255) DEFAULT '' NOT NULL,
	"birth_date" date,
	"weight" real,
	"height" real,
	"experience" "experience",
	"current_ctl" real DEFAULT 0 NOT NULL,
	"current_atl" real DEFAULT 0 NOT NULL,
	"active_sports" jsonb,
	"weekly_availability" jsonb,
	"heart_rate" jsonb,
	"cycling" jsonb,
	"running" jsonb,
	"swimming" jsonb,
	"ai_personality" "ai_personality" DEFAULT 'Analytique' NOT NULL,
	"strava" jsonb,
	"goal" text DEFAULT '' NOT NULL,
	"objective_date" date,
	"weaknesses" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weeks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"week_number" integer NOT NULL,
	"type" "week_type" NOT NULL,
	"target_tss" real,
	"actual_tss" real DEFAULT 0 NOT NULL,
	"user_feedback" text
);
--> statement-breakpoint
CREATE TABLE "workouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"week_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"date" date NOT NULL,
	"sport_type" "sport_type" NOT NULL,
	"title" varchar(255) NOT NULL,
	"workout_type" varchar(100),
	"mode" "workout_mode" DEFAULT 'Outdoor' NOT NULL,
	"status" "workout_status" DEFAULT 'pending' NOT NULL,
	"planned_data" jsonb,
	"completed_data" jsonb
);
--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weeks" ADD CONSTRAINT "weeks_block_id_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weeks" ADD CONSTRAINT "weeks_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_week_id_weeks_id_fk" FOREIGN KEY ("week_id") REFERENCES "public"."weeks"("id") ON DELETE set null ON UPDATE no action;