/**
 * Pure filter/sort/pagination logic for /shop (PROMPTS.md Phase 3). Deliberately split out of
 * shop.ts (which owns the actual `db` round trip): this file imports only drizzle-orm's SQL
 * operators and the schema tables — never the live `db` instance — so it never opens a Postgres
 * connection and can be unit-tested with `drizzle.mock()` (a real dialect binding, zero network)
 * or plugged into either the app's `db` or a script's `scriptDb` (both plain-`pg` now)
 * unchanged.
 *
 * Every filter and sort here is a URL-searchParams concept (CLAUDE.md §3.2 / PROMPTS.md Phase 3:
 * "every filter and sort lives in the URL via searchParams") — `parseShopSearchParams` is the one
 * place raw `?collection=&size=&min=&max=&stock=&sort=&page=` strings become a typed, validated
 * filter object; everything downstream (the where/order builders, the page, the tests) works off
 * that typed shape, never off raw strings again.
 *
 * Deliberately does NOT `import "server-only"` — unlike shop.ts, this module is also imported
 * directly by lib/db/queries/__tests__/shop-query.test.ts (Vitest, plain Node, no bundler
 * "react-server" condition), and that package throws unconditionally outside of one. Nothing here
 * touches a live database or a secret, so there is nothing for that guard to protect.
 */
import { and, asc, desc, eq, exists, gte, lte, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { collections, products, variants } from "../schema";
import { toPaise, type Paise } from "@/lib/money";

export const SHOP_PAGE_SIZE = 24;

/** The three values CLAUDE.md §7.1 fixes for `products.option_label` — the "option/size" filter
 * (PROMPTS.md Phase 3 item 1) filters on this product-level column, not on individual variant
 * option values (which vary per product, e.g. "52 gm" vs "36" teabags vs "100 gm x 2"). */
export const SHOP_OPTION_LABELS = ["Size", "Combo", "Teabags"] as const;
export type ShopOptionLabel = (typeof SHOP_OPTION_LABELS)[number];

export const SHOP_SORTS = ["priority", "price-asc", "price-desc", "name"] as const;
export type ShopSort = (typeof SHOP_SORTS)[number];

export interface ShopFilters {
  /** Collection slug, or undefined for "all collections". */
  collection?: string;
  optionLabel?: ShopOptionLabel;
  /** Rupees, inclusive, already validated as finite non-negative numbers. */
  priceMinRupees?: number;
  priceMaxRupees?: number;
  inStockOnly: boolean;
  sort: ShopSort;
  page: number;
}

const shopSearchParamsSchema = z
  .object({
    collection: z.string().trim().min(1).optional(),
    size: z.enum(SHOP_OPTION_LABELS).optional(),
    min: z.coerce.number().finite().nonnegative().optional(),
    max: z.coerce.number().finite().nonnegative().optional(),
    stock: z.union([z.literal("1"), z.literal("true")]).optional(),
    sort: z.enum(SHOP_SORTS).optional(),
    page: z.coerce.number().int().positive().optional(),
  })
  .partial();

/**
 * Parses `?collection=&size=&min=&max=&stock=&sort=&page=` (Next.js's `searchParams`, already a
 * plain string-keyed object) into a typed `ShopFilters`. Invalid/missing values fall back to sane
 * defaults (no filter, default sort, page 1) rather than throwing — a malformed or hand-edited URL
 * should still render a usable shop page, never a 500. When `min`/`max` are both present and
 * inverted (min > max), they are swapped rather than producing an impossible, always-empty range.
 */
export function parseShopSearchParams(
  raw: Record<string, string | string[] | undefined>,
): ShopFilters {
  const flat: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(raw)) {
    const v = Array.isArray(value) ? value[0] : value;
    // An empty string means "not provided" here, not "provided but blank" — the filter form's
    // "All collections"/"All types" radios submit `collection=`/`size=`, and a cleared price
    // input submits `min=`/`max=`, both real GET submissions (PROMPTS.md Phase 3's no-JS
    // requirement) that must reset to "no filter", not fail Zod coercion (`Number("")` is NaN)
    // and silently drop every OTHER filter in the same submission along with it.
    if (v !== "") flat[key] = v;
  }

  const parsed = shopSearchParamsSchema.safeParse(flat);
  const p = parsed.success ? parsed.data : {};

  let priceMinRupees = p.min;
  let priceMaxRupees = p.max;
  if (priceMinRupees != null && priceMaxRupees != null && priceMinRupees > priceMaxRupees) {
    [priceMinRupees, priceMaxRupees] = [priceMaxRupees, priceMinRupees];
  }

  return {
    collection: p.collection,
    optionLabel: p.size,
    priceMinRupees,
    priceMaxRupees,
    inStockOnly: p.stock === "1" || p.stock === "true",
    sort: p.sort ?? "priority",
    page: p.page ?? 1,
  };
}

/** Serialises a `ShopFilters` back to a `URLSearchParams`-compatible record — the inverse of
 * `parseShopSearchParams`, used by pagination/sort/filter links so every control preserves every
 * other currently-active filter instead of resetting the view. */
export function shopFiltersToSearchParams(filters: ShopFilters): Record<string, string> {
  const out: Record<string, string> = {};
  if (filters.collection) out.collection = filters.collection;
  if (filters.optionLabel) out.size = filters.optionLabel;
  if (filters.priceMinRupees != null) out.min = String(filters.priceMinRupees);
  if (filters.priceMaxRupees != null) out.max = String(filters.priceMaxRupees);
  if (filters.inStockOnly) out.stock = "1";
  if (filters.sort !== "priority") out.sort = filters.sort;
  if (filters.page !== 1) out.page = String(filters.page);
  return out;
}

/**
 * A product's own "position 0" variant — the same one `lib/product-card.ts`'s
 * `toProductCardProps` treats as representative (`product.variants[0]`) — as a correlated scalar
 * subquery. `scripts/seed.ts` assigns `position` from each product's own `variations.entries()`,
 * so every product's cheapest-listed/first variant is guaranteed position 0; nothing here assumes
 * a MIN() coincidence. Used for both the price-range filter and the price sorts, so "the price
 * shown on the card" and "the price the filter/sort matched on" are always the same number.
 */
export const primaryVariantPricePaiseExpr: SQL<number> = sql<number>`(
  select ${variants.pricePaise} from ${variants}
  where ${variants.productId} = ${products.id} and ${variants.position} = 0
  limit 1
)`;

function priceRangeCondition(filters: ShopFilters): SQL | undefined {
  const min = filters.priceMinRupees != null ? (toPaise(filters.priceMinRupees) as Paise) : undefined;
  const max = filters.priceMaxRupees != null ? (toPaise(filters.priceMaxRupees) as Paise) : undefined;
  if (min == null && max == null) return undefined;
  if (min != null && max != null) {
    return and(gte(primaryVariantPricePaiseExpr, min), lte(primaryVariantPricePaiseExpr, max));
  }
  if (min != null) return gte(primaryVariantPricePaiseExpr, min);
  return lte(primaryVariantPricePaiseExpr, max!);
}

/**
 * Builds the full WHERE clause for the shop query — every filter is expressed in SQL (collection
 * and option-label are plain equality on already-joined/product columns; in-stock and price range
 * are correlated subqueries against `variants`) so filtering never means "load everything and
 * filter in JS" (PROMPTS.md Phase 3 item 1). `excludeDimension` lets facet-count queries reuse
 * this exact builder while omitting one filter's own condition (so "how many Combo products would
 * there be" isn't self-filtered to zero when Size is already selected).
 */
export function buildShopWhereConditions(
  filters: ShopFilters,
  options: { excludeDimension?: keyof ShopFilters } = {},
): SQL[] {
  const conditions: SQL[] = [eq(products.status, "published")];
  const skip = options.excludeDimension;

  if (filters.collection && skip !== "collection") {
    conditions.push(eq(collections.slug, filters.collection));
  }
  if (filters.optionLabel && skip !== "optionLabel") {
    conditions.push(eq(products.optionLabel, filters.optionLabel));
  }
  if (filters.inStockOnly && skip !== "inStockOnly") {
    conditions.push(
      exists(
        sql`(select 1 from ${variants} where ${variants.productId} = ${products.id} and ${variants.inStock} = true)`,
      ),
    );
  }
  if (skip !== "priceMinRupees" && skip !== "priceMaxRupees") {
    const priceCond = priceRangeCondition(filters);
    if (priceCond) conditions.push(priceCond);
  }

  return conditions;
}

/**
 * Builds the ORDER BY sequence for a given sort. Default ("priority") is CLAUDE.md §7.2's rule —
 * "Blue Tea first. Then Red Tea. Then everything else", `priority` ascending — with price
 * DESCENDING as the documented secondary key (PROMPTS.md Phase 3: "this exact tiebreak"), so
 * within a priority tier (e.g. all four classic-teas products share priority 3) the more expensive
 * variant leads. `products.id` is always the final tiebreak so pagination is stable/deterministic
 * even when priority and price both tie.
 */
export function buildShopOrderBy(sort: ShopSort): SQL[] {
  switch (sort) {
    case "price-asc":
      return [asc(primaryVariantPricePaiseExpr), asc(products.priority), asc(products.id)];
    case "price-desc":
      return [desc(primaryVariantPricePaiseExpr), asc(products.priority), asc(products.id)];
    case "name":
      return [asc(products.name), asc(products.id)];
    case "priority":
    default:
      return [asc(products.priority), desc(primaryVariantPricePaiseExpr), asc(products.id)];
  }
}
