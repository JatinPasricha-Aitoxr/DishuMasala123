import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ProductCarousel } from "@/components/product/ProductCarousel";
import { SectionHeading } from "@/components/sections/SectionHeading";
import { HOME_COPY } from "@/content/home";
import type { ProductCardData } from "@/types/catalog";

export interface BlueTeaBandProps {
  products: ProductCardData[];
}

/**
 * The Blue Tea full-bleed editorial band — CLAUDE.md §5.4's "the ONLY full-bleed band on the page."
 * No background of its own — it's rendered inside a shared `ScrollColorBand` wrapping both this
 * and `RedTeaSection` together (app/page.tsx), so the blue → pink → red colour shift (client
 * request reviving the "Lemon Shift" idea for this section instead of the removed hero) is one
 * continuous gradient canvas across both sections, not two separately-tracked ones stitched at
 * their shared edge — two independent instances produced a visible seam.
 *
 * Products render in `ProductCarousel` (client request), not a fixed grid — there are only 2 real
 * Blue Tea products today, but the carousel already scrolls/paginates correctly for however many
 * exist later, so this section doesn't need touching again as the catalogue grows.
 */
export function BlueTeaBand({ products }: BlueTeaBandProps) {
  const copy = HOME_COPY.blueTeaBand;

  return (
    <section aria-labelledby="blue-tea-heading" className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 sm:py-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-16 lg:py-20">
      <div className="flex min-w-0 flex-col gap-5">
        {/* Was a hand-rolled copy of SectionHeading's exact markup — same classes, same inline
         * clamp() — which meant the page's largest headings were the two not covered when that
         * component's type scale changes. Consolidated 2026-09-17. */}
        <SectionHeading
          id="blue-tea-heading"
          tone="light"
          eyebrow={copy.eyebrow}
          heading={copy.heading}
          body={[copy.bodyPrimary, copy.bodySecondary]}
        />
        <div className="mt-2">
          <Button asChild variant="solid-surface" size="lg">
            <Link href={copy.ctaHref}>{copy.ctaLabel}</Link>
          </Button>
        </div>
      </div>

      <div className="min-w-0">
        {/* ProductCarousel's default card width (~46% of the row) fits both real Blue Tea
            products on a narrow phone screen without needing to scroll — a carousel still kicks
            in correctly once a 3rd+ product exists. */}
        <ProductCarousel products={products} label="Blue Tea products" />
      </div>
    </section>
  );
}
