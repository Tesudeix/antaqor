"use client";

import Link from "next/link";

const TIERS = [
  { name: "Үнэгүй", price: "₮0", period: "/сар", desc: "Community + бичлэгтэй хичээл (хязгаартай)", color: "#6b7280", href: "/auth/signup" },
  { name: "Edgerunners", price: "9,000₮", period: "/сар", desc: "Бүх хичээл · tools · live · чат — бүрэн хандалт", color: "#1080CA", popular: true, href: "/clan" },
  { name: "Founding 100", price: "49,000₮", period: "LIFETIME", desc: "Эхний 100 гишүүн · насан туршийн эрх", color: "#8B5CF6", href: "/clan" },
];

export default function PricingCalculator() {
  return (
    <div className="mx-auto w-full max-w-sm px-4 pb-10">
      <div className="space-y-2">
        {TIERS.map((t) => (
          <Link
            key={t.name}
            href={t.href}
            className={`block rounded-none border p-4 transition hover:shadow-sm ${
              t.popular
                ? "border-[rgba(16,128,202,0.3)] bg-[rgba(16,128,202,0.03)]"
                : "border-[rgba(15,23,38,0.08)] bg-[#eef2f6]"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-bold" style={{ color: t.color }}>{t.name}</span>
                  {t.popular && (
                    <span className="rounded-full bg-[#1080CA] px-2 py-0.5 text-[8px] font-bold text-[#0E0E10]">POPULAR</span>
                  )}
                </div>
                <div className="mt-0.5 text-[11px] text-[#6b7280]">{t.desc}</div>
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
        className="mt-3 flex w-full items-center justify-center rounded-none bg-[#1080CA] py-2.5 text-[13px] font-bold text-[#0E0E10] transition hover:bg-[#4FA8E8]"
      >
        Дэлгэрэнгүй үзэх
      </Link>
    </div>
  );
}
