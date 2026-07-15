ALTER TABLE "nominations" ADD COLUMN "data_location" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "nominations" ADD COLUMN "robustness_checks" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "nominations" ADD COLUMN "design_deviations" text DEFAULT '' NOT NULL;