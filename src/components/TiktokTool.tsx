"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

/* ─── TIKTOK → MP4 ──────────────────────────────────────────────────────
   Нэг эсвэл олон холбоос (мөр бүрт нэг) — богино драмын анги анги
   цувралыг нэг дор буулгахад. Шалгах нь үнэгүй; татах нь СЕРВЕР дээр
   гүйгээд дуусмагц хөтөч өөрөө хадгална. */

const INK = "var(--t-ink, #F2F2F4)";
const SUB = "var(--t-sub, #9C9CA6)";
const LINE = "var(--t-line, rgba(255,255,255,0.12))";
const SURFACE = "var(--t-surface, #171320)";
const TEAL = "var(--accent-ink, #2E29FF)";
const BAD = "#C81E4A";

type Quality = "best" | "compat";
interface Variant { height: number; codec: string; bytes: number }
interface Info { id: string; title: string; uploader: string; duration: number; thumbnail: string; best: Variant | null; compat: Variant | null }
interface Job { id: string; title: string; quality: Quality; status: "working" | "done" | "error"; pct: number; error: string; size: number; createdAt: number }
interface Item { url: string; state: "probing" | "ready" | "error"; info?: Info; error?: string; jobId?: string; fetchErr?: string }

const fmtSize = (b: number) => (!b ? "" : b >= 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.round(b / 1024) + " KB");
const fmtDur = (s: number) => { s = Math.round(s || 0); return s ? Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0") : ""; };

const btn = (on: boolean): React.CSSProperties => ({
  minHeight: 44, padding: "0 18px", borderRadius: 4, fontSize: 13, fontWeight: 700,
  background: on ? TEAL : "transparent", color: on ? "#06222A" : INK,
  border: on ? "1px solid transparent" : `1px solid ${LINE}`, cursor: "pointer",
});

function save(id: string) {
  const a = document.createElement("a");
  a.href = `/api/tools/tiktok/file/${id}`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export default function TiktokTool() {
  const [text, setText] = useState("");
  const [quality, setQuality] = useState<Quality>("best");
  const [items, setItems] = useState<Item[]>([]);
  const [jobs, setJobs] = useState<Record<string, Job>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const saved = useRef<Set<string>>(new Set());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/tools/tiktok", { cache: "no-store" });
      const d = await r.json();
      if (Array.isArray(d.jobs)) {
        const map: Record<string, Job> = {};
        for (const j of d.jobs as Job[]) map[j.id] = j;
        setJobs(map);
      }
    } catch { /* дараагийн эргэлтэд */ }
  }, []);

  useEffect(() => { void load(); }, [load]);

  /* Ажил явж байвал 1.5с тутам. Дуусмагц (энэ хуудсанд эхлүүлсэн бол)
     автоматаар хадгална — хүн "Хадгалах" дээр дахин дарах шаардлагагүй. */
  const live = Object.values(jobs).some((j) => j.status === "working");
  useEffect(() => {
    if (!live) return;
    timer.current = setTimeout(() => void load(), 1500);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [jobs, live, load]);

  useEffect(() => {
    for (const it of items) {
      const j = it.jobId ? jobs[it.jobId] : null;
      if (j?.status === "done" && !saved.current.has(j.id)) { saved.current.add(j.id); save(j.id); }
    }
  }, [jobs, items]);

  const patch = (i: number, p: Partial<Item>) => setItems((xs) => xs.map((x, k) => (k === i ? { ...x, ...p } : x)));

  async function onProbe() {
    const urls = [...new Set((text.match(/https?:\/\/[^\s,]+/g) || []).map((u) => u.trim()))].slice(0, 20);
    if (!urls.length) { setErr("TikTok холбоос оруулна уу."); return; }
    setErr(""); setBusy(true);
    setItems(urls.map((url) => ({ url, state: "probing" })));
    /* Нэг нэгээр — серверийг нэг дор 20 yt-dlp процессоор дарахгүй. */
    for (let i = 0; i < urls.length; i++) {
      try {
        const r = await fetch("/api/tools/tiktok", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "probe", url: urls[i] }),
        });
        const d = await r.json();
        if (r.ok) patch(i, { state: "ready", info: d.info });
        else patch(i, { state: "error", error: d.error || "Уншиж чадсангүй" });
      } catch { patch(i, { state: "error", error: "Сүлжээний алдаа" }); }
    }
    setBusy(false);
  }

  async function onFetch(i: number) {
    const it = items[i];
    if (!it?.info) return;
    patch(i, { fetchErr: "" });
    const r = await fetch("/api/tools/tiktok", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "fetch", url: it.url, quality, title: it.info.title }),
    });
    const d = await r.json();
    if (!r.ok) { patch(i, { fetchErr: d.error || "Эхлүүлж чадсангүй" }); return; }
    patch(i, { jobId: d.job.id });
    setJobs((m) => ({ ...m, [d.job.id]: d.job }));
  }

  /* "Бүгдийг татах": серверийн хэрэглэгч тус бүрийн хязгаар 2 тул
     нэг нэгээр нь — өмнөх нь дуусахыг хүлээгээд дараагийнхыг эхлүүлнэ. */
  const jobsRef = useRef(jobs);
  jobsRef.current = jobs;
  const [queued, setQueued] = useState(0);

  async function fetchAll() {
    const todo = items.map((x, i) => (x.state === "ready" && !x.jobId ? i : -1)).filter((i) => i >= 0);
    for (let k = 0; k < todo.length; k++) {
      setQueued(todo.length - k - 1);
      const r = await fetch("/api/tools/tiktok", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "fetch", url: items[todo[k]].url, quality, title: items[todo[k]].info?.title || "" }),
      });
      const d = await r.json();
      if (!r.ok) { patch(todo[k], { fetchErr: d.error || "Эхлүүлж чадсангүй" }); continue; }
      patch(todo[k], { jobId: d.job.id });
      setJobs((m) => ({ ...m, [d.job.id]: d.job }));
      while (jobsRef.current[d.job.id]?.status !== "done" && jobsRef.current[d.job.id]?.status !== "error") {
        await new Promise((res) => setTimeout(res, 1500));
      }
    }
    setQueued(0);
  }

  const readyCount = items.filter((x) => x.state === "ready" && !x.jobId).length;

  return (
    <div className="mx-auto w-full max-w-[760px] px-4 pb-20 pt-2 md:px-0">
      <p className="text-[11px] font-bold uppercase" style={{ color: TEAL, letterSpacing: "0.16em" }}>Хэрэгсэл</p>
      <h1 className="mt-1.5 text-[28px] font-extrabold leading-[1.15] md:text-[34px]" style={{ color: INK }}>
        TikTok → mp4
      </h1>
      <p className="mt-2 text-[14px] leading-[1.7]" style={{ color: SUB }}>
        Клип, богино видео — холбоосоо тавиад л татна. Усан тэмдэггүй, 1080p хүртэл.
        Олон холбоос бол мөр бүрт нэг.
      </p>

      <textarea
        value={text} onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void onProbe(); }}
        placeholder={"https://www.tiktok.com/@user/video/…\nhttps://vt.tiktok.com/…"}
        spellCheck={false} rows={3}
        className="mt-5 block w-full resize-y outline-none"
        style={{ padding: "12px 14px", borderRadius: 4, fontSize: 14, lineHeight: 1.6, background: SURFACE, color: INK, border: `1px solid ${LINE}` }}
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={() => void onProbe()} disabled={busy || !text.trim()}
          style={{ ...btn(true), opacity: busy || !text.trim() ? 0.45 : 1 }}>
          {busy ? "Уншиж байна…" : "Шалгах"}
        </button>
        <div className="inline-flex overflow-hidden" style={{ border: `1px solid ${LINE}`, borderRadius: 4 }}>
          {(["best", "compat"] as const).map((m) => (
            <button key={m} onClick={() => setQuality(m)} aria-pressed={quality === m}
              style={{
                height: 44, padding: "0 14px", fontSize: 12, fontWeight: 700, border: 0, cursor: "pointer",
                background: quality === m ? TEAL : "transparent", color: quality === m ? "#06222A" : SUB,
              }}>
              {m === "best" ? "Дээд чанар" : "Засварт тохиромжтой"}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-2 text-[12px] leading-[1.6]" style={{ color: SUB }}>
        {quality === "best"
          ? "Хамгийн өндөр нягтрал (ихэвчлэн 1080p, H.265). iPhone, Mac, шинэ Android уншина."
          : "H.264 — Premiere, CapCut, Windows, хуучин утас бүгд уншина. Заримдаа 540p."}
      </p>

      {err && (
        <p className="mt-4 p-3 text-[13px]" style={{ borderRadius: 4, border: `1px solid ${BAD}66`, color: "#FF9DB4" }}>{err}</p>
      )}

      {items.length > 1 && readyCount > 1 && (
        <button onClick={() => void fetchAll()} disabled={queued > 0} className="mt-6" style={{ ...btn(false), width: "100%" }}>
          Бүгдийг татах ({readyCount})
        </button>
      )}
      {queued > 0 && (
        <p className="mt-2 text-[12px]" style={{ color: SUB }}>Дараалалд {queued} үлдлээ…</p>
      )}

      <div className="mt-4 grid gap-2.5">
        {items.map((it, i) => {
          const j = it.jobId ? jobs[it.jobId] : null;
          const v = it.info ? (quality === "best" ? it.info.best : it.info.compat || it.info.best) : null;
          return (
            <div key={it.url + i} className="flex gap-3 p-3" style={{ borderRadius: 4, border: `1px solid ${LINE}`, background: SURFACE }}>
              <div style={{ width: 64, aspectRatio: "9/16", flex: "none", borderRadius: 4, overflow: "hidden", background: "#F8F9FD" }}>
                {it.info?.thumbnail && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={it.info.thumbnail} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                {it.state === "probing" && <p className="text-[13px]" style={{ color: SUB }}>Уншиж байна…</p>}
                {it.state === "error" && (
                  <>
                    <p className="truncate text-[12px]" style={{ color: SUB }}>{it.url}</p>
                    <p className="mt-1 text-[13px]" style={{ color: "#FF9DB4" }}>{it.error}</p>
                  </>
                )}
                {it.info && (
                  <>
                    <p className="line-clamp-2 text-[14px] font-bold leading-[1.35]" style={{ color: INK }}>{it.info.title}</p>
                    <p className="mt-1 text-[12px]" style={{ color: SUB }}>
                      {[it.info.uploader && "@" + it.info.uploader, fmtDur(it.info.duration),
                        v && `${v.height}p ${v.codec}`, v && fmtSize(v.bytes)].filter(Boolean).join(" · ")}
                    </p>
                    <div className="mt-auto pt-2.5">
                      {!j && (
                        <button onClick={() => void onFetch(i)} style={{ ...btn(true), minHeight: 38, fontSize: 12 }}>Татах</button>
                      )}
                      {j?.status === "working" && (
                        <div>
                          <div style={{ height: 4, borderRadius: 2, background: LINE, overflow: "hidden" }}>
                            <div style={{ width: `${Math.max(4, j.pct)}%`, height: "100%", background: TEAL, transition: "width .4s" }} />
                          </div>
                          <p className="mt-1.5 text-[12px] tabular-nums" style={{ color: SUB }}>Сервер татаж байна… {j.pct}%</p>
                        </div>
                      )}
                      {j?.status === "done" && (
                        <a href={`/api/tools/tiktok/file/${j.id}`} className="inline-grid place-content-center"
                          style={{ ...btn(false), minHeight: 38, fontSize: 12, textDecoration: "none", borderColor: TEAL, color: TEAL }}>
                          ✓ Хадгалах · {fmtSize(j.size)}
                        </a>
                      )}
                      {j?.status === "error" && <p className="text-[12px]" style={{ color: "#FF9DB4" }}>{j.error}</p>}
                      {it.fetchErr && <p className="mt-1 text-[12px]" style={{ color: "#FF9DB4" }}>{it.fetchErr}</p>}
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-8 text-[11.5px] leading-[1.7]" style={{ color: SUB }}>
        Файл сервер дээр 1 цаг хадгалагдаад устна. Зөвхөн нийтэд нээлттэй TikTok видео — хаалттай бичлэг,
        зургийн слайд, TikTok Short Drama (нэвтрэлт шаарддаг), Douyin/Instagram дэмжихгүй. Бусдын бүтээлийг зөвшөөрөлгүй дахин нийтлэхгүй байна уу.
        YouTube бол <Link href="/tools/youtube" style={{ color: TEAL }}>энд</Link>.
      </p>
    </div>
  );
}
