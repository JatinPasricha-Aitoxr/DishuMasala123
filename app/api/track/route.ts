import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { recordVisitorEvent } from "@/lib/db/mutations/marketing";

/**
 * Fired once per client-side navigation by components/providers/VisitorTracker.tsx. The visitor
 * id is read off the httpOnly cookie middleware.ts already set — never accepted from the request
 * body, so nothing here lets a client claim to be a different visitor than the one it actually is.
 * No auth/session check: this is deliberately anonymous, the same way the cookie itself is.
 */
const bodySchema = z.object({
  eventType: z.enum(["page_view", "product_view"]),
  path: z.string().trim().min(1).max(500),
});

export async function POST(req: Request): Promise<NextResponse> {
  const visitorId = (await cookies()).get("visitor_id")?.value;
  if (!visitorId) return NextResponse.json({ ok: true }, { status: 204 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid input." }, { status: 400 });

  await recordVisitorEvent({ visitorId, eventType: parsed.data.eventType, path: parsed.data.path });
  return new NextResponse(null, { status: 204 });
}
