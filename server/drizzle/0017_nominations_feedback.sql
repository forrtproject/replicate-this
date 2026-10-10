CREATE TABLE "comment_flags" (
	"comment_id" uuid NOT NULL,
	"user_uid" text NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comment_flags_comment_id_user_uid_pk" PRIMARY KEY("comment_id","user_uid")
);
--> statement-breakpoint
CREATE TABLE "comment_likes" (
	"comment_id" uuid NOT NULL,
	"user_uid" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comment_likes_comment_id_user_uid_pk" PRIMARY KEY("comment_id","user_uid")
);
--> statement-breakpoint
ALTER TABLE "nominations" ALTER COLUMN "doi" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "nominations" ADD COLUMN "discipline_other" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "comment_flags" ADD CONSTRAINT "comment_flags_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_flags" ADD CONSTRAINT "comment_flags_user_uid_user_id_fk" FOREIGN KEY ("user_uid") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_likes" ADD CONSTRAINT "comment_likes_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_likes" ADD CONSTRAINT "comment_likes_user_uid_user_id_fk" FOREIGN KEY ("user_uid") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Every existing account gets the welcome notification new sign-ups now receive.
INSERT INTO "notifications" ("user_uid", "type", "data")
SELECT "id", 'welcome', '{}'::jsonb FROM "user"
WHERE "deleted" = false
  AND NOT EXISTS (
    SELECT 1 FROM "notifications" n WHERE n."user_uid" = "user"."id" AND n."type" = 'welcome'
  );
