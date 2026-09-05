"use client";

/**
 * The cart store (CLAUDE.md §2/§7.4, PROMPTS.md Phase 5 item 1) — Zustand, persisted to
 * localStorage, keyed by VARIANT id (never product id: two variants of the same product are
 * distinct line items). This is the first phase with a real, persistent cart — Phase 4's BuyBox
 * only ever held a local add-to-cart payload in component state.
 *
 * Money is never computed here from first principles. `pricing` is always the last response from
 * `POST /api/cart/validate` (lib/commerce/pricing.ts, server-only, source of truth). The cached
 * per-line `unitPricePaise`/`mrpPaise` fields exist only so the cart can render something before
 * the first revalidation round trip resolves — every derived total prefers `pricing` when present.
 * Every mutation (add/update/remove/coupon change) calls `revalidate()`, which may come back with
 * corrected quantities/prices/coupon status; those corrections are applied to `lines` and surfaced
 * as plain-language `notices`, never silently swallowed.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PricingResult } from "@/lib/commerce/pricing";

export interface CartLine {
  variantId: number;
  productId: number;
  /** The product's own priority (CLAUDE.md §7.2) — display-only, used to sort/filter the cart's
   * upsell rail; kept in sync from every server revalidation, never computed client-side. */
  priority: number;
  qty: number;
  productName: string;
  optionValue: string;
  sku: string;
  mrpPaise: number;
  unitPricePaise: number;
  /** A resolved, absolute image URL (never a raw storageKey — a client component has no way to turn
   * one into a URL itself, CLAUDE.md §3.3's server-only boundary). Display-only: never sent back
   * to /api/cart/validate and never part of the order snapshot (lib/db/mutations/orders.ts writes
   * order_items.image_storage_key from the server's own re-derived pricing, not from this field). */
  imageUrl: string | null;
}

export interface CartNotice {
  id: string;
  message: string;
}

interface AddItemInput {
  variantId: number;
  productId: number;
  priority: number;
  qty: number;
  productName: string;
  optionValue: string;
  sku: string;
  mrpPaise: number;
  unitPricePaise: number;
  /** A resolved, absolute image URL (never a raw storageKey — a client component has no way to turn
   * one into a URL itself, CLAUDE.md §3.3's server-only boundary). Display-only: never sent back
   * to /api/cart/validate and never part of the order snapshot (lib/db/mutations/orders.ts writes
   * order_items.image_storage_key from the server's own re-derived pricing, not from this field). */
  imageUrl: string | null;
}

export interface CartState {
  lines: CartLine[];
  couponCode: string | null;
  pricing: PricingResult | null;
  notices: CartNotice[];
  isOpen: boolean;
  isValidating: boolean;
  email: string | null;

  open: () => void;
  close: () => void;
  addItem: (input: AddItemInput) => Promise<void>;
  updateQty: (variantId: number, qty: number) => Promise<void>;
  removeItem: (variantId: number) => Promise<void>;
  applyCoupon: (code: string) => Promise<void>;
  removeCoupon: () => void;
  setEmail: (email: string | null) => void;
  revalidate: () => Promise<void>;
  dismissNotice: (id: string) => void;
  clearAfterOrder: () => void;
}

/** Wraps `localStorage` so a private/incognito context or a storage-quota failure degrades to an
 * in-memory-only cart instead of crashing the app (PROMPTS.md Phase 5 item 1). */
const safeStorage = {
  getItem(name: string): string | null {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem(name: string, value: string): void {
    try {
      localStorage.setItem(name, value);
    } catch {
      // Storage unavailable — the cart still works for this session, it just won't persist.
    }
  },
  removeItem(name: string): void {
    try {
      localStorage.removeItem(name);
    } catch {
      // Ignore.
    }
  },
};

let noticeSeq = 0;
function nextNoticeId(): string {
  noticeSeq += 1;
  return `notice-${noticeSeq}-${Date.now()}`;
}

async function fetchValidation(
  lines: CartLine[],
  couponCode: string | null,
  email: string | null,
): Promise<{ ok: boolean; pricing: PricingResult | null }> {
  try {
    const res = await fetch("/api/cart/validate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        lines: lines.map((l) => ({ variantId: l.variantId, qty: l.qty })),
        couponCode,
        email,
      }),
    });
    if (!res.ok) return { ok: false, pricing: null };
    const body = (await res.json()) as { ok: boolean; pricing?: PricingResult };
    return { ok: body.ok, pricing: body.pricing ?? null };
  } catch {
    return { ok: false, pricing: null };
  }
}

/** Turns a PricingResult's `issues` into plain-language notices, and returns the corrected line
 * list — dropping/clamping exactly what the server said needed correcting. Never silent. */
export function applyPricingCorrections(
  lines: CartLine[],
  pricing: PricingResult,
): { lines: CartLine[]; notices: CartNotice[]; couponRejected: boolean } {
  const notices: CartNotice[] = [];
  let couponRejected = false;
  let next = lines;

  for (const issue of pricing.issues) {
    if (issue.type === "variant_not_found") {
      next = next.filter((l) => l.variantId !== issue.variantId);
      notices.push({ id: nextNoticeId(), message: "One item in your cart is no longer available and was removed." });
    } else if (issue.type === "out_of_stock") {
      next = next.filter((l) => l.variantId !== issue.variantId);
      notices.push({ id: nextNoticeId(), message: `${issue.productName} is out of stock and was removed from your cart.` });
    } else if (issue.type === "insufficient_stock") {
      next = next.map((l) => (l.variantId === issue.variantId ? { ...l, qty: issue.availableQty } : l));
      notices.push({
        id: nextNoticeId(),
        message: `Only ${issue.availableQty} of ${issue.productName} left — your quantity was updated.`,
      });
    } else if (issue.type === "coupon_invalid") {
      couponRejected = true;
      notices.push({ id: nextNoticeId(), message: couponInvalidMessage(issue.code, issue.reason) });
    }
  }

  // Also sync the cached display price/mrp for every surviving line to what the server just
  // confirmed — a price change (not just stock) is exactly the kind of correction that must never
  // be silently overwritten without telling the shopper.
  for (const priced of pricing.lines) {
    const existing = next.find((l) => l.variantId === priced.variantId);
    if (existing && existing.unitPricePaise !== priced.unitPricePaise) {
      notices.push({
        id: nextNoticeId(),
        message: `The price of ${priced.productName} changed to ${(priced.unitPricePaise / 100).toFixed(0)} rupees.`,
      });
    }
  }
  next = next.map((l) => {
    const priced = pricing.lines.find((p) => p.variantId === l.variantId);
    return priced
      ? { ...l, unitPricePaise: priced.unitPricePaise, mrpPaise: priced.mrpPaise, productId: priced.productId, priority: priced.priority }
      : l;
  });

  return { lines: next, notices, couponRejected };
}

function couponInvalidMessage(code: string, reason: string): string {
  switch (reason) {
    case "not_found":
      return `Coupon ${code} isn't valid.`;
    case "inactive":
      return `Coupon ${code} is no longer active.`;
    case "not_started":
      return `Coupon ${code} isn't active yet.`;
    case "expired":
      return `Coupon ${code} has expired.`;
    case "min_spend":
      return `Coupon ${code} needs a higher order value.`;
    case "usage_limit":
      return `Coupon ${code} has reached its usage limit.`;
    case "per_user_limit":
      return `Coupon ${code} has already been used on this email.`;
    case "first_order_only":
      return `Coupon ${code} is only valid on your first order.`;
    case "not_applicable":
      return `Coupon ${code} doesn't apply to the items in your cart.`;
    default:
      return `Coupon ${code} couldn't be applied.`;
  }
}

type PersistedCartState = Pick<CartState, "lines" | "couponCode">;

export const useCartStore = create<CartState>()(
  persist<CartState, [], [], PersistedCartState>(
    (set, get) => ({
      lines: [],
      couponCode: null,
      pricing: null,
      notices: [],
      isOpen: false,
      isValidating: false,
      email: null,

      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),

      addItem: async (input) => {
        const existing = get().lines.find((l) => l.variantId === input.variantId);
        const lines = existing
          ? get().lines.map((l) => (l.variantId === input.variantId ? { ...l, qty: l.qty + input.qty } : l))
          : [...get().lines, { ...input }];
        set({ lines, isOpen: true });
        await get().revalidate();
      },

      updateQty: async (variantId, qty) => {
        const lines =
          qty <= 0
            ? get().lines.filter((l) => l.variantId !== variantId)
            : get().lines.map((l) => (l.variantId === variantId ? { ...l, qty } : l));
        set({ lines });
        await get().revalidate();
      },

      removeItem: async (variantId) => {
        set({ lines: get().lines.filter((l) => l.variantId !== variantId) });
        await get().revalidate();
      },

      applyCoupon: async (code) => {
        set({ couponCode: code.trim().toUpperCase() });
        await get().revalidate();
      },

      removeCoupon: () => {
        set({ couponCode: null, pricing: null });
        void get().revalidate();
      },

      setEmail: (email) => {
        set({ email });
      },

      revalidate: async () => {
        const { lines, couponCode, email } = get();
        if (lines.length === 0) {
          set({ pricing: null, isValidating: false });
          return;
        }
        set({ isValidating: true });
        const { ok, pricing } = await fetchValidation(lines, couponCode, email);
        if (!ok || !pricing) {
          set({ isValidating: false });
          return;
        }
        const { lines: correctedLines, notices, couponRejected } = applyPricingCorrections(lines, pricing);
        set((state) => ({
          lines: correctedLines,
          pricing,
          couponCode: couponRejected ? null : state.couponCode,
          notices: [...state.notices, ...notices],
          isValidating: false,
        }));
      },

      dismissNotice: (id) => set((state) => ({ notices: state.notices.filter((n) => n.id !== id) })),

      clearAfterOrder: () => set({ lines: [], couponCode: null, pricing: null, notices: [] }),
    }),
    {
      name: "dm-cart",
      storage: {
        getItem: (name) => {
          const raw = safeStorage.getItem(name);
          return raw ? JSON.parse(raw) : null;
        },
        setItem: (name, value) => safeStorage.setItem(name, JSON.stringify(value)),
        removeItem: (name) => safeStorage.removeItem(name),
      },
      partialize: (state) => ({ lines: state.lines, couponCode: state.couponCode }),
      // `pricing` is deliberately excluded from `partialize` above — it's never trusted stale
      // (CLAUDE.md §7.5). But nothing else ever re-fetched it on a fresh page load: every mutation
      // (addItem/updateQty/...) calls revalidate() itself, so the bug only shows up when a cart
      // that already has items is loaded from scratch — a hard refresh of /cart, a direct link to
      // /checkout, or just opening the site in a new tab. `pricing` then stays null forever and
      // every consumer (OrderSummary, the free-shipping bar, checkout's total) is stuck with
      // nothing to render. Revalidate once, right after localStorage's lines rehydrate, rather than
      // duplicating this same on-mount check in every component that reads `pricing`.
      onRehydrateStorage: () => (state) => {
        if (state && state.lines.length > 0) {
          void state.revalidate();
        }
      },
    },
  ),
);

export type CartSnapshot = Pick<CartState, "lines" | "pricing">;

// ---- Derived selectors (CLAUDE.md §7.5: server is always the price authority) -----------------
// Every total prefers the last server response (`pricing`); the local fallback (computed from the
// cached per-line price snapshot) exists only for the instant before the first revalidation
// resolves, and is never what's actually charged.

export function selectItemCount(state: CartSnapshot): number {
  return state.lines.reduce((n, l) => n + l.qty, 0);
}

export function selectSubtotalPaise(state: CartSnapshot): number {
  return state.pricing?.subtotalPaise ?? state.lines.reduce((sum, l) => sum + l.unitPricePaise * l.qty, 0);
}

export function selectSavingsPaise(state: CartSnapshot): number {
  return state.pricing?.savingsPaise ?? state.lines.reduce((sum, l) => sum + (l.mrpPaise - l.unitPricePaise) * l.qty, 0);
}

export function selectFreeShippingThresholdPaise(state: CartSnapshot): number | null {
  return state.pricing?.freeShippingThresholdPaise ?? null;
}

export function selectRupeesToFreeShippingPaise(state: CartSnapshot): number | null {
  return state.pricing?.rupeesToFreeShippingPaise ?? null;
}

export function selectTotalPaise(state: CartSnapshot): number | null {
  return state.pricing?.totalPaise ?? null;
}
