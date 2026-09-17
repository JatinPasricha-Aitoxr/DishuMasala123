import { scriptDb, closeScriptDb, sql } from "../lib/db/script-client";
import { orders, orderItems, coupons, couponRedemptions, reviewPhotos, reviews } from "../lib/db/schema";

async function main() {
  // Child-first, respecting the RESTRICT foreign keys CLAUDE.md §6 puts on orders/order_items.
  await scriptDb.delete(couponRedemptions);
  await scriptDb.delete(orderItems);
  await scriptDb.delete(orders);
  console.log("Deleted coupon_redemptions, order_items, orders (all confirmed test data).");

  await scriptDb.delete(reviewPhotos);
  await scriptDb.delete(reviews);
  console.log("Deleted review_photos, reviews (all 3 were 'E2E Tester' test artifacts).");

  // Reset used_count on coupons since every redemption that counted toward it was test data.
  await scriptDb.update(coupons).set({ usedCount: 0 });
  console.log("Reset coupons.used_count to 0.");

  // Reset the order_number sequence so the next real order starts clean at DM-2026-00001 instead
  // of continuing from wherever the deleted test orders left off.
  await scriptDb.execute(sql`ALTER SEQUENCE order_number_seq RESTART WITH 1`);
  console.log("Reset order_number_seq to 1.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(closeScriptDb);
