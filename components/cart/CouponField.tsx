"use client";

import { useId, useState } from "react";
import { formatINR, paise } from "@/lib/money";
import { useCartStore } from "@/lib/store/cart";

/**
 * High-conversion coupon component:
 * Clean input with instant validation feedback, applied savings badge,
 * and seamless coupon removal.
 */
export function CouponField() {
  const couponCode = useCartStore((s) => s.couponCode);
  const pricing = useCartStore((s) => s.pricing);
  const isValidating = useCartStore((s) => s.isValidating);
  const applyCoupon = useCartStore((s) => s.applyCoupon);
  const removeCoupon = useCartStore((s) => s.removeCoupon);
  const [value, setValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const inputId = useId();

  const applied = couponCode != null && pricing?.couponCode === couponCode;
  const discountSaved = pricing?.discountPaise ?? paise(0);

  if (applied) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-ok/30 bg-ok/8 px-3.5 py-2.5 text-xs sm:text-sm">
        <div className="flex items-center gap-2">
          <span className="flex size-5 items-center justify-center rounded-full bg-ok text-white text-[10px] font-bold">
            ✓
          </span>
          <span className="font-semibold text-ok">
            <span className="uppercase tracking-wide">{couponCode}</span> applied
            {discountSaved > 0 && (
              <span className="ml-1 font-normal text-ink-2">
                (saved {formatINR(discountSaved)})
              </span>
            )}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            setValue("");
            removeCoupon();
          }}
          className="text-xs font-medium text-crit hover:underline focus:outline-none"
        >
          Remove
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-line/70 bg-surface p-2.5">
      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex w-full items-center justify-between text-xs font-semibold text-ink-2 hover:text-ink transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <svg viewBox="0 0 20 20" fill="currentColor" className="size-3.5 text-gold">
              <path
                fillRule="evenodd"
                d="M5.5 3A2.5 2.5 0 003 5.5v2.879a2.5 2.5 0 00.732 1.767l6.5 6.5a2.5 2.5 0 003.536 0l2.878-2.878a2.5 2.5 0 000-3.536l-6.5-6.5A2.5 2.5 0 008.38 3H5.5zM6 7a1 1 0 100-2 1 1 0 000 2z"
                clipRule="evenodd"
              />
            </svg>
            Have a coupon or promo code?
          </span>
          <span className="text-gold font-bold">Apply</span>
        </button>
      ) : (
        <form
          className="flex items-center gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (value.trim()) {
              await applyCoupon(value.trim().toUpperCase());
            }
          }}
        >
          <label htmlFor={inputId} className="sr-only">
            Coupon code
          </label>
          <div className="relative flex-1">
            <input
              id={inputId}
              name="coupon"
              placeholder="e.g. WELCOME5"
              autoComplete="off"
              autoCapitalize="characters"
              value={value}
              onChange={(e) => setValue(e.target.value.toUpperCase())}
              className="w-full rounded-md border border-line bg-surface-2/60 px-3 py-1.5 text-xs font-medium text-ink placeholder:text-ink-3 uppercase focus:border-brew-1 focus:bg-surface focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={!value.trim() || isValidating}
            className="h-8 rounded-md bg-brew-1 px-3.5 text-xs font-bold text-white transition-opacity disabled:opacity-40 hover:bg-brew-1/90"
          >
            {isValidating ? "..." : "APPLY"}
          </button>
        </form>
      )}
    </div>
  );
}
