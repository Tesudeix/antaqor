"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BroadcastPlayer, broadcastRequest, useBroadcast, formatUB, type Connection } from "@/components/live/Broadcast";
import type { Capture } from "@/components/live/BroadcastPlayer";
import css from "@/components/live/live.module.css";

/* ─── LIVE СТУДИ — утсаар шууд live хийх (2026-10-09) ─────────────────────
   Утсан дээр 3 алхам: (1) хуудас нээгдмэгц урд камерын 9:16 урьдчилсан
   харагдац, (2) гарчиг, (3) "● LIVE эхлүүлэх". Камер солих (урд/ар) нь
   live-аас өмнө ч, live үед ч ажиллана.

   Урьдчилсан харагдацын stream нь live эхлэхэд ШУУД дамжуулалт руу
   шилждэг (дахин зөвшөөрөл асуухгүй, хар дэлгэц анивчихгүй).
   Дэлгэц хуваалцах нь зөвхөн дэмждэг төхөөрөмж дээр (iOS Safari-д байхгүй).
   Хуваарь: олон товлолт, тус бүрийг устгаж болно. */

const VIDEO = (facing: "user" | "environment"): MediaTrackConstraints => ({
  facingMode: facing, width: { ideal: 720 }, height: { ideal: 1280 }, aspectRatio: { ideal: 9 / 16 },
});

function localInputValue(d: Date) {
  // datetime-local нь Улаанбаатарын цагаар (UTC+8) — хөтлөгч Монголд.
  return new Date(d.getTime() + 8 * 3600_000).toISOString().slice(0, 16);
}

export default function LiveStudio() {
  const state = useBroadcast();
  const [title, setTitle] = useState("Бодит ажлыг live-аар үзүүл.");
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [preview, setPreview] = useState<MediaStream | null>(null);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [capture, setCapture] = useState<Capture>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sTitle, setSTitle] = useState("");
  const [sAt, setSAt] = useState(() => localInputValue(new Date(Date.now() + 86400_000)));
  const [saved, setSaved] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<MediaStream | null>(null);
  const canScreen = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia && !/iPhone|iPad|Android/i.test(navigator.userAgent);

  async function openCamera(next: "user" | "environment") {
    setError("");
    previewRef.current?.getTracks().forEach((t) => t.stop());
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: VIDEO(next), audio: true });
      previewRef.current = s; setPreview(s); setFacing(next);
    } catch (e) {
      previewRef.current = null; setPreview(null);
      setError(e instanceof DOMException && e.name === "NotAllowedError"
        ? "Камер, микрофоны зөвшөөрөл өгөөд дахин оролдоно уу." : "Камер нээж чадсангүй.");
    }
  }

  // Хуудас нээгдмэгц урьдчилсан харагдац (live биш үед).
  useEffect(() => {
    if (!state.live && !connection) void openCamera("user");
    return () => { previewRef.current?.getTracks().forEach((t) => t.stop()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (videoRef.current) videoRef.current.srcObject = preview; }, [preview]);

  async function goLive(mode: "camera" | "screen") {
    setBusy(true); setError(""); setSaved("");
    let stream: MediaStream | null = null;
    try {
      if (mode === "screen") {
        stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      } else {
        stream = previewRef.current || await navigator.mediaDevices.getUserMedia({ video: VIDEO(facing), audio: true });
      }
      const result = await broadcastRequest({ action: "start", title });
      if (mode === "screen") previewRef.current?.getTracks().forEach((t) => t.stop());
      previewRef.current = null; setPreview(null);   // stream-ийн эзэн одоо capture
      setCapture({ stream, mode, facing }); setConnection(result);
      state.refresh();
    } catch (e) {
      if (mode === "screen") stream?.getTracks().forEach((t) => t.stop());
      setError(e instanceof DOMException && e.name === "NotAllowedError" ? "Зөвшөөрөл өгөөд дахин дарна уу." : e instanceof Error ? e.message : "Холболт амжилтгүй.");
    } finally { setBusy(false); }
  }

  async function stop() {
    const room = connection?.room || state.room; if (!room) return;
    if (!confirm("Live-аа дуусгах уу?")) return;
    setBusy(true); setError("");
    try {
      await broadcastRequest({ action: "stop", room });
      capture?.stream.getTracks().forEach((t) => t.stop());
      setConnection(null); setCapture(undefined);
      state.refresh();
      void openCamera(facing);
    } catch (e) { setError(e instanceof Error ? e.message : "Зогсоож чадсангүй."); }
    finally { setBusy(false); }
  }

  async function addSchedule() {
    setBusy(true); setError(""); setSaved("");
    try {
      await broadcastRequest({ action: "schedule", title: sTitle.trim(), startsAt: new Date(`${sAt}:00+08:00`).toISOString() });
      setSaved("Хуваарьт нэмэгдлээ — нүүр, live хуудсанд харагдана."); setSTitle(""); state.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Өдөр, цагаа шалгана уу."); }
    finally { setBusy(false); }
  }

  async function removeSchedule(id?: string) {
    if (!id || !confirm("Энэ товлолтыг устгах уу?")) return;
    setBusy(true); setError("");
    try { await broadcastRequest({ action: "cancelSchedule", id }); state.refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Устгаж чадсангүй."); }
    finally { setBusy(false); }
  }

  const schedules = state.schedules ?? [];

  return (
    <div className={css.studio}>
      {/* ═══ ТАЙЗ ═══ */}
      <div>
        {connection ? (
          <BroadcastPlayer
            connection={connection}
            host
            capture={capture}
            viewers={state.viewers}
            title={state.title || title}
            startedAt={state.startedAt ?? new Date().toISOString()}
            onEnd={stop}
            ending={busy}
            onDisconnected={() => { setConnection(null); setCapture(undefined); }}
          />
        ) : (
          <div className={css.stage}>
            <div className={`${css.video} ${facing === "user" ? css.mirror : ""}`}>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video ref={videoRef} autoPlay playsInline muted />
            </div>
            {!preview && (
              <div className={css.center}>
                <p>Камерын урьдчилсан харагдац</p>
                <button className={css.primary} onClick={() => void openCamera(facing)}>📷 Камер асаах</button>
              </div>
            )}
            <div className={css.top}>
              <div className={css.badges}><span className={css.pill}>Урьдчилсан харагдац</span></div>
              <div className={css.topBtns}>
                <button className={css.round} aria-label="Камер солих" onClick={() => void openCamera(facing === "user" ? "environment" : "user")}>🔄</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══ УДИРДЛАГА ═══ */}
      <div className={css.side}>
        <div className={css.row} style={{ justifyContent: "space-between" }}>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>Live студи</h1>
          <Link href="/live/broadcast" target="_blank" className={css.link}>Үзэгчийн хуудас ↗</Link>
        </div>

        {!connection && (
          <div className={css.card}>
            <label className={css.label}>
              Гарчиг
              <input className={css.field} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
            </label>
            <button className={css.goLive} onClick={() => void goLive("camera")} disabled={busy || !title.trim()}>
              {busy ? "Холбогдож байна…" : "● LIVE эхлүүлэх"}
            </button>
            {canScreen && (
              <button className={css.secondary} onClick={() => void goLive("screen")} disabled={busy || !title.trim()}>🖥 Дэлгэц хуваалцаж эхлэх</button>
            )}
            <p className={css.muted}>Live нийтэд нээлттэй. Үзэгчид reaction илгээж, нэвтэрсэн гишүүд чатлана.</p>
          </div>
        )}
        {connection && (
          <div className={css.card}>
            <span className={css.liveBadge} style={{ alignSelf: "flex-start" }}>● LIVE · {state.viewers} үзэж байна</span>
            <p className={css.muted}>Чат, reaction тайзан дээр шууд харагдана. Камер солих, микрофон, дуусгах товч нь баруун дээд буланд.</p>
          </div>
        )}
        {error && <p role="alert" className={css.error}>{error}</p>}

        {/* ── Хуваарь ── */}
        <div className={css.card}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>Хуваарь</div>
          {schedules.length === 0 && <p className={css.muted}>Товлосон live алга.</p>}
          <div className={css.list}>
            {schedules.map((s) => (
              <div key={s.id || s.startsAt} className={css.item}>
                <div style={{ minWidth: 0 }}>
                  <div className={css.itemTitle}>{s.title}</div>
                  <div className={css.itemWhen}>{formatUB(s.startsAt)}</div>
                </div>
                {s.id && <button className={css.del} onClick={() => void removeSchedule(s.id)} disabled={busy}>Устгах</button>}
              </div>
            ))}
          </div>
          <label className={css.label}>
            Гарчиг
            <input className={css.field} value={sTitle} onChange={(e) => setSTitle(e.target.value)} maxLength={200} placeholder="Жишээ: AI агент бүтээх" />
          </label>
          <label className={css.label}>
            Өдөр, цаг · Улаанбаатар
            <input className={css.field} type="datetime-local" value={sAt} onChange={(e) => setSAt(e.target.value)} />
          </label>
          <button className={css.primary} onClick={() => void addSchedule()} disabled={busy || !sTitle.trim() || !sAt}>＋ Хуваарьт нэмэх</button>
          {saved && <p role="status" className={css.link}>{saved}</p>}
        </div>
      </div>
    </div>
  );
}
