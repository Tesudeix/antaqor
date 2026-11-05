"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

/* ─── ХИЧЭЭЛҮҮД — Netflix маягийн хэвтээ мөр (2026-10-06) ─────────────────
   HeroSlider-ийн ШУУД дараа, зочин ба гишүүний нүүрэнд ИЖИЛ. Карт бүр нэг
   курс: 16:9 зураг, доод талд хоёр шошго ("N хичээл" + "Үзэх") — Netflix-ийн
   "New Episode · Watch Now" хосын адил.

   Өгөгдөл: `/api/classroom/catalog` (нийтэд нээлттэй, 60с кэш). Курс НЭГ Ч
   байхгүй эсвэл хүсэлт унавал SAMPLE мөр харагдана; хичээлгүй курс ТҮР
   тоо авна (placeholderCount) — эзний хүсэлтээр "хичээл байхгүй бол
   санамсаргүй өгөгдөл". Дээж нь зураггүй тул градиент
   дэвсгэртэй, бүгд /classroom руу заана; жинхэнэ курс нэмэгдмэгц өөрөө
   солигдоно.

   Гүйлгээ нь ЖИНХЭНЭ scroll-snap — JS чирэлт биш (SwipeDeck-ийн сургамж:
   JS drag нь утсан дээр босоо гүйлгээтэй мөргөлддөг). */

interface CatalogCourse {
  _id: string;
  title: string;
  thumbnail?: string;
  coverImage?: string;
  comingSoon?: boolean;
  lessons?: { id: string }[];
}

interface Card {
  key: string;
  title: string;
  href: string;
  image?: string;
  gradient?: string;
  lessons: number;
  soon?: boolean;
}

const SAMPLE_TITLES = [
  "AI суурь мэдлэг",
  "AI промт инженерчлэл",
  "Дизайн систем",
  "Брэндинг",
  "AI контент",
  "Platform-ууд",
  "AI coding",
  "AI агент",
];

const GRADIENTS = [
  "linear-gradient(135deg,#2E29FF 0%,#5B3BFF 100%)",
  "linear-gradient(135deg,#5B3BFF 0%,#2563FF 100%)",
  "linear-gradient(135deg,#1F1AD9 0%,#2E29FF 100%)",
  "linear-gradient(135deg,#2E29FF 0%,#7C3AED 100%)",
  "linear-gradient(135deg,#2563FF 0%,#0E7490 100%)",
  "linear-gradient(135deg,#4C47FF 0%,#1F1AD9 100%)",
];

/** Хичээлгүй курсийн ТҮР тоо — id-аас гаргасан тул ачаалал бүрт үсрэхгүй.
    Эзний хүсэлтээр (хоосон мөр харуулахгүй). Курст жинхэнэ хичээл нэмэгдмэгц
    жинхэнэ тоо нь өөрөө орлоно. */
function placeholderCount(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return 4 + (h % 9);
}

/** Дээж — дараалал болон хичээлийн тоо нь ачаалал бүрт санамсаргүй. */
function sampleCards(): Card[] {
  const shuffled = [...SAMPLE_TITLES].sort(() => Math.random() - 0.5);
  return shuffled.map((title, i) => ({
    key: `sample-${i}`,
    title,
    href: "/classroom",
    gradient: GRADIENTS[i % GRADIENTS.length],
    lessons: 4 + Math.floor(Math.random() * 9),
  }));
}

export default function LessonRow({ title = "Хичээлүүд" }: { title?: string }) {
  const [courses, setCourses] = useState<CatalogCourse[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/classroom/catalog")
      .then((r) => (r.ok ? r.json() : { courses: [] }))
      .then((d) => { if (alive) setCourses(Array.isArray(d?.courses) ? d.courses : []); })
      .catch(() => { if (alive) setCourses([]); });
    return () => { alive = false; };
  }, []);

  // Дээжийг НЭГ удаа үүсгэнэ — дахин зурах бүрт холилдож үсрэхгүйн тулд.
  const samples = useMemo(sampleCards, []);

  const cards: Card[] | null = useMemo(() => {
    if (courses === null) return null;
    if (courses.length === 0) return samples;
    return courses.map((c, i) => ({
      key: c._id,
      title: c.title,
      href: `/classroom/course/${c._id}`,
      image: c.thumbnail || c.coverImage || undefined,
      gradient: GRADIENTS[i % GRADIENTS.length],
      lessons: c.lessons?.length || placeholderCount(c._id),
      soon: !!c.comingSoon,
    }));
  }, [courses, samples]);

  return (
    <section className="mt-6" aria-label={title}>
      <div className="mb-3 flex items-baseline justify-between px-4 sm:px-1">
        <h2 className="text-[20px] font-extrabold tracking-[-0.01em] text-[var(--nav-fg-strong)]">{title}</h2>
        <Link href="/classroom" className="text-[13px] font-semibold text-[#2E29FF] transition hover:text-[#4C47FF]">
          Бүгд →
        </Link>
      </div>

      <div
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:px-1"
        style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
      >
        {(cards ?? Array.from({ length: 4 }, (_, i) => ({ key: `sk-${i}` }) as Card)).map((c) =>
          cards === null ? (
            <div
              key={c.key}
              className="aspect-video w-[80%] shrink-0 snap-start animate-pulse rounded-[4px] sm:w-[340px]"
              style={{ background: "var(--nav-hover-bg, #FFFFFF)" }}
            />
          ) : (
            <Link
              key={c.key}
              href={c.href}
              className="press group relative aspect-video w-[80%] shrink-0 snap-start overflow-hidden rounded-[4px] sm:w-[340px]"
              style={{ background: c.gradient }}
            >
              {c.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.image}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                />
              )}
              {/* Доод scrim — гарчиг ямар ч зураг дээр уншигдана. */}
              <div
                className="absolute inset-0"
                style={{ background: "linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.78) 100%)" }}
              />
              <div className="absolute inset-x-0 bottom-0 p-3">
                <div className="line-clamp-2 text-[16px] font-extrabold leading-tight" style={{ color: "#FFFFFF" }}>
                  {c.title}
                </div>
                <div className="mt-2 flex items-stretch overflow-hidden rounded-[3px] text-[11.5px] font-bold" style={{ width: "fit-content" }}>
                  <span className="px-2 py-1" style={{ background: c.soon ? "#E8EAF2" : "#2E29FF", color: c.soon ? "#565967" : "#FFFFFF" }}>
                    {c.soon ? "Удахгүй" : `${c.lessons} хичээл`}
                  </span>
                  <span className="px-2 py-1" style={{ background: "#FFFFFF", color: "#14151C" }}>
                    Үзэх
                  </span>
                </div>
              </div>
            </Link>
          )
        )}
      </div>
    </section>
  );
}
