"use client";

/**
 * Thin, typed wrapper around Meta's `fbq` global — never call `window.fbq` directly from a
 * component. Every call here is a no-op (not a throw) when the pixel script hasn't loaded: no
 * `NEXT_PUBLIC_META_PIXEL_ID` set yet (components/marketing/MetaPixel.tsx renders nothing in that
 * case), an ad blocker stripped the script, or the event fires before the script tag has executed.
 * A missing pixel must never break the actual checkout/cart flow it's just observing.
 */
declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

export interface MetaPixelContentParams {
  content_ids: string[];
  content_type: "product";
  content_name?: string;
  value: number;
  currency: "INR";
}

export interface MetaPixelPurchaseParams extends MetaPixelContentParams {
  num_items: number;
}

function track(event: string, params?: object): void {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  window.fbq("track", event, params);
}

export function trackViewContent(params: MetaPixelContentParams): void {
  track("ViewContent", params);
}

export function trackAddToCart(params: MetaPixelContentParams): void {
  track("AddToCart", params);
}

export function trackInitiateCheckout(params: { content_ids: string[]; value: number; currency: "INR"; num_items: number }): void {
  track("InitiateCheckout", params);
}

export function trackPurchase(params: MetaPixelPurchaseParams): void {
  track("Purchase", params);
}
