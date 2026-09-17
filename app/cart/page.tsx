import { Suspense } from "react";
import { CartPageClient } from "@/components/cart/CartPageClient";
import { CartUpsells } from "@/components/cart/CartUpsells";
import { EmptyCartBestsellers } from "@/components/cart/EmptyCartBestsellers";

export const metadata = {
  title: "Your cart — Dishu Masala",
  robots: { index: false, follow: false },
};

/** Server entry point — its only job is to hand the DB-backed upsell rail (a Server Component)
 * down into the client cart body as composed `children`, since the cart itself lives entirely in
 * client-side state (PROMPTS.md Phase 5 item 2). */
export default function CartPage() {
  return (
    <CartPageClient
      upsells={
        <Suspense fallback={null}>
          <CartUpsells />
        </Suspense>
      }
      bestsellers={
        <Suspense fallback={null}>
          <EmptyCartBestsellers />
        </Suspense>
      }
    />
  );
}
