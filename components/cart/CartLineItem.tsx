"use client";

import { Placeholder } from "@/components/media/Placeholder";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { formatINR, paise } from "@/lib/money";
import { useCartStore, type CartLine } from "@/lib/store/cart";

/**
 * Premium cart line item inspired by modern D2C carts:
 * High-res packshot thumbnail, crisp typography, unit price + MRP, discount pill,
 * compact quantity stepper, line total, and subtle remove action.
 */
export function CartLineItem({ line }: { line: CartLine }) {
  const updateQty = useCartStore((s) => s.updateQty);
  const removeItem = useCartStore((s) => s.removeItem);

  const hasDiscount = line.mrpPaise > line.unitPricePaise;
  const discountPct = hasDiscount ? Math.round(((line.mrpPaise - line.unitPricePaise) / line.mrpPaise) * 100) : 0;

  return (
    <li className="flex gap-3.5 border-b border-line/70 py-4.5 last:border-0 items-start">
      {/* Product Image */}
      <div className="relative size-20 sm:size-[88px] shrink-0 overflow-hidden rounded-lg border border-line/60 bg-surface-2 p-1">
        {line.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={line.imageUrl}
            alt={line.productName}
            className="size-full object-contain mix-blend-multiply transition-transform duration-300 hover:scale-105"
            loading="lazy"
          />
        ) : (
          <Placeholder slot="product-packshot-generic" className="size-full rounded-md" />
        )}
      </div>

      {/* Details & Controls */}
      <div className="flex flex-1 flex-col justify-between self-stretch min-w-0">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-ink leading-snug line-clamp-2">
              {line.productName}
            </h3>
            {/* Trash / Remove button */}
            <button
              type="button"
              onClick={() => void removeItem(line.variantId)}
              className="p-1 -mr-1 text-ink-3 hover:text-crit transition-colors rounded-sm"
              aria-label={`Remove ${line.productName} from cart`}
              title="Remove item"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="size-4" aria-hidden="true">
                <path
                  fillRule="evenodd"
                  d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>

          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-2">
            <span className="font-medium">{line.optionValue}</span>
            {line.isGift ? (
              <span className="rounded bg-leaf/10 px-1.5 py-0.5 text-[10px] font-semibold text-leaf">🎁 FREE GIFT</span>
            ) : (
              hasDiscount &&
              discountPct > 0 && (
                <span className="rounded bg-ok/10 px-1.5 py-0.5 text-[10px] font-semibold text-ok">
                  {discountPct}% OFF
                </span>
              )
            )}
          </div>

          <div className="mt-1 flex items-baseline gap-1.5">
            {line.isGift ? (
              <span className="text-sm font-bold text-leaf">FREE</span>
            ) : (
              <span className="text-sm font-bold text-ink tabular-nums">{formatINR(paise(line.unitPricePaise))}</span>
            )}
            {line.mrpPaise > line.unitPricePaise && (
              <span className="text-xs text-ink-3 line-through tabular-nums">
                {formatINR(paise(line.mrpPaise))}
              </span>
            )}
          </div>
        </div>

        {/* Quantity Stepper & Line Total — a free gift is fixed at qty 1, no stepper (removal is
         * still available via the trash button above). */}
        <div className="mt-3 flex items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2">
            {!line.isGift && (
              <QuantityStepper
                value={line.qty}
                onChange={(qty) => void updateQty(line.variantId, qty)}
                aria-label={`Quantity for ${line.productName}, ${line.optionValue}`}
                className="h-7.5 text-xs [&>button]:w-7 [&>input]:w-7.5 [&>input]:text-xs"
              />
            )}
          </div>

          <div className="text-right">
            <span className={line.isGift ? "text-sm font-bold text-leaf" : "text-sm font-bold text-ink tabular-nums"}>
              {line.isGift ? "FREE" : formatINR(paise(line.unitPricePaise * line.qty))}
            </span>
          </div>
        </div>
      </div>
    </li>
  );
}
