import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMagazineArticle, listMagazine, magazineCounts } from "@/lib/magazine";
import { renderMagazine } from "@/lib/magazineRender";
import MagazineReader from "@/components/magazine/MagazineReader";

/* /magazine/[slug] — нийтлэл. Үзэлт серверт тоологдоно (render бүрд +1),
   OG мета нь cover зургаар — хуваалцахад карт гарна. */
export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const a = await getMagazineArticle(slug, false);
  if (!a) return { title: "Нийтлэл олдсонгүй" };
  const url = `/magazine/${encodeURIComponent(a.slug)}`;
  return {
    title: a.title,
    description: a.excerpt || undefined,
    alternates: { canonical: url },
    openGraph: { type: "article", title: a.title, description: a.excerpt || undefined, url, images: a.coverImage ? [{ url: a.coverImage }] : undefined, publishedTime: a.publishedAt },
    twitter: { card: "summary_large_image", title: a.title, description: a.excerpt || undefined, images: a.coverImage ? [a.coverImage] : undefined },
  };
}

export default async function MagazineArticlePage({ params }: { params: Params }) {
  const { slug } = await params;
  const article = await getMagazineArticle(slug, true);
  if (!article) notFound();
  const [counts, related] = await Promise.all([magazineCounts(), listMagazine(article.category, 4)]);
  return (
    <MagazineReader
      article={{ ...article, content: undefined }}
      html={renderMagazine(article.content || "")}
      counts={counts}
      related={related.filter((r) => r.slug !== article.slug).slice(0, 3)}
    />
  );
}
