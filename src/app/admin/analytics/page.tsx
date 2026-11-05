"use client";

import { useEffect, useMemo, useState } from "react";
import { fmtMNTCompact } from "@/lib/money";
import { T, MONO, Card, Metric, Btn, SectionHeader, Skeleton } from "@/components/admin/kit";

interface DayBucket { day: string; count: number }
interface Analytics {
  kpis: { members: number; totalUsers: number; totalPosts: number; totalReactions: number; revenueAll: number; revenue30: number };
  signupsByDay: DayBucket[];
  postsByDay: DayBucket[];
}

function fill30(b: DayBucket[] = []): DayBucket[] {
  const m = new Map(b.map((x) => [x.day, x.count]));
  const out: DayBucket[] = []; const t = new Date(); t.setHours(0, 0, 0, 0);
  for (let i = 29; i >= 0; i--) { const d = new Date(t.getTime() - i * 864e5).toISOString().slice(0, 10); out.push({ day: d, count: m.get(d) || 0 }); }
  return out;
}

function Bars({ data, color }: { data: DayBucket[]; color: string }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex h-28 items-end gap-[3px]">
      {data.map((d, i) => (
        <div key={i} className="group relative flex-1" title={`${d.day}: ${d.count}`}>
          <div className="w-full rounded-[4px] transition-all" style={{ height: `${Math.max((d.count / max) * 100, 2)}%`, background: color, opacity: 0.55 }} />
        </div>
      ))}
    </div>
  );
}

function toCSV(sign: DayBucket[], posts: DayBucket[]): string {
  const pm = new Map(posts.map((p) => [p.day, p.count]));
  const rows = [["date", "signups", "posts"], ...sign.map((s) => [s.day, String(s.count), String(pm.get(s.day) || 0)])];
  return rows.map((r) => r.join(",")).join("\n");
}

export default function AnalyticsPage() {
  const [a, setA] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/analytics").then((r) => (r.ok ? r.json() : null)).catch(() => null).then((d) => { setA(d); setLoading(false); });
  }, []);

  const signups = useMemo(() => fill30(a?.signupsByDay), [a]);
  const posts = useMemo(() => fill30(a?.postsByDay), [a]);
  const k = a?.kpis;

  const exportCsv = () => {
    const blob = new Blob([toCSV(signups, posts)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `antaqor-analytics-${new Date().toISOString().slice(0, 10)}.csv`; link.click();
    URL.revokeObjectURL(url);
  };

  const tiles = [
    { label: "Гишүүд", value: (k?.members ?? 0).toLocaleString(), accent: "primary" as const },
    { label: "Хэрэглэгч", value: (k?.totalUsers ?? 0).toLocaleString() },
    { label: "Пост", value: (k?.totalPosts ?? 0).toLocaleString() },
    { label: "Реакц", value: (k?.totalReactions ?? 0).toLocaleString() },
    { label: "Нийт орлого", value: fmtMNTCompact(k?.revenueAll), accent: "secondary" as const },
    { label: "Орлого · 30х", value: fmtMNTCompact(k?.revenue30), accent: "ok" as const },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: T.primaryInk }}>Аналитик</div>
          <h1 className="mt-1 text-[26px] font-semibold tracking-tight" style={{ color: T.text }}>Analytics</h1>
          <p className="mt-0.5 text-[12px]" style={{ color: T.faint }}>Сүүлийн 30 хоног</p>
        </div>
        <Btn variant="ghost" size="sm" onClick={exportCsv}>CSV татах</Btn>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-[104px]" />)}</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {tiles.map((t) => <Metric key={t.label} label={t.label} value={t.value} accent={t.accent} />)}
        </div>
      )}

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <div>
          <SectionHeader title="Бүртгэл" hint="30 хоног" />
          <Card hud className="p-5">
            {loading ? <Skeleton className="h-28" /> : <Bars data={signups} color={T.primary} />}
            <div className="mt-3 text-right text-[12px]" style={{ fontFamily: MONO, color: T.muted }}>нийт {signups.reduce((x, y) => x + y.count, 0)}</div>
          </Card>
        </div>
        <div>
          <SectionHeader title="Контент · пост" hint="30 хоног" />
          <Card hud className="p-5">
            {loading ? <Skeleton className="h-28" /> : <Bars data={posts} color={T.secondary} />}
            <div className="mt-3 text-right text-[12px]" style={{ fontFamily: MONO, color: T.muted }}>нийт {posts.reduce((x, y) => x + y.count, 0)}</div>
          </Card>
        </div>
      </div>
    </div>
  );
}
