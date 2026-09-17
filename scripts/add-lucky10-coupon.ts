/**
 * Operational, one-off: adds the LUCKY10 coupon (10% off, first order only) that
 * components/marketing/PhoneCapturePopup.tsx now promises after a phone-number submission.
 * Same shape as scripts/seed.ts's WELCOME5, kept as its own script rather than folded into that
 * seed so it can be run once against the live database without re-running the full catalogue seed.
 *
 * Usage: npx tsx --env-file-if-exists=.env scripts/add-lucky10-coupon.ts
 */
import { closeScriptDb, scriptDb } from "../lib/db/script-client";
import { coupons } from "../lib/db/schema";

async function main() {
  await scriptDb
    .insert(coupons)
    .values({
      code: "LUCKY10",
      kind: "percent",
      value: 10,
      firstOrderOnly: true,
      active: true,
    })
    .onConflictDoUpdate({
      target: coupons.code,
      set: { kind: "percent", value: 10, firstOrderOnly: true, active: true },
    });
  console.log("LUCKY10 coupon upserted — 10% off, first order only.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(closeScriptDb);
