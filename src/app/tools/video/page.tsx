"use client";

import AiBudgetPill from "@/components/AiBudgetPill";
import { useState, useEffect, useRef, useCallback, useMemo, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CreditIcon } from "@/components/CreditIcon";
import { emitXPFromResponse } from "@/lib/xpToast";
import { openAuth } from "@/components/AuthModal";
import { AI_IMAGE_ENABLED } from "@/lib/flags";
import { videoCreditCost, type VideoPricing } from "@/lib/videoPricing";

/* ─── AI ВИДЕО СТУДИ · Higgsfield Seedance 2.5 (2026-10-13 шинэчлэл) ────────
   Загвар: Higgsfield-ийн "Create Video" самбар (эзний жишээ).
   Зүүн: удирдлагын самбар — таб · загварын баннер · References (эхлэх
   зураг) · Промпт + дуу · Загвар · хугацаа/харьцаа/нарийвчлал чип ·
   том "Үүсгэх ✦ үнэ" товч.
   Баруун: бүтээлүүд — боловсруулж буй нь амьд явцтай, бэлэн нь тоглуулагч
   + татах / урсгалд нийтлэх / устгах.
   Сервер: /api/tools/generate-video → Higgsfield (lib/higgsfield.ts),
   /api/tools/video-status 4с тутам. Кредит амжилтгүй бол буцна. */

const PLACEHOLDERS = [
  "Улаанбаатарын шөнө, неон бороо, камер удаанаар урагшилна…",
  "Тал нутгийн нар мандах, өвсний долгион, дрон дээшээ хөөрнө…",
  "Бүтээгдэхүүн эргэлдэж, студийн гэрэл дээрээс тусна…",
  "Founder ширээндээ, цонхны зөөлөн гэрэл, камер аажим ойртоно…",
];

interface ModelDef {
  id: string;
  label: string;
  sub: string;
  supportsImage: boolean;
  supportsAudio: boolean;
  ratios: string[];
  durations: number[];
}
const FALLBACK_MODEL: ModelDef = {
  id: "seedance25", label: "Seedance 2.5", sub: "Кино маягийн · дуутай · зурагнаас ч болно",
  supportsImage: true, supportsAudio: true,
  ratios: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"], durations: [5, 8, 10, 15],
};
const FALLBACK_RES = [
  { id: "480p", label: "480p", mult: 0.6 },
  { id: "720p", label: "720p", mult: 1 },
  { id: "1080p", label: "1080p", mult: 1.8 },
];

interface HistoryItem {
  _id: string;
  url: string;
  prompt: string;
  model: string;
  ratio: string;
  duration: number;
  status: "processing" | "done" | "failed";
  progress: number;
  cost: number;
  createdAt: string;
  shared?: boolean;
}

const LINE = "border-[color:var(--t-line,rgba(255,255,255,0.12))]";
const PANEL = `rounded-[4px] border ${LINE} bg-[#141414]`;
const ratioCss = (r: string) => (r && r !== "adaptive" ? r.replace(":", " / ") : "16 / 9");

function Svg({ d, size = 18, className = "" }: { d: string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={d} />
    </svg>
  );
}
const I = {
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2",
  ratio: "M7 3h10v18H7z",
  res: "M12 3l9 6-9 12L3 9zM3 9h18",
  sound: "M11 5 6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14",
  mute: "M11 5 6 9H2v6h4l5 4zM22 9l-6 6M16 9l6 6",
  plus: "M12 5v14M5 12h14",
  x: "M6 6l12 12M18 6L6 18",
  chevron: "M9 6l6 6-6 6",
  spark: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z",
  download: "M12 4v12M7 11l5 5 5-5M5 20h14",
  share: "M4 12v7h16v-7M12 3v12M8 7l4-4 4 4",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
};

export default function VideoStudioPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center"><div className="h-2 w-2 animate-pulse rounded-full bg-[#2E29FF]" /></div>}>
      <VideoStudio />
      <AiBudgetPill focus="video" />
    </Suspense>
  );
}

function Chip({ icon, value, open, onToggle, options, onPick, disabled, hint }: {
  icon: string; value: string; open: boolean; onToggle: () => void;
  options: { id: string; label: string }[]; onPick: (id: string) => void; disabled?: boolean; hint?: string;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        title={hint}
        className={`flex h-12 w-full items-center justify-center gap-2 rounded-[4px] border ${LINE} bg-[rgba(46,41,255,0.08)] text-[15px] font-bold text-[#F2F2F4] transition hover:border-[#2E29FF] disabled:opacity-50`}
      >
        <Svg d={icon} size={17} />
        {value}
      </button>
      {open && !disabled && (
        <div className={`absolute bottom-full left-0 z-30 mb-2 min-w-full overflow-hidden rounded-[4px] border ${LINE} bg-[#141414] py-1 shadow-[0_10px_30px_rgba(0,0,0,0.35)]`}>
          {options.map((o) => (
            <button key={o.id} type="button" onClick={() => onPick(o.id)}
              className={`block w-full whitespace-nowrap px-4 py-2.5 text-left text-[14.5px] font-semibold transition hover:bg-[rgba(46,41,255,0.1)] ${o.label.split(" · ")[0] === value ? "text-[#2E29FF]" : "text-[#F2F2F4]"}`}>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function VideoStudio() {
  const { status } = useSession();
  const searchParams = useSearchParams();

  const [modelDef, setModelDef] = useState<ModelDef>(FALLBACK_MODEL);
  const [resolutions, setResolutions] = useState(FALLBACK_RES);
  const [perSecond, setPerSecond] = useState<Record<string, number>>({});
  const [ratio, setRatio] = useState("16:9");
  const [duration, setDuration] = useState(5);
  const [resolution, setResolution] = useState("720p");
  const [audio, setAudio] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [image, setImage] = useState("");
  const [menu, setMenu] = useState<"" | "dur" | "ratio" | "res">("");

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [lowCredit, setLowCredit] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [sharing, setSharing] = useState<string | null>(null);
  const [phIdx, setPhIdx] = useState(0);

  const fileRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const polling = useRef<Set<string>>(new Set());

  /* Үнэ = серверийнхтэй ЯГ ижил функц (Higgsfield-ийн токен өртөг + 25%). */
  const cost = videoCreditCost({ perSecond } as VideoPricing, "seedance25", duration, resolution, image ? "adaptive" : ratio);

  useEffect(() => {
    const pq = searchParams?.get("prompt");
    if (pq) setPrompt(pq.slice(0, 2000));
  }, [searchParams]);

  useEffect(() => {
    const t = setInterval(() => setPhIdx((i) => (i + 1) % PLACEHOLDERS.length), 5200);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const off = (e: MouseEvent) => { if (panelRef.current && !panelRef.current.contains(e.target as Node)) setMenu(""); };
    document.addEventListener("mousedown", off);
    return () => document.removeEventListener("mousedown", off);
  }, []);

  useEffect(() => {
    fetch("/api/tools/video-pricing")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.models) && d.models.length) setModelDef(d.models[0]);
        if (Array.isArray(d.resolutions) && d.resolutions.length) setResolutions(d.resolutions);
        if (d.perSecond) setPerSecond(d.perSecond);
      })
      .catch(() => {});
  }, []);

  const refreshBalance = useCallback(() => {
    fetch("/api/credits").then((r) => r.json()).then((d) => { if (typeof d.balance === "number") setBalance(d.balance); }).catch(() => {});
  }, []);
  useEffect(() => { if (status === "authenticated") refreshBalance(); }, [status, refreshBalance]);

  const loadHistory = useCallback(async () => {
    if (status !== "authenticated") return;
    try {
      const r = await fetch("/api/tools/video-history?limit=24");
      const d = await r.json();
      if (Array.isArray(d.items)) setHistory(d.items);
    } catch { /* түүх бол чимэг */ }
  }, [status]);
  useEffect(() => { loadHistory(); }, [loadHistory]);

  // ── Боловсруулж буйг дуустал асуух (4с) ──
  useEffect(() => {
    const pending = history.filter((h) => h.status === "processing");
    if (pending.length === 0) return;
    let cancelled = false;
    const tick = async () => {
      await Promise.all(pending.map(async (row) => {
        if (polling.current.has(row._id)) return;
        polling.current.add(row._id);
        try {
          const r = await fetch(`/api/tools/video-status?id=${row._id}`);
          const d = await r.json();
          if (cancelled || !d?.status) return;
          if (d.status === "processing") {
            setHistory((prev) => prev.map((h) => (h._id === row._id ? { ...h, progress: d.progress || h.progress } : h)));
          } else if (d.status === "done") {
            setHistory((prev) => prev.map((h) => (h._id === row._id ? { ...h, status: "done", url: d.url, progress: 1 } : h)));
          } else {
            setHistory((prev) => prev.filter((h) => h._id !== row._id));
            setErr(d.error || "Видео амжилтгүй боллоо. Кредит буцлаа.");
            refreshBalance();
          }
        } catch { /* дараагийн эргэлтэд */ } finally { polling.current.delete(row._id); }
      }));
    };
    const t = setInterval(tick, 4000);
    tick();
    return () => { cancelled = true; clearInterval(t); };
  }, [history, refreshBalance]);

  const onPickImage = (file?: File | null) => {
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) { setErr("PNG, JPG эсвэл WEBP зураг сонгоно уу"); return; }
    if (file.size > 8 * 1024 * 1024) { setErr("Зураг 8MB-аас бага байх ёстой"); return; }
    const reader = new FileReader();
    reader.onload = () => setImage(String(reader.result || ""));
    reader.readAsDataURL(file);
  };

  const generate = async () => {
    if (status !== "authenticated") { openAuth("signin"); return; }
    if (busy || !prompt.trim()) return;
    setErr(""); setLowCredit(false); setBusy(true); setMenu("");
    try {
      const res = await fetch("/api/tools/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(), model: modelDef.id, ratio, duration, resolution,
          image: image || undefined,
          generateAudio: modelDef.supportsAudio ? audio : false,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setErr(d.error || "Алдаа гарлаа");
        if (d.code === "INSUFFICIENT_CREDITS") setLowCredit(true);
        if (typeof d.balance === "number") setBalance(d.balance);
        return;
      }
      if (typeof d.balance === "number") setBalance(d.balance);
      setHistory((prev) => [{
        _id: d.id, url: "", prompt: prompt.trim(), model: d.model, ratio: d.ratio,
        duration: d.duration, status: "processing", progress: 0.03, cost: d.cost,
        createdAt: new Date().toISOString(),
      }, ...prev]);
    } catch {
      setErr("Сүлжээний алдаа");
    } finally {
      setBusy(false);
    }
  };

  const share = async (item: HistoryItem) => {
    if (sharing) return;
    setSharing(item._id);
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "AI видео", video: item.url, videoDurationSec: item.duration, category: "бүтээл" }),
      });
      const d = await res.json();
      if (!res.ok) { setErr(d.error || "Нийтэлж чадсангүй"); return; }
      emitXPFromResponse(d, "BUILD");
      if (d?.post?._id) {
        fetch("/api/tools/video-history", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: item._id, postId: d.post._id }),
        }).catch(() => {});
      }
      setHistory((prev) => prev.map((h) => (h._id === item._id ? { ...h, shared: true } : h)));
    } catch {
      setErr("Сүлжээний алдаа");
    } finally {
      setSharing(null);
    }
  };

  const remove = (id: string) => {
    if (!confirm("Энэ видеог устгах уу?")) return;
    setHistory((prev) => prev.filter((h) => h._id !== id));
    fetch(`/api/tools/video-history?id=${id}`, { method: "DELETE" }).catch(() => {});
  };

  const ratioOpts = useMemo(() => modelDef.ratios.map((r) => ({ id: r, label: r })), [modelDef]);
  // Сонголт бүрийн үнийг цэсэнд нь харуулна — "1080p" дарахаас өмнө ойлгогдоно.
  const durOpts = useMemo(() => modelDef.durations.map((d) => ({ id: String(d), label: `${d}с · ${videoCreditCost({ perSecond } as VideoPricing, "seedance25", d, resolution, image ? "adaptive" : ratio)}₵` })), [modelDef, perSecond, resolution, ratio, image]);
  const resOpts = useMemo(() => resolutions.map((r) => ({ id: r.id, label: `${r.label} · ${videoCreditCost({ perSecond } as VideoPricing, "seedance25", duration, r.id, image ? "adaptive" : ratio)}₵` })), [resolutions, perSecond, duration, ratio, image]);

  return (
    <main className="mx-auto w-full max-w-[1180px] px-3 pb-28 pt-3 sm:px-4 lg:pb-10">
      <div className="grid items-start gap-5 lg:grid-cols-[400px_minmax(0,1fr)]">
        {/* ═══ ЗҮҮН: удирдлагын самбар ═══ */}
        <div ref={panelRef} className={`${PANEL} lg:sticky lg:top-4`}>
          {/* Табууд */}
          <div className={`flex gap-6 border-b ${LINE} px-5 pt-4`}>
            <span className="relative pb-3 text-[17px] font-extrabold text-[#F2F2F4]">
              Видео үүсгэх
              <span className="absolute inset-x-0 bottom-0 h-[3px] bg-[#F2F2F4]" />
            </span>
            {AI_IMAGE_ENABLED && (
              <Link href="/tools/nano-banano" className="pb-3 text-[17px] font-bold text-[#9C9CA6] transition hover:text-[#E2E4E8]">Зураг үүсгэх</Link>
            )}
          </div>

          <div className="flex flex-col gap-3 p-4">
            {/* Загварын баннер */}
            <div className="relative overflow-hidden rounded-[4px] px-5 py-6"
              style={{ background: "radial-gradient(120% 120% at 100% 0%, #F1F2F7 0%, #F8F9FD 58%)", border: "1px solid rgba(46,41,255,0.25)" }}>
              <div className="text-[28px] font-black uppercase leading-none tracking-[-0.01em]" style={{ color: "#2E29FF" }}>General</div>
              <div className="mt-1.5 text-[14px] font-semibold" style={{ color: "#565967" }}>{modelDef.label} · Higgsfield</div>
              <span className="absolute right-3 top-3 rounded-[4px] px-2 py-1 text-[11px] font-bold" style={{ background: "rgba(255,255,255,0.08)", color: "#14151C" }}>
                {modelDef.supportsAudio ? "Дуутай" : "Дуугүй"}
              </span>
            </div>

            {/* References — эхлэх зураг */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[13px] font-bold text-[#9C9CA6]">Лавлах зураг <span className="font-normal">(заавал биш)</span></span>
                {image && <span className="text-[12px] text-[#9C9CA6]">Харьцаа нь зургийг дагана</span>}
              </div>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); onPickImage(e.dataTransfer.files?.[0]); }}
                className={`flex min-h-[112px] items-center justify-center gap-3 rounded-[4px] border-2 border-dashed ${LINE} p-3`}
              >
                <button type="button" onClick={() => fileRef.current?.click()} aria-label="Зураг нэмэх"
                  className="flex h-[76px] w-[76px] items-center justify-center rounded-[4px] bg-[rgba(46,41,255,0.12)] text-[#9C9CA6] transition hover:text-[#2E29FF]">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-current"><Svg d={I.plus} size={16} /></span>
                </button>
                {image ? (
                  <div className="relative h-[76px] w-[76px] overflow-hidden rounded-[4px]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image} alt="" className="h-full w-full object-cover" />
                    <button type="button" onClick={() => setImage("")} aria-label="Зураг хасах"
                      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-[4px]" style={{ background: "rgba(0,0,0,0.65)", color: "#FFFFFF" }}>
                      <Svg d={I.x} size={13} />
                    </button>
                  </div>
                ) : (
                  <span className="max-w-[170px] text-[12.5px] leading-snug text-[#9C9CA6]">Зураг чирж оруул — тэр нь видеоны эхний кадр болно</span>
                )}
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                  onChange={(e) => { onPickImage(e.target.files?.[0]); e.target.value = ""; }} />
              </div>
            </div>

            {/* Промпт */}
            <div className={`rounded-[4px] border ${LINE} bg-[rgba(46,41,255,0.06)] p-3.5 focus-within:border-[#2E29FF]`}>
              <div className="mb-1 text-[13px] font-bold text-[#9C9CA6]">Промпт</div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generate(); }}
                placeholder={PLACEHOLDERS[phIdx]}
                rows={4}
                maxLength={2000}
                className="w-full resize-none bg-transparent text-[16px] leading-[1.5] text-[#F2F2F4] outline-none placeholder:text-[#9C9CA6]"
              />
              <div className="mt-2 flex items-center gap-2">
                {modelDef.supportsAudio && (
                  <button type="button" onClick={() => setAudio((v) => !v)} aria-pressed={audio}
                    className={`inline-flex h-8 items-center gap-1.5 rounded-[4px] px-2.5 text-[13px] font-bold transition ${audio ? "bg-[rgba(46,41,255,0.14)] text-[#2E29FF]" : "bg-[rgba(46,41,255,0.12)] text-[#9C9CA6]"}`}>
                    <Svg d={audio ? I.sound : I.mute} size={15} /> {audio ? "Дуу асаалттай" : "Дуугүй"}
                  </button>
                )}
                <span className="ml-auto text-[12px] tabular-nums text-[#9C9CA6]">{prompt.length}/2000</span>
              </div>
            </div>

            {/* Загвар */}
            <div className={`flex items-center justify-between rounded-[4px] border ${LINE} bg-[rgba(46,41,255,0.06)] px-4 py-3`}>
              <div>
                <div className="text-[12.5px] font-bold text-[#9C9CA6]">Загвар</div>
                <div className="flex items-center gap-2 text-[17px] font-extrabold text-[#F2F2F4]">
                  {modelDef.label}
                  <span className="flex items-end gap-[2px]" aria-hidden>
                    {[6, 10, 8, 12].map((h, i) => <span key={i} className="w-[3px] rounded-[1px] bg-[#2E29FF]" style={{ height: h }} />)}
                  </span>
                </div>
              </div>
              <span className="text-[12.5px] text-[#9C9CA6]">{modelDef.sub}</span>
            </div>

            {/* Хугацаа · харьцаа · нарийвчлал */}
            <div className="grid grid-cols-3 gap-2">
              <Chip icon={I.clock} value={`${duration}с`} /* шошго нь үнэтэй — value нь цэвэр */ open={menu === "dur"} onToggle={() => setMenu(menu === "dur" ? "" : "dur")}
                options={durOpts} onPick={(id) => { setDuration(Number(id)); setMenu(""); }} />
              <Chip icon={I.ratio} value={image ? "Зураг" : ratio} open={menu === "ratio"} onToggle={() => setMenu(menu === "ratio" ? "" : "ratio")}
                options={ratioOpts} onPick={(id) => { setRatio(id); setMenu(""); }} disabled={!!image} hint={image ? "Зурагтай үед харьцаа зургийг дагана" : undefined} />
              <Chip icon={I.res} value={resolution} open={menu === "res"} onToggle={() => setMenu(menu === "res" ? "" : "res")}
                options={resOpts} onPick={(id) => { setResolution(id); setMenu(""); }} />
            </div>

            {err && (
              <div className="rounded-[4px] border border-[rgba(252,238,10,0.45)] bg-[rgba(252,238,10,0.08)] px-3 py-2.5 text-[13.5px] font-semibold text-[#FCEE0A]">
                {err}
                {lowCredit && <Link href="/credits/buy" className="ml-2 underline">Кредит авах →</Link>}
              </div>
            )}

            {/* Үүсгэх */}
            <button
              type="button"
              onClick={generate}
              disabled={busy || !prompt.trim()}
              className="press flex h-14 items-center justify-center gap-2.5 rounded-[4px] bg-[#2E29FF] text-[18px] font-black text-[#0A0A0A] shadow-[0_4px_0_#1E1E1E] transition hover:bg-[#1F1AD9] active:translate-y-[2px] active:shadow-[0_2px_0_#1E1E1E] disabled:opacity-50"
            >
              {busy ? "Илгээж байна…" : "Үүсгэх"}
              {!busy && cost > 0 && (
                <span className="inline-flex items-center gap-1 text-[17px]">
                  <Svg d={I.spark} size={17} /> {cost} кр <span className="text-[12px] font-semibold opacity-70">· {(cost * 100).toLocaleString()}₮</span>
                </span>
              )}
            </button>
            <div className="flex items-center justify-between text-[12.5px] text-[#9C9CA6]">
              <span>Ихэвчлэн 1–3 минут · амжилтгүй бол кредит буцна</span>
              {status === "authenticated" && (
                <Link href="/credits/buy" className="inline-flex items-center gap-1 font-bold text-[#F2F2F4] hover:text-[#2E29FF]">
                  <CreditIcon size={12} /> {balance ?? "…"}
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* ═══ БАРУУН: бүтээлүүд ═══ */}
        <section aria-label="Миний видеонууд" className="min-w-0">
          <div className="mb-3 flex items-baseline justify-between px-1">
            <h1 className="text-[22px] font-extrabold text-[#F2F2F4]">Миний видеонууд</h1>
            <span className="text-[13px] text-[#9C9CA6]">{history.filter((h) => h.status === "done").length} бэлэн</span>
          </div>

          {history.length === 0 ? (
            <div className={`${PANEL} flex min-h-[320px] flex-col items-center justify-center gap-3 px-6 text-center`}>
              <span className="flex h-14 w-14 items-center justify-center rounded-[4px] bg-[rgba(46,41,255,0.12)] text-[#2E29FF]"><Svg d={I.spark} size={26} /></span>
              <p className="text-[17px] font-extrabold text-[#F2F2F4]">Анхны видеогоо бүтээ</p>
              <p className="max-w-[360px] text-[14px] leading-relaxed text-[#9C9CA6]">
                [Хэн/юу] + [үйлдэл] + [орчин] + [камер] + [гэрэл]. Жишээ: “Монгол залуу ноутбукаар ажиллаж байна, оройн кофе шоп, камер аажмаар ойртоно, бүлээн гэрэл”.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {history.map((h) => (
                <article key={h._id} className={`${PANEL} overflow-hidden`}>
                  <div className="relative w-full overflow-hidden bg-black" style={{ aspectRatio: ratioCss(h.ratio) }}>
                    {h.status === "done" && h.url ? (
                      // eslint-disable-next-line jsx-a11y/media-has-caption
                      <video src={h.url} controls playsInline loop preload="metadata" className="absolute inset-0 h-full w-full object-contain" />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3"
                        style={{ background: "linear-gradient(120deg, #F8F9FD 0%, #F1F2F7 50%, #F8F9FD 100%)", backgroundSize: "200% 100%", animation: "vs-shimmer 2.4s linear infinite" }}>
                        <span className="text-[13px] font-bold tracking-[0.14em]" style={{ color: "#2E29FF" }}>ҮҮСГЭЖ БАЙНА · {Math.round((h.progress || 0) * 100)}%</span>
                        <div className="h-1.5 w-[60%] overflow-hidden rounded-[4px]" style={{ background: "rgba(255,255,255,0.12)" }}>
                          <div className="h-full bg-[#2E29FF] transition-[width] duration-700" style={{ width: `${Math.max(4, Math.round((h.progress || 0) * 100))}%` }} />
                        </div>
                        <span className="text-[12px]" style={{ color: "#565967" }}>Хуудсаа хааж болно — бэлэн болмогц энд гарна</span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 p-3">
                    <p className="line-clamp-2 text-[13.5px] leading-snug text-[#E2E4E8]">{h.prompt}</p>
                    <div className="flex items-center gap-1.5 text-[12px] text-[#9C9CA6]">
                      <span>{h.duration}с · {h.ratio === "adaptive" ? "зураг" : h.ratio}</span>
                      {h.cost > 0 && <span className="inline-flex items-center gap-0.5">· <CreditIcon size={11} /> {h.cost}</span>}
                      {h.status === "done" && (
                        <span className="ml-auto flex items-center gap-1">
                          <a href={h.url} download className="flex h-8 w-8 items-center justify-center rounded-[4px] text-[#F2F2F4] hover:bg-[rgba(46,41,255,0.12)]" aria-label="Татах"><Svg d={I.download} size={16} /></a>
                          <button type="button" onClick={() => share(h)} disabled={h.shared || sharing === h._id} aria-label="Урсгалд нийтлэх"
                            className={`flex h-8 items-center gap-1 rounded-[4px] px-2 text-[12.5px] font-bold ${h.shared ? "text-[#2E29FF]" : "text-[#F2F2F4] hover:bg-[rgba(46,41,255,0.12)]"}`}>
                            <Svg d={I.share} size={15} /> {h.shared ? "Нийтэлсэн" : sharing === h._id ? "…" : "Нийтлэх"}
                          </button>
                          <button type="button" onClick={() => remove(h._id)} aria-label="Устгах" className="flex h-8 w-8 items-center justify-center rounded-[4px] text-[#9C9CA6] hover:text-[#FCEE0A]"><Svg d={I.trash} size={15} /></button>
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
      <style jsx global>{`@keyframes vs-shimmer { from { background-position: 200% 0 } to { background-position: -200% 0 } }`}</style>
    </main>
  );
}
