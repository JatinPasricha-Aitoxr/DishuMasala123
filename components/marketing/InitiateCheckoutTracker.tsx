"use client";

import { useEffect, useRef } from "react";
import { useCartStore, selectSubtotalPaise } from "@/lib/store/cart";
import { trackInitiateCheckout } from "@/lib/meta-pixel";

/** Fires once per checkout page load, off whatever's actually in the cart at that moment — a
 * `useRef` guard rather than an empty dependency array, since the cart itself hydrates from
 * localStorage asynchronously and could still be empty on the very first render. */
export function InitiateCheckoutTracker() {
  const lines = useCartStore((s) => s.lines);
  const subtotalPaise = useCartStore(selectSubtotalPaise);
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current || lines.length === 0) return;
    fired.current = true;
    trackInitiateCheckout({
      content_ids: lines.map((l) => l.sku),
      value: subtotalPaise / 100,
      currency: "INR",
      num_items: lines.reduce((n, l) => n + l.qty, 0),
    });
  }, [lines, subtotalPaise]);

  return null;
}
