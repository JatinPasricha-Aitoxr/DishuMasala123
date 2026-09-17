import type { MetadataRoute } from "next";

/**
 * Next's file-convention manifest route (serves at /manifest.webmanifest). Android's install
 * criteria need name/short_name, a 192 and a 512 icon (plus a maskable one for the adaptive-icon
 * shape Android actually renders on the home screen — public/icons/maskable-512.png keeps the
 * wordmark inside the ~80% safe zone so it isn't clipped), start_url and a standalone/minimal-ui
 * display mode, all served over HTTPS. `theme_color`/`background_color` match the ivory ground
 * token (CLAUDE.md §5.2 --color-bg) so the splash screen and status bar don't flash white.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dishu Masala — Organic Indian Spices & Herbal Teas",
    short_name: "Dishu Masala",
    description:
      "Premium organic Indian spices and herbal teas from Dishu Food and Beverages, including the colour-changing Blue Tea.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#FCFAF6",
    theme_color: "#FCFAF6",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
