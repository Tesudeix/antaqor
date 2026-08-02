"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface Testimonial {
  _id: string;
  name: string;
  avatar?: string;
  role?: string;
  result: string;
  quote?: string;
  link?: string;
  featured?: boolean;
}

interface Props {
  /** Show in compact 3-card grid (default) or single featured hero variant */
  variant?: "grid" | "hero";
  /** Max number of cards to display */
  limit?: number;
  /** Hide section entirely when DB is empty (default). Set false to show skeleton during load */
  hideIfEmpty?: boolean;
  /** Custom eyebrow label */
  eyebrow?: string;
  /** Custom heading */
  heading?: string;
  className?: string;
  /** Light theme — white landing */
  light?: boolean;
}

export default function Testimonials({
  variant = "grid",
  limit = 3,
  hideIfEmpty = true,
  eyebrow = "ГИШҮҮДИЙН ҮР ДҮН",
  heading = "Бодит хүмүүс · Бодит ажил",
  className = "",
  light = false,
}: Props) {
  const [items, setItems] = useState<Testimonial[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/testimonials?limit=${limit}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setItems(d?.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [limit]);

  if (loading && !hideIfEmpty) {
    return (
      <section className={className}>
        <SkeletonGrid count={limit} />
      </section>
    );
  }

  if (loading) return null;
  if (!items || items.length === 0) return null;

  if (variant === "hero" && items[0]) {
    return <HeroTestimonial testimonial={items[0]} className={className} />;
  }

  return (
    <section className={className}>
      <div className="mb-3 flex items-center gap-2">
        <div className={`h-[2px] w-4 ${light ? "bg-[#1080CA]" : "bg-[#1080CA]"}`} />
        <span className={`text-[11px] font-bold tracking-[0.15em] ${light ? "text-[#0E1726]" : "text-[#0e1726]"}`}>{eyebrow}</span>
      </div>
      <h3 className={`mb-4 text-[17px] font-bold leading-tight md:text-[19px] ${light ? "text-[#0E1726]" : "text-[#0e1726]"}`}>{heading}</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        {items.slice(0, limit).map((t, i) => (
          <Card key={t._id} testimonial={t} index={i} light={light} />
        ))}
      </div>
    </section>
  );
}

// ─── Card variant ───
function Card({ testimonial: t, index, light = false }: { testimonial: Testimonial; index: number; light?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.08 }}
      className={`relative flex h-full flex-col overflow-hidden rounded-none border p-4 ${light ? "border-[rgba(15,23,38,0.10)] bg-gradient-to-br from-[#F4F6F8] to-[#FFFFFF]" : "border-[rgba(15,23,38,0.08)] bg-gradient-to-br from-[#eef2f6] to-[#f2f5f8]"}`}
    >
      {/* Quote glyph accent */}
      <svg className={`absolute right-3 top-3 h-6 w-6 ${light ? "text-[#1080CA]/20" : "text-[#1080CA]/15"}`} fill="currentColor" viewBox="0 0 24 24">
        <path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z" />
      </svg>

      {/* Result — the money line */}
      <div className={`mb-3 pr-8 text-[14px] font-black leading-snug md:text-[15px] ${light ? "text-[#0E1726]" : "text-[#0e1726]"}`}>
        {t.result}
      </div>

      {/* Quote body */}
      {t.quote && (
        <p className={`mb-4 line-clamp-4 text-[12px] leading-relaxed ${light ? "text-[#5B6573]" : "text-[#6b7280]"}`}>&ldquo;{t.quote}&rdquo;</p>
      )}

      {/* Author */}
      <div className={`mt-auto flex items-center gap-2.5 border-t pt-3 ${light ? "border-[rgba(15,23,38,0.08)]" : "border-[rgba(15,23,38,0.06)]"}`}>
        {t.avatar ? (
          <img src={t.avatar} alt={t.name} className="h-10 w-10 rounded-full object-cover" />
        ) : (
          <div className={`flex h-10 w-10 items-center justify-center rounded-full text-[14px] font-black ${light ? "bg-[rgba(16,128,202,0.12)] text-[#1080CA]" : "bg-[rgba(16,128,202,0.12)] text-[#1080CA]"}`}>
            {t.name.charAt(0)}
          </div>
        )}
        <div className="min-w-0 flex-1 leading-tight">
          <div className={`truncate text-[12px] font-bold ${light ? "text-[#0E1726]" : "text-[#0e1726]"}`}>{t.name}</div>
          {t.role && <div className={`truncate text-[10px] ${light ? "text-[#5B6573]" : "text-[#6b7280]"}`}>{t.role}</div>}
        </div>
        {t.link && (
          <a
            href={t.link}
            target="_blank"
            rel="noopener noreferrer"
            className={`shrink-0 rounded-full p-1 transition ${light ? "text-[#5B6573] hover:text-[#1080CA]" : "text-[#6b7280] hover:text-[#1080CA]"}`}
            title="Профайл"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        )}
      </div>
    </motion.div>
  );
}

// ─── Hero variant — single featured with big portrait ───
function HeroTestimonial({ testimonial: t, className }: { testimonial: Testimonial; className: string }) {
  return (
    <section className={className}>
      <div className="relative overflow-hidden rounded-none border border-[rgba(16,128,202,0.2)] bg-gradient-to-br from-[rgba(16,128,202,0.08)] via-[#eef2f6] to-[#f7f9fb] p-5 md:p-7">
        <div className="flex flex-col items-start gap-4 md:flex-row md:items-center">
          <div className="shrink-0">
            {t.avatar ? (
              <img src={t.avatar} alt={t.name} className="h-20 w-20 rounded-full object-cover md:h-24 md:w-24" />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[rgba(16,128,202,0.12)] text-[24px] font-black text-[#1080CA] md:h-24 md:w-24 md:text-[32px]">
                {t.name.charAt(0)}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <div className="h-[2px] w-3 bg-[#1080CA]" />
              <span className="text-[10px] font-bold tracking-[0.18em] text-[#1080CA]">FEATURED</span>
            </div>
            <div className="mt-2 text-[18px] font-black leading-tight text-[#0e1726] md:text-[22px]">
              {t.result}
            </div>
            {t.quote && (
              <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-[#5b6573] md:text-[14px]">
                &ldquo;{t.quote}&rdquo;
              </p>
            )}
            <div className="mt-3 flex items-center gap-2">
              <span className="text-[12px] font-bold text-[#334155]">— {t.name}</span>
              {t.role && <span className="text-[11px] text-[#6b7280]">· {t.role}</span>}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SkeletonGrid({ count }: { count: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-none border border-[rgba(15,23,38,0.06)] bg-[#f2f5f8] p-4">
          <div className="mb-3 h-4 w-3/4 rounded bg-[#F2F2F4]" />
          <div className="mb-2 h-3 w-full rounded bg-[#F2F2F4]" />
          <div className="mb-4 h-3 w-5/6 rounded bg-[#F2F2F4]" />
          <div className="flex items-center gap-2 border-t border-[rgba(15,23,38,0.06)] pt-3">
            <div className="h-10 w-10 rounded-full bg-[#F2F2F4]" />
            <div className="flex-1">
              <div className="h-3 w-16 rounded bg-[#F2F2F4]" />
              <div className="mt-1 h-2 w-24 rounded bg-[#F2F2F4]" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
