import { index, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * Corporate/bulk-gifting page (app/corporate-gifting/page.tsx) enquiries — a lead-capture form,
 * not a checkout: this project takes no order or payment here, it only records "someone wants a
 * quote" so staff can follow up by phone/email/WhatsApp. Kept separate from `phone_leads` (a
 * different purpose/consent basis, same reasoning that table's own doc already gives for staying
 * separate from `newsletter_subs`) and from `orders` (there is no price, variant or payment
 * attached to this yet — it's pre-sales). `status` lets staff track follow-up from the admin
 * without a second table; no admin UI ships for it in this pass (flagged, not built) — reading the
 * raw table via `pnpm db:studio` is the interim workflow until one exists.
 */
/**
 * General "Contact Us" page submissions (app/contact/page.tsx) — a different purpose from
 * `bulk_enquiries` (a sales/quote lead with company/country/enquiry-type fields) and from
 * `phone_leads` (marketing consent capture): this is a plain "customer has a question" message,
 * so it only asks for what answering one actually needs. Kept as its own table rather than
 * shoehorned into either of the others, the same "separate table per distinct purpose" reasoning
 * `phone_leads`' own doc comment gives for staying out of `newsletter_subs`.
 */
export const contactMessages = pgTable("contact_messages", {
  id: integer().generatedAlwaysAsIdentity().primaryKey(),
  name: text().notNull(),
  email: text().notNull(),
  phone: text(),
  message: text().notNull(),
  status: text().notNull().default("new"),
  sourcePath: text("source_path"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const bulkEnquiries = pgTable("bulk_enquiries", {
  id: integer().generatedAlwaysAsIdentity().primaryKey(),
  enquiryType: text("enquiry_type").notNull(),
  fullName: text("full_name").notNull(),
  company: text(),
  email: text().notNull(),
  phone: text().notNull(),
  country: text().notNull(),
  website: text(),
  requirement: text().notNull(),
  status: text().notNull().default("new"),
  sourcePath: text("source_path"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Phone numbers captured by the landing popup (components/marketing/PhoneCapturePopup.tsx) — a
 * separate table from `newsletter_subs` rather than a generalised "subscribers" table, because the
 * consent behind it is a different, specific purpose (WhatsApp/SMS marketing, not an email
 * newsletter) and DPDP-style consent needs to be provable per-purpose, not implied by reuse of an
 * unrelated opt-in. `consentAt` is the moment the (unticked-by-default) checkbox was submitted
 * checked — never backfilled or assumed. `visitorId` links this identity back to whatever
 * `visitor_events` rows the same browser already generated before the popup was ever answered, so
 * "viewed Blue Tea, didn't buy" can actually be joined to a real phone number for messaging.
 */
export const phoneLeads = pgTable(
  "phone_leads",
  {
    id: integer().generatedAlwaysAsIdentity().primaryKey(),
    phone: text().notNull(),
    consentAt: timestamp("consent_at", { withTimezone: true }).notNull(),
    visitorId: text("visitor_id"),
    sourcePath: text("source_path"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("phone_leads_phone_uniq").on(t.phone)],
);

/**
 * A minimal, first-party pageview/product-view log keyed by the anonymous `visitor_id` cookie
 * middleware.ts assigns on first request — no third-party analytics script, nothing added to
 * CLAUDE.md §2's fixed stack. Deliberately just `eventType` + `path`, not a `productId` foreign
 * key: a path already identifies a product page (`/product/<slug>`) well enough for messaging
 * purposes ("this number viewed Blue Tea"), and skipping the FK avoids an on-delete policy
 * question for a product that gets archived later.
 */
export const visitorEvents = pgTable(
  "visitor_events",
  {
    id: integer().generatedAlwaysAsIdentity().primaryKey(),
    visitorId: text("visitor_id").notNull(),
    eventType: text("event_type").notNull(),
    path: text().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("visitor_events_visitor_id_created_at_idx").on(t.visitorId, t.createdAt)],
);
