import { NextResponse } from "next/server";
import { z } from "zod";
import { insertBulkEnquiry } from "@/lib/db/mutations/marketing";

/**
 * Submission target for components/gifting/BulkEnquiryForm.tsx (the corporate/bulk-gifting page's
 * lead-capture form, app/corporate-gifting/page.tsx). This is a pre-sales enquiry, not a checkout
 * — no price, cart or payment involved, so it's a plain Zod-validated route handler in the same
 * shape as app/api/marketing/phone-lead/route.ts, not lib/commerce/pricing.ts's server-trust
 * machinery (CLAUDE.md §7.5 is about order totals; there is no total here).
 */
const bodySchema = z.object({
  enquiryType: z.enum(["Gifting", "Corporate", "Festive", "Bulk", "Export"]),
  fullName: z.string().trim().min(1, "Enter your full name").max(200),
  company: z.string().trim().max(200).optional(),
  email: z.string().trim().email("Enter a valid email").max(320),
  phone: z.string().trim().min(6, "Enter a valid phone number").max(30),
  country: z.string().trim().min(1, "Enter your country").max(100),
  website: z.string().trim().max(300).optional(),
  requirement: z.string().trim().min(1, "Tell us a little about your requirement").max(4000),
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

  await insertBulkEnquiry({
    enquiryType: parsed.data.enquiryType,
    fullName: parsed.data.fullName,
    company: parsed.data.company || null,
    email: parsed.data.email,
    phone: parsed.data.phone,
    country: parsed.data.country,
    website: parsed.data.website || null,
    requirement: parsed.data.requirement,
    sourcePath: parsed.data.sourcePath || null,
  });

  return NextResponse.json({ ok: true });
}
