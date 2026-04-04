"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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
    <div className="mx-auto w-full max-w-md px-4 py-10">
      {/* Price */}
      <div className="text-center">
        <div className="text-[11px] font-medium tracking-wide text-[#6b6b78]">Одоогийн үнэ</div>
        <div className="mt-1 font-[Bebas_Neue] text-5xl tracking-[2px] text-[#FFD300]">
          {formatMNT(data.currentPrice)}
        </div>
        <div className="mt-1 text-[12px] text-[#4a4a55]">сар бүр</div>
      </div>

      {/* Per-member increment */}
      <div className="mt-5 rounded-[10px] border border-[rgba(255,211,0,0.15)] bg-[rgba(255,211,0,0.04)] px-4 py-3 text-center">
        <div className="text-[13px] font-semibold text-[#e8e6e1]">
          Гишүүн бүр <span className="text-[#FFD300]">+{formatMNT(data.increment)}</span> нэмнэ
        </div>
        <div className="mt-1 text-[11px] text-[#6b6b78]">
          Дараагийн гишүүний үнэ <span className="font-semibold text-[#e8e6e1]">{formatMNT(data.nextPrice)}</span>
        </div>
      </div>

      {/* Social proof */}
      <div className="mt-4 text-center text-[12px] text-[#4a4a55]">
        <span className="font-semibold text-[#FFD300]">{data.paidMembers}</span> гишүүн нэгдсэн
        <span className="mx-1.5">·</span>
        <span className="line-through text-[#3a3a48]">{formatMNT(data.basePrice)}</span>
      </div>

      {/* CTA */}
      <div className="mt-6 text-center">
        <Link
          href="/auth/signup"
          className="inline-block rounded-[10px] bg-[#FFD300] px-8 py-3 text-[15px] font-bold text-black transition hover:bg-[#e6be00] active:scale-[0.98]"
        >
          Нэгдэх
        </Link>
      </div>
    </div>
  );
}
