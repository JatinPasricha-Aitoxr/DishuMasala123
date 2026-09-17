/**
 * Operational, one-off content fix: pushes data/catalog.json's `shortDescription` for every
 * product into the database, by slug — nothing else. Deliberately narrower than re-running
 * scripts/seed.ts, which upserts every column (name, description, tags, priority, SEO fields...)
 * and would silently clobber any edit made since launch through the admin product editor.
 *
 * Idempotent — re-running it just writes the same value again. Safe to run against the shared
 * Supabase project from a local `.env` (same Postgres the deployed app reads).
 *
 * Usage: pnpm tsx --env-file-if-exists=.env scripts/update-short-descriptions.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { closeScriptDb, scriptDb, eq } from "../lib/db/script-client";
import { products } from "../lib/db/schema";

interface CatalogProduct {
  slug: string;
  shortDescription: string;
}

async function main() {
  const raw = readFileSync(join(__dirname, "..", "data", "catalog.json"), "utf-8");
  const catalog: { products: CatalogProduct[] } = JSON.parse(raw);

  let updated = 0;
  for (const p of catalog.products) {
    const result = await scriptDb
      .update(products)
      .set({ shortDescription: p.shortDescription, updatedAt: new Date() })
      .where(eq(products.slug, p.slug))
      .returning({ id: products.id });

    if (result.length === 0) {
      console.warn(`No product row for slug "${p.slug}" — skipped (not seeded yet?).`);
      continue;
    }
    updated++;
  }
  console.log(`Updated shortDescription on ${updated}/${catalog.products.length} products.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(closeScriptDb);
