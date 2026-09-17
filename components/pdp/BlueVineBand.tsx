"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The static butterfly-pea branch, fixed just below the site header on the Blue Tea PDP — the
 * visual "source" FallingPetals.tsx's flowers appear to drop from, continuously, at any scroll
 * position (both are `position: fixed`, not part of the scrolling page flow).
 *
 * The header (components/layout/HeaderClient.tsx) is `sticky`, not `fixed`, and its own height is
 * dynamic — h-20 normally, h-14 once "condensed" on scroll — so a hardcoded `top` offset would
 * drift out of alignment the moment the header shrinks. This measures the real `<header>`
 * element's height via `ResizeObserver` and sets its own `top` inline style to match, rather than
 * guessing a fixed pixel value.
 *
 * A static `<img>`, not a canvas — it never animates, so there's no reason to pay for a render
 * loop on something that never changes.
 */
export function BlueVineBand() {
  const [headerHeight, setHeaderHeight] = useState(80); // h-20 default, corrected on mount
  const observedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const header = document.querySelector("header");
    if (!header) return;
    observedRef.current = header;

    const update = () => setHeaderHeight(header.getBoundingClientRect().height);
    update();

    const observer = new ResizeObserver(update);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      aria-hidden="true"
      style={{ top: headerHeight }}
      className="pointer-events-none fixed inset-x-0 z-[25] transition-[top] duration-200 ease-[cubic-bezier(.2,.6,.2,1)]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- a static decorative overlay, not a
          next/image-worthy content photo; no responsive srcset needed. */}
      <img src="/decor/blue-vine.png" alt="" className="h-auto w-full select-none" />
    </div>
  );
}
