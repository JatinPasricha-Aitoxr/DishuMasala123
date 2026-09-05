/**
 * Uploads the client-supplied Red Tea collection-page hero banner (data/banners/Banner Red
 * Tea.png, plus a portrait crop for mobile) to Supabase Storage and saves `settings.red_tea_page_banner` —
 * rendered at the top of /collections/red-tea, above the existing collection header. Same
 * "invent nothing" exception as scripts/migrate-homepage-banners.ts (see that file's header and
 * CLAUDE.md §8's 2026-08-28 note) — the image carries the client's own marketing text baked into
 * the pixels, used as-is by explicit client choice.
 *
 * Run with: pnpm migrate-red-tea-page-banner
 */
import { closeScriptDb } from "../lib/db/script-client";
import { migrateBannerSet, type BannerSource } from "./_lib/banner-migrate";

const BANNERS: BannerSource[] = [
  {
    slot: "red-tea-page-hero",
    file: "Banner Red Tea.png",
    mobileFile: "M_banner Red tea.png",
    alt: "Dishu Masala Red Tea — hibiscus and rose herbal tea",
    href: "/collections/red-tea",
  },
];

migrateBannerSet("red_tea_page_banner", BANNERS)
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeScriptDb();
  });
