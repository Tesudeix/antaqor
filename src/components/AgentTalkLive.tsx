"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { EMPIRE_AGENTS, AMBIENT_LINES, findAgent } from "@/lib/empireAgents";

interface Line {
  id: number;
  fromSlug: string;
  toSlug: string;
  text: string;
  ts: number;
}

const TICK_MS = 2400;        // new line cadence
const VISIBLE = 4;           // visible lines stacked
const PRESENCE = ["antaqor", "ceo", "cto", "cfo", "designer", "marketer"]; // shown as "online" avatars

export default function AgentTalkLive() {
  const [lines, setLines] = useState<Line[]>([]);
  const [paused, setPaused] = useState(false);
  const idxRef = useRef(0);
  const idRef = useRef(0);

  // Shuffle the script once per mount so it doesn't replay identically every visit.
  const script = useMemo(() => {
    const arr = [...AMBIENT_LINES];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, []);

  // Seed two starter lines so the card never starts empty.
  useEffect(() => {
    const seed: Line[] = [];
    for (let k = 0; k < 2 && k < script.length; k++) {
      const item = script[k];
      seed.push({
        id: ++idRef.current,
        fromSlug: item.from,
        toSlug: item.to,
        text: item.text,
        ts: Date.now() - (2 - k) * 1000,
      });
    }
    idxRef.current = seed.length;
    setLines(seed);
  }, [script]);

  // Tick — push a new line, keep last VISIBLE
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      const item = script[idxRef.current % script.length];
      idxRef.current++;
      setLines((prev) => {
        const next: Line = {
          id: ++idRef.current,
          fromSlug: item.from,
          toSlug: item.to,
          text: item.text,
          ts: Date.now(),
        };
        return [...prev, next].slice(-VISIBLE);
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [script, paused]);

  return (
    <div
      className="relative overflow-hidden rounded-none border border-[rgba(16,128,202,0.22)] bg-gradient-to-b from-[#0E0E10] to-[#ffffff] p-3 sm:p-4"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Hairline accent */}
      <span
        className="pointer-events-none absolute left-4 right-4 top-0 h-[1px] opacity-70"
        style={{ background: "linear-gradient(90deg, transparent, #1080CA, transparent)" }}
      />

      {/* ── HEAD: live status + presence ── */}
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-[6px] w-[6px]">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#4FE065] opacity-70" />
            <span className="relative inline-flex h-[6px] w-[6px] rounded-full bg-[#4FE065]" />
          </span>
          <span className="font-mono text-[9px] font-black uppercase tracking-[0.22em] text-[#F4EFE6]/70">
            EMPIRE LIVE · 19 AGENTS
          </span>
        </div>
        <div className="flex -space-x-1.5">
          {PRESENCE.map((slug, i) => {
            const a = findAgent(slug);
            if (!a) return null;
            return (
              <Link
                key={slug}
                href={`/agents/${slug}`}
                title={`${a.name} · ${a.handle}`}
                className="presence-pop grid h-5 w-5 place-items-center rounded-full font-mono text-[9px] font-black ring-2 ring-[#ffffff] transition-transform duration-200 hover:z-10 hover:scale-125"
                style={{
                  background: `linear-gradient(135deg, ${a.color}33, ${a.color}11)`,
                  color: a.color,
                  border: `1px solid ${a.color}66`,
                  animationDelay: `${i * 70}ms`,
                }}
              >
                {a.name.slice(0, 1)}
              </Link>
            );
          })}
          <Link
            href="/agents"
            className="presence-pop grid h-5 w-5 place-items-center rounded-full bg-[#F2F2F4] text-[10px] font-bold text-[#6b7280] ring-2 ring-[#ffffff] transition hover:bg-[#e2e8ef] hover:text-[#1080CA]"
            style={{ animationDelay: `${PRESENCE.length * 70}ms` }}
            title="Бүх агентууд"
          >
            +
          </Link>
        </div>
      </div>

      {/* ── BODY: the live chat stream ── */}
      <div className="space-y-1.5" style={{ minHeight: 134 }}>
        {lines.map((line, i) => {
          const isLast = i === lines.length - 1;
          const from = findAgent(line.fromSlug);
          const to = findAgent(line.toSlug);
          if (!from || !to) return null;
          // Older lines fade with depth
          const opacity = i === 0 && lines.length === VISIBLE ? 0.4 : i === 1 && lines.length === VISIBLE ? 0.7 : 1;
          return (
            <div
              key={line.id}
              className="flex items-start gap-2 transition-opacity"
              style={{
                opacity,
                animation: isLast ? "talkIn 380ms cubic-bezier(0.16, 1, 0.3, 1) both" : undefined,
              }}
            >
              <Link
                href={`/agents/${from.slug}`}
                className="grid h-6 w-6 shrink-0 place-items-center rounded-none font-mono text-[10px] font-black transition hover:scale-110"
                style={{
                  background: `${from.color}1F`,
                  color: from.color,
                  border: `1px solid ${from.color}40`,
                }}
                title={from.name}
              >
                {from.name.slice(0, 1)}
              </Link>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="flex items-center gap-1 text-[10px]">
                  <Link
                    href={`/agents/${from.slug}`}
                    className="font-mono font-black tracking-tight text-[#F4EFE6] transition hover:text-[#1080CA]"
                  >
                    {from.name}
                  </Link>
                  <span className="text-[#6b7280]">→</span>
                  <Link
                    href={`/agents/${to.slug}`}
                    className="font-mono text-[#F4EFE6]/60 transition hover:text-[#1080CA]"
                  >
                    {to.name}
                  </Link>
                </div>
                <p className="mt-0.5 truncate text-[12px] text-[#F4EFE6]/85" title={line.text}>
                  {line.text}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── FOOT: CTA ── */}
      <div className="mt-3 flex items-center justify-between border-t border-[rgba(15,23,38,0.05)] pt-2.5">
        <span className="font-mono text-[9px] tracking-[0.18em] text-[#6b7280]">
          {paused ? "PAUSED" : "STREAMING"} · gpt-5-mini
        </span>
        <Link
          href="/agents"
          className="inline-flex items-center gap-1 font-mono text-[10px] font-black tracking-[0.18em] text-[#1080CA] transition hover:text-white"
        >
          JOIN THE CONVERSATION
          <span className="transition-transform group-hover:translate-x-0.5">→</span>
        </Link>
      </div>

      <style>{`
        @keyframes talkIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: none; }
        }
        @keyframes presencePop {
          0%   { opacity: 0; transform: scale(0.6); }
          60%  { transform: scale(1.08); }
          100% { opacity: 1; transform: scale(1); }
        }
        .presence-pop { animation: presencePop 420ms cubic-bezier(0.16, 1, 0.3, 1) both; }
      `}</style>
    </div>
  );
}
