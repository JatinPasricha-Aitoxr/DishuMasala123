import { NextResponse } from "next/server";
import { z } from "zod";
import { computePricing } from "@/lib/commerce/pricing";
import { defaultPricingDeps } from "@/lib/commerce/pricing-deps";

/**
 * The cart's revalidation endpoint (PROMPTS.md Phase 5 item 4 / lib/store/cart.ts's "every
 * mutation revalidates against the server"). Zod-validated input, entirely server-computed prices
 * out via lib/commerce/pricing.ts — never trusts anything the client says a price or discount is
 * (CLAUDE.md §7.5). Also the endpoint the tampered-price E2E test targets to prove a manipulated
 * total is rejected in favour of the server's own recomputation.
 */
const requestSchema = z.object({
  lines: z
    .array(
      z.object({
        variantId: z.number().int().positive(),
        qty: z.number().int().positive().max(99),
        isGift: z.boolean().optional(),
      }),
    )
    .max(50),
  couponCode: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().email().max(200).optional().nullable(),
});

export async function POST(req: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: { code: "malformed_json", message: "Request body must be JSON." } }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: { code: "invalid_input", message: parsed.error.issues[0]?.message ?? "Invalid cart." } },
      { status: 400 },
    );
  }

  try {
    const pricing = await computePricing(
      { lines: parsed.data.lines, couponCode: parsed.data.couponCode, email: parsed.data.email },
      defaultPricingDeps,
    );
    return NextResponse.json({ ok: true, pricing });
  } catch (err) {
    console.error("[cart/validate] unhandled error", err);
    // Never a raw stack trace to the client (CLAUDE.md §12).
    return NextResponse.json(
      { ok: false, error: { code: "internal_error", message: "Could not price your cart right now. Please try again." } },
      { status: 500 },
    );
  }
}
