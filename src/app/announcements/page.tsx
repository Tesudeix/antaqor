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
  "мэдэгдэл": { bg: "bg-[rgba(16,128,202,0.12)]", text: "text-[#1080CA]" },
  "шинэчлэл": { bg: "bg-[rgba(16,128,202,0.12)]", text: "text-green-400" },
  "AI": { bg: "bg-[rgba(99,102,241,0.12)]", text: "text-indigo-400" },
  "эвент": { bg: "bg-[rgba(16,128,202,0.12)]", text: "text-[#1080CA]" },
  "бусад": { bg: "bg-[rgba(0,0,0,0.08)]", text: "text-[#5b6573]" },
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

export default function AnnouncementsPage() {
  const [items, setItems] = useState<AnnouncementData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/announcements?limit=30")
      .then((r) => r.json())
      .then((d) => {
        if (d.announcements) setItems(d.announcements);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-2 w-2 animate-pulse rounded-full bg-[#1080CA]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2.5">
          <svg className="h-5 w-5 text-[#1080CA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
          </svg>
          <h1 className="text-[22px] font-bold text-[#0e1726]">Мэдэгдэл</h1>
        </div>
        <p className="mt-1 text-[13px] text-[#5b6573]">
          Antaqor-ын мэдэгдэл, шинэчлэл, эвентүүд
        </p>
      </div>

      {/* Announcements list */}
      {items.length > 0 ? (
        <div className="space-y-3">
          {items.map((a) => {
            const isExpanded = expanded === a._id;
            const style = TAG_STYLES[a.tag] || TAG_STYLES["бусад"];
            const needsTruncate = a.content.length > 200;

            return (
              <div
                key={a._id}
                className={`rounded-none border transition ${
                  a.pinned
                    ? "border-[rgba(16,128,202,0.15)] bg-[#eef2f6] shadow-[0_0_20px_rgba(16,128,202,0.04)]"
                    : "border-[rgba(15,23,38,0.08)] bg-[#eef2f6]"
                }`}
              >
                {/* Image */}
                {a.image && (
                  <div className="aspect-[2.5/1] overflow-hidden rounded-t-[4px]">
                    <img
                      src={a.image}
                      alt={a.title}
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}

                <div className="p-5">
                  {/* Tag + Time row */}
                  <div className="mb-2.5 flex items-center gap-2">
                    {a.pinned && (
                      <span className="flex items-center gap-1 rounded-none bg-[rgba(16,128,202,0.12)] px-1.5 py-0.5 text-[9px] font-black text-[#1080CA]">
                        <svg className="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
                        </svg>
                        PIN
                      </span>
                    )}
                    <span className={`rounded-none px-1.5 py-0.5 text-[9px] font-bold ${style.bg} ${style.text}`}>
                      {a.tag.toUpperCase()}
                    </span>
                    <span className="text-[10px] font-semibold text-[#5b6573]">
                      {timeAgo(a.createdAt)}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-[15px] font-bold leading-snug text-[#0e1726]">
                    {a.title}
                  </h3>

                  {/* Content */}
                  <p className="mt-2 text-[13px] leading-relaxed text-[#5b6573]">
                    {needsTruncate && !isExpanded
                      ? a.content.slice(0, 200) + "..."
                      : a.content}
                  </p>

                  {needsTruncate && (
                    <button
                      onClick={() => setExpanded(isExpanded ? null : a._id)}
                      className="mt-2 text-[12px] font-bold text-[#1080CA] transition hover:text-[#4FA8E8]"
                    >
                      {isExpanded ? "Хураах" : "Дэлгэрэнгүй"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-20 text-center">
          <svg className="mx-auto mb-4 h-12 w-12 text-[#5b6573] opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
          </svg>
          <p className="text-[14px] text-[#5b6573]">Одоогоор мэдэгдэл байхгүй</p>
        </div>
      )}
    </div>
  );
}
