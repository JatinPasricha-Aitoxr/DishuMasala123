import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

if (!process.env.DATABASE_URL && existsSync(".env")) {
  process.loadEnvFile(".env");
}

/**
 * Real, DB-backed proof of two of PROMPTS.md Phase 8's explicitly-checked acceptance criteria,
 * calling the actual server actions in app/admin/products/actions.ts directly — same pattern as
 * tests/integration/admin-order-actions.test.ts:
 *
 * - "Rupee input 549 stores exactly 54900 paise; show the round-trip" — creates a real product via
 *   the real createProductAction with a variant priced at "549" rupees, then reads the raw
 *   `price_paise` column straight out of Postgres (not through the app) and asserts it is exactly
 *   54900 — not 54899/54901 from a float-rounding mistake.
 * - "Alt text is required before a product can be published" — attempts to publish a product with
 *   an image whose alt text is empty, confirms real rejection, then fills in alt text and confirms
 *   it succeeds.
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
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, updateTag: () => undefined }));

let dbClient: Client;
let collectionId: number;
const createdProductIds: number[] = [];

beforeAll(async () => {
  dbClient = new Client({ connectionString: process.env.DATABASE_URL });
  await dbClient.connect();
  const { rows } = await dbClient.query<{ id: number }>(`select id from collections order by priority limit 1`);
  if (!rows[0]) throw new Error("No seeded collection found to test against.");
  collectionId = rows[0].id;
});

afterAll(async () => {
  if (createdProductIds.length > 0) {
    await dbClient.query(`delete from product_images where product_id = any($1)`, [createdProductIds]);
    await dbClient.query(`delete from variants where product_id = any($1)`, [createdProductIds]);
    await dbClient.query(`delete from products where id = any($1)`, [createdProductIds]);
  }
  await dbClient?.end();
});

function asStaff() {
  mockAuth.mockResolvedValue({ user: { id: "1", role: "staff" } });
}

describe("product admin actions — rupee to paise round-trip", () => {
  it("stores a rupee input of 549 as exactly 54900 paise in Postgres", async () => {
    asStaff();
    const { createProductAction } = await import("@/app/admin/products/actions");

    const slug = `test-roundtrip-${randomUUID().slice(0, 8)}`;
    const result = await createProductAction({
      slug,
      name: "Round-trip Test Product",
      collectionId,
      shortDescription: null,
      description: null,
      ingredients: null,
      brewGuide: null,
      tags: [],
      optionLabel: "Size",
      priority: 3,
      seoTitle: null,
      seoDescription: null,
      variants: [
        {
          sku: `TEST-RT-${randomUUID().slice(0, 8)}`,
          optionValue: "100g",
          mrpRupees: 649,
          priceRupees: 549,
          weightGrams: 100,
          inStock: true,
          stockQty: null,
          position: 0,
        },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok || !result.data) throw new Error("expected ok result with data");
    createdProductIds.push(result.data.id);

    const { rows } = await dbClient.query<{ price_paise: number; mrp_paise: number }>(
      `select price_paise, mrp_paise from variants where product_id = $1`,
      [result.data.id],
    );
    expect(rows).toHaveLength(1);
    // The real, raw column value read directly from Postgres — not derived from the app's response.
    expect(rows[0].price_paise).toBe(54900);
    expect(rows[0].mrp_paise).toBe(64900);
  });
});

describe("product admin actions — alt text required before publish", () => {
  it("rejects publishing a product with an image missing alt text, then allows it once alt text is set", async () => {
    asStaff();
    const { createProductAction, publishProductAction, updateProductImageAltAction } = await import(
      "@/app/admin/products/actions"
    );

    const slug = `test-altgate-${randomUUID().slice(0, 8)}`;
    const created = await createProductAction({
      slug,
      name: "Alt Gate Test Product",
      collectionId,
      shortDescription: null,
      description: null,
      ingredients: null,
      brewGuide: null,
      tags: [],
      optionLabel: "Size",
      priority: 3,
      seoTitle: null,
      seoDescription: null,
      variants: [
        {
          sku: `TEST-ALT-${randomUUID().slice(0, 8)}`,
          optionValue: "100g",
          mrpRupees: 300,
          priceRupees: 250,
          weightGrams: 100,
          inStock: true,
          stockQty: null,
          position: 0,
        },
      ],
    });
    expect(created.ok).toBe(true);
    if (!created.ok || !created.data) throw new Error("expected ok result with data");
    const productId = created.data.id;
    createdProductIds.push(productId);

    // Insert a product_images row directly with empty alt text — equivalent to a real upload that
    // hasn't had its alt text filled in yet (finalizeProductImageUploadDb always starts alt as "").
    const { rows: imageRows } = await dbClient.query<{ id: number }>(
      `insert into product_images (product_id, storage_key, alt, width, height, position, is_primary)
       values ($1, $2, '', 800, 800, 0, true) returning id`,
      [productId, `products/${slug}/test-image.webp`],
    );
    const imageId = imageRows[0].id;

    const firstAttempt = await publishProductAction(productId);
    expect(firstAttempt.ok).toBe(false);
    if (firstAttempt.ok) throw new Error("expected rejection");
    expect(firstAttempt.error).toMatch(/alt text/i);

    const { rows: statusAfterReject } = await dbClient.query<{ status: string }>(
      `select status from products where id = $1`,
      [productId],
    );
    expect(statusAfterReject[0].status).toBe("draft");

    const altResult = await updateProductImageAltAction({ imageId, alt: "Round tin of Blue Tea on a white background" });
    expect(altResult.ok).toBe(true);

    const secondAttempt = await publishProductAction(productId);
    expect(secondAttempt.ok).toBe(true);

    const { rows: statusAfterPublish } = await dbClient.query<{ status: string }>(
      `select status from products where id = $1`,
      [productId],
    );
    expect(statusAfterPublish[0].status).toBe("published");
  });
});
