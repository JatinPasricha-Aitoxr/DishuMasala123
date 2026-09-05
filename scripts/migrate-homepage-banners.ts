/**
 * Uploads the client-supplied homepage promotional banners (data/banners/*.png — provided
 * directly by the client, not scraped from the old site) to Supabase Storage and saves
 * `settings.homepage_banners`, an ordered list the homepage slider reads.
 *
 * IMPORTANT — deliberate, explicit exception to CLAUDE.md §8 ("invent nothing" / no health
 * claims): these banners carry the client's own marketing text baked directly into the image
 * pixels, including phrasing like "Belly Fat Reduction & Slimming" that would never be allowed in
 * text content this project writes itself. Claude flagged this conflict directly to the client
 * stakeholder before building it; the client explicitly chose to use the banners as-is anyway
 * (2026-08-28 — see the matching note in CLAUDE.md §8). Do not "fix" this by stripping the
 * claims or reverting to a placeholder without checking with the client again.
 *
 * Run with: pnpm migrate-homepage-banners
 */
import { closeScriptDb } from "../lib/db/script-client";
import { migrateBannerSet, type BannerSource } from "./_lib/banner-migrate";

const BANNERS: BannerSource[] = [
  {
    slot: "blue-tea-chai",
    file: "hero banner.png",
    // Portrait crop for narrow viewports (client-supplied — the landscape desktop banner crops
    // away too much of the pack/copy on a phone-width screen otherwise).
    mobileFile: "M_Hero Banner.png",
    alt: "Blue by Nature, Better by Choice — Dishu Premium Herbal Blue Tea, 100% herbal, caffeine-free, zero sugar, enriched with Butterfly Pea Flower",
    href: "/collections/blue-tea",
  },
];

migrateBannerSet("homepage_banners", BANNERS)
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeScriptDb();
  });
