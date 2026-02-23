"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

interface Stats {
  totalUsers: number;
  paidMembers: number;
  aiConquerors?: number;
  goal: number;
  progress: number;
}

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    const duration = 1200;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const animate = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        fromRef.current = to;
        startRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value]);

  return <>{display.toLocaleString()}</>;
}

export default function ConquestCounter({ inline = false }: { inline?: boolean }) {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/stats");
      const data = await res.json();
      if (res.ok) setStats(data);
    } catch {
      // silent
    }
  };

  if (!stats) return null;

  const conquerors = stats.aiConquerors ?? stats.paidMembers ?? 0;
  const pct = Math.min((conquerors / stats.goal) * 100, 100);
  const remaining = stats.goal - conquerors;

  // Compact inline version for navbar ticker
  if (inline) {
    return (
      <div className="hidden items-center gap-2 md:flex">
        <span className="text-[9px] uppercase tracking-[3px] text-[#5a5550]">Mission</span>
        <span className="font-[Bebas_Neue] text-sm tracking-[2px] text-[#cc2200]">
          <AnimatedNumber value={conquerors} />
          <span className="text-[#5a5550]">/{stats.goal.toLocaleString()}</span>
        </span>
        <span className="text-[9px] uppercase tracking-[2px] text-[#5a5550]">AI Conquerors</span>
        {/* Mini bar */}
        <div className="h-[2px] w-16 overflow-hidden bg-[#1c1c1c]">
          <div
            className="h-full bg-[#cc2200] transition-all duration-1000"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  }

  // Full hero version
  return (
    <div className="mt-10 w-full max-w-xl">
      {/* Label row */}
      <div className="mb-3 flex items-end justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[4px] text-[#5a5550]">
            Mission · Progress
          </div>
          <div className="mt-1 font-[Bebas_Neue] text-[clamp(14px,2vw,18px)] tracking-[3px] text-[#ede8df]">
            Creating{" "}
            <span className="text-[#cc2200]">10,000</span> AI Conquerors
          </div>
        </div>
        <div className="text-right">
          <div className="font-[Bebas_Neue] text-[clamp(32px,5vw,52px)] leading-none tracking-[-1px] text-[#cc2200]">
            <AnimatedNumber value={conquerors} />
          </div>
          <div className="text-[9px] uppercase tracking-[3px] text-[#5a5550]">
            joined
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative h-[3px] w-full overflow-hidden bg-[#1c1c1c]">
        <div
          className="h-full bg-[#cc2200] transition-all duration-1000 ease-out"
          style={{ width: `${pct}%` }}
        />
        {/* Glow pulse */}
        <div
          className="absolute top-0 h-full w-4 bg-gradient-to-r from-transparent via-[rgba(204,34,0,0.8)] to-transparent blur-sm transition-all duration-1000"
          style={{ left: `calc(${pct}% - 8px)` }}
        />
      </div>

      {/* Footer stats */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex gap-6">
          <div>
            <span className="font-[Bebas_Neue] text-lg tracking-[2px] text-[#ede8df]">
              <AnimatedNumber value={stats.paidMembers} />
            </span>
            <span className="ml-1 text-[9px] uppercase tracking-[2px] text-[#5a5550]">
              Clan Members
            </span>
          </div>
          <div>
            <span className="font-[Bebas_Neue] text-lg tracking-[2px] text-[rgba(240,236,227,0.3)]">
              <AnimatedNumber value={remaining > 0 ? remaining : 0} />
            </span>
            <span className="ml-1 text-[9px] uppercase tracking-[2px] text-[#5a5550]">
              Remaining
            </span>
          </div>
        </div>
        <div className="text-right">
          <span className="font-[Bebas_Neue] text-lg tracking-[2px] text-[rgba(240,236,227,0.15)]">
            {pct.toFixed(2)}%
          </span>
        </div>
      </div>

      {/* CTA nudge */}
      {remaining > 0 && (
        <div className="mt-4 flex items-center gap-2">
          <div className="h-[1px] flex-1 bg-[rgba(240,236,227,0.05)]" />
          <Link
            href="/auth/signup"
            className="text-[9px] uppercase tracking-[3px] text-[#cc2200] transition hover:text-[#e8440f]"
          >
            Be one of them →
          </Link>
        </div>
      )}
    </div>
  );
}
