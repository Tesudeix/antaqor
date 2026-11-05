"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

/* ─── ХҮРЭЭЛЭЛ — /circles ──────────────────────────────────────────────
   Жагсаалт нь витрин: нэвтрэхгүйгээр харагдана. Нэгдэх нь нэвтрэлт
   шаардана — тэр үед л "хэн нэгдсэн" гэдэг утгатай болно.

   Өнгө: ганц өргөлт (#2E29FF) + харанхуй суурь. */

const INK = "var(--t-ink, #F2F2F4)";
const SUB = "var(--t-sub, #9C9CA6)";
const LINE = "var(--t-line, rgba(255,255,255,0.12))";
const SURFACE = "var(--t-surface, #171320)";

export interface Circle {
  id: string; slug: string; name: string; tagline: string;
  desc: string; cover: string; accent: string;
  memberCount: number; joined: boolean;
}

export default function Circles() {
  const [circles, setCircles] = useState<Circle[] | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    const d = await fetch("/api/circles").then((r) => r.json()).catch(() => ({ circles: [] }));
    setCircles(Array.isArray(d.circles) ? d.circles : []);
    setLoggedIn(!!d.loggedIn);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function toggle(c: Circle) {
    if (!loggedIn) { location.href = "/auth/signin"; return; }
    setBusy(c.slug);
    /* Шууд дэлгэцэн дээр нь эргүүлнэ — сүлжээ удаан байхад товч
       хөдөлгөөнгүй байвал хүн дахин дарж, хоёр хүсэлт явуулна. */
    setCircles((prev) => prev && prev.map((x) => x.slug === c.slug
      ? { ...x, joined: !x.joined, memberCount: x.memberCount + (x.joined ? -1 : 1) } : x));
    try {
      await fetch("/api/circles", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: c.slug, action: c.joined ? "leave" : "join" }),
      });
    } finally { setBusy(""); void load(); }
  }

  if (circles === null) {
    return <div className="flex min-h-[50vh] items-center justify-center">
      <div className="h-2 w-2 animate-pulse rounded-full" style={{ background: "#2E29FF" }} />
    </div>;
  }

  return (
    <div className="mx-auto w-full max-w-[760px] px-4 pb-16 pt-2 md:px-0">
      <p className="text-[11px] font-bold uppercase" style={{ color: "var(--accent-ink, #2E29FF)", letterSpacing: "0.16em" }}>
        Хүрээлэл
      </p>
      <h1 className="mt-1.5 text-[28px] font-extrabold leading-[1.15] md:text-[34px]" style={{ color: INK }}>
        Өөрийн хүрээллээ сонго
      </h1>
      <p className="mt-2 text-[14px] leading-[1.7]" style={{ color: SUB }}>
        Хүрээлэл бүр өөрийн урсгалтай. Нэгдсэнээр тэндээ бичиж, бусдынхыг уншина.
      </p>

      {circles.length === 0 && (
        <p className="mt-8 text-[14px]" style={{ color: SUB }}>Хүрээлэл хараахан нэмэгдээгүй байна.</p>
      )}

      <div className="mt-7 grid gap-4">
        {circles.map((c) => (
          <article key={c.slug} className="overflow-hidden"
            style={{ borderRadius: 4, border: `1px solid ${c.joined ? "rgba(46,41,255,0.5)" : LINE}`, background: SURFACE }}>
            <div style={{ height: 3, background: c.accent }} aria-hidden />

            {c.cover && (
              <Link href={`/circles/${c.slug}`} className="block" style={{ aspectRatio: "16/7", overflow: "hidden" }}>
                <img src={c.cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </Link>
            )}

            <div className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <Link href={`/circles/${c.slug}`} className="block">
                    <h2 className="truncate text-[21px] font-extrabold leading-[1.2]" style={{ color: INK }}>{c.name}</h2>
                  </Link>
                  {c.tagline && <p className="mt-1 text-[13px]" style={{ color: c.accent }}>{c.tagline}</p>}
                </div>
                <span className="shrink-0 text-[12px] tabular-nums" style={{ color: SUB }}>
                  {c.memberCount} гишүүн
                </span>
              </div>

              {c.desc && <p className="mt-3 line-clamp-2 text-[13.5px] leading-[1.6]" style={{ color: SUB }}>{c.desc}</p>}

              <div className="mt-5 flex gap-2">
                <button
                  onClick={() => void toggle(c)}
                  disabled={busy === c.slug}
                  aria-pressed={c.joined}
                  className="font-bold transition disabled:opacity-50"
                  style={{
                    minHeight: 44, padding: "0 18px", borderRadius: 4, fontSize: 13,
                    background: c.joined ? "transparent" : "#2E29FF",
                    color: c.joined ? "#2E29FF" : "#0A0A0A",
                    border: c.joined ? "1px solid rgba(46,41,255,0.5)" : "1px solid transparent",
                  }}
                >
                  {c.joined ? "✓ Нэгдсэн" : loggedIn ? "Нэгдэх" : "Нэвтэрч нэгдэх"}
                </button>
                <Link href={`/circles/${c.slug}`}
                  className="grid place-content-center font-bold transition"
                  style={{ minHeight: 44, padding: "0 18px", borderRadius: 4, fontSize: 13, border: `1px solid ${LINE}`, color: INK }}>
                  Нээх →
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
