"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";

// ─────────────────────────────────────────────────────────────────────────
// MarketCard — an Adidas-grade e-commerce product card, adapted to Antaqor's
// dark market. Patterns: hover image crossfade → alternate angle, a colorway
// strip built from the product gallery (click a swatch to swap the main
// image), persistent wishlist heart, discount pricing, plain-text status
// badge. All hover states also fire on keyboard focus (group-focus-within).
// CSS transitions for border/crossfade/strip; motion for entrance + heart pop.
// ─────────────────────────────────────────────────────────────────────────

export interface MarketCardData {
  slug: string;
  title: string;
  summary?: string;
  coverImage: string;
  gallery?: string[];
  category: string;
  price: number;
  compareAtPrice?: number;
  sellerName?: string;
  views?: number;
  featured?: boolean;
  createdAt?: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  Prompt: "#2E29FF", Course: "#2E29FF", Template: "#06B6D4",
  Agent: "#F59E0B", Service: "#2E29FF", Digital: "#2E29FF",
};

function fmtPrice(mnt: number): string {
  return mnt === 0 ? "Үнэгүй" : `₮${mnt.toLocaleString("mn-MN")}`;
}

const WISHLIST_KEY = "antaqor_wishlist";
function readWishlist(): string[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(WISHLIST_KEY) || "[]"); } catch { return []; }
}

export default function MarketCard({ p, index = 0 }: { p: MarketCardData; index?: number }) {
  const color = CATEGORY_COLORS[p.category] || "#2E29FF";
  const gallery = (p.gallery || []).filter(Boolean);
  // Swatches = cover + gallery, de-duplicated. First is the default angle.
  const swatches = Array.from(new Set([p.coverImage, ...gallery].filter(Boolean)));
  const hasVariants = swatches.length > 1;
  const altImage = hasVariants ? swatches[1] : "";

  const [main, setMain] = useState(swatches[0] || "");
  const [pinned, setPinned] = useState(false); // a swatch was explicitly chosen
  const [wished, setWished] = useState(false);

  useEffect(() => { setWished(readWishlist().includes(p.slug)); }, [p.slug]);

  const toggleWish = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault(); e.stopPropagation();
    const list = readWishlist();
    const next = list.includes(p.slug) ? list.filter((s) => s !== p.slug) : [...list, p.slug];
    try { localStorage.setItem(WISHLIST_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    setWished(next.includes(p.slug));
  };

  const pickSwatch = (e: React.MouseEvent, src: string) => {
    e.preventDefault(); e.stopPropagation();
    setMain(src); setPinned(true);
  };

  const hasDiscount = (p.compareAtPrice || 0) > p.price;
  const off = hasDiscount ? Math.round((((p.compareAtPrice || 0) - p.price) / (p.compareAtPrice || 1)) * 100) : 0;
  const isNew = p.createdAt ? Date.now() - new Date(p.createdAt).getTime() < 14 * 864e5 : false;
  const badge = isNew ? "Шинэ" : p.featured ? "Онцлох" : "";
  const href = `/market/${p.slug}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.4), ease: [0.22, 1, 0.36, 1] }}
      className="group relative flex flex-col border border-transparent transition-all duration-200 hover:border-[rgba(255,255,255,0.5)] hover:shadow-[0_14px_40px_rgba(0,0,0,0.35)] focus-within:border-[rgba(255,255,255,0.5)]"
    >
      {/* Image area */}
      <div className="relative aspect-square overflow-hidden bg-[#F2F2F4]">
        <Link href={href} className="block h-full w-full outline-none" aria-label={p.title}>
          {main ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={main} alt={p.title} loading={index < 4 ? "eager" : "lazy"}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
              {/* alternate angle — crossfades in on hover/focus unless a swatch is pinned */}
              {altImage && !pinned && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={altImage} alt="" aria-hidden loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100" />
              )}
            </>
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#F2F2F4] to-[#f7f9fb]">
              <span className="text-[10px] tracking-[0.3em] text-[#d5dce3]">ANTAQOR</span>
            </div>
          )}
        </Link>

        {/* category (top-left) */}
        <span className="pointer-events-none absolute left-2 top-2 rounded-[4px] px-2 py-0.5 text-[11px] font-black uppercase" style={{ background: `${color}F2`, color: "#fff" }}>
          {p.category}
        </span>

        {/* wishlist heart (top-right) — sits above the link */}
        <button
          type="button"
          onClick={toggleWish}
          aria-pressed={wished}
          aria-label={wished ? "Хадгалснаас хасах" : "Хадгалах"}
          className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-[4px] bg-black/35 backdrop-blur transition hover:bg-black/55 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2E29FF]"
        >
          <motion.svg
            key={wished ? "on" : "off"}
            initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 18 }}
            className="h-4 w-4" viewBox="0 0 24 24"
            fill={wished ? "#2E29FF" : "none"} stroke={wished ? "#2E29FF" : "#fff"} strokeWidth={1.8}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
          </motion.svg>
        </button>

        {/* colorway strip — reveals between image and price on hover/focus */}
        {hasVariants && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex translate-y-2 items-center gap-1.5 bg-gradient-to-t from-black/55 to-transparent p-2 opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
              {swatches.slice(0, 7).map((s) => {
                const active = s === main;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={(e) => pickSwatch(e, s)}
                    aria-label="Хувилбар солих"
                    className="pointer-events-auto relative h-8 w-8 shrink-0 overflow-hidden border transition"
                    style={{ borderColor: active ? "#fff" : "rgba(255,255,255,0.35)" }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s} alt="" className="h-full w-full object-cover" />
                    {active && <span className="absolute inset-x-1 bottom-0 h-[2px] bg-white" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Details */}
      <Link href={href} className="flex flex-1 flex-col gap-0.5 p-3 outline-none">
        {/* price */}
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          {hasDiscount ? (
            <>
              <span className="text-[15px] font-black text-[#E32B2B]">{fmtPrice(p.price)}</span>
              <span className="text-[11px] text-[#E2E4E8] line-through">{fmtPrice(p.compareAtPrice || 0)}</span>
              <span className="text-[11px] font-bold text-[#E32B2B]">−{off}%</span>
            </>
          ) : (
            <span className="text-[15px] font-black" style={{ color: p.price === 0 ? "#22C55E" : "#0e1726" }}>{fmtPrice(p.price)}</span>
          )}
        </div>

        {/* name */}
        <h3 className="mt-0.5 line-clamp-2 text-[13px] font-semibold leading-snug text-[#0e1726] transition-colors group-hover:text-[#2E29FF]">
          {p.title}
        </h3>

        {/* seller / collection */}
        {p.sellerName && <div className="text-[11px] text-[#767677]">{p.sellerName}</div>}

        {/* variant count */}
        {hasVariants && <div className="text-[11px] text-[#767677]">{swatches.length} хувилбар</div>}

        {/* status + availability */}
        <div className="mt-0.5 flex items-center gap-2">
          {badge && <span className="text-[11px] font-bold text-[#0e1726]">{badge}</span>}
          {(p.views || 0) > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-[#E2E4E8]">
              <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><circle cx="12" cy="12" r="3" /></svg>
              {(p.views || 0).toLocaleString()}
            </span>
          )}
        </div>
      </Link>
    </motion.div>
  );
}
