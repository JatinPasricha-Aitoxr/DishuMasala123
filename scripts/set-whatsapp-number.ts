/**
 * Operational, one-off: sets settings.whatsapp_number for the floating WhatsApp button
 * (components/marketing/WhatsAppButton.tsx). Also editable afterward from /admin/settings —
 * this script just seeds the initial real value the client supplied.
 *
 * Usage: npx tsx --env-file-if-exists=.env scripts/set-whatsapp-number.ts
 */
import { closeScriptDb, scriptDb } from "../lib/db/script-client";
import { settings } from "../lib/db/schema";

const WHATSAPP_NUMBER = "917710219958";

async function main() {
  // Object-wrapped ({ number }), not a bare string — see lib/db/queries/settings.ts's
  // getWhatsAppNumber for the drizzle-orm/node-postgres jsonb double-parse this avoids.
  await scriptDb
    .insert(settings)
    .values({ key: "whatsapp_number", value: { number: WHATSAPP_NUMBER } })
    .onConflictDoUpdate({ target: settings.key, set: { value: { number: WHATSAPP_NUMBER } } });
  console.log(`settings.whatsapp_number set to ${WHATSAPP_NUMBER}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(closeScriptDb);
