"use client";

import { useId, useMemo, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { Placeholder } from "@/components/media/Placeholder";
import { cn } from "@/lib/cn";
import { formatINR, paise, type Paise } from "@/lib/money";
import { computePackTiers, DEFAULT_PACK_DISCOUNT_TIERS, type DiscountTier, type PackTierPricing } from "@/lib/commerce/pack-tiers";

export interface PackSelectorImage {
  url: string;
  alt: string;
}

export interface PackSelectorAddToCartPayload {
  tier: PackTierPricing;
  /** How many of the selected tier bundle to buy (the stepper beneath the cards) — e.g. qty 2 of
   * the "Transformation" (3-pack) tier means 6 physical packs. */
  qty: number;
  /** `tier.totalPaise * qty` — what this add-to-cart click is actually worth. */
  totalPaise: Paise;
  /** `tier.savingsPaise * qty` — the total saved vs. buying `tier.packs * qty` single packs. */
  savingsPaise: Paise;
}

export interface PackSelectorProps {
  productName: string;
  /** A single representative product photo, reused across every tier card (this pattern sells
   * different QUANTITIES of one pack, not different products, so one photo is correct — not a
   * missing per-tier image). `null` renders the same generic placeholder every other product-image
   * gap in this project uses. */
  image: PackSelectorImage | null;
  /** The real single-pack price, in paise, from the product's own base variant — never a literal
   * number invented here (CLAUDE.md §7.3/§8). Every tier's price is derived from this one number. */
  basePricePaise: Paise;
  /** Defaults to Starter/Value/Transformation (0/10/20% flat). A product needing different tiers
   * passes its own array — never hardcode a second tier table in a copy of this component. */
  discountTiers?: DiscountTier[];
  /** Fired only on an explicit "Add to cart" click, with the full computed payload. This component
   * has no cart of its own to push into — see the file-level note on why. */
  onAddToCart?: (payload: PackSelectorAddToCartPayload) => void;
  /** Controlled tier index — pass this (with `onSelectedIndexChange`) only when a sibling, like
   * PackSelectorStickyBar, needs to mirror the live selection; omit both for normal standalone use
   * and the component manages its own state. Same hybrid for `qty`/`onQtyChange`. */
  selectedIndex?: number;
  onSelectedIndexChange?: (index: number) => void;
  qty?: number;
  onQtyChange?: (qty: number) => void;
  /** Set this when pairing with PackSelectorStickyBar — pass the same string as that component's
   * `anchorId` so its IntersectionObserver has a real element to watch. */
  id?: string;
  className?: string;
}

/**
 * Shared selection state for a PackSelector + PackSelectorStickyBar pair (same "lift state to a
 * parent" shape as this PDP's own PdpInteractive → BuyBox + StickyAddToCart). A page that only
 * renders PackSelector alone doesn't need this — its own internal state is enough.
 */
export function usePackTierSelection(basePricePaise: Paise, discountTiers: DiscountTier[] = DEFAULT_PACK_DISCOUNT_TIERS) {
  const tiers = useMemo(() => computePackTiers(basePricePaise, discountTiers), [basePricePaise, discountTiers]);
  const defaultIndex = Math.max(
    tiers.findIndex((t) => t.recommended),
    0,
  );
  const [selectedIndex, setSelectedIndex] = useState(defaultIndex);
  const [qty, setQty] = useState(1);

  const selected = tiers[selectedIndex] ?? tiers[0];
  const totalPaise = paise(selected.totalPaise * qty);
  const savingsPaise = paise(selected.savingsPaise * qty);

  return { tiers, selectedIndex, setSelectedIndex, qty, setQty, selected, totalPaise, savingsPaise };
}

function Ribbon({ label }: { label: string }) {
  return (
    <div className="pointer-events-none absolute right-0 top-0 h-24 w-24 overflow-hidden" aria-hidden="true">
      <div className="absolute right-[-34px] top-[18px] w-[140px] rotate-45 bg-brew-2 py-1 text-center text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
        {label}
      </div>
    </div>
  );
}

function CheckBadge() {
  return (
    <span className="absolute left-3 top-3 flex size-6 items-center justify-center rounded-full bg-brew-2 text-white shadow-sm">
      <svg viewBox="0 0 16 16" fill="none" className="size-3.5" aria-hidden="true">
        <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

/**
 * The tiered "buy more, save more" pack selector (reference: bluetea.co.in's PDP pack cards) —
 * Starter/Value/Transformation tiers of the SAME product, a flat per-tier discount (never
 * compounding — see lib/commerce/pack-tiers.ts). All three tiers share one product photo and one
 * base price; nothing here invents a price, a discount, or a second product.
 *
 * **Why this doesn't call `useCartStore` itself**: CLAUDE.md §7.5 — "never trust a price... from
 * the client" — is the single most important rule in this codebase, and lib/store/cart.ts's
 * `addItem` takes a real `variantId` it can re-validate server-side. There is no `variantId` for
 * "2× this pack at 10% off" today; the catalogue's `variants` table models different SIZES of a
 * product, not different QUANTITIES of the same size at a volume discount. Wiring this straight
 * into the cart would let a client-computed discount reach checkout unverified — the exact failure
 * §7.5 exists to prevent. So this component computes and displays the tier math (real, correct,
 * derived from one real base price) and hands the finished selection to `onAddToCart`, whose job
 * is the caller's: either resolve `tier.packs` to a real per-tier `variantId` your catalogue
 * defines, or apply a server-side quantity-discount rule in lib/commerce/pricing.ts before this
 * ever reaches `/api/cart/validate`. See this file's closing comment block for both options.
 *
 * A product with only one real size (`discountTiers.length <= 1`, or the caller omits the prop
 * entirely for a single-pack product) skips the tier row and renders a plain price block — the
 * "buy more" framing doesn't apply when there's nothing to bundle.
 */
export function PackSelector({
  productName,
  image,
  basePricePaise,
  discountTiers = DEFAULT_PACK_DISCOUNT_TIERS,
  onAddToCart,
  selectedIndex: controlledIndex,
  onSelectedIndexChange,
  qty: controlledQty,
  onQtyChange,
  id,
  className,
}: PackSelectorProps) {
  const tiers = useMemo(() => computePackTiers(basePricePaise, discountTiers), [basePricePaise, discountTiers]);
  const defaultIndex = Math.max(
    tiers.findIndex((t) => t.recommended),
    0,
  );
  const [internalIndex, setInternalIndex] = useState(defaultIndex);
  const [internalQty, setInternalQty] = useState(1);
  const groupName = useId();

  const selectedIndex = controlledIndex ?? internalIndex;
  const setSelectedIndex = onSelectedIndexChange ?? setInternalIndex;
  const qty = controlledQty ?? internalQty;
  const setQty = onQtyChange ?? setInternalQty;

  const selected = tiers[selectedIndex] ?? tiers[0];
  const totalPaise = paise(selected.totalPaise * qty);
  const savingsPaise = paise(selected.savingsPaise * qty);

  const singleTier = tiers.length <= 1;

  return (
    <div id={id} className={cn("flex flex-col gap-5", className)}>
      {singleTier ? (
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold tabular-nums text-ink">{formatINR(tiers[0]?.unitPricePaise ?? basePricePaise)}</span>
        </div>
      ) : (
        <div
          role="radiogroup"
          aria-label={`Choose your ${productName} pack`}
          className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0"
        >
          {tiers.map((tier, i) => {
            const checked = i === selectedIndex;
            return (
              <label
                key={tier.name}
                className={cn(
                  "relative flex w-[78%] shrink-0 snap-start flex-col gap-3 overflow-hidden rounded-lg border bg-surface p-4 pt-5 transition-shadow duration-150 sm:w-auto",
                  "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brew-2 has-[:focus-visible]:ring-offset-2",
                  checked ? "border-brew-2 ring-2 ring-brew-2 shadow-lift" : "border-line hover:border-ink-3",
                )}
              >
                <input
                  type="radio"
                  name={groupName}
                  value={tier.name}
                  checked={checked}
                  onChange={() => setSelectedIndex(i)}
                  className="sr-only"
                  aria-label={`${tier.name}, ${tier.packs} pack${tier.packs === 1 ? "" : "s"}, ${formatINR(tier.unitPricePaise)} per pack`}
                />

                <Ribbon label={`${formatINR(tier.unitPricePaise)}/pack`} />
                {checked && <CheckBadge />}

                <div className="flex items-center gap-3">
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-md border border-line/60 bg-surface-2">
                    {image ? (
                      <Image src={image.url} alt={image.alt} fill sizes="56px" className="object-contain mix-blend-multiply" />
                    ) : (
                      <Placeholder slot="product-packshot-generic" className="size-full" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">{tier.name}</p>
                    <span className="mt-0.5 inline-block rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-ink-2">
                      {tier.packs} {tier.packs === 1 ? "Pack" : "Packs"}
                    </span>
                  </div>
                </div>

                {tier.recommended && (
                  <span className="w-fit rounded-full bg-leaf px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    Best Value
                  </span>
                )}

                <div className="mt-auto flex flex-col gap-0.5">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-base font-bold tabular-nums text-ink">{formatINR(tier.unitPricePaise)}</span>
                    {tier.discountPct > 0 && (
                      <span className="text-xs tabular-nums text-ink-3 line-through">{formatINR(basePricePaise)}</span>
                    )}
                    <span className="text-xs text-ink-2">/pack</span>
                  </div>
                  <p className="text-xs text-ink-2">
                    Total <span className="font-semibold tabular-nums text-ink">{formatINR(tier.totalPaise)}</span>
                  </p>
                  {tier.savingsPaise > 0 && (
                    <p className="text-xs font-semibold text-leaf">Save {formatINR(tier.savingsPaise)}</p>
                  )}
                </div>
              </label>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-3 sm:gap-4">
        <QuantityStepper value={qty} onChange={setQty} aria-label={`Quantity of ${selected.name} bundles`} />
        <Button
          type="button"
          variant="gradient"
          size="lg"
          className="min-w-0 flex-1"
          onClick={() => onAddToCart?.({ tier: selected, qty, totalPaise, savingsPaise })}
        >
          Add to cart — {formatINR(totalPaise)}
        </Button>
      </div>
    </div>
  );
}

/**
 * WIRING NOTE — how to make this drive a real "Add to cart" (CLAUDE.md §7.5's server-price-
 * authority rule, explained in this file's own top comment):
 *
 * Option A — a real variant per tier. Add three `variants` rows per product (option_value
 * "Starter (1 pack)" / "Value (2 packs)" / "Transformation (3 packs)"), each with its own real
 * `mrp_paise`/`price_paise` set to what `computePackTiers` would produce — computed once at
 * catalogue-authoring time, not at request time. `onAddToCart` then just needs the tier→variantId
 * map to call the existing `useCartStore().addItem` with a real `variantId`; `/api/cart/validate`
 * re-reads that variant from Postgres exactly like every other line item, no new server code.
 *
 * Option B — a server-side quantity-discount rule. Extend lib/commerce/pricing.ts's recompute step
 * to recognise "N of the same variantId in one cart line → apply the matching tier's discountPct"
 * server-side, keyed off the same DEFAULT_PACK_DISCOUNT_TIERS table (imported there, not
 * re-typed). `onAddToCart` then adds `tier.packs * qty` units of the product's one real variant;
 * the server, not this component, is what actually applies the 10%/20% discount when it
 * recomputes the cart.
 *
 * Either way, `onAddToCart`'s `payload.totalPaise` here is a preview for the UI, never the number
 * that reaches Razorpay — the same "cached client number vs. server-confirmed total" split every
 * other price surface in this app already respects.
 */
