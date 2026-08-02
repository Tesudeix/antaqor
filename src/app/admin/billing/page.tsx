"use client";

import { useEffect, useState } from "react";
import { fmtMNT, fmtMNTCompact } from "@/lib/money";
import { T, MONO, Card, Metric, Status, SectionHeader, Empty, Skeleton } from "@/components/admin/kit";

interface Metrics { paidTotal: number; paid30: number; paidCount: number; pendingAmount: number; pendingCount: number; membershipPaid: number; creditsPaid: number }
interface Txn { id: string; name: string; type: string; amount: number; status: "paid" | "pending" | "failed"; createdAt: string | null }

const TYPE_LABEL: Record<string, string> = { membership: "Гишүүнчлэл", credits: "₮ багц" };
const FILTERS = [
  { key: "all", label: "Бүгд" },
  { key: "paid", label: "Төлсөн" },
  { key: "pending", label: "Хүлээгдэж буй" },
  { key: "failed", label: "Амжилтгүй" },
];

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("mn-MN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function Billing() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [recent, setRecent] = useState<Txn[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    fetch("/api/admin/billing").then((r) => (r.ok ? r.json() : null)).catch(() => null).then((d) => {
      if (d) { setMetrics(d.metrics); setRecent(d.recent || []); }
      setLoading(false);
    });
  }, []);

  const rows = filter === "all" ? recent : recent.filter((t) => t.status === filter);

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="mb-7">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: T.primary }}>Орлого</div>
        <h1 className="mt-1 text-[26px] font-semibold tracking-tight" style={{ color: T.text }}>Billing</h1>
        <p className="mt-0.5 text-[12px]" style={{ color: T.faint }}>Бүх орлого, гүйлгээ — ₮-ээр</p>
      </div>

      {/* Metrics */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[104px]" />)}</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="Нийт орлого" value={fmtMNTCompact(metrics?.paidTotal)} accent="primary" sub={`${metrics?.paidCount ?? 0} гүйлгээ`} />
          <Metric label="Сүүлийн сар" value={fmtMNTCompact(metrics?.paid30)} accent="secondary" sub="30 хоног" />
          <Metric label="Хүлээгдэж буй" value={metrics?.pendingCount ?? 0} sub={fmtMNT(metrics?.pendingAmount)} />
          <Metric label="Гишүүнчлэл" value={fmtMNTCompact(metrics?.membershipPaid)} accent="ok" sub={`Багц: ${fmtMNTCompact(metrics?.creditsPaid)}`} />
        </div>
      )}

      {/* Transactions */}
      <div className="mt-8">
        <SectionHeader title="Гүйлгээний түүх" hint="сүүлийн 25" />
        <div className="mb-3 flex flex-wrap gap-1.5">
          {FILTERS.map((f) => {
            const active = filter === f.key;
            const count = f.key === "all" ? recent.length : recent.filter((t) => t.status === f.key).length;
            return (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className="rounded-none px-3 py-1.5 text-[12px] font-semibold transition"
                style={active ? { background: T.primary, color: "#fff" } : { color: T.muted, background: "rgba(255,255,255,0.03)" }}>
                {f.label} <span style={{ fontFamily: MONO, opacity: 0.7 }}>{count}</span>
              </button>
            );
          })}
        </div>

        {loading ? (
          <Card><div className="space-y-3 p-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} />)}</div></Card>
        ) : rows.length === 0 ? (
          <Empty title="Гүйлгээ алга" hint="Энэ төлөвт гүйлгээ олдсонгүй." />
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left">
                <thead>
                  <tr className="border-b text-[10px] uppercase tracking-[0.1em]" style={{ borderColor: T.border, color: T.faint }}>
                    <th className="px-4 py-3 font-semibold">Хэрэглэгч</th>
                    <th className="px-4 py-3 font-semibold">Төрөл</th>
                    <th className="px-4 py-3 text-right font-semibold">Дүн</th>
                    <th className="px-4 py-3 font-semibold">Төлөв</th>
                    <th className="px-4 py-3 text-right font-semibold">Огноо</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => (
                    <tr key={t.id} className="border-b transition hover:bg-[rgba(255,255,255,0.02)]" style={{ borderColor: T.border }}>
                      <td className="px-4 py-3 text-[13px] font-semibold" style={{ color: T.text }}>{t.name}</td>
                      <td className="px-4 py-3 text-[12px]" style={{ color: T.muted }}>{TYPE_LABEL[t.type] || t.type}</td>
                      <td className="px-4 py-3 text-right text-[13px] font-semibold" style={{ fontFamily: MONO, color: T.text }}>{fmtMNT(t.amount)}</td>
                      <td className="px-4 py-3"><Status kind={t.status} /></td>
                      <td className="px-4 py-3 text-right text-[12px]" style={{ fontFamily: MONO, color: T.faint }}>{fmtDate(t.createdAt)}</td>
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
