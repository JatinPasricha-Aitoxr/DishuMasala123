/**
 * Supabase connection details, read once and validated here so every client factory fails with
 * the same actionable message rather than a generic runtime error deep inside the SDK.
 *
 * Deliberately NOT prefixed `NEXT_PUBLIC_`. This app never constructs a Supabase client in the
 * browser — every auth operation (sign in, sign up, sign out, password reset) is a server action,
 * and the session travels as an httpOnly cookie — so the publishable key never needs to be
 * inlined into the client bundle, and CLAUDE.md §3.3's "no API key carries a NEXT_PUBLIC_ prefix"
 * rule holds unchanged. If a future feature genuinely needs a browser-side Supabase client, that
 * is the moment to revisit the rule deliberately, not by accident.
 */
export const SUPABASE_URL = process.env.SUPABASE_URL;
export const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
export const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

export function requirePublicConfig(): { url: string; key: string } {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY (see .env.example).",
    );
  }
  return { url: SUPABASE_URL, key: SUPABASE_PUBLISHABLE_KEY };
}

export function requireSecretConfig(): { url: string; key: string } {
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    throw new Error(
      "Supabase admin access is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY (see .env.example).",
    );
  }
  return { url: SUPABASE_URL, key: SUPABASE_SECRET_KEY };
}
