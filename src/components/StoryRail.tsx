"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";

/* ─── Нүүрний зурвас — дөрвөн хаалга ───────────────────────────────────────

   Слайдер нь "энэ юу вэ" гэдгийг хэлнэ. Түүний ДООР шууд гарах ёстой зүйл
   нь "энд юу БОЛЖ БАЙНА вэ" — амьд байгаагийн нотолгоо. Гурван мөр текст
   биш, дөрвөн ЖИНХЭНЭ өгөгдөл: дараагийн хичээл хэзээ, хэдэн бүтээл
   нийтлэгдсэн, хэдэн гишүүн байгаа, энэ долоо хоног хэн тэргүүлж байна.

   ХЭЛБЭР. Instagram-ийн стори зурвас: жижиг дөрвөлжин, дээр нь хүрээ, доор
   нь нэр. Тэр хэлбэрийг сонгосон шалтгаан нь загвар биш, ЗУРШИЛ — утсаа
   нээсэн хүн энэ хэлбэрийг харангуутаа "дарж болно, шинэ зүйл байна" гэж
   ойлгодог. Ганц ялгаа: тойрог биш, 4px радиустай дөрвөлжин. Сайтын бүх
   геометр 4px (§03) бөгөөд нэг л газар тойрог болгох нь бүх системийг
   зөрчинө. Хүрээ нь 6px — 4 + 2px зузаан, төвлөрсөн радиусын зөв утга.

   ХҮРЭЭНИЙ УТГА. Стори дээр өнгөт цагираг = "хараагүй байна". Энд бас
   утгатай: ямар нэг ШИНЭ зүйл байвал (эфирт байгаа, 24 цагт нэмэгдсэн
   бүтээл, 7 хоногт нэгдсэн гишүүн, идэвхтэй тэргүүн) цагираг улаан
   болно. Хоосон бол үсэн зураас. Чимэглэл биш — мэдээлэл.

   ХООСОН ТӨЛӨВ. Эвент байхгүй үед хавтанг НУУХГҮЙ. Дөрвөн хавтан нь
   тогтмол байрлал — өнөөдөр гурав, маргааш дөрөв болж үсэрвэл хүн нүүрээ
   сурч чадахгүй. Оронд нь тухайн хавтан "Удахгүй" гэж шулуухан хэлнэ.

   ӨГӨГДӨЛ. Дөрвүүлээ НЭГ `/api/home-rail` дуудлагаас ирнэ — дөрвөн өөр
   коллекц ч гэсэн зочны хувьд нэг эргэлт. Дуудлага унавал зурвас нь
   бүрмөсөн нуугдана: хагас дүүрэн зурвас нь байхгүй зурвасаас муу.       */

interface Rail {
  schedule: { image: string; title: string; type: string; at: string | null; live: boolean; upcoming: number };
  creations: { image: string; total: number; fresh24h: number; locked: number };
  members: { avatars: { name: string; avatar: string }[]; total: number; new7d: number };
  leaders: { name: string; avatar: string; xp: number; total: number };
}

const MN_DAYS = ["Ня", "Да", "Мя", "Лх", "Пү", "Ба", "Бя"];

function initial(name: string) {
  const c = (name || "").trim().charAt(0);
  return c ? c.toUpperCase() : "•";
}

/** "Маргааш · 20:00", "Мя · 20:00", "8/26 · 20:00" — ойрын огноо нь хүнд
 *  тоо биш, ҮГ. Долоо хоногоос цааш л тоо болно. */
function whenLabel(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const time = d.toLocaleTimeString("mn-MN", { hour: "2-digit", minute: "2-digit" });
  const today = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(d) - startOf(today)) / 86_400_000);
  if (days === 0) return `Өнөөдөр · ${time}`;
  if (days === 1) return `Маргааш · ${time}`;
  if (days > 1 && days < 7) return `${MN_DAYS[d.getDay()]} · ${time}`;
  return `${d.getMonth() + 1}/${d.getDate()} · ${time}`;
}

function isVideo(src: string) {
  return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(src);
}

/* ─── Нэг хавтан ─────────────────────────────────────────────────────────
   `fresh` нь цагирагны өнгийг шийднэ. `muted` нь өгөгдөлгүй үеийн намуухан
   төлөв — хавтан байрандаа үлдэнэ, гэхдээ анхаарал татахаа болино. */
function Tile({
  href,
  label,
  meta,
  fresh,
  muted,
  badge,
  children,
}: {
  href: string;
  label: string;
  meta: string;
  fresh?: boolean;
  muted?: boolean;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={`${label} — ${meta}`}
      className="group block min-w-0 focus:outline-none"
    >
      <div
        className={`rounded-[4px] p-[2px] transition ${
          fresh
            ? "bg-[linear-gradient(140deg,#2E29FF_0%,#1F1AD9_45%,#262626_100%)]"
            : "bg-[#262626]"
        }`}
      >
        <div
          className={`relative aspect-square w-full overflow-hidden rounded-[4px] bg-[#0A0A0A] ${
            muted ? "opacity-70" : ""
          } transition group-hover:opacity-100 group-focus-visible:ring-2 group-focus-visible:ring-[#2E29FF]`}
        >
          {children}
          {badge && (
            <div className="absolute inset-x-0 bottom-0 flex justify-center pb-1">{badge}</div>
          )}
        </div>
      </div>

      <div className="mt-2 text-center">
        <div className="chrome truncate text-[10px] font-bold uppercase leading-tight tracking-[0.14em] text-[#F2F2F4] md:text-[11px]">
          {label}
        </div>
        <div
          className="mt-0.5 truncate text-[10px] font-semibold leading-tight text-[#E2E4E8] md:text-[11px]"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {meta}
        </div>
      </div>
    </Link>
  );
}

/** Аватаргүй хүний нүүр — нэрийн эхний үсэг. Зурагтай мэт дүр эсгэхгүй. */
function Face({ name, avatar, className = "" }: { name: string; avatar: string; className?: string }) {
  if (avatar) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={avatar} alt="" loading="lazy" className={`h-full w-full object-cover ${className}`} />;
  }
  return (
    <div className={`flex h-full w-full items-center justify-center bg-[#1E1E1E] ${className}`}>
      <span className="text-[13px] font-extrabold tracking-tight text-[#E2E4E8] md:text-[15px]">
        {initial(name)}
      </span>
    </div>
  );
}

function Cover({ src }: { src: string }) {
  if (isVideo(src)) {
    return <video src={src} muted loop playsInline preload="metadata" className="h-full w-full object-cover" />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />;
}

/** Хоосон хавтангийн дотор — тасархай хүрээ ба тэмдэг. Саарал нүх биш. */
function Blank({ glyph }: { glyph: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="flex h-[58%] w-[58%] items-center justify-center rounded-[4px] border border-dashed border-[#262626]">
        <span className="text-[16px] leading-none text-[#E2E4E8] md:text-[20px]">{glyph}</span>
      </div>
    </div>
  );
}

export default function StoryRail() {
  const [d, setD] = useState<Rail | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/home-rail")
      .then((r) => r.json())
      .then((j) => {
        if (alive && j && j.members) setD(j as Rail);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  /* Ирэхээс нь өмнө байрыг нь ЭЗЭЛНЭ. Үгүй бол зурвас ирэх мөчид доорх
     бүх агуулга доош үсэрч, уншиж эхэлсэн хүний нүд алдагдана (CLS). */
  if (!d) {
    return (
      <div className="border-t border-[#1E1E1E] bg-[#0A0A0A] px-5 pb-5 pt-6 md:px-12">
        <div className="mx-auto grid max-w-4xl grid-cols-4 gap-3 md:gap-6">
          {[0, 1, 2, 3].map((i) => (
            <div key={i}>
              <div className="aspect-square w-full animate-pulse rounded-[4px] bg-[#0A0A0A]" />
              <div className="mx-auto mt-2 h-2 w-10 animate-pulse rounded-[2px] bg-[#0A0A0A]" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const { schedule, creations, members, leaders } = d;

  // ── 1. ХУВААРЬ ──
  const scheduleMeta = schedule.live
    ? "ОДОО ЭФИРТ"
    : schedule.at
      ? whenLabel(schedule.at)
      : "Удахгүй";

  // ── 2. БҮТЭЭЛ ──
  const creationsMeta =
    creations.total > 0 ? `${creations.total} бүтээл` : "Эхнийх нь бай";

  // ── 3. ГИШҮҮД ──
  const membersMeta = members.total > 0 ? `${members.total} гишүүн` : "Нээлттэй";

  // ── 4. ТЭРГҮҮН ──
  const leadersMeta = leaders.name ? `${leaders.xp} XP` : "Долоо хоног шинэ";

  return (
    <div className="border-t border-[#1E1E1E] bg-[#0A0A0A] px-5 pb-6 pt-6 md:px-12 md:pb-8">
      <div className="mx-auto grid max-w-4xl grid-cols-4 gap-3 md:gap-6">
        {/* ── ХУВААРЬ ─────────────────────────────────────────────────── */}
        <Tile
          href="/calendar"
          label="Хуваарь"
          meta={scheduleMeta}
          fresh={schedule.live || schedule.upcoming > 0}
          muted={!schedule.at}
          badge={
            schedule.live ? (
              <span className="chrome inline-flex items-center gap-1 rounded-[4px] bg-[#2E29FF] px-1.5 py-0.5 text-[8px] font-extrabold tracking-[0.1em] text-white md:text-[9px]">
                <span className="h-1 w-1 rounded-[1px] bg-[#0A0A0A] motion-safe:animate-ping" />
                LIVE
              </span>
            ) : null
          }
        >
          {schedule.image ? (
            <Cover src={schedule.image} />
          ) : schedule.at ? (
            /* Зураггүй эвент — огноо нь ӨӨРӨӨ зураг болно. Хуанлийн хуудас:
               сарын товч дээр, өдрийн тоо том. */
            <div className="flex h-full w-full flex-col items-center justify-center gap-0.5 bg-[#0A0A0A]">
              <div className="chrome text-[8px] font-bold tracking-[0.18em] text-[#2E29FF] md:text-[9px]">
                {new Date(schedule.at).getMonth() + 1}-Р САР
              </div>
              <div
                className="text-[26px] font-extrabold leading-none tracking-[-0.04em] text-[#F2F2F4] md:text-[34px]"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {new Date(schedule.at).getDate()}
              </div>
              <div className="chrome mt-0.5 max-w-[90%] truncate text-[8px] font-semibold tracking-[0.08em] text-[#E2E4E8] md:text-[9px]">
                {schedule.title || "ЭВЕНТ"}
              </div>
            </div>
          ) : (
            <Blank glyph="◷" />
          )}
        </Tile>

        {/* ── БҮТЭЭЛ ──────────────────────────────────────────────────── */}
        <Tile
          href="/creations"
          label="Бүтээл"
          meta={creationsMeta}
          fresh={creations.fresh24h > 0}
          muted={creations.total === 0}
          badge={
            creations.locked > 0 && !creations.image ? (
              <span className="chrome rounded-[4px] bg-[#1E1E1E] px-1.5 py-0.5 text-[8px] font-bold tracking-[0.1em] text-[#E2E4E8] md:text-[9px]">
                {creations.locked} ХААЛТТАЙ
              </span>
            ) : null
          }
        >
          {creations.image ? (
            <Cover src={creations.image} />
          ) : creations.total > 0 ? (
            /* Бүтээл байгаа ч бүгд гишүүдэд хаалттай. Зургийг нь ЯМАР Ч
               тохиолдолд гаргахгүй (URL нь ч бас мэдээлэл) — оронд нь
               хаалттай нүднүүдийн тор. Юу ч алдалгүй "энд юм байна" гэж
               хэлэх цорын ганц үнэнч арга. */
            <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-px bg-[#1E1E1E]">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-center bg-[#0A0A0A]">
                  <span className="text-[10px] leading-none text-[#333333] md:text-[12px]">✦</span>
                </div>
              ))}
            </div>
          ) : (
            <Blank glyph="✦" />
          )}
        </Tile>

        {/* ── ГИШҮҮД ─────────────────────────────────────────────────── */}
        <Tile
          href="/members"
          label="Гишүүд"
          meta={membersMeta}
          fresh={members.new7d > 0}
          muted={members.total === 0}
          badge={
            members.new7d > 0 ? (
              <span className="chrome rounded-[4px] bg-[#2E29FF] px-1.5 py-0.5 text-[8px] font-extrabold tracking-[0.1em] text-white md:text-[9px]">
                +{members.new7d}
              </span>
            ) : null
          }
        >
          {members.avatars.length > 0 ? (
            <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-px bg-[#1E1E1E]">
              {Array.from({ length: 4 }).map((_, i) => {
                const m = members.avatars[i];
                return (
                  <div key={i} className="overflow-hidden bg-[#0A0A0A]">
                    {m ? <Face name={m.name} avatar={m.avatar} /> : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <Blank glyph="◇" />
          )}
        </Tile>

        {/* ── ТЭРГҮҮН ────────────────────────────────────────────────── */}
        <Tile
          href="/leaderboard"
          label="Тэргүүн"
          meta={leadersMeta}
          fresh={leaders.xp > 0}
          muted={!leaders.name}
          badge={
            leaders.name ? (
              <span className="chrome max-w-[92%] truncate rounded-[4px] bg-[#0A0A0A] px-1.5 py-0.5 text-[8px] font-bold tracking-[0.08em] text-[#F2F2F4] md:text-[9px]">
                {leaders.name}
              </span>
            ) : null
          }
        >
          {leaders.name ? (
            <div className="relative h-full w-full">
              <Face name={leaders.name} avatar={leaders.avatar} />
              <span className="chrome absolute left-1 top-1 rounded-[4px] bg-[#2E29FF] px-1 py-px text-[8px] font-extrabold leading-none text-white md:text-[9px]">
                1
              </span>
            </div>
          ) : (
            <Blank glyph="△" />
          )}
        </Tile>
      </div>
    </div>
  );
}
