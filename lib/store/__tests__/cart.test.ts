import { describe, expect, it } from "vitest";
import {
  applyPricingCorrections,
  selectFreeShippingThresholdPaise,
  selectItemCount,
  selectRupeesToFreeShippingPaise,
  selectSavingsPaise,
  selectSubtotalPaise,
  selectTotalPaise,
  type CartLine,
  type CartSnapshot,
} from "../cart";
import { paise } from "@/lib/money";
import type { PricingIssue, PricingLine, PricingResult } from "@/lib/commerce/pricing";

function line(overrides: Partial<CartLine> = {}): CartLine {
  return {
    variantId: 1,
    productId: 1,
    priority: 1,
    qty: 1,
    productName: "Blue Tea",
    optionValue: "500g",
    sku: "BT-500",
    mrpPaise: 60000,
    unitPricePaise: 50000,
    imageUrl: null,
    ...overrides,
  };
}

function pricingLine(overrides: Partial<PricingLine> = {}): PricingLine {
  return {
    variantId: 1,
    productId: 1,
    collectionId: 1,
    collectionSlug: "blue-tea",
    priority: 1,
    productName: "Blue Tea",
    sku: "BT-500",
    optionValue: "500g",
    mrpPaise: paise(60000),
    unitPricePaise: paise(50000),
    qty: 1,
    requestedQty: 1,
    lineTotalPaise: paise(50000),
    imageStorageKey: null,
    isGift: false,
    ...overrides,
  };
}

function pricing(overrides: { lines?: PricingLine[]; issues?: PricingIssue[]; totals?: Partial<Record<"subtotal" | "discount" | "shipping" | "total" | "savings" | "freeShippingThreshold" | "rupeesToFreeShipping", number>> } = {}): PricingResult {
  const t = overrides.totals ?? {};
  return {
    lines: overrides.lines ?? [],
    subtotalPaise: paise(t.subtotal ?? 50000),
    discountPaise: paise(t.discount ?? 0),
    crossPillarDiscountPaise: paise(0),
    crossPillarApplied: false,
    shippingPaise: paise(t.shipping ?? 0),
    totalPaise: paise(t.total ?? 50000),
    savingsPaise: paise(t.savings ?? 10000),
    couponCode: null,
    freeShippingThresholdPaise: paise(t.freeShippingThreshold ?? 50000),
    rupeesToFreeShippingPaise: paise(t.rupeesToFreeShipping ?? 0),
    freeGiftThresholdPaise: paise(69900),
    hasFreeGift: (overrides.lines ?? []).some((l) => l.isGift),
    issues: overrides.issues ?? [],
    clean: (overrides.issues ?? []).length === 0,
  };
}

describe("derived selectors — before the server has responded (local fallback)", () => {
  const state: CartSnapshot = {
    lines: [line({ qty: 2 }), line({ variantId: 2, qty: 1, unitPricePaise: 25000, mrpPaise: 30000 })],
    pricing: null,
  };

  it("counts items across lines", () => {
    expect(selectItemCount(state)).toBe(3);
  });

  it("computes a local subtotal from cached line prices", () => {
    expect(selectSubtotalPaise(state)).toBe(50000 * 2 + 25000);
  });

  it("computes local savings vs MRP", () => {
    expect(selectSavingsPaise(state)).toBe(10000 * 2 + 5000);
  });

  it("has no free-shipping numbers to report yet — nothing invented", () => {
    expect(selectFreeShippingThresholdPaise(state)).toBeNull();
    expect(selectRupeesToFreeShippingPaise(state)).toBeNull();
    expect(selectTotalPaise(state)).toBeNull();
  });
});

describe("derived selectors — once pricing has come back from the server, it wins", () => {
  const state: CartSnapshot = {
    lines: [line({ qty: 1 })],
    pricing: pricing({ totals: { subtotal: 999, savings: 111, freeShippingThreshold: 50000, rupeesToFreeShipping: 1234, total: 999 } }),
  };

  it("subtotal comes from the server, not local arithmetic", () => {
    expect(selectSubtotalPaise(state)).toBe(999);
  });

  it("savings comes from the server", () => {
    expect(selectSavingsPaise(state)).toBe(111);
  });

  it("free-shipping threshold and remainder come from the server (never a hardcoded ₹500)", () => {
    expect(selectFreeShippingThresholdPaise(state)).toBe(50000);
    expect(selectRupeesToFreeShippingPaise(state)).toBe(1234);
  });
});

describe("applyPricingCorrections — the server's corrections are applied and explained, never silent", () => {
  it("drops an out-of-stock line and produces a plain-language notice naming the product", () => {
    const lines = [line({ variantId: 1 }), line({ variantId: 2 })];
    const result = applyPricingCorrections(lines, pricing({ issues: [{ type: "out_of_stock", variantId: 2, productName: "Red Tea" }] }));
    expect(result.lines.map((l) => l.variantId)).toEqual([1]);
    expect(result.notices).toHaveLength(1);
    expect(result.notices[0].message).toContain("Red Tea");
    expect(result.notices[0].message.toLowerCase()).toContain("out of stock");
  });

  it("clamps quantity on insufficient stock and explains what happened", () => {
    const lines = [line({ variantId: 1, qty: 10 })];
    const result = applyPricingCorrections(
      lines,
      pricing({ issues: [{ type: "insufficient_stock", variantId: 1, productName: "Blue Tea", requestedQty: 10, availableQty: 3 }] }),
    );
    expect(result.lines[0].qty).toBe(3);
    expect(result.notices[0].message).toContain("3");
  });

  it("removes an unknown variant and explains it was removed", () => {
    const lines = [line({ variantId: 9 })];
    const result = applyPricingCorrections(lines, pricing({ issues: [{ type: "variant_not_found", variantId: 9 }] }));
    expect(result.lines).toHaveLength(0);
    expect(result.notices[0].message.toLowerCase()).toContain("no longer available");
  });

  it("flags a rejected coupon so the caller clears it, with a reason-specific message", () => {
    const lines = [line()];
    const result = applyPricingCorrections(lines, pricing({ issues: [{ type: "coupon_invalid", code: "WELCOME5", reason: "first_order_only" }] }));
    expect(result.couponRejected).toBe(true);
    expect(result.notices[0].message).toContain("WELCOME5");
    expect(result.notices[0].message.toLowerCase()).toContain("first order");
  });

  it("syncs a changed unit price onto the cached line and notes the change", () => {
    const lines = [line({ variantId: 1, unitPricePaise: 50000 })];
    const result = applyPricingCorrections(lines, pricing({ lines: [pricingLine({ unitPricePaise: paise(45000) })] }));
    expect(result.lines[0].unitPricePaise).toBe(45000);
    expect(result.notices.some((n) => n.message.includes("price"))).toBe(true);
  });

  it("clean pricing with no issues leaves lines untouched and produces no notices", () => {
    const lines = [line()];
    const result = applyPricingCorrections(lines, pricing({ lines: [] }));
    expect(result.lines).toEqual(lines);
    expect(result.notices).toHaveLength(0);
    expect(result.couponRejected).toBe(false);
  });
});
