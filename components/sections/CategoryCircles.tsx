import Image from "next/image";
import Link from "next/link";
import { Placeholder } from "@/components/media/Placeholder";
import { familyAccentVar, resolveCollectionAccent, type FamilyAccentToken } from "@/lib/family-accent";

export interface CategoryCircleItem {
  slug: string;
  title: string;
  href?: string;
  accent?: FamilyAccentToken;
  /**
   * The circle's photo. Preferably the dedicated client-supplied lifestyle shot
   * (`settings.category_circle_images`, written by scripts/migrate-category-circles.ts).
   *
   * Widened from `SectionImage` to "anything with a url" on 2026-09-17 so app/page.tsx can fall
   * back to the collection's own lead product thumbnail when no dedicated photo has been migrated
   * yet. A cropped packshot is not as good as a proper lifestyle shot — which is why the dedicated
   * photos exist and still win whenever they are present — but it is much better than the empty
   * grey disc every circle was rendering, and only `url` was ever read here anyway.
   */
  image: { url: string } | null;
}

export interface CategoryCirclesProps {
  items: readonly CategoryCircleItem[];
}

/**
 * Category circles grid at the top of the homepage:
 * Displays categories in a 2-row x 3-column grid:
 * Row 1: Blue Tea, Red Tea, Blue tea-Red Tea Combo
 * Row 2: Spices, Spices Combo, Black Tea
 *
 * Each circle carries a token-derived accent ring, lifestyle photo or placeholder,
 * and links to the relevant collection.
 */
export function CategoryCircles({ items }: CategoryCirclesProps) {
  if (items.length === 0) return null;

  return (
    <section aria-label="Shop by category" className="w-full bg-bg py-6 sm:py-8 md:py-10">
      <div className="mx-auto max-w-xl px-4 sm:max-w-2xl sm:px-6 md:max-w-5xl lg:max-w-6xl">
        <div className="grid grid-cols-3 gap-x-2 gap-y-6 sm:gap-x-6 sm:gap-y-8 md:grid-cols-6 md:gap-x-4 lg:gap-x-6">
          {items.map((item) => {
            const accent = familyAccentVar(item.accent ?? resolveCollectionAccent(item.slug));
            const targetHref = item.href ?? `/collections/${item.slug}/`;
            return (
              <Link
                key={`${item.slug}-${item.title}`}
                href={targetHref}
                className="group flex flex-col items-center gap-2 text-center"
              >
                <span
                  aria-hidden="true"
                  className="relative flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface shadow-card transition-transform duration-[200ms] ease-[cubic-bezier(.2,.6,.2,1)] group-hover:-translate-y-1 sm:size-32 md:size-32 lg:size-36"
                  style={{ boxShadow: `0 0 0 2px ${accent}, var(--shadow-card)` }}
                >
                  {item.image ? (
                    <Image
                      src={item.image.url}
                      alt=""
                      fill
                      /* Must track the size-* classes on the wrapper below, which grew on
                       * 2026-09-17 (96/112/128 -> 112/128/144). A stale `sizes` makes the browser
                       * pick a derivative narrower than the box it has to fill, which renders
                       * visibly soft on exactly the screens the client is looking at. */
                      sizes="(min-width: 1024px) 144px, (min-width: 640px) 128px, 112px"
                      className="object-cover"
                    />
                  ) : (
                    <Placeholder slot="product-packshot-generic" className="h-full w-full rounded-full" />
                  )}
                </span>
                <span className="w-full max-w-[118px] text-xs font-semibold leading-tight text-ink sm:max-w-[140px] sm:text-sm">
                  {item.title}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
