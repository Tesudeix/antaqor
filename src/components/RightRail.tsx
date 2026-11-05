"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { openAuth } from "@/components/AuthModal";
import { useMembership } from "@/lib/useMembership";
import CreditPill from "@/components/CreditPill";

/* ─── Баруун багана — X маяг (2026-10-11 v2) ───────────────────────────────
   Дээрээс доош (X-ийн дараалал, Antaqor-ийн утгаар):
     1. Хайлт — хүмүүс + Magazine (/api/search), live dropdown
     2. "Гишүүн болох" — X Premium-ийн байр; гишүүн/админд нуугдана
     3. "Сүүлийн мэдээ" — Magazine-ийн шинэ 3 нийтлэл (хааж болно)
     4. "Юу болж байна" — идэвхтэй ангиллууд (зөвхөн тоо)
     5. "Дагах хүмүүс"
   Өгөгдөл: /api/rail. Карт бүр 4px булан, нэг хүрээ — X шиг "хөвөгч" биш. */

type News = { title: string; href: string; category: string; cover: string; at: string; views: number };
type Trend = { label: string; title: string; meta: string; href: string };
type Suggest = { _id: string; name: string; username: string; avatar: string; member: boolean };
type Hit = { people: { _id: string; name: string; username: string; avatar: string }[]; articles: { title: string; href: string; category: string }[] };

const LINE = "border-[color:var(--t-line,rgba(255,255,255,0.12))]";
const CARD = `overflow-hidden rounded-[4px] border ${LINE}`;
const ROW = "transition hover:bg-[rgba(46,41,255,0.08)]";

function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))} минутын өмнө`;
  if (s < 86400) return `${Math.floor(s / 3600)} цагийн өмнө`;
  return `${Math.floor(s / 86400)} өдрийн өмнө`;
}
function fmt(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K` : String(n);
}

function Face({ name, avatar, size = 40 }: { name: string; avatar: string; size?: number }) {
  return avatar ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={avatar} alt="" className="shrink-0 rounded-[4px] object-cover" style={{ width: size, height: size }} />
  ) : (
    <span className="flex shrink-0 items-center justify-center rounded-[4px] bg-[#2E29FF] font-extrabold text-[#0A0A0A]" style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}

function Badge() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-[#2E29FF]" fill="currentColor" aria-label="Гишүүн">
      <path d="M12 1.5l2.6 1.9 3.2-.1 1 3 2.6 1.9-1 3.1 1 3.1-2.6 1.9-1 3-3.2-.1L12 22.5l-2.6-1.9-3.2.1-1-3-2.6-1.9 1-3.1-1-3.1 2.6-1.9 1-3 3.2.1z" />
      <path d="M8 12.3l2.6 2.6L16.2 9.3" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── 1. Хайлт ── */
function SearchBox() {
  const [q, setQ] = useState("");
  const [hit, setHit] = useState<Hit | null>(null);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) { setHit(null); return; }
    const id = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(t)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && setHit(d))
        .catch(() => {});
    }, 220);
    return () => clearTimeout(id);
  }, [q]);

  useEffect(() => {
    const off = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", off);
    return () => document.removeEventListener("mousedown", off);
  }, []);

  const empty = hit && !hit.people.length && !hit.articles.length;
  return (
    <div ref={box} className="relative">
      <label className={`flex h-11 items-center gap-2.5 rounded-[4px] border ${LINE} bg-[rgba(46,41,255,0.08)] px-3.5 focus-within:border-[#2E29FF]`}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="shrink-0 text-[#9C9CA6]" aria-hidden>
          <path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4" strokeLinecap="round" />
        </svg>
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
          placeholder="Хайх"
          aria-label="Хүн эсвэл нийтлэл хайх"
          className="min-w-0 flex-1 bg-transparent text-[15px] text-[#F2F2F4] outline-none placeholder:text-[#9C9CA6]"
        />
      </label>
      {open && q.trim().length >= 2 && hit && (
        <div className={`absolute left-0 right-0 top-full z-40 mt-1.5 max-h-[60vh] overflow-y-auto rounded-[4px] border ${LINE} bg-[#141414] py-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.35)]`}>
          {empty && <p className="px-4 py-3 text-[14px] text-[#9C9CA6]">“{q.trim()}” олдсонгүй</p>}
          {hit.people.map((u) => (
            <Link key={u._id} href={`/profile/${u._id}`} onClick={() => setOpen(false)} className={`flex items-center gap-3 px-4 py-2.5 ${ROW}`}>
              <Face name={u.name} avatar={u.avatar} size={36} />
              <span className="min-w-0">
                <span className="block truncate text-[14.5px] font-bold text-[#F2F2F4]">{u.name}</span>
                {u.username && <span className="block truncate text-[13px] text-[#9C9CA6]">@{u.username}</span>}
              </span>
            </Link>
          ))}
          {hit.articles.length > 0 && (
            <div className={`mt-1 border-t ${LINE} pt-1`}>
              {hit.articles.map((a) => (
                <Link key={a.href} href={a.href} onClick={() => setOpen(false)} className={`block px-4 py-2.5 ${ROW}`}>
                  <span className="block text-[12px] text-[#9C9CA6]">Magazine · {a.category}</span>
                  <span className="line-clamp-1 text-[14.5px] font-bold text-[#F2F2F4]">{a.title}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── 2. Гишүүн болох ── */
function JoinCard() {
  const { loading, isMember, isAdmin } = useMembership();
  if (loading || isMember || isAdmin) return null;
  return (
    <section className={`${CARD} px-4 py-4`}>
      <h2 className="text-[20px] font-extrabold leading-tight text-[#F2F2F4]">Гишүүн болох</h2>
      <p className="mt-1.5 text-[15px] leading-[1.45] text-[#E2E4E8]">
        Бүх хичээл, AI хэрэгсэл, гишүүдийн урсгал, баталгаажсан тэмдэг — нэг дор.
      </p>
      <Link href="/pricing" className="press mt-3 inline-flex h-10 items-center rounded-[4px] bg-[#2E29FF] px-5 text-[15px] font-extrabold text-[#0A0A0A] transition hover:bg-[#1F1AD9]">
        Нэгдэх
      </Link>
    </section>
  );
}

/* ── 3. Сүүлийн мэдээ ── */
function NewsCard({ news }: { news: News[] }) {
  const key = `antaqor-news-hide-${new Date().toISOString().slice(0, 10)}`;
  const [hidden, setHidden] = useState(false);
  useEffect(() => { try { setHidden(localStorage.getItem(key) === "1"); } catch { /* storage алга */ } }, [key]);
  if (!news.length || hidden) return null;
  return (
    <section className={CARD} aria-label="Сүүлийн мэдээ">
      <div className="flex items-center justify-between px-4 pb-1 pt-3.5">
        <h2 className="text-[20px] font-extrabold text-[#F2F2F4]">Сүүлийн мэдээ</h2>
        <button type="button" aria-label="Хаах" onClick={() => { setHidden(true); try { localStorage.setItem(key, "1"); } catch { /* storage алга */ } }}
          className="flex h-8 w-8 items-center justify-center rounded-[4px] text-[#F2F2F4] hover:bg-[rgba(46,41,255,0.12)]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden><path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /></svg>
        </button>
      </div>
      {news.map((n) => (
        <Link key={n.href} href={n.href} className={`block px-4 py-3 ${ROW}`}>
          <div className="line-clamp-2 text-[15.5px] font-extrabold leading-snug text-[#F2F2F4]">{n.title}</div>
          <div className="mt-1.5 flex items-center gap-2 text-[13px] text-[#9C9CA6]">
            {n.cover && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={n.cover} alt="" className="h-5 w-5 shrink-0 rounded-[4px] object-cover" />
            )}
            <span className="truncate">{ago(n.at)} · {n.category}{n.views ? ` · ${fmt(n.views)} уншсан` : ""}</span>
          </div>
        </Link>
      ))}
    </section>
  );
}

/* ── 5. Дагах мөр ── */
function FollowRow({ u, loggedIn }: { u: Suggest; loggedIn: boolean }) {
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    if (!loggedIn) { openAuth("signin"); return; }
    if (busy) return;
    setBusy(true);
    setOn((v) => !v);
    try {
      const r = await fetch(`/api/users/${u._id}/follow`, { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error();
      setOn(!!d.following);
    } catch {
      setOn((v) => !v);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${ROW}`}>
      <Link href={`/profile/${u._id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <Face name={u.name} avatar={u.avatar} />
        <span className="min-w-0">
          <span className="flex items-center gap-1">
            <span className="truncate text-[15px] font-extrabold text-[#F2F2F4]">{u.name}</span>
            {u.member && <Badge />}
          </span>
          {u.username && <span className="block truncate text-[14px] text-[#9C9CA6]">@{u.username}</span>}
        </span>
      </Link>
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className={`press h-9 shrink-0 rounded-[4px] px-4 text-[14px] font-bold transition disabled:opacity-60 ${
          on ? "text-[#F2F2F4]" : "hover:opacity-90"
        }`}
        /* X маяг: шөнө цагаан/бараан бичиг, өдөр бараан/цагаан бичиг — inline var тул theme давхарга хүрэхгүй. */
        style={on ? { border: "1px solid var(--l-line-strong, rgba(255,255,255,0.22))" } : { background: "var(--t-ink, #F2F2F4)", color: "var(--t-surface, #0A0A0A)" }}
      >
        {on ? "Дагаж байна" : "Дагах"}
      </button>
    </div>
  );
}

export default function RightRail() {
  const { data: session } = useSession();
  const [data, setData] = useState<{ news: News[]; trends: Trend[]; suggest: Suggest[] } | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/rail")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d) setData(d); })
      .catch(() => {});
    return () => { alive = false; };
  }, [session?.user]);

  return (
    <>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1"><SearchBox /></div>
        {session?.user && <CreditPill />}
      </div>
      <JoinCard />
      {data && (data.trends || []).length > 0 && (
        <section className={CARD} aria-label="Юу болж байна">
          <h2 className="px-4 pb-1 pt-3.5 text-[20px] font-extrabold text-[#F2F2F4]">Юу болж байна</h2>
          {data.trends.map((t, i) => (
            <Link key={t.title + i} href={t.href} className={`block px-4 py-3 ${ROW}`}>
              <div className="text-[13px] text-[#9C9CA6]">{t.label}</div>
              <div className="text-[15.5px] font-extrabold text-[#F2F2F4]">{t.title}</div>
              {t.meta && <div className="text-[13px] text-[#9C9CA6]">{t.meta}</div>}
            </Link>
          ))}
        </section>
      )}
      {data && (data.suggest || []).length > 0 && (
        <section className={CARD} aria-label="Дагах хүмүүс">
          <h2 className="px-4 pb-1 pt-3.5 text-[20px] font-extrabold text-[#F2F2F4]">Дагах хүмүүс</h2>
          {data.suggest.map((u) => <FollowRow key={u._id} u={u} loggedIn={!!session?.user} />)}
          <Link href="/leaderboard" className="block px-4 pb-4 pt-2 text-[15px] text-[#2E29FF] hover:underline">Цааш үзэх</Link>
        </section>
      )}
      <p className="px-1 pb-4 text-[12.5px] leading-relaxed text-[#9C9CA6]">
        <Link href="/partnerships" className="hover:underline">Хамтын ажиллагаа</Link> · <Link href="/privacy-policy" className="hover:underline">Нууцлал</Link> · © {new Date().getFullYear()} Antaqor
      </p>
    </>
  );
}
