import Image from "next/image";
import Link from "next/link";
import { getCollectionsWithStats } from "@/lib/db/queries/collections";
import { getGstin, getSiteBranding, getStoreAddress } from "@/lib/db/queries/settings";
import { NewsletterFormLazy } from "./NewsletterFormLazy";

const POLICY_LINKS = [
  { href: "/privacy/", label: "Privacy Policy" },
  { href: "/terms/", label: "Terms of Service" },
  { href: "/refund-policy/", label: "Refund Policy" },
  { href: "/shipping-policy/", label: "Shipping Policy" },
];

// No real handle exists for any of these yet (nothing in CLAUDE.md/PRD names one) — rendered as
// inert UI slots rather than invented profile URLs, per CLAUDE.md §8's "invent nothing" rule.
const SOCIAL_SLOTS = [
  {
    label: "Instagram",
    path: "M12 2.5c2.7 0 3 0 4.1.06 1.1.05 1.8.22 2.4.46.7.27 1.2.6 1.7 1.1.5.5.9 1 1.1 1.7.24.6.4 1.3.46 2.4.06 1.1.06 1.4.06 4.1s0 3-.06 4.1c-.05 1.1-.22 1.8-.46 2.4a4.6 4.6 0 0 1-1.1 1.7c-.5.5-1 .9-1.7 1.1-.6.24-1.3.4-2.4.46-1.1.06-1.4.06-4.1.06s-3 0-4.1-.06c-1.1-.05-1.8-.22-2.4-.46a4.6 4.6 0 0 1-1.7-1.1 4.6 4.6 0 0 1-1.1-1.7c-.24-.6-.4-1.3-.46-2.4C2.5 15 2.5 14.7 2.5 12s0-3 .06-4.1c.05-1.1.22-1.8.46-2.4.27-.7.6-1.2 1.1-1.7.5-.5 1-.9 1.7-1.1.6-.24 1.3-.4 2.4-.46C9 2.5 9.3 2.5 12 2.5Zm0 2c-2.66 0-2.97 0-4.02.06-.9.04-1.4.18-1.7.3-.44.17-.75.37-1.08.7-.33.33-.53.64-.7 1.08-.12.32-.26.8-.3 1.7C4.14 9.03 4.14 9.34 4.14 12s0 2.97.06 4.02c.04.9.18 1.4.3 1.7.17.44.37.75.7 1.08.33.33.64.53 1.08.7.32.12.8.26 1.7.3 1.05.06 1.36.06 4.02.06s2.97 0 4.02-.06c.9-.04 1.4-.18 1.7-.3.44-.17.75-.37 1.08-.7.33-.33.53-.64.7-1.08.12-.32.26-.8.3-1.7.06-1.05.06-1.36.06-4.02s0-2.97-.06-4.02c-.04-.9-.18-1.4-.3-1.7a2.7 2.7 0 0 0-.7-1.08 2.7 2.7 0 0 0-1.08-.7c-.32-.12-.8-.26-1.7-.3C14.97 4.5 14.66 4.5 12 4.5Zm0 3.4a4.1 4.1 0 1 1 0 8.2 4.1 4.1 0 0 1 0-8.2Zm0 2a2.1 2.1 0 1 0 0 4.2 2.1 2.1 0 0 0 0-4.2Zm4.3-3.6a.98.98 0 1 1 0 1.96.98.98 0 0 1 0-1.96Z",
  },
  {
    label: "Facebook",
    path: "M13.6 21.5v-8.1h2.7l.4-3.2h-3.1V8.2c0-.9.25-1.5 1.55-1.5h1.65V3.9C15.9 3.8 15 3.75 14 3.75c-2.2 0-3.7 1.35-3.7 3.83v2.62H7.6v3.2h2.7v8.1h3.3Z",
  },
  {
    label: "YouTube",
    path: "M21.6 8.3a2.9 2.9 0 0 0-2-2C17.9 6 12 6 12 6s-5.9 0-7.6.3a2.9 2.9 0 0 0-2 2A30 30 0 0 0 2 12a30 30 0 0 0 .4 3.7 2.9 2.9 0 0 0 2 2C6.1 18 12 18 12 18s5.9 0 7.6-.3a2.9 2.9 0 0 0 2-2A30 30 0 0 0 22 12a30 30 0 0 0-.4-3.7ZM10 15V9l5.2 3-5.2 3Z",
  },
];

const PAYMENT_BADGES = ["Razorpay", "UPI", "Cards", "Netbanking"];

function formatAddressLine(city: string, state: string): string {
  return `${city}, ${state}`;
}

export async function Footer() {
  const [collections, storeAddress, gstin, branding] = await Promise.all([
    getCollectionsWithStats(),
    getStoreAddress(),
    getGstin(),
    getSiteBranding(),
  ]);

  return (
    <footer className="mt-16 bg-surface-2">
      {/* A single 1px gold hairline, not the full lemon-shift gradient (design-review call: the
       * gradient already lands as the homepage's full-bleed section journey — repeating it as a
       * footer bar read as a leftover rainbow rather than a deliberate accent, and diluted the
       * "one showpiece, then a restrained accent system" discipline). The hairline is the
       * CLAUDE.md §5.2 --color-gold token, the same "premium hairline" device used elsewhere. */}
      <div aria-hidden="true" className="h-px w-full bg-gold/60" />

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
        <div className="flex flex-col items-start gap-4">
          {branding.logo ? (
            <Image
              src={branding.logo.url}
              alt={branding.logo.alt}
              width={Math.round((branding.logo.width / branding.logo.height) * 28)}
              height={28}
              className="h-7 w-auto object-contain"
            />
          ) : (
            <p className="font-display text-lg font-semibold text-ink">Dishu Masala</p>
          )}
          {storeAddress ? (
            <address className="not-italic text-sm leading-relaxed text-ink-2">
              {storeAddress.businessName}
              <br />
              {formatAddressLine(storeAddress.city, storeAddress.state)}
              <br />
              <a href={`tel:${storeAddress.phone.replace(/\s+/g, "")}`} className="hover:text-ink">
                {storeAddress.phone}
              </a>
              <br />
              <a href={`mailto:${storeAddress.email}`} className="hover:text-ink">
                {storeAddress.email}
              </a>
            </address>
          ) : (
            <p className="text-sm text-ink-2">Contact details unavailable.</p>
          )}
          <ul className="flex gap-2">
            {SOCIAL_SLOTS.map((s) => (
              <li key={s.label}>
                <span
                  aria-disabled="true"
                  title={`${s.label} — coming soon`}
                  className="flex size-9 items-center justify-center rounded-full border border-line text-ink-3"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="size-4" aria-hidden="true">
                    <path d={s.path} />
                  </svg>
                  <span className="sr-only">{s.label} — coming soon</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-ink-2">Shop</p>
          <ul className="flex flex-col gap-2">
            {collections.map((c) => (
              <li key={c.slug}>
                <Link href={`/collections/${c.slug}/`} className="text-sm text-ink-2 hover:text-ink">
                  {c.title}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/corporate-gifting/" className="text-sm text-ink-2 hover:text-ink">
                Corporate & Bulk Gifting
              </Link>
            </li>
            <li>
              <Link href="/contact/" className="text-sm text-ink-2 hover:text-ink">
                Contact Us
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-ink-2">Policies</p>
          <ul className="flex flex-col gap-2">
            {POLICY_LINKS.map((p) => (
              <li key={p.href}>
                <Link href={p.href} className="text-sm text-ink-2 hover:text-ink">
                  {p.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-6">
          <NewsletterFormLazy />
          <div>
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-ink-2">
              Payment options
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {PAYMENT_BADGES.map((b) => (
                <li
                  key={b}
                  className="rounded-sm border border-line bg-surface px-2 py-1 text-xs font-medium text-ink-2"
                >
                  {b}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-5 text-xs text-ink-2 sm:px-6">
          <p>
            All prices are inclusive of GST{gstin ? ` — GSTIN ${gstin}` : ""}.
          </p>
          <p>&copy; {new Date().getFullYear()} Dishu Food and Beverages. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
