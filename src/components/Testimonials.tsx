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
}

export default function Testimonials({
  variant = "grid",
  limit = 3,
  hideIfEmpty = true,
  eyebrow = "ГИШҮҮДИЙН ҮР ДҮН",
  heading = "Бодит хүмүүс · Бодит ажил",
  className = "",
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
        <div className="h-[2px] w-4 bg-[#EF2C58]" />
        <span className="text-[11px] font-bold tracking-[0.15em] text-[#E8E8E8]">{eyebrow}</span>
      </div>
      <h3 className="mb-4 text-[17px] font-bold leading-tight text-[#E8E8E8] md:text-[19px]">{heading}</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        {items.slice(0, limit).map((t, i) => (
          <Card key={t._id} testimonial={t} index={i} />
        ))}
      </div>
    </section>
  );
}

// ─── Card variant ───
function Card({ testimonial: t, index }: { testimonial: Testimonial; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.08 }}
      className="relative flex h-full flex-col overflow-hidden rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-gradient-to-br from-[#141414] to-[#0F0F0F] p-4"
    >
      {/* Quote glyph accent */}
      <svg className="absolute right-3 top-3 h-6 w-6 text-[#EF2C58]/15" fill="currentColor" viewBox="0 0 24 24">
        <path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z" />
      </svg>

      {/* Result — the money line */}
      <div className="mb-3 pr-8 text-[14px] font-black leading-snug text-[#E8E8E8] md:text-[15px]">
        {t.result}
      </div>

      {/* Quote body */}
      {t.quote && (
        <p className="mb-4 line-clamp-4 text-[12px] leading-relaxed text-[#888]">&ldquo;{t.quote}&rdquo;</p>
      )}

      {/* Author */}
      <div className="mt-auto flex items-center gap-2.5 border-t border-[rgba(255,255,255,0.06)] pt-3">
        {t.avatar ? (
          <img src={t.avatar} alt={t.name} className="h-10 w-10 rounded-full object-cover" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(239,44,88,0.12)] text-[14px] font-black text-[#EF2C58]">
            {t.name.charAt(0)}
          </div>
        )}
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[12px] font-bold text-[#E8E8E8]">{t.name}</div>
          {t.role && <div className="truncate text-[10px] text-[#666]">{t.role}</div>}
        </div>
        {t.link && (
          <a
            href={t.link}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-full p-1 text-[#666] transition hover:text-[#EF2C58]"
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
      <div className="relative overflow-hidden rounded-[4px] border border-[rgba(239,44,88,0.2)] bg-gradient-to-br from-[rgba(239,44,88,0.08)] via-[#111] to-[#0D0D0D] p-5 md:p-7">
        <div className="flex flex-col items-start gap-4 md:flex-row md:items-center">
          <div className="shrink-0">
            {t.avatar ? (
              <img src={t.avatar} alt={t.name} className="h-20 w-20 rounded-full object-cover md:h-24 md:w-24" />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[rgba(239,44,88,0.12)] text-[24px] font-black text-[#EF2C58] md:h-24 md:w-24 md:text-[32px]">
                {t.name.charAt(0)}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <div className="h-[2px] w-3 bg-[#EF2C58]" />
              <span className="text-[10px] font-bold tracking-[0.18em] text-[#EF2C58]">FEATURED</span>
            </div>
            <div className="mt-2 text-[18px] font-black leading-tight text-[#E8E8E8] md:text-[22px]">
              {t.result}
            </div>
            {t.quote && (
              <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-[#999] md:text-[14px]">
                &ldquo;{t.quote}&rdquo;
              </p>
            )}
            <div className="mt-3 flex items-center gap-2">
              <span className="text-[12px] font-bold text-[#CCC]">— {t.name}</span>
              {t.role && <span className="text-[11px] text-[#666]">· {t.role}</span>}
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
        <div key={i} className="animate-pulse rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0F0F0F] p-4">
          <div className="mb-3 h-4 w-3/4 rounded bg-[#1A1A1A]" />
          <div className="mb-2 h-3 w-full rounded bg-[#1A1A1A]" />
          <div className="mb-4 h-3 w-5/6 rounded bg-[#1A1A1A]" />
          <div className="flex items-center gap-2 border-t border-[rgba(255,255,255,0.06)] pt-3">
            <div className="h-10 w-10 rounded-full bg-[#1A1A1A]" />
            <div className="flex-1">
              <div className="h-3 w-16 rounded bg-[#1A1A1A]" />
              <div className="mt-1 h-2 w-24 rounded bg-[#1A1A1A]" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
