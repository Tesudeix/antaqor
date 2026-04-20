"use client";

import { useEffect, useState } from "react";

interface AnnouncementData {
  _id: string;
  title: string;
  content: string;
  image?: string;
  tag: string;
  pinned: boolean;
  createdAt: string;
}

const TAG_STYLES: Record<string, { bg: string; text: string }> = {
  "мэдэгдэл": { bg: "bg-[rgba(239,44,88,0.15)]", text: "text-[#8a8a00]" },
  "шинэчлэл": { bg: "bg-[rgba(34,197,94,0.1)]", text: "text-green-600" },
  "AI": { bg: "bg-[rgba(99,102,241,0.1)]", text: "text-indigo-500" },
  "эвент": { bg: "bg-[rgba(249,115,22,0.1)]", text: "text-orange-500" },
  "бусад": { bg: "bg-[rgba(0,0,0,0.05)]", text: "text-[rgba(0,0,0,0.4)]" },
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Дөнгөж сая";
  if (mins < 60) return `${mins} мин`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} цаг`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} өдөр`;
  return new Date(dateStr).toLocaleDateString("mn-MN", { month: "short", day: "numeric" });
}

export default function Announcements() {
  const [items, setItems] = useState<AnnouncementData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/announcements?limit=5")
      .then((r) => r.json())
      .then((d) => {
        if (d.announcements) setItems(d.announcements);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-3 px-1">
        {[1, 2].map((i) => (
          <div key={i} className="animate-pulse rounded-[4px] bg-[rgba(0,0,0,0.04)] p-4">
            <div className="mb-2 h-3 w-24 rounded bg-[rgba(0,0,0,0.06)]" />
            <div className="mb-1 h-4 w-3/4 rounded bg-[rgba(0,0,0,0.06)]" />
            <div className="h-3 w-full rounded bg-[rgba(0,0,0,0.04)]" />
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="py-2">
      <div className="mb-3 flex items-center gap-2 px-1">
        <svg className="h-4 w-4 text-[#F8F8F6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
        </svg>
        <span className="text-[12px] font-black tracking-wide text-[#F8F8F6]">Мэдэгдэл</span>
        <span className="text-[10px] font-semibold text-[rgba(0,0,0,0.25)]">·</span>
        <span className="text-[10px] font-semibold text-[rgba(0,0,0,0.25)]">{items.length}</span>
      </div>

      <div className="space-y-2 px-1">
        {items.map((a) => {
          const isExpanded = expanded === a._id;
          const style = TAG_STYLES[a.tag] || TAG_STYLES["бусад"];
          const needsTruncate = a.content.length > 120;

          return (
            <div
              key={a._id}
              className={`rounded-[4px] transition ${
                a.pinned
                  ? "bg-[#0A0A0A] text-white shadow-[0_2px_12px_rgba(0,0,0,0.15)]"
                  : "bg-[rgba(0,0,0,0.04)] text-[#F8F8F6]"
              }`}
            >
              {/* Image */}
              {a.image && (
                <div className="aspect-[2/1] overflow-hidden rounded-t-[4px]">
                  <img
                    src={a.image}
                    alt={a.title}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}

              <div className="p-4">
                {/* Tag + Time row */}
                <div className="mb-2 flex items-center gap-2">
                  {a.pinned && (
                    <span className={`flex items-center gap-1 rounded-[4px] px-1.5 py-0.5 text-[9px] font-black ${
                      a.pinned ? "bg-[rgba(239,44,88,0.2)] text-[#EF2C58]" : ""
                    }`}>
                      <svg className="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
                      </svg>
                      PIN
                    </span>
                  )}
                  <span className={`rounded-[4px] px-1.5 py-0.5 text-[9px] font-bold ${
                    a.pinned
                      ? "bg-[rgba(255,255,255,0.1)] text-[rgba(255,255,255,0.5)]"
                      : `${style.bg} ${style.text}`
                  }`}>
                    {a.tag.toUpperCase()}
                  </span>
                  <span className={`text-[10px] font-semibold ${
                    a.pinned ? "text-[rgba(255,255,255,0.25)]" : "text-[rgba(0,0,0,0.25)]"
                  }`}>
                    {timeAgo(a.createdAt)}
                  </span>
                </div>

                {/* Title */}
                <h3 className={`text-[14px] font-black leading-snug ${
                  a.pinned ? "text-white" : "text-[#F8F8F6]"
                }`}>
                  {a.title}
                </h3>

                {/* Content */}
                <p className={`mt-1.5 text-[12px] leading-relaxed ${
                  a.pinned ? "text-[rgba(255,255,255,0.5)]" : "text-[rgba(0,0,0,0.45)]"
                }`}>
                  {needsTruncate && !isExpanded
                    ? a.content.slice(0, 120) + "..."
                    : a.content}
                </p>

                {needsTruncate && (
                  <button
                    onClick={() => setExpanded(isExpanded ? null : a._id)}
                    className={`mt-1.5 text-[11px] font-bold transition ${
                      a.pinned
                        ? "text-[#EF2C58] hover:text-[#D4264E]"
                        : "text-[#F8F8F6] hover:underline"
                    }`}
                  >
                    {isExpanded ? "Хураах" : "Дэлгэрэнгүй"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
