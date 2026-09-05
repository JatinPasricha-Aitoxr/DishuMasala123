-- Custom SQL migration file, put your code below! --

-- Lets a signed-in user read their OWN public.users row, and nothing else.
--
-- WHY. middleware.ts is the first gate for /account/* and /admin/*, and it needs the caller's
-- role. It cannot import lib/db (that module is "server-only" and middleware is not a React
-- Server Component), so the role previously travelled in a JWT claim stamped by
-- `custom_access_token_hook`. That indirection turned out to be fragile: if the dashboard hook is
-- not enabled — or is enabled but cannot read public.users because RLS blocks it — the claim
-- silently disappears, middleware defaults everyone to `customer`, and every staff account loses
-- /admin with no error logged anywhere. It fails closed, which is safe, but it fails invisibly.
--
-- Instead middleware now reads the role straight from Postgres over PostgREST, using the caller's
-- own session. This policy is what makes that safe: SELECT only, for `authenticated` only, and
-- USING (auth_user_id = auth.uid()) restricts every request to the caller's own row. A signed-in
-- customer cannot read anyone else's role, and `anon` still reads nothing at all.
--
-- The role is therefore authoritative at the first gate too, not up to one token-refresh stale as
-- a claim would be. lib/auth/session.ts still re-reads it for every server action, so this remains
-- the first gate and never the only one (CLAUDE.md §9).
--
-- NOTE: migration 0008's `custom_access_token_hook` is deliberately left in place. It is now
-- unused, but dropping it while the dashboard hook still points at it would make token issuance
-- fail outright, so removal is a separate, manual step once the hook is switched off there.
DROP POLICY IF EXISTS "users_can_read_own_row" ON public.users;
--> statement-breakpoint

CREATE POLICY "users_can_read_own_row"
  ON public.users
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());
