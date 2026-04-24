import type { MetadataRoute } from "next";
import dbConnect from "@/lib/mongodb";
import News from "@/models/News";

const BASE_URL = "https://antaqor.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`, changeFrequency: "daily", priority: 1.0, lastModified: new Date() },
    { url: `${BASE_URL}/news`, changeFrequency: "hourly", priority: 0.9, lastModified: new Date() },
    { url: `${BASE_URL}/services`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE_URL}/calendar`, changeFrequency: "daily", priority: 0.6 },
    { url: `${BASE_URL}/classroom`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE_URL}/members`, changeFrequency: "daily", priority: 0.5 },
    { url: `${BASE_URL}/tools/youtube-mp3`, changeFrequency: "monthly", priority: 0.4 },
  ];

  try {
    await dbConnect();
    const articles = await News.find({ published: true })
      .sort({ publishedAt: -1 })
      .select("slug updatedAt publishedAt")
      .limit(2000)
      .lean();

    const articleRoutes: MetadataRoute.Sitemap = (articles as unknown as { slug: string; updatedAt?: Date; publishedAt?: Date }[]).map((a) => ({
      url: `${BASE_URL}/news/${a.slug}`,
      changeFrequency: "weekly",
      priority: 0.8,
      lastModified: a.updatedAt || a.publishedAt || new Date(),
    }));

    return [...staticRoutes, ...articleRoutes];
  } catch {
    return staticRoutes;
  }
}
