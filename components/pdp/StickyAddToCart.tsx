"use client";

import { useEffect, useState } from "react";
import { PriceBlock } from "@/components/ui/PriceBlock";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { Paise } from "@/lib/money";

export interface StickyAddToCartProps {
  /** The id of BuyBox's own root element — observed via IntersectionObserver, never a scroll-Y
   * pixel threshold, so this works regardless of how much content sits above it. */
  buyBoxId: string;
  productName: string;
  mrpPaise: Paise;
  pricePaise: Paise;
  disabled: boolean;
  onAddToCart: () => void;
}

/**
 * A persistent sticky add-to-cart bar. On MOBILE (client request, 2026-09-17: "fixed at all
 * times") it's always visible from page load — never gated on scroll position, since a mobile
 * shopper shouldn't have to hunt for the buy box to add to cart. On desktop (reference:
 * blueteaindia.co.in) it keeps its original behaviour: hidden until the real BuyBox has scrolled
 * out of the viewport, since desktop already shows a full BuyBox in the layout at all times above
 * the fold in the common case. Respects the notch/home-indicator safe area on iOS via
 * `env(safe-area-inset-bottom)`.
 */
export function StickyAddToCart({ buyBoxId, productName, mrpPaise, pricePaise, disabled, onAddToCart }: StickyAddToCartProps) {
  const [scrolledPastBuyBox, setScrolledPastBuyBox] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  useEffect(() => {
    const target = document.getElementById(buyBoxId);
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => setScrolledPastBuyBox(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { threshold: 0 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [buyBoxId]);

  useEffect(() => {
    // Reading the viewport width (an external system — `window`) can only happen after mount, the
    // server has no viewport — so this must run post-hydration to stay SSR-safe, meaning the bar
    // paints first assuming desktop, then updates once on mobile. Same "subscribe to an external
    // system, setState when it changes" case react-hooks/set-state-in-effect's own guidance calls
    // out as correct (see HeaderClient.tsx's identical announcement-bar pattern) — a single one-
    // shot read plus a change listener, no cascading-render risk.
    const mql = window.matchMedia("(max-width: 639px)");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMobileViewport(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setIsMobileViewport(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const visible = isMobileViewport || scrolledPastBuyBox;

  return (
    <div
      role="region"
      aria-label={`Quick add to cart for ${productName}`}
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface px-4 py-3 shadow-lift sm:px-6",
        "transition-transform duration-[200ms] ease-[cubic-bezier(.2,.6,.2,1)]",
        visible ? "translate-y-0" : "translate-y-full pointer-events-none",
      )}
      style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      aria-hidden={!visible}
    >
      <div className="mx-auto flex max-w-7xl items-center gap-3 sm:gap-6">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink sm:text-base">{productName}</p>
          <PriceBlock mrpPaise={mrpPaise} pricePaise={pricePaise} showTaxNote={false} />
        </div>
        <Button
          variant="gradient"
          size="lg"
          onClick={onAddToCart}
          disabled={disabled}
          tabIndex={visible ? 0 : -1}
          className="shrink-0 sm:min-w-40"
        >
          Add to cart
        </Button>
      </div>
    </div>
  );
}
