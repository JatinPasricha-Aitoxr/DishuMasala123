import { boolean, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { userRoleEnum } from "./enums";

/**
 * The application's own user record. Identity and credentials live in Supabase Auth's
 * `auth.users`; this table stays the app's user — it keeps the integer primary key that
 * `addresses`, `orders`, `reviews`, `wishlist_items` and `audit_log` all reference, and it owns
 * the fields Supabase Auth has no opinion about (name, phone, role).
 *
 * `authUserId` is the join to `auth.users.id`. It is nullable only so the two sides can be
 * created in either order — the `on_auth_user_created` trigger (migration 0008) fills it in
 * automatically for every Supabase signup, so in practice every row has one.
 *
 * There is deliberately no `password_hash` column any more: Supabase Auth is the sole custodian
 * of credentials (`auth.users.encrypted_password`), and a second copy here would be an
 * unnecessary secret to leak.
 */
export const users = pgTable("users", {
  id: integer().generatedAlwaysAsIdentity().primaryKey(),
  authUserId: uuid("auth_user_id"),
  email: text().notNull(),
  phone: text(),
  name: text().notNull(),
  role: userRoleEnum().notNull().default("customer"),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("users_email_uniq").on(t.email),
  uniqueIndex("users_auth_user_id_uniq").on(t.authUserId),
]);

export const addresses = pgTable("addresses", {
  id: integer().generatedAlwaysAsIdentity().primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  label: text(),
  name: text().notNull(),
  phone: text().notNull(),
  line1: text().notNull(),
  line2: text(),
  city: text().notNull(),
  state: text().notNull(),
  pincode: text().notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("addresses_user_id_idx").on(t.userId),
]);
