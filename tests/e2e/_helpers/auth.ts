import { expect, type APIRequestContext, type Page } from "@playwright/test";

/**
 * Registers a customer through the real UI and completes email confirmation, leaving the browser
 * signed OUT and the account ready to sign in with.
 *
 * The confirmation step is not optional any more: `supabase/config.toml` sets
 * `[auth.email] enable_confirmations = true`, so Supabase refuses `signInWithPassword` until the
 * address is confirmed. The single-use `token_hash` comes from the test-only
 * app/api/testing/auth-tokens route (the Supabase Admin API's `generateLink`), standing in for
 * "check your inbox" exactly as tests/e2e/auth-flow.spec.ts describes.
 */
export async function registerConfirmedCustomer(
  page: Page,
  request: APIRequestContext,
  opts: { name: string; email: string; password: string },
): Promise<void> {
  await page.goto("/register");
  await page.getByLabel("Name").fill(opts.name);
  await page.getByLabel("Email").fill(opts.email);
  await page.getByLabel("Password").fill(opts.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/login\?registered=1/);

  const res = await request.post("/api/testing/auth-tokens", { data: { email: opts.email } });
  expect(res.ok()).toBe(true);
  const { verifyTokenHash } = (await res.json()) as { verifyTokenHash: string | null };
  expect(verifyTokenHash).toBeTruthy();

  await page.goto(
    `/auth/confirm?token_hash=${encodeURIComponent(verifyTokenHash!)}&type=signup&next=${encodeURIComponent("/verify-email")}`,
  );
  await expect(page.getByRole("heading", { name: /email verified/i })).toBeVisible();

  // Confirming also signs the visitor in; drop that session so the caller's own sign-in is real.
  await page.goto("/account");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/");
}
