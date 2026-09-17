/**
 * Uploads the client-supplied corporate/bulk-gifting hero flat-lay
 * (data/products/corporate-gifting-hero.png) to Supabase Storage and saves
 * `settings.corporate_gifting_hero_image` — replaces the "corporate-gifting-hero" AI-placeholder
 * (components/media/Placeholder.tsx) with the real photo, same pattern as
 * scripts/migrate-red-tea-lifestyle.ts.
 *
 * Run with: npx tsx --env-file-if-exists=.env scripts/migrate-corporate-gifting-hero.ts
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildKey, putObject } from "../lib/storage/storage-core";
import { processImage } from "../lib/storage/images";
import { closeScriptDb, scriptDb } from "../lib/db/script-client";
import { settings } from "../lib/db/schema";

const FILE = "corporate-gifting-hero.png";
const ALT =
  "Dishu Masala corporate gifting hamper — Chai with Dishu Premium Herbal Blue Tea and Red Tea, " +
  "Turmeric, Coriander, Black Pepper, Red Chilli and Garam Masala powders, brewed blue and red tea " +
  "in glass cups, spices in brass bowls, gift box with gold ribbon on a dark walnut table";

async function main(): Promise<void> {
  const buffer = readFileSync(join(process.cwd(), "data/products", FILE));
  const processed = await processImage(buffer);
  const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 16);

  let canonicalKey: string | null = null;
  let canonicalWidth = 0;
  let canonicalHeight = 0;

  for (const derivative of processed.derivatives) {
    const key = buildKey("sections", "corporate-gifting-hero", hash, derivative.format, `w${derivative.width}`);
    await putObject(key, derivative.buffer, `image/${derivative.format}`);
    if (derivative.format === "webp" && derivative.width >= canonicalWidth) {
      canonicalKey = key;
      canonicalWidth = derivative.width;
      canonicalHeight = derivative.height;
    }
  }

  if (!canonicalKey) throw new Error("no webp derivative produced");
  const value = { storageKey: canonicalKey, width: canonicalWidth, height: canonicalHeight, alt: ALT };

  await scriptDb
    .insert(settings)
    .values({ key: "corporate_gifting_hero_image", value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });

  console.log(`[uploaded] corporate-gifting-hero: ${FILE} -> ${canonicalKey} (${canonicalWidth}x${canonicalHeight})`);
  console.log("settings.corporate_gifting_hero_image upserted.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeScriptDb();
  });
