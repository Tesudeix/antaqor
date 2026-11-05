import type { Metadata } from "next";
import Link from "next/link";
import dbConnect from "@/lib/mongodb";
import MarketProduct from "@/models/MarketProduct";
import MarketCard from "@/components/MarketCard";
import MarketFilterBar from "@/components/MarketFilterBar";

type SearchParams = Promise<{ q?: string; category?: string; sort?: string; price?: string }>;

const CATEGORIES = [
  { key: "All", label: "Бүгд", color: "var(--accent-ink, #2E29FF)" },
  { key: "Prompt", label: "Prompt", color: "var(--accent-ink, #2E29FF)" },
  { key: "Course", label: "Курс", color: "var(--accent-ink, #2E29FF)" },
  { key: "Template", label: "Template", color: "#06B6D4" },
  { key: "Agent", label: "AI Agent", color: "#F59E0B" },
  { key: "Service", label: "Сервис", color: "var(--accent-ink, #2E29FF)" },
  { key: "Digital", label: "Digital", color: "var(--accent-ink, #2E29FF)" },
] as const;

const SORT_KEYS = ["new", "popular", "price_asc", "price_desc"];
const PRICE_KEYS = ["all", "free", "paid"];

const CATEGORY_COLORS: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.color]));

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
    title, description,
    alternates: { canonical: "/market" },
    openGraph: { title: `${title} · ANTAQOR Market`, description, url: "/market", images: ["/brand/cover"] },
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
  const sort = sp.sort && SORT_KEYS.includes(sp.sort) ? sp.sort : "new";
  const price = sp.price && PRICE_KEYS.includes(sp.price) ? sp.price : "all";

  await dbConnect();

  const query: Record<string, unknown> = { published: true, approved: true };
  if (category !== "All") query.category = category;
  if (price === "free") query.price = 0;
  else if (price === "paid") query.price = { $gt: 0 };
  if (q) {
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(safe, "i");
    query.$or = [{ title: rx }, { summary: rx }, { tags: rx }];
  }

  const sortSpec: Record<string, 1 | -1> =
    sort === "price_asc" ? { price: 1, createdAt: -1 } :
    sort === "price_desc" ? { price: -1, createdAt: -1 } :
    sort === "popular" ? { views: -1, createdAt: -1 } :
    { featured: -1, createdAt: -1 };

  const hasFilter = category !== "All" || !!q || sort !== "new" || price !== "all";

  const [items, total, featured] = await Promise.all([
    MarketProduct.find(query).sort(sortSpec).limit(24).select("-description").lean(),
    MarketProduct.countDocuments(query),
    !hasFilter
      ? MarketProduct.findOne({ published: true, approved: true, featured: true }).sort({ createdAt: -1 }).lean()
      : Promise.resolve(null),
  ]);

  type Raw = {
    _id: { toString(): string };
    title: string; slug: string; summary: string;
    coverImage: string; gallery?: string[]; category: string; price: number; compareAtPrice: number;
    sellerName: string; sellerAvatar: string; tags: string[]; views?: number; featured?: boolean;
    createdAt?: string | Date;
  };
  const normalize = (r: Raw) => ({
    _id: r._id.toString(), title: r.title, slug: r.slug, summary: r.summary || "",
    coverImage: r.coverImage || "", gallery: r.gallery || [], category: r.category, price: r.price || 0,
    compareAtPrice: r.compareAtPrice || 0, sellerName: r.sellerName || "Antaqor",
    sellerAvatar: r.sellerAvatar || "", tags: r.tags || [], views: r.views || 0, featured: !!r.featured,
    createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : "",
  });

  const normalized = (items as unknown as Raw[]).map(normalize);
  const featuredItem = featured ? normalize(featured as unknown as Raw) : null;
  const rest = featuredItem ? normalized.filter((n) => n._id !== featuredItem._id) : normalized;
  const isEmpty = normalized.length === 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10">
      {/* Hero */}
      <section className="pt-1">
        <div className="flex items-center gap-2">
          <div className="h-[2px] w-5 bg-[#2E29FF]" />
          <span className="text-[11px] font-bold tracking-[0.2em] text-[#2E29FF]">MARKET</span>
          <span className="rounded-[4px] bg-[rgba(46,41,255,0.12)] px-2 py-0.5 text-[11px] font-black uppercase text-[#2E29FF]">Beta</span>
        </div>
        <h1 className="mt-2.5 text-[28px] font-black leading-[1.05] tracking-tight text-[#0e1726] md:text-[26px] md:text-[40px]">
          Creator-уудын зах зээл
        </h1>
        <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-[#E2E4E8] md:text-[14px]">
          Промт, курс, template, AI agent, сервис — Antaqor-н бүтээгчдээс шууд.
        </p>
      </section>

      {/* ── Results header + discovery (search · price · sort · category) ── */}
      <MarketFilterBar category={category} q={q} sort={sort} price={price} total={total} />

      {/* Featured hero */}
      {featuredItem && !hasFilter && (
        <Link href={`/market/${featuredItem.slug}`} className="group relative block overflow-hidden rounded-[4px] border border-[rgba(15,23,38,0.08)] bg-[#f7f9fb]">
          <div className="grid md:grid-cols-[1.15fr_1fr]">
            <div className="relative aspect-[16/10] md:aspect-auto md:h-full bg-[#F2F2F4]">
              {featuredItem.coverImage ? (
                <img src={featuredItem.coverImage} alt={featuredItem.title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#F2F2F4] to-[#f7f9fb]"><span className="text-[10px] tracking-[0.3em] text-[#d5dce3]">ANTAQOR</span></div>
              )}
              <div className="absolute top-3 left-3 flex items-center gap-1.5">
                <span className="rounded-[4px] bg-[#2E29FF] px-2 py-0.5 text-[11px] font-black uppercase tracking-[0.12em] text-white">Featured</span>
                <span className="rounded-[4px] px-2 py-0.5 text-[11px] font-black uppercase" style={{ background: `${CATEGORY_COLORS[featuredItem.category]}F2`, color: "#fff" }}>{featuredItem.category}</span>
              </div>
            </div>
            <div className="relative flex flex-col justify-between gap-4 p-5 md:p-7">
              <div>
                <h2 className="text-[22px] font-bold leading-[1.15] text-[#0e1726] md:text-[28px]">{featuredItem.title}</h2>
                {featuredItem.summary && <p className="mt-3 line-clamp-3 text-[13px] leading-relaxed text-[#E2E4E8] md:text-[14px]">{featuredItem.summary}</p>}
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[11px] text-[#E2E4E8]">
                  {featuredItem.sellerAvatar ? (
                    <img src={featuredItem.sellerAvatar} alt="" className="h-6 w-6 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-6 w-6 items-center justify-center rounded-[4px] bg-[rgba(46,41,255,0.12)] text-[10px] font-bold text-[#2E29FF]">{featuredItem.sellerName.charAt(0)}</div>
                  )}
                  <span className="font-semibold text-[#475569]">{featuredItem.sellerName}</span>
                </div>
                <div className="text-right">
                  {featuredItem.compareAtPrice > featuredItem.price && <div className="text-[11px] text-[#E2E4E8] line-through">{fmtPrice(featuredItem.compareAtPrice)}</div>}
                  <div className="text-[20px] font-black text-[#2E29FF]">{fmtPrice(featuredItem.price)}</div>
                </div>
              </div>
            </div>
          </div>
        </Link>
      )}

      {/* Grid / empty state */}
      {isEmpty ? (
        <div className="rounded-[4px] border border-dashed border-[rgba(15,23,38,0.08)] bg-[#f7f9fb] py-16 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[4px] bg-[rgba(46,41,255,0.08)]">
            <svg className="h-6 w-6 text-[#2E29FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72" /></svg>
          </div>
          <div className="text-[16px] font-bold text-[#0e1726]">{q ? `"${q}"-ийн үр дүн олдсонгүй` : "Бүтээгдэхүүн олдсонгүй"}</div>
          <div className="mt-1 text-[12px] text-[#E2E4E8]">{hasFilter ? "Шүүлтүүрээ өөрчлөх эсвэл цэвэрлээрэй" : "Та эхний борлуулагч бол — 20% fee, шууд борлуулалт"}</div>
          {hasFilter ? (
            <Link href="/market" className="mt-5 inline-block rounded-[4px] border border-[rgba(15,23,38,0.12)] bg-[#eef2f6] px-6 py-2.5 text-[13px] font-bold text-[#475569]">Шүүлтүүр цэвэрлэх</Link>
          ) : (
            <Link href="/market/sell" className="mt-5 inline-block rounded-[4px] bg-[#2E29FF] px-6 py-2.5 text-[13px] font-bold text-white transition hover:shadow-[0_0_32px_rgba(46,41,255,0.3)]">Эхний seller болох →</Link>
          )}
        </div>
      ) : (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-[2px] w-4 bg-[#2E29FF]" />
              <span className="text-[11px] font-bold tracking-[0.12em] text-[#0e1726]">{hasFilter ? "ҮР ДҮН" : "ШИНЭ БҮТЭЭГДЭХҮҮН"}</span>
            </div>
            <span className="text-[10px] text-[#E2E4E8]">{total} бүтээгдэхүүн</span>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {rest.map((p, idx) => (
              <MarketCard key={p._id} p={p} index={idx} />
            ))}
          </div>
        </section>
      )}

      {/* Become a seller CTA */}
      <section className="overflow-hidden rounded-[4px] border border-[rgba(46,41,255,0.18)] bg-gradient-to-br from-[rgba(46,41,255,0.08)] via-[#f7f9fb] to-[#f7f9fb] p-6 md:p-8">
        <div className="grid gap-5 md:grid-cols-[1.3fr_1fr] md:items-center">
          <div>
            <div className="text-[10px] font-bold tracking-[0.2em] text-[#2E29FF]">FOR CREATORS</div>
            <h3 className="mt-1.5 text-[20px] font-bold leading-tight text-[#0e1726] md:text-[24px]">Чи бүтээдэг. Бид зах зээл рүү хүргэнэ.</h3>
            <p className="mt-2 max-w-lg text-[12px] leading-relaxed text-[#E2E4E8] md:text-[13px]">Prompt, course, template, agent — хэн ч борлуулж болно. Antaqor-д 20% fee, үлдсэн 80% чинийх. Payouts weekly via QPay.</p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {["20% fee", "Weekly payout", "0 setup", "Marketing орно"].map((b) => (
                <span key={b} className="rounded-[4px] border border-[rgba(15,23,38,0.08)] bg-[#eef2f6] px-2.5 py-1 text-[10px] font-semibold text-[#475569]">{b}</span>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Link href="/market/sell" className="flex items-center justify-center gap-2 rounded-[4px] bg-[#2E29FF] px-6 py-3 text-[13px] font-bold text-white transition hover:shadow-[0_0_32px_rgba(46,41,255,0.3)]">
              Эхний seller болох
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </Link>
            <Link href="/news" className="flex items-center justify-center gap-2 rounded-[4px] border border-[rgba(15,23,38,0.08)] bg-[#f2f5f8] px-6 py-3 text-[12px] font-bold text-[#475569] transition hover:text-[#2E29FF]">Яаж эхлэх вэ? →</Link>
          </div>
        </div>
      </section>
    </div>
  );
}

export const dynamic = "force-dynamic";
