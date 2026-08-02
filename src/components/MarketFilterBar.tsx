"use client";

import Link from "next/link";
import { useState } from "react";

// Results header ("N бүтээгдэхүүн" + Filter & Sort button with active-filter
// count badge) over a discovery panel (search · price · sort · category).
// Desktop: panel always visible. Mobile: collapses behind the button.

const CATEGORIES = [
  { key: "All", label: "Бүгд", color: "#1080CA" },
  { key: "Prompt", label: "Prompt", color: "#1080CA" },
  { key: "Course", label: "Курс", color: "#1080CA" },
  { key: "Template", label: "Template", color: "#06B6D4" },
  { key: "Agent", label: "AI Agent", color: "#F59E0B" },
  { key: "Service", label: "Сервис", color: "#EC4899" },
  { key: "Digital", label: "Digital", color: "#1080CA" },
];
const SORTS = [
  { key: "new", label: "Шинэ" }, { key: "popular", label: "Эрэлттэй" },
  { key: "price_asc", label: "Үнэ ↑" }, { key: "price_desc", label: "Үнэ ↓" },
];
const PRICES = [
  { key: "all", label: "Бүгд" }, { key: "free", label: "Үнэгүй" }, { key: "paid", label: "Төлбөртэй" },
];

export default function MarketFilterBar({
  category, q, sort, price, total,
}: { category: string; q: string; sort: string; price: string; total: number }) {
  const [open, setOpen] = useState(false);

  const hrefWith = (patch: Partial<{ category: string; q: string; sort: string; price: string }>) => {
    const m = { category, q, sort, price, ...patch };
    const p = new URLSearchParams();
    if (m.category && m.category !== "All") p.set("category", m.category);
    if (m.q) p.set("q", m.q);
    if (m.sort && m.sort !== "new") p.set("sort", m.sort);
    if (m.price && m.price !== "all") p.set("price", m.price);
    const s = p.toString();
    return s ? `/market?${s}` : "/market";
  };

  const activeCount =
    (category !== "All" ? 1 : 0) + (q ? 1 : 0) + (sort !== "new" ? 1 : 0) + (price !== "all" ? 1 : 0);

  return (
    <div className="sticky top-2 z-20">
      {/* Results header */}
      <div className="flex items-center justify-between gap-3 rounded-none border border-[rgba(15,23,38,0.08)] bg-[#f7f9fb] px-3 py-2.5">
        <span className="text-[13px] text-[#6b7280]">
          <span className="font-bold text-[#0e1726]">{total.toLocaleString("mn-MN")}</span> бүтээгдэхүүн
        </span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="inline-flex items-center gap-2 rounded-none border-2 border-[#0e1726] bg-white px-3 py-1.5 text-[12px] font-black text-[#0e1726] transition hover:bg-[#0e1726] hover:text-white md:cursor-default"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4.5h18M6 12h12M10 19.5h4" />
          </svg>
          Filter & Sort
          {activeCount > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center bg-[#0e1726] px-1 text-[10px] font-black leading-none text-white">{activeCount}</span>
          )}
        </button>
      </div>

      {/* Discovery panel */}
      <div className={`${open ? "block" : "hidden"} md:block`}>
        <div className="mt-1.5 rounded-none border border-[rgba(15,23,38,0.08)] bg-[#f7f9fb] p-2.5 shadow-[0_6px_20px_rgba(0,0,0,0.18)]">
          <div className="flex flex-col gap-2.5 md:flex-row md:items-center">
            <form action="/market" method="get" className="relative min-w-0 flex-1">
              {category !== "All" && <input type="hidden" name="category" value={category} />}
              {sort !== "new" && <input type="hidden" name="sort" value={sort} />}
              {price !== "all" && <input type="hidden" name="price" value={price} />}
              <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input type="text" name="q" defaultValue={q} placeholder="Хайх — prompt, course, agent…"
                className="w-full rounded-none border border-[rgba(15,23,38,0.08)] bg-[#eef2f6] py-2.5 pl-9 pr-3 text-[13px] text-[#0e1726] placeholder-[#94a3b8] outline-none transition focus:border-[rgba(16,128,202,0.4)]" />
            </form>
            <div className="flex shrink-0 items-center gap-0.5 rounded-none border border-[rgba(15,23,38,0.08)] bg-[#eef2f6] p-0.5">
              {PRICES.map((pr) => {
                const on = price === pr.key;
                return (
                  <Link key={pr.key} href={hrefWith({ price: pr.key })} scroll={false}
                    className="rounded-none px-2.5 py-1.5 text-[11px] font-bold transition"
                    style={{ background: on ? "#1080CA" : "transparent", color: on ? "#fff" : "#6b7280" }}>{pr.label}</Link>
                );
              })}
            </div>
            <div className="flex shrink-0 items-center gap-1 overflow-x-auto scrollbar-hide">
              {SORTS.map((s) => {
                const on = sort === s.key;
                return (
                  <Link key={s.key} href={hrefWith({ sort: s.key })} scroll={false}
                    className="shrink-0 rounded-none border px-2.5 py-1.5 text-[11px] font-bold transition"
                    style={{ borderColor: on ? "#1080CA" : "rgba(15,23,38,0.08)", color: on ? "#1080CA" : "#6b7280", background: on ? "rgba(16,128,202,0.06)" : "transparent" }}>{s.label}</Link>
                );
              })}
            </div>
          </div>
          <div className="mt-2 overflow-x-auto scrollbar-hide">
            <div className="flex items-center gap-1.5">
              {CATEGORIES.map((c) => {
                const active = category === c.key;
                return (
                  <Link key={c.key} href={hrefWith({ category: c.key })} scroll={false}
                    className="shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-all duration-200"
                    style={{ background: active ? c.color : "rgba(15,23,38,0.04)", color: active ? "#FFFFFF" : "#6b7280", boxShadow: active ? `0 0 20px ${c.color}26` : "none" }}>{c.label}</Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
