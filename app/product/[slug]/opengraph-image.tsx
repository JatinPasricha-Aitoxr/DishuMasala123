import { ImageResponse } from "next/og";
import { getProductBySlug } from "@/lib/db/queries/product-detail";
import { formatINR } from "@/lib/money";
import { DESIGN_TOKEN_HEX } from "@/lib/design-tokens";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * A generated, typographic OG image — real product name and price only, brand tokens for
 * background/rule (CLAUDE.md §5.2), no photography (none exists yet — CLAUDE.md §8) and nothing
 * fabricated (no award/certification/customer-count graphic).
 */
export default async function OpengraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  const price = product?.variants[0]?.pricePaise;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: DESIGN_TOKEN_HEX.bg,
          padding: "72px",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            width: 120,
            height: 6,
            borderRadius: 3,
            backgroundImage: `linear-gradient(100deg, ${DESIGN_TOKEN_HEX["brew-1"]}, ${DESIGN_TOKEN_HEX["brew-2"]}, ${DESIGN_TOKEN_HEX["brew-3"]}, ${DESIGN_TOKEN_HEX["brew-4"]}, ${DESIGN_TOKEN_HEX["brew-5"]}, ${DESIGN_TOKEN_HEX.citrus})`,
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", fontSize: 24, color: DESIGN_TOKEN_HEX["ink-3"], letterSpacing: 2, textTransform: "uppercase" }}>
            Dishu Masala
          </div>
          <div style={{ display: "flex", fontSize: 56, fontWeight: 600, color: DESIGN_TOKEN_HEX.ink, lineHeight: 1.15, maxWidth: 980 }}>
            {product?.name ?? "Dishu Masala"}
          </div>
          {price != null && (
            <div style={{ display: "flex", fontSize: 36, fontWeight: 600, color: DESIGN_TOKEN_HEX.ink }}>
              {formatINR(price)}
            </div>
          )}
        </div>
      </div>
    ),
    { ...size },
  );
}
