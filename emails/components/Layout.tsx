import { Body, Container, Head, Hr, Html, Preview, Section, Text } from "@react-email/components";
import type { ReactNode } from "react";

/**
 * Shared shell for every transactional email (PROMPTS.md Phase 5 item 10). Inline styles only —
 * email clients don't apply Tailwind/CSS-in-JS — using the same ink/ivory/gold tokens as the
 * storefront (CLAUDE.md §5.2), with plain web-safe font stacks (Georgia for the display role,
 * system sans for body) since most inboxes won't load Fraunces/Inter from Google Fonts at all.
 * `@react-email/render`'s `plainText: true` mode strips this down to real, readable plain text —
 * the semantic <Text>/<Section> structure below is what keeps that fallback sensible rather than
 * a wall of run-together words.
 */

const COLOR_BG = "#FCFAF6";
const COLOR_SURFACE = "#FFFFFF";
const COLOR_INK = "#17161A";
const COLOR_INK_2 = "#4A4750";
const COLOR_LINE = "#E7E1D8";
const COLOR_GOLD = "#B08D3F";

export function EmailLayout({
  previewText,
  children,
}: {
  previewText: string;
  children: ReactNode;
}) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={{ backgroundColor: COLOR_BG, margin: 0, padding: "32px 0", fontFamily: "Georgia, 'Times New Roman', serif" }}>
        <Container
          style={{
            backgroundColor: COLOR_SURFACE,
            maxWidth: "560px",
            margin: "0 auto",
            borderRadius: "12px",
            border: `1px solid ${COLOR_LINE}`,
            overflow: "hidden",
          }}
        >
          <Section style={{ borderTop: `4px solid ${COLOR_GOLD}` }} />
          <Section style={{ padding: "32px 32px 8px" }}>
            <Text
              style={{
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: "13px",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: COLOR_INK_2,
                margin: 0,
              }}
            >
              Dishu Food and Beverages
            </Text>
          </Section>
          <Section style={{ padding: "0 32px 32px" }}>{children}</Section>
          <Hr style={{ borderColor: COLOR_LINE, margin: 0 }} />
          <Section style={{ padding: "24px 32px" }}>
            <Text style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: "12px", color: COLOR_INK_2, margin: 0 }}>
              Dishu Food and Beverages · Sangrur, Punjab, India · +91 77102 19958
            </Text>
            <Text style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: "12px", color: COLOR_INK_2, margin: "4px 0 0" }}>
              This is a transactional email about an order placed on dishumasala.com.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export const emailStyles = {
  h1: { fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "24px", fontWeight: 600, color: COLOR_INK, margin: "0 0 8px" },
  body: { fontFamily: "Arial, Helvetica, sans-serif", fontSize: "15px", lineHeight: "1.6", color: COLOR_INK_2, margin: "0 0 16px" },
  label: {
    fontFamily: "Arial, Helvetica, sans-serif",
    fontSize: "11px",
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
    color: COLOR_INK_2,
    margin: "0 0 4px",
  },
  itemRow: { fontFamily: "Arial, Helvetica, sans-serif", fontSize: "14px", color: COLOR_INK, margin: "0 0 4px" },
  itemMeta: { fontFamily: "Arial, Helvetica, sans-serif", fontSize: "12px", color: COLOR_INK_2, margin: "0 0 10px" },
  totalRow: { fontFamily: "Arial, Helvetica, sans-serif", fontSize: "14px", color: COLOR_INK, margin: "0 0 4px" },
  grandTotal: { fontFamily: "Arial, Helvetica, sans-serif", fontSize: "17px", fontWeight: 700, color: COLOR_INK, margin: "8px 0 0" },
  buttonWrap: { margin: "20px 0" },
  button: {
    display: "inline-block",
    backgroundColor: COLOR_INK,
    color: "#FFFFFF",
    fontFamily: "Arial, Helvetica, sans-serif",
    fontSize: "14px",
    fontWeight: 600,
    padding: "12px 24px",
    borderRadius: "8px",
    textDecoration: "none",
  },
  hairline: { borderColor: COLOR_LINE, margin: "16px 0" },
};
