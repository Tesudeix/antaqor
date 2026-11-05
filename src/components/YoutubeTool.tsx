"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";

/* ─── ХОЛБООС → MP4 ─────────────────────────────────────────────────────
   Энэ хуудас НЭГ Ч ВИДЕО ТАТАХГҮЙ. Зөвхөн ажил бүртгэж, явцыг харуулна.
   Бодит татац нь ХЭРЭГЛЭГЧИЙН ӨӨРИЙН машин дээрх agent-д, өөрийн
   интернэтээр гүйнэ.

   Яагаад ингэж байгуулсан: antaqor.com-ын сервер YouTube-ээс татаж
   чадахгүй (droplet-ийн IP блоклогдсон; медиа хаяг нь уншсан IP-д
   хүлэгддэг тул "сервер татах" гэдэг зам байхгүй). Харин хэрэглэгч
   бүрийн гэрийн IP ажилладаг — тиймээс татацыг тэдэнд гүйцэтгүүлж,
   Antaqor зохион байгуулалтыг зарна. */

const INK = "var(--t-ink, #F2F2F4)";
const SUB = "var(--t-sub, #9C9CA6)";
const LINE = "var(--t-line, rgba(255,255,255,0.12))";
const SURFACE = "var(--t-surface, #171320)";
const TEAL = "var(--accent-ink, #2E29FF)";
const BAD = "#C81E4A";
const WARN = "#B45309";
const CODE: React.CSSProperties = { background: "#F2F3F8", border: `1px solid ${LINE}`, borderRadius: 4, color: INK };
const MP3_KBPS = [128, 192, 320] as const;
/* Сервер ч мөн 1.1-ээс доош agent-д mp3 ажил өгдөггүй (lib/ytgrab MP3_MIN_AGENT). */
const agentVer = (v: string) => Number(String(v || "").match(/^\d+(\.\d+)?/)?.[0] || 0);

interface Quality { height: number; fps: number; avc: boolean; videoBytes: number; progressive: boolean }
interface Info {
  id: string; title: string; uploader: string; duration: number;
  thumbnail: string; live: boolean;
  qualities: Quality[]; audioBest: number; audioCompat: number;
}
interface Job {
  id: string; kind: "probe" | "fetch"; status: "queued" | "working" | "done" | "error";
  pct: number; stage: string; mode: string; height: number; abr: number;
  title: string; info: Info | null;
  fileName: string; fileSize: number; macPath: string;
  wantUpload: boolean; stored: boolean; charged: number; error: string; createdAt: string;
}
interface Agent { exists: boolean; online: boolean; lastSeen: string | null; version: string; outDir: string }
interface Pricing { sd: number; hd: number; uhd: number }

const fmtSize = (b: number) =>
  !b ? "" : b >= 1073741824 ? (b / 1073741824).toFixed(2) + " GB" : Math.round(b / 1048576) + " MB";
const fmtDur = (s: number) => {
  if (!s) return "";
  s = Math.round(s);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return (h ? h + ":" + String(m).padStart(2, "0") : String(m)) + ":" + String(x).padStart(2, "0");
};
const tierCost = (p: Pricing, h: number) => (h >= 1440 ? p.uhd : h >= 720 ? p.hd : p.sd);

const btn = (on: boolean): React.CSSProperties => ({
  minHeight: 44, padding: "0 20px", borderRadius: 4, fontSize: 13, fontWeight: 700,
  background: on ? TEAL : "transparent",
  color: on ? "#fff" : INK,
  border: on ? "1px solid transparent" : `1px solid ${LINE}`,
  cursor: "pointer",
});

const AGENT_URL = "https://antaqor.com/ytgrab/antaqor-ytgrab.js";

/* Татсан файлын нэрээс гарчгийг гаргана: "Нэр [id].mp3" → "Нэр" */
const titleOf = (j: Job) => j.title || (j.fileName ? j.fileName.replace(/\s*\[[^\]]+\](\s*\d+p)?\.\w+$/, "") : "");

export default function YoutubeTool() {
  const [url, setUrl] = useState("");
  /* MP4 = видео (чанар сонгоно), MP3 = зөвхөн дуу (шалгахгүйгээр шууд татна — хамгийн хурдан) */
  const [fmt, setFmt] = useState<"mp4" | "mp3">("mp4");
  const [kbps, setKbps] = useState<number>(192);
  const [mode, setMode] = useState<"compat" | "best">("compat");
  const [upload, setUpload] = useState(false);
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [credits, setCredits] = useState(0);
  const [pricing, setPricing] = useState<Pricing>({ sd: 1, hd: 2, uhd: 4 });
  const [free, setFree] = useState(false);
  /* Сервер өөрөө татдаг горим (WARP) — agent хэрэггүй, файл хөтчөөр бууна */
  const [server, setServer] = useState(false);
  const mine = useRef<Set<string>>(new Set());
  const got = useRef<Set<string>>(new Set());
  const [probeId, setProbeId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [setup, setSetup] = useState(false);
  const [token, setToken] = useState("");
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/tools/youtube", { cache: "no-store" });
      const d = await r.json();
      if (Array.isArray(d.jobs)) setJobs(d.jobs);
      if (d.agent) setAgent(d.agent);
      if (typeof d.credits === "number") setCredits(d.credits);
      if (d.pricing) setPricing(d.pricing);
      setFree(!!d.free);
      setServer(!!d.server);
    } catch { /* дараагийн эргэлтэд */ }
  }, []);

  /* Ажил явж байх үед хурдан, тайван үед сул эргэлт. */
  useEffect(() => {
    const live = (jobs || []).some((j) => j.status === "queued" || j.status === "working");
    const tick = async () => {
      await load();
      timer.current = setTimeout(tick, live ? 1800 : 7000);
    };
    timer.current = setTimeout(tick, live ? 1800 : 7000);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [jobs, load]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    let f = new URLSearchParams(window.location.search).get("f");
    if (!f) { try { f = localStorage.getItem("yt.fmt"); } catch { /* хувийн цонх */ } }
    if (f === "mp3") setFmt("mp3");
  }, []);
  const pickFmt = (f: "mp4" | "mp3") => {
    setFmt(f); setErr("");
    try { localStorage.setItem("yt.fmt", f); } catch { /* хувийн цонх */ }
  };

  /* Энэ удаа үүсгэсэн татац бэлэн болмогц файлыг хөтөч рүү автоматаар буулгана */
  useEffect(() => {
    for (const j of jobs || []) {
      if (j.kind !== "fetch" || j.status !== "done" || !j.stored || !mine.current.has(j.id) || got.current.has(j.id)) continue;
      got.current.add(j.id);
      const a = document.createElement("a");
      a.href = `/api/tools/youtube/${j.id}/file`; a.rel = "noopener";
      document.body.appendChild(a); a.click(); a.remove();
    }
  }, [jobs]);

  const probe = useMemo(() => (jobs || []).find((j) => j.id === probeId) || null, [jobs, probeId]);
  const info = probe?.status === "done" ? probe.info : null;

  async function create(kind: "probe" | "fetch", height?: number, asMp3 = false) {
    setErr("");
    const res = await fetch("/api/tools/youtube", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind, url, height, mode: asMp3 ? "mp3" : mode, kbps: asMp3 ? kbps : undefined,
        upload: kind === "fetch" ? upload : false,
        title: kind === "fetch" ? info?.title || "" : "",
      }),
    });
    const d = await res.json();
    if (!res.ok) {
      setErr(d.error || "Үүсгэж чадсангүй");
      if (d.code === "AGENT_OFFLINE" || d.code === "AGENT_OLD") setSetup(true);
      return null;
    }
    if (d.job?.id) mine.current.add(d.job.id);
    await load();
    return d.job as Job;
  }

  async function onProbe() {
    if (!url.trim()) return;
    setBusy(true); setProbeId("");
    const j = await create("probe");
    if (j) setProbeId(j.id);
    setBusy(false);
  }

  async function onMp3() {
    if (!url.trim()) return;
    setBusy(true);
    await create("fetch", undefined, true);
    setBusy(false);
  }

  async function makeToken() {
    const r = await fetch("/api/tools/youtube/agent", { method: "POST" });
    const d = await r.json();
    if (r.ok && d.token) { setToken(d.token); setCopied(false); await load(); }
    else setErr(d.error || "Нууц үүсгэж чадсангүй");
  }

  const fetches = (jobs || []).filter((j) => j.kind === "fetch");
  const oldAgent = !server && !!agent?.online && agentVer(agent.version) < 1.1;
  const needSetup = !server && agent !== null && (!agent.exists || !agent.online || oldAgent);
  /* Татах боломжтой эсэх: сервер горимд үргэлж, эс бөгөөс agent онлайн байх */
  const ready = server || !!agent?.online;
  const mp3Cost = pricing.sd;
  const mp3Poor = !free && credits < mp3Cost;

  return (
    <div className="mx-auto w-full max-w-[760px] px-4 pb-20 pt-2 md:px-0">
      <p className="text-[11px] font-bold uppercase" style={{ color: TEAL, letterSpacing: "0.16em" }}>
        Хэрэгсэл
      </p>
      <h1 className="mt-1.5 text-[28px] font-extrabold leading-[1.15] md:text-[34px]" style={{ color: INK }}>
        Холбоос → MP4 / MP3
      </h1>
      <p className="mt-2 text-[14px] leading-[1.7]" style={{ color: SUB }}>
        {server
          ? "Холбоосоо тавиад дар — юу ч суулгах шаардлагагүй. Видео 1080p хүртэл, эсвэл зөвхөн дууг нь MP3-аар. 4 минутын дуу ~15 секунд, дуусмагц файл өөрөө бууна."
          : "Видеог 4K хүртэл, эсвэл зөвхөн дууг нь MP3-аар. Татац чиний ӨӨРИЙН компьютер дээр, чиний интернэтээр гүйнэ — 4 минутын дуу ~10 секунд."}
      </p>

      {/* ── Формат: видео эсвэл зөвхөн дуу ── */}
      <div className="mt-5 grid grid-cols-2 gap-2">
        {([["mp4", "video", "Видео", server ? "MP4 · 1080p хүртэл" : "MP4 · 4K хүртэл"], ["mp3", "mic", "Аудио", "MP3 · хамгийн хурдан"]] as const).map(([k, ic, t, sub]) => (
          <button key={k} onClick={() => pickFmt(k)} aria-pressed={fmt === k}
            className="flex items-center gap-3 text-left"
            style={{
              minHeight: 60, padding: "10px 14px", borderRadius: 6, cursor: "pointer",
              border: `1.5px solid ${fmt === k ? TEAL : LINE}`,
              background: fmt === k ? "rgba(46,41,255,0.07)" : SURFACE, color: INK,
            }}>
            <span className="grid flex-none place-content-center"
              style={{ width: 36, height: 36, borderRadius: 8, background: fmt === k ? TEAL : "rgba(20,21,40,0.06)", color: fmt === k ? "#fff" : SUB }}>
              <Icon name={ic} size={20} />
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] font-extrabold">{t}</span>
              <span className="block text-[11.5px]" style={{ color: SUB }}>{sub}</span>
            </span>
          </button>
        ))}
      </div>

      {/* ── Кредит ── */}
      {!free && (
        <div className="mt-5 flex items-center justify-between gap-3 p-3.5"
          style={{ borderRadius: 4, border: `1px solid ${LINE}`, background: SURFACE }}>
          <div className="min-w-0">
            <p className="text-[13px] font-bold" style={{ color: INK }}>{credits} кредит</p>
            <p className="mt-0.5 text-[11.5px]" style={{ color: SUB }}>
              MP3 {pricing.sd} · 480p хүртэл {pricing.sd} · 720–1080p {pricing.hd} · 1440p+ {pricing.uhd} кредит
            </p>
          </div>
          <Link href="/credits/buy" className="flex-none grid place-content-center"
            style={{ ...btn(false), minHeight: 38, padding: "0 14px", fontSize: 12, textDecoration: "none" }}>
            Нэмэх
          </Link>
        </div>
      )}

      {/* ── Машины төлөв (зөвхөн agent горимд) ── */}
      {!server && <div className="mt-3 flex items-center gap-2.5 p-3.5"
        style={{ borderRadius: 4, border: `1px solid ${agent?.online ? "rgba(46,41,255,0.5)" : LINE}`, background: SURFACE }}>
        <span style={{
          width: 7, height: 7, borderRadius: "50%", flex: "none",
          background: agent?.online ? TEAL : "#4A4A54",
        }} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold" style={{ color: agent?.online ? INK : SUB }}>
            {agent === null ? "Шалгаж байна…" : oldAgent ? "Agent-аа шинэчил — MP3 нэмэгдсэн" : agent.online ? "Чиний компьютер холбогдсон" : "Компьютер холбогдоогүй"}
          </p>
          <p className="mt-0.5 truncate text-[11.5px]" style={{ color: SUB }}>
            {agent?.online
              ? (agent.outDir ? "Файл бууна: " + agent.outDir : "Татахад бэлэн")
              : agent?.exists ? "Agent-ыг компьютер дээрээ ажиллуул." : "Нэг удаа тохируулахад л хангалттай."}
          </p>
        </div>
        {needSetup && (
          <button onClick={() => setSetup(!setup)}
            style={{ ...btn(!agent?.exists), minHeight: 38, padding: "0 14px", fontSize: 12, flex: "none" }}>
            {setup ? "Хаах" : oldAgent ? "Шинэчлэх" : agent?.exists ? "Заавар" : "Холбох"}
          </button>
        )}
      </div>}

      {/* ── Тохируулах заавар ── */}
      {setup && !server && (
        <div className="mt-3 p-4" style={{ borderRadius: 4, border: `1px solid ${LINE}`, background: SURFACE }}>
          {oldAgent && (
            <p className="mb-3 p-2.5 text-[12px] leading-[1.6]" style={{ borderRadius: 4, background: "rgba(46,41,255,0.07)", color: INK }}>
              <b>MP3 нэмэгдлээ.</b> Ажиллаж буй agent-аа Ctrl+C-ээр зогсоогоод 2, 3-р алхмыг дахин хий
              (шинэ файл татаад ажиллуулна). Нууц хэвээрээ — дахин асуухгүй.
            </p>
          )}
          <p className="text-[13px] font-bold" style={{ color: INK }}>Компьютероо холбох — 4 алхам</p>
          <p className="mt-1 text-[12px] leading-[1.6]" style={{ color: SUB }}>
            Нэг л удаа. Дараа нь agent-ыг ажиллуулахад л татаж болно.
          </p>

          <ol className="mt-4 grid gap-3.5">
            <li>
              <p className="text-[12px] font-bold" style={{ color: INK }}>1. Шаардлагатай програм (macOS)</p>
              <code className="mt-1.5 block overflow-x-auto p-2.5 text-[11.5px]"
                style={CODE}>
                brew install node yt-dlp ffmpeg
              </code>
              <p className="mt-1 text-[11px]" style={{ color: SUB }}>
                Windows дээр: Node.js, yt-dlp, ffmpeg гурвыг өөрсдийн сайтаас суулга.
              </p>
            </li>
            <li>
              <p className="text-[12px] font-bold" style={{ color: INK }}>2. Agent татах</p>
              <code className="mt-1.5 block overflow-x-auto p-2.5 text-[11.5px]"
                style={CODE}>
                curl -O {AGENT_URL}
              </code>
            </li>
            <li>
              <p className="text-[12px] font-bold" style={{ color: INK }}>3. Ажиллуулах</p>
              <code className="mt-1.5 block overflow-x-auto p-2.5 text-[11.5px]"
                style={CODE}>
                node antaqor-ytgrab.js
              </code>
            </li>
            <li>
              <p className="text-[12px] font-bold" style={{ color: INK }}>4. Нууцаа асуухад тавь</p>
              {!token ? (
                <button onClick={() => void makeToken()}
                  style={{ ...btn(true), minHeight: 40, marginTop: 6, fontSize: 12 }}>
                  {agent?.exists ? "Шинэ нууц үүсгэх" : "Нууц үүсгэх"}
                </button>
              ) : (
                <>
                  <code className="mt-1.5 block break-all p-2.5 text-[11px]"
                    style={{ ...CODE, border: "1px solid rgba(46,41,255,0.40)" }}>
                    {token}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(token).then(() => setCopied(true)).catch(() => {});
                    }}
                    style={{ ...btn(false), minHeight: 38, marginTop: 8, fontSize: 12 }}>
                    {copied ? "✓ Хуулагдлаа" : "Хуулах"}
                  </button>
                  <p className="mt-2 text-[11px] leading-[1.6]" style={{ color: WARN }}>
                    Энэ нууц ДАХИН ХАРАГДАХГҮЙ. Хаявал шинээр үүсгэнэ — тэр үед
                    хуучин нь хүчингүй болно.
                  </p>
                </>
              )}
              {agent?.exists && !token && (
                <p className="mt-1.5 text-[11px]" style={{ color: SUB }}>
                  Нууц аль хэдийн үүссэн. Шинийг үүсгэвэл хуучин нь ажиллахаа болино.
                </p>
              )}
            </li>
          </ol>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2 md:flex-row">
        <input
          type="url" value={url} onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void onProbe(); }}
          placeholder="https://www.youtube.com/watch?v=…"
          spellCheck={false} autoComplete="off"
          className="w-full min-w-0 flex-none outline-none md:flex-1"
          style={{
            height: 48, padding: "0 14px", borderRadius: 4, fontSize: 14,
            background: "var(--t-surface, #FFFFFF)", color: INK, border: `1px solid ${LINE}`,
          }}
        />
        {fmt === "mp3" ? (
          <button onClick={() => void onMp3()} disabled={busy || !url.trim() || !ready || oldAgent || mp3Poor}
            className="inline-flex items-center justify-center gap-2"
            style={{ ...btn(true), height: 48, opacity: busy || !url.trim() || !ready || oldAgent || mp3Poor ? 0.45 : 1 }}>
            <Icon name="download" size={16} />{busy ? "Илгээж байна…" : "MP3 татах"}
            {!free && <span style={{ fontWeight: 600, opacity: 0.85 }}>· {mp3Cost} кр</span>}
          </button>
        ) : (
          <button onClick={() => void onProbe()} disabled={busy || !url.trim()}
            style={{ ...btn(true), height: 48, opacity: busy || !url.trim() ? 0.45 : 1 }}>
            {busy || probe?.status === "working" || probe?.status === "queued" ? "Уншиж байна…" : "Шалгах"}
          </button>
        )}
      </div>
      {!ready && (
        <p className="mt-2 text-[11.5px]" style={{ color: SUB }}>
          Шалгах, татах хоёулаа чиний компьютер дээр гүйдэг тул agent ажиллаж байх шаардлагатай.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {fmt === "mp3" ? (
        <div className="inline-flex overflow-hidden" style={{ border: `1px solid ${LINE}`, borderRadius: 4 }}>
          {MP3_KBPS.map((k) => (
            <button key={k} onClick={() => setKbps(k)} aria-pressed={kbps === k}
              style={{
                height: 36, padding: "0 14px", fontSize: 12, fontWeight: 700, border: 0, cursor: "pointer",
                background: kbps === k ? TEAL : "transparent",
                color: kbps === k ? "#fff" : SUB,
              }}>
              {k} kbps{k === 192 ? " · санал" : ""}
            </button>
          ))}
        </div>
        ) : (
        <div className="inline-flex overflow-hidden" style={{ border: `1px solid ${LINE}`, borderRadius: 4 }}>
          {(["compat", "best"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} aria-pressed={mode === m}
              style={{
                height: 36, padding: "0 14px", fontSize: 12, fontWeight: 700, border: 0, cursor: "pointer",
                background: mode === m ? TEAL : "transparent",
                color: mode === m ? "#fff" : SUB,
              }}>
              {m === "compat" ? "Засварт тохиромжтой" : "Хамгийн сайн чанар"}
            </button>
          ))}
        </div>
        )}
        {!server && <label className="flex cursor-pointer items-center gap-2 text-[12px]" style={{ color: SUB }}>
          <input type="checkbox" checked={upload} onChange={(e) => setUpload(e.target.checked)}
            style={{ accentColor: TEAL, width: 15, height: 15 }} />
          Сервер дээр ч хадгалах
        </label>}
      </div>
      <p className="mt-2 text-[12px] leading-[1.6]" style={{ color: SUB }}>
        {fmt === "mp3"
          ? "Шалгах алхамгүй — холбоосоо тавиад шууд татна. Дууны нэр, уран бүтээлч, нүүр зураг файлд шингэнэ."
          : mode === "compat"
          ? "H.264 + AAC — Premiere, After Effects, QuickTime бүгд уншина."
          : "Хамгийн дээд чанар (4K бол VP9/AV1). Зарим эвлүүлэгч уншихгүй байж магад."}
        {!server && upload && " Сервер дээр 24 цаг хадгална — утаснаас татахад."}
      </p>

      {err && (
        <p className="mt-4 p-3 text-[13px]" style={{ borderRadius: 4, border: `1px solid ${BAD}66`, color: BAD }}>
          {err}
        </p>
      )}
      {probe?.status === "error" && (
        <p className="mt-4 p-3 text-[13px]" style={{ borderRadius: 4, border: `1px solid ${BAD}66`, color: BAD }}>
          {probe.error}
        </p>
      )}

      {/* ── Мета + чанар ── */}
      {info && fmt === "mp4" && (
        <>
          <div className="mt-6 flex gap-3.5 p-3.5" style={{ borderRadius: 4, border: `1px solid ${LINE}`, background: SURFACE }}>
            {info.thumbnail && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={info.thumbnail} alt="" referrerPolicy="no-referrer"
                style={{ width: 132, aspectRatio: "16/9", objectFit: "cover", borderRadius: 4, flex: "none", background: "#F8F9FD" }} />
            )}
            <div className="min-w-0">
              <p className="line-clamp-2 text-[15px] font-bold leading-[1.35]" style={{ color: INK }}>{info.title}</p>
              <p className="mt-1.5 text-[12px]" style={{ color: SUB }}>
                {[info.uploader, fmtDur(info.duration)].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>

          <h2 className="mt-7 text-[11px] font-bold uppercase" style={{ color: SUB, letterSpacing: "0.14em" }}>
            Чанар сонго
          </h2>
          <div className="mt-2.5" style={{ borderRadius: 4, border: `1px solid ${LINE}`, background: SURFACE }}>
            <div className="flex items-center gap-3 p-3 px-3.5">
              <span className="text-[15px] font-extrabold" style={{ color: INK, minWidth: 74 }}>MP3</span>
              <span className="min-w-0 flex-1 text-[12px]" style={{ color: SUB }}>
                Зөвхөн дуу · {kbps} kbps{info.duration ? " · ~" + fmtSize(Math.round(info.duration * kbps * 125)) : ""}
              </span>
              {!free && <span className="flex-none text-[12px] font-bold tabular-nums" style={{ color: mp3Poor ? BAD : TEAL }}>{mp3Cost} кр</span>}
              <button onClick={() => void create("fetch", undefined, true)}
                disabled={!ready || oldAgent || mp3Poor}
                style={{ ...btn(false), minHeight: 38, padding: "0 14px", fontSize: 12, flex: "none", opacity: !ready || oldAgent || mp3Poor ? 0.4 : 1 }}>
                Татах
              </button>
            </div>
            {info.qualities.map((q, i) => {
              const audio = mode === "best" ? info.audioBest : info.audioCompat;
              const bytes = q.videoBytes ? (q.progressive ? q.videoBytes : q.videoBytes + audio) : 0;
              const cost = tierCost(pricing, q.height);
              const poor = !free && credits < cost;
              return (
                <div key={q.height} className="flex items-center gap-3 p-3 px-3.5"
                  style={{ borderTop: `1px solid ${LINE}` }}>
                  <span className="text-[15px] font-extrabold tabular-nums" style={{ color: INK, minWidth: 74 }}>
                    {q.height}p{q.fps >= 50 ? " " + q.fps : ""}
                  </span>
                  <span className="min-w-0 flex-1 text-[12px]" style={{ color: SUB }}>
                    {fmtSize(bytes) || "хэмжээ тодорхойгүй"}
                    {mode === "compat" && !q.avc && (
                      <span className="ml-1.5 inline-block px-1.5 py-0.5 text-[10px] font-bold"
                        style={{ border: `1px solid ${LINE}`, borderRadius: 2 }}>H.264 алга → VP9</span>
                    )}
                  </span>
                  {!free && (
                    <span className="flex-none text-[12px] font-bold tabular-nums"
                      style={{ color: poor ? BAD : TEAL }}>{cost} кр</span>
                  )}
                  <button onClick={() => void create("fetch", q.height)}
                    disabled={!ready || poor}
                    style={{
                      ...btn(false), minHeight: 38, padding: "0 14px", fontSize: 12, flex: "none",
                      opacity: !ready || poor ? 0.4 : 1,
                    }}>
                    Татах
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Татацууд ── */}
      {fetches.length > 0 && (
        <>
          <h2 className="mt-8 text-[11px] font-bold uppercase" style={{ color: SUB, letterSpacing: "0.14em" }}>
            Татацууд
          </h2>
          <div className="mt-2.5 grid gap-2.5">
            {fetches.map((j) => (
              <div key={j.id} className="p-3.5" style={{ borderRadius: 4, border: `1px solid ${LINE}`, background: SURFACE }}>
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-[13px] font-bold" style={{ color: INK }}>
                    {j.mode === "mp3" ? (titleOf(j) || "Аудио") + " · MP3 " + (j.abr || 192) + "k" : (titleOf(j) || "видео") + " · " + j.height + "p"}
                  </span>
                  <span className="flex-none text-[12px] tabular-nums"
                    style={{ color: j.status === "done" ? TEAL : j.status === "error" ? BAD : SUB }}>
                    {j.status === "done" ? "✓ Бэлэн"
                      : j.status === "error" ? "✗"
                      : j.status === "queued" ? "дараалалд"
                      : Math.round(j.pct) + "% · " + j.stage}
                  </span>
                </div>
                <div style={{ height: 3, background: LINE, borderRadius: 2, overflow: "hidden", marginTop: 8 }}>
                  <div style={{
                    height: "100%", width: j.status === "error" ? "100%" : j.pct + "%",
                    background: j.status === "error" ? BAD : TEAL, transition: "width .3s",
                  }} />
                </div>
                {j.status === "done" && (
                  <>
                    <p className="mt-2 break-all text-[11.5px]" style={{ color: SUB }}>
                      {(server ? j.fileName : j.macPath || j.fileName)} {j.fileSize ? "· " + fmtSize(j.fileSize) : ""}
                    </p>
                    {j.stored && (
                      <a href={`/api/tools/youtube/${j.id}/file`}
                        className="mt-2.5 inline-grid place-content-center"
                        style={{ ...btn(false), minHeight: 38, padding: "0 14px", fontSize: 12, textDecoration: "none" }}>
                        {server ? "Файлаа татах" : "Сервер дээрхийг татах"}
                      </a>
                    )}
                    {j.wantUpload && !j.stored && (
                      <p className="mt-2 text-[11.5px]" style={{ color: SUB }}>Сервер руу хуулж байна…</p>
                    )}
                  </>
                )}
                {j.status === "error" && (
                  <p className="mt-2 text-[12px]" style={{ color: BAD }}>
                    {j.error}{j.charged ? " · кредит буцаагдлаа" : ""}
                  </p>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <p className="mt-10 border-t pt-4 text-[11px] leading-[1.7]" style={{ borderColor: LINE, color: "#5E5E68" }}>
        {server ? "Файл сервер дээр 24 цаг хадгалагдаж, зөвхөн танд харагдана." : "Татац Antaqor-ын сервер дээр биш, зөвхөн чиний компьютер дээр гүйнэ."}
        {" "}Өөрийн болон эрх бүхий контентод хэрэглэ — платформуудын үйлчилгээний
        нөхцөл гуравдагч талын татахыг хориглодог.
      </p>
    </div>
  );
}
