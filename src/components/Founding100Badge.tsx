"use client";

import { useEffect, useState } from "react";

const FOUNDING_CAP = 100;

export default function Founding100Badge({ variant = "default" }: { variant?: "default" | "compact" | "hero" }) {
  const [paid, setPaid] = useState<number | null>(null);

  useEffect(() => {
    let cancel = false;
    fetch("/api/stats")
      .then((r) => r.json())
      .then((d) => { if (!cancel && typeof d.paidMembers === "number") setPaid(d.paidMembers); })
      .catch(() => {});
    return () => { cancel = true; };
  }, []);

  if (paid === null || paid >= FOUNDING_CAP) return null;
  const remaining = FOUNDING_CAP - paid;
  const filledPct = Math.round((paid / FOUNDING_CAP) * 100);

  if (variant === "compact") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(239,44,88,0.4)] bg-[rgba(239,44,88,0.08)] px-2 py-0.5 text-[10px] font-black text-[#EF2C58]">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#EF2C58]" />
        {remaining} СУУДАЛ ҮЛДСЭН
      </span>
    );
  }

  if (variant === "hero") {
    return (
      <div className="overflow-hidden rounded-[4px] border border-[rgba(239,44,88,0.4)] bg-gradient-to-br from-[rgba(239,44,88,0.1)] via-[#0E0E0E] to-[#0B0B0B] p-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-[#EF2C58]" />
          <span className="text-[9px] font-black tracking-[0.2em] text-[#EF2C58]">FOUNDING 100</span>
          <span className="ml-auto text-[10px] font-bold text-[#888]">
            {paid}/{FOUNDING_CAP}
          </span>
        </div>
        <div className="mt-1.5 text-[12px] font-bold leading-tight text-[#E8E8E8]">
          Эхний 100 гишүүн{" "}
          <span className="text-[#EF2C58]">₮49,000 LIFETIME</span> үнэнд
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#EF2C58] to-[#ff4e77] transition-all duration-700"
            style={{ width: `${filledPct}%` }}
          />
        </div>
        <div className="mt-1.5 text-[10px] font-bold text-[#FFB020]">
          {remaining} суудал үлдсэн · 100 хүрэхэд ₮69k болно
        </div>
      </div>
    );
  }

  // default — for paywall page header
  return (
    <div className="rounded-[4px] border-2 border-[#EF2C58] bg-[rgba(239,44,88,0.08)] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#EF2C58] px-2 py-0.5 text-[9px] font-black tracking-[0.18em] text-white">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            FOUNDING 100
          </div>
          <div className="mt-2 text-[16px] font-black leading-tight text-[#E8E8E8]">
            Эхний 100 гишүүн ₮49,000<span className="text-[#EF2C58]"> LIFETIME</span>
          </div>
          <div className="mt-1 text-[11px] font-bold text-[#FFB020]">
            {remaining} суудал үлдсэн · дараа нь ₮69k/сар болно
          </div>
        </div>
        <div className="text-right">
          <div className="text-[28px] font-black leading-none text-[#EF2C58]">{paid}</div>
          <div className="text-[10px] font-bold text-[#888]">/ {FOUNDING_CAP}</div>
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#EF2C58] to-[#ff4e77] transition-all duration-700"
          style={{ width: `${filledPct}%` }}
        />
      </div>
    </div>
  );
}
