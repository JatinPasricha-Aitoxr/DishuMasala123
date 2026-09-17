CREATE TABLE "phone_leads" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "phone_leads_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"phone" text NOT NULL,
	"consent_at" timestamp with time zone NOT NULL,
	"visitor_id" text,
	"source_path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visitor_events" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "visitor_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"visitor_id" text NOT NULL,
	"event_type" text NOT NULL,
	"path" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "phone_leads_phone_uniq" ON "phone_leads" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "visitor_events_visitor_id_created_at_idx" ON "visitor_events" USING btree ("visitor_id","created_at");