"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface Cap { key: string; label: string; ok: boolean; missing: string[] }
interface Health {
  key: string; label: string; pageId: string; igBusinessId: string;
  source: "registry" | "env";
  hasToken: boolean; valid: boolean; error: string;
  expiresAt: number | null; dataAccessExpiresAt: number | null; daysLeft: number | null;
  scopes: string[]; capabilities: Cap[]; webhookOk: boolean;
  triggers: number; conversations: number; broadcastReach: number;
}

const MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace";

function fmt(ts: number | null): string {
  if (ts === null) return "—";
  if (ts === 0) return "хугацаагүй";
  return new Date(ts * 1000).toISOString().slice(0, 10);
}

// Colour is driven by what actually stops working, not by a generic severity:
// a dead token is red, a closing data-access window is amber long before it
// bites, everything else is green.
function tone(h: Health): { bg: string; bd: string; fg: string; label: string } {
  if (!h.hasToken) return { bg: "rgba(120,120,130,0.10)", bd: "rgba(120,120,130,0.35)", fg: "#E2E4E8", label: "ХОЛБООГҮЙ" };
  if (!h.valid) return { bg: "rgba(46,41,255,0.10)", bd: "rgba(46,41,255,0.45)", fg: "#2E29FF", label: "ҮХСЭН" };
  if (h.daysLeft !== null && h.daysLeft <= 7) return { bg: "rgba(251,191,36,0.10)", bd: "rgba(251,191,36,0.45)", fg: "#FBBF24", label: h.daysLeft + " ХОНОГ" };
  return { bg: "rgba(74,222,128,0.08)", bd: "rgba(74,222,128,0.35)", fg: "#4ADE80", label: "АЖИЛЛАЖ БАЙНА" };
}

export default function MetaHealthPage() {
  const [rows, setRows] = useState<Health[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkedAt, setCheckedAt] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/meta/health", { cache: "no-store" });
      const d = await r.json();
      if (Array.isArray(d.accounts)) setRows(d.accounts);
      if (d.checkedAt) setCheckedAt(d.checkedAt);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const broken = rows.filter((r) => r.hasToken && (!r.valid || !r.webhookOk)).length;
  const expiring = rows.filter((r) => r.valid && r.daysLeft !== null && r.daysLeft <= 7).length;

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#2E29FF]">Health</div>
          <h1 className="mt-0.5 text-[22px] font-bold text-[#E8E8E8]">Холболтын эрүүл мэнд</h1>
          <p className="mt-1 text-[12px] text-[#E2E4E8]">
            Хуудас бүрийн token, эрх, webhook. <span className="text-[#FBBF24]">expires_at: хугацаагүй</span> гэдэг нь мөнхийн гэсэн үг БИШ — жинхэнэ хязгаар нь өгөгдлийн 90 хоногийн цонх.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="shrink-0 rounded-[4px] bg-[#2E29FF] px-4 py-2 text-[11px] font-bold text-white hover:bg-[#1bb8d4] disabled:opacity-50"
        >
          {loading ? "Шалгаж байна…" : "Дахин шалгах"}
        </button>
      </div>

      {(broken > 0 || expiring > 0) && (
        <div className="mb-5 rounded-[4px] border border-[rgba(46,41,255,0.4)] bg-[rgba(46,41,255,0.08)] px-4 py-3 text-[12px] text-[#4C47FF]">
          {broken > 0 && <div>⚠ {broken} хуудас ажиллахгүй байна — token үхсэн эсвэл webhook холбогдоогүй.</div>}
          {expiring > 0 && <div>⏳ {expiring} хуудасны өгөгдлийн хандалт 7 хоногийн дотор хаагдана.</div>}
        </div>
      )}

      {loading && rows.length === 0 && <div className="text-[12px] text-[#E2E4E8]">Graph API-аас шалгаж байна…</div>}

      <div className="space-y-3">
        {rows.map((h) => {
          const t = tone(h);
          return (
            <div key={h.key} className="rounded-[4px] border p-4" style={{ background: t.bg, borderColor: t.bd }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-[14px] font-bold text-[#E8E8E8]">{h.label}</span>
                  <span className="ml-2 text-[10px] text-[#E2E4E8]" style={{ fontFamily: MONO }}>{h.pageId || "—"}</span>
                  <span className="ml-2 rounded-[3px] bg-[rgba(255,255,255,0.06)] px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-[#E2E4E8]">
                    {h.source === "registry" ? "DB" : "env"}
                  </span>
                </div>
                <span className="rounded-[3px] px-2 py-0.5 text-[10px] font-bold tracking-wider" style={{ color: t.fg, background: "rgba(0,0,0,0.25)" }}>
                  {t.label}
                </span>
              </div>

              {h.error && <div className="mt-2 text-[11px] text-[#4C47FF]" style={{ fontFamily: MONO }}>{h.error}</div>}

              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] sm:grid-cols-4" style={{ fontFamily: MONO }}>
                <div><span className="text-[#E2E4E8]">token дуусах</span><br />{fmt(h.expiresAt)}</div>
                <div><span className="text-[#E2E4E8]">өгөгдлийн хандалт</span><br />
                  {fmt(h.dataAccessExpiresAt)}{h.daysLeft !== null && <span style={{ color: t.fg }}> ({h.daysLeft}х)</span>}
                </div>
                <div><span className="text-[#E2E4E8]">webhook</span><br />{h.webhookOk ? "✅ холбогдсон" : "❌ алга"}</div>
                <div><span className="text-[#E2E4E8]">Instagram</span><br />{h.igBusinessId ? "✅ холбоотой" : "— холбоогүй"}</div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {h.capabilities.map((c) => (
                  <span
                    key={c.key}
                    title={c.missing.length ? "Дутуу: " + c.missing.join(", ") : "Ажиллаж байна"}
                    className="rounded-[3px] px-2 py-1 text-[10px]"
                    style={{
                      background: c.ok ? "rgba(74,222,128,0.12)" : "rgba(46,41,255,0.10)",
                      color: c.ok ? "#4ADE80" : "#1F1AD9",
                    }}
                  >
                    {c.ok ? "✓" : "✕"} {c.label}
                  </span>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-[#E2E4E8]" style={{ fontFamily: MONO }}>
                <span>trigger: <span className="text-[#E8E8E8]">{h.triggers}</span></span>
                <span>яриа: <span className="text-[#E8E8E8]">{h.conversations}</span></span>
                <span title="24 цагийн цонхонд байгаа, broadcast хүрэх боломжтой хүн">
                  broadcast хүрэх: <span className="text-[#E8E8E8]">{h.broadcastReach}</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {checkedAt && (
        <div className="mt-5 text-[10px] text-[#E2E4E8]" style={{ fontFamily: MONO }}>
          шалгасан: {new Date(checkedAt).toLocaleString("mn-MN")}
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2 text-[11px]">
        <Link href="/admin/pages" className="rounded-[4px] bg-[rgba(255,255,255,0.06)] px-3 py-2 text-[#E8E8E8] hover:bg-[rgba(255,255,255,0.1)]">Хуудас холбох →</Link>
        <Link href="/admin/triggers" className="rounded-[4px] bg-[rgba(255,255,255,0.06)] px-3 py-2 text-[#E8E8E8] hover:bg-[rgba(255,255,255,0.1)]">Триггер →</Link>
        <Link href="/admin/broadcast" className="rounded-[4px] bg-[rgba(255,255,255,0.06)] px-3 py-2 text-[#E8E8E8] hover:bg-[rgba(255,255,255,0.1)]">Broadcast →</Link>
      </div>
    </div>
  );
}
