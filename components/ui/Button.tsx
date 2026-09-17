"use client";

import { Slot } from "@radix-ui/react-slot";
import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "gradient" | "solid-ink" | "solid-surface" | "solid-crit" | "outline" | "ghost" | "link";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** Render as the single child element (Radix Slot) instead of a <button> — e.g. wrap a <Link>. */
  asChild?: boolean;
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-sm gap-1.5",
  md: "h-11 px-5 text-[0.95rem] gap-2",
  lg: "h-13 px-7 text-base gap-2.5",
};

const BASE =
  "inline-flex items-center justify-center rounded-md font-sans font-semibold " +
  "transition-[transform,box-shadow,background-color,color,opacity] duration-[180ms] " +
  "ease-[cubic-bezier(.2,.6,.2,1)] disabled:opacity-50 disabled:pointer-events-none select-none " +
  "whitespace-nowrap active:scale-[0.97]";

const VARIANT_CLASSES: Record<Exclude<ButtonVariant, "gradient">, string> = {
  "solid-ink": "bg-ink text-surface hover:opacity-90 active:opacity-95 shadow-card",
  // A light pill for sitting on top of a saturated/colour background (e.g. BlueTeaBand's CTA on
  // the scroll-shifted gradient) — added because `cn()` (lib/cn.ts) deliberately has no
  // tailwind-merge/override logic, so passing a colour-overriding `className` alongside
  // `variant="solid-ink"` doesn't reliably win the cascade (which class wins depends on Tailwind's
  // generated CSS order, not the class-attribute order) — it silently rendered ink-on-ink once the
  // background itself turned a similarly dark colour. A real variant is the correct fix, not a
  // className override.
  "solid-surface": "bg-surface text-ink hover:opacity-90 active:opacity-95 shadow-card",
  // Same reasoning as solid-surface above — a real variant for a destructive/critical action
  // (e.g. admin order cancellation) instead of overriding solid-ink's bg-ink via className.
  "solid-crit": "bg-crit text-surface hover:opacity-90 active:opacity-95 shadow-card",
  outline: "border border-line bg-transparent text-ink hover:bg-surface-2",
  ghost: "bg-transparent text-ink hover:bg-surface-2",
  link: "bg-transparent text-ink underline underline-offset-4 hover:text-ink-2 h-auto p-0",
};

function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn("animate-spin", className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8v3a5 5 0 0 0-5 5H4Z"
      />
    </svg>
  );
}

/**
 * The gradient variant intentionally uses `--gradient-brew-cool` (brew-1 → brew-3), not the full
 * six-stop Lemon Shift — every stop in brew-cool is dark and saturated enough for white text to
 * clear 4.5:1 (see /design-system contrast table), whereas the Lemon Shift's trailing citrus stop
 * is a hard accessibility failure for white text (CLAUDE.md §5.6). The full Lemon Shift stays
 * reserved for the placements in CLAUDE.md §5.4 that don't require text sitting directly on top of
 * the citrus stop (hero canvas, collection tiles, divider rules, the shipping progress bar, the PDP
 * brew-story block, footer edge) — see /design-system for the full gradient placement gallery.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "solid-ink", size = "md", loading = false, asChild = false, className, children, disabled, ...props },
  ref,
) {
  const Comp = asChild ? Slot : "button";
  const isGradient = variant === "gradient";

  return (
    <Comp
      ref={ref}
      className={cn(
        BASE,
        SIZE_CLASSES[size],
        isGradient ? "text-white shadow-card hover:shadow-lift hover:-translate-y-px" : VARIANT_CLASSES[variant],
        className,
      )}
      style={isGradient ? { backgroundImage: "var(--gradient-brew-cool)" } : undefined}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {asChild ? (
        // Radix Slot requires exactly one React element child — asChild callers (e.g. wrapping a
        // <Link>) get that single child untouched, with no loading spinner injected alongside it.
        children
      ) : (
        <>
          {loading && <Spinner className="size-4" />}
          {children}
        </>
      )}
    </Comp>
  );
});
