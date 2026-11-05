"use client";

import Link from "next/link";

const TIERS = [
  { name: "Үнэгүй", price: "₮0", period: "/сар", desc: "Community + бичлэгтэй хичээл (хязгаартай)", color: "var(--t-body, #30333F)", href: "/auth/signup" },
  { name: "Antaqor хүрээлэл", price: "9,000₮", period: "/сар", desc: "Бүх хичээл · tools · live · чат — бүрэн хандалт", color: "var(--accent-ink, #2E29FF)", popular: true, href: "/clan" },
  { name: "Founding 100", price: "49,000₮", period: "3 САР", desc: "Эхний 100 гишүүн · 3 сарын бүрэн эрх", color: "var(--accent-ink, #2E29FF)", href: "/pricing" },
];

export default function PricingCalculator() {
  return (
    <div className="mx-auto w-full max-w-sm px-4 pb-10">
      <div className="space-y-2">
        {TIERS.map((t) => (
          <Link
            key={t.name}
            href={t.href}
            className={`block rounded-[4px] border p-4 transition hover:shadow-sm ${
              t.popular
                ? "border-[rgba(46,41,255,0.3)] bg-[rgba(46,41,255,0.03)]"
                : "border-[rgba(15,23,38,0.08)] bg-[#eef2f6]"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-bold" style={{ color: t.color }}>{t.name}</span>
                  {t.popular && (
                    <span className="rounded-[4px] bg-[#2E29FF] px-2 py-0.5 text-[8px] font-bold text-white">POPULAR</span>
                  )}
                </div>
                <div className="mt-0.5 text-[11px] text-[#E2E4E8]">{t.desc}</div>
              </div>
              <div className="text-right">
                <div className="text-[16px] font-bold text-[#0e1726]">{t.price}</div>
                <div className="text-[10px] text-[#475569]">{t.period}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
      <Link
        href="/clan"
        className="mt-3 flex w-full items-center justify-center rounded-[4px] bg-[#2E29FF] py-2.5 text-[13px] font-bold text-white transition hover:bg-[#1F1AD9]"
      >
        Дэлгэрэнгүй үзэх
      </Link>
    </div>
  );
}
