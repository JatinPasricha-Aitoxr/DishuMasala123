/**
 * Uploads the client-supplied corporate-gifting page images to Supabase Storage and saves them to
 * settings — the mobile-specific hero photo (`corporate_gifting_hero_mobile_image`, a different,
 * portrait-cropped shot from the desktop hero, not a resize of it) and the four real gift-pack
 * card photos (`gift_pack_images`, keyed by content/gifting.ts's `GIFT_PACKS[].slug`), replacing
 * the per-product packshot each pack card used to stand in on. Same pattern as
 * scripts/migrate-corporate-gifting-hero.ts / migrate-red-tea-lifestyle.ts.
 *
 * Run with: npx tsx --env-file-if-exists=.env scripts/migrate-gifting-images.ts
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildKey, putObject } from "../lib/storage/storage-core";
import { processImage } from "../lib/storage/images";
import { closeScriptDb, scriptDb } from "../lib/db/script-client";
import { settings } from "../lib/db/schema";

interface SectionImageValue {
  storageKey: string;
  width: number;
  height: number;
  alt: string;
}

async function upload(sectionSlug: string, file: string): Promise<SectionImageValue> {
  const buffer = readFileSync(join(process.cwd(), "data/products/gifting", file));
  const processed = await processImage(buffer);
  const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 16);

  let canonicalKey: string | null = null;
  let canonicalWidth = 0;
  let canonicalHeight = 0;

  for (const derivative of processed.derivatives) {
    const key = buildKey("sections", sectionSlug, hash, derivative.format, `w${derivative.width}`);
    await putObject(key, derivative.buffer, `image/${derivative.format}`);
    if (derivative.format === "webp" && derivative.width >= canonicalWidth) {
      canonicalKey = key;
      canonicalWidth = derivative.width;
      canonicalHeight = derivative.height;
    }
  }

  if (!canonicalKey) throw new Error(`no webp derivative produced for ${file}`);
  console.log(`[uploaded] ${sectionSlug}: ${file} -> ${canonicalKey} (${canonicalWidth}x${canonicalHeight})`);
  return { storageKey: canonicalKey, width: canonicalWidth, height: canonicalHeight, alt: "" };
}

async function main(): Promise<void> {
  // Mobile hero — a distinct portrait shot, not a resize of the desktop landscape hero.
  const mobileHero = await upload("corporate-gifting-hero-mobile", "corporate-gifting-hero-mobile.png");
  mobileHero.alt =
    "Dishu Masala corporate gifting hamper, mobile crop — Chai with Dishu Premium Herbal Blue Tea " +
    "and Red Tea, spice pouches, brewed blue and red tea in glass cups, gift box with gold ribbon";
  await scriptDb
    .insert(settings)
    .values({ key: "corporate_gifting_hero_mobile_image", value: mobileHero })
    .onConflictDoUpdate({ target: settings.key, set: { value: mobileHero } });
  console.log("settings.corporate_gifting_hero_mobile_image upserted.");

  // Gift-pack card photos, keyed by content/gifting.ts's GIFT_PACKS[].slug.
  const packs: { slug: string; file: string; alt: string }[] = [
    {
      slug: "festive-tea-masala-hamper",
      file: "festive-tea-masala-hamper.png",
      alt: "Festive Tea + Masala Hamper — Dishu Masala gift box with Chai with Dishu Blue Tea and Red Tea plus Turmeric, Coriander, Black Pepper, Red Chilli and Garam Masala powders",
    },
    {
      slug: "corporate-wellness-set",
      file: "corporate-wellness-set.png",
      alt: "Corporate Wellness Set — Dishu Masala gift box for teams, with Blue Tea and Red Tea and a set of masala powders",
    },
    {
      slug: "premium-spice-gift-box",
      file: "premium-spice-gift-box.png",
      alt: "Premium Spice Gift Box — Dishu Masala gift box with Turmeric, Red Chilli, Coriander, Black Pepper and Garam Masala powders",
    },
    {
      slug: "blue-red-duo",
      file: "blue-red-duo.png",
      alt: "Blue + Red Duo — Chai with Dishu Premium Herbal Blue Tea and Red Tea, festive gift sleeve, brewed blue and red tea in glass cups",
    },
  ];

  const giftPackImages: Record<string, SectionImageValue> = {};
  for (const pack of packs) {
    giftPackImages[pack.slug] = { ...(await upload(`gift-pack-${pack.slug}`, pack.file)), alt: pack.alt };
  }

  await scriptDb
    .insert(settings)
    .values({ key: "gift_pack_images", value: giftPackImages })
    .onConflictDoUpdate({ target: settings.key, set: { value: giftPackImages } });
  console.log("settings.gift_pack_images upserted.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeScriptDb();
  });
