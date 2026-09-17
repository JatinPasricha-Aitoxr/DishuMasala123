import { Link, Section, Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./components/Layout";
import { OrderItemsList } from "./components/OrderItemsList";
import type { Order } from "@/types/order";

export interface NewOrderReceivedEmailProps {
  order: Order;
  /** app/admin/orders/[orderNumber] — staff-only, behind the role gate, unlike the guest
   * confirmationUrl used in OrderConfirmation.tsx. */
  adminOrderUrl: string;
}

/**
 * Sent to the store's own notification address (settings.store_address.email), never to the
 * customer — the only email in emails/ addressed to staff rather than a shopper. Reuses
 * OrderItemsList so the totals shown here can never drift from what the customer's own
 * confirmation email says.
 */
export default function NewOrderReceivedEmail({ order, adminOrderUrl }: NewOrderReceivedEmailProps) {
  return (
    <EmailLayout previewText={`New order ${order.orderNumber} — ${order.paymentMethod === "cod" ? "COD" : "paid"}`}>
      <Text style={emailStyles.h1}>New order received</Text>
      <Text style={emailStyles.body}>
        <strong>{order.orderNumber}</strong> from {order.shippingAddress.name} ({order.email}, {order.phone}) —{" "}
        {order.paymentMethod === "cod" ? "Cash on Delivery" : "paid via Razorpay"}.
      </Text>
      <OrderItemsList order={order} />
      <Text style={emailStyles.label}>Ship to</Text>
      <Text style={emailStyles.body}>
        {order.shippingAddress.line1}
        {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ""}, {order.shippingAddress.city},{" "}
        {order.shippingAddress.state} {order.shippingAddress.pincode}
      </Text>
      <Section style={emailStyles.buttonWrap}>
        <Link href={adminOrderUrl} style={emailStyles.button}>
          Open in admin
        </Link>
      </Section>
    </EmailLayout>
  );
}
