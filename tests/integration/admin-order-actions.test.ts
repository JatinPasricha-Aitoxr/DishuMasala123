import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

if (!process.env.DATABASE_URL && existsSync(".env")) {
  process.loadEnvFile(".env");
}

/**
 * Real, DB-backed proof of three of PROMPTS.md Phase 7's acceptance criteria, calling the actual
 * server actions in app/admin/orders/actions.ts directly (not the page, not a mock of the action
 * itself) — the same discipline tests/integration/account-security.test.ts used for Phase 6:
 *
 * - "A customer-role session calling an admin server action directly is rejected."
 * - "An illegal status transition is rejected server-side" — via the real action, in addition to
 *   tests/unit/order-status.test.ts's proof of the pure state-machine function.
 * - "Every mutation writes an audit_log row — show one real diff" — captured here from a real row.
 *
 * Supabase's `getUser()` and the `public.users` lookup are mocked (same as
 * tests/unit/auth-session-gate.test.ts) so this test can
 * drive both a customer-role and a staff-role session without needing real cookies/HTTP — the
 * gate under test (`requireStaffOrAdmin`) resolves the session through exactly those two.
 */
const mockAuth = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: {
      async getUser() {
        const session = await mockAuth();
        return session?.user
          ? { data: { user: { id: `auth-uuid-${session.user.id}` } }, error: null }
          : { data: { user: null }, error: null };
      },
    },
  }),
}));
// Partial mock: only the auth-id lookup the session gate uses is faked, so any other real query
// in this file's module graph still runs against the real database.
vi.mock("@/lib/db/queries/users", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/db/queries/users")>()),
  async getUserByAuthId() {
    const session = await mockAuth();
    if (!session?.user) return null;
    return { id: Number(session.user.id), role: session.user.role };
  },
}));

// Outside a real Next.js request (this is plain vitest/Node), `revalidatePath`/`updateTag` throw
// ("static generation store missing") — they need Next's request-scoped store, which only exists
// inside an actual request/action invocation the framework itself sets up. Every action under test
// here calls them only AFTER its DB write has already committed, so stubbing them to no-ops changes
// nothing about what this test is actually proving (role gate, state-machine enforcement, and the
// resulting DB/audit_log rows) — it only skips cache invalidation, which has no observable DB effect.
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, updateTag: () => undefined }));

let dbClient: Client;
let staffUserId: number;
let testVariantId: number;
let realOrderId: number;
let realOrderNumber: string;

beforeAll(async () => {
  dbClient = new Client({ connectionString: process.env.DATABASE_URL });
  await dbClient.connect();

  // Resolve a REAL staff/admin row rather than assuming users.id = 1: actor_user_id and
  // moderated_by are enforced foreign keys, and the identity sequence never rewinds.
  const staff = await dbClient.query<{ id: number }>(
    `select id from users where role in ('staff','admin') order by id limit 1`,
  );
  if (!staff.rows[0]) {
    throw new Error(
      "No staff/admin user exists in the database to test against. Run `pnpm create-staff-user`.",
    );
  }
  staffUserId = staff.rows[0].id;

  const { rows } = await dbClient.query<{ id: number }>(`select id from variants where in_stock = true limit 1`);
  if (!rows[0]) throw new Error("No in-stock variant found in the seeded database to test against.");
  testVariantId = rows[0].id;

  // A real order via the real pricing + order-creation transaction (same as
  // account-security.test.ts) — COD, which lands as `confirmed` immediately (no payment wait), so
  // there's a real order to transition/annotate below.
  const { computePricing } = await import("@/lib/commerce/pricing");
  const { defaultPricingDeps } = await import("@/lib/commerce/pricing-deps");
  const { createOrderTransaction } = await import("@/lib/db/mutations/orders");

  const email = `admin-actions-test-${randomUUID().slice(0, 8)}@example.com`;
  const pricing = await computePricing({ lines: [{ variantId: testVariantId, qty: 1 }], email }, defaultPricingDeps);

  const result = await createOrderTransaction({
    idempotencyKey: randomUUID(),
    email,
    phone: "9876543210",
    paymentMethod: "cod",
    shippingAddress: { name: "Admin Test", phone: "9876543210", line1: "1 Test Lane", city: "Sangrur", state: "Punjab", pincode: "148001" },
    billingAddress: null,
    customerNote: null,
    pricing,
    userId: null,
  });
  if (!result.ok) throw new Error(`Failed to create the test order: ${JSON.stringify(result)}`);
  realOrderId = result.orderId;
  realOrderNumber = result.orderNumber;
}, 15_000);

afterAll(async () => {
  await dbClient?.end();
});

describe("app/admin/orders/actions.ts — direct-call proofs", () => {
  it("rejects a customer-role session calling transitionOrderStatusAction directly", async () => {
    mockAuth.mockResolvedValue({ user: { id: "999999", role: "customer" } });
    const { transitionOrderStatusAction } = await import("@/app/admin/orders/actions");

    const result = await transitionOrderStatusAction({ orderId: realOrderId, to: "packed" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/staff access required/i);

    // And prove nothing changed — the order is still `confirmed`, not `packed`.
    const { rows } = await dbClient.query<{ status: string }>(`select status from orders where id = $1`, [realOrderId]);
    expect(rows[0].status).toBe("confirmed");
  });

  it("rejects an illegal jump (confirmed -> delivered) even from a real staff session, via the real action", async () => {
    mockAuth.mockResolvedValue({ user: { id: String(staffUserId), role: "staff" } });
    const { transitionOrderStatusAction } = await import("@/app/admin/orders/actions");

    const result = await transitionOrderStatusAction({ orderId: realOrderId, to: "delivered" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/cannot move an order from "confirmed" directly to "delivered"/i);
  });

  it("a legal transition by a staff session succeeds and writes a real audit_log row with a real diff", async () => {
    mockAuth.mockResolvedValue({ user: { id: String(staffUserId), role: "staff" } });
    const { transitionOrderStatusAction } = await import("@/app/admin/orders/actions");

    const result = await transitionOrderStatusAction({ orderId: realOrderId, to: "packed" });
    expect(result.ok).toBe(true);

    const { rows } = await dbClient.query<{ status: string }>(`select status from orders where id = $1`, [realOrderId]);
    expect(rows[0].status).toBe("packed");

    const audit = await dbClient.query<{ action: string; entity: string; entity_id: string; diff: unknown; actor_user_id: number }>(
      `select action, entity, entity_id, diff, actor_user_id from audit_log where entity = 'order' and entity_id = $1 and action = 'order.status_transition' order by created_at desc limit 1`,
      [String(realOrderId)],
    );
    expect(audit.rows.length).toBe(1);
    const row = audit.rows[0];
    expect(row.actor_user_id).toBe(staffUserId);
    expect(row.diff).toMatchObject({ orderNumber: realOrderNumber, status: { from: "confirmed", to: "packed" } });

    console.log("[Phase 7 acceptance proof] real audit_log row:", JSON.stringify(row, null, 2));
  });

  it("addStaffNoteAction also rejects a customer-role session directly", async () => {
    mockAuth.mockResolvedValue({ user: { id: "999999", role: "customer" } });
    const { addStaffNoteAction } = await import("@/app/admin/orders/actions");

    const result = await addStaffNoteAction({ orderId: realOrderId, note: "should never land" });
    expect(result.ok).toBe(false);

    const { rows } = await dbClient.query<{ staff_note: string | null }>(`select staff_note from orders where id = $1`, [realOrderId]);
    expect(rows[0].staff_note).toBeNull();
  });
});
