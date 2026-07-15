ALTER TABLE "nominations" ADD COLUMN "slack_channel_id" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "nominations" ADD COLUMN "slack_channel_name" text DEFAULT '' NOT NULL;