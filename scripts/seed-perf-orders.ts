/**
 * PERFORMANCE-TEST-ONLY. Generates synthetic orders purely to time the admin orders list query at
 * scale (PROMPTS.md Phase 7's acceptance criterion: "the order list handles 5,000 seeded orders
 * without a slow query"). Deliberately NOT wired into `pnpm db:seed` and deliberately separate
 * from scripts/seed.ts, which must never invent orders (CLAUDE.md §7.6/§8's constraint on that
 * specific script — this script is the explicitly-sanctioned exception for exactly this
 * acceptance-criterion check, not a loophole around that rule).
 *
 * Every synthetic row is unmistakably labelled, never mistakable for real data:
 *   - email:  perf-test-<n>@perf-test.invalid  (`.invalid` is the IANA-reserved TLD for exactly
 *             this purpose — RFC 2606 — so it can never collide with a real customer's domain)
 *   - phone:  0000000000
 *   - customerNote: "PERF_TEST_SEED" (also greppable/queryable for cleanup or an accidental
 *             prod-data sanity check)
 *   - idempotencyKey: "perf-test-<uuid>"
 *
 * Usage:
 *   pnpm seed-perf-orders            # inserts 5,000 synthetic orders + 1 item each, then times
 *                                     # the exact admin orders list query and prints EXPLAIN ANALYZE
 *   pnpm seed-perf-orders --cleanup  # deletes every row this script created (items first, then
 *                                     # orders, respecting order_items.order_id's ON DELETE
 *                                     # RESTRICT) — leaves the local dev DB exactly as it was
 */
import { randomUUID } from "node:crypto";
import { closeScriptDb, scriptDb, eq, sql } from "../lib/db/script-client";
import { orders, orderItems, variants, products } from "../lib/db/schema";
import { formatOrderNumber } from "../lib/order-number";

const PERF_TEST_NOTE = "PERF_TEST_SEED";
const PERF_TEST_EMAIL_DOMAIN = "perf-test.invalid";
const ORDER_COUNT = 5000;
const BATCH_SIZE = 500;

const STATUSES = ["pending", "confirmed", "packed", "shipped", "delivered", "cancelled", "refunded"] as const;
const PAYMENT_METHODS = ["razorpay", "cod"] as const;

function randomFrom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Pulls `n` sequence values in ONE round trip (not n round trips) — generate_series driving
 * nextval() is the standard Postgres idiom for "give me a block of sequence numbers". */
async function nextOrderNumbersBlock(n: number): Promise<string[]> {
  const result = await scriptDb.execute<{ next: string }>(
    sql`select nextval('order_number_seq') as next from generate_series(1, ${n})`,
  );
  return result.rows.map((r) => formatOrderNumber(Number(r.next)));
}

async function cleanup(): Promise<void> {
  console.log(`Deleting synthetic orders (customer_note = '${PERF_TEST_NOTE}')...`);
  const targetOrderIds = await scriptDb.select({ id: orders.id }).from(orders).where(eq(orders.customerNote, PERF_TEST_NOTE));
  const ids = targetOrderIds.map((r) => r.id);
  if (ids.length === 0) {
    console.log("Nothing to clean up — no synthetic orders found.");
    return;
  }
  // order_items.order_id is ON DELETE RESTRICT (CLAUDE.md §6: orders/order_items never
  // cascade-deleted) — delete items first, then their orders, both scoped to only the synthetic
  // rows this script itself created.
  await scriptDb.execute(sql`delete from ${orderItems} where order_id in (select id from ${orders} where customer_note = ${PERF_TEST_NOTE})`);
  await scriptDb.delete(orders).where(eq(orders.customerNote, PERF_TEST_NOTE));
  console.log(`Deleted ${ids.length} synthetic orders and their line items. Local dev DB is back to its real-data-only state.`);
}

async function generate(): Promise<void> {
  const realVariants = await scriptDb
    .select({ id: variants.id, sku: variants.sku, optionValue: variants.optionValue, mrpPaise: variants.mrpPaise, pricePaise: variants.pricePaise, productName: products.name })
    .from(variants)
    .innerJoin(products, eq(products.id, variants.productId));

  if (realVariants.length === 0) {
    throw new Error("No variants found — run `pnpm db:seed` first so there's real catalogue data to reference.");
  }

  console.log(`Generating ${ORDER_COUNT} synthetic orders (PERF-TEST ONLY, labelled '${PERF_TEST_NOTE}')...`);
  const start = Date.now();

  for (let batchStart = 0; batchStart < ORDER_COUNT; batchStart += BATCH_SIZE) {
    const batchSize = Math.min(BATCH_SIZE, ORDER_COUNT - batchStart);
    const orderRows: (typeof orders.$inferInsert)[] = [];
    const itemsByIndex: (typeof orderItems.$inferInsert)[] = [];
    const orderNumbers = await nextOrderNumbersBlock(batchSize);

    for (let i = 0; i < batchSize; i++) {
      const n = batchStart + i;
      const variant = randomFrom(realVariants);
      const qty = 1 + Math.floor(Math.random() * 3);
      const lineTotal = variant.pricePaise * qty;
      const daysAgo = Math.floor(Math.random() * 365);
      const placedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
      const orderNumber = orderNumbers[i];

      orderRows.push({
        orderNumber,
        idempotencyKey: `perf-test-${randomUUID()}`,
        userId: null,
        email: `perf-test-${n}@${PERF_TEST_EMAIL_DOMAIN}`,
        phone: "0000000000",
        status: randomFrom(STATUSES),
        paymentMethod: randomFrom(PAYMENT_METHODS),
        paymentStatus: "paid",
        subtotalPaise: lineTotal,
        discountPaise: 0,
        shippingPaise: 0,
        totalPaise: lineTotal,
        shippingAddress: { name: "Perf Test", phone: "0000000000", line1: "Perf test address", city: "Sangrur", state: "Punjab", pincode: "148001" },
        billingAddress: null,
        customerNote: PERF_TEST_NOTE,
        placedAt,
        createdAt: placedAt,
        updatedAt: placedAt,
      });
      itemsByIndex.push({
        orderId: -1, // placeholder, resolved after insert
        variantId: variant.id,
        productName: variant.productName,
        optionValue: variant.optionValue,
        sku: variant.sku,
        mrpPaise: variant.mrpPaise,
        unitPricePaise: variant.pricePaise,
        qty,
        lineTotalPaise: lineTotal,
        imageStorageKey: null,
      });
    }

    const inserted = await scriptDb.insert(orders).values(orderRows).returning({ id: orders.id });
    const itemsToInsert = itemsByIndex.map((item, i) => ({ ...item, orderId: inserted[i].id }));
    await scriptDb.insert(orderItems).values(itemsToInsert);

    process.stdout.write(`\r  ${Math.min(batchStart + batchSize, ORDER_COUNT)}/${ORDER_COUNT} inserted`);
  }
  console.log(`\nInsert complete in ${((Date.now() - start) / 1000).toFixed(1)}s.`);
}

async function timeDefaultAdminOrdersQuery(): Promise<void> {
  console.log("\n--- Timing the default admin orders list query (page 1, no filters, sorted by placed_at desc) ---");

  const explain = await scriptDb.execute(sql`
    explain analyze
    select id, order_number, email, phone, status, payment_method, payment_status, total_paise, placed_at, shiprocket_order_id, awb
    from ${orders}
    order by placed_at desc
    limit 50 offset 0
  `);
  console.log(explain.rows.map((r) => Object.values(r)[0]).join("\n"));

  const countStart = Date.now();
  const [{ n }] = await scriptDb.execute<{ n: number }>(sql`select count(*)::int as n from ${orders}`).then((r) => r.rows);
  console.log(`\ncount(*) over ${n} total rows took ${Date.now() - countStart}ms`);

  const searchStart = Date.now();
  await scriptDb.execute(sql`
    select id from ${orders}
    where order_number ilike '%DM-2026%' or phone ilike '%99%' or email ilike '%perf-test%'
    order by placed_at desc limit 50
  `);
  console.log(`Search-by-order-number/phone/email query took ${Date.now() - searchStart}ms`);
}

async function main() {
  const cleanupMode = process.argv.includes("--cleanup");
  if (cleanupMode) {
    await cleanup();
    return;
  }
  await generate();
  await timeDefaultAdminOrdersQuery();
  console.log(`\nRun \`pnpm seed-perf-orders --cleanup\` to remove these ${ORDER_COUNT} synthetic orders from the local dev DB.`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.stack ?? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => closeScriptDb());
