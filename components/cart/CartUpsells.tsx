import { getRelatedProducts } from "@/lib/db/queries/product-detail";
import { CartUpsellsList } from "./CartUpsellsList";

/** Server wrapper — fetches the site's top products in priority order (CLAUDE.md §7.2) as
 * candidates; excludeProductId 0 matches no real product, so nothing is pre-excluded here — the
 * actual "not already in the cart, only from a higher-priority collection" filtering, and the
 * combo/regular split, happens client-side in CartUpsellsList, since only the browser knows the
 * live cart contents. A wider limit than before so the combos collection (priority 4, CLAUDE.md
 * §7.2) reliably shows up alongside the top "you may also like" candidates. */
export async function CartUpsells() {
  const candidates = await getRelatedProducts(0, 14);
  if (candidates.length === 0) return null;
  return <CartUpsellsList candidates={candidates} />;
}
