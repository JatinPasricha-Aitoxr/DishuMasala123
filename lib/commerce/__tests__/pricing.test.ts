import { describe, expect, it } from "vitest";
import { paise } from "@/lib/money";
import {
  computeCouponDiscountPaise,
  computePricing,
  validateCoupon,
  type CouponContext,
  type PricingDeps,
} from "../pricing";
import type { CouponRow } from "@/lib/db/queries/coupons";
import type { VariantPricingRow } from "@/lib/db/queries/variants";

// A small fake catalogue — two products, one out-of-stock variant, one with a real (low) count.
const BLUE_500: VariantPricingRow = {
  variantId: 1,
  productId: 10,
  collectionId: 1,
  priority: 1,
  productName: "Blue Tea",
  sku: "BT-500",
  optionValue: "500g",
  mrpPaise: paise(60000),
  pricePaise: paise(50000),
  inStock: true,
  stockQty: null,
  imageStorageKey: "products/blue-tea/a.jpg",
};
const RED_250: VariantPricingRow = {
  variantId: 2,
  productId: 11,
  collectionId: 2,
  priority: 2,
  productName: "Red Tea",
  sku: "RT-250",
  optionValue: "250g",
  mrpPaise: paise(30000),
  pricePaise: paise(25000),
  inStock: true,
  stockQty: 3,
  imageStorageKey: null,
};
const OUT_OF_STOCK: VariantPricingRow = {
  variantId: 3,
  productId: 12,
  collectionId: 5,
  priority: 5,
  productName: "Turmeric",
  sku: "TU-100",
  optionValue: "100g",
  mrpPaise: paise(12000),
  pricePaise: paise(12000), // price == mrp, no discount chip case
  inStock: false,
  stockQty: null,
  imageStorageKey: null,
};

const CATALOG = [BLUE_500, RED_250, OUT_OF_STOCK];

const WELCOME5: CouponRow = {
  id: 1,
  code: "WELCOME5",
  kind: "percent",
  value: 5,
  minSpendPaise: null,
  maxDiscountPaise: null,
  firstOrderOnly: true,
  usageLimit: null,
  usedCount: 0,
  perUserLimit: null,
  startsAt: null,
  endsAt: null,
  active: true,
  appliesTo: null,
};

function fakeDeps(overrides: Partial<PricingDeps> = {}): PricingDeps {
  return {
    getVariants: async (ids) => CATALOG.filter((v) => ids.includes(v.variantId)),
    getCoupon: async (code) => (code.toUpperCase() === "WELCOME5" ? WELCOME5 : null),
    getFreeShippingThresholdPaise: async () => paise(50000),
    getStandardShippingPaise: async () => paise(5000),
    countCouponRedemptionsByEmail: async () => 0,
    hasAnyOrderForEmail: async () => false,
    ...overrides,
  };
}

describe("computePricing — subtotal/shipping/total recomputation", () => {
  it("computes subtotal, savings and total for a simple cart with no coupon", async () => {
    const result = await computePricing(
      { lines: [{ variantId: 1, qty: 1 }, { variantId: 2, qty: 2 }] },
      fakeDeps(),
    );
    // subtotal = 50000 + 2*25000 = 100000
    expect(result.subtotalPaise).toBe(100000);
    // savings = (60000-50000)*1 + (30000-25000)*2 = 10000 + 10000 = 20000
    expect(result.savingsPaise).toBe(20000);
    expect(result.discountPaise).toBe(0);
    expect(result.shippingPaise).toBe(0); // over the 50000 threshold
    expect(result.totalPaise).toBe(100000);
    expect(result.clean).toBe(true);
  });

  it("charges standard shipping under the free-shipping threshold and reports rupees remaining", async () => {
    const result = await computePricing({ lines: [{ variantId: 2, qty: 1 }] }, fakeDeps());
    expect(result.subtotalPaise).toBe(25000);
    expect(result.shippingPaise).toBe(5000);
    expect(result.rupeesToFreeShippingPaise).toBe(25000);
    expect(result.totalPaise).toBe(30000);
  });

  it("merges duplicate lines for the same variant into one priced line", async () => {
    const result = await computePricing(
      { lines: [{ variantId: 1, qty: 1 }, { variantId: 1, qty: 2 }] },
      fakeDeps(),
    );
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].qty).toBe(3);
    expect(result.subtotalPaise).toBe(150000);
  });

  it("drops an unknown variant id and reports variant_not_found, pricing the rest of the cart", async () => {
    const result = await computePricing({ lines: [{ variantId: 999, qty: 1 }, { variantId: 1, qty: 1 }] }, fakeDeps());
    expect(result.issues).toContainEqual({ type: "variant_not_found", variantId: 999 });
    expect(result.subtotalPaise).toBe(50000);
    expect(result.clean).toBe(false);
  });

  it("drops an out-of-stock variant and reports it, never pricing it", async () => {
    const result = await computePricing({ lines: [{ variantId: 3, qty: 1 }] }, fakeDeps());
    expect(result.issues).toContainEqual({ type: "out_of_stock", variantId: 3, productName: "Turmeric" });
    expect(result.subtotalPaise).toBe(0);
    expect(result.clean).toBe(false);
  });

  it("clamps quantity to real stock and reports insufficient_stock with what's actually available", async () => {
    const result = await computePricing({ lines: [{ variantId: 2, qty: 10 }] }, fakeDeps());
    expect(result.issues).toContainEqual({
      type: "insufficient_stock",
      variantId: 2,
      productName: "Red Tea",
      requestedQty: 10,
      availableQty: 3,
    });
    expect(result.lines[0].qty).toBe(3);
    expect(result.subtotalPaise).toBe(75000);
    expect(result.clean).toBe(false);
  });

  it("this IS the manipulated-price defence: the client's own numbers are never read — a caller passing only ids/qty gets a server-computed total regardless of what a tampered UI might have displayed", async () => {
    // No priceOverride field exists on PricingLineInput at all — there is nothing to tamper.
    const result = await computePricing({ lines: [{ variantId: 1, qty: 1 }] }, fakeDeps());
    expect(result.totalPaise).toBe(50000); // the real server price, not whatever a client might claim
  });
});

describe("computePricing — coupon application end to end", () => {
  it("applies WELCOME5 (5% off) for a first-time email and reports the accepted code", async () => {
    const result = await computePricing(
      { lines: [{ variantId: 1, qty: 1 }], couponCode: "welcome5", email: "new@example.com" },
      fakeDeps(),
    );
    expect(result.couponCode).toBe("WELCOME5");
    expect(result.discountPaise).toBe(2500); // 5% of 50000
    expect(result.totalPaise).toBe(47500);
    expect(result.clean).toBe(true);
  });

  it("rejects WELCOME5 for a returning email (first-order-only) and reports why", async () => {
    const result = await computePricing(
      { lines: [{ variantId: 1, qty: 1 }], couponCode: "WELCOME5", email: "returning@example.com" },
      fakeDeps({ hasAnyOrderForEmail: async () => true }),
    );
    expect(result.couponCode).toBeNull();
    expect(result.discountPaise).toBe(0);
    expect(result.issues).toContainEqual({ type: "coupon_invalid", code: "WELCOME5", reason: "first_order_only" });
    expect(result.clean).toBe(false);
  });

  it("rejects an unknown coupon code", async () => {
    const result = await computePricing(
      { lines: [{ variantId: 1, qty: 1 }], couponCode: "NOPE10", email: "a@example.com" },
      fakeDeps(),
    );
    expect(result.issues).toContainEqual({ type: "coupon_invalid", code: "NOPE10", reason: "not_found" });
  });
});

describe("computeCouponDiscountPaise", () => {
  it("computes a percent discount, rounded", () => {
    expect(computeCouponDiscountPaise(WELCOME5, paise(9999))).toBe(500); // round(9999*0.05)=500
  });

  it("computes a fixed discount in paise directly", () => {
    const fixed: CouponRow = { ...WELCOME5, kind: "fixed", value: 10000 };
    expect(computeCouponDiscountPaise(fixed, paise(50000))).toBe(10000);
  });

  it("caps a discount at maxDiscountPaise", () => {
    const capped: CouponRow = { ...WELCOME5, maxDiscountPaise: 1000 };
    expect(computeCouponDiscountPaise(capped, paise(100000))).toBe(1000); // 5% would be 5000, capped to 1000
  });

  it("never discounts more than the subtotal", () => {
    const fixed: CouponRow = { ...WELCOME5, kind: "fixed", value: 999999 };
    expect(computeCouponDiscountPaise(fixed, paise(1000))).toBe(1000);
  });
});

describe("validateCoupon — every rule as its own case", () => {
  const baseCtx: CouponContext = {
    subtotalPaise: paise(100000),
    now: new Date("2026-06-01T00:00:00Z"),
    priorOrderExists: false,
    totalRedemptions: 0,
    userRedemptions: 0,
    hasEmail: true,
    cartProductIds: [10],
    cartCollectionIds: [1],
  };

  it("existence: null coupon is rejected as not_found", () => {
    expect(validateCoupon(null, baseCtx)).toEqual({ ok: false, reason: "not_found" });
  });

  it("active window: an inactive coupon is rejected", () => {
    expect(validateCoupon({ ...WELCOME5, active: false }, baseCtx)).toEqual({ ok: false, reason: "inactive" });
  });

  it("active window: a coupon that hasn't started yet is rejected", () => {
    const coupon: CouponRow = { ...WELCOME5, startsAt: new Date("2027-01-01") };
    expect(validateCoupon(coupon, baseCtx)).toEqual({ ok: false, reason: "not_started" });
  });

  it("active window: an expired coupon is rejected", () => {
    const coupon: CouponRow = { ...WELCOME5, endsAt: new Date("2025-01-01") };
    expect(validateCoupon(coupon, baseCtx)).toEqual({ ok: false, reason: "expired" });
  });

  it("active window: within starts_at/ends_at is accepted", () => {
    const coupon: CouponRow = { ...WELCOME5, startsAt: new Date("2026-01-01"), endsAt: new Date("2026-12-31") };
    expect(validateCoupon(coupon, baseCtx)).toEqual({ ok: true });
  });

  it("minimum spend: below min_spend_paise is rejected", () => {
    const coupon: CouponRow = { ...WELCOME5, minSpendPaise: 200000 };
    expect(validateCoupon(coupon, baseCtx)).toEqual({ ok: false, reason: "min_spend" });
  });

  it("minimum spend: at or above min_spend_paise is accepted", () => {
    const coupon: CouponRow = { ...WELCOME5, minSpendPaise: 100000 };
    expect(validateCoupon(coupon, baseCtx)).toEqual({ ok: true });
  });

  it("overall usage limit: at the limit is rejected", () => {
    const coupon: CouponRow = { ...WELCOME5, usageLimit: 10, usedCount: 10 };
    expect(validateCoupon(coupon, baseCtx)).toEqual({ ok: false, reason: "usage_limit" });
  });

  it("overall usage limit: under the limit is accepted", () => {
    const coupon: CouponRow = { ...WELCOME5, usageLimit: 10, usedCount: 9 };
    expect(validateCoupon(coupon, baseCtx)).toEqual({ ok: true });
  });

  it("per-user limit: at the user's limit is rejected", () => {
    const coupon: CouponRow = { ...WELCOME5, firstOrderOnly: false, perUserLimit: 1 };
    expect(validateCoupon(coupon, { ...baseCtx, userRedemptions: 1 })).toEqual({ ok: false, reason: "per_user_limit" });
  });

  it("per-user limit: with no email yet, a per-user-limited coupon can't be confirmed valid", () => {
    const coupon: CouponRow = { ...WELCOME5, firstOrderOnly: false, perUserLimit: 1 };
    expect(validateCoupon(coupon, { ...baseCtx, hasEmail: false })).toEqual({ ok: false, reason: "per_user_limit" });
  });

  it("first-order-only: a returning email is rejected", () => {
    expect(validateCoupon(WELCOME5, { ...baseCtx, priorOrderExists: true })).toEqual({
      ok: false,
      reason: "first_order_only",
    });
  });

  it("first-order-only: a genuinely first-time email is accepted", () => {
    expect(validateCoupon(WELCOME5, { ...baseCtx, priorOrderExists: false })).toEqual({ ok: true });
  });

  it("applies_to: a cart containing a non-eligible product is rejected", () => {
    const coupon: CouponRow = { ...WELCOME5, appliesTo: { productIds: [999] } };
    expect(validateCoupon(coupon, baseCtx)).toEqual({ ok: false, reason: "not_applicable" });
  });

  it("applies_to: a cart entirely within the eligible collection is accepted", () => {
    const coupon: CouponRow = { ...WELCOME5, appliesTo: { collectionIds: [1] } };
    expect(validateCoupon(coupon, baseCtx)).toEqual({ ok: true });
  });

  it("applies_to: no restriction set at all is accepted", () => {
    const coupon: CouponRow = { ...WELCOME5, appliesTo: null };
    expect(validateCoupon(coupon, baseCtx)).toEqual({ ok: true });
  });
});
