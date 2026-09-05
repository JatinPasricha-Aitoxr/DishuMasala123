"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import type { AdminImageRow } from "@/lib/db/queries/admin-products";
import {
  presignProductImageUploadAction,
  finalizeProductImageUploadAction,
  updateProductImageAltAction,
  reorderProductImagesAction,
  setPrimaryProductImageAction,
  deleteProductImageAction,
} from "./actions";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024;

interface UploadState {
  fileName: string;
  status: "uploading" | "processing" | "error";
  error?: string;
}

/**
 * Drag-and-drop image upload straight to Supabase Storage via a presigned URL, drag-to-reorder, per-image alt
 * text (required before publish — enforced server-side in publishProductDb), set-primary, and
 * delete (PROMPTS.md Phase 8 item 1).
 */
export function ProductImages({
  productId,
  productSlug,
  images,
  onChanged,
}: {
  productId: number;
  productSlug: string;
  images: AdminImageRow[];
  onChanged: () => void;
}) {
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function uploadOne(file: File) {
    const label: UploadState = { fileName: file.name, status: "uploading" };
    setUploads((u) => [...u, label]);
    setError(null);

    if (!ALLOWED_TYPES.has(file.type)) {
      setUploads((u) => u.map((x) => (x === label ? { ...x, status: "error", error: "Only JPEG, PNG or WEBP." } : x)));
      return;
    }
    if (file.size > MAX_BYTES) {
      setUploads((u) => u.map((x) => (x === label ? { ...x, status: "error", error: "File is larger than 5MB." } : x)));
      return;
    }

    const presign = await presignProductImageUploadAction({
      productSlug,
      contentType: file.type as "image/jpeg" | "image/png" | "image/webp",
      contentLength: file.size,
    });
    if (!presign.ok || !presign.data) {
      setUploads((u) => u.map((x) => (x === label ? { ...x, status: "error", error: presign.ok ? "Upload failed." : presign.error } : x)));
      return;
    }

    const putRes = await fetch(presign.data.url, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
    if (!putRes.ok) {
      setUploads((u) => u.map((x) => (x === label ? { ...x, status: "error", error: "Upload to storage failed." } : x)));
      return;
    }

    setUploads((u) => u.map((x) => (x === label ? { ...x, status: "processing" } : x)));
    const finalize = await finalizeProductImageUploadAction({ productId, productSlug, tmpKey: presign.data.tmpKey });
    if (!finalize.ok) {
      setUploads((u) => u.map((x) => (x === label ? { ...x, status: "error", error: finalize.error } : x)));
      return;
    }

    setUploads((u) => u.filter((x) => x !== label));
    onChanged();
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) await uploadOne(file);
  }

  async function handleAltChange(imageId: number, alt: string) {
    await updateProductImageAltAction({ imageId, alt });
  }

  async function handleSetPrimary(imageId: number) {
    const res = await setPrimaryProductImageAction({ productId, imageId });
    if (!res.ok) setError(res.error);
    onChanged();
  }

  async function handleDelete(imageId: number) {
    const res = await deleteProductImageAction({ imageId, productId });
    if (!res.ok) setError(res.error);
    onChanged();
  }

  async function commitReorder(newOrder: AdminImageRow[]) {
    const res = await reorderProductImagesAction({ productId, orderedIds: newOrder.map((i) => i.id) });
    if (!res.ok) setError(res.error);
    onChanged();
  }

  function onDropReorder(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) return;
    const next = [...images];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(targetIndex, 0, moved);
    setDragIndex(null);
    void commitReorder(next);
  }

  return (
    <section className="space-y-4 rounded-lg border border-line bg-surface p-5">
      <h2 className="font-display text-lg font-semibold text-ink">Images</h2>
      {error && <p role="alert" className="text-sm text-crit">{error}</p>}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        className={`flex h-32 cursor-pointer items-center justify-center rounded-md border-2 border-dashed text-sm text-ink-2 ${dragOver ? "border-brew-2 bg-surface-2" : "border-line"}`}
      >
        Drag and drop JPEG/PNG/WEBP images here, or click to choose files (max 5MB each)
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="sr-only"
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {uploads.length > 0 && (
        <ul className="space-y-1 text-sm">
          {uploads.map((u, i) => (
            <li key={i} className={u.status === "error" ? "text-crit" : "text-ink-2"}>
              {u.fileName} — {u.status === "uploading" ? "uploading…" : u.status === "processing" ? "processing…" : u.error}
            </li>
          ))}
        </ul>
      )}

      {images.length === 0 ? (
        <p className="text-sm text-ink-3">No images yet.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {images.map((img, i) => (
            <li
              key={img.id}
              draggable
              onDragStart={() => setDragIndex(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDropReorder(i)}
              className="cursor-move rounded-md border border-line p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs text-ink-3">Position {i + 1}</span>
                {img.isPrimary && <Badge tone="gold">Primary</Badge>}
              </div>
              <div className="relative mb-2 aspect-square overflow-hidden rounded-md bg-surface-2">
                <Image src={img.url} alt={img.alt || "(missing alt text)"} fill sizes="300px" className="object-cover" />
              </div>
              <label className="mb-1 block text-xs font-medium text-ink-2">
                Alt text {!img.alt && <span className="text-crit">(required before publish)</span>}
              </label>
              <Input
                defaultValue={img.alt}
                onBlur={(e) => void handleAltChange(img.id, e.target.value)}
                placeholder="Describe this image for screen readers"
              />
              <div className="mt-2 flex gap-2">
                {!img.isPrimary && (
                  <Button type="button" variant="outline" size="sm" onClick={() => void handleSetPrimary(img.id)}>
                    Set primary
                  </Button>
                )}
                <Button type="button" variant="ghost" size="sm" onClick={() => void handleDelete(img.id)} className="text-crit">
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
