import { NextResponse } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import { buildKey, publicUrl, putObject, MAX_UPLOAD_BYTES } from "@/lib/storage/storage";

/**
 * Review-photo upload endpoint (PROMPTS.md Phase 4 item 7).
 *
 * Deliberately NOT a presigned-PUT-then-tell-the-server flow: a presigned PUT never routes the
 * bytes through this server at all, so there would be nowhere to run the required server-side
 * checks — real magic-byte type validation and EXIF stripping via `sharp` (both explicit
 * requirements of this phase). Instead the browser POSTs the file here directly; this route
 * validates it for real, strips EXIF, and reuses lib/storage/storage.ts's `putObject`/`buildKey`
 * (the same primitives a presigned flow would ultimately write through) to land it in Supabase Storage. The key
 * convention (`reviews/<id>/<hash>.<ext>`) is unchanged from CLAUDE.md §6 — `<id>` here is a
 * client-generated draft id (one per in-progress review form) rather than a real review row,
 * since the review itself doesn't exist until the form is submitted.
 */

const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]);
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(req: Request): Promise<NextResponse> {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Malformed upload" }, { status: 400 });
  }

  const file = form.get("file");
  const draftIdRaw = form.get("draftId");
  const draftId = typeof draftIdRaw === "string" && /^[a-zA-Z0-9-]{1,64}$/.test(draftIdRaw) ? draftIdRaw : randomUUID();

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "No file provided" }, { status: 400 });
  }

  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      { ok: false, error: "Only JPEG, PNG or WEBP photos are allowed." },
      { status: 400 },
    );
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { ok: false, error: "Photo is too large — the limit is 5MB." },
      { status: 400 },
    );
  }

  const inputBuffer = Buffer.from(await file.arrayBuffer());

  // Real, byte-level type validation — never trust the browser-supplied Content-Type alone.
  let format: string | undefined;
  try {
    const metadata = await sharp(inputBuffer, { failOn: "none" }).metadata();
    format = metadata.format;
  } catch {
    return NextResponse.json({ ok: false, error: "That file isn't a readable image." }, { status: 400 });
  }

  if (!format || !ALLOWED_FORMATS.has(format)) {
    return NextResponse.json(
      { ok: false, error: "Only JPEG, PNG or WEBP photos are allowed." },
      { status: 400 },
    );
  }

  // Auto-orient from EXIF, then re-encode with no metadata block at all — `sharp` only carries
  // metadata forward when `.withMetadata()` is explicitly called, so a plain pipeline strips EXIF
  // (GPS tags included) by default.
  const pipeline = sharp(inputBuffer, { failOn: "none" }).rotate();
  const outputBuffer =
    format === "jpeg"
      ? await pipeline.jpeg({ quality: 85 }).toBuffer()
      : format === "png"
        ? await pipeline.png().toBuffer()
        : await pipeline.webp({ quality: 85 }).toBuffer();

  if (outputBuffer.byteLength > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ ok: false, error: "Photo is too large — the limit is 5MB." }, { status: 400 });
  }

  const hash = createHash("sha256").update(outputBuffer).digest("hex").slice(0, 16);
  const ext = format === "jpeg" ? "jpg" : format;
  const key = buildKey("reviews", draftId, hash, ext);

  try {
    await putObject(key, outputBuffer, `image/${format === "jpeg" ? "jpeg" : format}`);
  } catch {
    return NextResponse.json(
      { ok: false, error: "Upload failed — please try again." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, storageKey: key, url: publicUrl(key), draftId });
}
