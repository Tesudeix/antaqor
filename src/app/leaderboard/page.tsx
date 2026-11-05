"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useSession } from "next-auth/react";
import Icon from "@/components/Icon";

/* ─── Тэргүүлэгчид (2026-10-06, v2 — бүтэн өргөн) ────────────────────────
   7 хоногийн XP-ээр эрэмбэлсэн жагсаалт. Долоо хоног бүр тэглэгдэнэ.

   v2 UX засварууд (эзний "хоосон зай байхгүй, wide" хүсэлт):
   • PageShell-ийн 760px багана + ХООСОН 300px баруун самбарыг хасаж
     бүтэн өргөн (max 1100px) ашиглав.
   • "Та #N байна" нь бүтэн өргөн блок байхаа больж гарчгийн БАРУУН
     талд нягт неон самбар болов — нэг мөрөнд хоёр мэдээлэл.
   • Индэрийн шат (#2 · #1 · #3) хадгалагдсан ч өндрийн зөрүү 44/80px →
     18/34px: шат харагдана, доороо хоосон гол үлдээхгүй.
   • 4–100 нь ширээн дээр ХОЁР баганатай, мөр нягт — 97 мөр нэг
     урт сүүл биш. Өөрийн мөр неоноор тодорно. */

interface Leader {
  _id: string;
  name: string;
  username: string;
  avatar: string;
  xp: number;
}

interface Me { rank: number | null; xp: number; total: number }

const NEON = "#2E29FF";
/* Бичигт: өдөр (#F8F9FD) teal 1.82:1 тул гүн teal (theme-light-extra §11). */
const NEON_INK = "var(--neon-ink, #2E29FF)";
const neonCard: React.CSSProperties = {
  background: "linear-gradient(180deg, rgba(46,41,255,0.26) 0%, rgba(46,41,255,0.06) 55%, rgba(46,41,255,0.02) 100%)",
  border: "1px solid rgba(46,41,255,0.55)",
  boxShadow:
    "0 0 0 1px rgba(46,41,255,0.12), 0 0 28px -6px rgba(46,41,255,0.55), inset 0 0 28px rgba(46,41,255,0.10)",
};
const gridBg: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(rgba(46,41,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(46,41,255,0.07) 1px, transparent 1px)",
  backgroundSize: "22px 22px",
};
const quietRow: React.CSSProperties = { background: "rgba(46,41,255,0.05)", border: "1px solid rgba(46,41,255,0.14)" };

function Avatar({ l, size }: { l: Leader; size: number }) {
  return l.avatar ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={l.avatar} alt="" className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-bold"
      style={{ width: size, height: size, background: "#F1F2F7", color: "#30333F", fontSize: size * 0.38 }}
    >
      {(l.name || "?").charAt(0).toUpperCase()}
    </span>
  );
}

function XpPill({ xp, strong }: { xp: number; strong?: boolean }) {
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-[4px] px-2 py-0.5 text-[13px] font-extrabold tabular-nums"
      style={strong ? { background: NEON, color: "#FFFFFF" } : { background: "rgba(46,41,255,0.14)", color: NEON_INK }}
    >
      {xp.toLocaleString()} XP
    </span>
  );
}

function PodiumCard({ l, place, lift }: { l: Leader; place: 1 | 2 | 3; lift: number }) {
  const crown = place === 1;
  return (
    <Link
      href={`/profile/${l._id}`}
      className="press relative flex flex-col items-center rounded-[4px] px-2 pb-4 pt-6 text-center transition hover:-translate-y-1"
      style={{ ...neonCard, ...gridBg, marginTop: lift }}
    >
      <span
        className="absolute -top-3 left-1/2 flex h-7 min-w-7 -translate-x-1/2 items-center justify-center rounded-full px-2 text-[13px] font-black"
        style={{ background: crown ? "#FCEE0A" : "#EEF0FF", color: crown ? "#0A0A0A" : NEON, border: `1px solid ${crown ? "#FCEE0A" : NEON}`, boxShadow: `0 0 14px ${crown ? "#FCEE0A" : NEON}88` }}
      >
        #{place}
      </span>
      <span className="relative rounded-full p-[2px]" style={{ background: `linear-gradient(135deg, ${NEON}, #2E29FF)`, boxShadow: `0 0 18px -2px ${NEON}99` }}>
        <Avatar l={l} size={crown ? 72 : 56} />
        {crown && (
          <svg viewBox="0 0 24 24" className="absolute -top-4 left-1/2 h-5 w-5 -translate-x-1/2" style={{ color: "#FCEE0A", filter: "drop-shadow(0 0 6px #FCEE0A)" }} fill="currentColor" aria-hidden>
            <path d="M3 7l4.5 4L12 4l4.5 7L21 7l-2 12H5z" />
          </svg>
        )}
      </span>
      <span className="mt-2.5 line-clamp-1 w-full px-1 text-[15px] font-bold text-white">{l.name}</span>
      {l.username && <span className="line-clamp-1 w-full px-1 text-[12px] text-[#9C9CA6]">@{l.username}</span>}
      <span className="mt-2.5"><XpPill xp={l.xp} strong={crown} /></span>
    </Link>
  );
}

const row = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] as const } },
};

export default function LeaderboardPage() {
  const { data: session, status } = useSession();
  const myId = (session?.user as { id?: string } | undefined)?.id || null;
  const [leaders, setLeaders] = useState<Leader[] | null>(null);
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    if (status === "loading") return;
    let alive = true;
    fetch(`/api/leaderboard?limit=100${status === "authenticated" ? "&me=1" : ""}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setLeaders(Array.isArray(d.leaders) ? d.leaders : []);
        setMe(d.me ?? null);
      })
      .catch(() => { if (alive) setLeaders([]); });
    return () => { alive = false; };
  }, [status]);

  const top = leaders?.slice(0, 3) ?? [];
  const rest = leaders?.slice(3) ?? [];
  const ahead = me?.rank && me.rank > 1 && leaders ? leaders[me.rank - 2] : null;
  const gap = ahead && me ? Math.max(1, ahead.xp - me.xp + 1) : 0;

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 pb-24 pt-4 lg:px-0 lg:pb-10">
      {/* ─── Гарчиг + "Таны байр" нэг мөрөнд ─── */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-stretch lg:justify-between">
        <div className="lg:self-center">
          <div className="flex items-center gap-2.5 text-white">
            <Icon name="chart" size={24} />
            <h1 className="text-[26px] font-bold leading-tight text-white">Тэргүүлэгчид</h1>
          </div>
          <p className="mt-1 text-[13px] text-[#9C9CA6]">Сүүлийн 7 хоногт хуримтлуулсан XP · топ 100</p>
        </div>

        {status === "authenticated" && me && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center gap-4 rounded-[4px] px-4 py-3 lg:min-w-[420px]"
            style={{ ...neonCard, ...gridBg }}
          >
            <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-[4px]" style={{ background: "rgba(46,41,255,0.12)", border: `1px solid ${NEON}55` }}>
              <span className="text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: NEON_INK }}>Байр</span>
              <span className="text-[22px] font-black leading-none text-white" style={{ textShadow: `0 0 12px ${NEON}aa` }}>
                {me.rank ? `#${me.rank}` : "—"}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[17px] font-black leading-tight text-white">
                {me.rank ? <>Та <span style={{ color: NEON_INK }}>#{me.rank}</span> байна</> : "Энэ долоо хоногт XP алга"}
              </div>
              <div className="mt-0.5 text-[12.5px] leading-snug text-[#C9C9D1]">
                {!me.rank
                  ? "Reel нийтэлж, даалгавар гүйцэтгээд жагсаалтад ор."
                  : me.rank === 1
                    ? `Тэргүүлж байна — ${me.total} хүнээс. Байраа хамгаал.`
                    : `#${me.rank - 1}-д ${gap.toLocaleString()} XP дутуу · ${me.total} хүнээс`}
              </div>
            </div>
            {me.rank ? <XpPill xp={me.xp} strong /> : (
              <Link href="/posts/new" className="press shrink-0 rounded-[4px] px-3.5 py-2 text-[13px] font-bold" style={{ background: NEON, color: "#FFFFFF" }}>
                Эхлэх
              </Link>
            )}
          </motion.div>
        )}
      </div>

      {leaders === null ? (
        <div className="grid grid-cols-3 items-start gap-3">
          {[18, 0, 34].map((m, i) => (
            <div key={i} className="h-[200px] rounded-[4px] skeleton-brand" style={{ marginTop: m }} />
          ))}
        </div>
      ) : leaders.length === 0 ? (
        <div className="rounded-[4px] px-5 py-8 text-center" style={neonCard}>
          <p className="text-[14px] text-[#E2E4E8]">Энэ долоо хоногт XP хуримтлуулсан хүн бүртгэгдээгүй.</p>
          <p className="mt-1.5 text-[13px] text-[#E2E4E8]">Даалгавар гүйцэтгэвэл эндээс хамгийн анх нь харагдана.</p>
        </div>
      ) : (
        <>
          {/* ─── ИНДЭР: #2 · #1 · #3 ─── */}
          <div className="grid grid-cols-3 items-start gap-2.5 pt-3 sm:gap-4">
            {top[1] ? <PodiumCard l={top[1]} place={2} lift={18} /> : <div />}
            {top[0] && <PodiumCard l={top[0]} place={1} lift={0} />}
            {top[2] ? <PodiumCard l={top[2]} place={3} lift={34} /> : <div />}
          </div>

          {/* ─── 4–100 — ширээн дээр 2 багана ─── */}
          {rest.length > 0 && (
            <motion.ol
              initial="hidden"
              animate="show"
              variants={{ show: { transition: { staggerChildren: 0.02 } } }}
              className="mt-6 grid gap-2 lg:grid-cols-2"
            >
              {rest.map((l, i) => {
                const rank = i + 4;
                const mine = l._id === myId;
                return (
                  <motion.li key={l._id} variants={row}>
                    <Link
                      href={`/profile/${l._id}`}
                      className="flex items-center gap-3 rounded-[4px] px-3.5 py-2.5 transition hover:brightness-125"
                      style={mine ? neonCard : quietRow}
                    >
                      <span className="w-7 shrink-0 text-center text-[14px] font-bold tabular-nums" style={{ color: mine ? NEON_INK : "var(--t-sub, #9C9CA6)" }}>
                        {rank}
                      </span>
                      <Avatar l={l} size={36} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14.5px] font-semibold text-white">
                          {l.name}{mine && <span className="ml-1.5 text-[12px] font-bold" style={{ color: NEON_INK }}>· Та</span>}
                        </span>
                        {l.username && <span className="block truncate text-[11.5px] text-[#9C9CA6]">@{l.username}</span>}
                      </span>
                      <XpPill xp={l.xp} />
                    </Link>
                  </motion.li>
                );
              })}
            </motion.ol>
          )}
        </>
      )}
    </div>
  );
}
