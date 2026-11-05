import type { Metadata } from "next";
import Link from "next/link";
import dbConnect from "@/lib/mongodb";
import Service from "@/models/Service";

/* ─── /services — Antaqor экосистемийн бизнесүүд (2026-10-11 шинэчлэл) ──────
   Өмнө нь клиент талын жагсаалт: хайлт + ангиллын таб + YouTube→MP3 гэх мэт
   хэрэгсэл холилдсон, Freelancer Market гэх "удахгүй" мөр — 3 бизнест
   илүүдэл. Одоо ЗӨВХӨН жинхэнэ бизнесүүд, серверт зурагдана (ачаалал
   хүлээхгүй):
     • Онцлох (featured) — том хоёр баганат витрин
     • Бусад — cover + logo тэмдэг + ангилал + тайлбар + tag + "Зочлох ↗"
     • Төгсгөлд хамтын ажиллагааны CTA (/partnerships)
   Өгөгдөл: `services` коллекц (/admin/services-ээр засна). inactive нь
   нуугдана. Зураг нь энгийн <img> — гадны домэйны next/image тохиргоо
   шаардлагагүй. */

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Үйлчилгээ — Antaqor экосистем",
  description: "Antaqor-ын бүтээж, ажиллуулж буй бизнесүүд.",
  alternates: { canonical: "/services" },
};

type Svc = {
  _id: string; name: string; slug: string; description: string; logo: string; coverImage: string;
  category: string; url: string; domain: string; status: "active" | "coming_soon" | "inactive";
  featured: boolean; order: number; tags: string[];
};

const B = "var(--t-line, rgba(255,255,255,0.12))";
const SURF = "var(--t-surface, #141414)";

function Logo({ s, size }: { s: Svc; size: number }) {
  return s.logo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={s.logo} alt="" width={size} height={size} className="shrink-0 rounded-[4px] bg-[#0A0A0A] object-contain" style={{ width: size, height: size, border: `2px solid #E3E6EE` }} />
  ) : (
    <span className="flex shrink-0 items-center justify-center rounded-[4px] bg-[#2E29FF] font-extrabold text-[#0A0A0A]" style={{ width: size, height: size, fontSize: size * 0.42 }}>
      {s.name.charAt(0)}
    </span>
  );
}

function Visit({ s, big }: { s: Svc; big?: boolean }) {
  if (s.status === "coming_soon" || !s.url || s.url === "#") {
    return <span className="inline-flex h-11 items-center rounded-[4px] px-4 text-[14px] font-bold text-[#9C9CA6]" style={{ border: `1px solid ${B}` }}>Удахгүй</span>;
  }
  return (
    <a href={s.url} target="_blank" rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 rounded-[4px] bg-[#2E29FF] font-bold text-[#0A0A0A] transition hover:bg-[#1F1AD9] ${big ? "h-12 px-6 text-[15px]" : "h-10 px-4 text-[14px]"}`}>
      Зочлох <span aria-hidden>↗</span>
    </a>
  );
}

function Tags({ tags }: { tags: string[] }) {
  if (!tags?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.slice(0, 5).map((t) => (
        <span key={t} className="rounded-[4px] px-2 py-0.5 text-[11.5px] text-[#C9C9D1]" style={{ background: "rgba(46,41,255,0.12)" }}>#{t}</span>
      ))}
    </div>
  );
}

export default async function ServicesPage() {
  await dbConnect();
  const rows = (await Service.find({ status: { $ne: "inactive" } }).sort({ featured: -1, order: 1, createdAt: -1 }).lean()) as unknown as Svc[];
  const list = rows.map((r) => ({ ...r, _id: String(r._id), tags: r.tags || [] }));
  const featured = list.find((s) => s.featured) || list[0];
  const rest = list.filter((s) => s !== featured);
  const categories = new Set(list.map((s) => s.category)).size;

  return (
    <main className="mx-auto w-full max-w-[1100px] px-4 pb-24 pt-4 lg:px-0">
      {/* ── Толгой ── */}
      <header className="flex flex-wrap items-end justify-between gap-4 pb-6">
        <div>
          <div className="font-mono text-[11px] font-bold tracking-[0.2em] text-[#2E29FF]">ANTAQOR · ЭКОСИСТЕМ</div>
          <h1 className="mt-2 text-[clamp(34px,6vw,60px)] font-extrabold leading-[1] tracking-[-0.035em] text-white">Үйлчилгээ</h1>
          <p className="mt-3 max-w-[560px] text-[15.5px] leading-[1.6] text-[#C9C9D1]">
            Antaqor-ын бүтээж, ажиллуулж буй бизнесүүд — бодит хэрэглэгч, бодит үйлчилгээтэй.
          </p>
        </div>
        <div className="flex gap-6">
          <div><div className="text-[30px] font-extrabold leading-none text-white">{list.length}</div><div className="mt-1 text-[12px] text-[#9C9CA6]">бизнес</div></div>
          <div><div className="text-[30px] font-extrabold leading-none text-white">{categories}</div><div className="mt-1 text-[12px] text-[#9C9CA6]">салбар</div></div>
        </div>
      </header>

      {!featured ? (
        <p className="py-16 text-center text-[15px] text-[#9C9CA6]">Үйлчилгээ удахгүй нэмэгдэнэ.</p>
      ) : (
        <>
          {/* ── Онцлох ── */}
          <section className="grid overflow-hidden rounded-[4px] lg:grid-cols-[1.25fr_1fr]" style={{ border: `1px solid ${B}`, background: SURF }}>
            <a href={featured.url} target="_blank" rel="noopener noreferrer" className="group relative block aspect-[16/9] overflow-hidden bg-black lg:aspect-auto lg:min-h-[340px]">
              {featured.coverImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={featured.coverImage} alt={featured.name} className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
              )}
              <span className="absolute left-3 top-3 rounded-[4px] bg-[#FCEE0A] px-2 py-1 text-[11px] font-extrabold tracking-[0.06em] text-[#0A0A0A]">ОНЦЛОХ</span>
            </a>
            <div className="flex flex-col gap-4 p-5 sm:p-8">
              <div className="flex items-center gap-3">
                <Logo s={featured} size={52} />
                <div className="min-w-0">
                  <div className="text-[12px] font-bold text-[#FCEE0A]">{featured.category}</div>
                  <h2 className="text-[clamp(24px,3vw,32px)] font-extrabold leading-tight text-white">{featured.name}</h2>
                </div>
              </div>
              <p className="text-[15.5px] leading-[1.65] text-[#C9C9D1]">{featured.description}</p>
              <Tags tags={featured.tags} />
              <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-2">
                <span className="font-mono text-[13px] text-[#9C9CA6]">{featured.domain}</span>
                <Visit s={featured} big />
              </div>
            </div>
          </section>

          {/* ── Бусад ── */}
          {rest.length > 0 && (
            <section className="mt-6 grid gap-5 sm:grid-cols-2">
              {rest.map((s) => (
                <article key={s._id} className="group flex flex-col overflow-hidden rounded-[4px] transition hover:-translate-y-0.5" style={{ border: `1px solid ${B}`, background: SURF }}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="relative block aspect-[16/9] overflow-hidden bg-black">
                    {s.coverImage && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.coverImage} alt={s.name} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
                    )}
                  </a>
                  <div className="relative flex flex-1 flex-col gap-3 px-5 pb-5">
                    <div className="-mt-7 flex items-end gap-3">
                      <Logo s={s} size={56} />
                      <span className="mb-1 rounded-[4px] px-2 py-0.5 text-[11.5px] font-bold" style={{ background: "rgba(252,238,10,0.14)", color: "#FCEE0A" }}>{s.category}</span>
                    </div>
                    <h3 className="text-[22px] font-extrabold leading-tight text-white">{s.name}</h3>
                    <p className="line-clamp-3 text-[14.5px] leading-[1.6] text-[#C9C9D1]">{s.description}</p>
                    <Tags tags={s.tags} />
                    <div className="mt-auto flex items-center justify-between gap-3 pt-2">
                      <span className="truncate font-mono text-[12.5px] text-[#9C9CA6]">{s.domain}</span>
                      <Visit s={s} />
                    </div>
                  </div>
                </article>
              ))}
            </section>
          )}
        </>
      )}

      {/* ── Хамтын ажиллагаа ── */}
      <section className="mt-10 flex flex-col items-start justify-between gap-4 rounded-[4px] p-6 sm:flex-row sm:items-center sm:p-8"
        style={{ border: "1px solid rgba(46,41,255,0.4)", background: "linear-gradient(180deg, rgba(46,41,255,0.10), rgba(46,41,255,0.02))" }}>
        <div>
          <h2 className="text-[22px] font-extrabold text-white">Танай бизнест AI шийдэл хэрэгтэй юу?</h2>
          <p className="mt-1 text-[14.5px] text-[#C9C9D1]">Вэб сайт, автоматжуулалт, AI агент — эдгээр бизнесийг бүтээсэн баг танд ч бүтээнэ.</p>
        </div>
        <Link href="/partnerships" className="inline-flex h-12 shrink-0 items-center rounded-[4px] bg-[#2E29FF] px-6 text-[15px] font-bold text-[#0A0A0A] transition hover:bg-[#1F1AD9]">
          Хамтран ажиллах →
        </Link>
      </section>
    </main>
  );
}
