import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Эрчис Волейбол Клуб — Волейбол сургалт",
  description:
    "Эрчис Волейбол Клуб — 7-р сарын бүртгэл эхэллээ! Туршлагатай багш нар, цэгцтэй аргачлал, БГД/СХД/ХУД/БЗД/СБД салбарууд. Хүүхэд болон насанд хүрэгчдийн волейбол сургалт. Холбоо барих: 9998-3419.",
  alternates: { canonical: "/erchis" },
  openGraph: {
    title: "Эрчис Волейбол Клуб — Волейбол сургалт",
    description:
      "7-р сарын бүртгэл эхэллээ! Тоо хязгаартай. Хүүхэд болон насанд хүрэгчдийн волейбол сургалт. 9998-3419.",
  },
};

const PHONE_DISPLAY = "9998-3419";
const PHONE_TEL = "+97699983419";

const advantages = [
  "Туршлагатай, ур чадвар өндөр багш нар",
  "Үр дүн төвтэй, цэгцтэй сургалтын аргачлал",
  "Эерэг уур амьсгалтай, хөгжил дэмжсэн орчин",
  "Сахилга бат, зөв хандлага, багаар ажиллах чадварыг хөгжүүлнэ",
];

const discounts = [
  { icon: "👨‍👩‍👧", t: "Гэр бүлийн хөнгөлөлт" },
  { icon: "🤝", t: "Найзын хөнгөлөлт" },
  { icon: "🎓", t: "Оюутны хөнгөлөлт" },
];

type Group = {
  kind: "child" | "adult";
  venue?: string;
  venueNote?: string;
  schedule: string[];
  price: string;
  sessions: string;
};

const districts: { code: string; name: string; groups: Group[] }[] = [
  {
    code: "БГД",
    name: "Баянгол дүүрэг",
    groups: [
      { kind: "child", venue: "93-р сургууль", schedule: ["Бямба / Ням 12:00–14:00"], price: "140,000₮", sessions: "Сард 8 оролт" },
      { kind: "adult", venue: "51-р сургууль", schedule: ["Даваа 20:00–22:00", "Лхагва / Бямба 19:00–21:00"], price: "180,000₮", sessions: "Сард 12 оролт" },
    ],
  },
  {
    code: "СХД",
    name: "Сонгинохайрхан дүүрэг",
    groups: [
      { kind: "child", venue: "Содон спорт заал", schedule: ["Бямба / Ням 10:00–12:00"], price: "140,000₮", sessions: "Сард 8 оролт" },
    ],
  },
  {
    code: "ХУД",
    name: "Хан-Уул дүүрэг",
    groups: [
      { kind: "adult", venue: "Орхон их сургууль", schedule: ["Даваа / Лхагва / Баасан 21:00–23:00"], price: "180,000₮", sessions: "Сард 12 оролт" },
    ],
  },
  {
    code: "БЗД",
    name: "Баянзүрх дүүрэг",
    groups: [
      { kind: "child", venue: "Кино үйлдвэр", venueNote: "МУИС / Улаанбаатар сургуулийн заал", schedule: ["Бямба / Ням 15:00–17:00"], price: "140,000₮", sessions: "Сард 8 оролт" },
      { kind: "adult", schedule: ["Даваа / Лхагва / Баасан 20:00–22:00"], price: "180,000₮", sessions: "Сард 12 оролт" },
    ],
  },
  {
    code: "СБД",
    name: "Сүхбаатар дүүрэг",
    groups: [
      { kind: "adult", venue: "2-р сургууль", schedule: ["Пүрэв 21:00–23:00", "Бямба 20:00–22:00", "Ням 18:00–20:00"], price: "200,000₮", sessions: "Сард 12 оролт" },
      { kind: "child", schedule: ["Бямба / Ням 16:00–18:00"], price: "170,000₮", sessions: "Сард 8 оролт" },
    ],
  },
];

const hashtags = ["ЭрчисВолейболКлуб", "ВолейболСургалт", "ЭрүүлАмьдрал", "Хөгжил", "Волейбол"];

function GroupCard({ g }: { g: Group }) {
  const isChild = g.kind === "child";
  return (
    <div className="rounded-[6px] border border-white/10 bg-[#141416] p-4 transition hover:border-[#FF6B1A]/40">
      <div className="flex items-start justify-between gap-3">
        <span
          className={`inline-flex items-center gap-1.5 rounded-[4px] px-2.5 py-1 text-[12px] font-bold ${
            isChild
              ? "bg-[rgba(255,196,0,0.12)] text-[#FFC400]"
              : "bg-[rgba(255,107,26,0.12)] text-[#FF8A3D]"
          }`}
        >
          <span>{isChild ? "👧" : "👨"}</span>
          {isChild ? "Хүүхэд" : "Насанд хүрэгчид"}
        </span>
        <div className="text-right">
          <div className="text-[18px] font-extrabold leading-none text-white">{g.price}</div>
          <div className="mt-1 text-[11px] font-medium text-[#888]">{g.sessions}</div>
        </div>
      </div>

      {g.venue && (
        <p className="mt-3 flex items-start gap-1.5 text-[13px] font-semibold text-[#E8E8E8]">
          <span className="text-[#FF6B1A]">📍</span>
          <span>
            {g.venue}
            {g.venueNote && <span className="block text-[11px] font-normal text-[#888]">{g.venueNote}</span>}
          </span>
        </p>
      )}

      <ul className="mt-3 space-y-1.5">
        {g.schedule.map((s) => (
          <li key={s} className="flex items-center gap-2 text-[13px] text-[#BBBBBB]">
            <span className="text-[#FF6B1A]">🕒</span>
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ErchisPage() {
  return (
    <div
      id="top"
      className="-mx-4 -mt-6 -mb-28 min-h-screen bg-[#0a0a0c] text-[#E8E8E8] sm:-mx-6 md:-mx-8 md:-mb-12 lg:-mx-12"
    >
      {/* ─── Erchis header (own, replaces Antaqor navbar) ─── */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0a0c]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-5 py-3">
          <a href="#top" className="flex items-center gap-2.5">
            <span className="text-[22px] leading-none">🏐</span>
            <span className="flex flex-col leading-none">
              <span className="text-[15px] font-extrabold tracking-[0.18em] text-white">ЭРЧИС</span>
              <span className="mt-1 text-[8px] font-bold tracking-[0.3em] text-[#FF6B1A]">ВОЛЕЙБОЛ КЛУБ</span>
            </span>
          </a>
          <nav className="hidden items-center gap-7 sm:flex">
            {[
              { href: "#advantages", label: "Давуу тал" },
              { href: "#discounts", label: "Хөнгөлөлт" },
              { href: "#salbaruud", label: "Хуваарь" },
            ].map((l) => (
              <a key={l.href} href={l.href} className="text-[13px] font-semibold text-[#AAAAAA] transition hover:text-white">
                {l.label}
              </a>
            ))}
          </nav>
          <a
            href={`tel:${PHONE_TEL}`}
            className="rounded-[4px] bg-[#FF6B1A] px-4 py-2 text-[13px] font-bold text-black transition hover:bg-[#ff7d33]"
          >
            📞 Залгах
          </a>
        </div>
      </header>

      {/* ─── HERO ─── */}
      <section className="relative overflow-hidden px-5 pt-12 pb-14 text-center sm:pt-16 sm:pb-20">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(60% 50% at 50% 0%, rgba(255,107,26,0.22), transparent 70%), radial-gradient(40% 40% at 80% 30%, rgba(255,196,0,0.10), transparent 70%)",
          }}
        />
        <div className="relative mx-auto max-w-3xl">
          <div className="text-[64px] leading-none sm:text-[88px]">🏐</div>
          <span className="mt-4 inline-flex items-center gap-2 rounded-[4px] border border-[#FF6B1A]/30 bg-[rgba(255,107,26,0.10)] px-3 py-1.5 text-[12px] font-bold tracking-wide text-[#FF8A3D]">
            📣 7-Р САРЫН БҮРТГЭЛ ЭХЭЛЛЭЭ!
          </span>
          <h1 className="mt-5 text-[44px] font-extrabold leading-[0.95] tracking-[0.04em] text-white sm:text-[72px]">
            ЭРЧИС
          </h1>
          <p className="mt-1 text-[15px] font-bold tracking-[0.35em] text-[#FF6B1A] sm:text-[18px]">
            ВОЛЕЙБОЛ КЛУБ
          </p>
          <p className="mx-auto mt-5 max-w-md text-[14px] leading-relaxed text-[#AAAAAA]">
            ⏳ Тоо хязгаартай — бүртгэл хурдан дүүрдэг тул амжиж бүртгүүлээрэй!
          </p>

          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href={`tel:${PHONE_TEL}`}
              className="inline-flex w-full items-center justify-center gap-2 rounded-[4px] bg-[#FF6B1A] px-7 py-3 text-[15px] font-bold text-black transition hover:bg-[#ff7d33] hover:shadow-[0_0_28px_rgba(255,107,26,0.35)] sm:w-auto"
            >
              📞 {PHONE_DISPLAY}
            </a>
            <a
              href="#salbaruud"
              className="inline-flex w-full items-center justify-center rounded-[4px] border border-white/15 px-7 py-3 text-[15px] font-semibold text-[#E8E8E8] transition hover:border-[#FF6B1A]/50 hover:text-white sm:w-auto"
            >
              Хуваарь үзэх
            </a>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-3xl px-5 pb-28 md:pb-16">
        {/* ADVANTAGES */}
        <section id="advantages" className="mt-4 scroll-mt-24">
          <h2 className="flex items-center gap-2 text-[20px] font-extrabold text-white">
            🌟 Бидний давуу тал
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {advantages.map((a) => (
              <div
                key={a}
                className="flex items-start gap-3 rounded-[6px] border border-white/10 bg-[#141416] p-4"
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#FF6B1A] text-[12px] font-black text-black">
                  ✓
                </span>
                <p className="text-[14px] leading-relaxed text-[#D8D8D8]">{a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* DISCOUNTS */}
        <section id="discounts" className="mt-12 scroll-mt-24">
          <h2 className="flex items-center gap-2 text-[20px] font-extrabold text-white">
            🎯 Хөнгөлөлтүүд
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {discounts.map((d) => (
              <div
                key={d.t}
                className="flex items-center gap-3 rounded-[6px] border border-[#FFC400]/20 bg-[rgba(255,196,0,0.05)] p-4"
              >
                <span className="text-[24px]">{d.icon}</span>
                <p className="text-[14px] font-semibold text-[#E8E8E8]">{d.t}</p>
              </div>
            ))}
          </div>
        </section>

        {/* BRANCHES & SCHEDULE */}
        <section id="salbaruud" className="mt-12 scroll-mt-24">
          <h2 className="flex items-center gap-2 text-[20px] font-extrabold text-white">
            📍 Салбарууд ба цагийн хуваарь
          </h2>
          <div className="mt-5 space-y-5">
            {districts.map((dist) => (
              <div key={dist.code} className="rounded-[8px] border border-white/10 bg-[#0e0e10] p-4 sm:p-5">
                <div className="mb-4 flex items-baseline gap-2.5">
                  <span className="rounded-[4px] bg-[#FF6B1A] px-2.5 py-1 text-[13px] font-extrabold text-black">
                    {dist.code}
                  </span>
                  <span className="text-[14px] font-medium text-[#888]">{dist.name}</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {dist.groups.map((g, i) => (
                    <GroupCard key={i} g={g} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="mt-14 overflow-hidden rounded-[10px] border border-[#FF6B1A]/25 bg-gradient-to-b from-[rgba(255,107,26,0.08)] to-[#0e0e10] p-7 text-center">
          <h2 className="text-[22px] font-extrabold text-white sm:text-[26px]">
            🔥 Спортоор хичээллэж, өөрийгөө хөгжүүлье!
          </h2>
          <p className="mt-2 text-[14px] font-semibold text-[#FF8A3D]">📌 Бүртгэл хязгаартай</p>
          <a
            href={`tel:${PHONE_TEL}`}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-[4px] bg-[#FF6B1A] px-8 py-3.5 text-[16px] font-bold text-black transition hover:bg-[#ff7d33] hover:shadow-[0_0_28px_rgba(255,107,26,0.35)]"
          >
            📞 Холбоо барих: {PHONE_DISPLAY}
          </a>
          <div className="mt-7 flex flex-wrap justify-center gap-2">
            {hashtags.map((h) => (
              <span key={h} className="text-[12px] font-medium text-[#FF8A3D]">
                #{h}
              </span>
            ))}
          </div>
        </section>

        <p className="mt-10 text-center text-[12px] text-[#555]">
          © {new Date().getFullYear()} Эрчис Волейбол Клуб
        </p>
      </main>

      {/* ─── Erchis bottom bar (own, mobile — replaces Antaqor BottomBar) ─── */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-[#0a0a0c]/95 backdrop-blur-xl md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-3 items-stretch px-2 pb-[env(safe-area-inset-bottom)] pt-1.5">
          <a href="#salbaruud" className="flex flex-col items-center gap-0.5 py-1.5 text-[#AAAAAA] transition active:text-white">
            <span className="text-[18px] leading-none">🗓️</span>
            <span className="text-[10px] font-semibold">Хуваарь</span>
          </a>
          <a href="#discounts" className="flex flex-col items-center gap-0.5 py-1.5 text-[#AAAAAA] transition active:text-white">
            <span className="text-[18px] leading-none">🎯</span>
            <span className="text-[10px] font-semibold">Хөнгөлөлт</span>
          </a>
          <a href={`tel:${PHONE_TEL}`} className="flex flex-col items-center gap-0.5 py-1.5 text-[#FF6B1A] transition active:text-[#ff7d33]">
            <span className="text-[18px] leading-none">📞</span>
            <span className="text-[10px] font-extrabold">Залгах</span>
          </a>
        </div>
      </nav>
    </div>
  );
}
