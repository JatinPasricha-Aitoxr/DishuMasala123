import "server-only";

/**
 * The signed link that makes `/order/[orderNumber]` safely guest-accessible (PROMPTS.md Phase 5
 * item 11). There's no auth yet (Phase 6), so an order number alone must never be enough to view
 * an order — that would let anyone enumerate `DM-2026-00001`, `DM-2026-00002`, ... and read other
 * customers' orders. Instead the confirmation email links to
 * `/order/<orderNumber>?email=<email>&token=<hmac>`, where `token` is
 * HMAC-SHA256(`${orderNumber}|${email}`, ORDER_LINK_SECRET) — unguessable without the secret, and the
 * page (app/order/[orderNumber]/page.tsx) verifies it with a timing-safe compare before rendering
 * anything.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

function getSecret(): string {
  const secret = process.env.ORDER_LINK_SECRET;
  if (!secret) throw new Error("ORDER_LINK_SECRET is not set — required to sign/verify order links.");
  return secret;
}

export function signOrderToken(orderNumber: string, email: string): string {
  return createHmac("sha256", getSecret())
    .update(`${orderNumber}|${email.toLowerCase()}`)
    .digest("hex");
}

export function verifyOrderToken(orderNumber: string, email: string, token: string | null | undefined): boolean {
  if (!token) return false;
  const expected = signOrderToken(orderNumber, email);
  let expectedBuf: Buffer;
  let givenBuf: Buffer;
  try {
    expectedBuf = Buffer.from(expected, "hex");
    givenBuf = Buffer.from(token, "hex");
  } catch {
    return false;
  }
  if (expectedBuf.length !== givenBuf.length) return false;
  return timingSafeEqual(expectedBuf, givenBuf);
}

/** Builds the full confirmation-email link for one order. */
export function buildOrderConfirmationUrl(siteUrl: string, orderNumber: string, email: string): string {
  const token = signOrderToken(orderNumber, email);
  const url = new URL(`/order/${encodeURIComponent(orderNumber)}`, siteUrl);
  url.searchParams.set("email", email);
  url.searchParams.set("token", token);
  return url.toString();
}
