import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Test-only control surface (same pattern as app/api/testing/razorpay-mock/route.ts) for
 * Playwright's register→verify→login→logout→reset E2E run. Supabase captures mail rather than
 * delivering it locally, and a deployed project sends to addresses no test can read, so this
 * route asks the Supabase Admin API for the single-use `token_hash` those emails would have
 * carried. It stands in only for "check your inbox" — the confirm route, the session cookie and
 * every DB write are the real app.
 *
 * WHY NOT `type: "signup"`. `generateLink({ type: "signup" })` *creates* the user as a side
 * effect, so it fails outright once the account already exists — which is always the case here,
 * because the spec registers through the real /register form first. Local Supabase (older CLI)
 * tolerated it; a current cloud project rejects it, so the earlier version of this route worked
 * locally and failed against a real project. `magiclink` is the correct type for confirming an
 * already-registered address: verifying it marks the email confirmed and establishes the session,
 * which is exactly what clicking the confirmation link does.
 *
 * 404s whenever NODE_ENV is "production", so `next build && next start` makes it structurally
 * unreachable. It also needs the SECRET key, which no client ever holds.
 */
const ALLOWED = new Set(["magiclink", "recovery"] as const);
type AllowedType = "magiclink" | "recovery";

export async function POST(req: Request): Promise<NextResponse> {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "not_available" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as { email?: string; type?: string };
  if (!body.email) return NextResponse.json({ ok: false, error: "missing_email" }, { status: 400 });

  const type = (body.type ?? "magiclink") as AllowedType;
  if (!ALLOWED.has(type)) {
    return NextResponse.json({ ok: false, error: "unsupported_type" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.auth.admin.generateLink({ type, email: body.email });

  if (error || !data.properties?.hashed_token) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? "no_token_generated" },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true, type, tokenHash: data.properties.hashed_token });
}
