/**
 * Uploads the client-supplied Spices collection-page hero banner (data/banners/spices page
 * banner.png, plus a portrait crop for mobile) to Supabase Storage and saves
 * `settings.spices_page_banner` — rendered at the top of /collections/spices, above the existing
 * collection header. Same "invent nothing" exception as scripts/migrate-homepage-banners.ts (see
 * that file's header and CLAUDE.md §8's 2026-08-28 note) — the image carries the client's own
 * marketing text ("Pure Spices. Healthier You.") baked into the pixels, used as-is by explicit
 * client choice.
 *
 * Run with: pnpm migrate-spices-page-banner
 */
import { closeScriptDb } from "../lib/db/script-client";
import { migrateBannerSet, type BannerSource } from "./_lib/banner-migrate";

const BANNERS: BannerSource[] = [
  {
    slot: "spices-page-hero",
    file: "spices page banner.png",
    mobileFile: "M_spices page banner.png",
    alt: "Dishu Masala Spices — pure, single-origin spices, double-layer packed",
    href: "/collections/spices",
  },
];

migrateBannerSet("spices_page_banner", BANNERS)
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeScriptDb();
  });
