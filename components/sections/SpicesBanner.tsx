import { PromoBannerSlider } from "@/components/hero/PromoBannerSlider";
import type { HomepageBanner } from "@/lib/db/queries/settings";

/**
 * Introduces the homepage's Masala pillar (client request, 2026-08-28; repositioned as the pillar's
 * lead-in by CLAUDE.md §7.2's 2026-09-10 amendment): a "Spices" heading, then the client-supplied
 * banner image (scripts/migrate-spices-banner.ts). Sits directly above `MasalaBand` (inside its own
 * `ScrollColorBand`), which carries the real product listing and its own heading — this component
 * is purely the intro/banner, not a second product section.
 *
 * The marquee separator that used to sit above the heading ("100% Organic · Stone Ground · Zero
 * Preservatives") was removed on the client's request — see the prior version of this file/CLAUDE.md
 * §8's 2026-08-28 log entry for that claim's history.
 */
export function SpicesBanner({ banner }: { banner: HomepageBanner[] }) {
  return (
    <div>
      <div className="mx-auto max-w-7xl px-4 pt-10 text-center sm:px-6">
        <h2
          className="font-display font-semibold text-ink"
          style={{ fontSize: "clamp(1.75rem, 3vw, 2.75rem)", letterSpacing: "-0.015em", lineHeight: 1.1 }}
        >
          Spices
        </h2>
      </div>
      <PromoBannerSlider banners={banner} ariaLabel="Spices" />
    </div>
  );
}
