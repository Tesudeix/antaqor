"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { T, MONO, Ico, Card, Metric, Btn, SectionHeader, Empty } from "@/components/admin/kit";

export interface LinkedUser {
  _id: string; name?: string; username?: string; email?: string;
  credits?: number; subscriptionExpiresAt?: string; level?: number; xp?: number; streakDays?: number; role?: string;
}

export interface LeanConv {
  _id: string;
  platform: string;
  partnerId: string;
  partnerName?: string;
  partnerUsername?: string;
  partnerProfilePic?: string;
  intentScore?: number;
  intentLabel?: string;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  leadStatus?: "new" | "contacted" | "qualified" | "won" | "lost";
  adminNotes?: string;
  linkedUserId?: LinkedUser | string | null;
}

type LeadStatus = NonNullable<LeanConv["leadStatus"]>;

const STATUS: { value: LeadStatus; label: string; color: string }[] = [
  { value: "new", label: "Шинэ", color: T.faint },
  { value: "contacted", label: "Холбогдсон", color: T.secondaryInk },
  { value: "qualified", label: "Qualified", color: T.warnInk },
  { value: "won", label: "Won", color: T.okInk },
  { value: "lost", label: "Lost", color: T.badInk },
];
const STATUS_BY = Object.fromEntries(STATUS.map((s) => [s.value, s]));
const INTENT_COLOR: Record<string, string> = { hot: T.bad, warm: T.warn, cold: T.secondary, fan: "#ef6b75", support: T.ok, unknown: T.faint };

function timeAgo(d?: string): string {
  if (!d) return "—";
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return "одоо"; if (m < 60) return `${m}м`;
  if (m < 1440) return `${Math.floor(m / 60)}ц`; return `${Math.floor(m / 1440)}ө`;
}
function asUser(u: LeanConv["linkedUserId"]): LinkedUser | null {
  return !u || typeof u === "string" ? null : u;
}

const TABS: { key: string; label: string }[] = [
  { key: "all", label: "Бүгд" },
  { key: "hot", label: "🔥 Hot" },
  ...STATUS.map((s) => ({ key: s.value, label: s.label })),
];

export default function LeadsBoard({ initialConvs }: { initialConvs: LeanConv[] }) {
  const [convs, setConvs] = useState(initialConvs);
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  const counts = useMemo(() => ({
    total: convs.length,
    hot: convs.filter((c) => c.intentLabel === "hot").length,
    pipeline: convs.filter((c) => ["new", "contacted", "qualified"].includes(c.leadStatus || "new")).length,
    won: convs.filter((c) => c.leadStatus === "won").length,
  }), [convs]);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return convs.filter((c) => {
      if (tab === "hot" && c.intentLabel !== "hot") return false;
      if (tab !== "all" && tab !== "hot" && (c.leadStatus || "new") !== tab) return false;
      if (term) {
        const u = asUser(c.linkedUserId);
        const hay = `${c.partnerName || ""} ${c.partnerUsername || ""} ${u?.name || ""} ${c.lastMessagePreview || ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [convs, tab, q]);

  async function patch(id: string, body: { leadStatus?: LeadStatus; adminNotes?: string }) {
    setBusy(id);
    try {
      const r = await fetch(`/api/admin/meta/leads/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (r.ok) setConvs((prev) => prev.map((c) => (c._id === id ? { ...c, ...body } : c)));
    } finally { setBusy(null); }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-7">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: T.primaryInk }}>Хүмүүс</div>
        <h1 className="mt-1 text-[26px] font-semibold tracking-tight" style={{ color: T.text }}>Leads</h1>
        <p className="mt-0.5 text-[12px]" style={{ color: T.faint }}>Meta DM-ээс ирсэн lead-ийн pipeline</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Нийт lead" value={counts.total} accent="primary" />
        <Metric label="Hot" value={counts.hot} accent="ok" />
        <Metric label="Pipeline" value={counts.pipeline} accent="secondary" />
        <Metric label="Won" value={counts.won} accent="ok" />
      </div>

      <div className="mt-7 flex flex-wrap items-center gap-3">
        <div className="relative flex-1" style={{ minWidth: 200 }}>
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: T.faint }}><Ico d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" className="h-4 w-4" /></span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Lead хайх…"
            className="w-full rounded-[4px] border bg-[#0A0A0A] py-2.5 pl-9 pr-3 text-[14px] outline-none transition focus:border-[rgba(46,41,255,0.5)]" style={{ borderColor: T.border, color: T.text }} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((tb) => {
            const active = tab === tb.key;
            return (
              <button key={tb.key} onClick={() => setTab(tb.key)} className="rounded-[4px] px-3 py-1.5 text-[12px] font-semibold transition"
                style={active ? { background: T.primary, color: "#fff" } : { color: T.muted, background: "rgba(255,255,255,0.03)" }}>{tb.label}</button>
            );
          })}
        </div>
      </div>

      <div className="mt-3">
        {rows.length === 0 ? (
          <Empty title="Lead алга" hint="Энэ шүүлтэд lead олдсонгүй." />
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] border-collapse text-left">
                <thead>
                  <tr className="border-b text-[10px] uppercase tracking-[0.1em]" style={{ borderColor: T.border, color: T.faint }}>
                    <th className="px-4 py-3 font-semibold">Lead</th>
                    <th className="px-4 py-3 font-semibold">Платформ</th>
                    <th className="px-4 py-3 font-semibold">Сонирхол</th>
                    <th className="px-4 py-3 font-semibold">Сүүлийн мессеж</th>
                    <th className="px-4 py-3 font-semibold">Төлөв</th>
                    <th className="px-4 py-3 text-right font-semibold">Сүүлд</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => {
                    const u = asUser(c.linkedUserId);
                    const st = STATUS_BY[c.leadStatus || "new"];
                    const intent = c.intentLabel || "unknown";
                    const expanded = openId === c._id;
                    return (
                      <>
                        <tr key={c._id} onClick={() => { setOpenId(expanded ? null : c._id); setNoteDraft(c.adminNotes || ""); }}
                          className="cursor-pointer border-b transition hover:bg-[rgba(255,255,255,0.02)]" style={{ borderColor: T.border }}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] text-[11px] font-bold" style={{ background: "rgba(46,41,255,0.12)", color: T.primaryInk }}>
                                {(c.partnerName || c.partnerUsername || "?")[0]?.toUpperCase()}
                              </span>
                              <div className="min-w-0">
                                <div className="truncate text-[13px] font-semibold" style={{ color: T.text }}>{c.partnerName || c.partnerUsername || c.partnerId}</div>
                                {c.partnerUsername && <div className="text-[11px]" style={{ color: T.faint }}>@{c.partnerUsername}</div>}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-[12px] capitalize" style={{ color: T.muted }}>{c.platform}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold capitalize" style={{ color: INTENT_COLOR[intent] || T.faint }}>
                              <span className="h-1.5 w-1.5 rounded-full" style={{ background: INTENT_COLOR[intent] || T.faint }} />{intent}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[12px]" style={{ color: T.muted }}><div className="max-w-[260px] truncate">{c.lastMessagePreview || "—"}</div></td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1.5 rounded-[4px] px-2 py-1 text-[11px] font-semibold" style={{ color: st.color, background: `${st.color}1A` }}>
                              <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.color }} />{st.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-[11px]" style={{ fontFamily: MONO, color: T.faint }}>{timeAgo(c.lastMessageAt)}</td>
                        </tr>
                        {expanded && (
                          <tr style={{ background: "rgba(255,255,255,0.015)" }}>
                            <td colSpan={6} className="px-4 py-4">
                              <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
                                <div>
                                  <div className="mb-2 text-[10px] uppercase tracking-[0.1em]" style={{ color: T.faint }}>Төлөв солих</div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {STATUS.map((s) => {
                                      const on = (c.leadStatus || "new") === s.value;
                                      return (
                                        <button key={s.value} disabled={busy === c._id} onClick={() => patch(c._id, { leadStatus: s.value })}
                                          className="rounded-[4px] px-2.5 py-1 text-[11px] font-semibold transition disabled:opacity-40"
                                          style={on ? { background: s.color, color: "#FFFFFF" } : { border: `1px solid ${T.border}`, color: T.muted }}>{s.label}</button>
                                      );
                                    })}
                                  </div>
                                  <div className="mt-4 mb-2 text-[10px] uppercase tracking-[0.1em]" style={{ color: T.faint }}>Тэмдэглэл</div>
                                  <textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} rows={3}
                                    className="w-full resize-none rounded-[4px] border bg-[#0A0A0A] px-3 py-2 text-[13px] outline-none focus:border-[rgba(46,41,255,0.5)]" style={{ borderColor: T.border, color: T.text }} />
                                  <Btn size="sm" variant="secondary" className="mt-2" onClick={() => patch(c._id, { adminNotes: noteDraft })} loading={busy === c._id}>Тэмдэглэл хадгалах</Btn>
                                </div>
                                <div className="rounded-[4px] border p-3" style={{ borderColor: T.border }}>
                                  <div className="text-[10px] uppercase tracking-[0.1em]" style={{ color: T.faint }}>Холбоотой гишүүн</div>
                                  {u ? (
                                    <div className="mt-2 text-[12px]" style={{ color: T.muted }}>
                                      <div className="font-semibold" style={{ color: T.text }}>{u.name || u.username}</div>
                                      {u.email && <div className="mt-0.5">{u.email}</div>}
                                      <div className="mt-1" style={{ fontFamily: MONO }}>L{u.level || 1} · {u.xp || 0} XP</div>
                                      <Link href={`/admin/members?search=${encodeURIComponent(u.email || u.username || "")}`} className="mt-2 inline-block text-[11px] font-semibold" style={{ color: T.secondaryInk }}>Гишүүн удирдах →</Link>
                                    </div>
                                  ) : <div className="mt-2 text-[12px]" style={{ color: T.faint }}>Холбогдоогүй</div>}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
