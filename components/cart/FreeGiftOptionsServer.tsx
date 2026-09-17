import { getFreeGiftOptions } from "@/lib/db/queries/free-gift";
import { FreeGiftPopup } from "./FreeGiftPopup";

/** Server wrapper — fetches the real, in-catalogue 100g spice variants FreeGiftPopup.tsx offers,
 * the same server/client composition CartUpsells.tsx uses for its own DB-backed slot. */
export async function FreeGiftOptionsServer() {
  const options = await getFreeGiftOptions();
  return <FreeGiftPopup options={options} />;
}
