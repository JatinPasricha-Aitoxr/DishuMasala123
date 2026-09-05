/**
 * Uploads the client-supplied Red Tea lifestyle photo (data/banners/Red tea Skin.png) to Supabase Storage and
 * saves `settings.red_tea_lifestyle_image` — replaces the AI-placeholder that used to sit in the
 * homepage Red Tea section's image slot (components/media/Placeholder.tsx, slot
 * "red-tea-lifestyle") with the real photo, same as scripts/migrate-images.ts does per product.
 *
 * Run with: pnpm migrate-red-tea-lifestyle
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildKey, putObject } from "../lib/storage/storage-core";
import { processImage } from "../lib/storage/images";
import { closeScriptDb, scriptDb } from "../lib/db/script-client";
import { settings } from "../lib/db/schema";

const FILE = "Red tea Skin.png";
const ALT = "Red Tea for Skin — Dishu Premium Herbal Red Tea, brewed cup with hibiscus flowers, real hibiscus and rose flowers, caffeine-free";

async function main(): Promise<void> {
  const buffer = readFileSync(join(process.cwd(), "data/banners", FILE));
  const processed = await processImage(buffer);
  const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 16);

  let canonicalKey: string | null = null;
  let canonicalWidth = 0;
  let canonicalHeight = 0;

  for (const derivative of processed.derivatives) {
    const key = buildKey("sections", "red-tea-lifestyle", hash, derivative.format, `w${derivative.width}`);
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
    .values({ key: "red_tea_lifestyle_image", value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });

  console.log(`[uploaded] red-tea-lifestyle: ${FILE} -> ${canonicalKey} (${canonicalWidth}x${canonicalHeight})`);
  console.log("settings.red_tea_lifestyle_image upserted.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeScriptDb();
  });
