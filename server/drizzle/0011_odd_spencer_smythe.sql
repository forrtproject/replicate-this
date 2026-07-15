CREATE TABLE "nomination_updates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nomination_id" uuid NOT NULL,
	"author_uid" text NOT NULL,
	"content" text NOT NULL,
	"article_url" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"nomination_id" uuid NOT NULL,
	"user_uid" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_nomination_id_user_uid_pk" PRIMARY KEY("nomination_id","user_uid")
);
--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "parent_id" uuid;--> statement-breakpoint
ALTER TABLE "nomination_updates" ADD CONSTRAINT "nomination_updates_nomination_id_nominations_id_fk" FOREIGN KEY ("nomination_id") REFERENCES "public"."nominations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nomination_updates" ADD CONSTRAINT "nomination_updates_author_uid_user_id_fk" FOREIGN KEY ("author_uid") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_nomination_id_nominations_id_fk" FOREIGN KEY ("nomination_id") REFERENCES "public"."nominations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_uid_user_id_fk" FOREIGN KEY ("user_uid") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_id_comments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Backfill unique pseudonyms before enforcing uniqueness: legacy accounts all
-- share the name 'Anonymous Researcher'. They get a deterministic placeholder
-- derived from their id (users can change it in their profile).
-- md5(id) rather than the id itself: seeded/demo ids share long prefixes.
UPDATE "user" SET "name" = 'Researcher-' || substr(md5("id"), 1, 8)
WHERE "name" = 'Anonymous Researcher' AND "deleted" = false;--> statement-breakpoint
-- De-duplicate any remaining case-insensitive collisions among chosen names,
-- keeping the oldest account's name untouched.
UPDATE "user" u SET "name" = u."name" || '-' || substr(md5(u."id"), 1, 6)
WHERE u."deleted" = false AND EXISTS (
  SELECT 1 FROM "user" v
  WHERE v."deleted" = false AND lower(v."name") = lower(u."name")
    AND (v."created_at" < u."created_at" OR (v."created_at" = u."created_at" AND v."id" < u."id"))
);--> statement-breakpoint
CREATE UNIQUE INDEX "user_name_lower_idx" ON "user" USING btree (lower("name")) WHERE "user"."deleted" = false;