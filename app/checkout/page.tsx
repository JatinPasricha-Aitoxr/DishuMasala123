import type { Metadata } from "next";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import { InitiateCheckoutTracker } from "@/components/marketing/InitiateCheckoutTracker";

export const metadata: Metadata = {
  title: "Checkout — Dishu Masala",
  robots: { index: false, follow: false },
};

/**
 * One page, three collapsible steps (Contact → Address → Payment) — PROMPTS.md Phase 5 item 5.
 * Guest checkout, no forced signup. The cart itself only exists client-side, so the interactive
 * body is a client component (CheckoutForm); this server wrapper exists for the route's metadata.
 */
export default function CheckoutPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="mb-6 font-display text-3xl font-semibold text-ink">Checkout</h1>
      <InitiateCheckoutTracker />
      <CheckoutForm />
    </div>
  );
}
