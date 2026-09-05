import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createSupabaseAdminClient } from "@/lib/supabase/admin-core";
import { getOrderForUserByOrderNumber, getOrdersForUser } from "@/lib/db/queries/orders";
import { createOrderTransaction } from "@/lib/db/mutations/orders";
import { computePricing } from "@/lib/commerce/pricing";
import { defaultPricingDeps } from "@/lib/commerce/pricing-deps";
import { mergeCartOnLogin } from "@/lib/db/mutations/cart";
import { mergeWishlistOnLogin } from "@/lib/db/mutations/wishlist";
import { getWishlistProductIds } from "@/lib/db/queries/wishlist";

/**
 * Real, DB-backed proof of the rest of PROMPTS.md Phase 6's acceptance criteria (the ones the
 * Playwright specs and tests/unit/auth-session-gate.test.ts don't already cover):
 *
 * - "Confirm no plaintext or reversible password value is ever stored or logged." (Supabase Auth
 *   is the credential custodian now, so this is checked against `auth.users` AND by asserting
 *   `public.users` has no password column at all.)
 * - "An anonymous wishlist and cart merge into the account on login without losing items."
 * - "Attempting to read another user's order by id fails."
 *
 * Calls the real `lib/db/mutations`/`lib/db/queries` functions directly against the same Postgres
 * `pnpm dev` uses (not a mock), then independently re-reads via a raw `pg` client where that adds
 * real proof beyond what the function's own return value already claims.
 */
const consoleLogSpy: string[] = [];
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

let dbClient: Client;
let testVariantId: number;

beforeAll(async () => {
  dbClient = new Client({ connectionString: process.env.DATABASE_URL });
  await dbClient.connect();

  const { rows } = await dbClient.query<{ id: number }>(`select id from variants where in_stock = true limit 1`);
  if (!rows[0]) throw new Error("No in-stock variant found in the seeded database to test against.");
  testVariantId = rows[0].id;

  // Capture everything logged for the rest of this file so the "never logged" assertion below is
  // checking real captured output, not reasoning about the code.
  console.log = (...args: unknown[]) => {
    consoleLogSpy.push(args.map(String).join(" "));
    originalLog(...args);
  };
  console.warn = (...args: unknown[]) => {
    consoleLogSpy.push(args.map(String).join(" "));
    originalWarn(...args);
  };
  console.error = (...args: unknown[]) => {
    consoleLogSpy.push(args.map(String).join(" "));
    originalError(...args);
  };
});

afterAll(async () => {
  console.log = originalLog;
  console.warn = originalWarn;
  console.error = originalError;
  await dbClient?.end();
});

/**
 * Creates a real account the way the application does — through Supabase Auth — and returns the
 * `public.users` id that migration 0008's `on_auth_user_created` trigger produced for it. This
 * replaces the old `lib/db/mutations/users#createUser`, which no longer exists because the app
 * can no longer create a user without an auth identity.
 */
async function createTestUser(input: {
  email: string;
  name: string;
  phone: string | null;
  password: string;
}): Promise<{ ok: true; userId: number }> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { name: input.name, phone: input.phone },
  });
  if (error || !data.user) throw new Error(`createTestUser failed: ${error?.message ?? "no user returned"}`);

  const { rows } = await dbClient.query<{ id: number }>(`select id from users where auth_user_id = $1`, [data.user.id]);
  if (!rows[0]) throw new Error("on_auth_user_created did not create a public.users row — is migration 0008 applied?");
  return { ok: true, userId: rows[0].id };
}

function uniqueEmail(label: string): string {
  return `account-sec-${label}-${randomUUID().slice(0, 8)}@example.com`;
}

async function makeOrderFor(email: string, userId: number | null) {
  const pricing = await computePricing({ lines: [{ variantId: testVariantId, qty: 1 }], couponCode: null, email }, defaultPricingDeps);
  const result = await createOrderTransaction({
    idempotencyKey: randomUUID(),
    email,
    phone: "9876543210",
    paymentMethod: "cod",
    shippingAddress: {
      name: "Test Shopper",
      phone: "9876543210",
      line1: "123 Test Street",
      city: "Sangrur",
      state: "Punjab",
      pincode: "148001",
    },
    billingAddress: null,
    customerNote: null,
    pricing,
    userId,
  });
  if (!result.ok) throw new Error(`Failed to create test order: ${JSON.stringify(result)}`);
  return result;
}

describe("Credential custody — Supabase Auth owns passwords; this app stores none", () => {
  it("has no password column on public.users at all", async () => {
    const { rows } = await dbClient.query<{ column_name: string }>(
      `select column_name from information_schema.columns where table_schema = 'public' and table_name = 'users'`,
    );
    const columns = rows.map((r) => r.column_name);
    expect(columns).not.toContain("password_hash");
    expect(columns.filter((c) => c.includes("password"))).toEqual([]);
  });

  it("stores only a hash in auth.users, never the raw password, and never logs it", async () => {
    const email = uniqueEmail("credential");
    const rawPassword = "S3cret-Raw-Password-Never-Stored!";

    await createTestUser({ email, name: "Credential Test", phone: null, password: rawPassword });

    // Independent re-read via raw SQL against Supabase's own auth schema.
    const { rows } = await dbClient.query<{ encrypted_password: string }>(
      `select encrypted_password from auth.users where email = $1`,
      [email.toLowerCase()],
    );
    expect(rows).toHaveLength(1);
    const storedHash = rows[0].encrypted_password;

    expect(storedHash).toBeTruthy();
    expect(storedHash).not.toContain(rawPassword);
    expect(storedHash.toLowerCase()).not.toContain("s3cret-raw-password");
    // Supabase hashes with bcrypt. Assert the shape so a future change to plaintext or a
    // reversible scheme fails loudly here rather than silently.
    expect(storedHash).toMatch(/^\$2[aby]\$/);

    // Nothing captured in console output (log/warn/error) during this whole test file's run so
    // far contains the raw password string.
    const joined = consoleLogSpy.join("\n");
    expect(joined).not.toContain(rawPassword);
  });
});

describe("Wishlist merge — union, never overwrite", () => {
  it("keeps both the account's existing items and the anonymous session's items after login", async () => {
    const email = uniqueEmail("wishlist");
    const { userId } = (await createTestUser({ email, name: "Wishlist Test", phone: null, password: "irrelevant-pw-1234" })) as {
      ok: true;
      userId: number;
    };

    const productRows = await dbClient.query<{ id: number }>(`select id from products order by id limit 3`);
    const [productA, productB, productC] = productRows.rows.map((r) => r.id);

    // The account already has productA wishlisted (e.g. from a previous session).
    await mergeWishlistOnLogin(userId, [productA]);
    // A fresh anonymous session on this login has productB and productC.
    const merged = await mergeWishlistOnLogin(userId, [productB, productC]);

    expect(new Set(merged)).toEqual(new Set([productA, productB, productC]));

    const stored = await getWishlistProductIds(userId);
    expect(new Set(stored)).toEqual(new Set([productA, productB, productC]));
  });
});

describe("Cart merge — union, never overwrite", () => {
  it("keeps both the account's existing server cart and the anonymous cart's lines after login", async () => {
    const email = uniqueEmail("cart");
    const { userId } = (await createTestUser({ email, name: "Cart Test", phone: null, password: "irrelevant-pw-1234" })) as {
      ok: true;
      userId: number;
    };

    const variantRows = await dbClient.query<{ id: number }>(`select id from variants order by id limit 2`);
    const [variantA, variantB] = variantRows.rows.map((r) => r.id);
    if (!variantA || !variantB) throw new Error("Need at least 2 seeded variants for this test.");

    // Account already has variantA qty 1 server-side.
    await mergeCartOnLogin(userId, [{ variantId: variantA, qty: 1 }]);
    // Anonymous session has variantA qty 2 (should sum, capped at 99) and variantB qty 3 (new line).
    const merged = await mergeCartOnLogin(userId, [
      { variantId: variantA, qty: 2 },
      { variantId: variantB, qty: 3 },
    ]);

    const byVariant = new Map(merged.map((l) => [l.variantId, l.qty]));
    expect(byVariant.get(variantA)).toBe(3); // 1 + 2, summed — neither side dropped
    expect(byVariant.get(variantB)).toBe(3);
    expect(merged).toHaveLength(2);
  });
});

describe("Order ownership — reading another user's order by id fails", () => {
  it("returns null for account B reading account A's real order by order number", async () => {
    const emailA = uniqueEmail("owner-a");
    const emailB = uniqueEmail("owner-b");
    const userA = (await createTestUser({ email: emailA, name: "Owner A", phone: null, password: "irrelevant-pw-1234" })) as {
      ok: true;
      userId: number;
    };
    const userB = (await createTestUser({ email: emailB, name: "Owner B", phone: null, password: "irrelevant-pw-1234" })) as {
      ok: true;
      userId: number;
    };

    const order = await makeOrderFor(emailA, userA.userId);

    // The rightful owner can read it.
    const ownRead = await getOrderForUserByOrderNumber(order.orderNumber, userA.userId);
    expect(ownRead?.orderNumber).toBe(order.orderNumber);
    expect(ownRead?.userId).toBe(userA.userId);

    // Account B, using the real order number, gets nothing — not a different-shaped error, not a
    // partial record, `null` — exactly like a nonexistent order number would (no enumeration).
    const crossRead = await getOrderForUserByOrderNumber(order.orderNumber, userB.userId);
    expect(crossRead).toBeNull();

    const nonexistentRead = await getOrderForUserByOrderNumber("DM-0000-99999", userB.userId);
    expect(nonexistentRead).toBeNull();

    // And account B's own order list never includes account A's order.
    const listForB = await getOrdersForUser(userB.userId);
    expect(listForB.find((o) => o.orderNumber === order.orderNumber)).toBeUndefined();
  });
});

describe("Role gate against a real DB-backed staff/admin user", () => {
  // scripts/seed.ts must never invent customers or staff (CLAUDE.md's seed script rule) — a
  // staff/admin-role user for this test is created here, directly, via a raw SQL insert, never
  // through the seed script or through registerAction (which always creates role "customer").
  it("a real staff-role row round-trips through getUserById with role intact", async () => {
    const email = uniqueEmail("staff-role");
    const created = await createTestUser({ email, name: "Staff Row Test", phone: null, password: "irrelevant-pw-1234" });
    if (!created.ok) throw new Error("setup failed");

    await dbClient.query(`update users set role = 'staff' where id = $1`, [created.userId]);

    const { getUserById } = await import("@/lib/db/queries/users");
    const staffUser = await getUserById(created.userId);
    expect(staffUser?.role).toBe("staff");
  });

  it("a real admin-role row round-trips through getUserById with role intact", async () => {
    const email = uniqueEmail("admin-role");
    const created = await createTestUser({ email, name: "Admin Row Test", phone: null, password: "irrelevant-pw-1234" });
    if (!created.ok) throw new Error("setup failed");

    await dbClient.query(`update users set role = 'admin' where id = $1`, [created.userId]);

    const { getUserById } = await import("@/lib/db/queries/users");
    const adminUser = await getUserById(created.userId);
    expect(adminUser?.role).toBe("admin");
  });
});
