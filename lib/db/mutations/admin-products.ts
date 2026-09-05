import "server-only";

/**
 * Admin catalogue writes (PROMPTS.md Phase 8 item 1). Called only from
 * app/admin/products/actions.ts, which does Zod validation, the `requireStaffOrAdmin()` re-check,
 * `writeAuditLog`, and `revalidateTag`/`revalidatePath` — this file is the DB-transaction layer,
 * same split as lib/db/mutations/admin-orders.ts.
 */
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "../index";
import { productImages, products, variants } from "../schema";
import { createHash, randomUUID } from "node:crypto";
import { buildKey, deleteObject, getObject, putObject, presignUpload } from "@/lib/storage/storage";
import { processImage } from "@/lib/storage/images";
import { isSlugTaken, countProductImageReferencesToKey } from "../queries/admin-products";

export interface VariantInput {
  id?: number;
  sku: string;
  optionValue: string;
  mrpPaise: number;
  pricePaise: number;
  weightGrams: number | null;
  inStock: boolean;
  stockQty: number | null;
  position: number;
}

export interface ProductInput {
  slug: string;
  name: string;
  collectionId: number;
  shortDescription: string | null;
  description: string | null;
  ingredients: string | null;
  brewGuide: string | null;
  tags: string[];
  optionLabel: string;
  priority: number;
  seoTitle: string | null;
  seoDescription: string | null;
  variants: VariantInput[];
}

/** Creates a product with its variants in one transaction. Status always starts as "draft" —
 * publishing is a separate, validated action (see publishProductDb below). */
export async function createProductDb(input: ProductInput): Promise<number> {
  return db.transaction(async (tx) => {
    const [product] = await tx
      .insert(products)
      .values({
        slug: input.slug,
        name: input.name,
        collectionId: input.collectionId,
        shortDescription: input.shortDescription,
        description: input.description,
        ingredients: input.ingredients,
        brewGuide: input.brewGuide,
        tags: input.tags,
        optionLabel: input.optionLabel,
        priority: input.priority,
        status: "draft",
        seoTitle: input.seoTitle,
        seoDescription: input.seoDescription,
      })
      .returning({ id: products.id });

    if (input.variants.length > 0) {
      await tx.insert(variants).values(
        input.variants.map((v, i) => ({
          productId: product.id,
          sku: v.sku,
          optionValue: v.optionValue,
          mrpPaise: v.mrpPaise,
          pricePaise: v.pricePaise,
          weightGrams: v.weightGrams,
          inStock: v.inStock,
          stockQty: v.stockQty,
          position: v.position ?? i,
        })),
      );
    }
    return product.id;
  });
}

/** Updates a product's fields and replaces its variant set (add/update/delete/reorder) in one
 * transaction. Images are managed by separate, dedicated actions (finalize/delete/reorder/setPrimary
 * below) since they involve storage side effects that don't belong inside this DB transaction. */
export async function updateProductDb(id: number, input: ProductInput): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(products)
      .set({
        slug: input.slug,
        name: input.name,
        collectionId: input.collectionId,
        shortDescription: input.shortDescription,
        description: input.description,
        ingredients: input.ingredients,
        brewGuide: input.brewGuide,
        tags: input.tags,
        optionLabel: input.optionLabel,
        priority: input.priority,
        seoTitle: input.seoTitle,
        seoDescription: input.seoDescription,
        updatedAt: new Date(),
      })
      .where(eq(products.id, id));

    const existing = await tx.select({ id: variants.id }).from(variants).where(eq(variants.productId, id));
    const existingIds = new Set(existing.map((v) => v.id));
    const keptIds = new Set(input.variants.filter((v) => v.id != null).map((v) => v.id!));
    const toDelete = [...existingIds].filter((vid) => !keptIds.has(vid));
    if (toDelete.length > 0) {
      await tx.delete(variants).where(inArray(variants.id, toDelete));
    }

    for (const [i, v] of input.variants.entries()) {
      const values = {
        sku: v.sku,
        optionValue: v.optionValue,
        mrpPaise: v.mrpPaise,
        pricePaise: v.pricePaise,
        weightGrams: v.weightGrams,
        inStock: v.inStock,
        stockQty: v.stockQty,
        position: v.position ?? i,
      };
      if (v.id != null && existingIds.has(v.id)) {
        await tx.update(variants).set(values).where(eq(variants.id, v.id));
      } else {
        await tx.insert(variants).values({ productId: id, ...values });
      }
    }
  });
}

export type PublishResult = { ok: true } | { ok: false; error: string };

/**
 * Real publish gate (PROMPTS.md Phase 8's explicitly-checked acceptance criterion): a product with
 * ANY image missing real alt text is rejected here, server-side — not merely disabled in the UI.
 * Also requires at least one image and one variant, since a "published" product with neither is
 * not a real, sellable listing.
 */
export async function publishProductDb(id: number): Promise<PublishResult> {
  const images = await db.select({ alt: productImages.alt }).from(productImages).where(eq(productImages.productId, id));
  const variantRows = await db.select({ id: variants.id }).from(variants).where(eq(variants.productId, id));

  if (variantRows.length === 0) return { ok: false, error: "Add at least one variant before publishing." };
  if (images.length === 0) return { ok: false, error: "Add at least one image before publishing." };
  const missingAlt = images.some((img) => !img.alt || img.alt.trim().length === 0);
  if (missingAlt) {
    return { ok: false, error: "Every image needs real alt text before this product can be published." };
  }

  await db.update(products).set({ status: "published", updatedAt: new Date() }).where(eq(products.id, id));
  return { ok: true };
}

export async function unpublishProductDb(id: number): Promise<void> {
  await db.update(products).set({ status: "draft", updatedAt: new Date() }).where(eq(products.id, id));
}

// -----------------------------------------------------------------------------------------------
// Images
// -----------------------------------------------------------------------------------------------

export interface PresignedUploadResult {
  url: string;
  tmpKey: string;
}

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Step 1 of the upload flow: a presigned PUT to a temp key. The browser uploads the original
 * bytes straight to Supabase Storage with this URL — they never pass through our server on the way in. */
export async function presignProductImageUploadDb(
  productSlug: string,
  contentType: string,
  contentLength: number,
): Promise<PresignedUploadResult> {
  const ext = ALLOWED_MIME[contentType];
  if (!ext) throw new Error(`Unsupported content type "${contentType}" — only JPEG, PNG or WEBP are allowed.`);
  if (contentLength <= 0 || contentLength > MAX_UPLOAD_BYTES) throw new Error("File must be non-empty and at most 5MB.");

  const tmpKey = buildKey("products", productSlug, `tmp-${randomUUID()}`, ext);
  const { url } = await presignUpload({ key: tmpKey, contentType, contentLength });
  return { url, tmpKey };
}

/** Step 2: after the browser confirms the presigned PUT succeeded, the server fetches the object
 * back, runs the real `sharp` AVIF/WebP derivative pipeline (same as scripts/migrate-images.ts),
 * uploads every derivative, records the largest WebP as the canonical `storageKey` (next/image handles
 * further format/width negotiation from there — see scripts/migrate-images.ts's identical
 * comment), inserts the `product_images` row (alt text starts empty and MUST be filled in before
 * publish — see publishProductDb), and deletes the temp original. */
export async function finalizeProductImageUploadDb(
  productId: number,
  productSlug: string,
  tmpKey: string,
): Promise<{ id: number; storageKey: string; width: number; height: number }> {
  const originalBuffer = await getObject(tmpKey);
  const processed = await processImage(originalBuffer);

  const hash = createHash("sha256").update(originalBuffer).digest("hex").slice(0, 16);
  let canonicalKey = "";
  let canonicalWidth = 0;
  let canonicalHeight = 0;

  for (const derivative of processed.derivatives) {
    const key = buildKey("products", productSlug, hash, derivative.format, `w${derivative.width}`);
    await putObject(key, derivative.buffer, `image/${derivative.format}`);
    if (derivative.format === "webp" && derivative.width >= canonicalWidth) {
      canonicalKey = key;
      canonicalWidth = derivative.width;
      canonicalHeight = derivative.height;
    }
  }

  await deleteObject(tmpKey).catch(() => {
    // Best-effort cleanup of the temp original — a leftover temp object is not a correctness bug
    // (it's never referenced by any DB row), just a small amount of storage waste.
  });

  const existingImages = await db
    .select({ position: productImages.position })
    .from(productImages)
    .where(eq(productImages.productId, productId))
    .orderBy(asc(productImages.position));
  const isFirstImage = existingImages.length === 0;
  const nextPosition = existingImages.length > 0 ? Math.max(...existingImages.map((p) => p.position)) + 1 : 0;

  const [row] = await db
    .insert(productImages)
    .values({
      productId,
      storageKey: canonicalKey,
      alt: "",
      width: canonicalWidth,
      height: canonicalHeight,
      position: nextPosition,
      isPrimary: isFirstImage,
    })
    .returning({ id: productImages.id, storageKey: productImages.storageKey, width: productImages.width, height: productImages.height });

  return row;
}

export async function updateProductImageAltDb(imageId: number, alt: string): Promise<void> {
  await db.update(productImages).set({ alt }).where(eq(productImages.id, imageId));
}

export async function reorderProductImagesDb(productId: number, orderedIds: number[]): Promise<void> {
  await db.transaction(async (tx) => {
    for (const [i, imgId] of orderedIds.entries()) {
      await tx.update(productImages).set({ position: i }).where(eq(productImages.id, imgId));
    }
  });
}

export async function setPrimaryProductImageDb(productId: number, imageId: number): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(productImages).set({ isPrimary: false }).where(eq(productImages.productId, productId));
    await tx.update(productImages).set({ isPrimary: true }).where(eq(productImages.id, imageId));
  });
}

export type DeleteImageResult = { ok: true } | { ok: false; error: string };

/** Deletes a product image row AND its storage object — but only actually removes the storage object when
 * no other image row still references the same key (PROMPTS.md's explicit "delete with a real
 * check that nothing else still references that storage key before removing it"). */
export async function deleteProductImageDb(imageId: number): Promise<DeleteImageResult> {
  const [image] = await db.select().from(productImages).where(eq(productImages.id, imageId)).limit(1);
  if (!image) return { ok: false, error: "Image not found." };

  await db.delete(productImages).where(eq(productImages.id, imageId));

  const stillReferenced = await countProductImageReferencesToKey(image.storageKey, imageId);
  if (stillReferenced === 0) {
    await deleteObject(image.storageKey).catch(() => {
      // Row is already gone either way — a failed storage delete leaves an orphaned object, not a
      // dangling reference, so it's safe to swallow here rather than fail the whole action.
    });
  }

  // If the deleted image was primary, promote the next-lowest-position image, if any.
  if (image.isPrimary) {
    const [next] = await db
      .select({ id: productImages.id })
      .from(productImages)
      .where(eq(productImages.productId, image.productId))
      .orderBy(asc(productImages.position))
      .limit(1);
    if (next) await db.update(productImages).set({ isPrimary: true }).where(eq(productImages.id, next.id));
  }

  return { ok: true };
}

export { isSlugTaken };
