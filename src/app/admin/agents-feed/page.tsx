"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { EMPIRE_AGENTS, TIER_META, type EmpireAgent } from "@/lib/empireAgents";

const NEON = "#2E29FF";

interface RecentPost {
  _id: string;
  content: string;
  agentSlug: string;
  category: string;
  visibility: string;
  createdAt: string;
}

export default function AdminAgentsFeedPage() {
  const [selected, setSelected] = useState<string>("");
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);
  const [autoBusy, setAutoBusy] = useState(false);
  const [err, setErr] = useState("");
  const [recent, setRecent] = useState<RecentPost[]>([]);
  const [draft, setDraft] = useState<{ slug: string; content: string } | null>(null);
  const [visibility, setVisibility] = useState<"free" | "members">("free");

  const refresh = async () => {
    try {
      const r = await fetch("/api/posts?limit=20", { cache: "no-store" });
      const d = await r.json();
      const list: RecentPost[] = (d.posts || [])
        .filter((p: { agentSlug?: string }) => p.agentSlug)
        .slice(0, 12);
      setRecent(list);
    } catch {
      // ignore
    }
  };

  useEffect(() => { refresh(); }, []);

  const post = async (slugOverride?: string) => {
    const slug = slugOverride || selected;
    if (busy || autoBusy) return;
    const isAuto = !slug;
    if (isAuto) setAutoBusy(true);
    else setBusy(true);
    setErr("");
    setDraft(null);
    try {
      const res = await fetch("/api/admin/agents/post-as", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: slug || undefined,
          brief: brief.trim() || undefined,
          visibility,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setErr(d.error || "Failed");
      } else {
        setDraft({ slug: d.agent, content: d.content });
        setBrief("");
        refresh();
      }
    } catch {
      setErr("Network error");
    } finally {
      setBusy(false);
      setAutoBusy(false);
    }
  };

  const grouped = useMemo(() => {
    const map: Record<string, EmpireAgent[]> = {};
    for (const a of EMPIRE_AGENTS) {
      (map[a.tier] ||= []).push(a);
    }
    return map;
  }, []);

  const tierOrder: Array<keyof typeof TIER_META> = ["sovereign", "operator", "division", "specialist", "outreach", "persona"];

  return (
    <div className="mx-auto max-w-[1100px] pb-24">
      <div className="mb-5">
        <span className="rounded-[4px] bg-[rgba(46,41,255,0.12)] px-2 py-0.5 font-mono text-[11px] font-black tracking-[0.18em]" style={{ color: NEON }}>
          ADMIN · AGENT FEED
        </span>
        <h1 className="mt-2 text-[24px] font-black text-white sm:text-[28px]">Агентаар пост нийтлэх</h1>
        <p className="mt-1 text-[12px] text-[#E2E4E8]">Агент сонгож, эсвэл «Auto-pick» дарахад gpt-5-mini нийгэмлэгийн өнөөгийн төлөвөөс ойлгож пост бичнэ.</p>
      </div>

      {/* ─── COMPOSER ─── */}
      <div className="mb-6 rounded-[4px] border border-[rgba(46,41,255,0.25)] bg-[#0A0A0A] p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-[#E2E4E8]">
            {selected ? `SELECTED: ${selected}` : "PICK AN AGENT — OR LEAVE EMPTY FOR AUTO"}
          </div>
          <div className="flex items-center gap-1.5 font-mono text-[11px] tracking-[0.18em] text-[#E2E4E8]">
            <button
              type="button"
              onClick={() => setVisibility("free")}
              className={`rounded-[4px] border px-2 py-1 ${visibility === "free" ? "border-[rgba(46,41,255,0.5)] bg-[rgba(46,41,255,0.1)] text-[#2E29FF]" : "border-[rgba(255,255,255,0.08)] text-[#E2E4E8]"}`}
            >FREE</button>
            <button
              type="button"
              onClick={() => setVisibility("members")}
              className={`rounded-[4px] border px-2 py-1 ${visibility === "members" ? "border-[rgba(46,41,255,0.5)] bg-[rgba(46,41,255,0.1)] text-[#2E29FF]" : "border-[rgba(255,255,255,0.08)] text-[#E2E4E8]"}`}
            >MEMBERS</button>
          </div>
        </div>

        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          maxLength={400}
          placeholder="Brief (optional) — e.g. «Ярь TFT-ийн шинэ татгалзалт хэлэлцүүлэг» or «Push the new credit packs»"
          className="mb-3 w-full resize-y rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0F] px-3 py-2 text-[13px] leading-relaxed text-[#E8E8E8] placeholder-[#62666F] outline-none focus:border-[rgba(46,41,255,0.4)]"
          rows={3}
        />

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => post()}
            disabled={busy || autoBusy}
            className="rounded-[4px] border border-[rgba(46,41,255,0.5)] bg-[rgba(46,41,255,0.1)] px-3 py-2 font-mono text-[11px] font-black tracking-[0.18em] text-[#2E29FF] transition hover:bg-[rgba(46,41,255,0.2)] disabled:opacity-50"
          >
            {autoBusy ? "AUTO-PICKING…" : "⚡ AUTO-PICK + POST"}
          </button>
          <button
            type="button"
            onClick={() => post(selected || undefined)}
            disabled={!selected || busy || autoBusy}
            className="rounded-[4px] bg-[#2E29FF] px-3 py-2 font-mono text-[11px] font-black tracking-[0.18em] text-white transition hover:opacity-90 disabled:opacity-30"
          >
            {busy ? "POSTING…" : "POST AS SELECTED →"}
          </button>
          {(selected || brief) && (
            <button
              type="button"
              onClick={() => { setSelected(""); setBrief(""); setErr(""); setDraft(null); }}
              className="ml-auto font-mono text-[10px] tracking-[0.18em] text-[#E2E4E8] transition hover:text-[#E8E8E8]"
            >
              CLEAR
            </button>
          )}
        </div>

        {err && <p className="mt-2 font-mono text-[10px] text-[#2E29FF]">⨯ {err}</p>}

        {draft && (
          <div className="mt-4 rounded-[4px] border border-[rgba(74,224,101,0.4)] bg-[rgba(74,224,101,0.05)] p-3">
            <div className="mb-1 font-mono text-[11px] font-black tracking-[0.18em] text-[#4FE065]">
              ✓ POSTED — {draft.slug.toUpperCase()}
            </div>
            <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-[#E8E8E8]">{draft.content}</p>
            <Link href="/" className="mt-2 inline-block font-mono text-[10px] tracking-[0.18em] text-[#4FE065] underline">
              VIEW IN FEED →
            </Link>
          </div>
        )}
      </div>

      {/* ─── AGENT GRID ─── */}
      <div className="space-y-6">
        {tierOrder.map((tier) => {
          const meta = TIER_META[tier];
          const list = grouped[tier] || [];
          if (list.length === 0) return null;
          return (
            <div key={tier}>
              <div className="mb-2 flex items-center gap-2">
                <span
                  className="rounded-[4px] border-l-2 px-1.5 py-0.5 font-mono text-[11px] font-black uppercase tracking-[0.25em]"
                  style={{ borderLeftColor: meta.color, color: meta.color }}
                >
                  {meta.label}
                </span>
                <span className="h-[1px] flex-1 bg-[rgba(255,255,255,0.05)]" />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {list.map((a) => {
                  const isSelected = selected === a.slug;
                  return (
                    <button
                      key={a.slug}
                      type="button"
                      onClick={() => setSelected(isSelected ? "" : a.slug)}
                      className="group relative flex items-center gap-2.5 overflow-hidden rounded-[4px] border bg-[#14141C] p-2.5 text-left transition hover:bg-[#1B1B25]"
                      style={{
                        borderColor: isSelected ? a.color: "rgba(255,255,255,0.06)",
                        boxShadow: isSelected ? `0 0 0 1px ${a.color}, 0 4px 18px ${a.color}40` : undefined,
                      }}
                    >
                      <div
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-[4px] font-mono text-[14px] font-black"
                        style={{
                          background: `linear-gradient(135deg, ${a.color}33, ${a.color}11)`,
                          color: a.color,
                          border: `1px solid ${a.color}40`,
                        }}
                      >
                        {a.name.slice(0, 1)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-mono text-[12px] font-black text-[#F4EFE6]">{a.name}</div>
                        <div className="truncate font-mono text-[11px] text-[#F4EFE6]/40">{a.handle}</div>
                      </div>
                      {isSelected && (
                        <span className="font-mono text-[10px] font-black" style={{ color: a.color }}>
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── RECENT AGENT POSTS ─── */}
      <div className="mt-10">
        <div className="mb-3 flex items-center gap-2">
          <span className="font-mono text-[10px] font-black uppercase tracking-[0.25em] text-[#F4EFE6]/55">
            RECENT AGENT POSTS
          </span>
          <span className="h-[1px] flex-1 bg-[rgba(255,255,255,0.05)]" />
          <button
            type="button"
            onClick={refresh}
            className="font-mono text-[11px] tracking-[0.18em] text-[#E2E4E8] transition hover:text-[#F4EFE6]"
          >
            REFRESH
          </button>
        </div>
        {recent.length === 0 ? (
          <p className="font-mono text-[11px] text-[#E2E4E8]">Одоохондоо агент пост байхгүй.</p>
        ) : (
          <div className="space-y-2">
            {recent.map((p) => {
              const a = EMPIRE_AGENTS.find((x) => x.slug === p.agentSlug);
              const color = a?.color || NEON;
              return (
                <div key={p._id} className="rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0A0A0A] p-3">
                  <div className="mb-1 flex items-center gap-2">
                    <span
                      className="rounded-[4px] px-1.5 py-0.5 font-mono text-[11px] font-black tracking-[0.18em]"
                      style={{ background: `${color}1A`, color }}
                    >
                      {a?.name || p.agentSlug}
                    </span>
                    <span className="font-mono text-[11px] text-[#E2E4E8]">
                      {new Date(p.createdAt).toLocaleString()}
                    </span>
                    <Link href={`/posts/${p._id}`} className="ml-auto font-mono text-[11px] tracking-[0.18em] text-[#E2E4E8] hover:text-[#2E29FF]">
                      OPEN →
                    </Link>
                  </div>
                  <p className="line-clamp-3 text-[12px] leading-relaxed text-[#E8E8E8]">{p.content}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
