import "server-only";

import { eq } from "drizzle-orm";
import { db } from "../index";
import { users } from "../schema";

export interface UserRecord {
  id: number;
  authUserId: string | null;
  email: string;
  phone: string | null;
  name: string;
  role: "customer" | "staff" | "admin";
  emailVerifiedAt: Date | null;
  lastLoginAt: Date | null;
}

/** Case-insensitive lookup — emails are stored lower-cased but must never let
 * `Foo@Bar.com` and `foo@bar.com` be treated as different accounts. */
export async function getUserByEmail(email: string): Promise<UserRecord | null> {
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()))
    .limit(1);
  return row ?? null;
}

export async function getUserById(id: number): Promise<UserRecord | null> {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row ?? null;
}

/**
 * Resolve the app's user row from a Supabase Auth user id — the hop every authenticated request
 * makes (lib/auth/session.ts), since Supabase owns the identity (`auth.users.id`, a uuid) while
 * this table owns the integer primary key that orders, addresses, reviews and wishlist rows all
 * reference.
 */
export async function getUserByAuthId(authUserId: string): Promise<UserRecord | null> {
  const [row] = await db.select().from(users).where(eq(users.authUserId, authUserId)).limit(1);
  return row ?? null;
}
