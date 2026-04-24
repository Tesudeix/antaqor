import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/admin/*", "/api/*", "/auth/*", "/chat"],
      },
      {
        userAgent: "Googlebot",
        allow: "/",
        disallow: ["/admin", "/admin/*", "/api/*", "/auth/*", "/chat"],
      },
    ],
    sitemap: "https://antaqor.com/sitemap.xml",
    host: "https://antaqor.com",
  };
}
