"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PostCard from "@/components/PostCard";
import type { Circle } from "@/components/Circles";

/* ─── НЭГ ХҮРЭЭЛЭЛ — /circles/[slug] ───────────────────────────────────
   Толгой + тухайн хүрээллийн урсгал. Пост нь `Post.circle` талбараар
   хамаарах бөгөөд нийтийн урсгалд ГАРАХГҮЙ — /api/posts нь circle
   заагаагүй үед хоосон circle-тэйг л буцаана. */

const INK = "var(--t-ink, #F2F2F4)";
const SUB = "var(--t-sub, #9C9CA6)";
const LINE = "var(--t-line, rgba(255,255,255,0.12))";
const SURFACE = "var(--t-surface, #171320)";

interface Post { _id: string; content: string; likes: string[]; [k: string]: unknown }

export default function CircleRoom({ slug }: { slug: string }) {
  const [circle, setCircle] = useState<Circle | null | "missing">(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const d = await fetch("/api/circles").then((r) => r.json()).catch(() => ({ circles: [] }));
    const found = (d.circles || []).find((c: Circle) => c.slug === slug);
    setCircle(found || "missing");
    setLoggedIn(!!d.loggedIn);
  }, [slug]);

  const loadPosts = useCallback(async () => {
    const d = await fetch(`/api/posts?circle=${encodeURIComponent(slug)}&limit=30`)
      .then((r) => r.json()).catch(() => ({ posts: [] }));
    setPosts(Array.isArray(d.posts) ? d.posts : []);
  }, [slug]);

  useEffect(() => { void load(); void loadPosts(); }, [load, loadPosts]);

  async function toggleJoin() {
    if (!circle || circle === "missing") return;
    if (!loggedIn) { location.href = "/auth/signin"; return; }
    await fetch("/api/circles", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, action: circle.joined ? "leave" : "join" }),
    });
    void load();
  }

  async function post() {
    if (!text.trim()) return;
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/posts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text.trim(), circle: slug }),
      });
      const d = await res.json();
      if (!res.ok) { setErr(d.error || "Нийтэлж чадсангүй"); return; }
      setText(""); void loadPosts();
    } catch { setErr("Сүлжээний алдаа"); }
    finally { setBusy(false); }
  }

  if (circle === null) {
    return <div className="flex min-h-[50vh] items-center justify-center">
      <div className="h-2 w-2 animate-pulse rounded-full" style={{ background: "#2E29FF" }} />
    </div>;
  }
  if (circle === "missing") {
    return <div className="mx-auto max-w-[760px] px-4 py-16 text-center">
      <p className="text-[15px]" style={{ color: SUB }}>Хүрээлэл олдсонгүй.</p>
      <Link href="/circles" className="mt-4 inline-block text-[14px] font-bold" style={{ color: "var(--accent-ink, #2E29FF)" }}>
        ← Бүх хүрээлэл
      </Link>
    </div>;
  }

  return (
    <div className="mx-auto w-full max-w-[760px] px-4 pb-16 pt-2 md:px-0">
      <Link href="/circles" className="text-[13px] font-semibold" style={{ color: SUB }}>← Хүрээлэл</Link>

      <header className="mt-4 overflow-hidden" style={{ borderRadius: 4, border: `1px solid ${LINE}`, background: SURFACE }}>
        <div style={{ height: 3, background: circle.accent }} aria-hidden />
        {circle.cover && (
          <div style={{ aspectRatio: "16/6", overflow: "hidden" }}>
            <img src={circle.cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        )}
        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-[26px] font-extrabold leading-[1.15]" style={{ color: INK }}>{circle.name}</h1>
              {circle.tagline && <p className="mt-1 text-[13px]" style={{ color: circle.accent }}>{circle.tagline}</p>}
            </div>
            <span className="shrink-0 text-[12px] tabular-nums" style={{ color: SUB }}>{circle.memberCount} гишүүн</span>
          </div>
          {circle.desc && <p className="mt-3 text-[14px] leading-[1.7]" style={{ color: SUB }}>{circle.desc}</p>}

          <button onClick={() => void toggleJoin()} aria-pressed={circle.joined}
            className="mt-5 font-bold transition"
            style={{
              minHeight: 44, padding: "0 20px", borderRadius: 4, fontSize: 13,
              background: circle.joined ? "transparent" : "#2E29FF",
              color: circle.joined ? "#2E29FF" : "#0A0A0A",
              border: circle.joined ? "1px solid rgba(46,41,255,0.5)" : "1px solid transparent",
            }}>
            {circle.joined ? "✓ Нэгдсэн" : loggedIn ? "Нэгдэх" : "Нэвтэрч нэгдэх"}
          </button>
        </div>
      </header>

      {/* Бичих нь ГИШҮҮНД. Нэгдээгүй хүн уншина — нээлттэй байх нь
          хүрээллийг сонирхуулах цорын ганц арга. */}
      {circle.joined && (
        <div className="mt-5 p-4" style={{ borderRadius: 4, border: `1px solid ${LINE}`, background: SURFACE }}>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3}
            placeholder={`${circle.name} дотор юу бичих вэ?`}
            className="w-full resize-y bg-transparent text-[14px] outline-none"
            style={{ color: INK }} />
          {err && <p className="mt-2 text-[12px] font-semibold" style={{ color: "#C81E4A" }}>{err}</p>}
          <div className="mt-3 flex justify-end">
            <button onClick={() => void post()} disabled={busy || !text.trim()}
              className="font-bold transition disabled:opacity-40"
              style={{ minHeight: 44, padding: "0 20px", borderRadius: 4, fontSize: 13, background: "#2E29FF", color: "#FFFFFF" }}>
              {busy ? "Нийтэлж байна…" : "Нийтлэх"}
            </button>
          </div>
        </div>
      )}

      <div className="mt-6">
        {posts === null && <p className="text-[13px]" style={{ color: SUB }}>Ачаалж байна…</p>}
        {posts && posts.length === 0 && (
          <p className="py-10 text-center text-[14px]" style={{ color: SUB }}>
            {circle.joined ? "Эхний постыг чи бич." : "Одоогоор пост алга."}
          </p>
        )}
        {posts?.map((p) => (
          <PostCard key={p._id} post={p as never} />
        ))}
      </div>
    </div>
  );
}
