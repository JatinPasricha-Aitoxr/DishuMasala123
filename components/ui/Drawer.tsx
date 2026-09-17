"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

/**
 * A slide-in panel built on Radix Dialog — same focus-trap / Escape-to-close / focus-return
 * guarantees as Dialog, just docked to an edge instead of centered. Used for the mobile nav drawer
 * and (later) the cart drawer.
 */
export const Drawer = DialogPrimitive.Root;
export const DrawerTrigger = DialogPrimitive.Trigger;
export const DrawerClose = DialogPrimitive.Close;
export const DrawerTitle = DialogPrimitive.Title;
export const DrawerDescription = DialogPrimitive.Description;

export type DrawerSide = "left" | "right";

const SIDE_CLASSES: Record<DrawerSide, string> = {
  left: "left-0 data-[state=open]:animate-[drawer-in-left_220ms_cubic-bezier(.2,.6,.2,1)] data-[state=closed]:animate-[drawer-out-left_180ms_cubic-bezier(.2,.6,.2,1)]",
  right:
    "right-0 data-[state=open]:animate-[drawer-in-right_220ms_cubic-bezier(.2,.6,.2,1)] data-[state=closed]:animate-[drawer-out-right_180ms_cubic-bezier(.2,.6,.2,1)]",
};

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="size-4" aria-hidden="true">
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export type DrawerWidth = "sm" | "cart";

const WIDTH_CLASSES: Record<DrawerWidth, string> = {
  sm: "w-[min(20rem,88vw)]",
  // The cart drawer (bluetea.co.in-style): full-bleed on mobile, 440px on desktop (CLAUDE.md §5
  // spacing discipline, PROMPTS.md cart brief §2/§18: "420-500px").
  cart: "w-screen sm:w-[440px]",
};

export function DrawerContent({
  className,
  side = "left",
  width = "sm",
  padded = true,
  showDefaultClose = true,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  side?: DrawerSide;
  width?: DrawerWidth;
  /** false lets the content own its own padding — used by the cart drawer, whose sticky
   * header/footer need to bleed edge-to-edge while the scrollable body keeps inset padding. */
  padded?: boolean;
  showDefaultClose?: boolean;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-[2px] data-[state=open]:animate-[fade-in_180ms_ease]" />
      <DialogPrimitive.Content
        className={cn(
          "fixed top-0 z-50 h-dvh overflow-y-auto bg-surface shadow-lift focus:outline-none",
          padded && "p-5",
          WIDTH_CLASSES[width],
          SIDE_CLASSES[side],
          className,
        )}
        {...props}
      >
        {children}
        {showDefaultClose && (
          <DialogPrimitive.Close
            className="absolute right-4 top-4 inline-flex size-8 items-center justify-center rounded-sm text-ink-2 hover:bg-surface-2"
            aria-label="Close menu"
          >
            <CloseIcon />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
