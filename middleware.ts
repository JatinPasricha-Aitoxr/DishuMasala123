import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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
 * The role is read from the JWT's `user_role` claim, stamped by the `custom_access_token_hook`
 * Postgres function (migration 0008). Middleware cannot import `lib/db` — it is "server-only" —
 * so the claim is how the role reaches this layer at all. A claim can be up to one token-refresh
 * stale, which is precisely why lib/auth/session.ts re-reads the authoritative role from
 * `public.users` before anything is actually allowed to happen.
 */
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

  // getClaims() verifies the JWT signature locally and returns its payload — including the
  // `user_role` the access-token hook stamped on. It also performs the token refresh this
  // middleware exists to persist.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const isSignedIn = Boolean(claims?.sub);
  const role = typeof claims?.user_role === "string" ? claims.user_role : "customer";

  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin")) {
    if (!isSignedIn || (role !== "staff" && role !== "admin")) {
      const signIn = request.nextUrl.clone();
      signIn.pathname = "/login";
      signIn.search = `?callbackUrl=${encodeURIComponent(pathname)}`;
      return NextResponse.redirect(signIn);
    }
  }

  if (pathname.startsWith("/account") && !isSignedIn) {
    const signIn = request.nextUrl.clone();
    signIn.pathname = "/login";
    signIn.search = `?callbackUrl=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(signIn);
  }

  return response;
}

export const config = {
  matcher: ["/account/:path*", "/admin/:path*"],
};
