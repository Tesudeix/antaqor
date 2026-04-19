"use client";

import Link from "next/link";

/* ── Color palette data ── */
const primaryColors = [
  { name: "Void Black", hex: "#F8F8F6", text: "#F2F2F0" },
  { name: "Empire Gold", hex: "#C8943A", text: "#F8F8F6" },
  { name: "Bone", hex: "#F2F2F0", text: "#F8F8F6" },
  { name: "Snow", hex: "#F8F8F6", text: "#F8F8F6" },
  { name: "Sky Blue", hex: "#3D6E8A", text: "#F2F2F0" },
];

const secondaryColors = [
  { name: "Steel", hex: "#141418", text: "#888888" },
  { name: "Iron", hex: "#1E1E24", text: "#888888" },
  { name: "Gold Light", hex: "#D9AB55", text: "#4A3520" },
  { name: "Gold Dark", hex: "#A67C2E", text: "#F2F2F0" },
  { name: "Deep Blue", hex: "#1E3A4D", text: "#5E8FA8" },
];

const earthColors = [
  { name: "Earth Warm", hex: "#4A3520", text: "#D9AB55" },
  { name: "Earth Mid", hex: "#6B4E30", text: "#F2F2F0" },
  { name: "Earth Light", hex: "#8C6E45", text: "#F2F2F0" },
  { name: "Frost", hex: "#5E8FA8", text: "#F8F8F6" },
];

/* ── Values ── */
const values = [
  { num: "01", title: "Хурд", desc: "Сүбээдэй шиг — хурдан шийдвэр, хурдан хүргэлт. Захиалгаас угсралт хүртэл хамгийн богино хугацаа." },
  { num: "02", title: "Тэсвэр", desc: "Монголын -40°C-ээс +35°C хүртэлх уур амьсгалд тэсвэртэй. Бат бөх, удаан эдэлгээтэй материал." },
  { num: "03", title: "Уян Хатан", desc: "Нэмж, хасч, хослуулж болдог модульчлагдсан бүтэц. Хэрэглэгчийн хэрэгцээнд нийцсэн уян шийдэл." },
  { num: "04", title: "Нүүдэл", desc: "Зөөж, шилжүүлж, дахин угсарч болно. Монголчуудын нүүдлийн соёлыг орчин цагийн хэлбэрээр үргэлжлүүлнэ." },
  { num: "05", title: "Чанар", desc: "Premium материал, нарийн ажиллагаа, олон улсын стандарт." },
  { num: "06", title: "Итгэл", desc: "Ил тод үнэ, тодорхой хугацаа, баталгаат чанар. Хэрэглэгчийн итгэлийг олж, хадгална." },
];

/* ── Typography specimens ── */
const typeSpecs = [
  { label: "Display / Hero", sample: "СҮБЭЭДЭЙ ЗӨӨВРИЙН СУУЦ", meta: "Oswald · 600 · 48–140px · Uppercase", font: "'Oswald', sans-serif", weight: 600, size: "clamp(28px, 5vw, 48px)", tracking: "0.12em", transform: "uppercase" as const },
  { label: "Editorial", sample: "Нүүдлийн ухаалаг орон зай", meta: "Cormorant Garamond · 400 · 24–56px", font: "'Cormorant Garamond', serif", weight: 400, size: "clamp(20px, 4vw, 36px)", tracking: "0", transform: "none" as const },
  { label: "Heading", sample: "Модульчлагдсан бүтэц, шуурхай угсралт", meta: "Raleway · 500 · 18–28px", font: "'Raleway', sans-serif", weight: 500, size: "clamp(16px, 3vw, 24px)", tracking: "0", transform: "none" as const },
  { label: "Body", sample: "Сүбээдэй зөөврийн сууц нь Монголын уур амьсгалд тохирсон, -40°C хүртэлх хүйтэнд тэсвэртэй.", meta: "PT Serif · 400 · 14–16px", font: "'PT Serif', serif", weight: 400, size: "15px", tracking: "0", transform: "none" as const },
  { label: "Mono / Data", sample: "3x6m · 3x9m · 6x6m · 6x9m · 6x12m", meta: "JetBrains Mono · 400 · 11–14px", font: "'JetBrains Mono', monospace", weight: 400, size: "13px", tracking: "0.03em", transform: "none" as const },
];

/* ── Application examples ── */
const applications = [
  { title: "Нэрийн Хуудас", desc: "Void Black дэвсгэр, алтан лого, Raleway мэдээлэл" },
  { title: "Баннер / Billboard", desc: "Баруун гурвалжин composition, Oswald гарчиг, алтан accent" },
  { title: "Цахим Хуудас", desc: "Dark-first дизайн, scroll-reveal, premium UX" },
  { title: "Бүтээгдэхүүний шошго", desc: "Хар+алт хослол, mono хэмжээс, QR код" },
  { title: "Тээврийн хэрэгсэл", desc: "Хар суурь дээр алтан лого, хажуу талд уриа" },
  { title: "Хувцас / Мерч", desc: "Embroidered лого, minimal placement, premium material" },
];

function SectionDivider() {
  return <div className="my-12 h-px bg-gradient-to-r from-transparent via-[#C8943A]/20 to-transparent" />;
}

function SectionHeader({ num, eyebrow, title }: { num: string; eyebrow: string; title: string }) {
  return (
    <div className="relative mb-8">
      <span className="pointer-events-none absolute -right-2 -top-6 select-none text-[80px] font-extralight leading-none text-[#C8943A]/[0.04] md:text-[120px]">
        {num}
      </span>
      <p className="mb-2 flex items-center gap-3 text-[9px] font-semibold uppercase tracking-[4px] text-[#C8943A]">
        <span className="inline-block h-px w-6 bg-[#A67C2E]" />
        {eyebrow}
      </p>
      <h2 className="text-[22px] font-normal leading-snug text-[#F8F8F6] md:text-[28px]">
        {title}
      </h2>
    </div>
  );
}

export default function SubudeiBrandBook() {
  return (
    <div className="py-6">
      {/* Breadcrumb */}
      <Link
        href="/brandbooks"
        className="mb-8 inline-flex items-center gap-2 text-[12px] text-[#AAAAAA] transition hover:text-[#C8943A]"
      >
        &larr; Brand Books
      </Link>

      {/* ═══ HERO ═══ */}
      <div className="relative mb-16 flex flex-col items-center overflow-hidden rounded-[4px] border border-[rgba(0,0,0,0.08)] bg-[#FFFFFF] px-6 py-16 text-center md:py-24">
        {/* Background glow */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_20%,rgba(200,148,58,0.04)_0%,transparent_70%)]" />

        <p className="mb-6 text-[10px] font-semibold uppercase tracking-[5px] text-[#C8943A]">
          Брэнд Ном · v2.0
        </p>
        <h1 className="text-[clamp(40px,10vw,72px)] font-bold uppercase leading-[0.92] tracking-[0.12em] text-[#F8F8F6]"
            style={{ fontFamily: "'Oswald', sans-serif" }}>
          СҮБЭЭДЭЙ
        </h1>
        <p className="mt-2 text-[clamp(20px,4vw,32px)] font-light uppercase tracking-[0.2em] text-[#C8943A]"
           style={{ fontFamily: "'Oswald', sans-serif" }}>
          Brand Book
        </p>
        <p className="mt-6 text-[clamp(14px,2vw,18px)] italic text-[#888888]"
           style={{ fontFamily: "serif" }}>
          Нүүдлийн ухаалаг орон зай
        </p>
        <div className="mt-8 h-16 w-px bg-gradient-to-b from-[#C8943A] to-transparent" />
        <span className="mt-4 text-[10px] uppercase tracking-[3px] text-[#AAAAAA]"
              style={{ fontFamily: "monospace" }}>
          Brand Guidelines — 2026
        </span>
      </div>

      {/* ═══ Table of Contents ═══ */}
      <div className="mb-16 rounded-[4px] border border-[rgba(0,0,0,0.08)] bg-[#FFFFFF] p-6">
        <p className="mb-4 text-[10px] font-semibold uppercase tracking-[4px] text-[#C8943A]">
          Агуулга
        </p>
        <div className="grid gap-1">
          {[
            { num: "01", title: "Брэндийн Эх Үүсвэр" },
            { num: "02", title: "Лого Систем" },
            { num: "03", title: "Өнгөний Систем" },
            { num: "04", title: "Үсгийн Хэв Маяг" },
            { num: "05", title: "Үнэт Зүйлс" },
            { num: "06", title: "Уриа / Слоган" },
            { num: "07", title: "Харилцааны Хэв Маяг" },
            { num: "08", title: "Зураг, Визуал" },
            { num: "09", title: "Хэрэглээ" },
          ].map((item) => (
            <div
              key={item.num}
              className="flex items-center gap-3 rounded-[4px] px-3 py-2 text-[13px] text-[#888888] transition hover:bg-[#14141a] hover:text-[#F2F2F0]"
            >
              <span className="w-6 text-right text-[11px] text-[#AAAAAA]" style={{ fontFamily: "monospace" }}>
                {item.num}
              </span>
              <span>{item.title}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ 01 ORIGIN ═══ */}
      <section className="mb-4">
        <SectionHeader num="01" eyebrow="Брэндийн Эх Үүсвэр" title="Сүбээдэй — Түүхэн дурсгал. Орчин цагийн чөлөөт амьдрал." />
        <p className="mb-8 text-[14px] font-light leading-[1.9] text-[#888888]">
          Сүбээдэй Баатар — Монголын эзэнт гүрний хамгийн алдартай жанжин. Тэрээр газар нутгийн хил хязгааргүйгээр аян дайн хийж, түүхэнд тэмдэглэгдсэн хамгийн олон газар нутгийг хурдан хугацаанд хамарсан цэргийн удирдагч байв.{" "}
          <strong className="font-medium text-[#C8943A]">Хурд. Уян хатан байдал. Стратеги.</strong>{" "}
          — Эдгээр нь Сүбээдэй Баатрын мөн чанар бөгөөд бидний брэндийн суурь философи юм.
        </p>
        <p className="mb-8 text-[14px] font-light leading-[1.9] text-[#888888]">
          Сүбээдэй зөөврийн сууц нь орчин цагийн нүүдэлчний хэрэгцээнд нийцсэн, шуурхай угсарч, тээвэрлэх боломжтой, бат бөх чанартай модульчлагдсан сууцны шийдэл юм. Бид Монголын газар нутгийн нөхцөл байдал, уур амьсгалд тохирсон ухаалаг орон зай бүтээнэ.
        </p>

        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { title: "Алсын Хараа", desc: "Монгол хүн бүр хаана ч байсан, аюулгүй, дулаахан, орчин цагийн стандартад нийцсэн гэрийн орон зайтай байх." },
            { title: "Эрхэм Зорилго", desc: "Чанартай, хурдан угсрагддаг, тээвэрлэхэд хялбар модульчлагдсан зөөврийн сууцыг Монголын зах зээлд нэвтрүүлэх." },
            { title: "Стратеги", desc: "Сүбээдэй Баатар шиг — хурдан шийдвэр, уян тактик, урьдчилан төлөвлөсөн ложистик." },
            { title: "Зах Зээл", desc: "Зуслан, ажлын кемп, аялал жуулчлал, хөдөө аж ахуй, уул уурхайн талбай, гамшгийн нөхцөл." },
          ].map((card) => (
            <div key={card.title} className="rounded-[4px] border border-[rgba(0,0,0,0.08)] bg-[#FFFFFF] p-5">
              <h3 className="mb-2 text-[14px] font-semibold text-[#C8943A]">{card.title}</h3>
              <p className="text-[13px] leading-relaxed text-[#888888]">{card.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <SectionDivider />

      {/* ═══ 02 LOGO ═══ */}
      <section className="mb-4">
        <SectionHeader num="02" eyebrow="Лого Систем" title="Морьт харваач ба орчин цагийн бүтэц — нэг дүрс, нэг зорилго" />
        <p className="mb-8 text-[14px] font-light leading-[1.9] text-[#888888]">
          Лого нь морьт харваач — Монголын түүхэн уламжлалын дүрс бөгөөд хурд, чадвар, чөлөөт байдлыг илэрхийлнэ. Wordmark нь Oswald үсгийн хэвээр, бүтэцлэг, цэвэр, орчин цагийн. Хоёр элемент хамтдаа ажиллахад түүх ба ирээдүй нийлнэ.
        </p>

        {/* Logo usage grid */}
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="flex aspect-[3/2] items-center justify-center rounded-[4px] bg-[#F8F8F6] border border-[rgba(0,0,0,0.08)]">
            <div className="text-center">
              <p className="text-[24px] font-bold uppercase tracking-[6px] text-[#C8943A]" style={{ fontFamily: "'Oswald', sans-serif" }}>
                СҮБЭЭДЭЙ
              </p>
              <p className="mt-1 text-[8px] uppercase tracking-[3px] text-[#888888]">Dark Background</p>
            </div>
          </div>
          <div className="flex aspect-[3/2] items-center justify-center rounded-[4px] bg-[#F8F8F6] border border-[rgba(0,0,0,0.08)]">
            <div className="text-center">
              <p className="text-[24px] font-bold uppercase tracking-[6px] text-[#A67C2E]" style={{ fontFamily: "'Oswald', sans-serif" }}>
                СҮБЭЭДЭЙ
              </p>
              <p className="mt-1 text-[8px] uppercase tracking-[3px] text-[#6B4E30]">Light Background</p>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-[4px] border border-[rgba(0,0,0,0.08)] bg-[#FFFFFF] p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[2px] text-[#C8943A]">Хэрэглээний дүрэм</p>
          <ul className="mt-3 space-y-1 text-[13px] leading-relaxed text-[#888888]">
            <li>Логоны хамгийн бага хэмжээ: 24px өндөр (дижитал), 10mm (хэвлэл)</li>
            <li>Хамгаалалтын зай: Логоны өндрийн 50% бүх талд</li>
            <li>Зөвхөн баталгаажсан өнгөний хослолуудыг хэрэглэнэ</li>
            <li>Логог сунгах, эргүүлэх, нугалах, gradient-тэй хослуулахыг хориглоно</li>
          </ul>
        </div>
      </section>

      <SectionDivider />

      {/* ═══ 03 COLOR ═══ */}
      <section className="mb-4">
        <SectionHeader num="03" eyebrow="Өнгөний Систем" title="Газар, алт, тэнгэр — Монголын байгальд суурилсан палитр" />
        <p className="mb-8 text-[14px] font-light leading-[1.9] text-[#888888]">
          Өнгөний систем нь Монголын байгалиас сэдэвлэсэн: хар газар, алтан нар, цэнхэр тэнгэр. Void Black + Empire Gold = үндсэн хослол (80% хэрэглээ).
        </p>

        {/* Primary */}
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[3px] text-[#888888]">Үндсэн Өнгө</p>
        <div className="mb-6 grid grid-cols-5 gap-1">
          {primaryColors.map((c) => (
            <div key={c.name} className="overflow-hidden rounded-[4px]">
              <div className="flex aspect-square items-end p-2" style={{ background: c.hex }}>
                <div>
                  <p className="text-[10px] font-medium" style={{ color: c.text }}>{c.name}</p>
                  <p className="text-[9px] opacity-60" style={{ color: c.text }}>{c.hex}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Secondary */}
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[3px] text-[#888888]">Хоёрдогч Өнгө</p>
        <div className="mb-6 grid grid-cols-5 gap-1">
          {secondaryColors.map((c) => (
            <div key={c.name} className="overflow-hidden rounded-[4px]">
              <div className="flex aspect-square items-end p-2" style={{ background: c.hex }}>
                <div>
                  <p className="text-[10px] font-medium" style={{ color: c.text }}>{c.name}</p>
                  <p className="text-[9px] opacity-60" style={{ color: c.text }}>{c.hex}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Earth */}
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[3px] text-[#888888]">Газрын Өнгө</p>
        <div className="mb-6 grid grid-cols-4 gap-1">
          {earthColors.map((c) => (
            <div key={c.name} className="overflow-hidden rounded-[4px]">
              <div className="flex aspect-square items-end p-2" style={{ background: c.hex }}>
                <div>
                  <p className="text-[10px] font-medium" style={{ color: c.text }}>{c.name}</p>
                  <p className="text-[9px] opacity-60" style={{ color: c.text }}>{c.hex}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <SectionDivider />

      {/* ═══ 04 TYPOGRAPHY ═══ */}
      <section className="mb-4">
        <SectionHeader num="04" eyebrow="Үсгийн Хэв Маяг" title="Хүч чадал ба нарийн нямбай — хоёр туйл, нэг систем" />
        <p className="mb-8 text-[14px] font-light leading-[1.9] text-[#888888]">
          Oswald — хүчирхэг display үсэг. Cormorant Garamond — editorial. Raleway — бие текст. PT Serif — кирилл уншигдах текст. JetBrains Mono — техникийн мэдээлэл.
        </p>

        <div className="space-y-1">
          {typeSpecs.map((t) => (
            <div key={t.label} className="rounded-[4px] border border-[rgba(0,0,0,0.08)] bg-[#FFFFFF] p-5">
              <p className="mb-2 text-[9px] font-semibold uppercase tracking-[3px] text-[#C8943A]">{t.label}</p>
              <p
                className="mb-2 text-[#F8F8F6]"
                style={{
                  fontFamily: t.font,
                  fontWeight: t.weight,
                  fontSize: t.size,
                  letterSpacing: t.tracking,
                  textTransform: t.transform,
                  lineHeight: 1.3,
                }}
              >
                {t.sample}
              </p>
              <p className="text-[10px] text-[#AAAAAA]" style={{ fontFamily: "monospace" }}>{t.meta}</p>
            </div>
          ))}
        </div>
      </section>

      <SectionDivider />

      {/* ═══ 05 VALUES ═══ */}
      <section className="mb-4">
        <SectionHeader num="05" eyebrow="Үнэт Зүйлс" title="Брэндийн цөм — 6 тулгуур зарчим" />

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {values.map((v) => (
            <div key={v.num} className="rounded-[4px] border border-[rgba(0,0,0,0.08)] bg-[#FFFFFF] p-5">
              <span className="text-[10px] text-[#AAAAAA]" style={{ fontFamily: "monospace" }}>{v.num}</span>
              <h3 className="mt-2 text-[16px] font-semibold text-[#F8F8F6]">{v.title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-[#888888]">{v.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <SectionDivider />

      {/* ═══ 06 TAGLINES ═══ */}
      <section className="mb-4">
        <SectionHeader num="06" eyebrow="Уриа / Слоган" title="Брэндийн дуу хоолой — нэг өгүүлбэрт" />

        {/* Primary tagline */}
        <div className="mb-2 flex flex-col items-center rounded-[4px] border border-[rgba(0,0,0,0.08)] bg-[#FFFFFF] px-6 py-12 text-center">
          <p className="text-[clamp(24px,5vw,44px)] font-light text-[#F8F8F6]" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Хаана ч <span className="font-semibold text-[#C8943A]">гэртээ</span>
          </p>
          <p className="mt-3 text-[10px] uppercase tracking-[3px] text-[#AAAAAA]">— Үндсэн уриа —</p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="flex flex-col items-center rounded-[4px] border border-[rgba(0,0,0,0.08)] bg-[#FFFFFF] px-6 py-10 text-center">
            <p className="text-[clamp(18px,3.5vw,28px)] font-light text-[#F8F8F6]" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
              Нүүдлийн <span className="font-semibold text-[#C8943A]">ухаалаг</span> орон зай
            </p>
            <p className="mt-3 text-[10px] uppercase tracking-[3px] text-[#AAAAAA]">— Маркетинг —</p>
          </div>
          <div className="flex flex-col items-center rounded-[4px] border border-[rgba(0,0,0,0.08)] bg-[#FFFFFF] px-6 py-10 text-center">
            <p className="text-[clamp(18px,3.5vw,28px)] font-light text-[#F8F8F6]" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
              Бат бөхөөр <span className="font-semibold text-[#C8943A]">бүтээ</span>, хурдан <span className="font-semibold text-[#C8943A]">зөөгдө</span>
            </p>
            <p className="mt-3 text-[10px] uppercase tracking-[3px] text-[#AAAAAA]">— Бүтээгдэхүүн —</p>
          </div>
        </div>
      </section>

      <SectionDivider />

      {/* ═══ 07 VOICE ═══ */}
      <section className="mb-4">
        <SectionHeader num="07" eyebrow="Харилцааны Хэв Маяг" title="Дуу хоолой — итгэлтэй, шулуун, халуун дулаан" />
        <p className="mb-6 text-[14px] font-light leading-[1.9] text-[#888888]">
          Сүбээдэй брэнд нь хэрэглэгчтэй итгэлтэй, шулуун, дулаахан харилцана. Бид хэт албан ёсны, хэт бизнес хэлийг хэрэглэхгүй. Мөн хэт залуучуудын сленг, тоглоомын хэлийг ч хэрэглэхгүй. Бидний дуу хоолой — ахлах ах, эгч шиг.
        </p>

        <div className="grid gap-2 sm:grid-cols-3">
          {[
            { label: "Тийм", items: ["Шулуун, ойлгомжтой", "Дулаахан, хүндэтгэлтэй", "Баримтад суурилсан"] },
            { label: "Үгүй", items: ["Хэт албан ёсны", "Сленг, emoji дүүрэн", "Хоосон амлалт"] },
            { label: "Жишээ", items: ["\"Бат бөх чанар, шударга үнэ\"", "\"Монголын нөхцөлд зориулсан\"", "\"48 цагт угсарна\""] },
          ].map((col) => (
            <div key={col.label} className="rounded-[4px] border border-[rgba(0,0,0,0.08)] bg-[#FFFFFF] p-5">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[2px] text-[#C8943A]">{col.label}</p>
              <ul className="space-y-2">
                {col.items.map((item) => (
                  <li key={item} className="text-[13px] text-[#888888]">{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <SectionDivider />

      {/* ═══ 08 PHOTOGRAPHY ═══ */}
      <section className="mb-4">
        <SectionHeader num="08" eyebrow="Зураг, Визуал" title="Бүтээгдэхүүний визуал — бодит, хүчтэй, Монголын газар нутаг" />
        <p className="mb-6 text-[14px] font-light leading-[1.9] text-[#888888]">
          Зургийн стил нь бодит, байгалийн гэрэлтэй, Монголын газар нутгийг харуулсан байх ёстой. Студийн зураг биш — бодит орчинд, бодит хүмүүстэй, бодит хэрэглээг харуулна.
        </p>

        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { title: "Газар нутаг", desc: "Монголын уудам тал, уул, голын эрэг дээрх бүтээгдэхүүний зураг" },
            { title: "Хүмүүс", desc: "Бодит хэрэглэгчид, бодит нөхцөлд. Зохиомол инээмсэглэлгүй" },
            { title: "Бүтэц / Texture", desc: "Мод, металл, арьс — бүтээгдэхүүний material close-up" },
            { title: "Гэрэлтүүлэг", desc: "Golden hour, байгалийн гэрэл, dramatic shadow" },
          ].map((item) => (
            <div key={item.title} className="rounded-[4px] border border-[rgba(0,0,0,0.08)] bg-[#FFFFFF] p-5">
              <h3 className="mb-2 text-[14px] font-semibold text-[#F8F8F6]">{item.title}</h3>
              <p className="text-[13px] leading-relaxed text-[#888888]">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <SectionDivider />

      {/* ═══ 09 APPLICATIONS ═══ */}
      <section className="mb-4">
        <SectionHeader num="09" eyebrow="Хэрэглээ" title="Брэндийн хэрэглээний жишээ" />

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {applications.map((app) => (
            <div key={app.title} className="rounded-[4px] border border-[rgba(0,0,0,0.08)] bg-[#FFFFFF] p-5">
              <h3 className="mb-2 text-[14px] font-semibold text-[#F8F8F6]">{app.title}</h3>
              <p className="text-[13px] leading-relaxed text-[#888888]">{app.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <div className="mt-16 border-t border-[rgba(0,0,0,0.08)] pt-8 text-center">
        <p className="text-[20px] font-bold uppercase tracking-[6px] text-[#C8943A]" style={{ fontFamily: "'Oswald', sans-serif" }}>
          СҮБЭЭДЭЙ
        </p>
        <p className="mt-2 text-[10px] uppercase tracking-[3px] text-[#AAAAAA]" style={{ fontFamily: "monospace" }}>
          Brand Book v2.0 — 2026
        </p>
        <p className="mt-4 text-[12px] italic text-[#888888]" style={{ fontFamily: "serif" }}>
          Хаана ч гэртээ
        </p>
      </div>
    </div>
  );
}
