"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, Btn, SectionHeader, Status, Empty, Spinner, T, MONO } from "@/components/admin/kit";

// ─── TikTok — Login Kit + Content Posting (Direct Post) ───
//
// Дарааллыг ЗОРИУД нэг дэлгэц дээр шугаман байдлаар барьсан: App Review-д
// энэ урсгалыг бүтнээр нь бичлэг хийх шаардлагатай тул алхам бүр харагдах
// ёстой — холбох → бүтээгчийг харах → рийл сонгох → урьдчилж үзэх →
// тайлбар → нууцлал → тодорхой "Нийтлэх" → байдал.
//
// ЧУХАЛ: нууцлалын сонголт, сэтгэгдэл/duet/stitch-ийн боломж нь ЭНД
// хатуу бичигдээгүй. Бүгд `creator_info` API-аас ирнэ. TikTok-ийн дүрэм
// бөгөөд акаунт бүрт (мөн Sandbox-д) өөр байдаг.

interface CreatorInfo {
  creator_avatar_url: string;
  creator_username: string;
  creator_nickname: string;
  privacy_level_options: string[];
  comment_disabled: boolean;
  duet_disabled: boolean;
  stitch_disabled: boolean;
  max_video_post_duration_sec: number;
}

interface Conn {
  configured: boolean;
  connected: boolean;
  needsReconnect?: boolean;
  username?: string;
  nickname?: string;
  avatarUrl?: string;
  scopes?: string[];
  lastError?: string;
}

interface Reel {
  id: string;
  kind: "aivideo" | "aicreation";
  videoUrl: string;
  prompt: string;
  durationSec: number;
  aspectRatio: string;
  bytes: number;
}

/* Зөвхөн ХАРАГДАХ нэр. Жагсаалт нь TikTok-оос ирнэ — энэ нь орчуулга
   төдий. Танихгүй утга ирвэл түүхийгээр нь харуулна. */
const PRIVACY_LABEL: Record<string, string> = {
  PUBLIC_TO_EVERYONE: "Нийтэд ил (Public)",
  MUTUAL_FOLLOW_FRIENDS: "Харилцан дагагчид (Friends)",
  FOLLOWER_OF_CREATOR: "Дагагчид (Followers)",
  SELF_ONLY: "Зөвхөн би (Private)",
};

const STATUS_LABEL: Record<string, string> = {
  QUEUED: "Дараалалд",
  UPLOADING: "Илгээж байна",
  PROCESSING: "TikTok боловсруулж байна",
  PUBLISHED: "Нийтлэгдлээ",
  FAILED: "Амжилтгүй",
};

function mb(bytes: number) {
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export default function TikTokStudio() {
  const [conn, setConn] = useState<Conn | null>(null);
  const [info, setInfo] = useState<CreatorInfo | null>(null);
  const [infoError, setInfoError] = useState("");
  const [reels, setReels] = useState<Reel[]>([]);
  const [selected, setSelected] = useState<Reel | null>(null);

  const [caption, setCaption] = useState("");
  const [privacy, setPrivacy] = useState("");
  const [allowComment, setAllowComment] = useState(true);
  const [allowDuet, setAllowDuet] = useState(true);
  const [allowStitch, setAllowStitch] = useState(true);
  const [isAigc, setIsAigc] = useState(true); // манай рийлүүд AI-аар үүсдэг

  const [publishing, setPublishing] = useState(false);
  const [publishId, setPublishId] = useState("");
  const [status, setStatus] = useState("");
  const [tiktokStatus, setTiktokStatus] = useState("");
  const [error, setError] = useState("");
  const [banner, setBanner] = useState("");

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // OAuth-аас буцаж ирэхэд ?connected=1 / ?error= — хоёуланг нь харуулна.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("connected") === "1") setBanner("TikTok амжилттай холбогдлоо.");
    const e = p.get("error");
    if (e) setError(e);
    if (p.get("connected") || e) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const loadConn = useCallback(async () => {
    try {
      const r = await fetch("/api/tiktok/connection");
      setConn(await r.json());
    } catch {
      setConn({ configured: false, connected: false });
    }
  }, []);

  useEffect(() => {
    loadConn();
  }, [loadConn]);

  // Холбогдсон бол л бүтээгчийн мэдээлэл + рийлүүдийг татна.
  useEffect(() => {
    if (!conn?.connected) return;
    (async () => {
      try {
        const r = await fetch("/api/tiktok/creator-info");
        const d = await r.json();
        if (!r.ok) {
          setInfoError(d.error || "creator_info татагдсангүй.");
          if (d.needsReconnect) loadConn();
          return;
        }
        setInfo(d);
        // Анхны нууцлалыг ТААМАГЛАХГҮЙ — TikTok-ийн эхний сонголтыг авна.
        setPrivacy(d.privacy_level_options?.[0] || "");
        if (d.comment_disabled) setAllowComment(false);
        if (d.duet_disabled) setAllowDuet(false);
        if (d.stitch_disabled) setAllowStitch(false);
      } catch {
        setInfoError("creator_info татах үед сүлжээний алдаа.");
      }
      try {
        const r = await fetch("/api/tiktok/videos");
        const d = await r.json();
        setReels(d.videos || []);
      } catch {
        /* рийл байхгүй байх нь холболтын алдаа биш */
      }
    })();
  }, [conn?.connected, loadConn]);

  // Байдлыг TikTok-оос асууна. "Нийтлэгдлээ" гэж ЗӨВХӨН API баталсан үед.
  useEffect(() => {
    if (!publishId) return;
    const tick = async () => {
      try {
        const r = await fetch(`/api/tiktok/status?publish_id=${encodeURIComponent(publishId)}`);
        const d = await r.json();
        if (d.status) {
          setStatus(d.status);
          setTiktokStatus(d.tiktokStatus || "");
          if (d.status === "PUBLISHED" || d.status === "FAILED") {
            if (d.errorMessage) setError(d.errorMessage);
            if (pollRef.current) clearInterval(pollRef.current);
          }
        }
      } catch {
        /* нэг удаагийн уналт — дараагийн tick дээр дахин оролдоно */
      }
    };
    tick();
    pollRef.current = setInterval(tick, 4000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [publishId]);

  async function disconnect() {
    if (!confirm("TikTok холболтыг салгах уу? Хадгалсан токен устаж, TikTok дээрх зөвшөөрөл цуцлагдана.")) return;
    await fetch("/api/tiktok/disconnect", { method: "POST" });
    setInfo(null);
    setReels([]);
    setSelected(null);
    setPublishId("");
    setStatus("");
    setBanner("TikTok холболтыг салгалаа.");
    loadConn();
  }

  async function publish() {
    if (!selected || !privacy) return;
    setPublishing(true);
    setError("");
    setStatus("QUEUED");
    try {
      const r = await fetch("/api/tiktok/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId: selected.id,
          kind: selected.kind,
          caption,
          privacyLevel: privacy,
          // UI нь "зөвшөөрөх", API нь "хориглох" — эндээс л эргүүлнэ.
          disableComment: !allowComment,
          disableDuet: !allowDuet,
          disableStitch: !allowStitch,
          isAigc,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        setStatus("FAILED");
        setError(d.error || "Нийтлэх амжилтгүй.");
        if (d.needsReconnect) loadConn();
        return;
      }
      setPublishId(d.publishId);
      setStatus(d.status || "PROCESSING");
    } catch {
      setStatus("FAILED");
      setError("Сүлжээний алдаа — нийтлэх хүсэлт илгээгдсэнгүй.");
    } finally {
      setPublishing(false);
    }
  }

  if (!conn) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }

  const tooLong =
    selected && info?.max_video_post_duration_sec
      ? selected.durationSec > info.max_video_post_duration_sec
      : false;

  return (
    <div className="mx-auto max-w-[900px] space-y-6 px-4 py-8 md:px-8">
      <SectionHeader
        title="TikTok"
        hint="Login Kit + Content Posting API (Direct Post) — Sandbox"
      />

      {banner && (
        <div className="rounded-[4px] border px-4 py-3 text-[12px]" style={{ borderColor: `${T.ok}55`, background: `${T.ok}12`, color: T.okInk }}>
          {banner}
        </div>
      )}
      {error && (
        <div className="rounded-[4px] border px-4 py-3 text-[12px]" style={{ borderColor: `${T.bad}55`, background: `${T.bad}12`, color: T.badInk }}>
          {error}
        </div>
      )}

      {/* ── 1. Холболт ── */}
      <Card>
        {!conn.configured ? (
          <Empty
            title="TikTok тохируулагдаагүй"
            hint="Серверт TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, TIKTOK_REDIRECT_URI, TOKEN_ENC_KEY шаардлагатай."
          />
        ) : !conn.connected ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-[14px] font-bold" style={{ color: T.text }}>TikTok</div>
              <div className="mt-1 text-[12px]" style={{ color: T.muted }}>
                {conn.needsReconnect
                  ? `Дахин холбогдох шаардлагатай${conn.lastError ? ` — ${conn.lastError}` : ""}`
                  : "Холбогдоогүй"}
              </div>
            </div>
            <Btn href="/api/tiktok/connect">Connect TikTok</Btn>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {(info?.creator_avatar_url || conn.avatarUrl) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={info?.creator_avatar_url || conn.avatarUrl} alt="" className="h-11 w-11 rounded-full object-cover" />
              ) : (
                <span className="flex h-11 w-11 items-center justify-center rounded-full text-[15px]" style={{ background: `${T.ok}20`, color: T.okInk }}>✓</span>
              )}
              <div>
                <div className="text-[14px] font-bold" style={{ color: T.text }}>
                  {info?.creator_nickname || conn.nickname || "TikTok creator"}
                </div>
                <div className="text-[12px]" style={{ color: T.muted, fontFamily: MONO }}>
                  {info?.creator_username || conn.username ? `@${info?.creator_username || conn.username}` : "…"}
                </div>
              </div>
              <Status kind="running" labelOverride="Холбогдсон" />
            </div>
            <Btn variant="ghost" size="sm" onClick={disconnect}>Disconnect</Btn>
          </div>
        )}
      </Card>

      {conn.connected && infoError && (
        <div className="rounded-[4px] border px-4 py-3 text-[12px]" style={{ borderColor: `${T.warn}55`, background: `${T.warn}12`, color: T.warnInk }}>
          {infoError}
        </div>
      )}

      {conn.connected && info && (
        <>
          {/* ── 2. Рийл сонгох ── */}
          <Card>
            <div className="mb-3 text-[13px] font-bold" style={{ color: T.text }}>Рийл сонгох</div>
            {reels.length === 0 ? (
              <Empty title="Нийтлэх видео алга" hint="/tools/video эсвэл /ai студид видео үүсгэсний дараа энд гарна." />
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {reels.map((r) => {
                  const on = selected?.id === r.id;
                  return (
                    <button
                      key={r.id}
                      onClick={() => setSelected(r)}
                      className="overflow-hidden rounded-[4px] border text-left transition"
                      style={{ borderColor: on ? T.primary : T.border, background: on ? `${T.primary}12` : "transparent" }}
                    >
                      <video src={r.videoUrl} muted playsInline preload="metadata" className="aspect-[9/16] w-full bg-black object-cover" />
                      <div className="px-2 py-1.5 text-[10px]" style={{ color: T.muted, fontFamily: MONO }}>
                        {r.durationSec}s · {mb(r.bytes)}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          {/* ── 3. Урьдчилж үзэх + тохиргоо ── */}
          {selected && (
            <Card>
              <div className="grid gap-6 md:grid-cols-[240px_1fr]">
                <div>
                  <video src={selected.videoUrl} controls playsInline className="aspect-[9/16] w-full rounded-[4px] bg-black object-contain" />
                  <div className="mt-2 text-[11px]" style={{ color: T.muted, fontFamily: MONO }}>
                    {selected.durationSec}s · {mb(selected.bytes)} · {selected.aspectRatio || "—"}
                  </div>
                  {tooLong && (
                    <div className="mt-2 text-[11px]" style={{ color: T.badInk }}>
                      TikTok дээд тал нь {info.max_video_post_duration_sec}s зөвшөөрнө.
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider" style={{ color: T.muted }}>Тайлбар (caption)</label>
                    <textarea
                      value={caption}
                      onChange={(e) => setCaption(e.target.value.slice(0, 2200))}
                      rows={4}
                      placeholder="Тайлбар бичих…"
                      className="w-full rounded-[4px] border bg-transparent px-3 py-2 text-[13px] outline-none"
                      style={{ borderColor: T.border, color: T.text }}
                    />
                    <div className="mt-1 text-right text-[10px]" style={{ color: T.faint, fontFamily: MONO }}>{caption.length} / 2200</div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider" style={{ color: T.muted }}>
                      Нууцлал — TikTok-ийн зөвшөөрснөөс
                    </label>
                    <select
                      value={privacy}
                      onChange={(e) => setPrivacy(e.target.value)}
                      className="w-full rounded-[4px] border bg-[#0d0d0f] px-3 py-2 text-[13px] outline-none"
                      style={{ borderColor: T.border, color: T.text }}
                    >
                      {info.privacy_level_options.map((p) => (
                        <option key={p} value={p}>{PRIVACY_LABEL[p] || p}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    {[
                      { key: "comment", label: "Сэтгэгдэл зөвшөөрөх", on: allowComment, set: setAllowComment, blocked: info.comment_disabled },
                      { key: "duet", label: "Duet зөвшөөрөх", on: allowDuet, set: setAllowDuet, blocked: info.duet_disabled },
                      { key: "stitch", label: "Stitch зөвшөөрөх", on: allowStitch, set: setAllowStitch, blocked: info.stitch_disabled },
                    ].map((row) => (
                      <label key={row.key} className="flex items-center gap-2.5 text-[13px]" style={{ color: row.blocked ? T.faint : T.text }}>
                        <input
                          type="checkbox"
                          checked={row.on && !row.blocked}
                          disabled={row.blocked}
                          onChange={(e) => row.set(e.target.checked)}
                          className="h-4 w-4 accent-[#2E29FF]"
                        />
                        {row.label}
                        {row.blocked && (
                          <span className="text-[10px]" style={{ color: T.faint }}>— TikTok энэ акаунтад хаасан</span>
                        )}
                      </label>
                    ))}

                    <label className="flex items-center gap-2.5 text-[13px]" style={{ color: T.text }}>
                      <input type="checkbox" checked={isAigc} onChange={(e) => setIsAigc(e.target.checked)} className="h-4 w-4 accent-[#2E29FF]" />
                      AI-аар үүсгэсэн контент
                    </label>
                  </div>

                  <div className="flex items-center gap-3 pt-1">
                    <Btn onClick={publish} disabled={publishing || !privacy || tooLong || Boolean(publishId)} loading={publishing}>
                      Publish to TikTok
                    </Btn>
                    {status && <Status kind={status === "PUBLISHED" ? "live" : status === "FAILED" ? "failed" : "pending"} labelOverride={STATUS_LABEL[status] || status} />}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* ── 4. Байдал ── */}
          {publishId && (
            <Card>
              <div className="mb-2 text-[13px] font-bold" style={{ color: T.text }}>Нийтлэлийн байдал</div>
              <div className="space-y-1 text-[12px]" style={{ color: T.muted, fontFamily: MONO }}>
                <div>publish_id: {publishId}</div>
                <div>antaqor: {STATUS_LABEL[status] || status}</div>
                <div>tiktok: {tiktokStatus || "…"}</div>
              </div>
              {status === "PUBLISHED" && tiktokStatus === "SEND_TO_USER_INBOX" && (
                <div className="mt-3 text-[12px]" style={{ color: T.warnInk }}>
                  TikTok видеог хэрэглэгчийн inbox руу ноорог болгон илгээв — профайл дээр шууд гараагүй.
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
