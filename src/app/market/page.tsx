import type { Metadata } from "next";
import Link from "next/link";
import dbConnect from "@/lib/mongodb";
import MarketProduct from "@/models/MarketProduct";

type SearchParams = Promise<{ q?: string; category?: string }>;

const CATEGORIES = [
  { key: "All", label: "Бүгд", color: "#EF2C58" },
  { key: "Prompt", label: "Prompt", color: "#A855F7" },
  { key: "Course", label: "Курс", color: "#EF2C58" },
  { key: "Template", label: "Template", color: "#06B6D4" },
  { key: "Agent", label: "AI Agent", color: "#F59E0B" },
  { key: "Service", label: "Сервис", color: "#EC4899" },
  { key: "Digital", label: "Digital", color: "#3B82F6" },
] as const;

const CATEGORY_COLORS: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c.color])
);

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const sp = await searchParams;
  const q = (sp.q || "").trim();
  const cat = sp.category && sp.category !== "All" ? sp.category : "";

  const parts: string[] = [];
  if (q) parts.push(`"${q}"`);
  if (cat) parts.push(cat);
  const suffix = parts.length ? ` — ${parts.join(" · ")}` : "";

  const title = `Market${suffix}`;
  const description = "AI creator-ын бүтээгдэхүүний зах зээл — промт, курс, template, агент, сервис. Antaqor-н creator-ууд борлуулдаг.";

  return {
    title,
    description,
    alternates: { canonical: "/market" },
    openGraph: {
      title: `${title} · ANTAQOR Market`,
      description,
      url: "/market",
      images: ["/opengraph-image"],
    },
    keywords: ["AI marketplace", "prompt worth buying", "AI курс", "AI template", "AI agent", "Mongolia AI creator", "Antaqor market"],
  };
}

function fmtPrice(mnt: number): string {
  if (mnt === 0) return "Үнэгүй";
  return `₮${mnt.toLocaleString("mn-MN")}`;
}

export default async function MarketPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const category = sp.category && CATEGORIES.some((c) => c.key === sp.category) ? sp.category : "All";
  const q = (sp.q || "").trim();

  await dbConnect();

  const query: Record<string, unknown> = { published: true, approved: true };
  if (category !== "All") query.category = category;
  if (q) {
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(safe, "i");
    query.$or = [{ title: rx }, { summary: rx }, { tags: rx }];
  }

  const [items, total, featured] = await Promise.all([
    MarketProduct.find(query).sort({ featured: -1, createdAt: -1 }).limit(24).select("-description").lean(),
    MarketProduct.countDocuments(query),
    category === "All" && !q
      ? MarketProduct.findOne({ published: true, approved: true, featured: true }).sort({ createdAt: -1 }).lean()
      : Promise.resolve(null),
  ]);

  type Raw = {
    _id: { toString(): string };
    title: string; slug: string; summary: string;
    coverImage: string; category: string; price: number; compareAtPrice: number;
    sellerName: string; sellerAvatar: string; tags: string[];
    featured?: boolean;
  };

  const normalize = (r: Raw) => ({
    _id: r._id.toString(),
    title: r.title,
    slug: r.slug,
    summary: r.summary || "",
    coverImage: r.coverImage || "",
    category: r.category,
    price: r.price || 0,
    compareAtPrice: r.compareAtPrice || 0,
    sellerName: r.sellerName || "Antaqor",
    sellerAvatar: r.sellerAvatar || "",
    tags: r.tags || [],
    featured: !!r.featured,
  });

  const normalized = (items as unknown as Raw[]).map(normalize);
  const featuredItem = featured ? normalize(featured as unknown as Raw) : null;
  const rest = featuredItem ? normalized.filter((n) => n._id !== featuredItem._id) : normalized;

  const isEmpty = normalized.length === 0;

  return (
    <div className="mx-auto max-w-6xl space-y-7 pb-10">
      {/* Hero */}
      <section className="pt-1">
        <div className="flex items-center gap-2">
          <div className="h-[2px] w-5 bg-[#EF2C58]" />
          <span className="text-[11px] font-bold tracking-[0.2em] text-[#EF2C58]">MARKET</span>
          <span className="rounded-full bg-[rgba(239,44,88,0.12)] px-2 py-0.5 text-[9px] font-black uppercase text-[#EF2C58]">Beta</span>
        </div>
        <div className="mt-2.5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-[28px] font-black leading-[1.05] tracking-tight text-[#E8E8E8] md:text-[40px]">
              Creator-уудын<br className="hidden md:block" /> зах зээл
            </h1>
            <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-[#666] md:text-[14px]">
              Промт, курс, template, AI agent, сервис — Antaqor-н бүтээгчдээс шууд.
            </p>
          </div>
          <form action="/market" method="get" className="relative w-full md:w-[280px]">
            <input type="hidden" name="category" value={category} />
            <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#555]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Хайх — prompt, course, agent..."
              className="w-full rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0F0F0F] py-2.5 pl-9 pr-3 text-[13px] text-[#E8E8E8] placeholder-[#444] outline-none transition focus:border-[rgba(239,44,88,0.4)]"
            />
          </form>
        </div>
      </section>

      {/* Category chips */}
      <div className="overflow-x-auto scrollbar-hide -mx-1 px-1">
        <div className="flex items-center gap-1.5 pb-1">
          {CATEGORIES.map((c) => {
            const active = category === c.key;
            const href = (() => {
              const p = new URLSearchParams();
              if (c.key !== "All") p.set("category", c.key);
              if (q) p.set("q", q);
              const s = p.toString();
              return s ? `/market?${s}` : "/market";
            })();
            return (
              <Link
                key={c.key}
                href={href}
                scroll={false}
                className="shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-all duration-200"
                style={{
                  background: active ? c.color : "rgba(255,255,255,0.04)",
                  color: active ? "#FFFFFF" : "#888888",
                  boxShadow: active ? `0 0 20px ${c.color}26` : "none",
                }}
              >
                {c.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Featured hero */}
      {featuredItem && category === "All" && !q && (
        <Link
          href={`/market/${featuredItem.slug}`}
          className="group relative block overflow-hidden rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0D0D0D]"
        >
          <div className="grid md:grid-cols-[1.15fr_1fr]">
            <div className="relative aspect-[16/10] md:aspect-auto md:h-full bg-[#1A1A1A]">
              {featuredItem.coverImage ? (
                <img src={featuredItem.coverImage} alt={featuredItem.title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#1A1A1A] to-[#0D0D0D]">
                  <span className="text-[10px] tracking-[0.3em] text-[#333]">ANTAQOR</span>
                </div>
              )}
              <div className="absolute top-3 left-3 flex items-center gap-1.5">
                <span className="rounded-full bg-[#EF2C58] px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-white">
                  Featured
                </span>
                <span className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase" style={{ background: `${CATEGORY_COLORS[featuredItem.category]}F2`, color: "#fff" }}>
                  {featuredItem.category}
                </span>
              </div>
            </div>
            <div className="relative flex flex-col justify-between gap-4 p-5 md:p-7">
              <div>
                <h2 className="text-[22px] font-bold leading-[1.15] text-[#E8E8E8] md:text-[28px]">
                  {featuredItem.title}
                </h2>
                {featuredItem.summary && (
                  <p className="mt-3 line-clamp-3 text-[13px] leading-relaxed text-[#999] md:text-[14px]">
                    {featuredItem.summary}
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[11px] text-[#666]">
                  {featuredItem.sellerAvatar ? (
                    <img src={featuredItem.sellerAvatar} alt="" className="h-6 w-6 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[rgba(239,44,88,0.12)] text-[10px] font-bold text-[#EF2C58]">
                      {featuredItem.sellerName.charAt(0)}
                    </div>
                  )}
                  <span className="font-semibold text-[#BBB]">{featuredItem.sellerName}</span>
                </div>
                <div className="text-right">
                  {featuredItem.compareAtPrice > featuredItem.price && (
                    <div className="text-[11px] text-[#555] line-through">{fmtPrice(featuredItem.compareAtPrice)}</div>
                  )}
                  <div className="text-[20px] font-black text-[#EF2C58]">{fmtPrice(featuredItem.price)}</div>
                </div>
              </div>
            </div>
          </div>
        </Link>
      )}

      {/* Grid / empty state */}
      {isEmpty ? (
        <div className="rounded-[4px] border border-dashed border-[rgba(255,255,255,0.08)] bg-[#0D0D0D] py-16 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(239,44,88,0.08)]">
            <svg className="h-6 w-6 text-[#EF2C58]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" /></svg>
          </div>
          <div className="text-[16px] font-bold text-[#E8E8E8]">
            {q ? `"${q}"-ийн үр дүн олдсонгүй` : "Анхны бүтээгдэхүүн удахгүй"}
          </div>
          <div className="mt-1 text-[12px] text-[#555]">
            {q ? "Өөр түлхүүр үг эсвэл ангилал туршиж үзээрэй" : "Та эхний borloulaachy бол — 20% fee, шууд борлуулалт"}
          </div>
          {!q && (
            <Link href="/auth/signup?ref=seller" className="mt-5 inline-block rounded-[4px] bg-[#EF2C58] px-6 py-2.5 text-[13px] font-bold text-white transition hover:shadow-[0_0_32px_rgba(239,44,88,0.3)]">
              Эхний seller болох →
            </Link>
          )}
        </div>
      ) : (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-[2px] w-4 bg-[#EF2C58]" />
              <span className="text-[11px] font-bold tracking-[0.12em] text-[#E8E8E8]">
                {q || category !== "All" ? "ҮР ДҮН" : "ШИНЭ БҮТЭЭГДЭХҮҮН"}
              </span>
            </div>
            <span className="text-[10px] text-[#555]">{total} бүтээгдэхүүн</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {rest.map((p, idx) => {
              const color = CATEGORY_COLORS[p.category] || "#EF2C58";
              const hasDiscount = p.compareAtPrice > p.price;
              return (
                <Link
                  key={p._id}
                  href={`/market/${p.slug}`}
                  className="group flex flex-col overflow-hidden rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0F0F0F] transition hover:border-[rgba(239,44,88,0.25)]"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-[#1A1A1A]">
                    {p.coverImage ? (
                      <img
                        src={p.coverImage}
                        alt={p.title}
                        loading={idx < 4 ? "eager" : "lazy"}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#1A1A1A] to-[#0D0D0D]">
                        <span className="text-[10px] tracking-[0.3em] text-[#2A2A2A]">ANTAQOR</span>
                      </div>
                    )}
                    <div className="absolute top-2 left-2">
                      <span className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase" style={{ background: `${color}F2`, color: "#fff" }}>
                        {p.category}
                      </span>
                    </div>
                    {hasDiscount && (
                      <div className="absolute top-2 right-2 rounded-full bg-black/70 px-1.5 py-0.5 text-[9px] font-black text-[#EF2C58] backdrop-blur">
                        −{Math.round(((p.compareAtPrice - p.price) / p.compareAtPrice) * 100)}%
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-3">
                    <h3 className="line-clamp-2 text-[13px] font-bold leading-snug text-[#E8E8E8] transition-colors group-hover:text-white">
                      {p.title}
                    </h3>
                    {p.summary && (
                      <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-[#777]">{p.summary}</p>
                    )}
                    <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                      <div className="flex min-w-0 items-center gap-1.5">
                        {p.sellerAvatar ? (
                          <img src={p.sellerAvatar} alt="" className="h-4 w-4 shrink-0 rounded-full object-cover" />
                        ) : (
                          <div className="h-4 w-4 shrink-0 rounded-full bg-[rgba(239,44,88,0.15)]" />
                        )}
                        <span className="truncate text-[10px] font-semibold text-[#888]">{p.sellerName}</span>
                      </div>
                      <div className="text-right">
                        {hasDiscount && (
                          <div className="text-[9px] text-[#555] line-through leading-none">{fmtPrice(p.compareAtPrice)}</div>
                        )}
                        <div className="text-[13px] font-black text-[#EF2C58] leading-none">{fmtPrice(p.price)}</div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Become a seller CTA */}
      <section className="overflow-hidden rounded-[4px] border border-[rgba(239,44,88,0.18)] bg-gradient-to-br from-[rgba(239,44,88,0.08)] via-[#0D0D0D] to-[#0D0D0D] p-6 md:p-8">
        <div className="grid gap-5 md:grid-cols-[1.3fr_1fr] md:items-center">
          <div>
            <div className="text-[10px] font-bold tracking-[0.2em] text-[#EF2C58]">FOR CREATORS</div>
            <h3 className="mt-1.5 text-[20px] font-bold leading-tight text-[#E8E8E8] md:text-[24px]">
              Чи бүтээдэг. Бид зах зээл рүү хүргэнэ.
            </h3>
            <p className="mt-2 max-w-lg text-[12px] leading-relaxed text-[#888] md:text-[13px]">
              Prompt, course, template, agent — хэн ч борлуулж болно. Antaqor-д 20% fee, үлдсэн 80% чинийх. Payouts weekly via QPay.
            </p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {["20% fee", "Weekly payout", "0 setup", "Marketing inclded"].map((b) => (
                <span key={b} className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[#111] px-2.5 py-1 text-[10px] font-semibold text-[#AAA]">
                  {b}
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Link href="/credits" className="flex items-center justify-center gap-2 rounded-[4px] bg-[#EF2C58] px-6 py-3 text-[13px] font-bold text-white transition hover:shadow-[0_0_32px_rgba(239,44,88,0.3)]">
              Эхний seller болох
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </Link>
            <Link href="/news" className="flex items-center justify-center gap-2 rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0F0F0F] px-6 py-3 text-[12px] font-bold text-[#AAA] transition hover:text-[#EF2C58]">
              Яаж эхлэх вэ? →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

export const dynamic = "force-dynamic";
