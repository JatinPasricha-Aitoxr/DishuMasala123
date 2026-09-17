"use client";

import { useEffect } from "react";
import { trackPurchase } from "@/lib/meta-pixel";

export interface PurchaseTrackerProps {
  orderNumber: string;
  skus: string[];
  totalPaise: number;
  numItems: number;
}

/**
 * Fires exactly once per real order, even across reloads of the confirmation page (the guest
 * order-lookup link is meant to be revisited — CLAUDE.md's own order-confirmation flow supports
 * that on purpose). sessionStorage, not a server-side flag: there's no Conversion API/server-side
 * dedup layer in this project, so this is the honest, best-effort guard available without one —
 * good enough to stop the obvious over-count (a shopper refreshing their own confirmation page),
 * not a hard guarantee against every possible double-fire.
 */
export function PurchaseTracker({ orderNumber, skus, totalPaise, numItems }: PurchaseTrackerProps) {
  useEffect(() => {
    const key = `dm_meta_pixel_purchase_${orderNumber}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // Storage blocked — fire anyway rather than silently never tracking a real sale.
    }
    trackPurchase({
      content_ids: skus,
      content_type: "product",
      value: totalPaise / 100,
      currency: "INR",
      num_items: numItems,
    });
  }, [orderNumber, skus, totalPaise, numItems]);

  return null;
}
