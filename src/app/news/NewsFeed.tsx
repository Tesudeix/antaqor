"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";

type Category = "All" | "AI" | "LLM" | "Agents" | "Research" | "Бизнес" | "Tool" | "Монгол";

interface NewsItem {
  _id: string;
  title: string;
  slug: string;
  excerpt: string;
  coverImage: string;
  category: Exclude<Category, "All">;
  tags: string[];
  source?: string;
  authorName: string;
  authorAvatar?: string;
  featured: boolean;
  views: number;
  readingMinutes: number;
  publishedAt: string;
}

const CATEGORY_COLORS: Record<Exclude<Category, "All">, string> = {
  AI: "#EF2C58",
  LLM: "#A855F7",
  Agents: "#EF2C58",
  Research: "#3B82F6",
  "Бизнес": "#F59E0B",
  Tool: "#06B6D4",
  "Монгол": "#EC4899",
};

const CATEGORIES: Category[] = ["All", "AI", "LLM", "Agents", "Research", "Бизнес", "Tool", "Монгол"];

function formatRelative(iso: string): string {
  const now = Date.now();
  const t = new Date(iso).getTime();
  const diff = Math.max(0, now - t);
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "дөнгөж сая";
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} цаг`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} өдөр`;
  return new Date(iso).toLocaleDateString("mn-MN", { month: "short", day: "numeric" });
}

function isFresh(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() < 24 * 60 * 60 * 1000;
}

function CategoryChip({ cat, size = "sm" }: { cat: Exclude<Category, "All">; size?: "sm" | "xs" }) {
  const color = CATEGORY_COLORS[cat];
  const sz = size === "xs" ? "text-[9px] px-1.5 py-0.5" : "text-[10px] px-2 py-0.5";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-bold tracking-wide uppercase ${sz}`}
      style={{ background: `${color}1F`, color }}
    >
      <span className="h-1 w-1 rounded-full" style={{ background: color }} />
      {cat}
    </span>
  );
}

function FeaturedHero({ item }: { item: NewsItem }) {
  return (
    <Link
      href={`/news/${item.slug}`}
      className="group relative block overflow-hidden rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0D0D0D]"
    >
      <div className="grid md:grid-cols-[1.15fr_1fr]">
        <div className="relative aspect-[16/10] md:aspect-auto md:h-full bg-[#1A1A1A]">
          {item.coverImage ? (
            <img
              src={item.coverImage}
              alt={item.title}
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#1A1A1A] to-[#0D0D0D]">
              <span className="text-[10px] tracking-[0.3em] text-[#333]">ANTAQOR · AI</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent md:bg-gradient-to-r md:from-black/0 md:via-black/0 md:to-[#0D0D0D]/95" />
          <div className="absolute top-3 left-3 flex items-center gap-1.5">
            <span className="rounded-full bg-[rgba(239,44,88,0.95)] px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-white">
              Featured
            </span>
            <CategoryChip cat={item.category} />
          </div>
        </div>
        <div className="relative flex flex-col justify-between gap-4 p-5 md:p-7">
          <div>
            <h2 className="text-[22px] font-bold leading-[1.15] text-[#E8E8E8] md:text-[28px]">
              {item.title}
            </h2>
            {item.excerpt && (
              <p className="mt-3 line-clamp-3 text-[13px] leading-relaxed text-[#999999] md:text-[14px]">
                {item.excerpt}
              </p>
            )}
            {item.tags?.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {item.tags.slice(0, 4).map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[#141414] px-2 py-0.5 text-[10px] text-[#888]"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between gap-3 text-[11px] text-[#666]">
            <div className="flex items-center gap-2 min-w-0">
              {item.authorAvatar ? (
                <img src={item.authorAvatar} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />
              ) : (
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[rgba(239,44,88,0.12)] text-[10px] font-bold text-[#EF2C58]">
                  {item.authorName?.charAt(0) || "A"}
                </div>
              )}
              <span className="truncate font-semibold text-[#BBB]">{item.authorName}</span>
              <span className="text-[#333]">·</span>
              <span>{formatRelative(item.publishedAt)}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {item.readingMinutes} мин
              </span>
              <span className="hidden items-center gap-1 sm:flex">
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                {item.views.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-[#EF2C58]/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
    </Link>
  );
}

function NewsCard({ item, index }: { item: NewsItem; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.3) }}
    >
      <Link
        href={`/news/${item.slug}`}
        className="group flex h-full flex-col overflow-hidden rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0F0F0F] transition duration-300 hover:border-[rgba(239,44,88,0.25)] hover:bg-[#131313]"
      >
        <div className="relative aspect-[16/10] overflow-hidden bg-[#1A1A1A]">
          {item.coverImage ? (
            <img
              src={item.coverImage}
              alt={item.title}
              loading={index < 3 ? "eager" : "lazy"}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#1A1A1A] to-[#0D0D0D]">
              <span className="text-[10px] tracking-[0.3em] text-[#2A2A2A]">ANTAQOR</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
            <CategoryChip cat={item.category} />
            {isFresh(item.publishedAt) && (
              <span className="relative inline-flex items-center gap-1 rounded-full bg-[#EF2C58] px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.12em] text-white">
                <span className="absolute -left-0.5 -top-0.5 h-1.5 w-1.5 animate-ping rounded-full bg-[#EF2C58]/70" />
                <span className="relative h-1 w-1 rounded-full bg-white" />
                NEW
              </span>
            )}
          </div>
          <div className="absolute right-2.5 top-2.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white/80 backdrop-blur">
            {item.readingMinutes}m
          </div>
        </div>
        <div className="flex flex-1 flex-col p-4">
          <h3 className="line-clamp-2 text-[15px] font-bold leading-snug text-[#E8E8E8] transition-colors group-hover:text-white">
            {item.title}
          </h3>
          {item.excerpt && (
            <p className="mt-2 line-clamp-2 text-[12px] leading-relaxed text-[#888]">{item.excerpt}</p>
          )}
          <div className="mt-auto flex items-center justify-between gap-3 pt-4 text-[10px] text-[#555]">
            <div className="flex min-w-0 items-center gap-1.5">
              {item.authorAvatar ? (
                <img src={item.authorAvatar} alt="" className="h-4 w-4 shrink-0 rounded-full object-cover" />
              ) : (
                <div className="h-4 w-4 shrink-0 rounded-full bg-[rgba(239,44,88,0.15)]" />
              )}
              <span className="truncate font-semibold text-[#888]">{item.authorName}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span>{formatRelative(item.publishedAt)}</span>
              <span className="text-[#2A2A2A]">·</span>
              <span>{item.views.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function Skeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0F0F0F]">
          <div className="aspect-[16/10] animate-pulse bg-[#181818]" />
          <div className="space-y-2 p-4">
            <div className="h-3 w-3/4 animate-pulse rounded bg-[#181818]" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-[#181818]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export interface NewsFeedProps {
  initialItems: NewsItem[];
  initialCategory?: Category;
  initialQuery?: string;
  initialPages?: number;
  initialTotal?: number;
}

export default function NewsFeed({
  initialItems,
  initialCategory = "All",
  initialQuery = "",
  initialPages = 1,
}: NewsFeedProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [items, setItems] = useState<NewsItem[]>(initialItems);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState<Category>(initialCategory);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(1 < initialPages);
  const [loadingMore, setLoadingMore] = useState(false);
  const [query, setQuery] = useState(initialQuery);
  const firstRender = useRef(true);

  const fetchNews = useCallback(async (p: number, cat: Category, q: string, append: boolean) => {
    try {
      const params = new URLSearchParams({ page: String(p), limit: "12" });
      if (cat !== "All") params.set("category", cat);
      if (q.trim()) params.set("q", q.trim());
      const res = await fetch(`/api/news?${params.toString()}`);
      const data = await res.json();
      const incoming: NewsItem[] = data.items || [];
      setItems((prev) => (append ? [...prev, ...incoming] : incoming));
      setHasMore(p < (data.pagination?.pages || 1));
    } catch {
      if (!append) setItems([]);
      setHasMore(false);
    }
  }, []);

  // URL sync + fetch on category / debounced query change
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const t = setTimeout(() => {
      const sp = new URLSearchParams(searchParams?.toString() || "");
      if (category === "All") sp.delete("category"); else sp.set("category", category);
      if (query.trim()) sp.set("q", query.trim()); else sp.delete("q");
      const qs = sp.toString();
      router.replace(qs ? `/news?${qs}` : "/news", { scroll: false });
      setLoading(true);
      setPage(1);
      fetchNews(1, category, query, false).finally(() => setLoading(false));
    }, 280);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, query]);

  const loadMore = () => {
    const next = page + 1;
    setLoadingMore(true);
    setPage(next);
    fetchNews(next, category, query, true).finally(() => setLoadingMore(false));
  };

  const featured = useMemo(() => items.find((i) => i.featured) || items[0], [items]);
  const rest = useMemo(
    () => items.filter((i) => i._id !== featured?._id),
    [items, featured]
  );

  const filtered = rest;

  return (
    <div className="mx-auto max-w-6xl px-1 pb-10">
      {/* Hero header */}
      <section className="mb-7 pt-1">
        <div className="flex items-center gap-2">
          <div className="h-[2px] w-5 bg-[#EF2C58]" />
          <span className="text-[11px] font-bold tracking-[0.2em] text-[#EF2C58]">AI · NEWS</span>
        </div>
        <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-[28px] font-black leading-[1.05] tracking-tight text-[#E8E8E8] md:text-[40px]">
              AI-н хамгийн<br className="hidden md:block" /> сүүлийн үеийн мэдээ
            </h1>
            <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-[#666] md:text-[14px]">
              LLM, агент, судалгаа, Монголын AI салбарын шинэ мэдээ —
              өдөр бүр шинэчлэгддэг редактор хянасан блог.
            </p>
          </div>
          <div className="relative w-full md:w-[280px]">
            <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#555]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Хайх — LLM, Agent, Claude..."
              className="w-full rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0F0F0F] py-2.5 pl-9 pr-9 text-[13px] text-[#E8E8E8] placeholder-[#444] outline-none transition focus:border-[rgba(239,44,88,0.4)]"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Цэвэрлэх"
                className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-[#555] transition hover:bg-[#1A1A1A] hover:text-[#E8E8E8]"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Category chips */}
      <div className="relative mb-6">
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-1.5 pb-1 pr-6">
            {CATEGORIES.map((c) => {
              const active = category === c;
              const color = c === "All" ? "#EF2C58" : CATEGORY_COLORS[c as Exclude<Category, "All">];
              return (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className="shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-all duration-200"
                  style={{
                    background: active ? color : "rgba(255,255,255,0.04)",
                    color: active ? "#FFFFFF" : "#888888",
                    boxShadow: active ? `0 0 20px ${color}26` : "none",
                  }}
                >
                  {c === "All" ? "Бүгд" : c}
                </button>
              );
            })}
          </div>
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[#0a0a0a] to-transparent md:hidden" />
      </div>

      {loading ? (
        <Skeleton />
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-[4px] border border-dashed border-[rgba(255,255,255,0.08)] bg-[#0D0D0D] py-20 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(239,44,88,0.08)]">
            <svg className="h-5 w-5 text-[#EF2C58]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v12a2 2 0 01-2 2zM7 8h10M7 12h10M7 16h6" />
            </svg>
          </div>
          <div>
            <div className="text-[15px] font-bold text-[#E8E8E8]">Мэдээ хараахан нийтлэгдээгүй</div>
            <div className="mt-1 text-[12px] text-[#555]">Удахгүй шинэ контент нэмэгдэнэ</div>
          </div>
        </div>
      ) : (
        <>
          {featured && category === "All" && !query && <FeaturedHero item={featured} />}

          <div className="mt-6 mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="h-[2px] w-4"
                style={{
                  background:
                    category === "All"
                      ? "#EF2C58"
                      : CATEGORY_COLORS[category as Exclude<Category, "All">],
                }}
              />
              <span className="text-[11px] font-bold tracking-[0.12em] text-[#E8E8E8]">
                {query
                  ? `"${query}" ҮР ДҮН`
                  : category === "All"
                    ? "СҮҮЛИЙН ҮЕИЙН"
                    : `${category.toUpperCase()} · СҮҮЛИЙН ҮЕИЙН`}
              </span>
            </div>
            <span className="text-[10px] text-[#555]">{filtered.length}+ мэдээ</span>
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-4 rounded-[4px] border border-dashed border-[rgba(255,255,255,0.08)] bg-[#0D0D0D] py-12 px-6 text-center">
              <div className="text-[13px] text-[#999]">
                <span className="text-[#EF2C58]">"{query}"</span>-д тохирох мэдээ олдсонгүй
              </div>
              <div className="text-[11px] text-[#555]">Эдгээр ангилалаас үзвэл үү:</div>
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                {(["AI", "LLM", "Agents", "Бизнес"] as Exclude<Category, "All">[]).map((c) => (
                  <button
                    key={c}
                    onClick={() => { setQuery(""); setCategory(c); }}
                    className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[#111] px-3 py-1 text-[11px] font-semibold text-[#AAA] transition hover:border-[rgba(239,44,88,0.35)] hover:text-[#EF2C58]"
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((n, i) => (
                <NewsCard key={n._id} item={n} index={i} />
              ))}
            </div>
          )}

          {hasMore && !query && (
            <div className="mt-8 flex justify-center">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="group flex items-center gap-2 rounded-full border border-[rgba(255,255,255,0.08)] bg-[#0F0F0F] px-6 py-2.5 text-[12px] font-bold text-[#AAA] transition hover:border-[rgba(239,44,88,0.3)] hover:text-[#EF2C58] disabled:opacity-50"
              >
                {loadingMore ? (
                  <>
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-[#EF2C58] border-t-transparent" />
                    Ачаалж байна...
                  </>
                ) : (
                  <>
                    Илүү үзэх
                    <svg className="h-3.5 w-3.5 transition-transform group-hover:translate-y-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                  </>
                )}
              </button>
            </div>
          )}
        </>
      )}

      {/* Footer CTA — nudge non-users */}
      <section className="mt-12 overflow-hidden rounded-[4px] border border-[rgba(239,44,88,0.18)] bg-gradient-to-br from-[rgba(239,44,88,0.08)] via-[#0D0D0D] to-[#0D0D0D] p-6 md:p-8">
        <div className="flex flex-col items-start gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[10px] font-bold tracking-[0.2em] text-[#EF2C58]">COMMUNITY</div>
            <h3 className="mt-1.5 text-[20px] font-bold leading-tight text-[#E8E8E8] md:text-[22px]">
              Мэдээлэлд хамгийн түрүүнд хүр
            </h3>
            <p className="mt-1 text-[12px] text-[#666] md:text-[13px]">
              Cyber Empire нэгдэж промт, агент, AI бизнес-ийн дотоод контентод хандах эрх аваарай.
            </p>
          </div>
          <Link
            href="/auth/signup"
            className="group relative overflow-hidden rounded-[4px] bg-[#EF2C58] px-6 py-3 text-[13px] font-bold text-white shadow-[0_0_32px_rgba(239,44,88,0.15)] transition hover:shadow-[0_0_44px_rgba(239,44,88,0.35)]"
          >
            <span className="relative z-10">Нэгдэх →</span>
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
          </Link>
        </div>
      </section>
    </div>
  );
}
