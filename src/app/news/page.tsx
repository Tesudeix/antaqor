import type { Metadata } from "next";
import dbConnect from "@/lib/mongodb";
import News from "@/models/News";
import NewsFeed, { type NewsFeedProps } from "./NewsFeed";

const VALID_CATEGORIES = ["AI", "LLM", "Agents", "Research", "Бизнес", "Tool", "Монгол"] as const;
type Cat = (typeof VALID_CATEGORIES)[number];

type SearchParams = Promise<{
  q?: string;
  category?: string;
  page?: string;
}>;

function resolveCategory(raw?: string): NewsFeedProps["initialCategory"] {
  if (!raw) return "All";
  return (VALID_CATEGORIES as readonly string[]).includes(raw) ? (raw as Cat) : "All";
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const sp = await searchParams;
  const q = (sp.q || "").trim();
  const cat = resolveCategory(sp.category);

  const parts: string[] = [];
  if (q) parts.push(`"${q}"`);
  if (cat !== "All") parts.push(cat);
  const suffix = parts.length ? ` — ${parts.join(" · ")}` : "";

  const title = `AI Мэдээ Блог${suffix}`;
  const description = q
    ? `"${q}" хайлтын үр дүн — AI, LLM, agent, Монголын AI салбарын хамгийн сүүлийн үеийн мэдээ.`
    : cat !== "All"
      ? `${cat} ангиллын сүүлийн үеийн AI мэдээ — Антакор редакторын хянасан контент.`
      : "Монгол дахь AI, LLM, агент, Research-ын хамгийн сүүлийн үеийн мэдээ. Antaqor редакторын хянасан өдөр тутмын AI блог.";

  const canonical = (() => {
    const u = new URLSearchParams();
    if (cat !== "All") u.set("category", cat);
    if (q) u.set("q", q);
    const s = u.toString();
    return s ? `/news?${s}` : "/news";
  })();

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      title: `${title} · ANTAQOR`,
      description,
      url: canonical,
      siteName: "ANTAQOR",
      images: ["/opengraph-image"],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} · ANTAQOR`,
      description,
      images: ["/opengraph-image"],
    },
    keywords: [
      "AI мэдээ",
      "AI блог Монгол",
      "LLM шинэ",
      "Claude Mongolia",
      "ChatGPT мэдээ",
      "Монгол AI",
      "artificial intelligence news",
      "AI news Mongolia",
      "Antaqor блог",
      ...(cat !== "All" ? [cat] : []),
    ],
  };
}

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const q = (sp.q || "").trim();
  const category = resolveCategory(sp.category);

  await dbConnect();

  const query: Record<string, unknown> = { published: true };
  if (category !== "All") query.category = category;
  if (q) {
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(safe, "i");
    query.$or = [{ title: rx }, { excerpt: rx }, { tags: rx }];
  }

  const [rawItems, total] = await Promise.all([
    News.find(query).sort({ featured: -1, publishedAt: -1 }).limit(12).select("-content").lean(),
    News.countDocuments(query),
  ]);

  const items = rawItems.map((r) => {
    const n = r as unknown as {
      _id: { toString: () => string };
      title: string;
      slug: string;
      excerpt: string;
      coverImage: string;
      category: Cat;
      tags: string[];
      source?: string;
      authorName: string;
      authorAvatar?: string;
      featured: boolean;
      views: number;
      readingMinutes: number;
      publishedAt: Date;
    };
    return {
      _id: n._id.toString(),
      title: n.title,
      slug: n.slug,
      excerpt: n.excerpt || "",
      coverImage: n.coverImage || "",
      category: n.category,
      tags: n.tags || [],
      source: n.source,
      authorName: n.authorName,
      authorAvatar: n.authorAvatar,
      featured: !!n.featured,
      views: n.views || 0,
      readingMinutes: n.readingMinutes || 1,
      publishedAt: new Date(n.publishedAt).toISOString(),
    };
  });

  const pages = Math.max(1, Math.ceil(total / 12));

  const blogLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "ANTAQOR — AI Мэдээ Блог",
    url: "https://antaqor.com/news",
    description:
      "Монгол дахь AI, LLM, агент, Research-ын хамгийн сүүлийн үеийн мэдээ. Antaqor редакторын хянасан AI блог.",
    inLanguage: ["mn", "en"],
    publisher: {
      "@type": "Organization",
      name: "Antaqor",
      url: "https://antaqor.com",
    },
    blogPost: items.slice(0, 10).map((i) => ({
      "@type": "BlogPosting",
      headline: i.title,
      url: `https://antaqor.com/news/${i.slug}`,
      image: i.coverImage || undefined,
      datePublished: i.publishedAt,
      author: { "@type": "Person", name: i.authorName },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogLd) }}
      />
      <NewsFeed
        initialItems={items}
        initialCategory={category}
        initialQuery={q}
        initialPages={pages}
        initialTotal={total}
      />
    </>
  );
}

export const dynamic = "force-dynamic";
