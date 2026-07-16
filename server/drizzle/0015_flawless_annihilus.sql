CREATE TABLE "team_email_shares" (
	"nomination_id" uuid NOT NULL,
	"sharer_uid" text NOT NULL,
	"recipient_uid" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_email_shares_nomination_id_sharer_uid_recipient_uid_pk" PRIMARY KEY("nomination_id","sharer_uid","recipient_uid")
);
--> statement-breakpoint
ALTER TABLE "nominations" ADD COLUMN "experimental_research" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "onboarded" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "team_email_shares" ADD CONSTRAINT "team_email_shares_nomination_id_nominations_id_fk" FOREIGN KEY ("nomination_id") REFERENCES "public"."nominations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_email_shares" ADD CONSTRAINT "team_email_shares_sharer_uid_user_id_fk" FOREIGN KEY ("sharer_uid") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_email_shares" ADD CONSTRAINT "team_email_shares_recipient_uid_user_id_fk" FOREIGN KEY ("recipient_uid") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;