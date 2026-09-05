import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getAllPublishedProductSlugs,
  getProductBySlug,
  getRelatedProducts,
} from "@/lib/db/queries/product-detail";
import { getReviewSummary, getApprovedReviews } from "@/lib/db/queries/reviews";
import { getFreeShippingThresholdPaise } from "@/lib/db/queries/settings";
import { getCollectionsWithStats } from "@/lib/db/queries/collections";
import { Gallery, type GallerySlide } from "@/components/pdp/Gallery";
import { PdpInteractive } from "@/components/pdp/PdpInteractive";
import { PincodeCheck } from "@/components/pdp/PincodeCheck";
import { Details } from "@/components/pdp/Details";
import { BrewStory } from "@/components/pdp/BrewStory";
import { Reviews } from "@/components/pdp/Reviews";
import { ProductGrid } from "@/components/shop/ProductGrid";
import { CollectionFaq } from "@/components/sections/CollectionFaq";
import { formatINR } from "@/lib/money";
import { publicUrl } from "@/lib/storage/storage";

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

/** Every published product's slug, known at build time — same "published" status filter Phase 3
 * established for /shop and /collections/[slug] (CLAUDE.md §3.1's fixed catalogue shape). */
export async function generateStaticParams() {
  const slugs = await getAllPublishedProductSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return {};

  const primaryVariant = product.variants[0];
  const description =
    product.seoDescription ??
    product.shortDescription?.split("\n")[0] ??
    `${product.name} — organic, GST-inclusive pricing, free shipping over ₹500, from Dishu Masala.`;

  return {
    title: product.seoTitle ?? `${product.name}${primaryVariant ? ` — ${formatINR(primaryVariant.pricePaise)}` : ""}`,
    description,
    // Keeps the legacy URL shape exactly: /product/<slug>/ (CLAUDE.md §10's SEO/migration rule).
    alternates: { canonical: `/product/${product.slug}/` },
  };
}

function safeImageUrl(storageKey: string): string | null {
  try {
    return publicUrl(storageKey);
  } catch {
    return null;
  }
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const [collections, freeShippingThresholdPaise, reviewSummary, reviewsFirstPage, related] = await Promise.all([
    getCollectionsWithStats(),
    getFreeShippingThresholdPaise(),
    getReviewSummary(product.id),
    getApprovedReviews(product.id, { sort: "recent", page: 1 }),
    getRelatedProducts(product.id, 4),
  ]);
  const collection = collections.find((c) => c.id === product.collectionId) ?? null;

  const isBlueTea = collection?.slug === "blue-tea";
  const primaryVariant = product.variants[0];

  const slides: GallerySlide[] = product.images
    .map((img) => {
      const url = safeImageUrl(img.storageKey);
      return url ? { url, alt: img.alt, width: img.width, height: img.height } : null;
    })
    .filter((s): s is GallerySlide => s != null);

  const primaryImageKey = product.images.find((img) => img.isPrimary)?.storageKey ?? product.images[0]?.storageKey;
  const primaryImageUrl = primaryImageKey ? safeImageUrl(primaryImageKey) : null;

  const hasApprovedReviews = reviewSummary.count > 0;

  const productJsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.shortDescription ?? undefined,
    sku: primaryVariant?.sku,
    offers: product.variants.map((v) => ({
      "@type": "Offer",
      sku: v.sku,
      priceCurrency: "INR",
      price: (v.pricePaise / 100).toFixed(2),
      availability: v.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/product/${product.slug}/`,
    })),
  };

  // AggregateRating only when at least one approved review exists (CLAUDE.md §10 / PROMPTS.md
  // Phase 4 item 1) — genuinely omitted, not just conditionally empty, when count is 0.
  if (hasApprovedReviews) {
    productJsonLd.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: reviewSummary.average.toFixed(1),
      reviewCount: reviewSummary.count,
    };
  }

  const reviewsPageForClient = {
    ...reviewsFirstPage,
    items: reviewsFirstPage.items.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      photos: item.photos
        .map((p) => {
          const url = safeImageUrl(p.storageKey);
          return url ? { id: p.id, url } : null;
        })
        .filter((p): p is { id: number; url: string } => p != null),
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-ink-2">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/shop" className="hover:text-ink hover:underline">
              Shop
            </Link>
          </li>
          {collection && (
            <>
              <li aria-hidden="true">/</li>
              <li>
                <Link href={`/collections/${collection.slug}`} className="hover:text-ink hover:underline">
                  {collection.title}
                </Link>
              </li>
            </>
          )}
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-ink">
            {product.name}
          </li>
        </ol>
      </nav>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
        <Gallery productName={product.name} slides={slides} />

        <div className="flex flex-col gap-6">
          <PdpInteractive
            productId={product.id}
            productName={product.name}
            optionLabel={product.optionLabel}
            variants={product.variants}
            priority={product.priority}
            primaryImageUrl={primaryImageUrl}
            reviewCount={reviewSummary.count}
            reviewAverage={reviewSummary.average}
          />

          <PincodeCheck />

          <Details description={product.description} freeShippingThresholdPaise={freeShippingThresholdPaise} />
        </div>
      </div>

      {isBlueTea && (
        <div className="mt-16 border-t border-line pt-12">
          <BrewStory />
        </div>
      )}

      <div className="mt-16 border-t border-line pt-12">
        <Reviews
          productSlug={product.slug}
          productName={product.name}
          summary={reviewSummary}
          initialPage={reviewsPageForClient}
        />
      </div>

      {related.length > 0 && (
        <div className="mt-16 border-t border-line pt-12">
          <h2 className="font-display text-2xl font-semibold text-ink sm:text-3xl">You may also like</h2>
          <div className="mt-6">
            <ProductGrid products={related} />
          </div>
        </div>
      )}

      </div>

      {collection && (
        <div className="border-t border-line">
          <CollectionFaq collectionSlug={collection.slug} collectionTitle={product.name} />
        </div>
      )}
    </>
  );
}
