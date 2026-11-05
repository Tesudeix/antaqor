"use client";
import { useEffect, useRef, useState } from "react";
import { RoomContext, RoomAudioRenderer, VideoTrack, useTracks, useLocalParticipant, useRoomContext, useConnectionState } from "@livekit/components-react";
import { ConnectionState, Room, RoomEvent, Track, type LocalVideoTrack, type RemoteParticipant } from "livekit-client";
import { openAuth } from "@/components/AuthModal";
import type { Connection } from "./Broadcast";
import css from "./live.module.css";

/* ─── Live тоглуулагч — хөтлөгч, үзэгч ХОЁУЛАНД (2026-10-09) ──────────────
   TikTok Live маяг: 9:16 тайз, видео дээр давхарга.

   ЧАТ: LiveKit data суваг (topic "chat"). Илгээгчийн НЭРИЙГ payload-аас
   БИШ сервер олгосон токены `participant.name`-аас авна — хуурамчлах
   боломжгүй. Зочны (identity "guest-…") чатыг хүлээн авагч бүр үл тооно;
   зочин зөвхөн reaction илгээнэ. Чат түүх хадгалагдахгүй (live-ийн
   мөчийн яриа) — сүүлд нэгдсэн хүн өмнөхийг харахгүй.

   REACTION: topic "reaction", 6 emoji, илгээгч бүрт 400мс-ийн хаалт. */

export type Capture = { stream: MediaStream; mode: "camera" | "screen"; facing?: "user" | "environment" };

const EMOJI = ["❤️", "🔥", "👏", "😂", "😮", "💡"] as const;
const MAX_CHAT = 200;
type Msg = { id: number; name: string; text: string; host?: boolean; sys?: boolean };

function elapsed(startedAt: string | null | undefined, now: number) {
  if (!startedAt) return "";
  const s = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return (h ? `${h}:${String(m).padStart(2, "0")}` : String(m)) + `:${String(sec).padStart(2, "0")}`;
}

type SessionProps = {
  host: boolean; canChat: boolean; viewers: number; title: string; startedAt: string | null;
  initialFacing: "user" | "environment"; onEnd?: () => void; ending?: boolean;
};

function Session({ host, canChat, viewers, title, startedAt, initialFacing, onEnd, ending }: SessionProps) {
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const connected = connectionState === ConnectionState.Connected;
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare]);
  const screen = tracks.find((t) => t.source === Track.Source.ScreenShare && !t.publication.isMuted);
  const track = screen || tracks.find((t) => t.source === Track.Source.Camera && !t.publication.isMuted);
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();

  const [muted, setMuted] = useState(!host);
  const [facing, setFacing] = useState(initialFacing);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [picker, setPicker] = useState(false);
  const [floats, setFloats] = useState<{ id: number; emoji: string; x: number }[]>([]);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const seq = useRef(0);
  const lastChat = useRef(0);
  const lastReact = useRef(0);
  const seen = useRef(new Map<string, number>());

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const pushMsg = (m: Omit<Msg, "id">) => setMsgs((list) => [...list.slice(-40), { ...m, id: ++seq.current }]);
  const showFloat = (emoji: string) =>
    setFloats((f) => [...f.slice(-16), { id: ++seq.current, emoji, x: 10 + Math.random() * 50 }]);

  useEffect(() => {
    const receive = (payload: Uint8Array, participant?: RemoteParticipant, _kind?: unknown, topic?: string) => {
      const who = participant?.identity || "";
      if (topic === "reaction") {
        if (payload.length > 32) return;
        const t = Date.now();
        if (t - (seen.current.get(who) || 0) < 400) return;
        const emoji = new TextDecoder().decode(payload);
        if (!(EMOJI as readonly string[]).includes(emoji)) return;
        seen.current.set(who, t);
        showFloat(emoji);
        return;
      }
      if (topic === "chat") {
        // Зочин чат бичихгүй; нэр нь токеноос.
        if (!(who === "host" || who.startsWith("u-")) || payload.length > 1024) return;
        try {
          const { text } = JSON.parse(new TextDecoder().decode(payload)) as { text?: unknown };
          if (typeof text !== "string" || !text.trim()) return;
          pushMsg({ name: participant?.name || "Гишүүн", text: text.trim().slice(0, MAX_CHAT), host: who === "host" });
        } catch { /* буруу payload */ }
      }
    };
    const joined = (p: RemoteParticipant) => { if (host && p.identity !== "host") pushMsg({ name: p.name || "Үзэгч", text: "нэгдлээ 👋", sys: true }); };
    room.on(RoomEvent.DataReceived, receive);
    room.on(RoomEvent.ParticipantConnected, joined);
    return () => { room.off(RoomEvent.DataReceived, receive); room.off(RoomEvent.ParticipantConnected, joined); };
  }, [room, host]);

  async function react(emoji: string) {
    if (!connected || Date.now() - lastReact.current < 400) return;
    lastReact.current = Date.now();
    showFloat(emoji);
    try { await localParticipant.publishData(new TextEncoder().encode(emoji), { reliable: false, topic: "reaction" }); }
    catch { /* reaction алдаа нь чухал биш */ }
  }

  async function sendChat(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim().slice(0, MAX_CHAT);
    if (!text || !connected || !canChat) return;
    if (Date.now() - lastChat.current < 1000) { setError("Арай удаан бичээрэй 🙂"); return; }
    lastChat.current = Date.now();
    try {
      await localParticipant.publishData(new TextEncoder().encode(JSON.stringify({ text })), { reliable: true, topic: "chat" });
      pushMsg({ name: host ? "Antaqor" : "Та", text, host });
      setDraft(""); setError("");
    } catch { setError("Илгээж чадсангүй. Дахин оролдоно уу."); }
  }

  async function guard(fn: () => Promise<unknown>) {
    setError("");
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "Төхөөрөмжийн зөвшөөрлөө шалгана уу."); }
  }

  const flip = () => guard(async () => {
    const pub = localParticipant.getTrackPublication(Track.Source.Camera);
    const vt = pub?.videoTrack as LocalVideoTrack | undefined;
    if (!vt) throw new Error("Камер олдсонгүй");
    const next = facing === "user" ? "environment" : "user";
    await vt.restartTrack({ facingMode: next, resolution: { width: 720, height: 1280 } });
    setFacing(next);
  });

  const isScreen = !!screen;
  const mirror = host && !isScreen && facing === "user";

  return (
    <>
      <div className={`${css.video} ${isScreen ? css.contain : ""} ${mirror ? css.mirror : ""}`}>
        {track ? <VideoTrack trackRef={track} /> : <p className={css.center}>{connected ? "Дүрсийг хүлээж байна…" : "Холбогдож байна…"}</p>}
      </div>
      <RoomAudioRenderer volume={muted ? 0 : 1} />

      {/* Дээд давхарга */}
      <div className={css.top}>
        <div>
          <div className={css.badges}>
            <span className={css.liveBadge}>● LIVE</span>
            <span className={css.pill}>👁 {viewers}</span>
            {startedAt && <span className={css.pill}>{elapsed(startedAt, now)}</span>}
          </div>
          {title && <div className={css.liveTitle}>{title}</div>}
        </div>
        <div className={css.topBtns}>
          {host ? (
            <>
              <button className={css.endBtn} onClick={onEnd} disabled={ending}>{ending ? "…" : "Дуусгах"}</button>
              <button className={`${css.round} ${isMicrophoneEnabled ? "" : css.on}`} aria-label={isMicrophoneEnabled ? "Микрофон хаах" : "Микрофон асаах"}
                onClick={() => guard(() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled))} disabled={!connected}>
                {isMicrophoneEnabled ? "🎙" : "🔇"}
              </button>
              {!isScreen && <button className={css.round} aria-label="Камер солих" onClick={flip} disabled={!connected}>🔄</button>}
            </>
          ) : (
            <button className={css.round} aria-label="Бүтэн дэлгэц"
              onClick={() => guard(async () => {
                const el = document.getElementById(`broadcast-${room.name}`);
                if (document.fullscreenElement) await document.exitFullscreen(); else await el?.requestFullscreen();
              })}>⛶</button>
          )}
        </div>
      </div>

      {!host && muted && connected && (
        <button className={css.soundHint} onClick={() => guard(async () => { await room.startAudio(); setMuted(false); })}>🔇 Дуу асаахын тулд дар</button>
      )}

      {/* Чат урсгал */}
      <div className={css.chat} aria-live="polite">
        {msgs.slice(-8).map((m) => (
          <div key={m.id} className={css.msg}>
            <span className={`${css.msgName} ${m.host ? css.msgHost : ""}`}>{m.name}{m.host ? " · хөтлөгч" : ""}</span>
            <span className={m.sys ? css.msgSys : ""}>{m.text}</span>
          </div>
        ))}
      </div>

      {/* Хөвөх reaction */}
      <div className={css.floats} aria-hidden>
        {floats.map((f) => (
          <span key={f.id} className={css.float} style={{ left: `${f.x}%` }} onAnimationEnd={() => setFloats((items) => items.filter((i) => i.id !== f.id))}>{f.emoji}</span>
        ))}
      </div>

      {picker && (
        <div className={css.emojiBar}>
          {EMOJI.map((e) => <button key={e} onClick={() => void react(e)} aria-label={`${e} reaction`}>{e}</button>)}
        </div>
      )}

      {/* Доод мөр */}
      <form className={css.bottom} onSubmit={sendChat}>
        {canChat ? (
          <input className={css.input} value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={MAX_CHAT}
            placeholder={host ? "Үзэгчидтэй ярилц…" : "Сэтгэгдэл бичих…"} enterKeyHint="send" aria-label="Чат" />
        ) : (
          <button type="button" className={css.loginChat} onClick={() => openAuth("signin")}>Чатлахын тулд нэвтрэх</button>
        )}
        <button type="button" className={css.round} aria-label="Emoji" onClick={() => setPicker((p) => !p)}>😊</button>
        <button type="button" className={`${css.round} ${css.heart}`} aria-label="Зүрх илгээх" onClick={() => void react("❤️")}>❤</button>
      </form>

      {error && <p role="alert" className={css.error} style={{ position: "absolute", left: 12, bottom: 58, zIndex: 5 }}>{error}</p>}
    </>
  );
}

export default function BroadcastPlayer({
  connection, host = false, capture, onDisconnected, viewers = 0, title = "", startedAt = null, compact = false, onEnd, ending,
}: {
  connection: Connection; host?: boolean; capture?: Capture; onDisconnected?: () => void;
  viewers?: number; title?: string; startedAt?: string | null; compact?: boolean; onEnd?: () => void; ending?: boolean;
}) {
  const [room] = useState(() => new Room({ adaptiveStream: true, dynacast: true }));
  const [error, setError] = useState("");
  const disconnected = useRef(onDisconnected);
  useEffect(() => { disconnected.current = onDisconnected; }, [onDisconnected]);
  useEffect(() => {
    let disposed = false;
    const end = () => { if (!disposed) disconnected.current?.(); };
    room.on(RoomEvent.Disconnected, end);
    void (async () => {
      try {
        await room.connect(connection.serverUrl, connection.token);
        if (disposed) { await room.disconnect(); return; }
        if (capture) {
          for (const track of capture.stream.getTracks()) {
            if (disposed) break;
            await room.localParticipant.publishTrack(track, {
              source: track.kind === "video"
                ? (capture.mode === "screen" ? Track.Source.ScreenShare : Track.Source.Camera)
                : (capture.mode === "screen" ? Track.Source.ScreenShareAudio : Track.Source.Microphone),
            });
          }
        }
        await room.startAudio().catch(() => {});
      } catch (e) { if (!disposed) setError(e instanceof Error ? e.message : "Холболт амжилтгүй."); }
    })();
    return () => { disposed = true; room.off(RoomEvent.Disconnected, end); void room.disconnect(); capture?.stream.getTracks().forEach((t) => t.stop()); };
  }, [room, connection.serverUrl, connection.token, capture]);

  return (
    <div id={`broadcast-${connection.room}`} className={`${css.stage} ${compact ? css.compact : ""}`}>
      <RoomContext.Provider value={room}>
        <Session
          host={host}
          canChat={host || !!connection.canChat}
          viewers={viewers}
          title={title}
          startedAt={startedAt}
          initialFacing={capture?.facing || "user"}
          onEnd={onEnd}
          ending={ending}
        />
      </RoomContext.Provider>
      {error && <p role="alert" className={css.error} style={{ position: "absolute", top: 60, left: 12, zIndex: 6 }}>{error}</p>}
    </div>
  );
}
