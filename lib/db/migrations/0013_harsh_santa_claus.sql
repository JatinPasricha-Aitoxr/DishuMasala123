CREATE TABLE "bulk_enquiries" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bulk_enquiries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"enquiry_type" text NOT NULL,
	"full_name" text NOT NULL,
	"company" text,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"country" text NOT NULL,
	"website" text,
	"requirement" text NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"source_path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
