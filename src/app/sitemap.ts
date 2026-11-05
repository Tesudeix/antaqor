import type { MetadataRoute } from "next";
import dbConnect from "@/lib/mongodb";
import News from "@/models/News";
import MarketProduct from "@/models/MarketProduct";

const BASE_URL = "https://antaqor.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`, changeFrequency: "daily", priority: 1.0, lastModified: new Date() },
    /* 2026-10-26: /community (404), /clan (→ /pricing) хасагдав — sitemap-д зөвхөн 200 буцаадаг хуудас. */
    { url: `${BASE_URL}/content-agent`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE_URL}/pricing`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE_URL}/news`, changeFrequency: "hourly", priority: 0.9, lastModified: new Date() },
    { url: `${BASE_URL}/market`, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE_URL}/prompts`, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE_URL}/explore`, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE_URL}/services`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE_URL}/calendar`, changeFrequency: "daily", priority: 0.6 },
    { url: `${BASE_URL}/classroom`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE_URL}/members`, changeFrequency: "daily", priority: 0.5 },
    { url: `${BASE_URL}/magazine`, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE_URL}/founders`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${BASE_URL}/leaderboard`, changeFrequency: "daily", priority: 0.5 },
    { url: `${BASE_URL}/partnerships`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/tools/tiktok`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE_URL}/tools/youtube`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE_URL}/tools/youtube-mp3`, changeFrequency: "monthly", priority: 0.4 },
  ];

  const dynamicRoutes: MetadataRoute.Sitemap = [];

  try {
    await dbConnect();

    const articles = await News.find({ published: true })
      .sort({ publishedAt: -1 })
      .select("slug updatedAt publishedAt")
      .limit(2000)
      .lean();

    for (const a of articles as unknown as { slug: string; updatedAt?: Date; publishedAt?: Date }[]) {
      dynamicRoutes.push({
        url: `${BASE_URL}/news/${a.slug}`,
        changeFrequency: "weekly",
        priority: 0.8,
        lastModified: a.updatedAt || a.publishedAt || new Date(),
      });
    }
  } catch {
    // news unavailable — static routes still ship
  }

  try {
    const products = await MarketProduct.find({})
      .sort({ updatedAt: -1 })
      .select("slug updatedAt")
      .limit(500)
      .lean();

    for (const p of products as unknown as { slug?: string; updatedAt?: Date }[]) {
      if (!p.slug) continue;
      dynamicRoutes.push({
        url: `${BASE_URL}/market/${p.slug}`,
        changeFrequency: "weekly",
        priority: 0.7,
        lastModified: p.updatedAt || new Date(),
      });
    }
  } catch {
    // market unavailable — fine
  }

  return [...staticRoutes, ...dynamicRoutes];
}
