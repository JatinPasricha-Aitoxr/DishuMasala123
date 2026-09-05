"use client";

import { Placeholder } from "@/components/media/Placeholder";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { formatINR, paise } from "@/lib/money";
import { useCartStore, type CartLine } from "@/lib/store/cart";

/** One cart line — image, name, option, quantity control, remove, line total (PROMPTS.md Phase 5
 * item 2). `line.imageUrl` is only ever set by the component that added the line (the PDP's "Add
 * to cart" and every card's "Quick add" — both now resolve a real storage image URL server-side before
 * it reaches this client state); falls back to the generic placeholder for older/partial lines
 * that never got one (e.g. AccountSync's guest-cart-merge stub, before its own revalidate resolves). */
export function CartLineItem({ line }: { line: CartLine }) {
  const updateQty = useCartStore((s) => s.updateQty);
  const removeItem = useCartStore((s) => s.removeItem);

  return (
    <li className="flex gap-4 border-b border-line py-4 last:border-0">
      <div className="w-20 shrink-0">
        {line.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- small fixed-size thumbnail, not worth next/image's overhead here.
          <img src={line.imageUrl} alt="" className="aspect-square w-full rounded-sm object-cover" />
        ) : (
          <Placeholder slot="product-packshot-generic" className="rounded-sm" />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-ink">{line.productName}</p>
            <p className="text-xs text-ink-2">{line.optionValue}</p>
          </div>
          <p className="tabular-nums text-sm font-semibold text-ink">{formatINR(paise(line.unitPricePaise * line.qty))}</p>
        </div>
        <div className="flex items-center justify-between gap-3">
          <QuantityStepper
            value={line.qty}
            onChange={(qty) => void updateQty(line.variantId, qty)}
            aria-label={`Quantity for ${line.productName}, ${line.optionValue}`}
          />
          <button
            type="button"
            onClick={() => void removeItem(line.variantId)}
            className="text-xs font-medium text-ink-2 underline underline-offset-4 hover:text-crit"
          >
            Remove
          </button>
        </div>
      </div>
    </li>
  );
}
