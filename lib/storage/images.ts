// No "server-only" guard here: this is a pure sharp image-processing pipeline that touches no
// secrets or database, so — unlike lib/storage/storage.ts — there's nothing environment-sensitive to
// gate. It's imported both from the Next.js app and directly from scripts/migrate-images.ts.
import sharp from "sharp";

/** Widths we generate derivatives at. Never upscaled past the source image's real width. */
export const DERIVATIVE_WIDTHS = [400, 800, 1200] as const;
export type DerivativeFormat = "avif" | "webp";

export interface ImageDerivative {
  width: number;
  height: number;
  format: DerivativeFormat;
  buffer: Buffer;
}

export interface ProcessedImage {
  originalWidth: number;
  originalHeight: number;
  derivatives: ImageDerivative[];
}

/**
 * Sharp pipeline producing AVIF + WebP derivatives at DERIVATIVE_WIDTHS (CLAUDE.md §2 / §8).
 * Never upscales — a source narrower than a target width is only ever rendered at its own width,
 * and duplicate target widths (small source images) collapse to one derivative per format.
 */
export async function processImage(input: Buffer): Promise<ProcessedImage> {
  const metadata = await sharp(input, { failOn: "none" }).metadata();
  const originalWidth = metadata.width;
  const originalHeight = metadata.height;
  if (!originalWidth || !originalHeight) {
    throw new Error("processImage: could not read source image dimensions");
  }

  const targetWidths = [...new Set(DERIVATIVE_WIDTHS.map((w) => Math.min(w, originalWidth)))];
  const derivatives: ImageDerivative[] = [];

  for (const targetWidth of targetWidths) {
    for (const format of ["avif", "webp"] as const) {
      const pipeline = sharp(input, { failOn: "none" }).resize({
        width: targetWidth,
        withoutEnlargement: true,
      });
      const buffer =
        format === "avif"
          ? await pipeline.avif({ quality: 60 }).toBuffer()
          : await pipeline.webp({ quality: 75 }).toBuffer();
      const derivedMeta = await sharp(buffer).metadata();
      const height =
        derivedMeta.height ?? Math.round((originalHeight / originalWidth) * targetWidth);

      derivatives.push({ width: derivedMeta.width ?? targetWidth, height, format, buffer });
    }
  }

  return { originalWidth, originalHeight, derivatives };
}
