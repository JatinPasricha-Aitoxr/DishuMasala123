import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ProductCarousel } from "@/components/product/ProductCarousel";
import { SectionHeading } from "@/components/sections/SectionHeading";
import { HOME_COPY } from "@/content/home";
import type { ProductCardData } from "@/types/catalog";

export interface MasalaBandProps {
  products: ProductCardData[];
}

/**
 * Spices' full-bleed editorial band — Masala's pillar counterpart to `BlueTeaBand` (CLAUDE.md §7.2,
 * amended 2026-09-10: Tea and Masala are co-equal pillars, not a single tea-first cascade, so the
 * "only full-bleed band on the page" no longer applies — see §5.4's matching amendment). Deliberately
 * mirrors `BlueTeaBand`'s exact layout (eyebrow/heading/body/CTA beside a carousel) rather than
 * inventing a different shape for it — visual parity between the two pillars is the whole point.
 *
 * No background of its own — rendered inside its own `ScrollColorBand` (app/page.tsx), chilli →
 * pepper. NOT turmeric: turmeric's white-text contrast is ~2.4:1, effectively the same accessibility
 * failure CLAUDE.md §5.6 already calls out for the citrus stop, so it's excluded as a scroll-band
 * stop here for the same reason (checked against all four spice tokens before picking — chilli
 * (~5.3:1) and pepper (~12.4:1) both clear 4.5:1 comfortably; coriander (~3.6:1) doesn't).
 *
 * Copy is the pre-existing, already-approved HOME_COPY.spices — nothing rewritten to manufacture a
 * tea-equivalent "trick" for spices. CLAUDE.md §8 bans inventing a claim as much as it bans
 * inventing a review; "Single-Origin. Double-Layer Packed." is what's actually true today. Masala
 * genuinely doesn't have a Lemon-Shift-equivalent sensory hook yet (a real one — the aroma when the
 * double-layer seal first opens, the stone-grinding process, per-spice single-origin traceability —
 * would close that gap for real, but that's new content the client needs to supply or confirm, not
 * something to fabricate here).
 */
export function MasalaBand({ products }: MasalaBandProps) {
  const copy = HOME_COPY.spices;

  return (
    <section aria-labelledby="masala-band-heading" className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 sm:py-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-16 lg:py-20">
      <div className="flex min-w-0 flex-col gap-5">
        {/* Same consolidation as BlueTeaBand (2026-09-17) — this was a second hand-rolled copy of
         * SectionHeading's markup, which is exactly how a shared type scale drifts. */}
        <SectionHeading
          id="masala-band-heading"
          tone="light"
          eyebrow={copy.eyebrow}
          heading={copy.heading}
          body={copy.body}
        />
        <div className="mt-2">
          <Button asChild variant="solid-surface" size="lg">
            <Link href={copy.ctaHref}>{copy.ctaLabel}</Link>
          </Button>
        </div>
      </div>

      <div className="min-w-0">
        <ProductCarousel products={products} label="Spices" />
      </div>
    </section>
  );
}
