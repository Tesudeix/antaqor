"use client";

import { useEffect, useMemo, useRef, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { REACTIONS, REACTION_ORDER, ReactionKey } from "@/lib/reactions";

const NEON = "var(--accent-ink, #2E29FF)";

interface LiveEvent {
  _id: string;
  title: string;
  description: string;
  type: string;
  date: string;
  endDate: string;
  status: "upcoming" | "live" | "ended";
  liveStreamUrl: string;
  liveProvider: "youtube" | "twitch" | "hls" | "";
  viewerCount: number;
  attendeeCount: number;
}

interface FloatingReaction {
  id: number;
  key: ReactionKey;
  x: number; // 0..100 (percent within reaction-bar)
}

// Build a clean embed URL from a stream URL.
function buildEmbed(url: string, hint: LiveEvent["liveProvider"]): { src: string; provider: string } | null {
  if (!url) return null;
  const u = url.trim();

  // YouTube
  if (hint === "youtube" || /youtube\.com|youtu\.be/.test(u)) {
    const yt = u.match(/(?:v=|\/watch\?v=|youtu\.be\/|\/live\/|\/embed\/)([\w-]{11})/);
    if (yt) {
      const id = yt[1];
      return {
        src: `https://www.youtube.com/embed/${id}?autoplay=1&modestbranding=1&rel=0&controls=1`,
        provider: "youtube",
      };
    }
  }
  // Twitch
  if (hint === "twitch" || /twitch\.tv/.test(u)) {
    const tw = u.match(/twitch\.tv\/([\w-]+)/);
    if (tw) {
      const channel = tw[1];
      const parent = typeof window !== "undefined" ? window.location.hostname : "antaqor.com";
      return {
        src: `https://player.twitch.tv/?channel=${channel}&parent=${parent}&muted=false`,
        provider: "twitch",
      };
    }
  }
  // HLS or other direct
  if (hint === "hls" || u.endsWith(".m3u8")) {
    return { src: u, provider: "hls" };
  }
  return null;
}

export default function LivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: session } = useSession();
  const [event, setEvent] = useState<LiveEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [floats, setFloats] = useState<FloatingReaction[]>([]);
  const floatId = useRef(0);
  const reactionBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancel = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/events/${id}`);
        const data = await res.json();
        if (!cancel && res.ok && data.event) setEvent(data.event);
      } finally {
        if (!cancel) setLoading(false);
      }
    };
    load();
    const t = setInterval(load, 8000);
    return () => { cancel = true; clearInterval(t); };
  }, [id]);

  // Auto-cleanup floating reactions after their animation completes.
  useEffect(() => {
    if (floats.length === 0) return;
    const t = setTimeout(() => {
      setFloats((prev) => prev.filter((f) => Date.now() - f.id < 2200));
    }, 2200);
    return () => clearTimeout(t);
  }, [floats]);

  const embed = useMemo(() => {
    if (!event) return null;
    return buildEmbed(event.liveStreamUrl, event.liveProvider);
  }, [event]);

  const fireReaction = (key: ReactionKey) => {
    floatId.current += 1;
    const x = 8 + Math.random() * 84;
    setFloats((prev) => [...prev.slice(-30), { id: Date.now() + floatId.current, key, x }]);

    // Optionally also send to server for cross-viewer sync (Phase 2 — uses
    // the existing react endpoint as a stub for analytics for now).
    if (session) {
      fetch(`/api/events/${id}/join`, { method: "POST" }).catch(() => {});
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-2 w-2 animate-pulse rounded-full bg-[#2E29FF]" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-[20px] font-black text-[#0e1726]">Эвент олдсонгүй</h1>
        <Link href="/calendar" className="mt-4 inline-block text-[12px] font-bold text-[#2E29FF]">
          ← Календар руу буцах
        </Link>
      </div>
    );
  }

  const isLive = event.status === "live";
  const hasEmbed = embed !== null;

  return (
    <div className="-mx-4 sm:-mx-6 md:-mx-8 lg:-mx-12">
      <div className="mx-auto max-w-[1100px] pb-10">
        {/* Header — sits inside the live page, neon pulse */}
        <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-2 sm:px-5">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Хаах"
            className="flex h-9 w-9 items-center justify-center rounded-[4px] border border-[rgba(15,23,38,0.08)] text-[#0e1726] transition hover:border-[#2E29FF]"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            {isLive && (
              <span
                className="flex items-center gap-1.5 rounded-[4px] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white"
                style={{ background: NEON, boxShadow: "0 0 14px rgba(46,41,255,0.5)" }}
              >
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                LIVE
              </span>
            )}
            <span className="rounded-[4px] border border-[rgba(15,23,38,0.08)] bg-[#f2f5f8] px-2.5 py-1 text-[10px] font-bold text-[#334155]">
              👁 {event.viewerCount + (event.attendeeCount || 0)}
            </span>
          </div>
        </div>

        {/* Player — full bleed 16:9 */}
        <div className="relative w-full overflow-hidden bg-black sm:rounded-[4px]" style={{ aspectRatio: "16 / 9" }}>
          {hasEmbed && embed ? (
            embed.provider === "hls" ? (
              <video
                src={embed.src}
                controls
                autoPlay
                playsInline
                className="h-full w-full"
              />
            ) : (
              <iframe
                src={embed.src}
                className="h-full w-full"
                allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            )
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2">
              <span
                className="flex h-12 w-12 items-center justify-center rounded-[4px]"
                style={{ background: "rgba(46,41,255,0.12)", boxShadow: "0 0 18px rgba(46,41,255,0.3)" }}
              >
                <svg className="h-5 w-5" fill="none" stroke={NEON} strokeWidth={1.6} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                </svg>
              </span>
              <p className="text-[13px] font-bold text-[#0e1726]">{isLive ? "Stream холбогдож байна…" : "Эхэлж амжаагүй"}</p>
              <p className="text-[11px] text-[#E2E4E8]">{event.title}</p>
            </div>
          )}

          {/* Floating reactions overlay */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {floats.map((f) => {
              const r = REACTIONS[f.key];
              const Icon = r.Icon;
              return (
                <span
                  key={f.id}
                  className="absolute"
                  style={{
                    left: `${f.x}%`,
                    bottom: "0",
                    animation: "liveFloat 2.2s ease-out forwards",
                  }}
                >
                  <Icon size={32} active />
                </span>
              );
            })}
          </div>
        </div>

        {/* Title + description */}
        <div className="px-4 py-4 sm:px-5">
          <h1 className="text-[18px] font-black leading-tight text-white sm:text-[22px]">{event.title}</h1>
          {event.description && (
            <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-[#E2E4E8]">
              {event.description}
            </p>
          )}
        </div>

        {/* Reaction bar — taps fire floating reactions in the player */}
        <div ref={reactionBarRef} className="sticky bottom-0 z-10 border-t border-[rgba(15,23,38,0.06)] bg-[#ffffff]/95 px-3 py-3 backdrop-blur-xl sm:px-5">
          <div className="flex items-center justify-center gap-2 sm:gap-3">
            {REACTION_ORDER.map((key) => {
              const r = REACTIONS[key];
              const Icon = r.Icon;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => fireReaction(key)}
                  aria-label={r.label}
                  className="flex h-11 w-11 items-center justify-center rounded-[4px] border transition active:scale-90 hover:scale-110"
                  style={{
                    borderColor: "rgba(15,23,38,0.08)",
                    background: "rgba(15,23,38,0.03)",
                  }}
                >
                  <Icon size={26} />
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-center text-[10px] text-[#E2E4E8]">
            Reaction-аа дараад LIVE-д урьд урагшил
          </p>
        </div>
      </div>

      <style jsx global>{`
        @keyframes liveFloat {
          0% { transform: translateY(0) scale(1); opacity: 0; }
          15% { opacity: 1; }
          70% { opacity: 1; }
          100% { transform: translateY(-80vh) scale(1.5); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
