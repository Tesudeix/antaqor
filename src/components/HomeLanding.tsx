"use client";

import { useEffect, useRef, useState } from "react";
import LessonRow from "@/components/LessonRow";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { trackOnce } from "@/lib/analytics";
import { LiveHero, useBroadcast } from "@/components/live/Broadcast";
import HomeSections from "@/components/HomeSections";
import ProgramWeek from "@/components/ProgramWeek";
import { TELEGRAM_URL } from "@/lib/community";
import hs from "./HomeHero.module.css";
import {
  useLandingContent,
  useLandingStats,
  useReleaseCountdown,
} from "@/components/landing/kit";

// ─────────────────────────────────────────────────────────────────────────
// Нүүр — зураг эсвэл видео + доор нь (desktop дээр баруун талд) слайдын
// гарчиг/тайлбар/товч, Telegram чат, «Day N / 7» хөтөлбөр (2026-10-26).
// Доорх тайлбар нь өмнөх «текстгүй постер» үеийнх — түүх болгож үлдээв.
//
// Өмнө нь энэ hero нь eyebrow, гарчиг, тайлбар, хоёр товч, гурван тоолуур,
// цуврал дугаар, солбицол, баруун талд эргэлдэх HUD арт зэргийг нэг зэрэг
// авч явдаг байсан. Одоо ганц л зүйл үлдсэн: дүрс.
//
// Юу устсан ба хаана байгаа:
// · Гарчиг/тайлбар/товчнууд — LandingContent (`/admin/landing`) дотор
//   ХЭВЭЭР. Слайдын line1/line2/sub/cta нь `/admin/hero` дотор ХЭВЭЭР.
//   Зөвхөн ЭНД харуулахаа больсон — өгөгдөл нэг ч устгаагүй.
// · Суудал/шинэ гишүүний тоолуур — `useLandingStats` хэвээр, дуудахаа больсон.
//
// Медиа нь `HeroSlide.image` талбар дээрээ сууна. Тэр талбар видеоны URL
// ч барина: өргөтгөлөөр нь ялгаад <video> болгож үзүүлнэ. Ингэснээр schema
// ч, админы өгөгдөл ч хөндөгдөхгүй.
//
// ХЭЛБЭР: хар дэвсгэр дээр бөөрөнхий булантай хавтан, гадуураа гэрэлтэлт.
// Сайтын ерөнхий радиус 4px (--r) боловч энд ЗОРИУД том радиус хэрэглэсэн —
// энэ бол интерфэйсийн карт биш, зурагт хавтан. Гэрэлтэлт нь брэндийн
// accent (#2E29FF) өнгөөр, хавтангийн АРД бүдгэрсэн давхарга байдлаар
// сууна (box-shadow биш — тэр нь ийм өргөн халоог зөөлөн гаргаж чадахгүй).
// ─────────────────────────────────────────────────────────────────────────

interface Stats {
  seatsTotal?: number;
  seatsLeft?: number;
  newMembers?: number;
  totalUsers?: number;
  paidMembers?: number;
}

interface Media {
  key: string;
  src: string;
  chrome?: string;
  line1?: string;
  line2?: string;
  sub?: string;
  ctaLabel?: string;
  ctaHref?: string;
}

/** Видео мөн үү — өргөтгөлөөр. Query string байж болно (?v=2). */
function isVideo(src: string) {
  return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(src);
}

// ── Hero — дүүрэн медиа слайдер ──
// `stats` prop нь MemberDashboard-той нийцтэй байхын тулд үлдсэн. Энэ hero
// одоо ямар ч тоо харуулахгүй тул ашиглагдахгүй.
export function HeroSlider({ stats, showStats = true }: { stats?: Stats | null; showStats?: boolean }) {
  const broadcast = useBroadcast();
  const broadcastFeatured = broadcast.live || !!broadcast.schedule;
  const content = useLandingContent();
  const reduced = useReducedMotion();

  /* ТООЛУУР БУЦАЖ ИРЭВ (2026-09-17). Дүрсээ цэвэр байлгах гэж хассан
     боловч зочинд "энд өнөөдөр хүн нэгдэж байна" гэдгийг хэлэх зүйл
     үлдээгүй байв. `useLandingStats` нь дуудагдахаа больсон ч хэвээр
     үлдсэн тул шинээр юу ч бичих шаардлагагүй.

     MemberDashboard props-оор өөрийн тоог дамжуулдаг — тэр нь ДАВУУ;
     зочны нүүр дээр props ирэхгүй тул өөрөө татсан нь хэрэглэгдэнэ. */
  const live = useLandingStats();
  const countdown = useReleaseCountdown(content.enrollDeadline);
  /* ЮУ ҮЗҮҮЛЭХ ВЭ (2026-09-21). Өмнө нь "ӨНӨӨДРИЙН СУУДАЛ 0/20" ба
     "ӨНӨӨДӨР НЭГДСЭН +0" гэсэн хоёр тоо зогсдог байв. Хоёулаа ӨНӨӨДӨР
     гэсэн явцуу цонхтой тул хүн ороогүй өдөр хоёулаа тэг болж, 575
     бүртгэлтэй амьд сайтыг хоосон мэт харуулна.

     Одоо ХУРИМТЛАГДСАН хоёр тоо: нийт бүртгүүлсэн ба төлбөрөө төлсөн
     идэвхтэй гишүүн. Эдгээр буурдаггүй тул хэзээ ч тэг гарахгүй. */
  /* props ДАВУУ, өөрөө татсан нь нөөц. MemberDashboard өөрийн тоог
     дамжуулдаг; зочны нүүрэнд props ирэхгүй тул `live` хэрэглэгдэнэ. */
  const totalUsers = stats?.totalUsers ?? live.totalUsers;
  const paidMembers = stats?.paidMembers ?? live.paidMembers;

  const [slides, setSlides] = useState<Media[]>([]);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);

  // Админ /admin/hero дээр оруулсан слайдууд давуу эрхтэй; байхгүй бол
  // LandingContent-ийн ганц зураг руу шилжинэ.
  useEffect(() => {
    let alive = true;
    fetch("/api/hero-slides")
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        const raw = d?.slides;
        if (!Array.isArray(raw)) return;
        /* ЗУРАГГҮЙ СЛАЙДЫГ БАС АВНА (2026-09-17). Өмнө нь `.filter(m => m.src)`
           байсан: админ зураг байршуулаагүй бол слайд бүгд хаягдаж, зочин
           100svh өндөртэй ХООСОН ЦАГААН хайрцаг хардаг байв — гарчиг ч,
           товч ч байхгүй. Схем дээр `line1` заавал байдаг тул текст нь ҮРГЭЛЖ
           бий; медиа байхгүй үед түүнийг үзүүлнэ. */
        const media = raw
          .map((s: { id: string; image?: string; chrome?: string; line1?: string; line2?: string; sub?: string; ctaLabel?: string; ctaHref?: string }) => ({
            key: s.id,
            src: s.image || "",
            chrome: s.chrome || "",
            line1: s.line1 || "",
            line2: s.line2 || "",
            sub: s.sub || "",
            ctaLabel: s.ctaLabel || "",
            ctaHref: s.ctaHref || "",
          }))
          .filter((m: Media) => m.src || m.line1);
        if (media.length > 0) setSlides(media);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    setSlides((cur) => (cur.length > 0 ? cur : content.homeImage ? [{ key: "base", src: content.homeImage }] : []));
  }, [content.homeImage]);

  useEffect(() => {
    if (broadcast.live || paused || slides.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % slides.length), 6000);
    return () => clearInterval(t);
  }, [broadcast.live, paused, slides.length]);

  const slide = slides[idx] ?? slides[0];
  const go = (i: number) => {
    setPaused(true);
    setIdx((i + slides.length) % slides.length);
  };

  /* Постер багана — зураг/видео байх эсвэл шууд дамжуулалт явагдаж байх үед л.
     Зураггүй слайдын гарчиг одоо доорх бичвэрт гардаг тул хоосон хавтан хэрэггүй. */
  const showPoster = broadcastFeatured || !!slide?.src;

  return (
    <>
    {/* ─── 2026-10-26: ЗУРАГ + ТАЙЛБАР ───────────────────────────────────
        Өмнө нь нүүр нь ганц постер байсан: гарчиг/тайлбар/товч нь
        /admin/hero-д засагддаг атлаа хаана ч харагддаггүй байв — зочин
        «энэ юу вэ, би юу хийх вэ» гэдгийг уншиж чадахгүй. Одоо слайдын
        тэр талбарууд постерын ДООР (desktop дээр баруун талд) бичвэр болж
        гарна; постер дээр юу ч давхарлахгүй (постерын өөрийн бичвэрийг
        таслахгүй). Desktop дээр постер 400px-ээр хязгаарлагдсан — өмнө нь
        926×1235px буюу хуудасны 1.5 дэлгэцийг ганц зураг эзэлдэг байв. */}
    <section
      aria-label="Antaqor"
      className="full-bleed relative -mt-6 bg-black px-4 py-5 md:-mt-8 md:px-8 md:py-8"
      style={broadcastFeatured ? { background: "#fff" } : undefined}
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 48 && slides.length > 1) go(idx + (dx < 0 ? 1 : -1));
        touchX.current = null;
      }}
    >
      <div className={`${hs.grid} ${showPoster && !broadcastFeatured ? hs.split : ""}`}>
      {showPoster && (
      <div className="relative">
        {/* Халоо — хавтангаас арай том, ДҮҮРГЭСЭН accent тэгш өнцөгтийг
            бүдгэрүүлсэн нь (радиал градиент хавтангийн ард нуугддаг). */}
        {!broadcastFeatured && <div
          aria-hidden
          className="pointer-events-none absolute -inset-3 bg-[#2E29FF] opacity-60 blur-[36px] md:-inset-5 md:blur-[56px]"
        />}

        {/* ӨНДРИЙГ `aspect-ratio`-оор авна, `100svh − …` гэж БИШ — header-т
            юм нэмэх бүрт hero дэлгэцнээс хальдаг байсан. */}
        {broadcastFeatured ? <LiveHero state={broadcast} /> : <div className="hero-panel relative aspect-[3/4] overflow-hidden bg-[#0A0A0A]">
          <AnimatePresence mode="wait">
            {slide && (
              <motion.div
                key={slide.key}
                initial={reduced ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-0"
              >
                {isVideo(slide.src) ? (
                  <video src={slide.src} autoPlay muted loop playsInline preload="metadata"
                    className="h-full w-full object-cover" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={slide.src} alt={[slide.line1, slide.line2].filter(Boolean).join(" ")} className="h-full w-full object-cover" />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>}

        {/* Цэгүүд — хавтангийн ДООР. */}
        {!broadcastFeatured && slides.length > 1 && (
          <div className="mt-3 flex items-center justify-center gap-2.5">
            {slides.map((sl, i) => (
              <button key={sl.key} onClick={() => go(i)} aria-label={`Слайд ${i + 1}`} aria-current={i === idx}
                className="flex h-8 items-center px-1">
                <span className={`block h-[3px] w-9 rounded-[4px] transition-colors ${i === idx ? "bg-[#2E29FF]" : "bg-white/30"}`} />
              </button>
            ))}
          </div>
        )}
      </div>
      )}

      {/* ─── Бичвэр: юу вэ → юу хийх вэ → хөтөлбөр хаана явж байна ─── */}
      <div className={hs.intro}>
        {slide?.chrome && <div className={hs.eyebrow}>{slide.chrome}</div>}
        {(slide?.line1 || slide?.line2) && (
          <h1 className={hs.headline}>
            {slide.line1}
            {slide.line2 ? <> {slide.line2}</> : null}
          </h1>
        )}
        {slide?.sub && <p className={hs.sub}>{slide.sub}</p>}
        <div className={hs.ctas}>
          <Link href={slide?.ctaHref || "/auth/signup"} className={hs.primary}>
            {slide?.ctaLabel || "Нэгдэх"} <span aria-hidden>→</span>
          </Link>
          <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className={hs.telegram}>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="currentColor">
              <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
            </svg>
            Telegram чат
          </a>
        </div>
        <ProgramWeek />
        {!broadcastFeatured && (
          <Link href="/live/broadcast" className={hs.live}>
            <span>Шууд хичээл</span>
            <span className={hs.liveLink}>Хуваарь харах →</span>
          </Link>
        )}
      </div>
      </div>
    </section>

      {/* Тоолуурууд — зурагт хавтангийн ДООР, дээр нь биш: дүрсийг
          бүтнээр нь үлдээж, тоог тусдаа мөрөнд уншуулна.

          `<section>`-ийн ГАДНА байрлана. Тэр section нь `full-bleed`
          буюу `width:100vw; margin-left:calc(50% - 50vw)` — энэ тооцоо
          нь эзэн блокоо ДЭЛГЭЦИЙН ТӨВД гэж үздэг. Хажуугийн цэстэй
          үед (300px) агуулгын багана төвд байхаа больдог тул бүх
          section 150px баруун тийш гулсаж, зүүн ирмэг нь цэсний дор
          ордог. Зураг дээр мэдэгддэггүй, ХАРИН тоо нь таслагдана.
          Тиймээс тоог энгийн урсгалд үлдээв — агуулгын баганатайгаа
          яг эгнэнэ. (full-bleed өөрөө 5 өөр газар хэрэглэгддэг тул
          түүнийг эндээс зассангүй.) */}
      {/* `px-4 md:px-8` нь дээрх <section>-ийнхтэй ЯГ ижил. Мөрийг тэр
         section-ээс гаргахад түүний хажуугийн зай нь үлдсэн бөгөөд
         <main> нь гар утсан дээр `px-0` тул тоо дэлгэцийн ирмэг дээр
         наалдаж, "0/20" тасарч байв. Одоо зурагт хавтан, MISSION
         гарчигтай нэг босоо шугам дээр зогсоно. */}
      {showStats && (
        /* ─── СТАТИСТИКИЙН ЗУРВАС ────────────────────────────────────
           Нүүр одоо hero + энэ хоёроос л бүрдэнэ. Өмнө нь энэ нь урт
           хуудасны нэг жижиг мөр байсан бөгөөд доор нь MISSION-ы текст
           үргэлжилдэг байв — тэр үед сул мөр байхад зүгээр. Одоо энэ нь
           дэлгэцийн ХОЁР ДАХЬ бөгөөд СҮҮЛЧИЙН элемент тул жин нь өөр.

           Тоог ДЭЭД мөрөнд, шошгыг доор нь тавив: хүний нүд эхлээд тоонд
           буудаг, шошго нь тайлбар. Урвуу байрлалд нүд эхлээд шошгыг
           уншиж, дараа нь тоо руу буцдаг — нэмэлт алхам. */
        <div className="mt-6 px-4 md:mt-8 md:px-8">
          <div
            className="grid overflow-hidden rounded-[4px] border"
            style={{
              /* Inline загвар нь сэдвийн давхаргыг ялдаг — тиймээс
                  ЭНД токен л байх ёстой. Fallback нь шөнийн утга. */
              borderColor: "var(--line, #E3E6EE)",
              background: "var(--surface-2, #FFFFFF)",
              gridTemplateColumns: `repeat(${countdown ? 3 : 2}, minmax(0, 1fr))`,
            }}
          >
            {countdown && (
              <div className="px-4 py-5 text-center md:py-6" style={{ borderRight: "1px solid var(--line, #E3E6EE)" }}>
                <div
                  className="text-[clamp(22px,5vw,32px)] font-extrabold leading-none text-[#2E29FF]"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {countdown}
                </div>
                <div className="chrome mt-2 text-[10.5px] font-bold text-[#9C9CA6]">ЭЛСЭЛТ ХААГДАХАД</div>
              </div>
            )}

            <div className="px-4 py-5 text-center md:py-6" style={{ borderRight: "1px solid var(--line, #E3E6EE)" }}>
              <div
                className="text-[clamp(28px,7vw,40px)] font-extrabold leading-none text-[#F2F2F4]"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {totalUsers.toLocaleString()}
              </div>
              <div className="chrome mt-2 text-[10.5px] font-bold text-[#9C9CA6]">БҮРТГҮҮЛСЭН</div>
            </div>

            {/* Төлбөрөө төлсөн гишүүн — хамгийн үнэтэй нотолгоо, тиймээс
                Signal өнгөөр. Нэг дэлгэц дээр ганц л accent тоо. */}
            <div className="px-4 py-5 text-center md:py-6">
              <div
                className="text-[clamp(28px,7vw,40px)] font-extrabold leading-none text-[#2E29FF]"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {paidMembers.toLocaleString()}
              </div>
              <div className="chrome mt-2 text-[10.5px] font-bold text-[#9C9CA6]">ИДЭВХТЭЙ ГИШҮҮН</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function HomeLanding() {
  const content = useLandingContent();
  useEffect(() => {
    trackOnce("home_view");
  }, []);

  return (
    <div className="w-full">
      {/* Дараалал нь тогтмол: слайдер → тоолуур (HeroSlider дотор) →
          MISSION. `HomeSections` нь админаас асаадаг нэмэлт хэсгүүд —
          доор нь үлдэнэ (одоогоор хоосон). */}
      {/* HeroSlider — зочны нүүрэнд БУЦААВ (2026-10-11, эзний хүсэлт); гишүүний урсгалд байхгүй. */}
      <HeroSlider stats={null} />
      {/* «Одоо онлайн» тоолуур 2026-10-23-нд хасагдав (эзний хүсэлт). */}
      {/* Netflix маягийн хичээлийн мөр — зочин, гишүүнд ИЖИЛ (2026-10-06). */}
      <LessonRow />
      {/* Хөтөлбөрийн хэсэг (AI Creator) 2026-10-06-нд нүүрнээс хасагдав —
          компонент нь Programs.tsx-д хэвээр, /signup-ийн сонголт ч хэвээр. */}
      {/* MISSION-ы текстийг нүүрнээс БУУЛГАВ (2026-09-21). Нүүр одоо
          hero + тоо хоёроос л бүрдэнэ. `MissionBrief` компонент нь
          байрандаа — буцаах бол энэ мөрийг л сэргээнэ. */}
      <HomeSections keys={content.homeSections} />
      {/* Зочны урсгал 2026-10-06-нд нэмэгдээд мөн өдөртөө эзний хүсэлтээр
          хасагдав. GuestFeed.tsx файл нь хэвээр — буцаахад энд л тавина. */}
    </div>
  );
}
