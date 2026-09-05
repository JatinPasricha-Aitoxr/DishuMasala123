import Link from "next/link";

export const metadata = { title: "Verify email — Dishu Masala", robots: { index: false, follow: false } };

/**
 * Reached only after /auth/confirm has already exchanged Supabase's single-use `token_hash` and
 * established the session (PROMPTS.md Phase 6 item 1). This page therefore has no token to check
 * and no mutation to perform — the `on_auth_user_updated` trigger (migration 0008) has already
 * mirrored `email_confirmed_at` onto `public.users.email_verified_at`. An invalid or expired link
 * never gets this far; /auth/confirm sends it to /login?error=invalid_link instead.
 */
export default function VerifyEmailPage() {
  return (
    <div className="mx-auto max-w-sm px-4 py-16 text-center sm:px-6">
      <h1 className="font-display text-2xl font-semibold text-ink">Email verified</h1>
      <p className="mt-2 text-sm text-ink-2">Your email address is confirmed.</p>
      <Link href="/account" className="mt-6 inline-block text-sm font-medium text-ink underline underline-offset-4">
        Go to your account
      </Link>
    </div>
  );
}
