"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { formatINR } from "@/lib/money";
import type { PackTierPricing } from "@/lib/commerce/pack-tiers";
import type { Paise } from "@/lib/money";

export interface PackSelectorStickyBarProps {
  /** The id of PackSelector's own root element — same IntersectionObserver-driven appearance as
   * components/pdp/StickyAddToCart.tsx, never a scroll-Y pixel threshold. */
  anchorId: string;
  productName: string;
  selected: PackTierPricing;
  totalPaise: Paise;
  disabled?: boolean;
  onAddToCart: () => void;
}

/**
 * The Blue-Tea-style sticky mobile add-to-cart bar for PackSelector — mirrors
 * components/pdp/StickyAddToCart.tsx's own IntersectionObserver pattern exactly (appears once the
 * real selector has scrolled out of view, respects the iOS safe-area inset), just fed from
 * PackSelector's tier/qty state (via usePackTierSelection in the parent) instead of a BuyBox
 * variant. Always shows the CURRENT selection — switching tiers while scrolled past the cards
 * updates this bar's price immediately, since it re-renders from the same lifted state.
 */
export function PackSelectorStickyBar({ anchorId, productName, selected, totalPaise, disabled, onAddToCart }: PackSelectorStickyBarProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const target = document.getElementById(anchorId);
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { threshold: 0 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [anchorId]);

  return (
    <div
      role="region"
      aria-label={`Quick add to cart for ${productName}`}
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface px-4 py-3 shadow-lift sm:hidden",
        "transition-transform duration-[200ms] ease-[cubic-bezier(.2,.6,.2,1)]",
        visible ? "translate-y-0" : "translate-y-full pointer-events-none",
      )}
      style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      aria-hidden={!visible}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">
            {productName} · {selected.name}
          </p>
          <p className="text-xs text-ink-2">
            {selected.packs} {selected.packs === 1 ? "pack" : "packs"} · {formatINR(selected.unitPricePaise)}/pack
          </p>
        </div>
        <Button variant="gradient" onClick={onAddToCart} disabled={disabled} tabIndex={visible ? 0 : -1}>
          Add — {formatINR(totalPaise)}
        </Button>
      </div>
    </div>
  );
}
