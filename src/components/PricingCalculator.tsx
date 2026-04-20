"use client";

import Link from "next/link";

const TIERS = [
  { name: "Entry", price: "49,000₮", period: "/сар", desc: "Community + бичлэгтэй хичээл", color: "#888" },
  { name: "Core", price: "149,000₮", period: "/сар", desc: "Live session + шууд холбогдох", color: "#EF2C58", popular: true },
  { name: "Inner Circle", price: "990,000₮", period: "/жил", desc: "1:1 зөвлөгөө · 20 хүн", color: "#8B5CF6" },
];

export default function PricingCalculator() {
  return (
    <div className="mx-auto w-full max-w-sm px-4 pb-10">
      <div className="space-y-2">
        {TIERS.map((t) => (
          <Link
            key={t.name}
            href="/clan"
            className={`block rounded-[4px] border p-4 transition hover:shadow-sm ${
              t.popular
                ? "border-[rgba(239,44,88,0.3)] bg-[rgba(239,44,88,0.03)]"
                : "border-[rgba(255,255,255,0.08)] bg-[#141414]"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-bold" style={{ color: t.color }}>{t.name}</span>
                  {t.popular && (
                    <span className="rounded-full bg-[#EF2C58] px-2 py-0.5 text-[8px] font-bold text-white">POPULAR</span>
                  )}
                </div>
                <div className="mt-0.5 text-[11px] text-[#888]">{t.desc}</div>
              </div>
              <div className="text-right">
                <div className="text-[16px] font-bold text-[#E8E8E8]">{t.price}</div>
                <div className="text-[10px] text-[#AAA]">{t.period}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
      <Link
        href="/clan"
        className="mt-3 flex w-full items-center justify-center rounded-[4px] bg-[#EF2C58] py-2.5 text-[13px] font-bold text-white transition hover:bg-[#D4264E]"
      >
        Дэлгэрэнгүй үзэх
      </Link>
    </div>
  );
}
