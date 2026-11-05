import type { Metadata } from "next";
import Link from "next/link";
import { listMagazine, magazineCounts } from "@/lib/magazine";
import { MAG_CATEGORIES } from "@/lib/magazineRender";
import css from "@/components/magazine/magazine.module.css";

/* ─── /magazine — Antaqor сэтгүүлийн нүүр (2026-10-11) ─────────────────────
   Нүүр: масттэд (гарчиг + огноо) → ангиллын мөр (тоотой) → COVER STORY
   (онцлох эсвэл хамгийн шинэ, том) → бусад нь 3 баганатай тор.
   Нийтэд нээлттэй (хайлт, хуваалцалтын эх үүсвэр) — 60с тутам шинэчлэгдэнэ. */

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Magazine — AI entrepreneur-ийн сэтгүүл",
  description: "AI, бизнес, хэрэгсэл, кейс — Монголын AI entrepreneur-уудад зориулсан Antaqor сэтгүүл.",
  alternates: { canonical: "/magazine" },
  openGraph: { title: "Antaqor Magazine", description: "AI entrepreneur-ийн сэтгүүл", url: "/magazine", type: "website" },
};

function meta(a: { category: string; readingMinutes: number; views: number }) {
  return `${a.category} · ${a.readingMinutes} мин · ${a.views.toLocaleString()} үзсэн`;
}

export default async function MagazinePage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const active = MAG_CATEGORIES.includes(category as never) ? category : undefined;
  const [items, counts] = await Promise.all([listMagazine(active), magazineCounts()]);
  const [cover, ...rest] = items;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const today = new Intl.DateTimeFormat("mn-MN", { timeZone: "Asia/Ulaanbaatar", year: "numeric", month: "long", day: "numeric" }).format(new Date());
  const border = "rgba(255,255,255,0.16)";

  return (
    <main className="mx-auto w-full max-w-[1100px] px-4 pb-24 pt-4 lg:px-0">
      {/* ── Масттэд ── */}
      <header className="border-b-2 pb-4" style={{ borderColor: border }}>
        <div className="flex items-baseline justify-between gap-3 font-mono text-[11px] tracking-[0.16em] text-[#9C9CA6]">
          <span>ANTAQOR · MAGAZINE</span><span>{today}</span>
        </div>
        <h1 className="mt-2 text-[clamp(40px,8vw,88px)] font-extrabold leading-[0.95] tracking-[-0.04em] text-white">
          Magazine<span className="text-[#2E29FF]">.</span>
        </h1>
        <p className="mt-2 max-w-[560px] text-[15px] text-[#C9C9D1]">AI, бизнес, хэрэгсэл — Монголын AI entrepreneur-уудын унших ёстой зүйлс.</p>
      </header>

      {/* ── Ангилал ── */}
      <nav className="scrollbar-hide -mx-4 flex overflow-x-auto border-b-2 px-4 sm:mx-0 sm:px-0" style={{ borderColor: border }} aria-label="Ангилал">
        {[{ id: "", name: "Бүгд", n: total }, ...MAG_CATEGORIES.map((c) => ({ id: c, name: c, n: counts[c] || 0 }))].map((c) => {
          const on = (active || "") === c.id;
          return (
            <Link
              key={c.id || "all"}
              href={c.id ? `/magazine?category=${encodeURIComponent(c.id)}` : "/magazine"}
              className="flex shrink-0 flex-col border-r px-4 py-3 transition"
              style={{ borderColor: border, background: on ? "#F2F2F4" : "transparent", color: on ? "#0A0A0A" : "#30333F" }}
            >
              <strong className="text-[14px]">{c.name}</strong>
              <span className="text-[11px]" style={{ color: on ? "#333333" : "#565967" }}>{c.n} нийтлэл</span>
            </Link>
          );
        })}
      </nav>

      {!cover ? (
        <p className="py-16 text-center text-[15px] text-[#9C9CA6]">Энэ ангилалд нийтлэл алга байна.</p>
      ) : (
        <>
          {/* ── Cover story ── */}
          <Link href={`/magazine/${encodeURIComponent(cover.slug)}`} className="group grid gap-5 border-b-2 py-6 lg:grid-cols-[1.4fr_1fr] lg:items-end" style={{ borderColor: border }}>
            <div className="relative aspect-[16/9] overflow-hidden rounded-[4px] bg-[#141414]">
              {cover.coverImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cover.coverImage} alt="" className={`${css.bw} h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]`} />
              )}
              {cover.featured && <span className="absolute left-3 top-3 rounded-[4px] bg-[#FCEE0A] px-2 py-1 text-[11px] font-extrabold text-[#0A0A0A]">COVER STORY</span>}
            </div>
            <div>
              <div className="font-mono text-[12px] tracking-[0.06em] text-[#2E29FF]">{meta(cover)}</div>
              <h2 className="mt-2 text-[clamp(28px,4vw,46px)] font-extrabold leading-[1.05] tracking-[-0.03em] text-white group-hover:text-[#2E29FF]">{cover.title}</h2>
              {cover.excerpt && <p className="mt-3 text-[16px] leading-[1.6] text-[#C9C9D1]">{cover.excerpt}</p>}
              <span className="mt-4 inline-block text-[14px] font-bold text-[#2E29FF]">Унших →</span>
            </div>
          </Link>

          {/* ── Бусад ── */}
          {rest.length > 0 && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((a) => (
                <Link key={a.slug} href={`/magazine/${encodeURIComponent(a.slug)}`} className="group flex flex-col gap-3 border-b-2 py-5 sm:px-3 sm:[&:nth-child(odd)]:border-r-2 lg:[&:nth-child(odd)]:border-r-0 lg:[&:not(:nth-child(3n))]:border-r-2" style={{ borderColor: border }}>
                  <div className="aspect-[16/9] overflow-hidden rounded-[4px] bg-[#141414]">
                    {a.coverImage && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.coverImage} alt="" loading="lazy" className={`${css.bw} h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]`} />
                    )}
                  </div>
                  <div className="font-mono text-[11.5px] text-[#2E29FF]">{meta(a)}</div>
                  <h3 className="text-[20px] font-extrabold leading-[1.2] text-white group-hover:text-[#2E29FF]">{a.title}</h3>
                  {a.excerpt && <p className="line-clamp-2 text-[14px] leading-[1.55] text-[#9C9CA6]">{a.excerpt}</p>}
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
