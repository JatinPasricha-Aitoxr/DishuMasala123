import { test, expect } from "@playwright/test";
import { registerConfirmedCustomer } from "./_helpers/auth";

/**
 * Real proof of PROMPTS.md Phase 6's acceptance criterion: "/account and /admin are unreachable
 * when signed out, and /admin is unreachable as a customer" — the PAGE half of that criterion
 * (the "server action called directly" half is tests/unit/auth-session-gate.test.ts, which calls
 * the exact same redundant gate every account/admin action uses, bypassing the page/middleware
 * router entirely).
 */
test("/account and /admin redirect to /login when signed out", async ({ page }) => {
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login/);

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login/);
});

test("/admin is unreachable for a signed-in customer", async ({ page, request }) => {
  const suffix = Date.now();
  const email = `e2e-guard-${suffix}@example.com`;
  const password = "guard-test-password-1";

  await registerConfirmedCustomer(page, request, { name: "Guard Tester", email, password });
  await page.goto("/login");

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/account\/?$/);

  // A real customer-role session, but /admin still rejects it — proving the gate checks ROLE,
  // not just "is anyone signed in".
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login/);
});
