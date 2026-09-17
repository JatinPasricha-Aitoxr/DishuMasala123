/**
 * One-off: pushes the two Blue Tea products' updated `description` field (data/catalog.json is
 * the source of truth) into Postgres directly, without a full `pnpm db:seed` re-run — same pattern
 * as scripts/update-short-descriptions.ts. Only the "Health Benefits" section text changed (client
 * request, 2026-09-17, confirmed twice — see components/pdp/Details.tsx and
 * lib/pdp/parse-description.ts for the full log of this exception).
 *
 * Run with: pnpm tsx --env-file-if-exists=.env scripts/update-blue-tea-wellness-benefits.ts
 */
import catalog from "../data/catalog.json";
import { closeScriptDb, eq, scriptDb } from "../lib/db/script-client";
import { products } from "../lib/db/schema";

const SLUGS = ["premium-herbal-blue-tea-teabags", "premium-herbal-blue-tea-loose"];

async function main(): Promise<void> {
  for (const slug of SLUGS) {
    const product = catalog.products.find((p) => p.slug === slug);
    if (!product) throw new Error(`"${slug}" not found in data/catalog.json`);

    const result = await scriptDb
      .update(products)
      .set({ description: product.description, updatedAt: new Date() })
      .where(eq(products.slug, slug))
      .returning({ id: products.id });

    if (result.length === 0) throw new Error(`"${slug}" not found in products table — run \`pnpm db:seed\` first`);
    console.log(`[updated] ${slug} (product #${result[0].id})`);
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
