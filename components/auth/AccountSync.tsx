"use client";

/**
 * Fires the anonymous → account merge exactly once per sign-in (PROMPTS.md Phase 6 item 4:
 * "An anonymous wishlist and cart merge into the account on login without losing items"). Mounted
 * once in app/layout.tsx.
 *
 * Detects a real sign-in (not just "a session exists on this page load", which would be true on
 * every navigation for an already-signed-in user) by watching `useSession()`'s status transition
 * from "unauthenticated" to "authenticated" within THIS component's lifetime — the value comes
 * from the server-rendered session context, so it flips on the `router.refresh()` that follows a
 * successful sign-in (lib/actions/auth.ts). A fresh
 * mount that's already authenticated (e.g. a normal page load while signed in) never fires the
 * merge, since there's nothing anonymous left to merge by then. A `localStorage` guard
 * (`dm-merged-<userId>`) additionally makes it a no-op if it somehow re-fires for the same account
 * in the same browser (e.g. a second tab), so it's safe to be conservative about "did a merge
 * already happen" rather than exact.
 */
import { useEffect, useRef } from "react";
import { useSession } from "@/components/providers/SessionProvider";
import { useCartStore } from "@/lib/store/cart";
import { useWishlistStore } from "@/lib/store/wishlist";
import { mergeCartAction } from "@/lib/actions/cart";
import { mergeWishlistAction } from "@/lib/actions/wishlist";

function mergeGuardKey(userId: string): string {
  return `dm-merged-${userId}`;
}

export function AccountSync() {
  const { status, data } = useSession();
  const wasSignedIn = useRef(false);
  const merging = useRef(false);

  useEffect(() => {
    const userId = data?.user?.id;
    const justSignedIn = status === "authenticated" && !wasSignedIn.current && userId;
    if (status === "authenticated") wasSignedIn.current = true;
    if (status === "unauthenticated") wasSignedIn.current = false;

    if (!justSignedIn || merging.current) return;

    let alreadyMerged = false;
    try {
      alreadyMerged = sessionStorage.getItem(mergeGuardKey(userId)) === "1";
    } catch {
      // sessionStorage unavailable — proceed with the merge; it's idempotent (union-based) either
      // way, so a rare duplicate call costs nothing but an extra round trip.
    }
    if (alreadyMerged) return;

    merging.current = true;
    void (async () => {
      try {
        const cartLines = useCartStore.getState().lines.map((l) => ({ variantId: l.variantId, qty: l.qty }));
        const wishlistIds = useWishlistStore.getState().productIds;

        const [cartResult, wishlistResult] = await Promise.all([
          cartLines.length > 0 ? mergeCartAction(cartLines) : Promise.resolve(null),
          wishlistIds.length > 0 ? mergeWishlistAction(wishlistIds) : Promise.resolve(null),
        ]);

        if (cartResult?.ok) {
          // The merge is authoritative for WHICH variants/quantities exist; price/stock still
          // come only from the next revalidate (CLAUDE.md §7.5) — never trust merge output as a
          // price. Re-fetch each surviving line's display fields via revalidate after swapping in
          // the merged line ids.
          const existing = useCartStore.getState().lines;
          const merged = cartResult.lines.map((line) => {
            const prior = existing.find((l) => l.variantId === line.variantId);
            return (
              prior ?? {
                variantId: line.variantId,
                productId: 0,
                priority: 0,
                qty: line.qty,
                productName: "",
                optionValue: "",
                sku: "",
                mrpPaise: 0,
                unitPricePaise: 0,
                imageUrl: null,
              }
            );
          });
          useCartStore.setState({ lines: merged.map((l, i) => ({ ...l, qty: cartResult.lines[i].qty })) });
          await useCartStore.getState().revalidate();
        }

        if (wishlistResult?.ok) {
          useWishlistStore.setState({ productIds: [] }); // DB is now the source of truth for signed-in
        }

        try {
          sessionStorage.setItem(mergeGuardKey(userId), "1");
        } catch {
          // Best-effort only.
        }
      } finally {
        merging.current = false;
      }
    })();
  }, [status, data?.user?.id]);

  return null;
}
