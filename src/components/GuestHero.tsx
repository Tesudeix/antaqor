"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import SwipeDeck, { SwipeDots } from "@/components/SwipeDeck";

/* ─── Нүүрний слайдер — ЗӨВХӨН ЗУРАГ ──────────────────────────────────────
   Слайд дээр текст БАЙХГҮЙ. Админ дээрх `chrome / line1 / line2 / sub /
   ctaLabel / layout` талбарууд УСТААГҮЙ — `/admin/hero` тэдгээрийг хэвээр
   хадгална — зүгээр л энэ рендер тэднийг уншихаа больсон. Буцаах хэрэгтэй
   бол git-ийн түүхэнд бүтэн хувилбар байгаа.

   МЕДИА: ямар ч харьцаатай зураг ажиллана. Зураг нь БҮТНЭЭРЭЭ харагдана
   (`object-contain`), ард нь өөрийнх нь бүдгэрсэн хуулбар дэлгэцийг ирмэг
   хүртэл дүүргэнэ. Тиймээс босоо постер ч, хөндлөн зураг ч тайрагдахгүй.
   Видео бол cover хэвээр — видео ихэвчлэн хөндлөн бөгөөд хоёр дахь видео
   зэрэг тайлах нь үнэтэй.

   Текст үлдсэн ганц газар нь слайдын ДООРХ зурвас: зорилгын нэг мөр,
   гишүүдийн тоо, хүрээллийн тухай хуудас руу заасан холбоос. Тэдгээр нь
   слайдын дотор биш, слайдаас хамааралгүй тул слайд солигдоход өөрчлөгдөхгүй. */

interface Slide {
  id: string;
  image: string;
}

interface Stats {
  totalUsers: number;
  paidMembers: number;
  newMembers7d: number;
}

function CountUp({ value, duration = 1100 }: { value: number; duration?: number }) {
  const [n, setN] = useState(0);
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced || value <= 0) {
      setN(value);
      done.current = true;
      return;
    }

    /* Далд таб дээр requestAnimationFrame ОГТ ажиллахгүй. Хөдөлгөөн
       эхлэхгүй нь асуудал биш — хэн ч харахгүй байна. Асуудал нь тоо
       0 дээрээ гацаж, хүн табаа нээхэд "0 гишүүд" гэж ХУДАЛ мэдээлэл
       харуулах явдал. Тиймээс далд үед хөдөлгөөнгүйгээр жинхэнэ утгаа
       шууд тавина. */
    if (typeof document !== "undefined" && document.hidden) {
      setN(value);
      done.current = true;
      return;
    }

    let raf = 0;
    const started = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setN(Math.round(value * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else done.current = true;
    };
    raf = requestAnimationFrame(tick);

    /* Аюулгүйн тор: rAF ямар ч шалтгаанаар зогсвол (таб далд болох,
       хөтчийн хязгаарлалт) тоо дундаа гацахгүй, жинхэнэ утга дээрээ
       очно. Тоо бол чимэглэл биш — буруу тоо харуулснаас хөдөлгөөнгүй
       зөв тоо дээр.  */
    const safety = window.setTimeout(() => {
      if (!done.current) {
        setN(value);
        done.current = true;
      }
    }, duration + 600);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(safety);
    };
  }, [value, duration]);

  return <>{n.toLocaleString("en-US")}</>;
}

function isVideo(src: string) {
  return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(src);
}

/* Слайдер медиагаа дагаж өндөрсөнө. Viewport-ийн дээд хязгаар нь босоо зураг
   том дэлгэц дээр хэт сунахаас хамгаална; тогтмол min-height зориуд байхгүй —
   тэр нь өргөн/нам медианы дээр хоосон "margin" үүсгэдэг байсан. */
const HERO_MAX_H = "max-h-[calc(100svh-65px)] lg:max-h-svh";
const DEFAULT_MEDIA_RATIO = 4 / 5;

export default function GuestHero() {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [mediaRatios, setMediaRatios] = useState<Record<string, number>>({});

  useEffect(() => {
    let alive = true;
    fetch("/api/hero-slides")
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (Array.isArray(d?.slides)) {
          setSlides(
            (d.slides as { id: string; image?: string }[])
              .map((x) => ({ id: x.id, image: x.image || "" }))
              .filter((x) => x.image)
          );
        }
      })
      .catch(() => {})
      .finally(() => { if (alive) setLoaded(true); });

    fetch("/api/stats")
      .then((r) => r.json())
      .then((d) => { if (alive && typeof d?.totalUsers === "number") setStats(d); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (paused || slides.length < 2) return;
    const onVis = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    const t = setInterval(() => setIdx((i) => (i + 1) % slides.length), 7000);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [paused, slides.length]);

  // Хүн гараа хүрмэгц автомат дэвшилт зогсоно.
  const takeOver = useCallback((i: number) => {
    setPaused(true);
    setIdx(i);
  }, []);

  const rememberRatio = useCallback((id: string, width: number, height: number) => {
    if (!width || !height) return;
    const ratio = width / height;
    setMediaRatios((current) =>
      Math.abs((current[id] || 0) - ratio) < 0.001
        ? current
        : { ...current, [id]: ratio }
    );
  }, []);

  const activeRatio = mediaRatios[slides[idx]?.id] || DEFAULT_MEDIA_RATIO;

  /* Layout-ийн хажуугийн ба дээд зайг цуцалж, слайдерыг ирмэг хүргэнэ.
     `main` нь утсан дээр px-0 pt-4, md дээр px-8 pt-8, lg дээр px-0. */
  const bleed = "-mt-4 md:-mx-8 md:-mt-8 lg:mx-0";

  return (
    <section aria-label="Antaqor" className={`w-full ${bleed}`}>
      {loaded && slides.length > 0 && (
        <div className="relative w-full">
          <div
            className={`w-full overflow-hidden bg-[#0A0A0A] ${HERO_MAX_H}`}
            style={{ aspectRatio: activeRatio }}
          >
          <SwipeDeck
            index={idx}
            onIndexChange={takeOver}
            gap={0}
            ariaLabel="Танилцуулга"
            className="h-full"
            trackClassName="h-full items-stretch"
          >
            {slides.map((s, i) => (
              <div key={s.id} className="relative h-full basis-full overflow-hidden bg-[#0A0A0A]">
                {isVideo(s.image) ? (
                  // muted + playsInline байхгүй бол iOS Safari автоматаар тоглуулахгүй.
                  <video
                    src={s.image}
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    onLoadedMetadata={(e) =>
                      rememberRatio(s.id, e.currentTarget.videoWidth, e.currentTarget.videoHeight)
                    }
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  /* Хоёр давхарга: ард нь БҮДГЭРСЭН хуулбар дэлгэцийг
                     дүүргэнэ, урд нь жинхэнэ зураг БҮТНЭЭРЭЭ багтана.

                     Яагаад ганц `object-cover` биш вэ: слайдын зураг ямар ч
                     харьцаатай байж болно (админ юу ч оруулж болно), гэтэл
                     cover нь савныхаа харьцаанд тохируулж ТАЙРНА. Одоогийн
                     слайд бол 3:4 босоо постер бөгөөд дээр нь "ANTAQOR",
                     "AI ENTREPRENEUR" гэсэн бичиг ШИНГЭЭСЭН — cover-оор
                     утсан дээр эхний үсгүүд нь шууд тайрагдаж, "AQOR",
                     "ENTREPRENEU" болж байсан. Текстгүй слайдер дээр
                     зураг өөрөө бүх зурвасыг үүрч байгаа тул тайрах нь
                     зүгээр нэг гоо зүйн алдаа биш, мессежийг устгаж байна.

                     Бүдэг дэвсгэр нь ирмэг хүртэл дүүрэн харагдах явдлыг
                     хадгална — өөрөөр хэлбэл "full" хэвээр, гэхдээ юу ч
                     алдагдахгүй. Аль ч харьцаанд ажиллана. */
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={s.image}
                      alt=""
                      aria-hidden
                      loading={i === 0 ? "eager" : "lazy"}
                      className="absolute inset-0 h-full w-full scale-110 object-cover opacity-35 blur-2xl"
                    />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={s.image}
                      alt=""
                      loading={i === 0 ? "eager" : "lazy"}
                      fetchPriority={i === 0 ? "high" : "auto"}
                      onLoad={(e) =>
                        rememberRatio(s.id, e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)
                      }
                      className="absolute inset-0 h-full w-full object-contain"
                    />
                  </>
                )}
              </div>
            ))}
          </SwipeDeck>
          </div>

          {/* Цэгүүд урсгалын negative margin биш, слайдын өөрийн давхарга.
              Иймээс дараагийн хэсгийн байрлал медианы өндрөөс л хамаарна. */}
          <SwipeDots
            count={slides.length}
            index={idx}
            onSelect={takeOver}
            className="absolute inset-x-0 bottom-1 z-10"
          />
        </div>
      )}

      {!loaded && (
        <div
          className={`w-full animate-pulse bg-[#0A0A0A] ${HERO_MAX_H}`}
          style={{ aspectRatio: DEFAULT_MEDIA_RATIO }}
        />
      )}

      {/* ─── Дөрвөн хаалга — слайдерын ЯГ доор ───────────────────────────
          Слайдер нь "энэ юу вэ", энэ зурвас нь "энд юу болж байна" гэдгийг
          хэлнэ. Дараалал нь санамсаргүй биш: доош гүйлгэсэн хүний нүд
          хамгийн түрүүнд ЖИНХЭНЭ өгөгдөл дээр буух ёстой — дараагийн
          хичээл хэзээ, хэдэн бүтээл, хэдэн гишүүн, хэн тэргүүлж байна.
          Зорилгын мөр (доор) нь амлалт; энэ нь нотолгоо. Нотолгоо түрүүнд.

          Бүрэлдэхүүн нь өөрөө өгөгдлөө татаж, ирэх хүртэл байрыг нь эзэлнэ
          — тиймээс энд ямар ч нөхцөл шаардлагагүй. */}
      {/* StoryRail (ХУВААРЬ · БҮТЭЭЛ · ГИШҮҮД · ТЭРГҮҮН гэсэн дөрвөн
          хавтан) 2026-09-04-нд хасагдав. Тэдгээрийн гурав нь ХООСОН
          орон зайг чимэглэлээр дүүргэж байсан — цэгцгүй үсэг, цэг,
          тасархай хүрээ. Зочинд "энд юу байна" гэж хэлэх ёстой газар
          нь юу ч хэлэхгүй хийсвэр дүрс үзүүлэх нь итгэл бууруулна.
          Жинхэнэ нотолгоо нь доорх гишүүдийн тоо ба бүтээлийн хана. */}

      {/* ─── Зурвас — слайдаас ХАМААРАХГҮЙ ─── */}
      <div className="border-t border-[#1E1E1E] bg-[#0A0A0A] px-5 py-5 md:px-12 md:py-6">
        <div className="mx-auto max-w-4xl">
          {/* ─── Гишүүдийн тоо ───
              Тоонууд нь ЖИНХЭНЭ: /api/stats нь идэвхтэй захиалгатай
              хэрэглэгчийг гишүүнчлэлийн хаалттай ЯГ ижил дүрмээр тоолдог
              тул энд харагдах тоо нь хаалганы цаана байгаа хүмүүсийн тоотой
              үргэлж тэнцүү байна. Хоёр өөр газар өөрөөр тоолж эхэлбэл нэг
              нь худал болно. */}
          {stats && (
            <dl className="mt-2 grid grid-cols-3">
              {[
                { k: "Идэвхтэй гишүүд", v: stats.paidMembers },
                { k: "Шинэ гишүүд · 7 хоног", v: stats.newMembers7d },
                { k: "Нийт гишүүд", v: stats.totalUsers },
              ].map((x) => (
                <div key={x.k} className="px-2 py-4 text-center sm:px-5">
                  <dd
                    className="text-[clamp(22px,5vw,32px)] font-extrabold leading-none tracking-[-0.03em] text-[#F2F2F4]"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    <CountUp value={x.v} />
                  </dd>
                  <dt className="chrome mt-2 text-[10px] font-bold leading-tight tracking-[0.12em] text-[#E2E4E8]">
                    {x.k}
                  </dt>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
    </section>
  );
}
