/**
 * Domain types for orders. Hand-rolled, no drizzle-orm import — see types/catalog.ts for why.
 * Scaffolded in Phase 0 alongside the schema; consumed starting with the checkout work in
 * Phase 5.
 */
import type { Paise } from "@/lib/money";

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "packed"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

export type PaymentMethod = "razorpay" | "cod";
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

export interface OrderAddress {
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
}

export interface OrderItem {
  id: number;
  orderId: number;
  /** Nullable — a deleted variant must never delete or corrupt this historical line item. */
  variantId: number | null;
  productName: string;
  optionValue: string;
  sku: string;
  mrpPaise: Paise;
  unitPricePaise: Paise;
  qty: number;
  lineTotalPaise: Paise;
  imageStorageKey: string | null;
}

export interface Order {
  id: number;
  orderNumber: string;
  userId: number | null;
  email: string;
  phone: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  subtotalPaise: Paise;
  discountPaise: Paise;
  shippingPaise: Paise;
  totalPaise: Paise;
  couponCode: string | null;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  shippingAddress: OrderAddress;
  billingAddress: OrderAddress | null;
  shiprocketOrderId: string | null;
  awb: string | null;
  courier: string | null;
  trackingUrl: string | null;
  customerNote: string | null;
  staffNote: string | null;
  refundAmountPaise: Paise | null;
  refundNote: string | null;
  razorpayRefundId: string | null;
  refundedAt: Date | null;
  placedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  items: OrderItem[];
}
