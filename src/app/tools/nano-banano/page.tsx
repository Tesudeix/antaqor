"use client";

import { isAdminEmail } from "@/lib/adminClient";
import AiBudgetPill from "@/components/AiBudgetPill";
import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CreditIcon } from "@/components/CreditIcon";
import { emitXPFromResponse } from "@/lib/xpToast";
import { openAuth } from "@/components/AuthModal";
import { AI_VIDEO_ENABLED } from "@/lib/flags";

/* ─── AI ЗУРАГ СТУДИ (2026-10-13 шинэчлэл) ────────────────────────────────
   Видео студитэй ИЖИЛ бүтэц (Higgsfield маяг): зүүнд удирдлагын самбар,
   баруунд бүтээлүүд. Загвар СОНГОНО: Nano Banana 2.1 (Google) эсвэл
   ChatGPT Image (OpenAI gpt-image-2). Лавлах зураг 4 хүртэл.
   Сервер: /api/tools/generate-image (синхрон — URL шууд ирнэ),
   /api/tools/image-history (түүх, PATCH = нийтэлсэн, DELETE). */

const PLACEHOLDERS = [
  "Монгол гэрийн дотор, өглөөний нарны туяа, кино маягийн гэрэл…",
  "Бүтээгдэхүүний студийн зураг, цагаан дэвсгэр, зөөлөн сүүдэр…",
  "Неон гэрэлтэй Улаанбаатарын гудамж, бороотой шөнө…",
  "Минималист постер, том гарчиг, teal ба coral өнгө…",
];

interface ModelOpt { id: string; label: string; sub: string; provider: string }
const STUDIO: ModelOpt[] = [
  { id: "nano2", label: "Nano Banana 2.1", sub: "Google · бодит, хурдан", provider: "gemini" },
  { id: "gpt", label: "ChatGPT Image", sub: "OpenAI · бичиг, дизайн", provider: "openai" },
];
const ASPECTS = ["1:1", "4:3", "3:4", "16:9", "9:16"];

interface Item {
  _id: string;
  url: string;
  prompt: string;
  model: string;
  aspectRatio: string;
  cost: number;
  shared?: boolean;
  pending?: boolean;
}

const LINE = "border-[color:var(--t-line,rgba(255,255,255,0.12))]";
const PANEL = `rounded-[4px] border ${LINE} bg-[#141414]`;

function Svg({ d, size = 18 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}
const I = {
  ratio: "M7 3h10v18H7z",
  hd: "M3 5h18v14H3zM7 9v6M7 12h3M10 9v6M14 9v6h2a3 3 0 0 0 0-6z",
  plus: "M12 5v14M5 12h14",
  x: "M6 6l12 12M18 6L6 18",
  spark: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z",
  download: "M12 4v12M7 11l5 5 5-5M5 20h14",
  share: "M4 12v7h16v-7M12 3v12M8 7l4-4 4 4",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
  reuse: "M4 12a8 8 0 0 1 14-5.3M20 4v5h-5M20 12a8 8 0 0 1-14 5.3M4 20v-5h5",
};

export default function ImageStudioPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center"><div className="h-2 w-2 animate-pulse rounded-full bg-[#2E29FF]" /></div>}>
      <ImageStudio />
      <AiBudgetPill focus="image" />
    </Suspense>
  );
}

function ImageStudio() {
  const { status, data: sessionData } = useSession();
  const searchParams = useSearchParams();
  /* 2026-10-19: эзэн бүтээмэгц feed + Threads-д давхар нийтэлж болно (брэндийн хаяг — бусдад серверт хаалттай) */
  const isOwner = isAdminEmail(sessionData?.user?.email);
  const [autoThreads, setAutoThreads] = useState(false);
  useEffect(() => { try { setAutoThreads(localStorage.getItem("aq_auto_threads") === "1"); } catch { /* */ } }, []);

  const [model, setModel] = useState("nano2");
  const [aspect, setAspect] = useState("1:1");
  const [hd, setHd] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [refs, setRefs] = useState<string[]>([]);
  const [aspectOpen, setAspectOpen] = useState(false);

  const [costs, setCosts] = useState<Record<string, number>>({ nano2: 10, gpt: 15 });
  const [hdMult, setHdMult] = useState(1.5);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [lowCredit, setLowCredit] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [sharing, setSharing] = useState<string | null>(null);
  const [phIdx, setPhIdx] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const cost = Math.max(1, Math.ceil((costs[model] ?? 10) * (hd ? hdMult : 1)));

  useEffect(() => {
    const pq = searchParams?.get("prompt");
    if (pq) setPrompt(pq.slice(0, 4000));
  }, [searchParams]);

  useEffect(() => {
    const t = setInterval(() => setPhIdx((i) => (i + 1) % PLACEHOLDERS.length), 5200);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const off = (e: MouseEvent) => { if (panelRef.current && !panelRef.current.contains(e.target as Node)) setAspectOpen(false); };
    document.addEventListener("mousedown", off);
    return () => document.removeEventListener("mousedown", off);
  }, []);

  useEffect(() => {
    fetch("/api/tools/image-pricing").then((r) => r.json()).then((d) => {
      if (d?.costs) setCosts(d.costs);
      if (typeof d?.hdMultiplier === "number") setHdMult(d.hdMultiplier);
    }).catch(() => {});
  }, []);

  const refreshBalance = useCallback(() => {
    fetch("/api/credits").then((r) => r.json()).then((d) => { if (typeof d.balance === "number") setBalance(d.balance); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    refreshBalance();
    fetch("/api/tools/image-history?limit=30").then((r) => r.json()).then((d) => {
      if (Array.isArray(d.items)) setItems(d.items.filter((x: Item) => x.url));
    }).catch(() => {});
  }, [status, refreshBalance]);

  /* 2026-10-18: 10 хүртэл лавлах зураг. Зураг бүрийг браузерт ≤1600px JPEG
     болгоно — 10 утасны зураг ~80MB биш ~3–5MB болж илгээгдэнэ, AI-д ч ялгаагүй. */
  const MAX_REFS = 10;
  const shrink = (f: File): Promise<string> => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 1600 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      const g = c.getContext("2d"); if (!g) { URL.revokeObjectURL(url); reject(new Error("canvas")); return; }
      g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL(f.type === "image/png" && k === 1 && f.size < 1.5e6 ? "image/png" : "image/jpeg", 0.88));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Зураг уншигдсангүй")); };
    img.src = url;
  });
  const addRefs = (files: FileList | File[] | null | undefined) => {
    if (!files) return;
    const room = MAX_REFS - refs.length;
    const all = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (all.length > room) setErr(`Хамгийн ихдээ ${MAX_REFS} зураг — эхний ${Math.max(0, room)}-ийг нэмлээ`);
    for (const f of all.slice(0, Math.max(0, room))) {
      if (f.size > 25 * 1024 * 1024) { setErr("Зураг бүр 25MB-аас бага байх ёстой"); continue; }
      shrink(f).then((d) => setRefs((r) => (r.length < MAX_REFS ? [...r, d] : r))).catch(() => setErr("Зураг уншигдсангүй — PNG, JPG, WEBP оруулна уу"));
    }
  };
  /* Ctrl/⌘+V — хуулсан зургийг шууд лавлах болгоно */
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files || []).filter((f) => f.type.startsWith("image/"));
      if (files.length) { e.preventDefault(); addRefs(files); }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  });
  const modelMax = model === "nano" || model === "nanoLite" ? 3 : model === "kling" ? 1 : MAX_REFS;

  const generate = async () => {
    if (status !== "authenticated") { openAuth("signin"); return; }
    if (busy || !prompt.trim()) return;
    setErr(""); setLowCredit(false); setBusy(true); setAspectOpen(false);
    const tempId = `tmp-${Date.now()}`;
    setItems((prev) => [{ _id: tempId, url: "", prompt: prompt.trim(), model, aspectRatio: aspect, cost, pending: true }, ...prev]);
    try {
      const res = await fetch("/api/tools/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(), model, aspectRatio: aspect, resolution: hd ? "hd" : "standard",
          style: "auto", inputImages: refs.length ? refs.slice(0, modelMax) : undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setItems((prev) => prev.filter((x) => x._id !== tempId));
        setErr(d.error || "Алдаа гарлаа");
        if (d.code === "INSUFFICIENT_CREDITS") setLowCredit(true);
        if (typeof d.balance === "number") setBalance(d.balance);
        return;
      }
      if (typeof d.balance === "number") setBalance(d.balance);
      setItems((prev) => prev.map((x) => (x._id === tempId ? { ...x, _id: d.id || tempId, url: d.url, cost: d.cost, pending: false } : x)));
      if (isOwner && autoThreads && d.url) void share({ _id: d.id || tempId, url: d.url, prompt: prompt.trim(), model, aspectRatio: aspect, cost: d.cost } as Item, true);
    } catch {
      setItems((prev) => prev.filter((x) => x._id !== tempId));
      setErr("Сүлжээний алдаа");
    } finally {
      setBusy(false);
    }
  };

  const share = async (it: Item, toThreads = isOwner && autoThreads) => {
    if (sharing && !toThreads) return;
    setSharing(it._id);
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: `${(it.prompt || "AI зураг").slice(0, 380)}\n\n#antaqor #AIзураг`, images: [it.url], category: "бүтээл",
          ...(isOwner && toThreads ? { crosspost: ["threads"] } : {}),
        }),
      });
      const d = await res.json();
      if (!res.ok) { setErr(d.error || "Нийтэлж чадсангүй"); return; }
      emitXPFromResponse(d, "BUILD");
      if (d?.post?._id) {
        fetch("/api/tools/image-history", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: it._id, postId: d.post._id }),
        }).catch(() => {});
      }
      setItems((prev) => prev.map((x) => (x._id === it._id ? { ...x, shared: true } : x)));
    } catch {
      setErr("Сүлжээний алдаа");
    } finally {
      setSharing(null);
    }
  };

  const remove = (id: string) => {
    if (!confirm("Энэ зургийг устгах уу?")) return;
    setItems((prev) => prev.filter((x) => x._id !== id));
    fetch(`/api/tools/image-history?id=${id}`, { method: "DELETE" }).catch(() => {});
  };

  const active = STUDIO.find((m) => m.id === model) || STUDIO[0];

  return (
    <main className="mx-auto w-full max-w-[1180px] px-3 pb-28 pt-3 sm:px-4 lg:pb-10">
      <div className="grid items-start gap-5 lg:grid-cols-[400px_minmax(0,1fr)]">
        {/* ═══ ЗҮҮН: удирдлагын самбар ═══ */}
        <div ref={panelRef} className={`${PANEL} lg:sticky lg:top-4`}>
          <div className={`flex gap-6 border-b ${LINE} px-5 pt-4`}>
            <span className="relative pb-3 text-[17px] font-extrabold text-[#F2F2F4]">
              Зураг үүсгэх
              <span className="absolute inset-x-0 bottom-0 h-[3px] bg-[#F2F2F4]" />
            </span>
            {AI_VIDEO_ENABLED && (
              <Link href="/tools/video" className="pb-3 text-[17px] font-bold text-[#9C9CA6] transition hover:text-[#E2E4E8]">Видео үүсгэх</Link>
            )}
          </div>

          <div className="flex flex-col gap-3 p-4">
            {/* Загвар сонгох — хоёр карт */}
            <div>
              <div className="mb-1.5 text-[13px] font-bold text-[#9C9CA6]">Загвар</div>
              <div className="grid grid-cols-2 gap-2">
                {STUDIO.map((m) => {
                  const on = m.id === model;
                  return (
                    <button key={m.id} type="button" onClick={() => setModel(m.id)} aria-pressed={on}
                      className="relative overflow-hidden rounded-[4px] px-3.5 py-4 text-left transition"
                      style={{
                        border: `1px solid ${on ? "#2E29FF" : "var(--t-line, rgba(255,255,255,0.12))"}`,
                        background: on ? "radial-gradient(120% 120% at 100% 0%, #1E1E1E 0%, #0A0A0A 70%)" : "transparent",
                      }}>
                      <div className="text-[15.5px] font-black leading-tight" style={{ color: on ? "#2E29FF" : undefined }}>
                        <span className={on ? "" : "text-[#F2F2F4]"}>{m.label}</span>
                      </div>
                      <div className="mt-1 text-[12px]" style={{ color: on ? "#30333F" : undefined }}>
                        <span className={on ? "" : "text-[#9C9CA6]"}>{m.sub}</span>
                      </div>
                      <div className="mt-2 inline-flex items-center gap-1 text-[12px] font-bold" style={{ color: on ? "#14151C" : undefined }}>
                        <span className={on ? "" : "text-[#E2E4E8]"}><CreditIcon size={11} /> {costs[m.id] ?? "…"}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Лавлах зураг — 10 хүртэл, чирэх / сонгох / Ctrl+V */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[13px] font-bold text-[#9C9CA6]">Лавлах зураг <span className="font-normal tabular-nums">{refs.length}/{MAX_REFS} · заавал биш</span></span>
                {refs.length > 0 && <button type="button" onClick={() => setRefs([])} className="text-[12px] font-bold text-[#9C9CA6] hover:text-[#FCEE0A]">Цэвэрлэх</button>}
              </div>
              <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); addRefs(e.dataTransfer.files); }}
                className={`flex min-h-[96px] flex-wrap items-center gap-2 rounded-[4px] border-2 border-dashed ${LINE} p-3`}>
                {refs.length < MAX_REFS && (
                  <button type="button" onClick={() => fileRef.current?.click()} aria-label="Зураг нэмэх"
                    className="flex h-[68px] w-[68px] items-center justify-center rounded-[4px] bg-[rgba(46,41,255,0.12)] text-[#9C9CA6] transition hover:text-[#2E29FF]">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full border border-current"><Svg d={I.plus} size={14} /></span>
                  </button>
                )}
                {refs.map((src, i) => (
                  <div key={i} className={`relative h-[68px] w-[68px] overflow-hidden rounded-[4px] transition-opacity ${i >= modelMax ? "opacity-35" : ""}`} title={i >= modelMax ? "Энэ загвар энэ зургийг ашиглахгүй" : `Лавлах ${i + 1}`}>
                    <span className="absolute bottom-1 left-1 z-[1] rounded-[3px] bg-black/65 px-1 text-[10px] font-bold text-white">{i + 1}</span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" className="h-full w-full object-cover" />
                    <button type="button" onClick={() => setRefs((r) => r.filter((_, j) => j !== i))} aria-label="Хасах"
                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-[4px]" style={{ background: "rgba(0,0,0,0.65)", color: "#FFFFFF" }}>
                      <Svg d={I.x} size={11} />
                    </button>
                  </div>
                ))}
                {refs.length === 0 && <span className="max-w-[230px] text-[12.5px] leading-snug text-[#9C9CA6]">Бүтээгдэхүүн, царай, загвар, хэв маягийн 10 хүртэл зураг — чирж оруулах, сонгох эсвэл Ctrl+V</span>}
                {refs.length > modelMax && <span className="w-full text-[12px] text-[#9C9CA6]">Энэ загвар эхний {modelMax} зургийг ашиглана — 10 хүртэл бол Nano Banana 2.1 / Pro эсвэл ChatGPT Image сонгоно уу.</span>}
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple className="hidden"
                  onChange={(e) => { addRefs(e.target.files); e.target.value = ""; }} />
              </div>
            </div>

            {/* Промпт */}
            <div className={`rounded-[4px] border ${LINE} bg-[rgba(46,41,255,0.06)] p-3.5 focus-within:border-[#2E29FF]`}>
              <div className="mb-1 text-[13px] font-bold text-[#9C9CA6]">Промпт</div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generate(); }}
                placeholder={refs.length ? "Юуг өөрчлөх вэ — жишээ: “дэвсгэрийг далайн эрэг болго”" : PLACEHOLDERS[phIdx]}
                rows={4}
                maxLength={4000}
                className="w-full resize-none bg-transparent text-[16px] leading-[1.5] text-[#F2F2F4] outline-none placeholder:text-[#9C9CA6]"
              />
              <div className="text-right text-[12px] tabular-nums text-[#9C9CA6]">{prompt.length}/4000</div>
            </div>

            {/* Харьцаа · чанар */}
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <button type="button" onClick={() => setAspectOpen((v) => !v)}
                  className={`flex h-12 w-full items-center justify-center gap-2 rounded-[4px] border ${LINE} bg-[rgba(46,41,255,0.08)] text-[15px] font-bold text-[#F2F2F4] transition hover:border-[#2E29FF]`}>
                  <Svg d={I.ratio} size={17} /> {aspect}
                </button>
                {aspectOpen && (
                  <div className={`absolute bottom-full left-0 z-30 mb-2 w-full overflow-hidden rounded-[4px] border ${LINE} bg-[#141414] py-1 shadow-[0_10px_30px_rgba(0,0,0,0.35)]`}>
                    {ASPECTS.map((a) => (
                      <button key={a} type="button" onClick={() => { setAspect(a); setAspectOpen(false); }}
                        className={`block w-full px-4 py-2.5 text-left text-[14.5px] font-semibold hover:bg-[rgba(46,41,255,0.1)] ${a === aspect ? "text-[#2E29FF]" : "text-[#F2F2F4]"}`}>{a}</button>
                    ))}
                  </div>
                )}
              </div>
              <button type="button" onClick={() => setHd((v) => !v)} aria-pressed={hd}
                className={`flex h-12 items-center justify-center gap-2 rounded-[4px] border text-[15px] font-bold transition ${hd ? "border-[#2E29FF] bg-[rgba(46,41,255,0.12)] text-[#2E29FF]" : `${LINE} bg-[rgba(46,41,255,0.08)] text-[#F2F2F4]`}`}>
                <Svg d={I.hd} size={17} /> {hd ? "HD · ×" + hdMult : "Энгийн"}
              </button>
            </div>

            {err && (
              <div className="rounded-[4px] border border-[rgba(252,238,10,0.45)] bg-[rgba(252,238,10,0.08)] px-3 py-2.5 text-[13.5px] font-semibold text-[#FCEE0A]">
                {err}
                {lowCredit && <Link href="/credits/buy" className="ml-2 underline">Кредит авах →</Link>}
              </div>
            )}

            <button type="button" onClick={generate} disabled={busy || !prompt.trim()}
              className="press flex h-14 items-center justify-center gap-2.5 rounded-[4px] bg-[#2E29FF] text-[18px] font-black text-[#0A0A0A] shadow-[0_4px_0_#1E1E1E] transition hover:bg-[#1F1AD9] active:translate-y-[2px] active:shadow-[0_2px_0_#1E1E1E] disabled:opacity-50">
              {busy ? "Зурж байна…" : "Үүсгэх"}
              {!busy && <span className="inline-flex items-center gap-1 text-[17px]"><Svg d={I.spark} size={17} /> {cost} кр <span className="text-[12px] font-semibold opacity-70">· {(cost * 100).toLocaleString()}₮</span></span>}
            </button>
            {isOwner && (
              <label className="flex items-center gap-2 text-[13px] text-[#E2E4E8]">
                <input type="checkbox" checked={autoThreads} onChange={(e) => { setAutoThreads(e.target.checked); try { localStorage.setItem("aq_auto_threads", e.target.checked ? "1" : "0"); } catch { /* */ } }} className="h-4 w-4 accent-[#2E29FF]" />
                Бүтээмэгц feed + <b>Threads</b>-д давхар нийтлэх <span className="text-[11.5px] text-[#9C9CA6]">(зөвхөн танд)</span>
              </label>
            )}
            <div className="flex items-center justify-between text-[12.5px] text-[#9C9CA6]">
              <span>{active.label} · 10–40 секунд · алдаа гарвал кредит буцна</span>
              {status === "authenticated" && (
                <Link href="/credits/buy" className="inline-flex items-center gap-1 font-bold text-[#F2F2F4] hover:text-[#2E29FF]">
                  <CreditIcon size={12} /> {balance ?? "…"}
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* ═══ БАРУУН: бүтээлүүд ═══ */}
        <section aria-label="Миний зургууд" className="min-w-0">
          <div className="mb-3 flex items-baseline justify-between px-1">
            <h1 className="text-[22px] font-extrabold text-[#F2F2F4]">Миний зургууд</h1>
            <span className="text-[13px] text-[#9C9CA6]">{items.filter((x) => !x.pending).length}</span>
          </div>
          {items.length === 0 ? (
            <div className={`${PANEL} flex min-h-[320px] flex-col items-center justify-center gap-3 px-6 text-center`}>
              <span className="flex h-14 w-14 items-center justify-center rounded-[4px] bg-[rgba(46,41,255,0.12)] text-[#2E29FF]"><Svg d={I.spark} size={26} /></span>
              <p className="text-[17px] font-extrabold text-[#F2F2F4]">Анхны зургаа бүтээ</p>
              <p className="max-w-[380px] text-[14px] leading-relaxed text-[#9C9CA6]">
                Nano Banana 2.1 — бодит зураг, бүтээгдэхүүн, засвар. ChatGPT Image — бичигтэй постер, лого, дизайн.
              </p>
            </div>
          ) : (
            <div className="columns-1 gap-3 sm:columns-2 xl:columns-3 [&>*]:mb-3">
              {items.map((it) => (
                <article key={it._id} className={`${PANEL} break-inside-avoid overflow-hidden`}>
                  <div className="relative w-full overflow-hidden bg-black" style={{ aspectRatio: (it.aspectRatio || "1:1").replace(":", " / ") }}>
                    {it.pending ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2"
                        style={{ background: "linear-gradient(120deg, #F8F9FD 0%, #F1F2F7 50%, #F8F9FD 100%)", backgroundSize: "200% 100%", animation: "is-shimmer 2.2s linear infinite" }}>
                        <span className="text-[13px] font-bold tracking-[0.14em]" style={{ color: "#2E29FF" }}>ЗУРЖ БАЙНА…</span>
                      </div>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.url} alt={it.prompt} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 p-3">
                    <p className="line-clamp-2 text-[13.5px] leading-snug text-[#E2E4E8]">{it.prompt}</p>
                    <div className="flex items-center gap-1.5 text-[12px] text-[#9C9CA6]">
                      <span>{it.model === "gpt" ? "ChatGPT" : "Nano Banana"} · {it.aspectRatio}</span>
                      {it.cost > 0 && <span className="inline-flex items-center gap-0.5">· <CreditIcon size={11} /> {it.cost}</span>}
                      {!it.pending && (
                        <span className="ml-auto flex items-center gap-0.5">
                          <button type="button" onClick={() => setPrompt(it.prompt)} aria-label="Промптыг дахин ашиглах" className="flex h-8 w-8 items-center justify-center rounded-[4px] text-[#F2F2F4] hover:bg-[rgba(46,41,255,0.12)]"><Svg d={I.reuse} size={15} /></button>
                          <a href={it.url} download className="flex h-8 w-8 items-center justify-center rounded-[4px] text-[#F2F2F4] hover:bg-[rgba(46,41,255,0.12)]" aria-label="Татах"><Svg d={I.download} size={15} /></a>
                          <button type="button" onClick={() => share(it)} disabled={it.shared || sharing === it._id} aria-label="Урсгалд нийтлэх"
                            className={`flex h-8 w-8 items-center justify-center rounded-[4px] ${it.shared ? "text-[#2E29FF]" : "text-[#F2F2F4] hover:bg-[rgba(46,41,255,0.12)]"}`}><Svg d={I.share} size={15} /></button>
                          {!it._id.startsWith("tmp-") && (
                            <button type="button" onClick={() => remove(it._id)} aria-label="Устгах" className="flex h-8 w-8 items-center justify-center rounded-[4px] text-[#9C9CA6] hover:text-[#FCEE0A]"><Svg d={I.trash} size={15} /></button>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
      <style jsx global>{`@keyframes is-shimmer { from { background-position: 200% 0 } to { background-position: -200% 0 } }`}</style>
    </main>
  );
}
