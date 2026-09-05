ALTER TABLE "product_images" RENAME COLUMN "r2_key" TO "storage_key";--> statement-breakpoint
ALTER TABLE "order_items" RENAME COLUMN "image_r2_key" TO "image_storage_key";--> statement-breakpoint
ALTER TABLE "review_photos" RENAME COLUMN "r2_key" TO "storage_key";--> statement-breakpoint
ALTER TABLE "posts" RENAME COLUMN "cover_r2_key" TO "cover_storage_key";