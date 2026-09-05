import { test, expect } from "@playwright/test";

/**
 * Real end-to-end proof of PROMPTS.md Phase 6's first acceptance criterion: "Register → verify →
 * login → logout → password reset → session refresh, all working end to end" — driven through the
 * actual UI, not described. Supabase's local stack captures mail in Inbucket rather than sending
 * it, so app/api/testing/auth-tokens/route.ts (NODE_ENV-production-blocked, same pattern as the
 * existing Razorpay mock) asks the Supabase Admin API for the very same single-use `token_hash`
 * the real emails would have linked to, standing in only for "check your inbox" — everything else
 * (the DB writes, Supabase's password hashing, the session cookie, the redirect gates) is the
 * real app.
 */
async function tokenHashes(request: import("@playwright/test").APIRequestContext, email: string) {
  const res = await request.post("/api/testing/auth-tokens", { data: { email } });
  expect(res.ok()).toBe(true);
  return (await res.json()) as { verifyTokenHash: string | null; resetTokenHash: string | null };
}

test("register → verify → login → logout → reset → session refresh", async ({ page, request }) => {
  const suffix = Date.now();
  const email = `e2e-auth-${suffix}@example.com`;
  const password = "correct-horse-battery-1";
  const newPassword = "correct-horse-battery-2";

  // ---- Register ---------------------------------------------------------------------------
  await page.goto("/register");
  await page.getByLabel("Name").fill("Auth E2E Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/login\?registered=1/);
  await expect(page.getByText(/check your email for a verification link/i)).toBeVisible();

  // ---- Verify (via the test-only token mint, standing in for the email link) -------------
  const { verifyTokenHash } = await tokenHashes(request, email);
  expect(verifyTokenHash).toBeTruthy();

  await page.goto(
    `/auth/confirm?token_hash=${encodeURIComponent(verifyTokenHash!)}&type=signup&next=${encodeURIComponent("/verify-email")}`,
  );
  await expect(page.getByRole("heading", { name: /email verified/i })).toBeVisible();

  // Confirming signs the visitor in; sign out so the login step below is a genuine login.
  await page.goto("/account");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/");

  // ---- Login --------------------------------------------------------------------------------
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/account\/?$/);
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

  // Session refresh: a fresh navigation to a protected page stays signed in (the cookie is real,
  // not just client-side React state) — this is the "session refresh" half of the criterion.
  await page.goto("/account/profile");
  await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveValue(email);

  // ---- Logout ---------------------------------------------------------------------------------
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login/); // signed out again — /account is unreachable

  // ---- Password reset --------------------------------------------------------------------------
  // Minted fresh here rather than reused from the verify step: Supabase's recovery tokens are
  // single-use and issuing a new one supersedes any earlier one.
  const { resetTokenHash } = await tokenHashes(request, email);
  expect(resetTokenHash).toBeTruthy();

  await page.goto(
    `/auth/confirm?token_hash=${encodeURIComponent(resetTokenHash!)}&type=recovery&next=${encodeURIComponent("/reset-password?mode=set")}`,
  );
  await page.getByLabel("New password", { exact: true }).fill(newPassword);
  await page.getByLabel("Confirm new password").fill(newPassword);
  await page.getByRole("button", { name: "Reset password" }).click();
  await expect(page).toHaveURL(/\/login\?reset=1/);

  // Old password no longer works, new one does.
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);

  await page.getByLabel("Password").fill(newPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/account\/?$/);
});
