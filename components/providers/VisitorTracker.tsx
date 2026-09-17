"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Fires one event per client-side route change to /api/track — the visitor id itself is never
 * touched here (it's an httpOnly cookie the server reads on its own; this component doesn't even
 * know it exists). `/product/<slug>` is the only path shape treated as `product_view` rather than
 * a generic `page_view`, since that's the one signal the messaging use case (lib/db/schema/
 * marketing.ts's doc comment) actually cares about — "viewed Blue Tea, didn't buy".
 */
export function VisitorTracker() {
  const pathname = usePathname();
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    if (lastSent.current === pathname) return;
    lastSent.current = pathname;

    const eventType = pathname.startsWith("/product/") ? "product_view" : "page_view";
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType, path: pathname }),
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);

  return null;
}
