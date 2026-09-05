/**
 * Uploads the client-supplied Red Tea section banner (data/banners/Red Tea banner.png) to Supabase Storage and
 * saves `settings.red_tea_section_banner` — the banner rendered right after the homepage's Red Tea
 * section. Same "invent nothing" exception as scripts/migrate-homepage-banners.ts (see that file's
 * header and CLAUDE.md §8's 2026-08-28 note): the image carries the client's own marketing text
 * (including health-adjacent phrasing like "Aids Digestion") baked into the pixels, used as-is by
 * explicit client choice.
 *
 * Run with: pnpm migrate-red-tea-banner
 */
import { closeScriptDb } from "../lib/db/script-client";
import { migrateBannerSet, type BannerSource } from "./_lib/banner-migrate";

const BANNERS: BannerSource[] = [
  {
    slot: "red-tea-tradition",
    file: "Red Tea banner.png",
    alt: "A Cup of Tradition, Wellness in Every Sip — Dishu Premium Herbal Red Tea, 100% herbal, caffeine-free, real hibiscus and rose flowers",
    href: "/collections/red-tea",
  },
];

migrateBannerSet("red_tea_section_banner", BANNERS)
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeScriptDb();
  });
