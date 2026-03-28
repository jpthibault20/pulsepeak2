ALTER TABLE "profiles" ADD COLUMN "plan" varchar(20) DEFAULT 'free' NOT NULL;--> statement-breakpoint
UPDATE "profiles" SET "plan" = 'dev';
