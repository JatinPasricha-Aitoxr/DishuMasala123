"use server";

/**
 * Every authentication flow, as server actions against Supabase Auth (CLAUDE.md §2). The app
 * constructs no Supabase client in the browser at all — the session is an httpOnly cookie written
 * by these actions and refreshed by middleware.ts — which is why no Supabase key is inlined into
 * the client bundle.
 *
 * NO-ENUMERATION DISCIPLINE (unchanged in intent from the Auth.js implementation this replaces):
 * `registerAction` and `requestPasswordResetAction` both return the exact same generic result
 * whether or not the email is already registered, and `loginAction` returns one generic message
 * for every failure — wrong password, unknown email, or a rate-limit rejection. Supabase's own
 * responses are deliberately NOT surfaced verbatim, because several of them do distinguish those
 * cases.
 *
 * WHAT MOVED TO SUPABASE, AND WHAT DID NOT:
 * - Password hashing, email-verification tokens and password-reset tokens are now Supabase's
 *   (bcrypt + its own single-use token store), replacing this project's Argon2id hashes and the
 *   hash-fingerprinted reset tokens in the now-deleted lib/tokens.ts.
 * - The IP+email rate limiting in lib/rate-limit.ts is KEPT and still runs first. Supabase has
 *   its own per-IP limits ([auth.rate_limit] in supabase/config.toml), but they are per-IP only;
 *   the per-email limit that makes credential-stuffing against one account expensive is this
 *   project's own and has no Supabase equivalent.
 * - The deliberate timing burns are gone. They existed to hide a fast "no such user" database
 *   miss behind a slow Argon2 verify; Supabase answers both cases over the network on its own
 *   timing, which this code cannot control or meaningfully equalise.
 */
import { headers } from "next/headers";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserByEmail, getUserById } from "@/lib/db/queries/users";
import { markLastLogin } from "@/lib/db/mutations/users";
import { checkRateLimit, clientIpFromHeaders } from "@/lib/rate-limit";
import { getSessionUser } from "@/lib/auth/session";

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

async function requestIp(): Promise<string | null> {
  const h = await headers();
  return clientIpFromHeaders(h);
}

// ---- Login --------------------------------------------------------------------------------

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type LoginResult = { ok: true } | { ok: false; error: string };

const GENERIC_LOGIN_ERROR = "That email and password combination doesn't match our records.";

export async function loginAction(input: LoginInput): Promise<LoginResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: GENERIC_LOGIN_ERROR };
  const { email, password } = parsed.data;

  const ip = await requestIp();
  const { allowed } = await checkRateLimit("login", { ip, email });
  // Same generic message as a credential failure: a distinct "you are rate limited" reply is
  // itself an oracle telling an attacker the address is worth continuing to hammer.
  if (!allowed) return { ok: false, error: GENERIC_LOGIN_ERROR };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { ok: false, error: GENERIC_LOGIN_ERROR };

  const appUser = await getUserByEmail(email);
  if (appUser) await markLastLogin(appUser.id);

  return { ok: true };
}

// ---- Sign out -----------------------------------------------------------------------------

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
}

// ---- Register -----------------------------------------------------------------------------

const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  email: z.string().trim().email("Enter a valid email").max(200),
  phone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  password: z.string().min(8, "Use at least 8 characters").max(200),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type RegisterResult = { ok: true } | { ok: false; error: string; rateLimited?: boolean };

/**
 * `name` and `phone` ride along in Supabase's user metadata; the `on_auth_user_created` trigger
 * (migration 0008) reads them straight back out to populate `public.users`, so the app row and
 * the auth identity are created together rather than by two racing round-trips.
 */
export async function registerAction(input: RegisterInput): Promise<RegisterResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid details" };

  const ip = await requestIp();
  const { allowed } = await checkRateLimit("register", { ip, email: parsed.data.email });
  if (!allowed) return { ok: false, error: "Too many attempts. Please try again later.", rateLimited: true };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { name: parsed.data.name, phone: parsed.data.phone },
      emailRedirectTo: `${siteUrl()}/auth/confirm?next=${encodeURIComponent("/verify-email")}`,
    },
  });

  // Never distinguish "already registered" from a fresh signup — same success shape either way.
  if (error) return { ok: true };

  return { ok: true };
}

// ---- Email verification ----------------------------------------------------------------------

export type ResendVerificationResult = { ok: true };

/** Always returns ok:true (no enumeration) — requires being signed in as the account itself, so
 * there's no cross-account risk to worry about here at all. */
export async function resendVerificationAction(): Promise<ResendVerificationResult> {
  const sessionUser = await getSessionUser();
  if (sessionUser) {
    const user = await getUserById(sessionUser.id);
    if (user && !user.emailVerifiedAt) {
      const supabase = await createSupabaseServerClient();
      await supabase.auth.resend({
        type: "signup",
        email: user.email,
        options: { emailRedirectTo: `${siteUrl()}/auth/confirm?next=${encodeURIComponent("/verify-email")}` },
      });
    }
  }
  return { ok: true };
}

// ---- Password reset -------------------------------------------------------------------------

const requestResetSchema = z.object({ email: z.string().trim().email().max(200) });

export type RequestResetResult = { ok: true; message: string };

const GENERIC_RESET_MESSAGE = "If an account exists for that email, we've sent a password reset link.";

export async function requestPasswordResetAction(input: { email: string }): Promise<RequestResetResult> {
  const parsed = requestResetSchema.safeParse(input);
  if (!parsed.success) return { ok: true, message: GENERIC_RESET_MESSAGE };

  const ip = await requestIp();
  const { allowed } = await checkRateLimit("reset_request", { ip, email: parsed.data.email });
  if (!allowed) return { ok: true, message: GENERIC_RESET_MESSAGE };

  const supabase = await createSupabaseServerClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl()}/auth/confirm?next=${encodeURIComponent("/reset-password?mode=set")}`,
  });

  return { ok: true, message: GENERIC_RESET_MESSAGE };
}

const confirmResetSchema = z.object({
  newPassword: z.string().min(8, "Use at least 8 characters").max(200),
});

export type ConfirmResetResult = { ok: true } | { ok: false; error: string };

/**
 * Supabase's reset link puts the user into a real (recovery) session before they land on
 * /reset-password, so the confirmation step is an authenticated password change rather than a
 * token this code has to verify itself — which is why there is no `token` parameter any more.
 * `updateUser` fails outright without that session, so an unauthenticated caller cannot change
 * anyone's password by calling this action directly.
 */
export async function resetPasswordAction(input: { newPassword: string }): Promise<ConfirmResetResult> {
  const parsed = confirmResetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request" };

  const ip = await requestIp();
  const { allowed } = await checkRateLimit("reset_confirm", { ip });
  if (!allowed) return { ok: false, error: "Too many attempts. Please try again later." };

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { ok: false, error: "This reset link is invalid or has expired. Request a new one." };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.newPassword });
  if (error) return { ok: false, error: "Could not update your password. Request a new reset link." };

  return { ok: true };
}
