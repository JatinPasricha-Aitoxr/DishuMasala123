/**
 * Uploads the client-supplied Classic & Assam section banner (data/banners/classic tea banner.png,
 * plus a portrait crop for mobile) to Supabase Storage and saves `settings.classic_tea_section_banner`. Same
 * "invent nothing" exception as scripts/migrate-homepage-banners.ts (see that file's header and
 * CLAUDE.md §8's 2026-08-28 note) — the image carries the client's own marketing text baked into
 * the pixels, used as-is by explicit client choice.
 *
 * Run with: pnpm migrate-classic-tea-banner
 */
import { closeScriptDb } from "../lib/db/script-client";
import { migrateBannerSet, type BannerSource } from "./_lib/banner-migrate";

const BANNERS: BannerSource[] = [
  {
    slot: "classic-tea-everyday",
    file: "classic tea banner.png",
    mobileFile: "M_classic tea banner.png",
    alt: "Dishu Classic Tea and Premium Assam Tea — bold, malty loose-leaf black tea",
    href: "/collections/classic-teas",
  },
];

migrateBannerSet("classic_tea_section_banner", BANNERS)
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeScriptDb();
  });
