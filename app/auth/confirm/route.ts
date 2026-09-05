import { redirect } from "next/navigation";
import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * The landing point for every link Supabase Auth emails out — signup confirmation and password
 * recovery both. Supabase sends a single-use `token_hash`; exchanging it here establishes the
 * session cookie and then forwards to the page that actually talks to the user.
 *
 * `next` is validated as a site-relative path before being used. Without that check this route
 * would be an open redirect: an attacker could mail `/auth/confirm?next=https://evil.example` and
 * bounce a freshly-authenticated visitor straight off-site.
 */
function safeNext(raw: string | null): string {
  if (!raw) return "/account";
  // Only a single-slash-prefixed relative path. Rejects "//evil.com" (protocol-relative) and any
  // absolute URL.
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/account";
  return raw;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(searchParams.get("next"));

  if (!tokenHash || !type) redirect("/login?error=invalid_link");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) redirect("/login?error=invalid_link");

  redirect(next);
}
