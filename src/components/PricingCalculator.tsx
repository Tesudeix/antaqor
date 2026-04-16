"use client";

import { useEffect, useState } from "react";

function formatMNT(n: number) {
  return n.toLocaleString("mn-MN") + "₮";
}

interface PricingData {
  paidMembers: number;
  basePrice: number;
  currentPrice: number;
  nextPrice: number;
  increment: number;
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
      {/* Price */}
      <div className="rounded-[4px] border border-[#1a1a22] bg-[#0c0c10] p-5 text-center">
        <div className="text-[11px] font-medium uppercase tracking-[1px] text-[#6b6b78]">Одоогийн үнэ</div>
        <div className="mt-2 text-[36px] font-bold leading-none tracking-tight text-[#FFFF01]">
          {formatMNT(data.currentPrice)}
        </div>
        <div className="mt-1 text-[12px] text-[#4a4a55]">сар бүр</div>

        <div className="mt-4 border-t border-[#1a1a22] pt-4">
          <div className="text-[12px] text-[#6b6b78]">
            Гишүүн бүр <span className="font-semibold text-[#FFFF01]">+{formatMNT(data.increment)}</span> нэмнэ
          </div>
          <div className="mt-1 flex items-center justify-center gap-3 text-[11px] text-[#4a4a55]">
            <span><span className="font-semibold text-[#FFFF01]">{data.paidMembers}</span> гишүүн</span>
            <span>·</span>
            <span className="line-through">{formatMNT(data.basePrice)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
