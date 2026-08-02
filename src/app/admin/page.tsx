"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fmtMNTCompact } from "@/lib/money";
import { T, MONO, Ico, Card, Metric, Btn, SectionHeader, Empty, Skeleton } from "@/components/admin/kit";

// ─── Command Center — Edgerunner. Гол урсгал: шинэ бүртгэл → email → орлого. ───

interface Stats { totalUsers: number; totalMembers: number; totalPosts: number; recentSignups: number }
interface DayBucket { day: string; count: number }
interface Analytics { kpis: { members: number; totalUsers: number; totalPosts: number; revenueAll: number; revenue30: number }; signupsByDay: DayBucket[] }
interface NewMember { id: string; name: string; email: string; phone: string; plan: string; paid: boolean; createdAt: string }

function fill30(b: DayBucket[] = []): DayBucket[] {
  const m = new Map(b.map((x) => [x.day, x.count]));
  const out: DayBucket[] = []; const t = new Date(); t.setHours(0, 0, 0, 0);
  for (let i = 29; i >= 0; i--) { const d = new Date(t.getTime() - i * 864e5).toISOString().slice(0, 10); out.push({ day: d, count: m.get(d) || 0 }); }
  return out;
}
function ago(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime(); const min = Math.floor(ms / 6e4);
  if (min < 1) return "саяхан"; if (min < 60) return `${min} мин`;
  const h = Math.floor(min / 60); if (h < 24) return `${h} цаг`;
  return `${Math.floor(h / 24)} хоног`;
}

function Sparkline({ data }: { data: DayBucket[] }) {
  const max = Math.max(...data.map((d) => d.count), 1); const n = data.length;
  const pts = data.map((d, i) => `${(i / (n - 1)) * 300},${36 - (d.count / max) * 32}`).join(" ");
  return (
    <svg viewBox="0 0 300 40" preserveAspectRatio="none" className="h-10 w-full">
      <polyline points={pts} fill="none" stroke={T.secondary} strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

// Хамгийн их хэрэглэдэг модулиуд л үлдээв — бусад нь ⌘K болон sidebar-т бий.
const MODULES = [
  { href: "/admin/members", label: "Гишүүд", desc: "Бүртгэл · CRM", icon: "M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" },
  { href: "/admin/email", label: "Email илгээх", desc: "Бүртгүүлсэн рүү", icon: "M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" },
  { href: "/admin/hero", label: "Нүүр слайдер", desc: "Зураг · текст", icon: "M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" },
  { href: "/admin/payments", label: "Төлбөр", desc: "Орлого · гүйлгээ ₮", icon: "M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" },
  { href: "/admin/classroom", label: "Хичээл", desc: "Курс · бүртгэл", icon: "M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0112 13.489a50.702 50.702 0 017.74-3.342" },
  { href: "/admin/automation", label: "Автоматжуулалт", desc: "Comment → DM → захиалга", icon: "M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" },
  { href: "/admin/analytics", label: "Аналитик", desc: "Тоо · хандалт", icon: "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" },
  { href: "/admin/site", label: "Контент", desc: "Сайтын текст", icon: "M2.25 7.125C2.25 6.504 2.754 6 3.375 6h6c.621 0 1.125.504 1.125 1.125v3.75c0 .621-.504 1.125-1.125 1.125h-6a1.125 1.125 0 01-1.125-1.125v-3.75zM14.25 8.625c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v8.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-8.25zM3.75 16.125c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-2.25z" },
];

export default function CommandCenter() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [ana, setAna] = useState<Analytics | null>(null);
  const [newMembers, setNewMembers] = useState<NewMember[]>([]);
  const [newCount, setNewCount] = useState(0);
  const [autoEnabled, setAutoEnabled] = useState<boolean | null>(null);
  const [autoBusy, setAutoBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [s, a, nm, ms] = await Promise.all([
        fetch("/api/admin/stats").then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch("/api/admin/analytics").then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch("/api/admin/new-members?days=7").then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch("/api/admin/meta/settings").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);
      setStats(s); setAna(a);
      setNewMembers((nm?.members || []).slice(0, 8));
      setNewCount(nm?.count || 0);
      setAutoEnabled(ms?.settings?.automationEnabled !== false);
      setLoading(false);
    })();
  }, []);

  // DM автоматжуулалтын master унтраалга — унтраавал бүх чат хүн рүү очно.
  const toggleAutomation = async () => {
    if (autoEnabled === null || autoBusy) return;
    const next = !autoEnabled;
    setAutoBusy(true);
    try {
      const r = await fetch("/api/admin/meta/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ automationEnabled: next }),
      });
      if (r.ok) setAutoEnabled(next);
    } finally {
      setAutoBusy(false);
    }
  };

  const k = ana?.kpis;
  const members = k?.members ?? stats?.totalMembers ?? null;
  const revenue30 = k?.revenue30 ?? null;
  const trend = useMemo(() => fill30(ana?.signupsByDay), [ana]);
  const today = new Date().toLocaleDateString("mn-MN", { month: "long", day: "numeric", weekday: "long" });

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="chrome flex items-center gap-2 text-[9px] font-bold">
            <span className="text-[#1080CA]">[ADMIN]</span>
            <span className="text-[#1080CA]">/////</span>
            <span style={{ color: T.faint }}>COMMAND CENTER</span>
          </div>
          <h1 className="mt-1 text-[26px] font-bold tracking-tight" style={{ color: "#1080CA", fontFamily: "var(--font-display)" }}>
            Сайн байна уу
          </h1>
          <p className="mt-0.5 text-[12px] capitalize" style={{ color: T.faint }}>{today}</p>
        </div>
        <button
          onClick={toggleAutomation}
          disabled={autoEnabled === null || autoBusy}
          title={autoEnabled ? "DM автоматжуулалтыг унтраах" : "DM автоматжуулалтыг асаах"}
          className="inline-flex items-center gap-2 rounded-[4px] border px-3 py-1.5 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            borderColor: autoEnabled ? "rgba(74,222,128,0.4)" : "rgba(79,168,232,0.5)",
            color: autoEnabled ? T.ok : T.bad,
            background: autoEnabled ? "rgba(74,222,128,0.08)" : "rgba(79,168,232,0.08)",
          }}
        >
          {autoBusy ? (
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: autoEnabled ? T.ok : T.bad }} />
          )}
          Автомат · {autoEnabled === null ? "…" : autoEnabled ? "ON" : "OFF"}
        </button>
      </div>

      {/* Metrics */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[104px]" />)}</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="Шинэ бүртгэл · 7 хоног" value={newCount.toLocaleString()} accent="secondary" sub="Доор жагсаалт бий" />
          <Metric label="Идэвхтэй гишүүн" value={(members ?? 0).toLocaleString()} accent="primary" sub="Төлбөртэй" />
          <Metric label="Орлого · 30 хоног" value={fmtMNTCompact(revenue30)} accent="ok" sub="Сүүлийн сар" />
          <Metric label="Нийт бүртгэл" value={(stats?.totalUsers ?? 0).toLocaleString()} sub="Бүх хэрэглэгч" />
        </div>
      )}

      {/* Trend */}
      <Card hud className="mt-3 p-5">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: T.faint }}>Бүртгэл · 30 хоног</div>
          <div className="text-[12px]" style={{ fontFamily: MONO, color: T.muted }}>{trend.reduce((a, b) => a + b.count, 0)}</div>
        </div>
        <div className="mt-3">{loading ? <Skeleton className="h-10" /> : <Sparkline data={trend} />}</div>
      </Card>

      {/* Шинэ бүртгэл + модулиуд */}
      <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_380px]">
        <div>
          <SectionHeader
            title="Шинэ бүртгэл · 7 хоног"
            hint="хамгийн сүүлийнх дээрээ"
            action={<Btn href="/admin/email" size="sm">Email илгээх →</Btn>}
          />
          {loading ? (
            <Card><div className="space-y-3 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} />)}</div></Card>
          ) : newMembers.length === 0 ? (
            <Empty title="Шинэ бүртгэл алга" hint="Сүүлийн 7 хоногт бүртгүүлсэн хүн энд гарна." />
          ) : (
            <Card>
              <div className="divide-y" style={{ borderColor: T.border }}>
                {newMembers.map((m) => (
                  <Link key={m.id} href={`/profile/${m.id}`} className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-[rgba(255,255,255,0.02)]">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[13px] font-semibold" style={{ color: T.text }}>{m.name}</span>
                        {m.paid ? (
                          <span className="chrome rounded-[4px] bg-[#1080CA] px-1.5 py-0.5 text-[7px] font-bold text-[#161618]">ТӨЛСӨН</span>
                        ) : (
                          <span className="chrome rounded-[4px] border border-[rgba(255,255,255,0.14)] px-1.5 py-0.5 text-[7px] font-bold" style={{ color: T.faint }}>FREE</span>
                        )}
                      </div>
                      <div className="truncate text-[11px]" style={{ fontFamily: MONO, color: T.muted }}>
                        {m.email}{m.phone ? ` · ${m.phone}` : ""}
                      </div>
                    </div>
                    <span className="shrink-0 text-[11px]" style={{ fontFamily: MONO, color: T.faint }}>{ago(m.createdAt)}</span>
                  </Link>
                ))}
              </div>
              <div className="border-t px-4 py-2.5" style={{ borderColor: T.border }}>
                <Link href="/admin/members" className="chrome text-[9px] font-bold text-[#1080CA] hover:brightness-110">
                  БҮХ ГИШҮҮД →
                </Link>
              </div>
            </Card>
          )}
        </div>

        <div>
          <SectionHeader title="Модулиуд" />
          <div className="grid grid-cols-2 gap-3">
            {MODULES.map((m) => (
              <Link key={m.href} href={m.href}>
                <Card hover className="group flex items-center gap-3 p-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[4px]" style={{ background: "rgba(16,128,202,0.12)", color: T.primary }}>
                    <Ico d={m.icon} className="h-[18px] w-[18px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold" style={{ color: T.text }}>{m.label}</div>
                    <div className="mt-0.5 truncate text-[11px]" style={{ color: T.faint }}>{m.desc}</div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
