/**
 * Pure pricing math for the "buy more, save more" pack-tier pattern (components/pdp/PackSelector)
 * — Starter (1×), Value (2×), Transformation (3×) of the *same* pack, at a flat per-tier discount
 * (never compounding: 20% off the 3-pack tier means every one of the 3 packs is 20% off the base
 * price, not 20% off an already-discounted price).
 *
 * Deliberately has no knowledge of a real `variantId`, `productId`, or DB row — every number here
 * comes from `basePricePaise` + `discountTiers`, both passed in by the caller. This file is not
 * the source of truth for a real cart total (CLAUDE.md §7.5 reserves that for
 * lib/commerce/pricing.ts, which re-reads a real variant from Postgres) — it's the display/local-
 * state math for a component that, today, has no corresponding real catalogue row per tier. See
 * PackSelector.tsx's own doc for what has to exist before this can drive a real "Add to cart".
 */
import { paise, sumPaise, type Paise } from "@/lib/money";

export interface DiscountTier {
  /** Display name — "Starter" / "Value" / "Transformation", or any label the caller supplies. */
  name: string;
  /** How many packs this tier bundles. */
  packs: number;
  /** Flat discount off the single-pack base price, applied to every pack in this tier (0-100). */
  discountPct: number;
  /** Marks this tier "Best Value" in the UI (PackSelector renders the badge, doesn't infer it). */
  recommended?: boolean;
}

export interface PackTierPricing extends Required<Pick<DiscountTier, "name" | "packs" | "discountPct">> {
  recommended: boolean;
  /** This tier's per-pack price, after its flat discount — the number the corner ribbon shows. */
  unitPricePaise: Paise;
  /** `unitPricePaise * packs` — what the shopper actually pays for this tier. */
  totalPaise: Paise;
  /** `basePricePaise * packs` — what the same number of packs would cost with no discount. */
  mrpTotalPaise: Paise;
  /** `mrpTotalPaise - totalPaise` — the "Save ₹Y" line. Zero for a 0%-discount tier (Starter). */
  savingsPaise: Paise;
}

/**
 * Computes every tier's price block from one base (single-pack) price. Rounds each tier's
 * per-pack price to the nearest paisa independently — `totalPaise` is `unitPricePaise * packs`,
 * not `basePricePaise * packs * (1 - discountPct/100)` re-rounded, so the displayed per-pack price
 * and the displayed total always agree with each other to the paisa.
 */
export function computePackTiers(basePricePaise: Paise, discountTiers: readonly DiscountTier[]): PackTierPricing[] {
  return discountTiers.map((tier) => {
    const unitPricePaise = paise(Math.round(basePricePaise * (1 - tier.discountPct / 100)));
    const totalPaise = paise(unitPricePaise * tier.packs);
    const mrpTotalPaise = paise(basePricePaise * tier.packs);
    return {
      name: tier.name,
      packs: tier.packs,
      discountPct: tier.discountPct,
      recommended: tier.recommended ?? false,
      unitPricePaise,
      totalPaise,
      mrpTotalPaise,
      savingsPaise: sumPaise([mrpTotalPaise, paise(-totalPaise)]),
    };
  });
}

/** The three tiers this pattern was designed around (CLAUDE.md-free product decision — a real
 * per-product override, if a future product needs different tiers, is just a different array
 * passed to `computePackTiers`/`<PackSelector discountTiers={...}>`, never a code change here). */
export const DEFAULT_PACK_DISCOUNT_TIERS: DiscountTier[] = [
  { name: "Starter", packs: 1, discountPct: 0 },
  { name: "Value", packs: 2, discountPct: 10 },
  { name: "Transformation", packs: 3, discountPct: 20, recommended: true },
];
