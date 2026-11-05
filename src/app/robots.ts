import type { MetadataRoute } from "next";

/* ─── robots — хайлтын болон AI мөлхөгчид ────────────────────────────────
   BASE_URL нь `layout.tsx`-ийн `metadataBase`, `sitemap.ts`-ийн BASE_URL
   хоёртой ЯГ таарах ёстой. Гурав зөрөх нь домэйнүүд өөр хоорондоо
   өрсөлдөж, эрх мэдэл нь хуваагдана.

   AI мөлхөгчдийг НЭР ЗААЖ зөвшөөрсөн шалтгаан: ChatGPT, Claude, Perplexity,
   Gemini зэрэг нь хариултдаа эх сурвалж татахдаа тус тусын нэрлэсэн агентаар
   ирдэг. `User-agent: *` дор зөвшөөрөгдсөн байх нь ихэнхдээ хангалттай ч,
   нэрээр нь бичсэн мөр байхад л зарим нь эргэлзээгүй мөлхдөг. Хаалттай
   хэсгүүд (админ, API, нэвтрэлт, чат) тэдэнд ч хаалттай хэвээр — тэнд
   хувь хүний өгөгдөл байна. */

const BASE_URL = "https://antaqor.com";

// Хэн ч, хэзээ ч орж болохгүй зүйлс. Ганц газар бичээд бүх агентад тараана.
const PRIVATE_PATHS = ["/admin", "/admin/*", "/api/*", "/auth/*", "/chat"];

const AI_AGENTS = [
  "GPTBot",          // OpenAI / ChatGPT
  "OAI-SearchBot",   // ChatGPT Search
  "ChatGPT-User",
  "ClaudeBot",       // Anthropic / Claude
  "Claude-User",
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",  // Gemini / AI Overviews
  "Applebot-Extended",
  "CCBot",            // Common Crawl — олон загварын сургалтын суурь
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
      { userAgent: "Googlebot", allow: "/", disallow: PRIVATE_PATHS },
      ...AI_AGENTS.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: PRIVATE_PATHS,
      })),
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
