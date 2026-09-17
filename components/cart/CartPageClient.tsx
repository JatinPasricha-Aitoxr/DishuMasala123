"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { CartLineItem } from "./CartLineItem";
import { CartNotices } from "./CartNotices";
import { EmptyCart } from "./EmptyCart";
import { FreeShippingProgress } from "./FreeShippingProgress";
import { CouponField } from "./CouponField";
import { OrderSummary } from "./OrderSummary";
import { TrustIndicators } from "./TrustIndicators";
import { useCartStore, selectFreeShippingThresholdPaise, selectRupeesToFreeShippingPaise, selectSubtotalPaise } from "@/lib/store/cart";

/**
 * The full cart page's interactive body (PROMPTS.md Phase 5 item 2) — the cart itself only exists
 * client-side (localStorage/Zustand), so this is a client component. `upsells` is a Server
 * Component (components/cart/CartUpsells.tsx, DB-backed) rendered by the server parent
 * (app/cart/page.tsx) and passed down as `children`-style composition — the standard way to mix a
 * server-fetched slot into a client tree without the client component importing server code.
 */
export function CartPageClient({ upsells, bestsellers }: { upsells: ReactNode; bestsellers?: ReactNode }) {
  const lines = useCartStore((s) => s.lines);
  const pricing = useCartStore((s) => s.pricing);
  const subtotalPaise = useCartStore(selectSubtotalPaise);
  const thresholdPaise = useCartStore(selectFreeShippingThresholdPaise);
  const rupeesToGoPaise = useCartStore(selectRupeesToFreeShippingPaise);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl font-semibold text-ink">Your cart</h1>

      <div className="mt-6">
        <CartNotices />
      </div>

      {lines.length === 0 ? (
        <EmptyCart bestsellers={bestsellers} />
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_360px]">
          <div className="flex flex-col gap-6">
            {thresholdPaise != null && rupeesToGoPaise != null && (
              <FreeShippingProgress subtotalPaise={subtotalPaise} thresholdPaise={thresholdPaise} rupeesToGoPaise={rupeesToGoPaise} />
            )}
            <ul>
              {lines.map((line) => (
                <CartLineItem key={line.variantId} line={line} />
              ))}
            </ul>
          </div>

          <aside className="flex flex-col gap-5 rounded-lg border border-line bg-surface p-5 lg:sticky lg:top-24 lg:self-start">
            <CouponField />
            <OrderSummary pricing={pricing} />
            <Button asChild variant="gradient" size="lg">
              <Link href="/checkout/">Proceed to checkout →</Link>
            </Button>
            <TrustIndicators />
          </aside>
        </div>
      )}

      {lines.length > 0 && <div className="mt-14">{upsells}</div>}
    </div>
  );
}
