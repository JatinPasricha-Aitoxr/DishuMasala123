import Image from "next/image";
import Link from "next/link";
import { ProductCarousel } from "@/components/product/ProductCarousel";
import { Placeholder } from "@/components/media/Placeholder";
import { Button } from "@/components/ui/Button";
import { SectionHeading } from "./SectionHeading";
import { HOME_COPY } from "@/content/home";
import type { ProductCardData } from "@/types/catalog";
import type { SectionImage } from "@/lib/db/queries/settings";

export interface RedTeaSectionProps {
  products: ProductCardData[];
  lifestyleImage: SectionImage | null;
}

/** Red Tea — CLAUDE.md §7.2's second priority slot. No background of its own — rendered inside a
 * shared `ScrollColorBand` wrapping both this and `BlueTeaBand` together (app/page.tsx), so the
 * pink → red colour shift is one continuous gradient canvas, not a second instance stitched at
 * the shared edge with `BlueTeaBand` (two independent instances produced a visible seam). White
 * text throughout (`SectionHeading`'s `tone="light"`) since the shared background is a saturated
 * colour, not ivory. The lifestyle photo is the client's real supplied image
 * (scripts/migrate-red-tea-lifestyle.ts) when migrated, falling back to the AI-placeholder slot
 * otherwise — same "degrade honestly" pattern as every other real asset in this project.
 *
 * The CTA (`solid-surface`, `size="lg"`) matches BlueTeaBand/MasalaBand's button pixel-for-pixel —
 * this was the one saturated section on the page missing one; `copy.ctaLabel`/`ctaHref` already
 * existed in HOME_COPY.redTea unused. Padding widened to match the other three saturated blocks
 * (design-review: saturated sections need more air than a cream one to read as deliberate). */
export function RedTeaSection({ products, lifestyleImage }: RedTeaSectionProps) {
  const copy = HOME_COPY.redTea;

  return (
    <section aria-labelledby="red-tea-heading" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:py-20">
      <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-16">
        {lifestyleImage ? (
          <div className="relative w-full overflow-hidden rounded-lg" style={{ aspectRatio: "4 / 5" }}>
            <Image src={lifestyleImage.url} alt={lifestyleImage.alt} fill sizes="(min-width: 1024px) 40vw, 100vw" className="object-cover" />
          </div>
        ) : (
          <Placeholder slot="red-tea-lifestyle" className="rounded-lg" />
        )}
        <div className="flex min-w-0 flex-col gap-6">
          <SectionHeading id="red-tea-heading" eyebrow={copy.eyebrow} heading={copy.heading} body={copy.body} tone="light" />
          <div>
            <Button asChild variant="solid-surface" size="lg">
              <Link href={copy.ctaHref}>{copy.ctaLabel}</Link>
            </Button>
          </div>
          <ProductCarousel products={products} label="Red Tea products" />
        </div>
      </div>
    </section>
  );
}
