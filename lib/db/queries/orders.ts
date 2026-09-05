import "server-only";

import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "../index";
import { orderItems, orders } from "../schema";
import { paise } from "@/lib/money";
import type { Order, OrderAddress } from "@/types/order";

function toOrder(row: typeof orders.$inferSelect, items: (typeof orderItems.$inferSelect)[]): Order {
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    userId: row.userId,
    email: row.email,
    phone: row.phone,
    status: row.status,
    paymentMethod: row.paymentMethod,
    paymentStatus: row.paymentStatus,
    subtotalPaise: paise(row.subtotalPaise),
    discountPaise: paise(row.discountPaise),
    shippingPaise: paise(row.shippingPaise),
    totalPaise: paise(row.totalPaise),
    couponCode: row.couponCode,
    razorpayOrderId: row.razorpayOrderId,
    razorpayPaymentId: row.razorpayPaymentId,
    shippingAddress: row.shippingAddress as OrderAddress,
    billingAddress: row.billingAddress as OrderAddress | null,
    shiprocketOrderId: row.shiprocketOrderId,
    awb: row.awb,
    courier: row.courier,
    trackingUrl: row.trackingUrl,
    customerNote: row.customerNote,
    staffNote: row.staffNote,
    refundAmountPaise: row.refundAmountPaise == null ? null : paise(row.refundAmountPaise),
    refundNote: row.refundNote,
    razorpayRefundId: row.razorpayRefundId,
    refundedAt: row.refundedAt,
    placedAt: row.placedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    items: items.map((i) => ({
      id: i.id,
      orderId: i.orderId,
      variantId: i.variantId,
      productName: i.productName,
      optionValue: i.optionValue,
      sku: i.sku,
      mrpPaise: paise(i.mrpPaise),
      unitPricePaise: paise(i.unitPricePaise),
      qty: i.qty,
      lineTotalPaise: paise(i.lineTotalPaise),
      imageStorageKey: i.imageStorageKey,
    })),
  };
}

async function loadOrderWithItems(orderId: number): Promise<Order | null> {
  const [row] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!row) return null;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId)).orderBy(asc(orderItems.id));
  return toOrder(row, items);
}

export async function getOrderByIdempotencyKey(idempotencyKey: string): Promise<Order | null> {
  const [row] = await db.select({ id: orders.id }).from(orders).where(eq(orders.idempotencyKey, idempotencyKey)).limit(1);
  if (!row) return null;
  return loadOrderWithItems(row.id);
}

export async function getOrderByOrderNumber(orderNumber: string): Promise<Order | null> {
  const [row] = await db.select({ id: orders.id }).from(orders).where(eq(orders.orderNumber, orderNumber)).limit(1);
  if (!row) return null;
  return loadOrderWithItems(row.id);
}

export async function getOrderByRazorpayOrderId(razorpayOrderId: string): Promise<Order | null> {
  const [row] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.razorpayOrderId, razorpayOrderId))
    .limit(1);
  if (!row) return null;
  return loadOrderWithItems(row.id);
}

export async function getOrderById(orderId: number): Promise<Order | null> {
  return loadOrderWithItems(orderId);
}

/**
 * Account order list — filtered by `userId` at the SQL level (PROMPTS.md Phase 6 item 3:
 * "assert userId in every query"), never fetched broadly and filtered in application code.
 */
export async function getOrdersForUser(userId: number): Promise<Order[]> {
  const rows = await db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.placedAt));
  if (rows.length === 0) return [];
  const items = await db
    .select()
    .from(orderItems)
    .where(inArray(orderItems.orderId, rows.map((r) => r.id)))
    .orderBy(asc(orderItems.id));
  return rows.map((row) => toOrder(row, items.filter((i) => i.orderId === row.id)));
}

/**
 * A single order detail, but ONLY when it belongs to `userId` — the WHERE clause checks
 * `orders.user_id = userId` in the same query as `orders.order_number = orderNumber`, never
 * `orderNumber` alone with an application-level ownership check bolted on after (PROMPTS.md
 * Phase 6 item 3: "must NEVER trust an id embedded in a URL as sufficient authorization"). A
 * nonexistent order number and someone else's real order are indistinguishable here — both
 * return null — so the caller (app/account/orders/[orderNumber]/page.tsx) 404s identically for
 * both, giving no signal about which order numbers are real (same no-enumeration discipline as
 * the guest order-token flow).
 */
export async function getOrderForUserByOrderNumber(orderNumber: string, userId: number): Promise<Order | null> {
  const [row] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.orderNumber, orderNumber), eq(orders.userId, userId)))
    .limit(1);
  if (!row) return null;
  return loadOrderWithItems(row.id);
}
