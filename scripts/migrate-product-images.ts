/**
 * Replaces a single product's PDP gallery with a new, client-supplied photo set —
 * data/products/<slug>/1.png, 2.png, ... (numeric filename order = display order, 1 becomes the
 * primary/cover photo) — uploaded to Supabase Storage (content-hash keys, same pipeline as
 * scripts/migrate-images.ts) and swapped in for the product's existing `product_images` rows
 * rather than appended to them, since every request so far has been "change the photos", not "add
 * more". Generic by slug (not a one-off script per product) after the third near-identical
 * one-off (coriander-powder) made the duplication worth collapsing (CLAUDE.md §12: fewer, better
 * files).
 *
 * Some client-supplied images carry marketing/health-adjacent text baked into the pixels (e.g.
 * "Aids Digestion") — the same standing, logged exception as the homepage/section banners
 * (CLAUDE.md §8's 2026-08-28 note): used as-is by client choice. Alt text this script writes stays
 * a plain factual description, never repeating or inventing a claim.
 *
 * Run with: pnpm migrate-product-images -- <product-slug>
 * e.g.      pnpm migrate-product-images -- red-chilli-powder
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildKey, putObject } from "../lib/storage/storage-core";
import { processImage } from "../lib/storage/images";
import { closeScriptDb, eq, scriptDb } from "../lib/db/script-client";
import { productImages, products } from "../lib/db/schema";

function loadFiles(slug: string): string[] {
  const dir = join(process.cwd(), "data/products", slug);
  const files = readdirSync(dir).filter((f) => /^\d+\.(png|jpe?g)$/i.test(f));
  if (files.length === 0) {
    throw new Error(`no numbered image files (1.png, 2.png, ...) found in data/products/${slug}/`);
  }
  // Numeric, not lexicographic, order — "2.png" must sort before "10.png".
  return files.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
}

async function main(): Promise<void> {
  const slug = process.argv.slice(2).find((arg) => arg !== "--");
  if (!slug) {
    throw new Error("usage: pnpm migrate-product-images -- <product-slug>");
  }

  const [product] = await scriptDb
    .select({ id: products.id, slug: products.slug, name: products.name })
    .from(products)
    .where(eq(products.slug, slug))
    .limit(1);

  if (!product) {
    throw new Error(`product "${slug}" not found — run \`pnpm db:seed\` first`);
  }

  const files = loadFiles(slug);
  const uploaded: { position: number; storageKey: string; width: number; height: number }[] = [];

  for (const [position, file] of files.entries()) {
    const buffer = readFileSync(join(process.cwd(), "data/products", slug, file));
    const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 16);
    const processed = await processImage(buffer);

    let canonicalKey: string | null = null;
    let canonicalWidth = 0;
    let canonicalHeight = 0;

    for (const derivative of processed.derivatives) {
      const key = buildKey("products", product.slug, hash, derivative.format, `w${derivative.width}`);
      await putObject(key, derivative.buffer, `image/${derivative.format}`);
      if (derivative.format === "webp" && derivative.width >= canonicalWidth) {
        canonicalKey = key;
        canonicalWidth = derivative.width;
        canonicalHeight = derivative.height;
      }
    }

    if (!canonicalKey) throw new Error(`${file}: no webp derivative produced`);
    uploaded.push({ position, storageKey: canonicalKey, width: canonicalWidth, height: canonicalHeight });
    console.log(`[uploaded] #${position}: ${file} -> ${canonicalKey} (${canonicalWidth}x${canonicalHeight})`);
  }

  // Replace, not append.
  await scriptDb.delete(productImages).where(eq(productImages.productId, product.id));

  await scriptDb.insert(productImages).values(
    uploaded.map((img) => ({
      productId: product.id,
      storageKey: img.storageKey,
      alt: `${product.name} — pack photo ${img.position + 1} of ${uploaded.length}`,
      width: img.width,
      height: img.height,
      position: img.position,
      isPrimary: img.position === 0,
    })),
  );

  console.log(`\nproduct_images replaced for "${slug}" (${uploaded.length} images).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeScriptDb();
  });
