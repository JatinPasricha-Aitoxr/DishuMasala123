"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/Dialog";
import { Placeholder } from "@/components/media/Placeholder";
import { Button } from "@/components/ui/Button";
import { formatINR } from "@/lib/money";
import { useCartStore, selectFreeGiftEligible, selectFreeGiftThresholdPaise, selectHasFreeGift } from "@/lib/store/cart";
import type { FreeGiftOption } from "@/lib/db/queries/free-gift";

/**
 * The "choose your free gift" popup (client rule, 2026-09-17) — appears once per cart session the
 * moment the (non-gift) subtotal clears `getFreeGiftThresholdPaise()` (`selectFreeGiftEligible`),
 * offering only the real, allowlisted gift variants (`getFreeGiftOptions()`) whose pillar ISN'T
 * already in the cart: buying Blue Tea offers Red Tea / Spices (Coriander, Turmeric or Red Chilli)
 * / Black Tea as gifts, never another Blue Tea — matching the same exclusion
 * `lib/commerce/pricing.ts` enforces server-side, so the menu here never offers something the
 * server would then reject. Picking one calls the ordinary `addItem` with `isGift: true`;
 * `revalidate()` immediately re-confirms it server-side, so the price shown here as "FREE" is
 * never trusted at face value (CLAUDE.md §7.5).
 *
 * "Once per session" is deliberately just component state, not `sessionStorage`: it resets on a
 * hard refresh, which is fine — the popup re-appears, sees the shopper already has a gift line
 * (`hasFreeGift`), and stays closed. It only nags again if the gift was actually removed.
 */
export function FreeGiftPopup({ options }: { options: FreeGiftOption[] }) {
  const eligible = useCartStore(selectFreeGiftEligible);
  const hasFreeGift = useCartStore(selectHasFreeGift);
  const thresholdPaise = useCartStore(selectFreeGiftThresholdPaise);
  const pricing = useCartStore((s) => s.pricing);
  const addItem = useCartStore((s) => s.addItem);
  const [open, setOpen] = useState(false);
  const [addingVariantId, setAddingVariantId] = useState<number | null>(null);
  const hasOfferedThisSession = useRef(false);

  useEffect(() => {
    // Guarded by the ref, not just the boolean props, so this effect only ever calls setState
    // once per cart session — `choose()` below is what closes the dialog again once a gift is
    // picked, so there's no separate "close it if hasFreeGift" branch needed here.
    if (eligible && !hasFreeGift && !hasOfferedThisSession.current) {
      hasOfferedThisSession.current = true;
      setOpen(true);
    }
  }, [eligible, hasFreeGift]);

  // Pillars already being bought (paid lines only) — a gift from one of these is hidden here even
  // though pricing.ts would reject it anyway, so the menu never shows a choice that can't work.
  // `pricing.lines`' `collectionSlug` values ("blue-tea"/"red-tea"/"classic-teas"/"spices") match
  // `FreeGiftOption.pillar` 1:1 by construction — no separate mapping needed; "combos" (or
  // anything else) simply never matches any pillar, same as pricing.ts's own `cartPillarOf`.
  const cartPillars = new Set((pricing?.lines ?? []).filter((l) => !l.isGift).map((l) => l.collectionSlug));
  const eligibleOptions = options.filter((o) => !cartPillars.has(o.pillar));

  if (eligibleOptions.length === 0 || thresholdPaise == null) return null;

  async function choose(option: FreeGiftOption) {
    setAddingVariantId(option.variantId);
    await addItem({
      variantId: option.variantId,
      productId: option.productId,
      priority: option.priority,
      qty: 1,
      productName: option.productName,
      optionValue: option.optionValue,
      sku: option.sku,
      mrpPaise: option.mrpPaise,
      unitPricePaise: 0,
      imageUrl: option.image?.url ?? null,
      isGift: true,
    });
    setAddingVariantId(null);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm">
        <DialogTitle className="font-display text-lg font-semibold text-ink">🎁 You&apos;ve unlocked a free gift!</DialogTitle>
        <DialogDescription className="mt-1 text-sm text-ink-2">
          Your order qualifies for a free gift — pick one to add it at no charge.
        </DialogDescription>

        <ul className="mt-5 flex flex-col gap-3">
          {eligibleOptions.map((option) => (
            <li key={option.variantId} className="flex items-center gap-3 rounded-md border border-line p-3">
              <div className="relative size-14 shrink-0 overflow-hidden rounded-md border border-line/60 bg-surface-2">
                {option.image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- small fixed-size thumbnail, not worth next/image's overhead here.
                  <img src={option.image.url} alt={option.image.alt} className="size-full object-contain mix-blend-multiply" />
                ) : (
                  <Placeholder slot="product-packshot-generic" className="size-full" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">
                  {option.productName} <span className="font-normal text-ink-2">({option.optionValue})</span>
                </p>
                <p className="text-xs text-ink-2">
                  <span className="line-through">{formatINR(option.mrpPaise)}</span>{" "}
                  <span className="font-semibold text-leaf">FREE</span>
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!option.inStock || addingVariantId != null}
                onClick={() => void choose(option)}
              >
                {addingVariantId === option.variantId ? "Adding…" : "Choose"}
              </Button>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => setOpen(false)}
          className="mt-4 w-full text-center text-sm font-medium text-ink-2 underline underline-offset-4 hover:text-ink"
        >
          No thanks, maybe later
        </button>
      </DialogContent>
    </Dialog>
  );
}
