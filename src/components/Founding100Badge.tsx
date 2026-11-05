"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const FOUNDING_CAP = 100;

export default function Founding100Badge({ variant = "default", light = false }: { variant?: "default" | "compact" | "hero"; light?: boolean }) {
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
      <span className="inline-flex items-center gap-1.5 rounded-[4px] border border-[rgba(46,41,255,0.4)] bg-[rgba(46,41,255,0.08)] px-2 py-0.5 text-[10px] font-black text-[#2E29FF]">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#2E29FF]" />
        {remaining} СУУДАЛ ҮЛДСЭН
      </span>
    );
  }

  if (variant === "hero") {
    return (
      <Link href="/founders" className={`block overflow-hidden rounded-[4px] border p-3 transition ${light ? "border-[rgba(46,41,255,0.4)] bg-gradient-to-br from-[rgba(46,41,255,0.1)] via-[#F4F6F8] to-[#FFFFFF] hover:border-[rgba(46,41,255,0.7)]" : "border-[rgba(46,41,255,0.4)] bg-gradient-to-br from-[rgba(46,41,255,0.1)] via-[#f2f5f8] to-[#ffffff] hover:border-[rgba(46,41,255,0.7)]"}`}>
        <div className="flex items-center gap-2">
          <span className={`inline-flex h-1.5 w-1.5 animate-pulse rounded-full ${light ? "bg-[#2E29FF]" : "bg-[#2E29FF]"}`} />
          <span className={`text-[11px] font-black tracking-[0.2em] ${light ? "text-[#2E29FF]" : "text-[#2E29FF]"}`}>FOUNDING 100</span>
          <span className={`ml-auto text-[10px] font-bold ${light ? "text-[#E2E4E8]" : "text-[#E2E4E8]"}`}>
            {paid}/{FOUNDING_CAP}
          </span>
        </div>
        <div className={`mt-1.5 text-[12px] font-bold leading-tight ${light ? "text-[#0E1726]" : "text-[#0e1726]"}`}>
          Эхний 100 гишүүн{" "}
          <span className={light ? "text-[#2E29FF]" : "text-[#2E29FF]"}>₮49,000 · 3 САР</span> үнэнд
        </div>
        <div className={`mt-2 h-1.5 overflow-hidden rounded-[4px] ${light ? "bg-[rgba(15,23,38,0.08)]" : "bg-[rgba(15,23,38,0.06)]"}`}>
          <div
            className={`h-full rounded-[4px] transition-all duration-700 ${light ? "bg-gradient-to-r from-[#2E29FF] to-[#f2547a]" : "bg-gradient-to-r from-[#2E29FF] to-[#f2547a]"}`}
            style={{ width: `${filledPct}%` }}
          />
        </div>
        <div className={`mt-1.5 text-[10px] font-bold ${light ? "text-[#B45309]" : "text-[#FFB020]"}`}>
          {remaining} суудал үлдсэн · 100 хүрэхэд ₮69k болно
        </div>
      </Link>
    );
  }

  // default — for paywall page header
  return (
    <div className="rounded-[4px] border-2 border-[#2E29FF] bg-[rgba(46,41,255,0.08)] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-[4px] bg-[#2E29FF] px-2 py-0.5 text-[11px] font-black tracking-[0.18em] text-white">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            FOUNDING 100
          </div>
          <div className="mt-2 text-[16px] font-black leading-tight text-[#0e1726]">
            Эхний 100 гишүүн ₮49,000<span className="text-[#2E29FF]"> · 3 САР</span>
          </div>
          <div className="mt-1 text-[11px] font-bold text-[#FFB020]">
            {remaining} суудал үлдсэн · дараа нь ₮69k/сар болно
          </div>
        </div>
        <div className="text-right">
          <div className="text-[28px] font-black leading-none text-[#2E29FF]">{paid}</div>
          <div className="text-[10px] font-bold text-[#E2E4E8]">/ {FOUNDING_CAP}</div>
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-[4px] bg-[rgba(15,23,38,0.06)]">
        <div
          className="h-full rounded-[4px] bg-gradient-to-r from-[#2E29FF] to-[#f2547a] transition-all duration-700"
          style={{ width: `${filledPct}%` }}
        />
      </div>
    </div>
  );
}
