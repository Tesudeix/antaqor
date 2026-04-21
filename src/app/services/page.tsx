"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

interface ServiceData {
  _id: string;
  name: string;
  slug: string;
  description: string;
  logo: string;
  coverImage: string;
  category: string;
  url: string;
  domain: string;
  status: "active" | "coming_soon" | "inactive";
  featured: boolean;
  tags: string[];
  stats: { users?: number; rating?: number };
}

const CATEGORY_ICONS: Record<string, string> = {
  "Зугаа цэнгэл": "M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  "Боловсрол": "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
  "Технологи": "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4",
  "AI & Automation": "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
  "Бизнес": "M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
};

const DEFAULT_ICON = "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10";

const TOOLS = [
  {
    name: "YouTube → MP3",
    desc: "YouTube видеог MP3 аудио болгож татах",
    href: "/tools/youtube-mp3",
    icon: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z",
    iconFill: true,
    color: "#EF2C58",
  },
];

function getAccentColor(name: string): string {
  const colors = ["#EF2C58", "#0F81CA", "#22C55E", "#A855F7", "#F97316", "#EC4899"];
  const idx = name.charCodeAt(0) % colors.length;
  return colors[idx];
}

export default function ServicesPage() {
  const [services, setServices] = useState<ServiceData[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/services")
      .then((r) => r.json())
      .then((sData) => {
        if (sData.services) setServices(sData.services);
        if (sData.categories) setCategories(sData.categories);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = activeCategory === "all"
    ? services
    : services.filter((s) => s.category === activeCategory);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-2 w-2 animate-pulse rounded-[4px] bg-[#EF2C58]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[22px] font-bold text-[#E8E8E8]">Үйлчилгээ</h1>
        <p className="mt-1 text-[13px] text-[#666666]">
          Antaqor экосистемийн бүтээгдэхүүн, хэрэгслүүд
        </p>
      </div>

      {/* Tools Section */}
      <div className="mb-6">
        <div className="mb-3 flex items-center gap-2">
          <div className="h-[2px] w-4 bg-[#EF2C58]" />
          <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#666]">Хэрэгслүүд</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {TOOLS.map((tool) => (
            <Link
              key={tool.name}
              href={tool.href}
              className="group flex items-center gap-4 rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#141414] p-4 transition-all hover:border-[rgba(239,44,88,0.3)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.2)]"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[4px]" style={{ backgroundColor: `${tool.color}18` }}>
                <svg className="h-6 w-6" style={{ color: tool.color }} fill={tool.iconFill ? "currentColor" : "none"} stroke={tool.iconFill ? "none" : "currentColor"} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={tool.icon} />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-[14px] font-bold text-[#E8E8E8] transition group-hover:text-[#EF2C58]">{tool.name}</h3>
                <p className="mt-0.5 text-[11px] text-[#666]">{tool.desc}</p>
              </div>
              <svg className="h-4 w-4 shrink-0 text-[#CCCCCC] transition group-hover:translate-x-0.5 group-hover:text-[#EF2C58]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ))}
        </div>
      </div>

      {/* Category filter */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <button
          onClick={() => setActiveCategory("all")}
          className={`shrink-0 rounded-[4px] px-4 py-1.5 text-[12px] font-bold transition ${
            activeCategory === "all"
              ? "bg-[#EF2C58] text-white"
              : "border border-[rgba(255,255,255,0.08)] bg-[#141414] text-[#666] hover:text-[#999]"
          }`}
        >
          Бүгд
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`shrink-0 rounded-[4px] px-4 py-1.5 text-[12px] font-bold transition ${
              activeCategory === cat
                ? "bg-[#EF2C58] text-white"
                : "border border-[rgba(255,255,255,0.08)] bg-[#141414] text-[#666] hover:text-[#999]"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Services grid */}
      {filtered.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((service) => {
            const isComingSoon = service.status === "coming_soon";
            const accent = getAccentColor(service.name);

            return (
              <a
                key={service._id}
                href={isComingSoon ? undefined : service.url}
                target={!isComingSoon && !service.url.startsWith("https://antaqor.com") ? "_blank" : undefined}
                rel="noopener noreferrer"
                className={`group block overflow-hidden rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#141414] transition-all ${
                  isComingSoon
                    ? "cursor-default opacity-50"
                    : "hover:border-[rgba(239,44,88,0.2)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.2)]"
                }`}
              >
                {/* Cover */}
                {service.coverImage ? (
                  <div className="relative aspect-[16/9] bg-[#1A1A1A]">
                    <Image src={service.coverImage} alt={service.name} fill className="object-cover transition-transform duration-300 group-hover:scale-[1.02]" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#141414]/80 via-transparent to-transparent" />
                    {service.featured && (
                      <div className="absolute left-3 top-3 rounded-[4px] bg-[#EF2C58] px-2.5 py-0.5 text-[9px] font-bold text-white">FEATURED</div>
                    )}
                    {isComingSoon && (
                      <div className="absolute left-3 top-3 rounded-[4px] bg-[#1A1A1A] px-2.5 py-0.5 text-[9px] font-bold text-[#666]">ТҮДГЭЛЗСЭН</div>
                    )}
                  </div>
                ) : (
                  <div className="relative aspect-[16/9] bg-gradient-to-br from-[#141414] to-[#1A1A1A]">
                    <div className="absolute inset-0 flex items-center justify-center opacity-[0.07]">
                      <svg className="h-16 w-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={0.5} d={CATEGORY_ICONS[service.category] || DEFAULT_ICON} />
                      </svg>
                    </div>
                    {service.featured && (
                      <div className="absolute left-3 top-3 rounded-[4px] bg-[#EF2C58] px-2.5 py-0.5 text-[9px] font-bold text-white">FEATURED</div>
                    )}
                  </div>
                )}

                {/* Info */}
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[4px] text-[15px] font-black"
                      style={{ backgroundColor: `${accent}18`, color: accent }}
                    >
                      {service.logo ? (
                        <Image src={service.logo} alt="" width={40} height={40} className="rounded-[4px]" />
                      ) : (
                        service.name.charAt(0)
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <h2 className="truncate text-[14px] font-bold text-[#E8E8E8] transition group-hover:text-[#EF2C58]">
                          {service.name}
                        </h2>
                        {service.status === "active" && (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-[4px] bg-green-400" />
                        )}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-[12px] leading-relaxed text-[#666]">
                        {service.description}
                      </p>
                    </div>
                  </div>

                  {/* Meta */}
                  <div className="mt-3 flex items-center justify-between border-t border-[rgba(255,255,255,0.06)] pt-3">
                    <div className="flex items-center gap-2">
                      {service.domain && (
                        <span className="text-[10px] font-medium text-[#555]">{service.domain}</span>
                      )}
                      {service.stats?.rating && service.stats.rating > 0 && (
                        <span className="flex items-center gap-0.5 text-[10px] font-semibold text-[#EF2C58]">
                          <svg className="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                          {service.stats.rating}
                        </span>
                      )}
                    </div>
                    <span className="rounded-[4px] bg-[#1A1A1A] px-2 py-0.5 text-[9px] font-semibold text-[#666]">
                      {service.category}
                    </span>
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      ) : (
        <div className="py-20 text-center">
          <svg className="mx-auto mb-4 h-12 w-12 text-[#CCCCCC]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d={DEFAULT_ICON} />
          </svg>
          <p className="text-[14px] text-[#666]">Үйлчилгээ удахгүй нэмэгдэнэ</p>
        </div>
      )}

      {/* CTA */}
      <div className="mt-10 rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#141414] p-8 text-center">
        <p className="text-[15px] font-bold text-[#E8E8E8]">Бизнесээ Antaqor-т нэгтгэх үү?</p>
        <p className="mt-1 text-[12px] text-[#666]">
          Экосистемд нэгдэж, мянга мянган хэрэглэгчдэд хүрээрэй
        </p>
        <a
          href="mailto:antaqor@gmail.com?subject=Partnership"
          className="mt-5 inline-block rounded-[4px] bg-[#EF2C58] px-8 py-3 text-[13px] font-bold text-white transition hover:shadow-[0_4px_20px_rgba(239,44,88,0.25)]"
        >
          Хамтрах
        </a>
      </div>
    </div>
  );
}
