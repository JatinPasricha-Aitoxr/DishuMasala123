"use client";

import { useEffect, useRef } from "react";

type Rgb = readonly [number, number, number];

function hexToRgb(hex: string): Rgb {
  const clean = hex.trim().replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const n = Number.parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function lerpRgb(a: Rgb, b: Rgb, t: number): string {
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r} ${g} ${bl})`;
}

/** Piecewise-linear sample of N colour stops (evenly spaced across 0–1) at position `t`. */
function sampleStops(stops: Rgb[], t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  const n = stops.length - 1;
  const segment = Math.min(n - 1, Math.floor(clamped * n));
  const localT = clamped * n - segment;
  return lerpRgb(stops[segment], stops[segment + 1], localT);
}

export interface ScrollColorBandProps {
  /** CSS custom property names (e.g. "--color-brew-2"), not raw hex — resolved at runtime via
   * getComputedStyle so this component never hardcodes a colour literal (CLAUDE.md §5.2's tokens
   * stay the single source of truth; a grep for hex literals across components/ must stay empty).
   * Two stops (fromVar/toVar) or three (fromVar/viaVar/toVar). */
  fromVar: string;
  viaVar?: string;
  toVar: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * A background that shifts colour as it scrolls through the viewport. Originated as the "Lemon
 * Shift" idea (blue turning toward magenta/red) applied to the Blue Tea → Red Tea section handoff
 * per client request, rather than the removed hero; reused as-is (generic two/three-stop scroll
 * tracking, nothing Lemon-Shift-specific in the implementation) for the Masala pillar's own band
 * (`MasalaBand.tsx`, CLAUDE.md §7.2 amendment) once Tea and Masala needed equal full-bleed
 * treatment. Progress `t` is 0 when this element's top edge is at the bottom of the viewport (about
 * to enter) and 1 when its bottom edge reaches the top of the viewport (about to leave).
 *
 * **Wrap BOTH sections in a single instance of this component** (fromVar=blue, viaVar=pink,
 * toVar=red), don't use two separate instances stitched at their edges — two independently
 * scroll-tracked gradients (one per section) can't be guaranteed to agree at the exact shared
 * pixel row on every frame, since each section reads its own, differently-sized bounding box, and
 * that produced a visible seam/discontinuity at the handoff. One element spanning both sections'
 * full height makes the transition a single continuous canvas by construction — no seam is
 * possible because there's only one gradient, not two.
 *
 * Renders a soft two-tone gradient (sampling slightly behind/ahead of `t` along the stop
 * sequence), not a flat fill, so colours visibly blend into each other rather than sitting as flat
 * fills (client request: "pink and red should also gradiently mix").
 *
 * `prefers-reduced-motion: reduce` renders a static, finished `fromVar` background instead of
 * tracking scroll (CLAUDE.md §5.5) — a real, intentional brand colour, not a broken/frozen mid-tween
 * state.
 */
export function ScrollColorBand({ fromVar, viaVar, toVar, children, className }: ScrollColorBandProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const style = getComputedStyle(document.documentElement);
    const stops = [fromVar, viaVar, toVar]
      .filter((v): v is string => Boolean(v))
      .map((v) => hexToRgb(style.getPropertyValue(v)));

    const SPREAD = 0.16;
    let ticking = false;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const total = Math.max(1, rect.height + vh);
      const scrolled = vh - rect.top;
      const t = Math.max(0, Math.min(1, scrolled / total));
      const near = sampleStops(stops, Math.max(0, t - SPREAD));
      const far = sampleStops(stops, Math.min(1, t + SPREAD));
      el.style.backgroundImage = `linear-gradient(180deg, ${near}, ${far})`;
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        update();
        ticking = false;
      });
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [fromVar, viaVar, toVar]);

  return (
    <div ref={ref} className={className} style={{ backgroundColor: `var(${fromVar})` }}>
      {children}
    </div>
  );
}
