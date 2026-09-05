import { expect, type APIRequestContext, type Page } from "@playwright/test";

/**
 * Asks the test-only token route for the single-use `token_hash` a real Supabase auth email
 * would have carried. `magiclink` confirms an already-registered address; `recovery` starts a
 * password reset.
 */
export async function authTokenHash(
  request: APIRequestContext,
  email: string,
  type: "magiclink" | "recovery",
): Promise<string> {
  const res = await request.post("/api/testing/auth-tokens", { data: { email, type } });
  expect(res.ok(), `token route failed for ${type}: ${await res.text()}`).toBe(true);
  const { tokenHash } = (await res.json()) as { tokenHash: string };
  expect(tokenHash).toBeTruthy();
  return tokenHash;
}

/** Walks Supabase's confirmation URL exactly as clicking the emailed link would. */
export async function walkConfirmLink(
  page: Page,
  tokenHash: string,
  type: "magiclink" | "recovery",
  next: string,
): Promise<void> {
  await page.goto(
    `/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=${type}&next=${encodeURIComponent(next)}`,
  );
}

/**
 * Registers a customer through the real UI and completes email confirmation, leaving the browser
 * signed OUT and the account ready to sign in with.
 *
 * The confirmation step is not optional: `[auth.email] enable_confirmations` is on, so Supabase
 * refuses `signInWithPassword` until the address is confirmed.
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

  const tokenHash = await authTokenHash(request, opts.email, "magiclink");
  await walkConfirmLink(page, tokenHash, "magiclink", "/account");
  await expect(page).toHaveURL(/\/account\/?$/);

  // Confirming also signs the visitor in; drop that session so the caller's own sign-in is real.
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/");
}
