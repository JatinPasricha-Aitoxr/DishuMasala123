import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { ToastProvider } from "@/components/ui/Toast";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { AccountSync } from "@/components/auth/AccountSync";
import { getDisplaySessionUser } from "@/lib/auth/session";
import "./globals.css";

// Fraunces is a genuinely variable Google font (wght 100–900 plus an optical-size axis) — loading
// it without a fixed `weight` gives the full variable range next/font can serve, and `axes`
// explicitly pulls in `opsz` on top of the default `wght` axis so display sizes get the right
// optical cut, per CLAUDE.md §5.2 ("Fraunces (variable, 400–700, opsz)"). CSS then only ever
// requests 400/500/600/700 per the type scale (CLAUDE.md §5.3).
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["opsz"],
});

// Inter is used at the three static weights CLAUDE.md §5.2 calls for.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Dishu Masala — Organic Indian Spices & Herbal Teas",
    template: "%s — Dishu Masala",
  },
  description:
    "Premium organic Indian spices and herbal teas from Dishu Food and Beverages, including the colour-changing Blue Tea.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Resolved server-side so the header, the wishlist toggle and the cart/wishlist merge all see
  // the same session without any Supabase client running in the browser. Deliberately the cheap
  // claims-only read — it runs on every render, including every revalidatePath a server action
  // triggers — and carries no role, because this is display state, never authorization.
  const sessionUser = await getDisplaySessionUser();

  return (
    <html lang="en-IN" className={`${fraunces.variable} ${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-bg text-ink">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-ink focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-surface"
        >
          Skip to content
        </a>
        <SessionProvider user={sessionUser}>
          <ToastProvider>
            <AccountSync />
            <Header />
            <main id="main-content" className="flex-1">
              {children}
            </main>
            <Footer />
            <CartDrawer />
          </ToastProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
