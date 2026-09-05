/**
 * Pulls every product image URL listed in data/catalog.json (currently hosted on
 * dishumasala.com/wp-content/uploads/), downloads with retry and a polite delay, generates AVIF +
 * WebP derivatives with sharp, uploads them to Supabase Storage, and inserts/updates `product_images` rows with
 * width, height, position and is_primary.
 *
 * This is how the client's existing photography survives the old site being switched off
 * (CLAUDE.md §8) — it must run, successfully, before that happens. Idempotent by content hash: a
 * re-run skips any image whose hash is already recorded against that product. Alt text is a
 * derived default (product name + position) — every row it writes is listed in the alt-text
 * review report this script prints and writes, because none of it is human-written yet.
 *
 * Run with: pnpm migrate-images
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildKey, putObject } from "../lib/storage/storage-core";
import { processImage } from "../lib/storage/images";
import { closeScriptDb, eq, scriptDb } from "../lib/db/script-client";
import { productImages, products } from "../lib/db/schema";

interface CatalogProduct {
  slug: string;
  name: string;
  images: string[];
}

interface Catalog {
  products: CatalogProduct[];
}

const RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 1000;
const POLITE_DELAY_MS = 350;

function loadCatalog(): Catalog {
  const raw = readFileSync(join(process.cwd(), "data/catalog.json"), "utf-8");
  return JSON.parse(raw) as Catalog;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function downloadWithRetry(url: string): Promise<Buffer> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt += 1) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }
      const arrayBuffer = await res.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (err) {
      lastError = err;
      if (attempt < RETRY_ATTEMPTS) {
        await sleep(RETRY_BASE_DELAY_MS * attempt);
      }
    }
  }
  throw new Error(`download failed after ${RETRY_ATTEMPTS} attempts: ${String(lastError)}`);
}

function altTextFor(productName: string, position: number, total: number): string {
  return total > 1
    ? `${productName} — pack photo ${position + 1} of ${total}`
    : `${productName} — pack photo`;
}

interface ReportRow {
  productSlug: string;
  position: number;
  sourceUrl: string;
  status: "uploaded" | "skipped-existing" | "failed";
  storageKey?: string;
  altText?: string;
  error?: string;
}

async function migrateProductImage(
  product: { id: number; slug: string; name: string },
  sourceUrl: string,
  position: number,
  total: number,
  existingHashes: Set<string>,
): Promise<ReportRow> {
  try {
    const buffer = await downloadWithRetry(sourceUrl);
    const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 16);

    if (existingHashes.has(hash)) {
      return { productSlug: product.slug, position, sourceUrl, status: "skipped-existing" };
    }

    const processed = await processImage(buffer);
    const alt = altTextFor(product.name, position, total);

    // Upload every derivative; record the largest WebP derivative as the canonical DB row (the
    // storefront's <picture>/next/image layer picks AVIF vs WebP and the right width at render
    // time — Phase 1+ — so Phase 0 just needs one authoritative width/height per image slot).
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

    if (!canonicalKey) {
      throw new Error("no webp derivative produced");
    }

    await scriptDb.insert(productImages).values({
      productId: product.id,
      storageKey: canonicalKey,
      alt,
      width: canonicalWidth,
      height: canonicalHeight,
      position,
      isPrimary: position === 0,
    });

    existingHashes.add(hash);
    return {
      productSlug: product.slug,
      position,
      sourceUrl,
      status: "uploaded",
      storageKey: canonicalKey,
      altText: alt,
    };
  } catch (err) {
    return {
      productSlug: product.slug,
      position,
      sourceUrl,
      status: "failed",
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    await sleep(POLITE_DELAY_MS);
  }
}

async function main(): Promise<void> {
  const catalog = loadCatalog();
  const report: ReportRow[] = [];

  for (const p of catalog.products) {
    const [row] = await scriptDb
      .select({ id: products.id, slug: products.slug, name: products.name })
      .from(products)
      .where(eq(products.slug, p.slug))
      .limit(1);

    if (!row) {
      report.push({
        productSlug: p.slug,
        position: -1,
        sourceUrl: "",
        status: "failed",
        error: "product not seeded yet — run `pnpm db:seed` first",
      });
      continue;
    }

    const existingRows = await scriptDb
      .select({ storageKey: productImages.storageKey })
      .from(productImages)
      .where(eq(productImages.productId, row.id));
    // A key looks like products/<slug>/<hash>-w<width>.<ext> — the hash segment is what
    // idempotency is keyed on.
    const existingHashes = new Set(
      existingRows.map((r) => r.storageKey.split("/").pop()?.split("-w")[0]).filter((h): h is string => !!h),
    );

    for (const [position, url] of p.images.entries()) {
      const result = await migrateProductImage(row, url, position, p.images.length, existingHashes);
      report.push(result);
      console.log(`[${result.status}] ${p.slug} #${position}: ${url}`);
    }
  }

  const uploaded = report.filter((r) => r.status === "uploaded");
  const skipped = report.filter((r) => r.status === "skipped-existing");
  const failed = report.filter((r) => r.status === "failed");

  console.log("\nSummary:");
  console.table(
    report.map((r) => ({
      product: r.productSlug,
      position: r.position,
      status: r.status,
      key: r.storageKey ?? "",
      error: r.error ?? "",
    })),
  );
  console.log(`uploaded=${uploaded.length} skipped=${skipped.length} failed=${failed.length}`);

  const reviewLines = [
    "# Image alt-text review",
    "",
    "Every alt text below was auto-generated from the product name and image position by",
    "scripts/migrate-images.ts. None of it is human-written. Review and replace before launch",
    "(CLAUDE.md §5.6 requires real alt text sourced from the DB, never an auto-filled default).",
    "",
    ...uploaded.map((r) => `- [ ] ${r.productSlug} #${r.position} (\`${r.storageKey}\`): "${r.altText}"`),
    "",
  ];
  writeFileSync(join(process.cwd(), "IMAGE_ALT_TEXT_REVIEW.md"), reviewLines.join("\n"));
  console.log(`\nWrote IMAGE_ALT_TEXT_REVIEW.md (${uploaded.length} rows needing human review).`);

  if (failed.length > 0) {
    console.error(`\n${failed.length} image(s) failed to migrate.`);
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error("migrate-images failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeScriptDb();
  });
