"use client";

import { useEffect, useRef } from "react";

export interface FallingPetalsProps {
  /** Real, transparent-background petal/flower PNGs (e.g. "/petals/petal-1.png") — picked at
   * random per particle for variety. Each is loaded once and reused across every particle (canvas
   * `drawImage`, never a DOM `<img>` per particle). If an image fails to load, or hasn't finished
   * loading yet, NOTHING is drawn for it — this component never falls back to a drawn shape
   * (rect/circle/blob). */
  images: string[];
  /** Desktop particle count (18–24 band recommended). Defaults to ~half on mobile (<640px)
   * unless `countMobile` is given explicitly. */
  count?: number;
  countMobile?: number;
  /** Fall speed range, px/frame at 60fps-equivalent (scaled by actual frame delta so it's
   * consistent across refresh rates). */
  speed?: { min: number; max: number };
  /** Size range, px (square). Scaled ~0.7x automatically on mobile. */
  size?: { min: number; max: number };
  /** Opacity range, 0–1 — kept translucent so page content stays readable underneath. */
  opacity?: { min: number; max: number };
  className?: string;
}

interface Particle {
  img: HTMLImageElement;
  x: number;
  y: number;
  size: number;
  opacity: number;
  fallSpeed: number;
  rotation: number;
  rotationSpeed: number;
  swayAmplitude: number;
  swaySpeed: number;
  swayPhase: number;
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Resolves once ALL images have loaded successfully — any single failure rejects the whole
 * batch, since a partially-loaded set would let an unloaded image slip into the random-pick pool.
 * The caller treats a rejection as "render nothing," never as "draw a placeholder." */
function loadImages(sources: string[]): Promise<HTMLImageElement[]> {
  return Promise.all(
    sources.map(
      (src) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = src;
        }),
    ),
  );
}

function makeParticle(
  images: HTMLImageElement[],
  width: number,
  height: number,
  opts: Required<Pick<FallingPetalsProps, "speed" | "size" | "opacity">>,
  initialFill: boolean,
): Particle {
  return {
    img: images[Math.floor(Math.random() * images.length)],
    x: rand(0, width),
    // Because this canvas is `position: fixed` to the viewport (not the document), y=0 is always
    // "just below the navbar/branch," no matter how far the page is scrolled — so a recycled
    // particle spawning at a small negative y always visibly re-enters from the branch line,
    // continuously, at any scroll position. `initialFill` only spreads the very first batch down
    // the whole viewport so the page doesn't open with an empty screen and one lonely top strip.
    y: initialFill ? rand(-height * 0.1, height) : rand(-height * 0.2, -height * 0.02),
    size: rand(opts.size.min, opts.size.max),
    opacity: rand(opts.opacity.min, opts.opacity.max),
    fallSpeed: rand(opts.speed.min, opts.speed.max),
    rotation: rand(0, Math.PI * 2),
    rotationSpeed: rand(-0.5, 0.5),
    swayAmplitude: rand(8, 26),
    swaySpeed: rand(0.4, 1.0),
    swayPhase: rand(0, Math.PI * 2),
  };
}

/**
 * Butterfly-pea petals falling from the decorative branch (BlueVineBand, fixed just below the
 * navbar) down the ENTIRE Blue Tea PDP — not just its hero. This canvas is `position: fixed,
 * inset-0` sized to the VIEWPORT (`window.innerWidth/innerHeight`), never the full document
 * height: it repaints the same small viewport-sized surface regardless of scroll position or page
 * length, which is what keeps a page-wide effect cheap — the alternative (a canvas as tall as the
 * whole document) would mean compositing a much larger surface for no visual benefit, since only
 * the viewport is ever visible at once.
 *
 * Draws ONLY from the real PNGs passed via `images` — there is no code path here that paints a
 * rect/circle/blob as a stand-in. `loadImages()` awaits every image's real `onload` before a single
 * particle exists; a slow or broken asset means this renders nothing until (or unless) it loads.
 *
 * Renders nothing under `prefers-reduced-motion: reduce`. Pauses (not tears down) the rAF loop on
 * `document.visibilitychange` (tab hidden) rather than an `IntersectionObserver` — a full-viewport
 * fixed overlay has no meaningful "scrolled out of view" state the way a hero-scoped canvas does,
 * so tab visibility is the correct pause signal here. Resizes on the `resize` event (viewport
 * dimensions only, not a container). Cleans up rAF and both listeners on unmount.
 */
export function FallingPetals({
  images,
  count = 20,
  countMobile,
  speed = { min: 0.3, max: 0.8 },
  size = { min: 14, max: 28 },
  opacity = { min: 0.4, max: 0.7 },
  className,
}: FallingPetalsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let particles: Particle[] = [];
    let loadedImages: HTMLImageElement[] = [];
    let width = 0;
    let height = 0;
    let dpr = 1;
    let rafId = 0;
    let lastTime = 0;
    let running = true;
    let cancelled = false;

    function isMobile(): boolean {
      return width < 640;
    }

    function targetCount(): number {
      if (isMobile()) return countMobile ?? Math.max(10, Math.round(count / 2));
      return count;
    }

    function effectiveSize(): { min: number; max: number } {
      if (!isMobile()) return size;
      return { min: size.min * 0.7, max: size.max * 0.7 };
    }

    function resize() {
      if (!canvas) return;
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (loadedImages.length === 0) return;
      const target = targetCount();
      if (particles.length > target) {
        particles = particles.slice(0, target);
      } else {
        while (particles.length < target) {
          particles.push(makeParticle(loadedImages, width, height, { speed, size: effectiveSize(), opacity }, true));
        }
      }
    }

    function step(time: number) {
      if (cancelled) return;
      rafId = requestAnimationFrame(step);
      if (!running || !ctx) return;

      const dt = lastTime ? Math.min((time - lastTime) / 16.67, 3) : 1;
      lastTime = time;

      ctx.clearRect(0, 0, width, height);
      for (const p of particles) {
        p.y += p.fallSpeed * dt;
        p.swayPhase += 0.02 * p.swaySpeed * dt;
        p.rotation += 0.01 * p.rotationSpeed * dt;
        const x = p.x + Math.sin(p.swayPhase) * p.swayAmplitude;

        if (p.y - p.size > height) {
          Object.assign(p, makeParticle(loadedImages, width, height, { speed, size: effectiveSize(), opacity }, false));
          continue;
        }

        // Defensive: images are only ever added to `loadedImages` after their own `onload` fires,
        // so this should never be false — skip drawing rather than risk an empty/broken frame.
        if (!p.img.complete || p.img.naturalWidth === 0) continue;

        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.translate(x, p.y);
        ctx.rotate(p.rotation);
        ctx.drawImage(p.img, -p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }
    }

    loadImages(images)
      .then((loaded) => {
        if (cancelled) return;
        loadedImages = loaded;
        resize();
        particles = Array.from({ length: targetCount() }, () => makeParticle(loadedImages, width, height, { speed, size: effectiveSize(), opacity }, true));
        rafId = requestAnimationFrame(step);
      })
      .catch(() => {
        // A missing/broken petal image means this renders nothing — never a fallback shape.
      });

    window.addEventListener("resize", resize);

    function onVisibilityChange() {
      running = document.visibilityState === "visible";
      if (running) lastTime = 0; // avoid a large dt spike on resume
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
    // Intentionally set up once (empty deps) — mounted once per PDP visit with fixed config.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className ?? "pointer-events-none fixed inset-0 z-20"}
    />
  );
}
