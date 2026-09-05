import "server-only";

import { eq } from "drizzle-orm";
import { db } from "../index";
import { pages, posts } from "../schema";
import type { TiptapDoc } from "@/lib/content/tiptap-schema";

export interface PostInput {
  slug: string;
  kind: "blog" | "recipe";
  title: string;
  excerpt: string | null;
  body: TiptapDoc;
  coverStorageKey: string | null;
  author: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  relatedProductIds: number[];
}

export async function createPostDb(input: PostInput): Promise<number> {
  const [row] = await db.insert(posts).values({ ...input, status: "draft", body: input.body }).returning({ id: posts.id });
  return row.id;
}

export async function updatePostDb(id: number, input: PostInput): Promise<void> {
  await db.update(posts).set({ ...input, body: input.body }).where(eq(posts.id, id));
}

export type PublishResult = { ok: true } | { ok: false; error: string };

/** Sets status "published" and, if the caller didn't schedule a future `publishedAt`, stamps it
 * with now(). A future `publishedAt` alongside status "published" is how scheduling works — the
 * storefront query (lib/db/queries/posts.ts) only surfaces rows where `published_at <= now()`. */
export async function publishPostDb(id: number, publishedAt: Date | null): Promise<PublishResult> {
  const [row] = await db.select({ body: posts.body }).from(posts).where(eq(posts.id, id)).limit(1);
  if (!row) return { ok: false, error: "Post not found." };
  await db.update(posts).set({ status: "published", publishedAt: publishedAt ?? new Date() }).where(eq(posts.id, id));
  return { ok: true };
}

export async function unpublishPostDb(id: number): Promise<void> {
  await db.update(posts).set({ status: "draft" }).where(eq(posts.id, id));
}

// -----------------------------------------------------------------------------------------------
// Pages
// -----------------------------------------------------------------------------------------------

export interface PageInput {
  slug: string;
  title: string;
  body: TiptapDoc;
}

export async function createPageDb(input: PageInput): Promise<number> {
  const [row] = await db.insert(pages).values({ ...input, body: input.body, status: "draft", updatedAt: new Date() }).returning({ id: pages.id });
  return row.id;
}

export async function updatePageDb(id: number, input: PageInput): Promise<void> {
  await db.update(pages).set({ ...input, body: input.body, updatedAt: new Date() }).where(eq(pages.id, id));
}

export async function publishPageDb(id: number): Promise<void> {
  await db.update(pages).set({ status: "published", updatedAt: new Date() }).where(eq(pages.id, id));
}

export async function unpublishPageDb(id: number): Promise<void> {
  await db.update(pages).set({ status: "draft", updatedAt: new Date() }).where(eq(pages.id, id));
}
