"use client";

/**
 * One shared wishlist toggle used by every real product card (via components/product/ProductCard.tsx
 * and components/pdp/BuyBox.tsx) and by app/account/wishlist's remove buttons — PROMPTS.md Phase 6
 * item 4: "header count reflecting whichever [source] applies — DB-backed when signed in,
 * localStorage when not." The same rule applies here, not just to the header count: signed in,
 * every toggle reads/writes `wishlist_items` through the server actions; signed out, it reads/
 * writes lib/store/wishlist.ts's localStorage-backed Zustand store.
 */
import { useEffect, useState } from "react";
import { useSession } from "@/components/providers/SessionProvider";
import { useWishlistStore } from "@/lib/store/wishlist";
import { addToWishlistAction, removeFromWishlistAction, getWishlistProductIdsAction } from "@/lib/actions/wishlist";

export function useWishlistToggle(productId: number | undefined) {
  const { status } = useSession();
  const isSignedIn = status === "authenticated";
  const localHas = useWishlistStore((s) => (productId != null ? s.productIds.includes(productId) : false));
  const toggleLocal = useWishlistStore((s) => s.toggle);
  const [dbHas, setDbHas] = useState(false);

  useEffect(() => {
    if (!isSignedIn || productId == null) return;
    let cancelled = false;
    void getWishlistProductIdsAction().then((ids) => {
      if (!cancelled) setDbHas(ids.includes(productId));
    });
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, productId]);

  const wishlisted = productId == null ? false : isSignedIn ? dbHas : localHas;

  const toggle = () => {
    if (productId == null) return;
    if (isSignedIn) {
      const next = !dbHas;
      setDbHas(next); // optimistic — the header/account list re-derive from the DB independently
      void (next ? addToWishlistAction(productId) : removeFromWishlistAction(productId));
    } else {
      toggleLocal(productId);
    }
  };

  return { wishlisted, toggle };
}
