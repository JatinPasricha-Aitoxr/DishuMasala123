/**
 * Shared upload logic for the client-supplied banner scripts (migrate-homepage-banners.ts,
 * migrate-red-tea-banner.ts, and any future banner slot) — one real implementation instead of
 * copy-pasting the sharp/storage/content-hash pipeline per script.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildKey, putObject } from "../../lib/storage/storage-core";
import { processImage } from "../../lib/storage/images";
import { scriptDb } from "../../lib/db/script-client";
import { settings } from "../../lib/db/schema";

export interface BannerSource {
  slot: string;
  file: string;
  alt: string;
  href: string;
  /** An optional separate crop/photo for narrow viewports (e.g. a portrait 4:5 image instead of
   * the desktop's wide landscape one) — uploaded under the same slot with its own content hash. */
  mobileFile?: string;
}

export interface MigratedBannerImage {
  storageKey: string;
  width: number;
  height: number;
}

export interface MigratedBanner extends MigratedBannerImage {
  slot: string;
  alt: string;
  href: string;
  mobile?: MigratedBannerImage;
}

async function uploadOne(file: string, slot: string): Promise<MigratedBannerImage> {
  const buffer = readFileSync(join(process.cwd(), "data/banners", file));
  const processed = await processImage(buffer);
  // Content hash (not a fixed "current" slug) so swapping a banner's source image gives every
  // derivative a brand-new key/URL — otherwise the browser and Next's own image-optimizer cache
  // keep serving the previous picture forever under the unchanged URL (a real bug hit and fixed
  // on the homepage banner before this shared helper existed).
  const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 16);

  let canonicalKey: string | null = null;
  let canonicalWidth = 0;
  let canonicalHeight = 0;

  for (const derivative of processed.derivatives) {
    const key = buildKey("banners", slot, hash, derivative.format, `w${derivative.width}`);
    await putObject(key, derivative.buffer, `image/${derivative.format}`);
    if (derivative.format === "webp" && derivative.width >= canonicalWidth) {
      canonicalKey = key;
      canonicalWidth = derivative.width;
      canonicalHeight = derivative.height;
    }
  }

  if (!canonicalKey) throw new Error(`${slot} (${file}): no webp derivative produced`);
  console.log(`[uploaded] ${slot}: ${file} -> ${canonicalKey} (${canonicalWidth}x${canonicalHeight})`);
  return { storageKey: canonicalKey, width: canonicalWidth, height: canonicalHeight };
}

async function migrateOne(banner: BannerSource): Promise<MigratedBanner> {
  const [main, mobile] = await Promise.all([
    uploadOne(banner.file, banner.slot),
    banner.mobileFile ? uploadOne(banner.mobileFile, `${banner.slot}-mobile`) : Promise.resolve(undefined),
  ]);

  return { ...main, slot: banner.slot, alt: banner.alt, href: banner.href, mobile };
}

/** Uploads every banner in `sources`, then upserts the result array under `settingsKey`. */
export async function migrateBannerSet(settingsKey: string, sources: BannerSource[]): Promise<MigratedBanner[]> {
  const uploaded = await Promise.all(sources.map(migrateOne));

  await scriptDb
    .insert(settings)
    .values({ key: settingsKey, value: uploaded })
    .onConflictDoUpdate({ target: settings.key, set: { value: uploaded } });

  console.log(`settings.${settingsKey} upserted (${uploaded.length} banner${uploaded.length === 1 ? "" : "s"}).`);
  return uploaded;
}
