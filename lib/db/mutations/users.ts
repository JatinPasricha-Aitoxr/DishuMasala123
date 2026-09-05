import "server-only";

import { eq } from "drizzle-orm";
import { db } from "../index";
import { users } from "../schema";

/**
 * Note what is NOT here any more: user creation and password mutation. Supabase Auth owns both.
 * A new account is created by `supabase.auth.signUp()` (lib/actions/auth.ts), and the
 * `on_auth_user_created` trigger from migration 0008 inserts the matching `public.users` row in
 * the same transaction as the auth user — so there is no application code path that can create
 * one without the other. Passwords live only in `auth.users.encrypted_password`.
 */

export async function markEmailVerified(userId: number): Promise<void> {
  await db.update(users).set({ emailVerifiedAt: new Date(), updatedAt: new Date() }).where(eq(users.id, userId));
}

export async function markLastLogin(userId: number): Promise<void> {
  await db.update(users).set({ lastLoginAt: new Date(), updatedAt: new Date() }).where(eq(users.id, userId));
}

export async function updateProfile(userId: number, input: { name: string; phone: string | null }): Promise<void> {
  await db.update(users).set({ name: input.name.trim(), phone: input.phone, updatedAt: new Date() }).where(eq(users.id, userId));
}
