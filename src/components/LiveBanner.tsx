"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface LiveEvent {
  _id: string;
  title: string;
  type: string;
  status: string;
  liveStreamUrl?: string;
  viewerCount?: number;
}

const NEON = "var(--accent-ink, #2E29FF)";

// Top-of-feed banner that surfaces any currently-live event. Polls every
// 15 seconds while visible so it picks up brand-new live sessions without
// a refresh.
export default function LiveBanner() {
  const [live, setLive] = useState<LiveEvent | null>(null);

  useEffect(() => {
    let cancel = false;
    const load = () => {
      fetch("/api/events?status=live")
        .then((r) => r.json())
        .then((d) => {
          if (cancel) return;
          const list = (Array.isArray(d.events) ? d.events : []).filter(
            (e: LiveEvent) => e.status === "live" && (e.liveStreamUrl || "").length > 0
          );
          setLive(list.length > 0 ? list[0] : null);
        })
        .catch(() => {});
    };
    load();
    const t = setInterval(load, 15_000);
    return () => { cancel = true; clearInterval(t); };
  }, []);

  if (!live) return null;

  return (
    <Link
      href={`/live/${live._id}`}
      className="group relative flex items-center gap-3 overflow-hidden rounded-[4px] border p-3 transition active:scale-[0.99] hover:shadow-[0_0_24px_rgba(46,41,255,0.3)]"
      style={{
        borderColor: "rgba(46,41,255,0.45)",
        background: "linear-gradient(135deg, rgba(46,41,255,0.18) 0%, #f2f5f8 70%)",
      }}
    >
      {/* Pulsing left rail */}
      <span
        className="absolute left-0 top-0 h-full w-[3px] animate-pulse"
        style={{ background: NEON, boxShadow: "0 0 8px #2E29FF" }}
      />
      <span
        className="flex shrink-0 items-center gap-1.5 rounded-[4px] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white"
        style={{ background: NEON, boxShadow: "0 0 12px rgba(46,41,255,0.5)" }}
      >
        <span className="h-1 w-1 animate-pulse rounded-full bg-white" />
        LIVE
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-black text-white">{live.title}</div>
        <div className="text-[11px] text-[#E2E4E8]">
          {(live.viewerCount || 0) > 0 ? `👁 ${live.viewerCount} үзэж байна` : "Одоо явж байна"}
        </div>
      </div>
      <span
        className="shrink-0 rounded-[4px] px-3 py-1.5 text-[11px] font-black text-white transition group-hover:translate-x-[2px]"
        style={{ background: NEON }}
      >
        Нэгдэх →
      </span>
    </Link>
  );
}
