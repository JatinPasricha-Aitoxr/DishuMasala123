/**
 * Uploads the client-supplied Spices section banner (data/banners/spices banner.png, plus a
 * portrait crop for mobile) to Supabase Storage and saves `settings.spices_section_banner`. Same "invent
 * nothing" exception as scripts/migrate-homepage-banners.ts (see that file's header and
 * CLAUDE.md §8's 2026-08-28 note) — the image carries the client's own marketing text baked into
 * the pixels, used as-is by explicit client choice.
 *
 * Run with: pnpm migrate-spices-banner
 */
import { closeScriptDb } from "../lib/db/script-client";
import { migrateBannerSet, type BannerSource } from "./_lib/banner-migrate";

const BANNERS: BannerSource[] = [
  {
    slot: "spices-pure-goodness",
    file: "spices banner.png",
    mobileFile: "M_spices Banner.png",
    alt: "Pure Spices, Real Goodness — Dishu Masala coriander, black pepper, turmeric, red chilli and garam masala powder, 100% natural, hygienically packed",
    href: "/collections/spices",
  },
];

migrateBannerSet("spices_section_banner", BANNERS)
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeScriptDb();
  });
