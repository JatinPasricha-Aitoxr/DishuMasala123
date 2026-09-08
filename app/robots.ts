import type { MetadataRoute } from "next";

/**
 * robots.txt (CLAUDE.md §10). The disallow list mirrors what `app/sitemap.ts` leaves out, so a
 * crawler is never invited to a path we also tell it to skip.
 *
 * `/api/testing/` is disallowed belt-and-braces: those routes already 404 when NODE_ENV is
 * "production", but there is no reason to advertise them either.
 */
const BASE = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin/",
          "/account/",
          "/checkout",
          "/cart",
          "/order/",
          "/search",
          "/design-system",
          "/api/",
          "/login",
          "/register",
          "/reset-password",
          "/verify-email",
          "/auth/",
        ],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
