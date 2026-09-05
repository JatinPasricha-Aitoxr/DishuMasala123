/**
 * Uploads the client-supplied Classic & Assam collection-page hero banner (data/banners/Classic
 * Banner.png, plus a portrait crop for mobile) to Supabase Storage and saves `settings.classic_teas_page_banner`
 * — rendered at the top of /collections/classic-teas, above the existing collection header. Same
 * "invent nothing" exception as scripts/migrate-homepage-banners.ts (see that file's header and
 * CLAUDE.md §8's 2026-08-28 note) — the image carries the client's own marketing text baked into
 * the pixels, used as-is by explicit client choice.
 *
 * Run with: pnpm migrate-classic-teas-page-banner
 */
import { closeScriptDb } from "../lib/db/script-client";
import { migrateBannerSet, type BannerSource } from "./_lib/banner-migrate";

const BANNERS: BannerSource[] = [
  {
    slot: "classic-teas-page-hero",
    file: "Classic Banner.png",
    mobileFile: "M_Banner Classic.png",
    alt: "Dishu Masala Classic & Assam Tea — bold, malty loose-leaf black tea",
    href: "/collections/classic-teas",
  },
];

migrateBannerSet("classic_teas_page_banner", BANNERS)
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeScriptDb();
  });
