import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { Placeholder } from "@/components/media/Placeholder";
import { GIFTING_HERO } from "@/content/gifting";
import type { SectionImage } from "@/lib/db/queries/settings";

/**
 * Full-bleed hero for the corporate/bulk-gifting page (reference: bluetea.co.in/pages/b2b). Two
 * separate markups, not one responsive one, because the desktop and mobile treatments are
 * genuinely different layouts, not just resized versions of each other (brief: "on mobile, don't
 * rely on the dark area at narrow widths"):
 *
 *  - **Desktop (`lg:` and up)**: the real hamper flat-lay full-bleed, text sitting in the photo's
 *    own naturally dark/empty left third under a left-to-right dark gradient overlay (ink →
 *    transparent) for legibility — the overlay never reaches past the image's midpoint, so the
 *    products on the right stay uncovered.
 *  - **Mobile/tablet**: a separate, portrait-cropped photo (`heroImageMobile` — the client's own
 *    mobile-specific shot, not the desktop image resized) at its natural aspect ratio (no text
 *    over it, since a narrow crop has no reliable dark area), then the heading/CTA on a solid
 *    `--color-brew-1` band below it — the same deep indigo/blue the homepage's colour journey
 *    already uses for Blue Tea, reused here as the brand accent for this page's hero rather than
 *    introduced fresh. Falls back to the desktop `heroImage` (then the placeholder) if the mobile
 *    one hasn't been uploaded yet.
 */
export function GiftingHero({
  heroImage,
  heroImageMobile,
}: {
  heroImage: SectionImage | null;
  heroImageMobile: SectionImage | null;
}) {
  const copy = GIFTING_HERO;
  const mobileImage = heroImageMobile ?? heroImage;

  return (
    <section aria-label="Corporate and bulk gifting" className="relative w-full">
      {/* Desktop: full-bleed image, text over the photo's own dark left side. */}
      <div className="relative hidden min-h-[560px] w-full overflow-hidden lg:block lg:min-h-[640px]">
        {heroImage ? (
          <Image
            src={heroImage.url}
            alt={heroImage.alt}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        ) : (
          <Placeholder slot="corporate-gifting-hero" className="absolute inset-0 h-full w-full rounded-none" />
        )}
        {/* Left-to-right dark overlay, capped well before the image's midpoint so the products on
            the right stay fully visible. */}
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{ backgroundImage: "linear-gradient(90deg, rgb(0 0 0 / .72) 0%, rgb(0 0 0 / .45) 32%, transparent 58%)" }}
        />
        <div className="relative mx-auto flex h-full max-w-7xl items-center px-6 lg:px-8" style={{ minHeight: "inherit" }}>
          <div className="max-w-md">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/85">{copy.eyebrow}</p>
            <h1
              className="mt-4 font-display font-semibold text-white"
              style={{ fontSize: "clamp(2rem, 3.2vw, 3.25rem)", letterSpacing: "-0.02em", lineHeight: 1.08 }}
            >
              {copy.heading}
            </h1>
            <p className="mt-4 max-w-sm text-base leading-relaxed text-white/90">{copy.subhead}</p>
            <div className="mt-8">
              <Button asChild variant="solid-surface" size="lg">
                <a href="#bulk-enquiry-form">{copy.ctaLabel}</a>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile/tablet: image on top, copy on a solid brew-1 band below — no reliance on a dark
          area that doesn't reliably exist in a narrow crop. */}
      <div className="lg:hidden">
        <div className="relative w-full" style={{ aspectRatio: mobileImage ? "9 / 16" : "4 / 3", maxHeight: "70vh" }}>
          {mobileImage ? (
            <Image src={mobileImage.url} alt={mobileImage.alt} fill sizes="100vw" className="object-cover" priority />
          ) : (
            <Placeholder slot="corporate-gifting-hero" className="absolute inset-0 h-full w-full rounded-none" />
          )}
        </div>
        <div className="bg-brew-1 px-6 py-10 text-center sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/85">{copy.eyebrow}</p>
          <h1
            className="mt-3 font-display font-semibold text-white"
            style={{ fontSize: "clamp(1.75rem, 6vw, 2.5rem)", letterSpacing: "-0.02em", lineHeight: 1.1 }}
          >
            {copy.heading}
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-white/90">{copy.subhead}</p>
          <div className="mt-6">
            <Button asChild variant="solid-surface" size="lg">
              <a href="#bulk-enquiry-form">{copy.ctaLabel}</a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
