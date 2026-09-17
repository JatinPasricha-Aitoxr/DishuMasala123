/**
 * Uploads the client-supplied per-collection photos (data/category/1.png..6.png) for the
 * homepage's CategoryCircles strip and saves `settings.category_circle_images` — replacing the
 * earlier interim behaviour of borrowing each collection's top-priority product's primary image
 * (which, for several collections, is a marketing infographic rather than a clean lifestyle shot,
 * and looked bad cropped into a small circle).
 *
 * Run with: pnpm migrate-category-circles
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildKey, putObject } from "../lib/storage/storage-core";
import { processImage } from "../lib/storage/images";
import { closeScriptDb, scriptDb } from "../lib/db/script-client";
import { settings } from "../lib/db/schema";

const FILES: Record<string, { file: string; alt: string }> = {
  "blue-tea": { file: "1.png", alt: "Dishu Premium Herbal Blue Tea pack, butterfly pea flower tea" },
  spices: { file: "2.png", alt: "Dishu Spices pack, assorted whole and ground Indian spices" },
  "red-tea": { file: "3.png", alt: "Dishu Premium Herbal Red Tea pack, hibiscus flower tea" },
  "classic-teas": { file: "4.png", alt: "Dishu Classic Tea and Assam Tea packs" },
  combos: { file: "5.png", alt: "Dishu Masala gift box with Blue Tea, Red Tea and Spices packs" },
  // Distinct from "spices" above — the "Spices Combo" circle (app/page.tsx) is a different
  // collection tile than the single-pack "Spices" one, and both used to fall back to the shared
  // "combos" key (the Blue Tea–Red Tea gift-box photo), which was the wrong image for it. Client
  // supplied this exact combo pack-lineup photo (2026-09-17) for that circle specifically.
  "spices-combo": { file: "6.png", alt: "Dishu Spices Combo — Turmeric, Red Chilli, Coriander, Black Pepper and Garam Masala packs" },
};

async function main(): Promise<void> {
  // Reads from inside the repo, not ~/Downloads (changed 2026-09-17). The old path meant this
  // script only ever worked on the one machine where the client's files happened to be sitting in
  // a Downloads folder — it threw ENOENT on every other machine and in CI, which is why the
  // homepage circles had no images. Drop the six source files into data/category/ and commit them
  // like every other client-supplied asset in data/.
  const dir = join(process.cwd(), "data/category");
  const value: Record<string, { storageKey: string; width: number; height: number; alt: string }> = {};

  for (const [slug, { file, alt }] of Object.entries(FILES)) {
    const source = join(dir, file);
    if (!existsSync(source)) {
      // A clear instruction beats a raw ENOENT stack. Until these land, app/page.tsx falls back to
      // each collection's lead product photo, so the circles render something real either way.
      throw new Error(
        `Missing ${source}.\nPut the client's six category photos in data/category/ as 1.png .. 6.png ` +
          `(1 blue-tea, 2 spices, 3 red-tea, 4 classic-teas, 5 combos, 6 spices-combo), then re-run ` +
          `\`pnpm migrate-category-circles\`.`,
      );
    }
    const buffer = readFileSync(source);
    const processed = await processImage(buffer);
    const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 16);

    let canonicalKey: string | null = null;
    let canonicalWidth = 0;
    let canonicalHeight = 0;

    for (const derivative of processed.derivatives) {
      const key = buildKey("sections", `category-circle-${slug}`, hash, derivative.format, `w${derivative.width}`);
      await putObject(key, derivative.buffer, `image/${derivative.format}`);
      if (derivative.format === "webp" && derivative.width >= canonicalWidth) {
        canonicalKey = key;
        canonicalWidth = derivative.width;
        canonicalHeight = derivative.height;
      }
    }

    if (!canonicalKey) throw new Error(`${slug}: no webp derivative produced`);
    value[slug] = { storageKey: canonicalKey, width: canonicalWidth, height: canonicalHeight, alt };
    console.log(`[uploaded] ${slug}: ${file} -> ${canonicalKey} (${canonicalWidth}x${canonicalHeight})`);
  }

  await scriptDb
    .insert(settings)
    .values({ key: "category_circle_images", value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });

  console.log("settings.category_circle_images upserted.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeScriptDb();
  });
