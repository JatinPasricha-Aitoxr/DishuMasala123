import Link from "next/link";
import { Placeholder } from "@/components/media/Placeholder";
import { PriceBlock } from "@/components/ui/PriceBlock";
import { getRelatedProducts } from "@/lib/db/queries/product-detail";
import { paise } from "@/lib/money";

/** The empty-cart page's "Bestsellers" rail (cart-redesign brief §16) — the site's own top
 * products in priority order (CLAUDE.md §7.2), the same real catalogue data every other rail on
 * this page uses. Server Component: nothing here depends on live cart state. */
export async function EmptyCartBestsellers() {
  const products = await getRelatedProducts(0, 4);
  if (products.length === 0) return null;

  return (
    <section className="mt-12 w-full">
      <h2 className="mb-4 text-center text-xs font-semibold uppercase tracking-[0.1em] text-ink-2">Bestsellers</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {products.map((product) => {
          const variant = product.variants[0];
          const image = product.images[0];
          if (!variant) return null;
          return (
            <Link
              key={product.id}
              href={`/product/${product.slug}/`}
              className="flex flex-col gap-2 rounded-md border border-line bg-surface p-3 transition-shadow hover:shadow-card"
            >
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element -- small fixed-size thumbnail.
                <img src={image.url} alt={image.alt} className="aspect-square w-full rounded-sm object-cover" loading="lazy" />
              ) : (
                <Placeholder slot="product-packshot-generic" className="rounded-sm" />
              )}
              <p className="text-sm font-semibold text-ink line-clamp-2">{product.name}</p>
              <PriceBlock mrpPaise={paise(variant.mrpPaise)} pricePaise={paise(variant.pricePaise)} showTaxNote={false} />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
