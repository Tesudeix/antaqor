import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Types } from "mongoose";
import dbConnect from "@/lib/mongodb";
import MarketProduct from "@/models/MarketProduct";

type Params = Promise<{ slug: string }>;

const CATEGORY_COLORS: Record<string, string> = {
  Prompt: "#A855F7",
  Course: "#22C55E",
  Template: "#06B6D4",
  Agent: "#F59E0B",
  Service: "#EC4899",
  Digital: "#3B82F6",
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

  const color = CATEGORY_COLORS[p.category] || "#EF2C58";
  const hasDiscount = p.compareAtPrice > p.price;

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
    <article className="mx-auto max-w-5xl pb-16">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productLd) }}
      />

      {/* Breadcrumb */}
      <nav className="mb-5 flex items-center gap-2 text-[11px] text-[#555]">
        <Link href="/" className="hover:text-[#AAA]">Нүүр</Link>
        <span className="text-[#2A2A2A]">/</span>
        <Link href="/market" className="hover:text-[#AAA]">Market</Link>
        <span className="text-[#2A2A2A]">/</span>
        <span className="truncate text-[#888]">{p.category}</span>
      </nav>

      <div className="grid gap-6 md:grid-cols-[1.1fr_1fr]">
        {/* Cover */}
        <div className="space-y-3">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[8px] border border-[rgba(255,255,255,0.06)] bg-[#1A1A1A]">
            {p.coverImage ? (
              <img src={p.coverImage} alt={p.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#1A1A1A] to-[#0D0D0D]">
                <span className="text-[10px] tracking-[0.3em] text-[#333]">ANTAQOR MARKET</span>
              </div>
            )}
            <div className="absolute top-3 left-3 rounded-full px-2.5 py-1 text-[10px] font-black uppercase" style={{ background: `${color}F2`, color: "#fff" }}>
              {p.category}
            </div>
          </div>
          {p.gallery.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {p.gallery.slice(0, 8).map((g, i) => (
                <div key={i} className="aspect-square overflow-hidden rounded-[6px] border border-[rgba(255,255,255,0.06)] bg-[#1A1A1A]">
                  <img src={g} alt="" className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col">
          <h1 className="text-[24px] font-black leading-tight text-[#E8E8E8] md:text-[32px]">
            {p.title}
          </h1>
          {p.summary && <p className="mt-3 text-[14px] leading-relaxed text-[#999]">{p.summary}</p>}

          <div className="mt-5 flex items-baseline gap-3">
            {hasDiscount && (
              <span className="text-[14px] text-[#555] line-through">{fmtPrice(p.compareAtPrice)}</span>
            )}
            <span className="text-[28px] font-black text-[#EF2C58]">{fmtPrice(p.price)}</span>
            {hasDiscount && (
              <span className="rounded-full bg-[rgba(34,197,94,0.12)] px-2 py-0.5 text-[10px] font-black text-[#22C55E]">
                −{Math.round(((p.compareAtPrice - p.price) / p.compareAtPrice) * 100)}% off
              </span>
            )}
          </div>

          {/* Primary CTA */}
          {p.externalUrl ? (
            <a
              href={p.externalUrl}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="group relative mt-5 inline-flex items-center justify-center gap-2 overflow-hidden rounded-[8px] bg-[#EF2C58] px-6 py-3.5 text-[14px] font-black text-white shadow-[0_0_24px_rgba(239,44,88,0.2)] transition hover:shadow-[0_0_36px_rgba(239,44,88,0.35)]"
            >
              <span className="relative z-10">{p.price === 0 ? "Татаж авах" : "Худалдан авах"}</span>
              <svg className="relative z-10 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            </a>
          ) : (
            <button
              className="mt-5 inline-flex items-center justify-center gap-2 rounded-[8px] border border-[rgba(255,255,255,0.08)] bg-[#0F0F0F] px-6 py-3.5 text-[13px] font-bold text-[#AAA]"
              disabled
            >
              Удахгүй авах боломжтой
            </button>
          )}

          {/* Seller */}
          <div className="mt-5 rounded-[8px] border border-[rgba(255,255,255,0.06)] bg-[#0F0F0F] p-3">
            <div className="text-[9px] font-bold uppercase tracking-wider text-[#555]">Seller</div>
            <div className="mt-1 flex items-center gap-2.5">
              {p.sellerAvatar ? (
                <img src={p.sellerAvatar} alt="" className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(239,44,88,0.12)] text-[12px] font-bold text-[#EF2C58]">
                  {p.sellerName.charAt(0)}
                </div>
              )}
              <div className="min-w-0 leading-tight">
                <div className="text-[13px] font-bold text-[#E8E8E8]">{p.sellerName}</div>
                <div className="text-[10px] text-[#555]">{p.views.toLocaleString()} үзсэн · {p.clicks.toLocaleString()} click</div>
              </div>
            </div>
          </div>

          {/* Tags */}
          {p.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {p.tags.map((t) => (
                <span key={t} className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[#111] px-2.5 py-1 text-[10px] text-[#888]">
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      {p.description && (
        <section className="mt-10 rounded-[8px] border border-[rgba(255,255,255,0.06)] bg-[#0F0F0F] p-5 md:p-7">
          <div className="mb-3 flex items-center gap-2">
            <div className="h-[2px] w-4 bg-[#EF2C58]" />
            <span className="text-[11px] font-bold tracking-[0.12em] text-[#E8E8E8]">ТАЙЛБАР</span>
          </div>
          <div className="whitespace-pre-line text-[14px] leading-[1.8] text-[#C8C8C8]">{p.description}</div>
        </section>
      )}

      {/* Back to market */}
      <div className="mt-10 text-center">
        <Link href="/market" className="text-[12px] font-semibold text-[#666] transition hover:text-[#EF2C58]">
          ← Market-д буцах
        </Link>
      </div>
    </article>
  );
}

export const dynamic = "force-dynamic";
