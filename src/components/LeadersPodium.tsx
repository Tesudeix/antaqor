"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/* ─── Зочны нүүр: ТЭРГҮҮЛЭГЧИД ───────────────────────────────────────────

   Слайдерын ЯГ ДАРАА. Дараалал нь санамсаргүй биш:

     слайдер   → "энэ юу вэ"
     подиум    → "энд ХЭН байна, тэд юу авч байна"   ← ЭНЭ
     бүтээлийн хана → "энд юу хийгддэг"

   ЯАГААД ХҮМҮҮС ТҮРҮҮНД ВЭ: зочин бүтээл хараад "сайхан зураг" гэж
   боддог. Хүн хараад "энэ хүн намайг бодвол юугаараа өөр юм бэ" гэж
   боддог. Хоёр дахь бодол нь бүртгэл рүү хөтөлдөг, эхнийх нь үгүй.
   Долоо хоног бүр шинэчлэгддэг самбар нь бас "суудал ЗАХИАЛГААР биш,
   АЖЛААР эзлэгддэг" гэдгийг хэлнэ — тэр нь худалдаж авах шалтгаан.

   ПОДИУМ, жагсаалт биш. 2 · 1 · 3 гэсэн байрлал нь тайлбаргүйгээр
   уншигдана; жагсаалт бол зөвхөн эрэмбэ, подиум бол ТЭМЦЭЛ.

   Тэргүүн нь титэмтэй, том, өндөр дэвсгэр дээр. Тэр гурвын ялгаа нь
   хэдэн пиксел биш — статус юу гэсэн үг болохыг харуулдаг ялгаа. */

interface Leader {
  _id: string;
  name: string;
  username: string;
  avatar: string;
  xp: number;
}

function Crown() {
  return (
    <svg viewBox="0 0 24 24" className="h-full w-full" fill="currentColor" aria-hidden>
      <path d="M3 8.2l3.6 2.6L12 4l5.4 6.8L21 8.2 19.4 18H4.6L3 8.2zM6.3 20h11.4v1.4H6.3V20z" />
    </svg>
  );
}

function Avatar({ src, name, size }: { src: string; name: string; size: number }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt=""
        className="h-full w-full rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="flex items-center justify-center rounded-full bg-[#1E1E1E] font-black text-[#E2E4E8]"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function Slot({ leader, rank }: { leader: Leader; rank: 1 | 2 | 3 }) {
  const king = rank === 1;
  const size = king ? 76 : 56;

  return (
    <div className={`flex min-w-0 flex-col items-center ${king ? "" : "pt-6"}`}>
      <div className="relative">
        {king && (
          /* Титэм нь аватарын ДЭЭР хөвнө — дотор нь тавибал нүүрийг
             дардаг, хажууд нь тавибал зүгээр л дүрс болно. Дээр байх нь
             л "энэ хүн бусдаас дээгүүр" гэсэн утга өгнө. */
          <span
            className="absolute left-1/2 h-5 w-5 -translate-x-1/2 text-[#2E29FF]"
            style={{ top: -18 }}
          >
            <Crown />
          </span>
        )}
        {/* ─── НЕОН ЦАГИРАГ ─────────────────────────────────────────
            Тэргүүний эргэн тойрон эргэлдэх гэрлэн цагираг. Хоёр давхарга:
            эргэлдэх өнгөт нуман (conic-gradient) ба амьсгалах гэрэлтэлт.
            Зөвхөн НЭГДҮГЭЭРТ — хэрэв гурвуулаа гэрэлтвэл эхний байр гэж
            юу ч үлдэхгүй. Ялгаа нь чимэглэл биш, ЗЭРЭГ ДЭВ. */}
        <span
          className={`relative block rounded-full ${king ? "lp-ring p-[3px]" : "p-[2px]"}`}
          style={king ? undefined : { background: "rgba(128,128,128,0.28)" }}
        >
          <span className="relative block rounded-full" style={{ background: king ? "#F8F9FD" : "transparent", padding: king ? 2 : 0 }}>
            <Avatar src={leader.avatar} name={leader.name} size={size} />
          </span>
        </span>
        <span
          className="absolute -bottom-1 left-1/2 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full text-[10px] font-black"
          style={{
            background: king ? "#2E29FF" : "#F1F2F7",
            color: king ? "#FFFFFF" : "#30333F",
          }}
        >
          {rank}
        </span>
      </div>

      <div
        className={`mt-3.5 max-w-full truncate font-bold ${king ? "text-[14px]" : "text-[12.5px]"}`}
        style={{ color: king ? "var(--nav-fg-strong)" : "#30333F" }}
      >
        {leader.name}
      </div>
      <div
        className="mt-0.5 text-[11px] font-bold tabular-nums"
        style={{ color: king ? "#2E29FF" : "#30333F" }}
      >
        {leader.xp.toLocaleString()} XP
      </div>
    </div>
  );
}

export default function LeadersPodium() {
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    fetch("/api/leaderboard?limit=3")
      .then((r) => r.json())
      .then((d) => { if (!cancel && Array.isArray(d.leaders)) setLeaders(d.leaders); })
      .catch(() => {})
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, []);

  if (loading) {
    return (
      <section className="px-4 pt-10 sm:px-5" aria-busy="true">
        <div className="mx-auto max-w-[1000px]">
          <div className="flex items-center justify-between gap-4">
            <div className="h-6 w-40 rounded-[4px] skeleton-brand" />
            <div className="h-4 w-16 rounded-[4px] skeleton-brand" />
          </div>
          <div className="mt-5 grid grid-cols-3 items-end gap-2 px-2 py-5 sm:gap-4">
            {[56, 76, 56].map((sz, i) => (
              <div key={i} className={`flex flex-col items-center ${i === 1 ? "" : "pt-6"}`}>
                <div className="rounded-full skeleton-brand" style={{ width: sz, height: sz }} />
                <div className="mt-3.5 h-3.5 w-20 rounded-[3px] skeleton-brand" />
                <div className="mt-1.5 h-3 w-12 rounded-[3px] skeleton-brand" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }
  /* Гурваас цөөн бол ХАРУУЛАХГҮЙ. Хоёр хүнтэй подиум нь тэмцээн биш,
     зөвхөн хоосон суудал харуулна. */
  if (leaders.length < 3) return null;

  const [first, second, third] = leaders;

  return (
    <section className="px-4 pt-10 sm:px-5">
      <div className="mx-auto max-w-[1000px]">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-[19px] font-extrabold leading-[1.15] tracking-[-0.02em] text-[var(--nav-fg-strong)] sm:text-[22px]">
            Тэргүүлэгчид
          </h2>
          <Link
            href="/leaderboard"
            className="text-[12.5px] font-semibold text-[#E2E4E8] transition hover:text-[#2E29FF]"
          >
            Бүгд →
          </Link>
        </div>

        {/* Бүхэл подиум нь НЭГ холбоос. Зочин хэн нэгний нүүр дээр дарахад
            "энэ хүн хэн бэ" биш "эдгээр нь хэн бэ" гэдгийг хайж байгаа —
            тиймээс гишүүний профайл руу биш, самбар руу аваачна. */}
        <Link
          href="/leaderboard"
          className="mt-5 grid grid-cols-3 items-end gap-2 rounded-[4px] px-2 py-6 transition hover:bg-[rgba(128,128,128,0.05)] sm:gap-4"
        >
          <Slot leader={second} rank={2} />
          <Slot leader={first} rank={1} />
          <Slot leader={third} rank={3} />
        </Link>
      </div>

      <style jsx global>{`
        /* Эргэлдэх неон нум — маск нь дундыг нь хоослож, зөвхөн ЦАГИРАГ
           үлдээнэ. Зузаан нь 3px: бүдэг байвал харагдахгүй, зузаан байвал
           аватарыг дардаг. */
        .lp-ring {
          background: conic-gradient(
            from 0deg,
            rgba(46,41,255, 0) 0deg,
            #2E29FF 90deg,
            #1F1AD9 150deg,
            rgba(46,41,255, 0) 260deg
          );
          animation: lp-spin 3.2s linear infinite;
          box-shadow: 0 0 18px rgba(46,41,255, 0.45), 0 0 36px rgba(46,41,255, 0.18);
        }
        @keyframes lp-spin { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) {
          .lp-ring { animation: none; background: #2E29FF; }
        }
      `}</style>
    </section>
  );
}
