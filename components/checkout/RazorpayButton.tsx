"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { formatINR, paise } from "@/lib/money";
import { DESIGN_TOKEN_HEX } from "@/lib/design-tokens";

/**
 * Opens Razorpay's checkout for a server-created order (PROMPTS.md Phase 5 item 8). The checkout
 * script is lazy-loaded — only when this button is actually pressed, never on page load — and the
 * three outcomes (success, user-dismissed, failure) are kept distinct: a client-side `handler`
 * callback is never treated as proof of payment on its own (CLAUDE.md §4 — the webhook is the
 * source of truth; the verify call this triggers is a fast-path UX improvement only).
 */

interface RazorpayCheckoutOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  order_id: string;
  prefill: { name: string; email: string; contact: string };
  theme: { color: string };
  handler: (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => void;
  modal: { ondismiss: () => void };
}

interface RazorpayCheckoutInstance {
  open: () => void;
  on: (event: "payment.failed", handler: (response: { error?: { description?: string } }) => void) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayCheckoutInstance;
  }
}

const CHECKOUT_SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";
let scriptLoadPromise: Promise<void> | null = null;

function loadRazorpayScript(): Promise<void> {
  if (typeof window !== "undefined" && window.Razorpay) return Promise.resolve();
  if (!scriptLoadPromise) {
    scriptLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = CHECKOUT_SCRIPT_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load the Razorpay checkout script."));
      document.body.appendChild(script);
    });
  }
  return scriptLoadPromise;
}

export interface RazorpayButtonProps {
  razorpayOrderId: string;
  razorpayKeyId: string;
  amountPaise: number;
  shopName: string;
  prefill: { name: string; email: string; contact: string };
  onSuccess: (result: { razorpayPaymentId: string; razorpaySignature: string }) => void;
  onDismiss: () => void;
  onFailure: (message: string) => void;
  disabled?: boolean;
}

export function RazorpayButton({
  razorpayOrderId,
  razorpayKeyId,
  amountPaise,
  shopName,
  prefill,
  onSuccess,
  onDismiss,
  onFailure,
  disabled,
}: RazorpayButtonProps) {
  const [opening, setOpening] = useState(false);

  const open = async () => {
    setOpening(true);
    try {
      await loadRazorpayScript();
      if (!window.Razorpay) throw new Error("Razorpay checkout unavailable.");
      const checkout = new window.Razorpay({
        key: razorpayKeyId,
        amount: amountPaise,
        currency: "INR",
        name: shopName,
        order_id: razorpayOrderId,
        prefill,
        // Razorpay's checkout renders in its own iframe, so this has to be a literal colour string
        // — it can't resolve a CSS var() from our stylesheet. lib/design-tokens.ts is the one
        // canonical source for that literal, not a re-typed copy of --color-brew-1.
        theme: { color: DESIGN_TOKEN_HEX["brew-1"] },
        handler: (response) => {
          // Outcome 1: success (fast-path only — see file header comment).
          onSuccess({ razorpayPaymentId: response.razorpay_payment_id, razorpaySignature: response.razorpay_signature });
        },
        modal: {
          // Outcome 2: the shopper closed the checkout without paying.
          ondismiss: () => onDismiss(),
        },
      });
      checkout.on("payment.failed", (response) => {
        // Outcome 3: an actual payment failure inside Razorpay's own flow.
        onFailure(response?.error?.description ?? "Your payment could not be completed.");
      });
      checkout.open();
    } catch {
      onFailure("Couldn't open the payment window. Please try again.");
    } finally {
      setOpening(false);
    }
  };

  return (
    <Button type="button" variant="gradient" size="lg" className="w-full" onClick={() => void open()} loading={opening} disabled={disabled}>
      Pay {formatINR(paise(amountPaise))}
    </Button>
  );
}
