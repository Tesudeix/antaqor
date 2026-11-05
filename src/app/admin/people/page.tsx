"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { T, MONO, Ico, Card, Metric, SectionHeader, Empty, Skeleton } from "@/components/admin/kit";

interface Person {
  name: string; username: string; email: string; phone: string;
  level: number; xp: number; membershipActive: boolean; leadStatus: string | null;
  banned: boolean; createdAt: string; interests?: string[];
}

const SEGMENTS = [
  { key: "all", label: "Бүгд" },
  { key: "member", label: "Гишүүн" },
  { key: "lead", label: "Lead" },
  { key: "free", label: "Үнэгүй" },
];

function seg(p: Person): "member" | "lead" | "free" {
  if (p.membershipActive) return "member";
  if (p.leadStatus) return "lead";
  return "free";
}
function fmtDate(iso: string): string {
  return iso ? new Date(iso).toLocaleDateString("mn-MN", { year: "2-digit", month: "short", day: "numeric" }) : "—";
}

const SEG_STYLE: Record<string, { label: string; color: string }> = {
  member: { label: "Гишүүн", color: T.okInk },
  lead: { label: "Lead", color: T.secondaryInk },
  free: { label: "Үнэгүй", color: T.faint },
};

export default function PeopleDirectory() {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => { const t = setTimeout(() => setDebounced(q.trim()), 350); return () => clearTimeout(t); }, [q]);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/people?search=${encodeURIComponent(debounced)}`)
      .then((r) => (r.ok ? r.json() : null)).catch(() => null)
      .then((d) => { if (d) setPeople(d.people || []); setLoading(false); });
  }, [debounced]);

  const counts = useMemo(() => ({
    all: people.length,
    member: people.filter((p) => seg(p) === "member").length,
    lead: people.filter((p) => seg(p) === "lead").length,
    free: people.filter((p) => seg(p) === "free").length,
  }), [people]);

  const newThisWeek = useMemo(() => {
    const wk = Date.now() - 7 * 864e5;
    return people.filter((p) => p.createdAt && new Date(p.createdAt).getTime() >= wk).length;
  }, [people]);

  const rows = filter === "all" ? people : people.filter((p) => seg(p) === filter);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-7">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: T.primaryInk }}>Хүмүүс</div>
        <h1 className="mt-1 text-[26px] font-semibold tracking-tight" style={{ color: T.text }}>People</h1>
        <p className="mt-0.5 text-[12px]" style={{ color: T.faint }}>Гишүүд · Lead · бүх контакт нэг лавлахад</p>
      </div>

      {loading && people.length === 0 ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[104px]" />)}</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="Нийт хүн" value={counts.all.toLocaleString()} accent="primary" />
          <Metric label="Идэвхтэй гишүүн" value={counts.member.toLocaleString()} accent="ok" />
          <Metric label="Lead" value={counts.lead.toLocaleString()} accent="secondary" />
          <Metric label="Шинэ · 7 хоног" value={newThisWeek.toLocaleString()} />
        </div>
      )}

      {/* Search + segments */}
      <div className="mt-7 flex flex-wrap items-center gap-3">
        <div className="relative flex-1" style={{ minWidth: 220 }}>
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: T.faint }}><Ico d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" className="h-4 w-4" /></span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Нэр, имэйл, утас, username хайх…"
            className="w-full rounded-[4px] border bg-[#0A0A0A] py-2.5 pl-9 pr-3 text-[14px] outline-none transition focus:border-[rgba(46,41,255,0.5)]"
            style={{ borderColor: T.border, color: T.text }} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SEGMENTS.map((s) => {
            const active = filter === s.key;
            return (
              <button key={s.key} onClick={() => setFilter(s.key)}
                className="rounded-[4px] px-3 py-1.5 text-[12px] font-semibold transition"
                style={active ? { background: T.primary, color: "#fff" } : { color: T.muted, background: "rgba(255,255,255,0.03)" }}>
                {s.label} <span style={{ fontFamily: MONO, opacity: 0.7 }}>{counts[s.key as keyof typeof counts]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Directory */}
      <div className="mt-3">
        {loading ? (
          <Card><div className="space-y-3 p-4">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} />)}</div></Card>
        ) : rows.length === 0 ? (
          <Empty title="Хүн олдсонгүй" hint={debounced ? "Хайлтаа өөрчилж үзнэ үү." : "Контакт бүртгэгдэхэд энд харагдана."} />
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left">
                <thead>
                  <tr className="border-b text-[10px] uppercase tracking-[0.1em]" style={{ borderColor: T.border, color: T.faint }}>
                    <th className="px-4 py-3 font-semibold">Нэр</th>
                    <th className="px-4 py-3 font-semibold">Холбоо барих</th>
                    <th className="px-4 py-3 font-semibold">Төлөв</th>
                    <th className="px-4 py-3 text-right font-semibold">Level · XP</th>
                    <th className="px-4 py-3 text-right font-semibold">Элссэн</th>
                    <th className="px-4 py-3 text-right font-semibold"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p, i) => {
                    const s = SEG_STYLE[seg(p)];
                    return (
                      <tr key={i} className="border-b transition hover:bg-[rgba(255,255,255,0.02)]" style={{ borderColor: T.border }}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: T.text }}>
                            {p.name}
                            {p.banned && <span className="rounded-[4px] px-1.5 py-0.5 text-[11px] font-bold" style={{ color: T.badInk, background: "rgba(78,148,208,0.12)" }}>BANNED</span>}
                          </div>
                          {p.username && <div className="text-[11px]" style={{ color: T.faint }}>@{p.username}</div>}
                        </td>
                        <td className="px-4 py-3 text-[12px]" style={{ color: T.muted }}>
                          {p.email || "—"}{p.phone ? <div style={{ fontFamily: MONO, color: T.faint }}>{p.phone}</div> : null}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 rounded-[4px] px-2 py-1 text-[11px] font-semibold" style={{ color: s.color, background: `${s.color}1A` }}>
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />{s.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-[12px]" style={{ fontFamily: MONO, color: T.text }}>L{p.level} · {p.xp.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-[12px]" style={{ fontFamily: MONO, color: T.faint }}>{fmtDate(p.createdAt)}</td>
                        <td className="px-4 py-3 text-right">
                          <Link href={`/admin/members?search=${encodeURIComponent(p.email || p.username || p.name)}`}
                            className="text-[11px] font-semibold transition hover:text-[#E8E8E8]" style={{ color: T.muted }}>Удирдах →</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      <p className="mt-4 text-[11px]" style={{ color: T.faint }}>
        Гишүүнчлэл, хориг, оноо засварлах бүрэн удирдлага <Link href="/admin/members" className="underline" style={{ color: T.secondaryInk }}>Гишүүд</Link> хэсэгт.
      </p>
    </div>
  );
}
