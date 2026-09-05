/**
 * The single pricing engine (CLAUDE.md §7.5 / PROMPTS.md Phase 5 item 3): every surface that
 * needs a price — cart validation, checkout, the Razorpay order amount, the confirmation email,
 * and any future admin surface — calls `computePricing`. No other file does its own subtotal,
 * discount or total arithmetic; grep the codebase to confirm.
 *
 * This module has no "server-only" import and no runtime drizzle import of its own (CLAUDE.md
 * §3.2: only lib/db/ may import drizzle) — every import of a lib/db/queries module below is
 * `import type` only, erased at compile time, so loading this file never touches Postgres or the
 * "server-only" guard. It reads variants/coupons through an injected `PricingDeps` instead; real
 * callers get `defaultPricingDeps` from `lib/commerce/pricing-deps.ts` (a genuinely server-only
 * module, kept separate for exactly this reason), while tests inject a fake `PricingDeps` and
 * assert on arithmetic alone with no database in the loop at all.
 */
import { paise, sumPaise, type Paise } from "@/lib/money";
import type { VariantPricingRow } from "@/lib/db/queries/variants";
import type { CouponRow } from "@/lib/db/queries/coupons";

export interface PricingLineInput {
  variantId: number;
  qty: number;
}

export interface PricingInput {
  lines: PricingLineInput[];
  /** Coupon code as typed by the shopper, or null/undefined for none. */
  couponCode?: string | null;
  /** Guest identity — checkout email. Required for a coupon's per-user/first-order rules to be
   * evaluated at all; without it those rules simply can't be checked yet (e.g. cart-drawer
   * validation before the shopper has entered an email at checkout). */
  email?: string | null;
  /** Injection point for tests; production callers omit this and get real Postgres reads. */
  now?: Date;
}

export interface PricingLine {
  variantId: number;
  productId: number;
  collectionId: number;
  productName: string;
  /** Display-only (CLAUDE.md §7.2 priority) — passed through so the cart's upsell rail can sort
   * without a second query; never part of any money computation. */
  priority: number;
  sku: string;
  optionValue: string;
  mrpPaise: Paise;
  unitPricePaise: Paise;
  /** Quantity actually priced — may be less than requested if stock forced a correction. */
  qty: number;
  requestedQty: number;
  lineTotalPaise: Paise;
  imageStorageKey: string | null;
}

export type PricingIssue =
  | { type: "variant_not_found"; variantId: number }
  | { type: "out_of_stock"; variantId: number; productName: string }
  | { type: "insufficient_stock"; variantId: number; productName: string; requestedQty: number; availableQty: number }
  | { type: "coupon_invalid"; code: string; reason: CouponRejectReason };

export type CouponRejectReason =
  | "not_found"
  | "inactive"
  | "not_started"
  | "expired"
  | "min_spend"
  | "usage_limit"
  | "per_user_limit"
  | "first_order_only"
  | "not_applicable";

export interface PricingResult {
  lines: PricingLine[];
  subtotalPaise: Paise;
  discountPaise: Paise;
  shippingPaise: Paise;
  totalPaise: Paise;
  /** Sum of (mrp - price) * qty across priced lines — "you saved ₹X vs MRP", independent of any coupon. */
  savingsPaise: Paise;
  couponCode: string | null;
  freeShippingThresholdPaise: Paise;
  rupeesToFreeShippingPaise: Paise;
  issues: PricingIssue[];
  /** True only when every input line priced exactly as requested and any submitted coupon was
   * accepted — i.e. nothing needed correcting. Callers (checkout route) use this to decide whether
   * a client-submitted total may be trusted to match, or must be rejected with the corrected cart. */
  clean: boolean;
}

export interface PricingDeps {
  getVariants: (ids: number[]) => Promise<VariantPricingRow[]>;
  getCoupon: (code: string) => Promise<CouponRow | null>;
  getFreeShippingThresholdPaise: () => Promise<Paise>;
  getStandardShippingPaise: () => Promise<Paise>;
  countCouponRedemptionsByEmail: (couponId: number, email: string) => Promise<number>;
  hasAnyOrderForEmail: (email: string) => Promise<boolean>;
}

/** Merges duplicate variant ids in the input (two lines for the same variant is the same as one
 * line with the summed quantity) and drops non-positive quantities. */
function normalizeLines(lines: PricingLineInput[]): PricingLineInput[] {
  const byVariant = new Map<number, number>();
  for (const line of lines) {
    if (!Number.isInteger(line.variantId) || !Number.isInteger(line.qty) || line.qty <= 0) continue;
    byVariant.set(line.variantId, (byVariant.get(line.variantId) ?? 0) + line.qty);
  }
  return Array.from(byVariant, ([variantId, qty]) => ({ variantId, qty }));
}

export interface CouponContext {
  subtotalPaise: Paise;
  now: Date;
  priorOrderExists: boolean;
  totalRedemptions: number;
  userRedemptions: number;
  hasEmail: boolean;
  /** Product/collection ids actually present in the priced cart, for `applies_to`. */
  cartProductIds: number[];
  cartCollectionIds: number[];
}

interface AppliesTo {
  productIds?: number[];
  collectionIds?: number[];
}

function parseAppliesTo(value: unknown): AppliesTo {
  if (value == null || typeof value !== "object") return {};
  const v = value as Record<string, unknown>;
  return {
    productIds: Array.isArray(v.productIds) ? v.productIds.filter((x): x is number => typeof x === "number") : undefined,
    collectionIds: Array.isArray(v.collectionIds)
      ? v.collectionIds.filter((x): x is number => typeof x === "number")
      : undefined,
  };
}

/**
 * Validates one coupon against one rule at a time (each independently unit-tested per
 * PROMPTS.md's explicit "each as its own test case, not one giant test" instruction):
 * existence, active window, minimum spend, overall usage limit, per-user limit, first-order-only,
 * and any `applies_to` restriction. Pure — takes an already-fetched `CouponRow` and a pre-computed
 * context, does no I/O itself.
 */
export function validateCoupon(
  coupon: CouponRow | null,
  ctx: CouponContext,
): { ok: true } | { ok: false; reason: CouponRejectReason } {
  if (!coupon) return { ok: false, reason: "not_found" };
  if (!coupon.active) return { ok: false, reason: "inactive" };
  if (coupon.startsAt && ctx.now < coupon.startsAt) return { ok: false, reason: "not_started" };
  if (coupon.endsAt && ctx.now > coupon.endsAt) return { ok: false, reason: "expired" };
  if (coupon.minSpendPaise != null && ctx.subtotalPaise < coupon.minSpendPaise) {
    return { ok: false, reason: "min_spend" };
  }
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
    return { ok: false, reason: "usage_limit" };
  }
  if (coupon.perUserLimit != null) {
    // Without an email we cannot know per-user usage — treat as not-yet-satisfiable rather than
    // silently allowing it (a guest who hasn't entered an email yet simply can't redeem a
    // per-user-limited coupon until they do).
    if (!ctx.hasEmail || ctx.userRedemptions >= coupon.perUserLimit) {
      return { ok: false, reason: "per_user_limit" };
    }
  }
  if (coupon.firstOrderOnly) {
    if (!ctx.hasEmail || ctx.priorOrderExists) return { ok: false, reason: "first_order_only" };
  }
  const restriction = parseAppliesTo(coupon.appliesTo);
  const hasProductRestriction = !!restriction.productIds?.length;
  const hasCollectionRestriction = !!restriction.collectionIds?.length;
  if (hasProductRestriction || hasCollectionRestriction) {
    const productsOk = !hasProductRestriction || ctx.cartProductIds.every((id) => restriction.productIds!.includes(id));
    const collectionsOk =
      !hasCollectionRestriction || ctx.cartCollectionIds.every((id) => restriction.collectionIds!.includes(id));
    if (!productsOk || !collectionsOk) return { ok: false, reason: "not_applicable" };
  }
  return { ok: true };
}

/** Discount in paise for a coupon already known to be valid (`validateCoupon` returned ok).
 * `kind: "fixed"`'s `value` column is itself an integer amount of paise (consistent with every
 * other money column in the schema); `kind: "percent"`'s `value` is a whole-number percentage.
 * Never exceeds the subtotal, and is capped by `maxDiscountPaise` when set. */
export function computeCouponDiscountPaise(coupon: CouponRow, subtotalPaise: Paise): Paise {
  let discount = coupon.kind === "percent" ? Math.round((subtotalPaise * coupon.value) / 100) : coupon.value;
  if (coupon.maxDiscountPaise != null) discount = Math.min(discount, coupon.maxDiscountPaise);
  discount = Math.max(0, Math.min(discount, subtotalPaise));
  return paise(discount);
}

/**
 * The pricing engine. Re-reads every variant fresh from Postgres (via `deps`), clamps quantities
 * to real stock, prices only what's actually purchasable, evaluates an optional coupon against
 * every rule, and returns a fully server-computed breakdown plus a list of everything that had to
 * be corrected. Never trusts a caller-supplied price (CLAUDE.md §7.5).
 */
export async function computePricing(input: PricingInput, deps: PricingDeps): Promise<PricingResult> {
  const now = input.now ?? new Date();
  const normalized = normalizeLines(input.lines);
  const issues: PricingIssue[] = [];

  const variantRows = await deps.getVariants(normalized.map((l) => l.variantId));
  const byId = new Map(variantRows.map((v) => [v.variantId, v]));

  const lines: PricingLine[] = [];
  for (const { variantId, qty: requestedQty } of normalized) {
    const v = byId.get(variantId);
    if (!v) {
      issues.push({ type: "variant_not_found", variantId });
      continue;
    }
    if (!v.inStock) {
      issues.push({ type: "out_of_stock", variantId, productName: v.productName });
      continue;
    }
    let qty = requestedQty;
    if (v.stockQty != null && requestedQty > v.stockQty) {
      issues.push({
        type: "insufficient_stock",
        variantId,
        productName: v.productName,
        requestedQty,
        availableQty: v.stockQty,
      });
      qty = v.stockQty;
    }
    if (qty <= 0) continue;
    lines.push({
      variantId: v.variantId,
      productId: v.productId,
      collectionId: v.collectionId,
      productName: v.productName,
      priority: v.priority,
      sku: v.sku,
      optionValue: v.optionValue,
      mrpPaise: v.mrpPaise,
      unitPricePaise: v.pricePaise,
      qty,
      requestedQty,
      lineTotalPaise: paise(v.pricePaise * qty),
      imageStorageKey: v.imageStorageKey,
    });
  }

  const subtotalPaise = sumPaise(lines.map((l) => l.lineTotalPaise));
  const savingsPaise = sumPaise(lines.map((l) => paise((l.mrpPaise - l.unitPricePaise) * l.qty)));

  let discountPaise: Paise = paise(0);
  let couponCode: string | null = null;
  const requestedCode = input.couponCode?.trim();
  if (requestedCode) {
    const coupon = await deps.getCoupon(requestedCode);
    const hasEmail = !!input.email;
    const [priorOrderExists, userRedemptions] = await Promise.all([
      hasEmail ? deps.hasAnyOrderForEmail(input.email!) : Promise.resolve(false),
      hasEmail && coupon ? deps.countCouponRedemptionsByEmail(coupon.id, input.email!) : Promise.resolve(0),
    ]);
    const ctx: CouponContext = {
      subtotalPaise,
      now,
      priorOrderExists,
      totalRedemptions: coupon?.usedCount ?? 0,
      userRedemptions,
      hasEmail,
      cartProductIds: Array.from(new Set(lines.map((l) => l.productId))),
      cartCollectionIds: Array.from(new Set(lines.map((l) => l.collectionId))),
    };
    const verdict = validateCoupon(coupon, ctx);
    if (verdict.ok && coupon) {
      discountPaise = computeCouponDiscountPaise(coupon, subtotalPaise);
      couponCode = coupon.code;
    } else if (!verdict.ok) {
      issues.push({ type: "coupon_invalid", code: requestedCode.toUpperCase(), reason: verdict.reason });
    }
  }

  const [freeShippingThresholdPaise, standardShippingPaise] = await Promise.all([
    deps.getFreeShippingThresholdPaise(),
    deps.getStandardShippingPaise(),
  ]);
  // Free-shipping eligibility is judged on the undiscounted subtotal — "spend ₹500" means cart
  // value, not the post-coupon amount — matching the cart drawer's progress bar, which has no
  // coupon applied yet when it's shown.
  const shippingPaise: Paise = subtotalPaise >= freeShippingThresholdPaise ? paise(0) : standardShippingPaise;
  const rupeesToFreeShippingPaise: Paise = paise(Math.max(0, freeShippingThresholdPaise - subtotalPaise));

  const totalPaise = paise(subtotalPaise - discountPaise + shippingPaise);

  const requestedCouponRejected = !!requestedCode && couponCode === null;
  const anyStockIssue = issues.some((i) => i.type !== "coupon_invalid");
  const clean = !anyStockIssue && !requestedCouponRejected;

  return {
    lines,
    subtotalPaise,
    discountPaise,
    shippingPaise,
    totalPaise,
    savingsPaise,
    couponCode,
    freeShippingThresholdPaise,
    rupeesToFreeShippingPaise,
    issues,
    clean,
  };
}
