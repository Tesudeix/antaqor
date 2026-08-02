import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Types } from "mongoose";
import dbConnect from "@/lib/mongodb";
import MarketProduct from "@/models/MarketProduct";

import ProductPayButton from "./ProductPayButton";
import MarketCard, { type MarketCardData } from "@/components/MarketCard";

type Params = Promise<{ slug: string }>;

const CATEGORY_COLORS: Record<string, string> = {
  Prompt: "#1080CA",
  Course: "#1080CA",
  Template: "#06B6D4",
  Agent: "#F59E0B",
  Service: "#EC4899",
  Digital: "#1080CA",
};

function fmtPrice(mnt: number): string {
  if (mnt === 0) return "Үнэгүй";
  return `₮${mnt.toLocaleString("mn-MN")}`;
}

interface Product {
  _id: string;
  title: string;
  slug: string;
  summary: string;
  description: string;
  coverImage: string;
  gallery: string[];
  category: string;
  price: number;
  compareAtPrice: number;
  sellerName: string;
  sellerAvatar: string;
  externalUrl: string;
  tags: string[];
  views: number;
  clicks: number;
  createdAt: string;
}

async function loadProduct(slug: string): Promise<Product | null> {
  await dbConnect();
  const raw = await MarketProduct.findOneAndUpdate(
    { slug: slug.toLowerCase(), published: true, approved: true },
    { $inc: { views: 1 } },
    { new: true }
  ).lean();
  if (!raw) return null;
  const r = raw as unknown as {
    _id: Types.ObjectId; title: string; slug: string; summary: string; description: string;
    coverImage: string; gallery: string[]; category: string; price: number; compareAtPrice: number;
    sellerName: string; sellerAvatar: string; externalUrl: string; tags: string[];
    views: number; clicks: number; createdAt: Date;
  };
  return {
    _id: r._id.toString(),
    title: r.title,
    slug: r.slug,
    summary: r.summary || "",
    description: r.description || "",
    coverImage: r.coverImage || "",
    gallery: r.gallery || [],
    category: r.category,
    price: r.price || 0,
    compareAtPrice: r.compareAtPrice || 0,
    sellerName: r.sellerName || "Antaqor",
    sellerAvatar: r.sellerAvatar || "",
    externalUrl: r.externalUrl || "",
    tags: r.tags || [],
    views: r.views || 0,
    clicks: r.clicks || 0,
    createdAt: new Date(r.createdAt).toISOString(),
  };
}

// Related products — same category first, newest/most-viewed. Excludes self.
async function loadRelated(category: string, excludeSlug: string): Promise<MarketCardData[]> {
  await dbConnect();
  const raw = await MarketProduct.find({
    published: true, approved: true, category, slug: { $ne: excludeSlug },
  }).sort({ featured: -1, views: -1, createdAt: -1 }).limit(8).select("-description").lean();
  return (raw as unknown as Record<string, unknown>[]).map((r) => ({
    slug: String(r.slug), title: String(r.title), summary: String(r.summary || ""),
    coverImage: String(r.coverImage || ""), gallery: (r.gallery as string[]) || [],
    category: String(r.category), price: Number(r.price) || 0, compareAtPrice: Number(r.compareAtPrice) || 0,
    sellerName: String(r.sellerName || "Antaqor"), views: Number(r.views) || 0, featured: !!r.featured,
    createdAt: r.createdAt ? new Date(r.createdAt as string).toISOString() : "",
  }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const p = await loadProduct(slug);
  if (!p) {
    return { title: "Market — Олдсонгүй", robots: { index: false, follow: false } };
  }
  return {
    title: p.title,
    description: p.summary || `${p.title} — ${p.category} category in Antaqor Market.`,
    alternates: { canonical: `/market/${p.slug}` },
    openGraph: {
      type: "website",
      title: p.title,
      description: p.summary,
      url: `/market/${p.slug}`,
      images: p.coverImage ? [{ url: p.coverImage, alt: p.title }] : ["/opengraph-image"],
    },
  };
}

export default async function ProductPage({ params }: { params: Params }) {
  const { slug } = await params;
  const p = await loadProduct(slug);
  if (!p) notFound();

  const color = CATEGORY_COLORS[p.category] || "#1080CA";
  const hasDiscount = p.compareAtPrice > p.price;
  const related = await loadRelated(p.category, p.slug);

  const productLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.title,
    description: p.summary,
    image: p.coverImage || undefined,
    category: p.category,
    brand: { "@type": "Brand", name: "Antaqor Market" },
    offers: {
      "@type": "Offer",
      priceCurrency: "MNT",
      price: p.price,
      availability: "https://schema.org/InStock",
      url: `https://antaqor.com/market/${p.slug}`,
    },
  };

  return (
    <article className="mx-auto max-w-5xl pb-28 md:pb-16">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productLd) }}
      />

      {/* Breadcrumb */}
      <nav className="mb-5 flex items-center gap-2 text-[11px] text-[#94a3b8]">
        <Link href="/" className="hover:text-[#475569]">Нүүр</Link>
        <span className="text-[#dde3ea]">/</span>
        <Link href="/market" className="hover:text-[#475569]">Market</Link>
        <span className="text-[#dde3ea]">/</span>
        <span className="truncate text-[#6b7280]">{p.category}</span>
      </nav>

      <div className="grid gap-6 md:grid-cols-[1.1fr_1fr]">
        {/* Cover */}
        <div className="space-y-3">
          <div className="relative aspect-[4/3] overflow-hidden rounded-none border border-[rgba(15,23,38,0.06)] bg-[#F2F2F4]">
            {p.coverImage ? (
              <img src={p.coverImage} alt={p.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#F2F2F4] to-[#f7f9fb]">
                <span className="text-[10px] tracking-[0.3em] text-[#d5dce3]">ANTAQOR MARKET</span>
              </div>
            )}
            <div className="absolute top-3 left-3 rounded-full px-2.5 py-1 text-[10px] font-black uppercase" style={{ background: `${color}F2`, color: "#fff" }}>
              {p.category}
            </div>
          </div>
          {p.gallery.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {p.gallery.slice(0, 8).map((g, i) => (
                <div key={i} className="aspect-square overflow-hidden rounded-none border border-[rgba(15,23,38,0.06)] bg-[#F2F2F4]">
                  <img src={g} alt="" className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col">
          <h1 className="text-[24px] font-black leading-tight text-[#0e1726] md:text-[32px]">
            {p.title}
          </h1>
          {p.summary && <p className="mt-3 text-[14px] leading-relaxed text-[#5b6573]">{p.summary}</p>}

          <div className="mt-5 flex items-baseline gap-3">
            {hasDiscount && (
              <span className="text-[14px] text-[#94a3b8] line-through">{fmtPrice(p.compareAtPrice)}</span>
            )}
            <span className="text-[28px] font-black text-[#1080CA]">{fmtPrice(p.price)}</span>
            {hasDiscount && (
              <span className="rounded-full bg-[rgba(16,128,202,0.12)] px-2 py-0.5 text-[10px] font-black text-[#1080CA]">
                −{Math.round(((p.compareAtPrice - p.price) / p.compareAtPrice) * 100)}% off
              </span>
            )}
          </div>

          {/* Primary CTA — QR payment (reuses static /qpay.png) */}
          <ProductPayButton slug={p.slug} price={p.price} title={p.title} />
          {p.externalUrl && (
            <a href={p.externalUrl} target="_blank" rel="noopener noreferrer sponsored" className="mt-3 block text-[12px] text-[#6b7280] underline hover:text-[#5b6573]">Гадаад линкээр авах →</a>
          )}

          {/* Trust row — reduces purchase anxiety at the CTA */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { t: "Шуурхай хүргэлт", d: "Төлмөгц нээгдэнэ", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
              { t: "Найдвартай", d: "QPay · банк шилжүүлэг", icon: "M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
              { t: "Дэмжлэг", d: "Асуудалд тусална", icon: "M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM12 15.75a3.75 3.75 0 003.75-3.75h-7.5A3.75 3.75 0 0012 15.75zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
            ].map((f) => (
              <div key={f.t} className="rounded-none border border-[rgba(15,23,38,0.06)] bg-[#f2f5f8] p-2.5 text-center">
                <svg className="mx-auto h-4 w-4 text-[#1080CA]" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={f.icon} /></svg>
                <div className="mt-1.5 text-[10px] font-bold text-[#0e1726]">{f.t}</div>
                <div className="text-[9px] leading-tight text-[#94a3b8]">{f.d}</div>
              </div>
            ))}
          </div>

          {/* Seller */}
          <div className="mt-5 rounded-none border border-[rgba(15,23,38,0.06)] bg-[#f2f5f8] p-3">
            <div className="text-[9px] font-bold uppercase tracking-wider text-[#94a3b8]">Seller</div>
            <div className="mt-1 flex items-center gap-2.5">
              {p.sellerAvatar ? (
                <img src={p.sellerAvatar} alt="" className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(16,128,202,0.12)] text-[12px] font-bold text-[#1080CA]">
                  {p.sellerName.charAt(0)}
                </div>
              )}
              <div className="min-w-0 leading-tight">
                <div className="text-[13px] font-bold text-[#0e1726]">{p.sellerName}</div>
                <div className="text-[10px] text-[#94a3b8]">{p.views.toLocaleString()} үзсэн · {p.clicks.toLocaleString()} click</div>
              </div>
            </div>
          </div>

          {/* Tags */}
          {p.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {p.tags.map((t) => (
                <span key={t} className="rounded-full border border-[rgba(15,23,38,0.08)] bg-[#eef2f6] px-2.5 py-1 text-[10px] text-[#6b7280]">
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      {p.description && (
        <section className="mt-10 rounded-none border border-[rgba(15,23,38,0.06)] bg-[#f2f5f8] p-5 md:p-7">
          <div className="mb-3 flex items-center gap-2">
            <div className="h-[2px] w-4 bg-[#1080CA]" />
            <span className="text-[11px] font-bold tracking-[0.12em] text-[#0e1726]">ТАЙЛБАР</span>
          </div>
          <div className="whitespace-pre-line text-[14px] leading-[1.8] text-[#C8C8C8]">{p.description}</div>
        </section>
      )}

      {/* Related products */}
      {related.length > 0 && (
        <section className="mt-12">
          <div className="mb-4 flex items-center gap-2">
            <div className="h-[2px] w-4 bg-[#1080CA]" />
            <span className="text-[11px] font-bold tracking-[0.12em] text-[#0e1726]">ХОЛБООТОЙ БҮТЭЭГДЭХҮҮН</span>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {related.slice(0, 4).map((r, i) => (
              <MarketCard key={r.slug} p={r} index={i} />
            ))}
          </div>
        </section>
      )}

      {/* Back to market */}
      <div className="mt-10 text-center">
        <Link href="/market" className="text-[12px] font-semibold text-[#6b7280] transition hover:text-[#1080CA]">
          ← Market-д буцах
        </Link>
      </div>

      {/* Mobile sticky buy bar — CTA always in reach while scrolling */}
      <div className="fixed inset-x-0 z-40 border-t border-[rgba(15,23,38,0.1)] bg-[#f7f9fb] px-4 py-2.5 shadow-[0_-8px_24px_rgba(0,0,0,0.25)] md:hidden"
        style={{ bottom: "calc(58px + env(safe-area-inset-bottom))" }}>
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <div className="min-w-0 shrink-0">
            <div className="text-[9px] font-bold uppercase tracking-wider text-[#94a3b8]">Үнэ</div>
            <div className="text-[18px] font-black leading-none" style={{ color: p.price === 0 ? "#22C55E" : "#1080CA" }}>{fmtPrice(p.price)}</div>
          </div>
          <ProductPayButton slug={p.slug} price={p.price} title={p.title} className="flex-1 px-4 py-3 text-[13px]" />
        </div>
      </div>
    </article>
  );
}

export const dynamic = "force-dynamic";
