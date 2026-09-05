import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Test-only control surface (same pattern as app/api/testing/razorpay-mock/route.ts) for
 * Playwright's register→verify→login→logout→reset E2E run. Supabase's local stack captures mail
 * in Inbucket rather than delivering it, so a test has no inbox to read. This route asks the
 * Supabase Admin API to generate the very same confirmation and recovery links those emails would
 * have contained (`generateLink` produces real, single-use `token_hash` values that /auth/confirm
 * accepts), so a test can complete the flow deterministically without a mail provider.
 *
 * It never reveals anything a real "confirm your email" / "forgot password" message wouldn't
 * already hand the account owner, and — like the Razorpay mock — 404s whenever NODE_ENV is
 * "production", so `next build && next start` makes it structurally unreachable regardless of any
 * other config. It also requires the SECRET key, which no production client ever holds.
 */
function blockedInProduction(): NextResponse | null {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "not_available" }, { status: 404 });
  }
  return null;
}

export async function POST(req: Request): Promise<NextResponse> {
  const blocked = blockedInProduction();
  if (blocked) return blocked;

  const body = (await req.json().catch(() => ({}))) as { email?: string };
  if (!body.email) return NextResponse.json({ ok: false, error: "missing_email" }, { status: 400 });

  const supabase = createSupabaseAdminClient();

  const [signup, recovery] = await Promise.all([
    supabase.auth.admin.generateLink({ type: "signup", email: body.email, password: "unused-placeholder" }),
    supabase.auth.admin.generateLink({ type: "recovery", email: body.email }),
  ]);

  // "signup" fails once the address is already confirmed, which is a normal state mid-test, so a
  // missing verify token is reported as null rather than failing the whole request.
  const verifyTokenHash = signup.error ? null : (signup.data.properties?.hashed_token ?? null);

  if (recovery.error) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    verifyTokenHash,
    resetTokenHash: recovery.data.properties?.hashed_token ?? null,
  });
}
