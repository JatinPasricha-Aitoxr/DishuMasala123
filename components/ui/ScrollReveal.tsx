"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export interface ScrollRevealProps {
  children: React.ReactNode;
  className?: string;
  /** Extra transition-delay in ms — for staggering a row of siblings. */
  delay?: number;
}

/**
 * Fades a section up into place the first time it scrolls into view, instead of just appearing.
 * Server-rendered markup always starts fully visible (no hidden class in the initial HTML) — only
 * `mounted` (set in an effect, so never true on the server or for a no-JS/pre-hydration request)
 * lets the hidden state apply at all. That means: no JS -> always visible, IntersectionObserver
 * unsupported -> always visible, real browsers -> hidden only until it's actually been seen once.
 * `prefers-reduced-motion` needs no extra guard here: app/globals.css's generic `*` override
 * already collapses the transition to ~0ms, so reduced-motion users still get the content, just
 * without the animated rise.
 *
 * Only meant for sections that start below the fold — wrapping above-the-fold content (the hero,
 * the header) would risk a brief hidden-then-shown flash while the observer's first callback
 * fires, which is exactly the FOUC this component is built to avoid, not introduce.
 */
export function ScrollReveal({ children, className, delay }: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    setMounted(true);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const hidden = mounted && !visible;

  return (
    <div
      ref={ref}
      className={cn(
        "transition-[opacity,transform] duration-[550ms] ease-[cubic-bezier(.16,1,.3,1)]",
        hidden ? "translate-y-4 opacity-0" : "translate-y-0 opacity-100",
        className,
      )}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
