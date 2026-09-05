"use server";

/**
 * Product/variant/image admin mutations (PROMPTS.md Phase 8 item 1). Same discipline as
 * app/admin/orders/actions.ts: `requireStaffOrAdmin()` first, Zod-validated input, `audit_log` via
 * `lib/audit.ts`, `revalidateTag`/`revalidatePath` for every storefront cache the change could
 * affect, typed results only.
 *
 * Rupee→paise conversion (the acceptance criterion "Rupee input 549 stores exactly 54900 paise")
 * happens ONLY here, via `lib/money.ts`'s `toPaise` — never in the client form, which only ever
 * shows the resulting paise value as a live preview using the same rounding rule.
 */
import { z } from "zod";
import { revalidatePath, updateTag } from "next/cache";
import { requireStaffOrAdmin } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { toPaise } from "@/lib/money";
import {
  createProductDb,
  updateProductDb,
  publishProductDb,
  unpublishProductDb,
  presignProductImageUploadDb,
  finalizeProductImageUploadDb,
  updateProductImageAltDb,
  reorderProductImagesDb,
  setPrimaryProductImageDb,
  deleteProductImageDb,
  type ProductInput,
} from "@/lib/db/mutations/admin-products";
import { isSlugTaken, getProductSlugAndStatus, getAdminProductById } from "@/lib/db/queries/admin-products";

export type AdminResult<T = undefined> = { ok: true; message: string; data?: T } | { ok: false; error: string };

async function requireStaff() {
  const session = await requireStaffOrAdmin();
  if (!session.ok) {
    return { ok: false as const, error: session.error === "unauthenticated" ? "Sign in required." : "Staff access required." };
  }
  return { ok: true as const, user: session.user };
}

function revalidateCatalog(slug?: string) {
  updateTag("products");
  if (slug) updateTag(`product:${slug}`);
  revalidatePath("/admin/products");
  revalidatePath("/shop");
  if (slug) revalidatePath(`/product/${slug}`);
}

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const variantSchema = z.object({
  id: z.number().int().positive().optional(),
  sku: z.string().trim().min(1, "SKU is required").max(64),
  optionValue: z.string().trim().min(1, "Option value is required").max(120),
  mrpRupees: z.coerce.number().positive("MRP must be greater than 0"),
  priceRupees: z.coerce.number().positive("Price must be greater than 0"),
  weightGrams: z.coerce.number().int().positive().nullable(),
  inStock: z.boolean(),
  stockQty: z.coerce.number().int().min(0).nullable(),
  position: z.number().int().min(0),
});

const productSchema = z.object({
  slug: z.string().trim().toLowerCase().regex(slugPattern, "Lowercase letters, numbers and hyphens only"),
  name: z.string().trim().min(1, "Name is required").max(200),
  collectionId: z.coerce.number().int().positive(),
  shortDescription: z.string().trim().max(500).nullable(),
  description: z.string().trim().max(5000).nullable(),
  ingredients: z.string().trim().max(2000).nullable(),
  brewGuide: z.string().trim().max(2000).nullable(),
  tags: z.array(z.string().trim().min(1)).max(20),
  optionLabel: z.string().trim().min(1, "Option label is required").max(40),
  priority: z.coerce.number().int().min(1).max(99),
  seoTitle: z.string().trim().max(70).nullable(),
  seoDescription: z.string().trim().max(200).nullable(),
  variants: z.array(variantSchema).min(1, "Add at least one variant"),
});

function toDbInput(parsed: z.infer<typeof productSchema>): ProductInput {
  return {
    slug: parsed.slug,
    name: parsed.name,
    collectionId: parsed.collectionId,
    shortDescription: parsed.shortDescription || null,
    description: parsed.description || null,
    ingredients: parsed.ingredients || null,
    brewGuide: parsed.brewGuide || null,
    tags: parsed.tags,
    optionLabel: parsed.optionLabel,
    priority: parsed.priority,
    seoTitle: parsed.seoTitle || null,
    seoDescription: parsed.seoDescription || null,
    variants: parsed.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      optionValue: v.optionValue,
      mrpPaise: toPaise(v.mrpRupees),
      pricePaise: toPaise(v.priceRupees),
      weightGrams: v.weightGrams,
      inStock: v.inStock,
      stockQty: v.stockQty,
      position: v.position,
    })),
  };
}

export async function checkSlugAvailableAction(slug: string, excludeId?: number): Promise<{ available: boolean }> {
  const auth = await requireStaff();
  if (!auth.ok) return { available: false };
  const taken = await isSlugTaken(slug, excludeId);
  return { available: !taken };
}

export async function createProductAction(input: z.infer<typeof productSchema>): Promise<AdminResult<{ id: number }>> {
  const auth = await requireStaff();
  if (!auth.ok) return auth;

  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  if (await isSlugTaken(parsed.data.slug)) {
    return { ok: false, error: `The slug "${parsed.data.slug}" is already used by another product.` };
  }

  const dbInput = toDbInput(parsed.data);
  const id = await createProductDb(dbInput);

  await writeAuditLog({
    actorUserId: auth.user.id,
    action: "product.create",
    entity: "product",
    entityId: id,
    diff: { name: dbInput.name, slug: dbInput.slug, variantCount: dbInput.variants.length },
  });
  revalidateCatalog(dbInput.slug);
  return { ok: true, message: "Product created as a draft.", data: { id } };
}

export async function updateProductAction(id: number, input: z.infer<typeof productSchema>): Promise<AdminResult> {
  const auth = await requireStaff();
  if (!auth.ok) return auth;

  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const existing = await getProductSlugAndStatus(id);
  if (!existing) return { ok: false, error: "Product not found." };

  if (await isSlugTaken(parsed.data.slug, id)) {
    return { ok: false, error: `The slug "${parsed.data.slug}" is already used by another product.` };
  }

  const dbInput = toDbInput(parsed.data);
  await updateProductDb(id, dbInput);

  await writeAuditLog({
    actorUserId: auth.user.id,
    action: "product.update",
    entity: "product",
    entityId: id,
    diff: {
      slug: existing.slug === dbInput.slug ? undefined : { from: existing.slug, to: dbInput.slug },
      name: dbInput.name,
      variantCount: dbInput.variants.length,
    },
  });
  revalidateCatalog(existing.slug);
  if (existing.slug !== dbInput.slug) revalidateCatalog(dbInput.slug);
  return { ok: true, message: "Product saved." };
}

export async function publishProductAction(id: number): Promise<AdminResult> {
  const auth = await requireStaff();
  if (!auth.ok) return auth;

  const product = await getAdminProductById(id);
  if (!product) return { ok: false, error: "Product not found." };

  const result = await publishProductDb(id);
  if (!result.ok) return { ok: false, error: result.error };

  await writeAuditLog({
    actorUserId: auth.user.id,
    action: "product.publish",
    entity: "product",
    entityId: id,
    diff: { slug: product.slug, status: { from: "draft", to: "published" } },
  });
  revalidateCatalog(product.slug);
  return { ok: true, message: "Product published — it's live on the storefront now." };
}

export async function unpublishProductAction(id: number): Promise<AdminResult> {
  const auth = await requireStaff();
  if (!auth.ok) return auth;

  const product = await getAdminProductById(id);
  if (!product) return { ok: false, error: "Product not found." };

  await unpublishProductDb(id);
  await writeAuditLog({
    actorUserId: auth.user.id,
    action: "product.unpublish",
    entity: "product",
    entityId: id,
    diff: { slug: product.slug, status: { from: "published", to: "draft" } },
  });
  revalidateCatalog(product.slug);
  return { ok: true, message: "Product moved back to draft." };
}

// -------------------------------------------------------------------------------------------
// Images
// -------------------------------------------------------------------------------------------

const presignSchema = z.object({
  productSlug: z.string().trim().min(1),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  contentLength: z.number().int().positive().max(5 * 1024 * 1024),
});

export async function presignProductImageUploadAction(
  input: z.infer<typeof presignSchema>,
): Promise<AdminResult<{ url: string; tmpKey: string }>> {
  const auth = await requireStaff();
  if (!auth.ok) return auth;

  const parsed = presignSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  try {
    const result = await presignProductImageUploadDb(parsed.data.productSlug, parsed.data.contentType, parsed.data.contentLength);
    return { ok: true, message: "Ready to upload.", data: result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not prepare the upload." };
  }
}

const finalizeSchema = z.object({
  productId: z.number().int().positive(),
  productSlug: z.string().trim().min(1),
  tmpKey: z.string().trim().min(1),
});

export async function finalizeProductImageUploadAction(
  input: z.infer<typeof finalizeSchema>,
): Promise<AdminResult<{ id: number; url: string }>> {
  const auth = await requireStaff();
  if (!auth.ok) return auth;

  const parsed = finalizeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  try {
    const row = await finalizeProductImageUploadDb(parsed.data.productId, parsed.data.productSlug, parsed.data.tmpKey);
    const { publicUrl } = await import("@/lib/storage/storage");
    await writeAuditLog({
      actorUserId: auth.user.id,
      action: "product.image_upload",
      entity: "product",
      entityId: parsed.data.productId,
      diff: { storageKey: row.storageKey, width: row.width, height: row.height },
    });
    revalidatePath(`/admin/products/${parsed.data.productId}`);
    return { ok: true, message: "Image uploaded — add alt text before publishing.", data: { id: row.id, url: publicUrl(row.storageKey) } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Upload processing failed." };
  }
}

const altSchema = z.object({ imageId: z.number().int().positive(), alt: z.string().trim().max(200) });

export async function updateProductImageAltAction(input: z.infer<typeof altSchema>): Promise<AdminResult> {
  const auth = await requireStaff();
  if (!auth.ok) return auth;
  const parsed = altSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  await updateProductImageAltDb(parsed.data.imageId, parsed.data.alt);
  await writeAuditLog({
    actorUserId: auth.user.id,
    action: "product.image_alt_update",
    entity: "product_image",
    entityId: parsed.data.imageId,
    diff: { alt: parsed.data.alt },
  });
  return { ok: true, message: "Alt text saved." };
}

const reorderSchema = z.object({ productId: z.number().int().positive(), orderedIds: z.array(z.number().int().positive()).min(1) });

export async function reorderProductImagesAction(input: z.infer<typeof reorderSchema>): Promise<AdminResult> {
  const auth = await requireStaff();
  if (!auth.ok) return auth;
  const parsed = reorderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  await reorderProductImagesDb(parsed.data.productId, parsed.data.orderedIds);
  await writeAuditLog({
    actorUserId: auth.user.id,
    action: "product.image_reorder",
    entity: "product",
    entityId: parsed.data.productId,
    diff: { orderedIds: parsed.data.orderedIds },
  });
  const product = await getAdminProductById(parsed.data.productId);
  if (product) revalidateCatalog(product.slug);
  return { ok: true, message: "Image order saved." };
}

const primarySchema = z.object({ productId: z.number().int().positive(), imageId: z.number().int().positive() });

export async function setPrimaryProductImageAction(input: z.infer<typeof primarySchema>): Promise<AdminResult> {
  const auth = await requireStaff();
  if (!auth.ok) return auth;
  const parsed = primarySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  await setPrimaryProductImageDb(parsed.data.productId, parsed.data.imageId);
  await writeAuditLog({
    actorUserId: auth.user.id,
    action: "product.image_set_primary",
    entity: "product",
    entityId: parsed.data.productId,
    diff: { imageId: parsed.data.imageId },
  });
  const product = await getAdminProductById(parsed.data.productId);
  if (product) revalidateCatalog(product.slug);
  return { ok: true, message: "Primary image set." };
}

const deleteImageSchema = z.object({ imageId: z.number().int().positive(), productId: z.number().int().positive() });

export async function deleteProductImageAction(input: z.infer<typeof deleteImageSchema>): Promise<AdminResult> {
  const auth = await requireStaff();
  if (!auth.ok) return auth;
  const parsed = deleteImageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const result = await deleteProductImageDb(parsed.data.imageId);
  if (!result.ok) return { ok: false, error: result.error };

  await writeAuditLog({
    actorUserId: auth.user.id,
    action: "product.image_delete",
    entity: "product_image",
    entityId: parsed.data.imageId,
    diff: { productId: parsed.data.productId },
  });
  const product = await getAdminProductById(parsed.data.productId);
  if (product) revalidateCatalog(product.slug);
  return { ok: true, message: "Image deleted." };
}
