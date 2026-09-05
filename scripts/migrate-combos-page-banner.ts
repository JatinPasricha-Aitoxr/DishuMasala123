/**
 * Uploads the client-supplied Combos collection-page hero banner (data/banners/combo banner 1.png,
 * plus a portrait crop for mobile) to Supabase Storage and saves `settings.combos_page_banner` — rendered at the
 * top of /collections/combos, above the existing collection header. Same "invent nothing"
 * exception as scripts/migrate-homepage-banners.ts (see that file's header and CLAUDE.md §8's
 * 2026-08-28 note) — the image carries the client's own marketing text baked into the pixels, used
 * as-is by explicit client choice.
 *
 * Run with: pnpm migrate-combos-page-banner
 */
import { closeScriptDb } from "../lib/db/script-client";
import { migrateBannerSet, type BannerSource } from "./_lib/banner-migrate";

const BANNERS: BannerSource[] = [
  {
    slot: "combos-page-hero",
    file: "combo banner 1.png",
    mobileFile: "M_combo banner .png",
    alt: "Dishu Masala Combo Packs — curated spice sets, better value",
    href: "/collections/combos",
  },
];

migrateBannerSet("combos_page_banner", BANNERS)
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeScriptDb();
  });
