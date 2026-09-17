/**
 * Operational, one-off: sets settings.support_email — the real inbox the corporate-gifting page's
 * fallback contact row (components/gifting/BulkEnquiryForm.tsx) links to. Also editable afterward
 * from /admin/settings once that field is added there; this script just seeds the initial real
 * value the client supplied directly.
 *
 * Usage: npx tsx --env-file-if-exists=.env scripts/set-support-email.ts
 */
import { closeScriptDb, scriptDb } from "../lib/db/script-client";
import { settings } from "../lib/db/schema";

const SUPPORT_EMAIL = "dishufoodandbeverages@gmail.com";

async function main() {
  await scriptDb
    .insert(settings)
    .values({ key: "support_email", value: { email: SUPPORT_EMAIL } })
    .onConflictDoUpdate({ target: settings.key, set: { value: { email: SUPPORT_EMAIL } } });
  console.log(`settings.support_email set to ${SUPPORT_EMAIL}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(closeScriptDb);
