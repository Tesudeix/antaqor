"use client";

// AI STUDIO — Higgsfield-style video flow creator + social feed. (/ai)
// Flow: choose AI engine → camera-motion preset → prompt/image → generate.
// Below: a social-media feed of everyone's creations (like, autoplay on hover).

import { useSession } from "next-auth/react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";

const BRAND = "#1080CA";
const CYAN = "#22D3EE";

// ── Engines (Seedance 2 via PiAPI) ──
const ENGINES = [
  { id: "mini", name: "Seedance 2", tag: "MINI", desc: "Хурдан · туршилтад", live: true },
  { id: "fast", name: "Seedance 2", tag: "FAST", desc: "Тэнцвэртэй хурд/чанар", live: true },
  { id: "pro", name: "Seedance 2", tag: "PRO", desc: "Кино чанар · 1080p хүртэл", live: true },
] as const;

// ── Camera-motion presets (ids must match the server) ──
const PRESETS = [
  { id: "", emoji: "✨", label: "Чөлөөт" },
  { id: "crash_zoom", emoji: "⚡", label: "Crash Zoom" },
  { id: "dolly_in", emoji: "🎬", label: "Dolly In" },
  { id: "dolly_out", emoji: "🌆", label: "Dolly Out" },
  { id: "orbit_360", emoji: "🌀", label: "360 Orbit" },
  { id: "fpv_drone", emoji: "🚁", label: "FPV Drone" },
  { id: "bullet_time", emoji: "🕶️", label: "Bullet Time" },
  { id: "slow_mo", emoji: "🐌", label: "Slow Motion" },
  { id: "handheld", emoji: "🎥", label: "Handheld" },
  { id: "crane_up", emoji: "🏗️", label: "Crane Up" },
  { id: "close_up", emoji: "👁️", label: "Close-up" },
  { id: "zoom_earth", emoji: "🌍", label: "Earth Zoom" },
  { id: "static_cine", emoji: "🎞️", label: "Cinematic" },
];

interface Creation {
  _id: string; userName: string; userAvatar: string; prompt: string;
  presetId: string; presetLabel: string; engine: string;
  inputType: string; imageUrl: string; aspectRatio: "16:9" | "9:16" | "1:1";
  duration: string; status: "processing" | "done" | "failed";
  videoUrl: string; error: string; likeCount: number; liked: boolean; mine: boolean;
  createdAt: string;
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "саяхан";
  if (s < 3600) return `${Math.floor(s / 60)} мин`;
  if (s < 86400) return `${Math.floor(s / 3600)} цаг`;
  return `${Math.floor(s / 86400)} өдөр`;
}

const AR_CLASS: Record<string, string> = { "9:16": "aspect-[9/16]", "1:1": "aspect-square", "16:9": "aspect-video" };

export default function AiStudioPage() {
  const { data: session } = useSession();

  // composer
  const [engine, setEngine] = useState<"mini" | "fast" | "pro">("mini");
  const [resolution, setResolution] = useState<"480p" | "720p" | "1080p">("720p");
  const [presetId, setPresetId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16" | "1:1">("9:16");
  const [duration, setDuration] = useState<"5" | "10">("5");
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // feed
  const [scope, setScope] = useState<"all" | "mine">("all");
  const [items, setItems] = useState<Creation[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [feedErr, setFeedErr] = useState("");

  const loadFeed = useCallback(async (sc: "all" | "mine") => {
    setFeedErr("");
    try {
      const res = await fetch(`/api/ai/feed?scope=${sc}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Алдаа");
      setItems(d.items); setHasMore(d.hasMore);
    } catch (e) { setFeedErr(e instanceof Error ? e.message : "Алдаа"); }
  }, []);

  useEffect(() => { setItems(null); loadFeed(scope); }, [scope, loadFeed]);

  const loadMore = async () => {
    if (!items?.length) return;
    setLoadingMore(true);
    try {
      const before = items[items.length - 1].createdAt;
      const res = await fetch(`/api/ai/feed?scope=${scope}&before=${encodeURIComponent(before)}`);
      const d = await res.json();
      if (res.ok) { setItems([...items, ...d.items]); setHasMore(d.hasMore); }
    } finally { setLoadingMore(false); }
  };

  // Poll own processing creations every 8s until done/failed.
  useEffect(() => {
    const pending = (items || []).filter((c) => c.mine && c.status === "processing");
    if (!pending.length) return;
    const t = setInterval(async () => {
      for (const p of pending) {
        try {
          const res = await fetch(`/api/ai/creations/${p._id}`);
          const d = await res.json();
          if (res.ok && d.creation.status !== "processing") {
            setItems((prev) => prev?.map((c) => (c._id === p._id ? { ...c, ...d.creation } : c)) || null);
          }
        } catch { /* retry next tick */ }
      }
    }, 8000);
    return () => clearInterval(t);
  }, [items]);

  const pickImage = async (file: File) => {
    setUploading(true); setErr("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Upload алдаа");
      setImageUrl(d.url);
    } catch (e) { setErr(e instanceof Error ? e.message : "Upload алдаа"); }
    finally { setUploading(false); }
  };

  const generate = async () => {
    setErr("");
    if (!prompt.trim() && !imageUrl) { setErr("Тайлбар бичих эсвэл зураг оруулна уу"); return; }
    setCreating(true);
    try {
      const res = await fetch("/api/ai/create", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, imageUrl, presetId, engine, duration, aspectRatio, resolution }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Алдаа");
      
      setItems((prev) => [{ ...d.creation, liked: false, mine: true }, ...(prev || [])]);
      setPrompt(""); setImageUrl("");
      if (scope === "mine") loadFeed("mine");
    } catch (e) { setErr(e instanceof Error ? e.message : "Алдаа"); }
    finally { setCreating(false); }
  };

  const toggleLike = async (c: Creation) => {
    if (!session) return;
    setItems((prev) => prev?.map((x) => x._id === c._id
      ? { ...x, liked: !c.liked, likeCount: c.likeCount + (c.liked ? -1 : 1) } : x) || null);
    try { await fetch(`/api/ai/creations/${c._id}/like`, { method: "POST" }); }
    catch { /* optimistic */ }
  };

  const remove = async (c: Creation) => {
    if (!confirm("Энэ бүтээлийг устгах уу?")) return;
    setItems((prev) => prev?.filter((x) => x._id !== c._id) || null);
    try { await fetch(`/api/ai/creations/${c._id}`, { method: "DELETE" }); } catch { /* gone */ }
  };

  return (
    <div className="relative mx-auto max-w-5xl px-4 py-6">
      {/* backdrop */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px]"
        style={{ background: "radial-gradient(60% 60% at 50% 0%, rgba(16,128,202,0.14), transparent 65%)" }} />

      {/* ── Hero ── */}
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="relative mb-6 text-center">
        <div className="inline-flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.3em]" style={{ color: BRAND }}>
          <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: BRAND }} />
          ANTAQOR // AI STUDIO
        </div>
        <h1 className="mt-3 text-[34px] font-black leading-tight sm:text-[44px]" style={{ color: "#E8E8E8", fontFamily: "var(--font-display)" }}>
          Бодлоо <span style={{ color: BRAND, textShadow: "0 0 30px rgba(16,128,202,0.45)" }}>видео</span> болго
        </h1>
        <p className="mx-auto mt-2 max-w-md text-[13px]" style={{ color: "#B4B4BA" }}>
          AI сонго → камерын хөдөлгөөн сонго → тайлбарла. 2-5 минутад кино шиг видео.
        </p>
      </motion.div>

      {/* ── Composer ── */}
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
        className="relative border bg-[#0d0d10]/90 p-5 backdrop-blur-xl sm:p-6"
        style={{ borderColor: "rgba(255,255,255,0.1)", boxShadow: "0 0 60px rgba(16,128,202,0.1)" }}>
        {["left-0 top-0 border-l border-t", "right-0 top-0 border-r border-t", "bottom-0 left-0 border-b border-l", "bottom-0 right-0 border-b border-r"].map((c, i) => (
          <span key={i} className={`pointer-events-none absolute h-3 w-3 ${c}`} style={{ borderColor: BRAND }} />
        ))}

        {/* 01 — engine */}
        <StepLabel n="01" t="AI СОНГОХ · SEEDANCE 2" />
        <div className="grid grid-cols-3 gap-2">
          {ENGINES.map((e) => {
            const on = e.live && engine === e.id;
            return (
              <button key={e.id} type="button" disabled={!e.live}
                onClick={() => { if (!e.live) return; setEngine(e.id); if (e.id !== "pro" && resolution === "1080p") setResolution("720p"); }}
                className="border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-40"
                style={{ borderColor: on ? BRAND : "rgba(255,255,255,0.1)", background: on ? "rgba(16,128,202,0.08)" : "transparent" }}>
                <div className="font-mono text-[8px] font-bold uppercase tracking-[0.2em]" style={{ color: on ? BRAND : "#56565E" }}>{e.tag}</div>
                <div className="mt-0.5 text-[13px] font-bold" style={{ color: on ? "#E8E8E8" : "#B4B4BA" }}>{e.name}</div>
                <div className="text-[10px]" style={{ color: "#8A8A92" }}>{e.desc}</div>
              </button>
            );
          })}
        </div>

        {/* 02 — camera motion */}
        <StepLabel n="02" t="КАМЕРЫН ХӨДӨЛГӨӨН" className="mt-5" />
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" style={{ scrollbarWidth: "none" }}>
          {PRESETS.map((p) => {
            const on = presetId === p.id;
            return (
              <button key={p.id || "free"} type="button" onClick={() => setPresetId(p.id)}
                className="flex shrink-0 items-center gap-1.5 border px-3 py-2 text-[11px] font-bold transition"
                style={{
                  borderColor: on ? BRAND : "rgba(255,255,255,0.1)",
                  background: on ? "rgba(16,128,202,0.1)" : "rgba(255,255,255,0.02)",
                  color: on ? "#E8E8E8" : "#8A8A92",
                  boxShadow: on ? "0 0 18px rgba(16,128,202,0.25)" : "none",
                }}>
                <span>{p.emoji}</span>{p.label}
              </button>
            );
          })}
        </div>

        {/* 03 — prompt + image */}
        <StepLabel n="03" t="ТАЙЛБАР + ЗУРАГ (ЗААВАЛ БИШ)" className="mt-5" />
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} maxLength={2000}
          placeholder="Жишээ: нар жаргах үед Улаанбаатарын гудамжаар алхаж буй cyberpunk хувцастай залуу, неон гэрэл…"
          className="w-full border bg-[#0a0a0c] px-3 py-2.5 text-[13px] outline-none transition placeholder:text-[#56565E] focus:border-[rgba(16,128,202,0.5)]"
          style={{ borderColor: "rgba(255,255,255,0.1)", color: "#E8E8E8" }} />

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input ref={fileRef} type="file" accept="image/*" hidden
            onChange={(e) => e.target.files?.[0] && pickImage(e.target.files[0])} />
          {imageUrl ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="" className="h-14 w-14 border object-cover" style={{ borderColor: "rgba(255,255,255,0.15)" }} />
              <button onClick={() => setImageUrl("")}
                className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white"
                style={{ background: BRAND }}>✕</button>
            </div>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
              className="border border-dashed px-3 py-2 text-[11px] font-bold transition hover:border-[rgba(255,255,255,0.3)]"
              style={{ borderColor: "rgba(255,255,255,0.15)", color: "#8A8A92" }}>
              {uploading ? "Хуулж байна…" : "🖼 Эхлэл зураг нэмэх"}
            </button>
          )}

          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            {(["9:16", "1:1", "16:9"] as const).map((ar) => (
              <MiniChip key={ar} on={aspectRatio === ar} onClick={() => setAspectRatio(ar)}>{ar}</MiniChip>
            ))}
            <span className="mx-1 h-4 w-px" style={{ background: "rgba(255,255,255,0.1)" }} />
            {(["5", "10"] as const).map((d) => (
              <MiniChip key={d} on={duration === d} onClick={() => setDuration(d)}>{d}с</MiniChip>
            ))}
            <span className="mx-1 h-4 w-px" style={{ background: "rgba(255,255,255,0.1)" }} />
            {(["480p", "720p", "1080p"] as const).map((r) => {
              const allowed = r !== "1080p" || engine === "pro";
              return (
                <MiniChip key={r} on={resolution === r} onClick={() => allowed && setResolution(r)} dim={!allowed}>
                  {r}
                </MiniChip>
              );
            })}
          </div>
        </div>

        <AnimatePresence>
          {err && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mt-3 border-l-2 px-3 py-2 text-[11px]"
              style={{ borderColor: BRAND, background: "rgba(16,128,202,0.07)", color: BRAND }}>
              {err}
            </motion.div>
          )}
        </AnimatePresence>

        {/* generate row */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <span className="border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.15em]"
              style={{ borderColor: "rgba(34,211,238,0.4)", color: CYAN, background: "rgba(34,211,238,0.06)" }}>
              ҮНЭГҮЙ · BETA
            </span>
            <span style={{ color: "#56565E" }}>өдөрт 8 видео</span>
          </div>
          {session ? (
            <button onClick={generate} disabled={creating || uploading}
              className="group relative ml-auto overflow-hidden px-7 py-3 text-[13px] font-black uppercase tracking-[0.06em] text-white transition disabled:opacity-60"
              style={{ background: BRAND, boxShadow: "0 0 24px rgba(16,128,202,0.3)" }}>
              <span className="relative z-10">{creating ? "Үүсгэж байна…" : "⚡ Видео үүсгэх"}</span>
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            </button>
          ) : (
            <Link href="/auth/signup"
              className="ml-auto px-7 py-3 text-[13px] font-black uppercase text-white"
              style={{ background: BRAND }}>
              Нэвтэрч эхлэх →
            </Link>
          )}
        </div>
      </motion.div>

      {/* ── Feed ── */}
      <div className="relative mt-10">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.25em]" style={{ color: "#8A8A92" }}>
            <span className="h-1 w-1 rounded-full" style={{ background: CYAN }} />
            УРСГАЛ
          </div>
          <div className="flex gap-1">
            {([["all", "Бүгд"], ["mine", "Минийх"]] as const).map(([v, l]) => (
              <button key={v} onClick={() => setScope(v)}
                className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-[2px] transition"
                style={{ color: scope === v ? BRAND : "#56565E", background: scope === v ? "rgba(16,128,202,0.08)" : "transparent" }}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {feedErr ? (
          <div className="border p-8 text-center" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
            <p className="text-[12px]" style={{ color: BRAND }}>{feedErr}</p>
            <button onClick={() => loadFeed(scope)} className="mt-3 border px-4 py-2 text-[11px] font-bold" style={{ borderColor: "rgba(255,255,255,0.15)", color: "#8A8A92" }}>Дахин ачаалах</button>
          </div>
        ) : items === null ? (
          <div className="columns-2 gap-3 sm:columns-3 [&>div]:mb-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className={`break-inside-avoid animate-pulse border bg-[rgba(255,255,255,0.03)] ${i % 3 === 0 ? "aspect-[9/16]" : i % 3 === 1 ? "aspect-square" : "aspect-video"}`}
                style={{ borderColor: "rgba(255,255,255,0.06)" }} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="border p-10 text-center" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
            <div className="text-2xl">🎬</div>
            <p className="mt-2 text-[13px] font-bold" style={{ color: "#E8E8E8" }}>
              {scope === "mine" ? "Та одоогоор видео үүсгээгүй байна" : "Урсгал хоосон байна"}
            </p>
            <p className="mt-1 text-[11px]" style={{ color: "#8A8A92" }}>Дээрх студиэс эхний видеогоо үүсгэ — эхний бүтээгч бол!</p>
          </div>
        ) : (
          <>
            <div className="columns-2 gap-3 sm:columns-3 [&>div]:mb-3">
              {items.map((c, i) => (
                <motion.div key={c._id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.04, 0.4) }}
                  className="group relative break-inside-avoid overflow-hidden border bg-[#0d0d10]"
                  style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                  {/* media */}
                  <div className={`relative w-full ${AR_CLASS[c.aspectRatio] || "aspect-[9/16]"}`}>
                    {c.status === "done" && c.videoUrl ? (
                      <video src={c.videoUrl} muted loop playsInline preload="metadata"
                        className="absolute inset-0 h-full w-full object-cover"
                        onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
                        onMouseLeave={(e) => e.currentTarget.pause()}
                        onClick={(e) => { const v = e.currentTarget; if (v.paused) v.play().catch(() => {}); else v.pause(); }} />
                    ) : c.status === "processing" ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2"
                        style={{ background: "linear-gradient(120deg, rgba(16,128,202,0.05), rgba(34,211,238,0.05), rgba(16,128,202,0.05))", backgroundSize: "200% 200%", animation: "aiShimmer 2.4s ease infinite" }}>
                        <span className="h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: BRAND, borderTopColor: "transparent" }} />
                        <span className="font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: "#8A8A92" }}>Боловсруулж байна</span>
                        <span className="text-[9px]" style={{ color: "#56565E" }}>~2-5 мин</span>
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-3 text-center">
                        <span className="text-[11px] font-bold" style={{ color: BRAND }}>Амжилтгүй боллоо</span>
                        <span className="text-[9px]" style={{ color: "#8A8A92" }}>Дахин оролдоно уу</span>
                      </div>
                    )}
                    {c.presetLabel && (
                      <span className="absolute left-2 top-2 border px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[1px] backdrop-blur"
                        style={{ borderColor: "rgba(255,255,255,0.2)", background: "rgba(0,0,0,0.45)", color: "#E8E8E8" }}>
                        {c.presetLabel}
                      </span>
                    )}
                    {c.mine && (
                      <button onClick={() => remove(c)}
                        className="absolute right-2 top-2 hidden h-6 w-6 items-center justify-center rounded-full text-[10px] text-white backdrop-blur group-hover:flex"
                        style={{ background: "rgba(0,0,0,0.55)" }}>✕</button>
                    )}
                  </div>
                  {/* meta */}
                  <div className="flex items-center gap-2 p-2.5">
                    {c.userAvatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.userAvatar} alt="" className="h-6 w-6 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold"
                        style={{ background: "rgba(16,128,202,0.12)", color: BRAND }}>
                        {(c.userName || "?").charAt(0).toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0 flex-1 leading-tight">
                      <div className="truncate text-[11px] font-bold" style={{ color: "#E8E8E8" }}>{c.userName || "Anonymous"}</div>
                      <div className="text-[9px]" style={{ color: "#56565E" }}>{timeAgo(c.createdAt)} · {(c.engine || "").toUpperCase()}</div>
                    </div>
                    <button onClick={() => toggleLike(c)} disabled={!session}
                      className="flex items-center gap-1 text-[11px] font-bold transition disabled:opacity-40"
                      style={{ color: c.liked ? BRAND : "#56565E" }}>
                      <svg className="h-4 w-4" fill={c.liked ? BRAND : "none"} stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                      </svg>
                      {c.likeCount > 0 && c.likeCount}
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
            {hasMore && (
              <div className="mt-5 text-center">
                <button onClick={loadMore} disabled={loadingMore}
                  className="border px-6 py-2.5 text-[11px] font-bold uppercase tracking-[2px] transition hover:border-[rgba(255,255,255,0.3)] disabled:opacity-50"
                  style={{ borderColor: "rgba(255,255,255,0.12)", color: "#8A8A92" }}>
                  {loadingMore ? "Ачаалж байна…" : "Цааш үзэх"}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <style jsx global>{`
        @keyframes aiShimmer { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
      `}</style>
    </div>
  );
}

function StepLabel({ n, t, className = "" }: { n: string; t: string; className?: string }) {
  return (
    <div className={`mb-2 flex items-center gap-2 ${className}`}>
      <span className="font-mono text-[10px] font-black" style={{ color: BRAND }}>{n}</span>
      <span className="font-mono text-[9px] font-bold uppercase tracking-[0.22em]" style={{ color: "#56565E" }}>{t}</span>
      <span className="h-px flex-1" style={{ background: "rgba(255,255,255,0.06)" }} />
    </div>
  );
}

function MiniChip({ children, on, onClick, dim }: { children: ReactNode; on: boolean; onClick: () => void; dim?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={dim}
      className="border px-2.5 py-1.5 font-mono text-[10px] font-bold transition disabled:cursor-not-allowed disabled:opacity-30"
      style={{
        borderColor: on ? BRAND : "rgba(255,255,255,0.1)",
        background: on ? "rgba(16,128,202,0.1)" : "transparent",
        color: on ? "#E8E8E8" : "#56565E",
      }}>
      {children}
    </button>
  );
}
