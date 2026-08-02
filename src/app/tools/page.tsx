"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

interface Agent {
  _id: string;
  slug: string;
  name: string;
  description: string;
  avatar: string;
  cover: string;
  href: string;
  order: number;
}

const NEON = "#1080CA";

function CreditCTA() {
  const { data: session, status } = useSession();
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/credits")
      .then((r) => r.json())
      .then((d) => { if (typeof d.balance === "number") setBalance(d.balance); })
      .catch(() => {});
  }, [status]);

  // Guest CTA — anchor on price, not status
  if (!session) {
    return (
      <Link
        href="/credits/buy"
        className="group flex items-center justify-between gap-3 rounded-none border p-3 transition hover:shadow-[0_0_24px_rgba(16,128,202,0.25)] sm:p-4"
        style={{
          borderColor: "rgba(16,128,202,0.45)",
          background: "linear-gradient(135deg, rgba(16,128,202,0.12) 0%, #f2f5f8 70%)",
        }}
      >
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: NEON }}>КРЕДИТ АВ</div>
          <div className="mt-0.5 text-[14px] font-black text-white sm:text-[15px]">Бүртгэлгүй ч худалдан авна</div>
          <div className="mt-0.5 text-[11px] text-[#5b6573]">100₵ → ₮5,000 · Агенттай шууд ярь</div>
        </div>
        <span
          className="shrink-0 rounded-none px-4 py-2 text-[12px] font-black text-white transition group-hover:translate-x-[2px]"
          style={{ background: NEON, boxShadow: "0 0 18px rgba(16,128,202,0.4)" }}
        >
          Авах →
        </span>
      </Link>
    );
  }

  // Logged-in pill
  return (
    <div className="flex items-center justify-between gap-3 rounded-none border border-[rgba(15,23,38,0.06)] bg-[#f2f5f8] p-3 sm:p-3.5">
      <div className="flex items-center gap-2.5 min-w-0">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-none text-[14px] font-black"
          style={{ background: "rgba(16,128,202,0.12)", color: NEON }}
        >
          ₵
        </span>
        <div className="min-w-0">
          <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#6b7280]">БАЛАНС</div>
          <div className="text-[16px] font-black tabular-nums text-white">{balance ?? "…"}<span className="ml-0.5 text-[12px] text-[#6b7280]">₵</span></div>
        </div>
      </div>
      <Link
        href="/credits/buy"
        className="shrink-0 rounded-none px-3 py-1.5 text-[11px] font-black text-white transition hover:opacity-90"
        style={{ background: NEON, boxShadow: "0 0 12px rgba(16,128,202,0.3)" }}
      >
        + Кредит
      </Link>
    </div>
  );
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    fetch("/api/agents")
      .then((r) => r.json())
      .then((d) => { if (!cancel && Array.isArray(d.agents)) setAgents(d.agents); })
      .catch(() => {})
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, []);

  return (
    <div className="mx-auto max-w-[900px] pb-12">
      {/* Header */}
      <div className="mb-4">
        <span className="rounded-full bg-[rgba(16,128,202,0.12)] px-2 py-0.5 text-[9px] font-black tracking-[0.18em]" style={{ color: NEON }}>
          ANTAQOR · AI AGENTS
        </span>
        <h1 className="mt-2 text-[26px] font-black leading-tight text-[#0e1726] sm:text-[32px]">AI Агентууд</h1>
        <p className="mt-1 text-[12px] text-[#6b7280]">Чиний аяллын companion-ууд</p>
      </div>

      {/* Credit CTA — top-of-fold conversion strip */}
      <div className="mb-6">
        <CreditCTA />
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="aspect-[4/3] animate-pulse rounded-none bg-[#eef2f6]" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {agents.map((a) => (
            <AgentCard key={a._id} agent={a} />
          ))}
        </div>
      )}
    </div>
  );
}

function AgentCard({ agent }: { agent: Agent }) {
  const initial = agent.name.charAt(0).toUpperCase();
  return (
    <Link
      href={agent.href || "#"}
      className="group flex flex-col overflow-hidden rounded-none border border-[rgba(15,23,38,0.08)] bg-[#f2f5f8] transition hover:border-[rgba(16,128,202,0.4)] hover:shadow-[0_0_18px_rgba(16,128,202,0.15)]"
    >
      {/* Cover */}
      <div
        className="relative aspect-[16/9] overflow-hidden"
        style={agent.cover ? undefined : { background: "linear-gradient(135deg, rgba(16,128,202,0.18) 0%, #0b0b0f 80%)" }}
      >
        {agent.cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={agent.cover}
            alt=""
            className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#f2f5f8] via-[#f2f5f8]/30 to-transparent" />
      </div>

      {/* Avatar + name */}
      <div className="-mt-8 px-4 pb-4">
        <div className="flex items-end gap-3">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-none bg-[#ffffff] ring-2 ring-[#f2f5f8]">
            {agent.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={agent.avatar} alt={agent.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[24px] font-black" style={{ color: NEON }}>
                {initial}
              </div>
            )}
          </div>
          <h3 className="pb-1 text-[16px] font-black text-[#0e1726] transition group-hover:text-[#1080CA] sm:text-[18px]">
            {agent.name}
          </h3>
        </div>
      </div>
    </Link>
  );
}
