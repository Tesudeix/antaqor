"use client";

import { useEffect, useState } from "react";

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
        <div className="text-[11px] font-medium uppercase tracking-[1px] text-[#888888]">Сарын гишүүнчлэл</div>
        <div className="mt-2 text-[36px] font-bold leading-none tracking-tight text-[#EF2C58]">
          29,000₮
        </div>
        <div className="mt-1 text-[12px] text-[#999999]">сар бүр</div>
        <div className="mt-4 border-t border-[rgba(0,0,0,0.08)] pt-4">
          <div className="text-[12px] text-[#888888]">
            <span className="font-semibold text-[#EF2C58]">{data.paidMembers}</span> идэвхтэй гишүүн
          </div>
        </div>
      </div>
    </div>
  );
}
