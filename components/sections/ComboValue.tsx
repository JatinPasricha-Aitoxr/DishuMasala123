import { ProductCarousel } from "@/components/product/ProductCarousel";
import { SectionHeading } from "./SectionHeading";
import { computeComboSavingPaise } from "@/lib/combo-savings";
import { formatINR } from "@/lib/money";
import { HOME_COPY } from "@/content/home";
import type { ProductCardData } from "@/types/catalog";

export interface ComboValueProps {
  combos: ProductCardData[];
  /** Every published spices-collection product with its variants — the raw ingredient list this
   * section matches combo names against to compute a real saving (lib/combo-savings.ts). */
  spices: ProductCardData[];
}

export function ComboValue({ combos, spices }: ComboValueProps) {
  if (combos.length === 0) return null;

  // Built server-side, as a plain object of already-rendered elements — ProductCarousel is a
  // Client Component, and a render function can't cross that boundary as a prop (only Server
  // Actions can serialize that way); a map of finished JSX keyed by slug can.
  const badgeBySlug: Record<string, React.ReactNode> = {};
  for (const combo of combos) {
    const savingPaise = computeComboSavingPaise(combo, spices);
    if (savingPaise != null) {
      badgeBySlug[combo.slug] = (
        <span
          key={`${combo.slug}-saving-badge`}
          className="absolute left-2.5 top-2.5 z-20 rounded-sm bg-ink px-2 py-1 text-xs font-semibold tabular-nums text-surface shadow-card"
        >
          Save {formatINR(savingPaise)} vs. separately
        </span>
      );
    }
  }

  return (
    <section aria-labelledby="combos-heading" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-14 lg:py-16">
      <SectionHeading
        id="combos-heading"
        eyebrow={HOME_COPY.combos.eyebrow}
        heading={HOME_COPY.combos.heading}
        body={HOME_COPY.combos.body}
        accentClassName="text-ink-2"
      />
      <div className="mt-10">
        <ProductCarousel products={combos} label="Combo Packs" badgeBySlug={badgeBySlug} />
      </div>
    </section>
  );
}
