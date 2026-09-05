"use client";

import { useId, useRef, useState } from "react";
import { RatingInput } from "@/components/ui/Rating";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { submitReviewAction } from "@/lib/actions/reviews";

const MAX_PHOTOS = 3;
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

interface UploadedPhoto {
  key: string;
  previewUrl: string;
  fileName: string;
}

type FormStatus =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success" }
  | { kind: "error"; message: string };

export function ReviewForm({ productSlug }: { productSlug: string }) {
  const [rating, setRating] = useState(0);
  const [authorName, setAuthorName] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<FormStatus>({ kind: "idle" });
  const [draftId] = useState(() => crypto.randomUUID());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formId = useId();
  const nameId = useId();
  const emailId = useId();
  const titleId = useId();
  const bodyId = useId();

  const onFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setPhotoError(null);

    const remaining = MAX_PHOTOS - photos.length;
    if (files.length > remaining) {
      setPhotoError(`You can add up to ${MAX_PHOTOS} photos — only ${remaining} more allowed.`);
    }

    const toUpload = Array.from(files).slice(0, Math.max(0, remaining));
    setUploading(true);

    for (const file of toUpload) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setPhotoError(`"${file.name}" isn't a JPEG, PNG or WEBP image.`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        setPhotoError(`"${file.name}" is larger than 5MB.`);
        continue;
      }

      const form = new FormData();
      form.append("file", file);
      form.append("draftId", draftId);

      try {
        const res = await fetch("/api/reviews/upload", { method: "POST", body: form });
        const data = (await res.json()) as { ok: boolean; storageKey?: string; error?: string };
        if (!data.ok || !data.storageKey) {
          setPhotoError(data.error ?? "Upload failed — please try again.");
          continue;
        }
        setPhotos((prev) => [...prev, { key: data.storageKey!, previewUrl: URL.createObjectURL(file), fileName: file.name }]);
      } catch {
        setPhotoError("Upload failed — please try again.");
      }
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePhoto = (key: string) => {
    setPhotos((prev) => prev.filter((p) => p.key !== key));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      setStatus({ kind: "error", message: "Please choose a star rating." });
      return;
    }

    setStatus({ kind: "submitting" });
    const result = await submitReviewAction({
      productSlug,
      authorName,
      email,
      rating,
      title: title || undefined,
      body,
      photoR2Keys: photos.map((p) => p.key),
    });

    if (!result.ok) {
      setStatus({ kind: "error", message: result.error });
      return;
    }

    setStatus({ kind: "success" });
    setRating(0);
    setAuthorName("");
    setEmail("");
    setTitle("");
    setBody("");
    setPhotos([]);
  };

  if (status.kind === "success") {
    return (
      <p role="status" className="mt-4 rounded-md border border-ok/30 bg-ok/10 px-4 py-4 text-sm text-ok">
        Thanks — your review has been submitted and will appear here once it&apos;s been moderated.
      </p>
    );
  }

  return (
    <form id={formId} onSubmit={onSubmit} className="mt-4 flex max-w-xl flex-col gap-4">
      <div>
        <p className="mb-1.5 text-sm font-semibold text-ink">Your rating</p>
        <RatingInput value={rating} onChange={setRating} aria-label="Your rating" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={nameId} className="mb-1.5 block text-sm font-semibold text-ink">
            Name
          </label>
          <Input id={nameId} required value={authorName} onChange={(e) => setAuthorName(e.target.value)} />
        </div>
        <div>
          <label htmlFor={emailId} className="mb-1.5 block text-sm font-semibold text-ink">
            Email
          </label>
          <Input id={emailId} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
      </div>

      <div>
        <label htmlFor={titleId} className="mb-1.5 block text-sm font-semibold text-ink">
          Title (optional)
        </label>
        <Input id={titleId} value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div>
        <label htmlFor={bodyId} className="mb-1.5 block text-sm font-semibold text-ink">
          Review
        </label>
        <Textarea id={bodyId} required minLength={10} value={body} onChange={(e) => setBody(e.target.value)} />
      </div>

      <div>
        <p className="mb-1.5 text-sm font-semibold text-ink">Photos (optional, up to {MAX_PHOTOS})</p>
        <div className="flex flex-wrap gap-2">
          {photos.map((p) => (
            <div key={p.key} className="relative size-16 overflow-hidden rounded-md border border-line">
              {/* Local blob preview only — not a next/image remote source. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.previewUrl} alt={p.fileName} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removePhoto(p.key)}
                aria-label={`Remove ${p.fileName}`}
                className="absolute right-0.5 top-0.5 flex size-5 items-center justify-center rounded-full bg-ink/70 text-xs text-surface"
              >
                ×
              </button>
            </div>
          ))}
          {photos.length < MAX_PHOTOS && (
            <label className="flex size-16 cursor-pointer items-center justify-center rounded-md border border-dashed border-line text-xs text-ink-2 hover:border-ink-3">
              {uploading ? "…" : "Add"}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="sr-only"
                onChange={(e) => onFilesSelected(e.target.files)}
                disabled={uploading}
              />
            </label>
          )}
        </div>
        {photoError && (
          <p role="alert" className="mt-1.5 text-xs text-crit">
            {photoError}
          </p>
        )}
      </div>

      {status.kind === "error" && (
        <p role="alert" className="text-sm text-crit">
          {status.message}
        </p>
      )}

      <Button type="submit" loading={status.kind === "submitting"} disabled={uploading} className="self-start">
        Submit review
      </Button>
      <p className="text-xs text-ink-2">Your review appears here only after it&apos;s been moderated.</p>
    </form>
  );
}
