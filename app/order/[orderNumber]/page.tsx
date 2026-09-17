import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderByOrderNumber } from "@/lib/db/queries/orders";
import { verifyOrderToken } from "@/lib/order-token";
import { checkPincodeServiceability } from "@/lib/shiprocket";
import { formatINR } from "@/lib/money";
import { PurchaseTracker } from "@/components/marketing/PurchaseTracker";

export const metadata: Metadata = {
  title: "Order confirmation — Dishu Masala",
  robots: { index: false, follow: false },
};

interface OrderConfirmationPageProps {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ email?: string; token?: string }>;
}

/**
 * The order confirmation page (PROMPTS.md Phase 5 item 11). There's no auth yet (Phase 6), so an
 * order number alone must never be enough to see order details — that would let anyone enumerate
 * `DM-2026-00001`, `DM-2026-00002`, ... and read other customers' orders. Instead this page only
 * renders anything after verifying the HMAC-signed `email`+`token` query pair
 * (lib/order-token.ts) matches this exact order — the same link the confirmation email and the
 * checkout/verify API responses hand back. A missing/invalid/mismatched token is a 404, not an
 * error page, so it gives an attacker no signal about which order numbers are real.
 */
export default async function OrderConfirmationPage({ params, searchParams }: OrderConfirmationPageProps) {
  const { orderNumber } = await params;
  const { email, token } = await searchParams;

  if (!email || !token || !verifyOrderToken(orderNumber, email, token)) {
    notFound();
  }

  const order = await getOrderByOrderNumber(orderNumber);
  if (!order || order.email.toLowerCase() !== email.toLowerCase()) {
    notFound();
  }

  const serviceability = await checkPincodeServiceability(order.shippingAddress.pincode).catch(() => null);
  const etaDays = serviceability?.status === "serviceable" ? serviceability.etaDays : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <PurchaseTracker
        orderNumber={order.orderNumber}
        skus={order.items.map((item) => item.sku)}
        totalPaise={order.totalPaise}
        numItems={order.items.reduce((n, item) => n + item.qty, 0)}
      />
      <p className="text-sm font-semibold uppercase tracking-[0.1em] text-leaf">Order confirmed</p>
      <h1 className="mt-2 font-display text-3xl font-semibold text-ink">Thank you — order {order.orderNumber}</h1>
      <p className="mt-2 text-ink-2">
        {order.status === "confirmed" || order.status === "packed" || order.status === "shipped" || order.status === "delivered"
          ? "Your order is confirmed and being prepared."
          : "We're finalising your order."}
      </p>

      <section className="mt-8 rounded-lg border border-line bg-surface p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.08em] text-ink-2">Items</h2>
        <ul>
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between border-b border-line py-3 text-sm last:border-0">
              <div>
                <p className="font-medium text-ink">{item.productName}</p>
                <p className="text-ink-2">
                  {item.optionValue} × {item.qty}
                </p>
              </div>
              <p className="tabular-nums font-semibold text-ink">{formatINR(item.lineTotalPaise)}</p>
            </li>
          ))}
        </ul>

        <dl className="mt-4 flex flex-col gap-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-2">Subtotal</dt>
            <dd className="tabular-nums text-ink">{formatINR(order.subtotalPaise)}</dd>
          </div>
          {order.discountPaise > 0 && (
            <div className="flex justify-between">
              <dt className="text-ink-2">Discount{order.couponCode ? ` (${order.couponCode})` : ""}</dt>
              <dd className="tabular-nums text-leaf">−{formatINR(order.discountPaise)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-ink-2">Shipping</dt>
            <dd className="tabular-nums text-ink">{order.shippingPaise > 0 ? formatINR(order.shippingPaise) : "Free"}</dd>
          </div>
          <div className="mt-1 flex justify-between border-t border-line pt-2 text-base font-semibold">
            <dt className="text-ink">Total</dt>
            <dd className="tabular-nums text-ink">{formatINR(order.totalPaise)}</dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-ink-2">
          Inclusive of all taxes (GST). {order.paymentMethod === "cod" ? "Payable on delivery." : "Paid online."}
        </p>
      </section>

      <section className="mt-6 rounded-lg border border-line bg-surface p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.08em] text-ink-2">Delivery</h2>
        <p className="text-sm text-ink">
          {order.shippingAddress.name}
          <br />
          {order.shippingAddress.line1}
          {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ""}
          <br />
          {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.pincode}
        </p>
        {etaDays != null && <p className="mt-2 text-sm text-ok">Estimated delivery in ~{etaDays} day{etaDays === 1 ? "" : "s"}.</p>}
        {order.trackingUrl && (
          <p className="mt-2 text-sm">
            <a href={order.trackingUrl} className="font-medium text-brew-2 underline underline-offset-4">
              Track your shipment{order.courier ? ` — ${order.courier}` : ""}
            </a>
            {order.awb && <span className="text-ink-2"> (AWB {order.awb})</span>}
          </p>
        )}
      </section>

      <section className="mt-6 rounded-lg border border-line bg-surface-2 p-5">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-[0.08em] text-ink-2">What happens next</h2>
        <ol className="flex flex-col gap-1.5 text-sm text-ink-2">
          <li>
            1. {order.paymentMethod === "cod" ? "We pack your order and hand it to our courier." : "Your payment is confirmed and we start packing."}
          </li>
          <li>2. You&apos;ll get an email the moment your order ships, with a tracking link.</li>
          <li>3. Pay {order.paymentMethod === "cod" ? "the courier in cash" : "was already completed online"} on delivery{order.paymentMethod === "cod" ? "" : "."}.</li>
        </ol>
      </section>

      <Link href="/shop/" className="mt-8 inline-block text-sm font-medium text-ink-2 underline underline-offset-4 hover:text-ink">
        Continue shopping
      </Link>
    </div>
  );
}
