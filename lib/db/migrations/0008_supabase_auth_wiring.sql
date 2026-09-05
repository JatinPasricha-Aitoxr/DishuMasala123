-- Custom SQL migration file, put your code below! --

-- Wires Supabase Auth (auth.users) to this app's own user table (public.users).
--
-- Two pieces:
--   1. handle_new_auth_user()  — a trigger that mirrors every Supabase signup into public.users,
--      so the integer primary key that addresses/orders/reviews/wishlist_items/audit_log all
--      reference exists the moment an account does. Runs for signups made through the app AND
--      through the Admin API (scripts/create-staff-user.ts), which is exactly why it is a
--      database trigger rather than application code in the register action.
--   2. custom_access_token_hook() — a Supabase Auth hook that stamps `app_user_id` and
--      `user_role` into the issued JWT. middleware.ts needs the role to gate /admin/* on every
--      request, and middleware cannot reach lib/db (it is "server-only" and edge-shaped), so the
--      role has to travel in the token. This is the FIRST gate only: every server action still
--      re-reads the role from public.users itself (lib/auth/session.ts), which is what makes a
--      stale claim between token refreshes non-authoritative (CLAUDE.md §9).

-- 1 ------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (auth_user_id, email, name, phone, role, email_verified_at)
  VALUES (
    NEW.id,
    lower(NEW.email),
    -- Supabase carries arbitrary signup fields in raw_user_meta_data; the app sends name/phone
    -- there (lib/actions/auth.ts). Fall back to the email local-part so the NOT NULL holds even
    -- for an account created without metadata (e.g. straight from the Supabase dashboard).
    coalesce(nullif(trim(NEW.raw_user_meta_data->>'name'), ''), split_part(NEW.email, '@', 1)),
    nullif(trim(NEW.raw_user_meta_data->>'phone'), ''),
    coalesce((nullif(NEW.raw_user_meta_data->>'role', ''))::user_role, 'customer'),
    NEW.email_confirmed_at
  )
  -- An app-side row may already exist for this email (a pre-existing customer being linked to a
  -- newly created Supabase identity). Link it rather than failing the signup on users_email_uniq.
  ON CONFLICT (email) DO UPDATE
    SET auth_user_id = EXCLUDED.auth_user_id,
        updated_at   = now();
  RETURN NEW;
END;
$$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
--> statement-breakpoint

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
--> statement-breakpoint

-- Keep email_verified_at in step when Supabase confirms an address, so the app's own
-- "resend verification" affordance (lib/actions/auth.ts) reflects reality.
CREATE OR REPLACE FUNCTION public.handle_auth_user_confirmed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email_confirmed_at IS DISTINCT FROM OLD.email_confirmed_at THEN
    UPDATE public.users
       SET email_verified_at = NEW.email_confirmed_at,
           updated_at        = now()
     WHERE auth_user_id = NEW.id;
  END IF;
  IF lower(NEW.email) IS DISTINCT FROM lower(OLD.email) THEN
    UPDATE public.users
       SET email      = lower(NEW.email),
           updated_at = now()
     WHERE auth_user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
--> statement-breakpoint

CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_confirmed();
--> statement-breakpoint

-- 2 ------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims     jsonb;
  app_id     integer;
  app_role   text;
BEGIN
  SELECT u.id, u.role::text
    INTO app_id, app_role
    FROM public.users u
   WHERE u.auth_user_id = (event->>'user_id')::uuid;

  claims := event->'claims';
  -- Default to the least-privileged role when there is no app row yet, never to staff/admin.
  claims := jsonb_set(claims, '{user_role}', to_jsonb(coalesce(app_role, 'customer')));
  IF app_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{app_user_id}', to_jsonb(app_id));
  END IF;

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;
--> statement-breakpoint

-- Only Supabase's auth service may run the hook, and it needs to read the role it stamps.
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM authenticated, anon, public;
--> statement-breakpoint
GRANT SELECT ON TABLE public.users TO supabase_auth_admin;
