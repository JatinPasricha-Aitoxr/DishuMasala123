import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserByAuthId } from "@/lib/db/queries/users";

export interface SessionUser {
  id: number;
  role: "customer" | "staff" | "admin";
}

/**
 * The redundant, independent authorization check every account/admin server action and route
 * handler must call itself (CLAUDE.md §9 / PROMPTS.md Phase 6 item 2: "Middleware is the first
 * gate, not the only one"). `middleware.ts` never runs for a server action invoked directly
 * (e.g. a test calling the exported function, or any caller that isn't a page navigation through
 * the matcher), so every one of these functions re-derives the session from the request's own
 * cookies rather than trusting that middleware already ran.
 *
 * Two deliberate choices here:
 *   - `getUser()`, never `getSession()`. `getSession()` returns whatever the cookie claims,
 *     unverified; `getUser()` revalidates the token against the Auth server. Authorization must
 *     never be decided from an unverified cookie.
 *   - the role comes from `public.users`, which is the only authority for it. `middleware.ts`
 *     reads the same row over PostgREST for its own first-gate check, so a role changed in the
 *     admin panel takes effect immediately at both gates — there is no JWT claim to go stale.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const appUser = await getUserByAuthId(data.user.id);
  if (!appUser) return null;

  return { id: appUser.id, role: appUser.role };
}

/**
 * The cheap, DISPLAY-ONLY session read, for the root layout.
 *
 * `getSessionUser()` above costs a network round-trip to the Auth server plus a `public.users`
 * query — correct for an authorization decision, but far too expensive to pay on every single
 * page render, and it is paid again on every `revalidatePath()` a server action triggers. This
 * reads the identity out of the already-present JWT instead: `getClaims()` verifies the token's
 * signature locally (caching the JWKS), so it makes no per-render round-trip.
 *
 * It deliberately returns only the Supabase user id and no role. Nothing on the client needs the
 * role — the header and the wishlist toggle need "is anyone signed in", and AccountSync needs a
 * stable per-account key for its merge guard — so there is nothing here worth a database query,
 * and no dependence on a custom JWT claim.
 *
 * NEVER use this to authorize anything. Every actual gate calls `requireUser()` or
 * `requireStaffOrAdmin()`, which re-read the authoritative role from the database.
 */
export async function getDisplaySessionUser(): Promise<{ id: string } | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  return typeof sub === "string" && sub.length > 0 ? { id: sub } : null;
}

export type RequireResult = { ok: true; user: SessionUser } | { ok: false; error: "unauthenticated" | "forbidden" };

/** Any signed-in user — the gate behind every `/account/*` action. */
export async function requireUser(): Promise<RequireResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "unauthenticated" };
  return { ok: true, user };
}

/** `staff` or `admin` only — the gate behind every `/admin/*` action. */
export async function requireStaffOrAdmin(): Promise<RequireResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "unauthenticated" };
  if (user.role !== "staff" && user.role !== "admin") return { ok: false, error: "forbidden" };
  return { ok: true, user };
}
