"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CreditIcon } from "@/components/CreditIcon";
import { AI_IMAGE_ENABLED, AI_VIDEO_ENABLED } from "@/lib/flags";

/* ─── Feed баруун багана (ширээний дэлгэц) ───────────────────────────────
   Хоёр блок, чухлаараа дээрээс доош:
     1. ҮҮСГЭХ   — AI зураг (кредиттэй, үнэ нь харагдана), Пост (үнэгүй).
                   Хүн энд бүтээхээр ирдэг — орц нь эхэнд.
     2. AI ВИДЕО — гишүүдийн нийтэлсэн видео, 4 хүртэл.
   MISSION болон МЭДЭЭ блокууд 2026-09-04-нд хасагдсан: эхнийх нь
   өдөр тутмын хөтөлбөрийг урсгал руу чирдэг байсан (тэр нь /classroom-ийн
   ажил), хоёр дахь нь хүнийг сайтаас гадагш заадаг байв.
   Өнгө нь токен (`--nav-fg-strong`, `--chrome-line`): өмнөх хатуу
   #0A0A0A/#FFFFFF нь цайвар горимд хар хайрцаг болж урсгалаас тасардаг байв. */

const NEON = "var(--accent-ink, #2E29FF)";
const LINE = "var(--chrome-line, rgba(128,128,128,0.22))";

interface JourneyDay { day: number; title: string; description: string; xpReward: number; status: string; releaseAt: string }
interface JourneyResponse { isPaid: boolean; currentDay: number | null; nextUnlockAt: string | null; days: JourneyDay[] }
interface VideoItem { _id: string; video: string; poster: string; seconds: number }

function useCountdown(target: string | null): string {
  const [left, setLeft] = useState("--:--:--");
  useEffect(() => {
    if (!target) { setLeft("--:--:--"); return; }
    const pad = (n: number) => String(n).padStart(2, "0");
    const tick = () => {
      const s = Math.max(0, Math.floor((new Date(target).getTime() - Date.now()) / 1000));
      setLeft(`${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [target]);
  return left;
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[4px] p-4" style={{ border: `1px solid ${LINE}` }}>
      <div className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-[#E2E4E8]">{title}</div>
      {children}
    </div>
  );
}

export default function FeedDiscoveryRail() {
  const [journey, setJourney] = useState<JourneyResponse | null>(null);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [imageCost, setImageCost] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/users/me/journey").then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && !d.error) setJourney(d); }).catch(() => {});
    fetch("/api/ai-videos?limit=4").then((r) => r.json())
      .then((d) => setVideos(Array.isArray(d.items) ? d.items : [])).catch(() => {});
    fetch("/api/tools/image-pricing").then((r) => r.json())
      .then((d) => { if (d?.costs?.nano2) setImageCost(d.costs.nano2); }).catch(() => {});
  }, []);


  return (
    <div className="flex flex-col gap-3">
      <Block title="Үүсгэх">
        {/* AI зураг ТҮР хаалттай — `AI_IMAGE_ENABLED` (src/lib/flags.ts).
            "Пост бичих" нь доор хэвээр үлдэнэ, өөрөөр хэлбэл "Үүсгэх"
            булан хоосон болохгүй. */}
        {AI_IMAGE_ENABLED && (
        <Link
          href="/tools/nano-banano"
          className="press flex items-center gap-3 rounded-[4px] px-3 py-2.5 transition hover:brightness-105"
          style={{ background: NEON, color: "#FFFFFF" }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden className="shrink-0">
            <rect x="3" y="4" width="18" height="16" rx="1" />
            <path d="M3 16l4.5-4.5a2 2 0 012.8 0L15 16" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="15.5" cy="8.5" r="1.5" />
          </svg>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-black">AI зураг</span>
            <span className="block truncate text-[11px] opacity-80">Nano Banana 2 · бичихэд зураг болно</span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 text-[12px] font-black tabular-nums">
            <CreditIcon size={11} />{imageCost ?? "…"}
          </span>
        </Link>
        )}
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent("antaqor:create"))}
          className="press mt-1.5 flex w-full items-center gap-3 rounded-[4px] px-3 py-2.5 text-left transition hover:bg-[rgba(128,128,128,0.08)]"
          style={{ border: `1px solid ${LINE}` }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden className="shrink-0 text-[#E2E4E8]">
            <path d="M4 5h16M4 11h16M4 17h9" strokeLinecap="round" />
          </svg>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-bold text-[var(--nav-fg-strong)]">Пост бичих</span>
            <span className="block text-[11px] text-[#E2E4E8]">Бодол, ялалт, асуулт · үнэгүй</span>
          </span>
        </button>
      </Block>

      {/* ─── AI ВИДЕО ────────────────────────────────────────────────
          Мэдээний блокийг ЭНЭ орлов. Мэдээ нь сайтаас ГАДАГШ заадаг
          холбоос байсан — баруун багана нь урсгал дээр байгаа хүнийг
          сайтаас гаргах ёсгүй. Видео нь эсрэгээрээ: дарвал постынх нь
          дотор, тэндээсээ студи рүү.

          Зөвхөн урсгалд НИЙТЭЛСЭН видео харагдана (`/api/ai-videos` нь
          постоос уншдаг, студийн хувийн түүхээс биш). */}
      {/* AI видео — `AI_VIDEO_ENABLED` (src/lib/flags.ts). */}
      {AI_VIDEO_ENABLED && videos.length > 0 && (
        <Block title="AI видео">
          <div className="grid grid-cols-2 gap-1.5">
            {videos.map((v) => (
              <Link
                key={v._id}
                href={`/posts/${v._id}`}
                className="group relative block aspect-[9/16] overflow-hidden rounded-[4px]"
                style={{ background: "rgba(128,128,128,0.10)" }}
              >
                <video
                  src={v.video}
                  poster={v.poster || undefined}
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  className="h-full w-full object-cover"
                  onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
                  onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                />
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center transition group-hover:opacity-0">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/45">
                    <svg className="h-3 w-3 translate-x-[1px] text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </span>
                </span>
              </Link>
            ))}
          </div>
          <Link
            href="/tools/video"
            className="mt-3 inline-block text-[11px] font-bold"
            style={{ color: NEON }}
          >
            Видео үүсгэх →
          </Link>
        </Block>
      )}
    </div>
  );
}
