"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface PricingData {
  paidMembers: number;
  currentPrice: number;
}

export default function PricingCalculator() {
  const [data, setData] = useState<PricingData | null>(null);

  useEffect(() => {
    fetch("/api/pricing")
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.paidMembers === "number") setData(d);
      })
      .catch(() => {});
  }, []);

  if (!data) return null;

  return (
    <div className="mx-auto w-full max-w-sm px-4 pb-10">
      <div className="rounded-[4px] border border-[rgba(0,0,0,0.08)] bg-[#FFFFFF] p-5 text-center">
        <div className="text-[11px] font-bold uppercase tracking-[1px] text-[#EF2C58]">AI Training Ground</div>
        <div className="mt-2 text-[36px] font-bold leading-none tracking-tight text-[#1A1A1A]">
          29,000₮
        </div>
        <div className="mt-1 text-[12px] text-[#888888]">/сар · сургалт + challenge + нийгэмлэг</div>
        <div className="mt-4 space-y-1.5 text-left text-[12px] text-[#666666]">
          <div className="flex items-center gap-2">
            <svg className="h-3.5 w-3.5 shrink-0 text-[#EF2C58]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            AI чадвар олгох бодит сургалт
          </div>
          <div className="flex items-center gap-2">
            <svg className="h-3.5 w-3.5 shrink-0 text-[#EF2C58]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            Хамтын суралцах хүрээлэл
          </div>
          <div className="flex items-center gap-2">
            <svg className="h-3.5 w-3.5 shrink-0 text-[#EF2C58]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            Өрсөлдөөн, шагналтай challenge
          </div>
        </div>
        <Link
          href="/auth/signup"
          className="mt-4 flex w-full items-center justify-center rounded-[4px] bg-[#EF2C58] py-2.5 text-[13px] font-bold text-white transition hover:bg-[#D4264E]"
        >
          Одоо эхлэх
        </Link>
        {data.paidMembers > 0 && (
          <div className="mt-3 text-[11px] text-[#888888]">
            <span className="font-semibold text-[#EF2C58]">{data.paidMembers}+</span> гишүүн суралцаж байна
          </div>
        )}
      </div>
    </div>
  );
}
