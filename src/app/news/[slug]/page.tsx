import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Types } from "mongoose";
import dbConnect from "@/lib/mongodb";
import News from "@/models/News";
import NewsArticleView, { type Article } from "./NewsArticle";

type Params = Promise<{ slug: string }>;

async function loadArticle(slug: string, increment: boolean): Promise<{ article: Article; related: Article[] } | null> {
  await dbConnect();

  // Next.js 16 may pass the dynamic segment URL-encoded for non-ASCII slugs.
  // Try decoded form first; fall back to raw if decoding fails or doesn't match.
  let decoded = slug;
  try { decoded = decodeURIComponent(slug); } catch { /* keep raw */ }
  const candidates = Array.from(new Set([
    decoded.toLowerCase(),
    slug.toLowerCase(),
  ]));

  const raw = increment
    ? await News.findOneAndUpdate(
        { slug: { $in: candidates }, published: true },
        { $inc: { views: 1 } },
        { new: true }
      ).lean()
    : await News.findOne({ slug: { $in: candidates }, published: true }).lean();

  if (!raw) return null;

  const n = raw as unknown as {
    _id: Types.ObjectId;
    title: string;
    slug: string;
    excerpt: string;
    content: string;
    coverImage: string;
    category: Article["category"];
    tags: string[];
    source: string;
    sourceUrl: string;
    authorName: string;
    authorAvatar: string;
    views: number;
    readingMinutes: number;
    publishedAt: Date;
  };

  const related = await News.find({
    published: true,
    _id: { $ne: n._id },
    category: n.category,
  })
    .sort({ publishedAt: -1 })
    .limit(3)
    .select("-content")
    .lean();

  const normalize = (o: typeof n): Article => ({
    _id: o._id.toString(),
    title: o.title,
    slug: o.slug,
    excerpt: o.excerpt || "",
    content: o.content || "",
    coverImage: o.coverImage || "",
    category: o.category,
    tags: o.tags || [],
    source: o.source || "",
    sourceUrl: o.sourceUrl || "",
    authorName: o.authorName || "Antaqor",
    authorAvatar: o.authorAvatar || "",
    views: o.views || 0,
    readingMinutes: o.readingMinutes || 1,
    publishedAt: new Date(o.publishedAt).toISOString(),
  });

  return {
    article: normalize(n),
    related: (related as unknown as (typeof n)[]).map(normalize),
  };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const loaded = await loadArticle(slug, false);
  if (!loaded) {
    return {
      title: "Мэдээ олдсонгүй",
      description: "Энэ мэдээ устгагдсан эсвэл хаяг буруу.",
      robots: { index: false, follow: false },
    };
  }
  const { article } = loaded;
  const url = `/news/${article.slug}`;
  const description =
    article.excerpt ||
    `${article.title} — ${article.category} ангилалын AI мэдээ Antaqor блогоос.`;

  return {
    title: article.title,
    description,
    alternates: { canonical: url },
    keywords: [
      ...article.tags,
      article.category,
      "AI мэдээ",
      "AI блог",
      "Antaqor",
      "Mongolia AI",
    ],
    authors: [{ name: article.authorName }],
    openGraph: {
      type: "article",
      title: article.title,
      description,
      url,
      siteName: "ANTAQOR",
      locale: "mn_MN",
      publishedTime: article.publishedAt,
      authors: [article.authorName],
      tags: article.tags,
      section: article.category,
      images: article.coverImage
        ? [{
            url: article.coverImage,
            alt: article.title,
            width: 1200,
            height: 630,
            type: "image/webp",
          }]
        : [{ url: "/opengraph-image", width: 1200, height: 630, alt: article.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description,
      images: article.coverImage ? [article.coverImage] : ["/opengraph-image"],
      creator: "@antaqor",
      site: "@antaqor",
    },
  };
}

export default async function ArticlePage({ params }: { params: Params }) {
  const { slug } = await params;
  const loaded = await loadArticle(slug, true);
  if (!loaded) notFound();

  const { article, related } = loaded;

  const articleLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    description: article.excerpt,
    image: article.coverImage ? [article.coverImage] : ["https://antaqor.com/opengraph-image"],
    datePublished: article.publishedAt,
    dateModified: article.publishedAt,
    author: [
      {
        "@type": "Person",
        name: article.authorName,
      },
    ],
    publisher: {
      "@type": "Organization",
      name: "Antaqor",
      logo: {
        "@type": "ImageObject",
        url: "https://antaqor.com/favicon.png",
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://antaqor.com/news/${article.slug}`,
    },
    articleSection: article.category,
    keywords: article.tags.join(", "),
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Нүүр", item: "https://antaqor.com/" },
      { "@type": "ListItem", position: 2, name: "Блог", item: "https://antaqor.com/news" },
      {
        "@type": "ListItem",
        position: 3,
        name: article.title,
        item: `https://antaqor.com/news/${article.slug}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <NewsArticleView article={article} related={related} />
    </>
  );
}

export const dynamic = "force-dynamic";
