import { NextResponse } from "next/server";
import { z } from "zod";
import { insertContactMessage } from "@/lib/db/mutations/marketing";

/**
 * Submission target for components/contact/ContactForm.tsx (app/contact/page.tsx). Same shape as
 * app/api/marketing/bulk-enquiry/route.ts and app/api/marketing/phone-lead/route.ts — a plain
 * Zod-validated public lead endpoint, not a Server Action, since this is a "customer has a
 * question" message with no price/stock to re-verify server-side.
 */
const bodySchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(200),
  email: z.string().trim().email("Enter a valid email").max(320),
  phone: z.string().trim().max(30).optional(),
  message: z.string().trim().min(1, "Enter a message").max(4000),
  sourcePath: z.string().trim().max(500).optional(),
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

  await insertContactMessage({
    name: parsed.data.name,
    email: parsed.data.email,
    phone: parsed.data.phone || null,
    message: parsed.data.message,
    sourcePath: parsed.data.sourcePath || null,
  });

  return NextResponse.json({ ok: true });
}
