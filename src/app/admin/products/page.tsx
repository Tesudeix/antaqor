"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fmtMNT, fmtMNTCompact } from "@/lib/money";
import { T, MONO, Card, Metric, Btn, Status, SectionHeader, Empty, Skeleton } from "@/components/admin/kit";

interface Product { _id?: string; slug?: string; title: string; kind?: string; price?: number; published?: boolean; coverImage?: string }

export default function ProductsOverview() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "live" | "draft">("all");

  useEffect(() => {
    fetch("/api/admin/market").then((r) => (r.ok ? r.json() : null)).catch(() => null).then((d) => {
      const list: Product[] = d?.products || d?.items || (Array.isArray(d) ? d : []);
      setItems(list); setLoading(false);
    });
  }, []);

  const live = items.filter((p) => p.published).length;
  const value = items.reduce((a, p) => a + (p.published ? (p.price || 0) : 0), 0);
  const rows = filter === "all" ? items : items.filter((p) => (filter === "live" ? p.published : !p.published));

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: T.primaryInk }}>Бараа</div>
          <h1 className="mt-1 text-[26px] font-semibold tracking-tight" style={{ color: T.text }}>Products</h1>
          <p className="mt-0.5 text-[12px]" style={{ color: T.faint }}>Бүтээгдэхүүн · үнэ ₮-ээр</p>
        </div>
        <Btn href="/admin/market" variant="primary"><span className="text-[16px] leading-none">+</span> Шинэ бараа</Btn>
      </div>

      {loading ? (
        <div className="grid grid-cols-3 gap-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-[104px]" />)}</div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <Metric label="Нийт бараа" value={items.length} accent="primary" />
          <Metric label="Нийтэлсэн" value={live} accent="ok" />
          <Metric label="Каталогийн үнэ" value={fmtMNTCompact(value)} accent="secondary" />
        </div>
      )}

      <div className="mt-7 flex gap-1.5">
        {(["all", "live", "draft"] as const).map((f) => {
          const active = filter === f;
          const count = f === "all" ? items.length : f === "live" ? live : items.length - live;
          return (
            <button key={f} onClick={() => setFilter(f)} className="rounded-[4px] px-3 py-1.5 text-[12px] font-semibold transition"
              style={active ? { background: T.primary, color: "#fff" } : { color: T.muted, background: "rgba(255,255,255,0.03)" }}>
              {f === "all" ? "Бүгд" : f === "live" ? "Нийтэлсэн" : "Ноорог"} <span style={{ fontFamily: MONO, opacity: 0.7 }}>{count}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-3">
        {loading ? (
          <Card><div className="space-y-3 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} />)}</div></Card>
        ) : rows.length === 0 ? (
          <Empty title="Бараа алга" hint="Шинэ бүтээгдэхүүн нэмж борлуулалтаа эхлүүлнэ үү." cta={<Btn href="/admin/market" variant="secondary" size="sm">Бараа нэмэх</Btn>} />
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] border-collapse text-left">
                <thead>
                  <tr className="border-b text-[10px] uppercase tracking-[0.1em]" style={{ borderColor: T.border, color: T.faint }}>
                    <th className="px-4 py-3 font-semibold">Бараа</th>
                    <th className="px-4 py-3 font-semibold">Төрөл</th>
                    <th className="px-4 py-3 text-right font-semibold">Үнэ</th>
                    <th className="px-4 py-3 font-semibold">Төлөв</th>
                    <th className="px-4 py-3 text-right font-semibold"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p, i) => (
                    <tr key={p._id || p.slug || i} className="border-b transition hover:bg-[rgba(255,255,255,0.02)]" style={{ borderColor: T.border }}>
                      <td className="px-4 py-3 text-[13px] font-semibold" style={{ color: T.text }}>{p.title}</td>
                      <td className="px-4 py-3 text-[12px]" style={{ color: T.muted }}>{p.kind || "—"}</td>
                      <td className="px-4 py-3 text-right text-[13px] font-semibold" style={{ fontFamily: MONO, color: T.text }}>{fmtMNT(p.price || 0)}</td>
                      <td className="px-4 py-3"><Status kind={p.published ? "live" : "draft"} /></td>
                      <td className="px-4 py-3 text-right">
                        <Link href="/admin/market" className="text-[11px] font-semibold transition hover:text-[#E8E8E8]" style={{ color: T.muted }}>Засах →</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
