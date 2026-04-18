"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface InfluencerData {
  _id: string;
  name: string;
  slug: string;
  bio: string;
  avatar: string;
  coverImage: string;
  category: string;
  socials: {
    instagram?: string;
    tiktok?: string;
    youtube?: string;
    facebook?: string;
  };
  stats: {
    followers: number;
    engagement: number;
    avgViews: number;
    avgLikes: number;
  };
  pricing: {
    story: number;
    post: number;
    reel: number;
    campaign: number;
  };
  tags: string[];
  featured: boolean;
  verified: boolean;
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toString();
}

function formatPrice(n: number): string {
  if (!n) return "-";
  return n.toLocaleString() + "₮";
}

const SOCIAL_ICONS: Record<string, { d: string; color: string }> = {
  instagram: {
    d: "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z",
    color: "#E4405F",
  },
  tiktok: {
    d: "M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.46V13a8.28 8.28 0 005.58 2.16v-3.44a4.85 4.85 0 01-3.77-1.26V6.69h3.77z",
    color: "#fff",
  },
  youtube: {
    d: "M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z",
    color: "#FF0000",
  },
  facebook: {
    d: "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z",
    color: "#1877F2",
  },
};

export default function InfluencersPage() {
  const [influencers, setInfluencers] = useState<InfluencerData[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<InfluencerData | null>(null);

  useEffect(() => {
    fetch("/api/influencers")
      .then((r) => r.json())
      .then((d) => {
        if (d.influencers) setInfluencers(d.influencers);
        if (d.categories) setCategories(d.categories);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered =
    activeCategory === "all"
      ? influencers
      : influencers.filter((i) => i.category === activeCategory);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-2 w-2 animate-pulse rounded-full bg-[#FFFF01]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2.5">
          <svg className="h-5 w-5 text-[#FFFF01]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
          <h1 className="text-[22px] font-bold text-[#FAFAFA]">Influencer</h1>
        </div>
        <p className="mt-1 text-[13px] text-[#6B6B6B]">
          Брэндээ сурталчлах топ инфлүүнсерүүдийг сонгоорой
        </p>
      </div>

      {/* Category filter */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        <button
          onClick={() => setActiveCategory("all")}
          className={`shrink-0 rounded-[4px] px-4 py-2 text-[12px] font-bold transition ${
            activeCategory === "all"
              ? "bg-[#FFFF01] text-[#0A0A0A]"
              : "border border-[rgba(255,255,255,0.06)] bg-[#141414] text-[#6B6B6B] hover:text-[#FAFAFA]"
          }`}
        >
          Бүгд
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`shrink-0 rounded-[4px] px-4 py-2 text-[12px] font-bold transition ${
              activeCategory === cat
                ? "bg-[#FFFF01] text-[#0A0A0A]"
                : "border border-[rgba(255,255,255,0.06)] bg-[#141414] text-[#6B6B6B] hover:text-[#FAFAFA]"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Influencer grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((inf) => (
            <button
              key={inf._id}
              onClick={() => setSelected(inf)}
              className="group block overflow-hidden rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#141414] text-left transition hover:border-[rgba(255,255,1,0.2)] hover:shadow-[0_0_24px_rgba(255,255,1,0.06)]"
            >
              {/* Cover / Avatar area */}
              <div className="relative aspect-[3/2] bg-gradient-to-br from-[#1a1a1a] to-[#0A0A0A]">
                {inf.coverImage ? (
                  <img src={inf.coverImage} alt={inf.name} className="h-full w-full object-cover" />
                ) : inf.avatar ? (
                  <div className="flex h-full items-center justify-center">
                    <img src={inf.avatar} alt={inf.name} className="h-20 w-20 rounded-full object-cover border-2 border-[rgba(255,255,1,0.2)]" />
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(255,255,1,0.08)] text-[24px] font-black text-[#FFFF01]">
                      {inf.name.charAt(0)}
                    </div>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-transparent to-transparent" />

                {/* Badges */}
                <div className="absolute right-2 top-2 flex items-center gap-1">
                  {inf.verified && (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#FFFF01]">
                      <svg className="h-3 w-3 text-[#0A0A0A]" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                      </svg>
                    </div>
                  )}
                  {inf.featured && (
                    <span className="rounded-[4px] bg-[#FFFF01] px-1.5 py-0.5 text-[8px] font-black text-[#0A0A0A]">TOP</span>
                  )}
                </div>
              </div>

              {/* Info */}
              <div className="p-3.5">
                <h3 className="truncate text-[14px] font-bold text-[#FAFAFA] transition group-hover:text-[#FFFF01]">
                  {inf.name}
                </h3>
                <p className="mt-0.5 text-[11px] text-[#6B6B6B]">{inf.category}</p>

                {/* Stats row */}
                <div className="mt-2.5 flex items-center gap-3">
                  <div className="text-center">
                    <div className="text-[14px] font-bold text-[#FFFF01]">{formatNum(inf.stats.followers)}</div>
                    <div className="text-[9px] text-[#6B6B6B]">Дагагч</div>
                  </div>
                  {inf.stats.engagement > 0 && (
                    <div className="text-center">
                      <div className="text-[14px] font-bold text-[#FAFAFA]">{inf.stats.engagement}%</div>
                      <div className="text-[9px] text-[#6B6B6B]">ER</div>
                    </div>
                  )}
                  {inf.stats.avgViews > 0 && (
                    <div className="text-center">
                      <div className="text-[14px] font-bold text-[#FAFAFA]">{formatNum(inf.stats.avgViews)}</div>
                      <div className="text-[9px] text-[#6B6B6B]">Үзэлт</div>
                    </div>
                  )}
                </div>

                {/* Social icons */}
                <div className="mt-2.5 flex items-center gap-1.5">
                  {(Object.keys(inf.socials) as (keyof typeof inf.socials)[])
                    .filter((k) => inf.socials[k])
                    .map((k) => {
                      const icon = SOCIAL_ICONS[k];
                      if (!icon) return null;
                      return (
                        <div key={k} className="flex h-5 w-5 items-center justify-center rounded-[4px] bg-[rgba(255,255,255,0.04)]">
                          <svg className="h-2.5 w-2.5" fill={icon.color} viewBox="0 0 24 24"><path d={icon.d} /></svg>
                        </div>
                      );
                    })}
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="py-20 text-center">
          <svg className="mx-auto mb-4 h-12 w-12 text-[#6B6B6B] opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
          <p className="text-[14px] text-[#6B6B6B]">Инфлүүнсер удахгүй нэмэгдэнэ</p>
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="relative w-full max-w-[440px] mx-4 mb-4 sm:mb-0 max-h-[85vh] overflow-y-auto rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#141414] animate-[slideUp_0.3s_ease-out]">
            {/* Cover */}
            <div className="relative aspect-[2.5/1] bg-gradient-to-br from-[#1a1a1a] to-[#0A0A0A]">
              {selected.coverImage ? (
                <img src={selected.coverImage} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-[#1a1a1a] to-[#0A0A0A]" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#141414] to-transparent" />
              <button
                onClick={() => setSelected(null)}
                className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(0,0,0,0.6)] text-white backdrop-blur-sm"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-5 pb-5">
              {/* Avatar + Name */}
              <div className="flex items-end gap-3 -mt-8 relative z-10">
                {selected.avatar ? (
                  <img src={selected.avatar} alt={selected.name} className="h-16 w-16 rounded-full border-3 border-[#141414] object-cover" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border-3 border-[#141414] bg-[#0A0A0A] text-[22px] font-black text-[#FFFF01]">
                    {selected.name.charAt(0)}
                  </div>
                )}
                <div className="pb-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-[18px] font-bold text-[#FAFAFA]">{selected.name}</h2>
                    {selected.verified && (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#FFFF01]">
                        <svg className="h-3 w-3 text-[#0A0A0A]" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <p className="text-[12px] text-[#6B6B6B]">{selected.category}</p>
                </div>
              </div>

              {/* Bio */}
              {selected.bio && (
                <p className="mt-4 text-[13px] leading-relaxed text-[#A3A3A3]">{selected.bio}</p>
              )}

              {/* Stats grid */}
              <div className="mt-4 grid grid-cols-4 gap-2">
                {[
                  { label: "Дагагч", value: formatNum(selected.stats.followers) },
                  { label: "ER", value: selected.stats.engagement ? selected.stats.engagement + "%" : "-" },
                  { label: "Үзэлт", value: selected.stats.avgViews ? formatNum(selected.stats.avgViews) : "-" },
                  { label: "Like", value: selected.stats.avgLikes ? formatNum(selected.stats.avgLikes) : "-" },
                ].map((s) => (
                  <div key={s.label} className="rounded-[4px] bg-[#0A0A0A] p-3 text-center">
                    <div className="text-[16px] font-bold text-[#FFFF01]">{s.value}</div>
                    <div className="mt-0.5 text-[9px] text-[#6B6B6B]">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Pricing */}
              {(selected.pricing.story > 0 || selected.pricing.post > 0 || selected.pricing.reel > 0 || selected.pricing.campaign > 0) && (
                <div className="mt-4">
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#6B6B6B]">Үнийн санал</div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Story", value: selected.pricing.story },
                      { label: "Post", value: selected.pricing.post },
                      { label: "Reel", value: selected.pricing.reel },
                      { label: "Campaign", value: selected.pricing.campaign },
                    ]
                      .filter((p) => p.value > 0)
                      .map((p) => (
                        <div key={p.label} className="flex items-center justify-between rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0A0A0A] px-3 py-2.5">
                          <span className="text-[12px] text-[#A3A3A3]">{p.label}</span>
                          <span className="text-[13px] font-bold text-[#FAFAFA]">{formatPrice(p.value)}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Social links */}
              <div className="mt-4 flex items-center gap-2">
                {(Object.keys(selected.socials) as (keyof typeof selected.socials)[])
                  .filter((k) => selected.socials[k])
                  .map((k) => {
                    const icon = SOCIAL_ICONS[k];
                    if (!icon) return null;
                    return (
                      <a
                        key={k}
                        href={selected.socials[k]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-9 w-9 items-center justify-center rounded-[4px] bg-[rgba(255,255,255,0.04)] transition hover:bg-[rgba(255,255,255,0.08)]"
                      >
                        <svg className="h-4 w-4" fill={icon.color} viewBox="0 0 24 24"><path d={icon.d} /></svg>
                      </a>
                    );
                  })}
              </div>

              {/* Tags */}
              {selected.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {selected.tags.map((tag) => (
                    <span key={tag} className="rounded-[4px] bg-[rgba(255,255,255,0.04)] px-2 py-0.5 text-[10px] text-[#6B6B6B]">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* CTA */}
              <a
                href={`mailto:antaqor@gmail.com?subject=Influencer Collaboration: ${selected.name}&body=Сайн байна уу, ${selected.name}-тай хамтран ажиллах хүсэлтэй байна.`}
                className="mt-5 block w-full rounded-[4px] bg-[#FFFF01] py-3 text-center text-[13px] font-bold text-[#0A0A0A] transition hover:shadow-[0_0_24px_rgba(255,255,1,0.25)]"
              >
                Хамтрах хүсэлт илгээх
              </a>
            </div>
          </div>
        </div>
      )}

      {/* CTA for becoming influencer */}
      <div className="mt-8 rounded-[4px] border border-dashed border-[rgba(255,255,255,0.1)] p-6 text-center">
        <p className="text-[13px] font-bold text-[#FAFAFA]">Инфлүүнсер болох уу?</p>
        <p className="mt-1 text-[12px] text-[#6B6B6B]">
          Antaqor платформд бүртгүүлж, брэндүүдтэй хамтран ажиллаарай
        </p>
        <a
          href="mailto:antaqor@gmail.com?subject=Influencer Registration"
          className="mt-4 inline-block rounded-[4px] border border-[rgba(255,255,1,0.3)] bg-[rgba(255,255,1,0.06)] px-6 py-2.5 text-[12px] font-bold text-[#FFFF01] transition hover:bg-[rgba(255,255,1,0.12)]"
        >
          Бүртгүүлэх
        </a>
      </div>
    </div>
  );
}
