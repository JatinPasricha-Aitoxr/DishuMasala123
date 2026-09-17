/**
 * Operational, one-off: updates settings.free_shipping_threshold_paise to the client's new real
 * value (₹499, was ₹500) and sets settings.free_gift_threshold_paise (₹699) — both per the
 * client's 2026-09-17 request for the homepage trust strip
 * (components/layout/TrustStrip.tsx). Also editable afterward from /admin/settings once a field
 * for the gift threshold is added there.
 *
 * Usage: npx tsx --env-file-if-exists=.env scripts/set-trust-strip-thresholds.ts
 */
import { closeScriptDb, scriptDb } from "../lib/db/script-client";
import { settings } from "../lib/db/schema";

const FREE_SHIPPING_THRESHOLD_PAISE = 49900; // ₹499
const FREE_GIFT_THRESHOLD_PAISE = 69900; // ₹699

async function main() {
  await scriptDb
    .insert(settings)
    .values({ key: "free_shipping_threshold_paise", value: FREE_SHIPPING_THRESHOLD_PAISE })
    .onConflictDoUpdate({ target: settings.key, set: { value: FREE_SHIPPING_THRESHOLD_PAISE } });
  console.log(`settings.free_shipping_threshold_paise set to ${FREE_SHIPPING_THRESHOLD_PAISE} (₹499).`);

  await scriptDb
    .insert(settings)
    .values({ key: "free_gift_threshold_paise", value: FREE_GIFT_THRESHOLD_PAISE })
    .onConflictDoUpdate({ target: settings.key, set: { value: FREE_GIFT_THRESHOLD_PAISE } });
  console.log(`settings.free_gift_threshold_paise set to ${FREE_GIFT_THRESHOLD_PAISE} (₹699).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(closeScriptDb);
