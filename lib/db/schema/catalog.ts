import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { contentStatusEnum } from "./enums";

export const collections = pgTable("collections", {
  id: integer().generatedAlwaysAsIdentity().primaryKey(),
  slug: text().notNull(),
  title: text().notNull(),
  tagline: text(),
  priority: integer().notNull(),
  accentToken: text("accent_token"),
  position: integer().notNull().default(0),
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
}, (t) => [
  uniqueIndex("collections_slug_uniq").on(t.slug),
]);

export const products = pgTable("products", {
  id: integer().generatedAlwaysAsIdentity().primaryKey(),
  slug: text().notNull(),
  name: text().notNull(),
  collectionId: integer("collection_id").notNull().references(() => collections.id, { onDelete: "restrict" }),
  shortDescription: text("short_description"),
  description: text(),
  ingredients: text(),
  brewGuide: text("brew_guide"),
  tags: text().array().notNull().default([]),
  optionLabel: text("option_label").notNull(),
  priority: integer().notNull(),
  status: contentStatusEnum().notNull().default("draft"),
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("products_slug_uniq").on(t.slug),
  index("products_collection_id_idx").on(t.collectionId),
  index("products_priority_status_idx").on(t.priority, t.status),
]);

export const productImages = pgTable("product_images", {
  id: integer().generatedAlwaysAsIdentity().primaryKey(),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  storageKey: text("storage_key").notNull(),
  alt: text().notNull(),
  width: integer().notNull(),
  height: integer().notNull(),
  position: integer().notNull().default(0),
  isPrimary: boolean("is_primary").notNull().default(false),
}, (t) => [
  index("product_images_product_id_idx").on(t.productId),
]);

export const variants = pgTable("variants", {
  id: integer().generatedAlwaysAsIdentity().primaryKey(),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  sku: text().notNull(),
  optionValue: text("option_value").notNull(),
  mrpPaise: integer("mrp_paise").notNull(),
  pricePaise: integer("price_paise").notNull(),
  // Nullable: the source catalogue export has no per-variant weights (PRD §3.1) — required from
  // the client before go-live for accurate Shiprocket rates, but must not be invented here.
  weightGrams: integer("weight_grams"),
  inStock: boolean("in_stock").notNull().default(true),
  // Nullable: the source data only has in/out-of-stock, never a real count (CLAUDE.md §7.6).
  // When null, stock is boolean and no quantity is ever shown on the storefront.
  stockQty: integer("stock_qty"),
  position: integer().notNull().default(0),
  // Nullable: most variants (today, every one except Blue Tea loose's 2-pack/4-pack) have no photo
  // of their own and fall back to the product's shared primary image on the PDP (client request,
  // 2026-09-17: pack-tier variants get their own real pack-shot above the option card).
  imageStorageKey: text("image_storage_key"),
}, (t) => [
  uniqueIndex("variants_sku_uniq").on(t.sku),
  index("variants_product_id_idx").on(t.productId),
]);
