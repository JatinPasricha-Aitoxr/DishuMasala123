/**
 * Uploads the client-supplied Blue Tea collection-page hero banner (data/banners/banner blue
 * tea.png, plus a portrait crop for mobile) to Supabase Storage and saves `settings.blue_tea_page_banner` —
 * rendered at the top of /collections/blue-tea, above the existing collection header. Same
 * "invent nothing" exception as scripts/migrate-homepage-banners.ts (see that file's header and
 * CLAUDE.md §8's 2026-08-28 note) — the image carries the client's own marketing text baked into
 * the pixels, used as-is by explicit client choice.
 *
 * Run with: pnpm migrate-blue-tea-page-banner
 */
import { closeScriptDb } from "../lib/db/script-client";
import { migrateBannerSet, type BannerSource } from "./_lib/banner-migrate";

const BANNERS: BannerSource[] = [
  {
    slot: "blue-tea-page-hero",
    file: "banner blue tea.png",
    mobileFile: "M_Banner Blue tea.png",
    alt: "Dishu Masala Blue Tea — butterfly pea flower herbal tea",
    href: "/collections/blue-tea",
  },
];

migrateBannerSet("blue_tea_page_banner", BANNERS)
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeScriptDb();
  });
