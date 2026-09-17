import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { upsertPhoneLead } from "@/lib/db/mutations/marketing";

/**
 * Submission target for components/marketing/PhoneCapturePopup.tsx. `consent` must be `true` —
 * the popup only ever sends it that way (the checkbox is unticked by default and the submit
 * button is disabled until it's checked), but this is re-validated here anyway rather than trusted
 * from the client, the same "never trust the client" discipline CLAUDE.md §7.5 applies to price.
 * Same 10-digit-mobile pattern lib/actions/profile.ts already uses, for one consistent definition
 * of "a valid Indian mobile number" across the app.
 */
const bodySchema = z.object({
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"),
  consent: z.literal(true),
  sourcePath: z.string().trim().min(1).max(500),
});

export async function POST(req: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const visitorId = (await cookies()).get("visitor_id")?.value ?? null;
  await upsertPhoneLead({ phone: parsed.data.phone, visitorId, sourcePath: parsed.data.sourcePath });

  return NextResponse.json({ ok: true });
}
