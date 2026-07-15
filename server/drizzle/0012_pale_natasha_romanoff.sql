ALTER TABLE "user" ADD COLUMN "notification_email" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "email_prefs" jsonb DEFAULT '{}'::jsonb NOT NULL;