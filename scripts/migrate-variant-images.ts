/**
 * Attaches a real, client-supplied photo to individual variants (not the whole product) — e.g.
 * Blue Tea loose's "52 gm x2" and "52 gm x4" pack tiers each got their own marketing pack-shot
 * (client request, 2026-09-17: "add the pack image above the variant ... matching the width of
 * the full variant"), distinct from the single shared `product_images` gallery every other
 * variant falls back to. Same upload pipeline as scripts/migrate-product-images.ts (content-hash
 * keys, sharp derivatives), writing into `variants.image_storage_key` instead of `product_images`.
 *
 * Source files: data/products/<slug>/VArients/<sku-suffix>.png — the SKU suffix after the
 * product's own SKU prefix identifies which variant a file belongs to (e.g. product sku "0023",
 * variant sku "0023-52-gm-2PK" -> file "2PK.png"), so this stays generic rather than one-off.
 *
 * Run with: pnpm migrate-variant-images -- <product-slug>
 * e.g.      pnpm migrate-variant-images -- premium-herbal-blue-tea-loose
 */
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { buildKey, putObject } from "../lib/storage/storage-core";
import { processImage } from "../lib/storage/images";
import { closeScriptDb, eq, scriptDb } from "../lib/db/script-client";
import { products, variants } from "../lib/db/schema";

// Maps a source filename (without extension) to the variant SKU suffix it belongs to. Extend
// this map (or the file naming) as more products get per-variant photography.
const FILENAME_TO_SKU_SUFFIX: Record<string, string> = {
  "1": "52-gm",
  "2": "2PK",
  "4": "4PK",
};

async function main(): Promise<void> {
  const slug = process.argv.slice(2).find((arg) => arg !== "--");
  if (!slug) {
    throw new Error("usage: pnpm migrate-variant-images -- <product-slug>");
  }

  const [product] = await scriptDb
    .select({ id: products.id, slug: products.slug, name: products.name })
    .from(products)
    .where(eq(products.slug, slug))
    .limit(1);
  if (!product) throw new Error(`product "${slug}" not found — run \`pnpm db:seed\` first`);

  const dir = join(process.cwd(), "data/products", slug, "VArients");
  const files = readdirSync(dir).filter((f) => /^\d+\.(png|jpe?g)$/i.test(f));
  if (files.length === 0) throw new Error(`no numbered image files found in ${dir}`);

  const productVariants = await scriptDb
    .select({ id: variants.id, sku: variants.sku, optionValue: variants.optionValue })
    .from(variants)
    .where(eq(variants.productId, product.id));

  for (const file of files) {
    const base = file.replace(/\.(png|jpe?g)$/i, "");
    const suffix = FILENAME_TO_SKU_SUFFIX[base];
    if (!suffix) {
      console.warn(`[skip] ${file}: no known SKU suffix mapping for "${base}"`);
      continue;
    }
    const variant = productVariants.find((v) => v.sku.endsWith(`-${suffix}`));
    if (!variant) {
      console.warn(`[skip] ${file}: no variant with SKU ending "-${suffix}" found for ${slug}`);
      continue;
    }

    const buffer = readFileSync(join(dir, file));
    const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 16);
    const processed = await processImage(buffer);

    let canonicalKey: string | null = null;
    let canonicalWidth = 0;
    for (const derivative of processed.derivatives) {
      const key = buildKey("products", `${product.slug}-variant`, hash, derivative.format, `w${derivative.width}`);
      await putObject(key, derivative.buffer, `image/${derivative.format}`);
      if (derivative.format === "webp" && derivative.width >= canonicalWidth) {
        canonicalKey = key;
        canonicalWidth = derivative.width;
      }
    }
    if (!canonicalKey) throw new Error(`${file}: no webp derivative produced`);

    await scriptDb.update(variants).set({ imageStorageKey: canonicalKey }).where(eq(variants.id, variant.id));
    console.log(`[updated] variant "${variant.optionValue}" (${variant.sku}) -> ${canonicalKey}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeScriptDb();
  });
