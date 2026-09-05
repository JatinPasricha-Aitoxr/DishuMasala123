-- Custom SQL migration file, put your code below! --

-- Lets Supabase Auth's own role read the role it stamps into the JWT.
--
-- WHY THIS IS NEEDED. `custom_access_token_hook` (migration 0008) runs as `supabase_auth_admin`,
-- which does NOT own public.users. The moment Row Level Security is enabled on that table — which
-- Supabase's dashboard actively prompts you to do, and which is a sensible default for anything
-- reachable through PostgREST — a table with no policies denies every non-owner. The hook's
-- SELECT then returns zero rows, it falls through to its 'customer' default, and every staff and
-- admin account silently loses access to /admin. Nothing errors; the role just quietly vanishes.
--
-- The app itself is unaffected either way: it connects as the table owner (`postgres`) over `pg`,
-- and an owner bypasses RLS unless FORCE ROW LEVEL SECURITY is set. So this policy is narrowly
-- about the auth service, not about application data access.
--
-- Scoped as tightly as it can be: SELECT only, for `supabase_auth_admin` only. It grants nothing
-- to `anon` or `authenticated`, so a public PostgREST request still reads nothing from this table.
-- Idempotent so it is safe to re-run and safe against a database where RLS is not enabled at all
-- (a policy on a table without RLS simply has no effect).
DROP POLICY IF EXISTS "auth_admin_can_read_users" ON public.users;
--> statement-breakpoint

CREATE POLICY "auth_admin_can_read_users"
  ON public.users
  AS PERMISSIVE
  FOR SELECT
  TO supabase_auth_admin
  USING (true);
