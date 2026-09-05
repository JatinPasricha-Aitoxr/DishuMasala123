import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Reads the caller's own `public.users` row over PostgREST, for `middleware.ts`.
 *
 * WHY THIS EXISTS SEPARATELY FROM lib/db/queries/users.ts. Middleware is not a React Server
 * Component, so it cannot import anything that starts with `import "server-only"` — which rules
 * out lib/db/index.ts and therefore Drizzle. This file uses the request-scoped Supabase client
 * middleware already has to hand, so it needs neither. It still lives under lib/db/ because data
 * access belongs here (CLAUDE.md §3.2), and it holds no Drizzle import, so the "no drizzle-orm
 * outside lib/db/" ESLint rule is untouched either way.
 *
 * SECURITY. The client passed in carries the caller's own session, so this query runs as
 * `authenticated` and the `users_can_read_own_row` policy (migration 0010) constrains it to that
 * caller's row: `USING (auth_user_id = auth.uid())`. A signed-in customer cannot read anyone
 * else's role, and an anonymous request reads nothing. The `.eq()` below is belt-and-braces on top
 * of the policy, not the thing enforcing it.
 *
 * Returns null when there is no matching row — a verified Supabase identity with no application
 * user yet. Callers must treat that as "not authorized", never as a default role.
 */
export type SessionRole = "customer" | "staff" | "admin";

export interface SessionRoleRow {
  id: number;
  role: SessionRole;
}

export async function fetchOwnUserRow(
  supabase: SupabaseClient,
  authUserId: string,
): Promise<SessionRoleRow | null> {
  const { data, error } = await supabase
    .from("users")
    .select("id, role")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error || !data) return null;

  const role = data.role;
  if (role !== "customer" && role !== "staff" && role !== "admin") return null;

  return { id: data.id as number, role };
}
