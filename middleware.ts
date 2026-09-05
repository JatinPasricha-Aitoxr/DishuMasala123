import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { fetchOwnUserRow } from "@/lib/db/session-role";

/**
 * Two jobs, in this order:
 *
 *  1. Refresh the Supabase session. Access tokens are short-lived; Server Components cannot set
 *     cookies, so middleware is the only place the rotated token can be written back. This must
 *     run for every matched route or signed-in users get logged out when their token expires.
 *
 *  2. Gate `/account/*` (any signed-in user) and `/admin/*` (role `staff` or `admin`) — the FIRST
 *     gate, NOT the only one. Every server action and route handler behind these paths
 *     independently re-verifies via `requireUser()` / `requireStaffOrAdmin()`
 *     (lib/auth/session.ts), because middleware never runs for a server action invoked directly.
 *
 * The role is read from Postgres, not from a JWT claim. An earlier version relied on a
 * `user_role` claim stamped by a Supabase access-token hook, which middleware needed because it
 * cannot import lib/db ("server-only"). That indirection proved fragile in exactly the wrong
 * direction: when the hook is not enabled for the project, or is enabled but blocked by RLS from
 * reading public.users, the claim silently vanishes, every session looks like a `customer`, and
 * staff lose /admin with nothing logged anywhere. Reading the row directly (over PostgREST, as
 * the caller, constrained by the `users_can_read_own_row` policy — see lib/db/session-role.ts)
 * costs one round-trip on these two path prefixes only, needs no dashboard configuration, and
 * makes the role authoritative here rather than up to one token-refresh stale.
 */
function redirectToLogin(request: NextRequest, pathname: string) {
  const signIn = request.nextUrl.clone();
  signIn.pathname = "/login";
  signIn.search = `?callbackUrl=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(signIn);
}

export default async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase is not configured. Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY (see .env.example).");
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getClaims() verifies the JWT signature locally (no round-trip for the identity itself) and
  // performs the token refresh this middleware exists to persist.
  const { data } = await supabase.auth.getClaims();
  const authUserId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;

  const { pathname } = request.nextUrl;
  const needsRole = pathname.startsWith("/admin");
  const needsSignIn = needsRole || pathname.startsWith("/account");

  if (needsSignIn && !authUserId) return redirectToLogin(request, pathname);

  if (needsRole && authUserId) {
    const appUser = await fetchOwnUserRow(supabase, authUserId);
    // No row, or a customer: not staff. Fails closed, and now it fails for a real reason rather
    // than because a claim went missing.
    if (!appUser || (appUser.role !== "staff" && appUser.role !== "admin")) {
      return redirectToLogin(request, pathname);
    }
  }

  return response;
}

export const config = {
  matcher: ["/account/:path*", "/admin/:path*"],
};
