"use client";

import { useEffect, useMemo, useState } from "react";
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
  "Боловсрол": "M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84",
  "Технологи": "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4",
  "AI & Automation": "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
  "Бизнес": "M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
  "Хэрэгсэл": "M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z",
};

const DEFAULT_ICON = "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10";

const TOOLS: ServiceData[] = [
  {
    _id: "tool:youtube-mp3",
    name: "YouTube → MP3",
    slug: "youtube-mp3",
    description: "YouTube видеог MP3 аудио болгож татах",
    logo: "",
    coverImage: "",
    category: "Хэрэгсэл",
    url: "/tools/youtube-mp3",
    domain: "antaqor.com/tools",
    status: "active",
    featured: false,
    tags: ["audio", "tool"],
    stats: {},
  },
];

const ACCENT_PALETTE = ["#EF2C58", "#0F81CA", "#22C55E", "#A855F7", "#FF4473", "#EC4899"];
function getAccent(name: string): string {
  return ACCENT_PALETTE[name.charCodeAt(0) % ACCENT_PALETTE.length];
}

export default function ServicesPage() {
  const [remote, setRemote] = useState<ServiceData[]>([]);
  const [remoteCategories, setRemoteCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/services")
      .then((r) => r.json())
      .then((sData) => {
        if (sData.services) setRemote(sData.services);
        if (sData.categories) setRemoteCategories(sData.categories);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Merge in-app tools with remote services so the page is one unified surface.
  const all = useMemo(() => [...TOOLS, ...remote], [remote]);
  const categories = useMemo(() => {
    const set = new Set<string>(remoteCategories);
    TOOLS.forEach((t) => set.add(t.category));
    return Array.from(set);
  }, [remoteCategories]);

  const filtered = useMemo(() => {
    let list = activeCategory === "all" ? all : all.filter((s) => s.category === activeCategory);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return list;
  }, [all, activeCategory, query]);

  const featured = filtered.find((s) => s.featured);
  const rest = filtered.filter((s) => !s.featured);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-2 w-2 animate-pulse rounded-[4px] bg-[#EF2C58]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl pb-12">
      {/* ─── Header ─── */}
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <div className="text-[10px] font-bold tracking-[0.22em] text-[#666]">ANTAQOR</div>
          <h1 className="mt-1 text-[26px] font-black leading-tight text-[#E8E8E8] md:text-[30px]">Үйлчилгээ</h1>
          <p className="mt-1 text-[12px] text-[#666]">
            Antaqor экосистемийн бүх бүтээгдэхүүн нэг газар
          </p>
        </div>
        <div className="hidden sm:block text-right">
          <div className="text-[20px] font-black text-[#E8E8E8]">{all.length}</div>
          <div className="text-[10px] font-bold tracking-[0.15em] text-[#555]">НИЙТ</div>
        </div>
      </div>

      {/* ─── Search + categories ─── */}
      <div className="mb-4 flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <svg className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#666]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Үйлчилгээ хайх…"
            className="w-full rounded-[8px] border border-[rgba(255,255,255,0.08)] bg-[#0F0F10] py-2.5 pl-9 pr-3 text-[13px] text-[#E8E8E8] placeholder-[#555] outline-none transition focus:border-[rgba(239,44,88,0.4)]"
          />
        </div>
      </div>

      {/* Categories — chip row */}
      <div className="mb-5 flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        <CategoryChip active={activeCategory === "all"} label="Бүгд" count={all.length} onClick={() => setActiveCategory("all")} />
        {categories.map((cat) => {
          const count = all.filter((s) => s.category === cat).length;
          return (
            <CategoryChip
              key={cat}
              active={activeCategory === cat}
              label={cat}
              count={count}
              onClick={() => setActiveCategory(cat)}
            />
          );
        })}
      </div>

      {/* ─── Featured (large) — only shown on All view ─── */}
      {activeCategory === "all" && !query && featured && <FeaturedCard service={featured} />}

      {/* ─── Grid ─── */}
      {rest.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((s) => (
            <ServiceCard key={s._id} service={s} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState query={query} />
      ) : null}

      {/* ─── Partner CTA ─── */}
      <div className="mt-10 overflow-hidden rounded-[10px] border border-[rgba(239,44,88,0.18)] bg-gradient-to-br from-[rgba(239,44,88,0.06)] via-[#0E0E0E] to-[#0B0B0B] p-6 text-center">
        <div className="text-[10px] font-bold tracking-[0.18em] text-[#EF2C58]">PARTNERSHIP</div>
        <h2 className="mt-2 text-[18px] font-black text-[#E8E8E8]">Бизнесээ Antaqor-т нэгтгэх үү?</h2>
        <p className="mx-auto mt-1 max-w-md text-[12px] leading-relaxed text-[#888]">
          Экосистемд нэгдэж, мянга мянган AI бүтээгчдэд хүрээрэй
        </p>
        <a
          href="mailto:antaqor@gmail.com?subject=Partnership"
          className="mt-4 inline-flex items-center gap-2 rounded-[10px] bg-[#EF2C58] px-6 py-2.5 text-[12px] font-black text-white transition hover:bg-[#D4264E]"
        >
          Хамтрах хүсэлт илгээх
          <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </a>
      </div>
    </div>
  );
}

function CategoryChip({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`group inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-bold transition ${
        active
          ? "bg-[#EF2C58] text-white"
          : "border border-[rgba(255,255,255,0.08)] bg-[#0F0F10] text-[#888] hover:border-[rgba(239,44,88,0.3)] hover:text-[#E8E8E8]"
      }`}
    >
      {label}
      <span
        className={`inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-black ${
          active ? "bg-white/20 text-white" : "bg-[rgba(255,255,255,0.05)] text-[#666]"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function FeaturedCard({ service }: { service: ServiceData }) {
  const accent = getAccent(service.name);
  const isExternal =
    !!service.url && !service.url.startsWith("/") && !service.url.startsWith("https://antaqor.com");
  const className =
    "group relative grid gap-4 overflow-hidden rounded-[12px] border border-[rgba(239,44,88,0.22)] bg-gradient-to-br from-[rgba(239,44,88,0.05)] via-[#0E0E0E] to-[#0B0B0B] p-5 transition hover:border-[rgba(239,44,88,0.4)] sm:grid-cols-[200px_1fr] sm:p-6";

  const inner = (
    <>
      {service.coverImage ? (
          <div className="relative aspect-video overflow-hidden rounded-[8px] bg-[#0A0A0A] sm:aspect-square">
            <Image src={service.coverImage} alt={service.name} fill className="object-cover transition group-hover:scale-105" sizes="(max-width:640px) 100vw, 200px" />
          </div>
        ) : (
          <div
            className="flex aspect-video items-center justify-center rounded-[8px] sm:aspect-square"
            style={{ backgroundColor: `${accent}14` }}
          >
            <span className="text-[40px] font-black" style={{ color: accent }}>
              {service.name.charAt(0)}
            </span>
          </div>
        )}
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            {service.status === "active" && <span className="h-1.5 w-1.5 rounded-full bg-[#22C55E]" />}
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#666]">{service.category}</span>
          </div>
          <h2 className="mt-1.5 text-[20px] font-black text-[#E8E8E8] transition group-hover:text-[#EF2C58]">
            {service.name}
          </h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-[#888]">{service.description}</p>
          <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
            {service.domain && <span className="text-[10px] text-[#555]">{service.domain}</span>}
            {service.stats?.rating ? (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-[rgba(239,44,88,0.1)] px-2 py-0.5 text-[10px] font-bold text-[#EF2C58]">
                <svg className="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                {service.stats.rating}
              </span>
            ) : null}
            <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-black text-[#EF2C58] transition group-hover:translate-x-0.5">
              Орох
              <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </span>
          </div>
        </div>
    </>
  );

  return (
    <div className="mb-5">
      <div className="mb-2 flex items-center gap-2">
        <div className="h-[2px] w-4 bg-[#EF2C58]" />
        <span className="text-[10px] font-bold tracking-[0.15em] text-[#EF2C58]">FEATURED</span>
      </div>
      {isExternal ? (
        <a href={service.url} target="_blank" rel="noopener noreferrer" className={className}>
          {inner}
        </a>
      ) : (
        <Link href={service.url || "#"} className={className}>
          {inner}
        </Link>
      )}
    </div>
  );
}

function ServiceCard({ service }: { service: ServiceData }) {
  const isComingSoon = service.status === "coming_soon";
  const accent = getAccent(service.name);
  const isExternal =
    !!service.url && !service.url.startsWith("/") && !service.url.startsWith("https://antaqor.com");
  const interactive = !isComingSoon && service.url && service.url !== "#";

  const Inner = (
    <>
      {/* Cover or category icon */}
      {service.coverImage ? (
        <div className="relative aspect-[16/9] overflow-hidden bg-[#1A1A1A]">
          <Image
            src={service.coverImage}
            alt={service.name}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#141414]/80 via-transparent to-transparent" />
          {isComingSoon && (
            <div className="absolute left-3 top-3 rounded-full bg-black/70 px-2 py-0.5 text-[9px] font-bold text-[#999] backdrop-blur">
              ТУН УДАХГҮЙ
            </div>
          )}
        </div>
      ) : (
        <div
          className="relative flex aspect-[16/9] items-center justify-center"
          style={{ backgroundColor: `${accent}10` }}
        >
          <svg className="h-10 w-10 opacity-30" fill="none" stroke="currentColor" style={{ color: accent }} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d={CATEGORY_ICONS[service.category] || DEFAULT_ICON} />
          </svg>
          {isComingSoon && (
            <div className="absolute left-3 top-3 rounded-full bg-black/70 px-2 py-0.5 text-[9px] font-bold text-[#999] backdrop-blur">
              ТУН УДАХГҮЙ
            </div>
          )}
        </div>
      )}

      {/* Info */}
      <div className="p-3.5">
        <div className="flex items-start gap-2.5">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px] text-[14px] font-black"
            style={{ backgroundColor: `${accent}18`, color: accent }}
          >
            {service.logo ? (
              <Image src={service.logo} alt="" width={36} height={36} className="rounded-[6px]" />
            ) : (
              service.name.charAt(0)
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h2 className="truncate text-[13px] font-bold text-[#E8E8E8] transition group-hover:text-[#EF2C58]">
                {service.name}
              </h2>
              {service.status === "active" && (
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#22C55E]" />
              )}
            </div>
            <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-[#666]">
              {service.description}
            </p>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-[rgba(255,255,255,0.05)] pt-2.5 text-[10px]">
          <span className="font-medium text-[#555] truncate max-w-[60%]">
            {service.domain || service.category}
          </span>
          {service.stats?.rating ? (
            <span className="inline-flex items-center gap-0.5 font-semibold text-[#EF2C58]">
              <svg className="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
              {service.stats.rating}
            </span>
          ) : (
            <span className="rounded-full bg-[#1A1A1A] px-1.5 py-0.5 font-semibold text-[#666]">
              {service.category}
            </span>
          )}
        </div>
      </div>
    </>
  );

  const baseClass = `group block overflow-hidden rounded-[10px] border border-[rgba(255,255,255,0.08)] bg-[#0F0F10] transition-all ${
    interactive ? "hover:border-[rgba(239,44,88,0.25)] hover:-translate-y-[1px]" : "cursor-default opacity-60"
  }`;

  if (!interactive) {
    return <div className={baseClass}>{Inner}</div>;
  }

  if (isExternal) {
    return (
      <a href={service.url} target="_blank" rel="noopener noreferrer" className={baseClass}>
        {Inner}
      </a>
    );
  }

  return (
    <Link href={service.url} className={baseClass}>
      {Inner}
    </Link>
  );
}

function EmptyState({ query }: { query: string }) {
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-[8px] border border-[rgba(255,255,255,0.08)] bg-[#0F0F10]">
        <svg className="h-5 w-5 text-[#666]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d={DEFAULT_ICON} />
        </svg>
      </div>
      <p className="text-[14px] font-bold text-[#E8E8E8]">
        {query ? `«${query}» гэсэн үйлчилгээ олдсонгүй` : "Үйлчилгээ удахгүй нэмэгдэнэ"}
      </p>
      <p className="mt-1 text-[11px] text-[#666]">
        {query ? "Өөр үг хайж эсвэл бүх үйлчилгээг үзнэ үү" : "Шинэ бүтээгдэхүүн идэвхтэй бэлтгэгдэж байна"}
      </p>
    </div>
  );
}
