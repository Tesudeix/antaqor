import { notFound } from "next/navigation";
import Link from "next/link";
import { findAgent, EMPIRE_AGENTS, TIER_META } from "@/lib/empireAgents";
import AgentChat from "@/components/AgentChat";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = findAgent(slug);
  if (!a) return { title: "Agent not found · Antaqor" };
  return {
    title: `${a.name} · Antaqor Agent`,
    description: a.desc,
  };
}

export function generateStaticParams() {
  return EMPIRE_AGENTS.map((a) => ({ slug: a.slug }));
}

export default async function AgentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const agent = findAgent(slug);
  if (!agent) notFound();

  const meta = TIER_META[agent.tier];
  // Sister agents from same tier (excluding self), up to 3 — for the "talk to others" rail
  const siblings = EMPIRE_AGENTS.filter((a) => a.tier === agent.tier && a.slug !== agent.slug).slice(0, 3);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#F2F2F0]">
      {/* ambient bg */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.06]"
        style={{
          backgroundImage: "radial-gradient(circle, #1080CA 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: `radial-gradient(ellipse at 50% 0%, ${agent.color}22 0%, transparent 50%)`,
        }}
      />

      <div className="relative z-10 mx-auto max-w-[860px] px-4 pb-32 pt-6 sm:px-6 sm:pt-10">
        {/* Top bar */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/agents"
            className="inline-flex items-center gap-1.5 rounded-none border border-[rgba(244,239,230,0.15)] px-2.5 py-1.5 font-mono text-[10px] font-bold tracking-[0.18em] text-[#F4EFE6]/70 transition hover:border-[#1080CA]/50 hover:text-[#1080CA]"
          >
            ← EMPIRE
          </Link>
          <span
            className="rounded-none border-l-2 px-2 py-0.5 font-mono text-[9px] font-black uppercase tracking-[0.25em]"
            style={{ borderLeftColor: meta.color, color: meta.color }}
          >
            {meta.label}
          </span>
        </div>

        {/* Agent header */}
        <div
          className="relative overflow-hidden rounded-none border p-5 sm:p-7"
          style={{
            background: `linear-gradient(135deg, ${agent.color}1F 0%, #14141C 60%)`,
            borderColor: `${agent.color}55`,
          }}
        >
          <span
            className="pointer-events-none absolute left-5 right-5 top-0 h-[1px]"
            style={{ background: `linear-gradient(90deg, transparent, ${agent.color}, transparent)` }}
          />
          <div className="flex items-start gap-4 sm:gap-5">
            <div
              className="grid h-16 w-16 shrink-0 place-items-center rounded-none font-mono text-[28px] font-black sm:h-20 sm:w-20 sm:text-[34px]"
              style={{
                background: `linear-gradient(135deg, ${agent.color}40, ${agent.color}10)`,
                color: agent.color,
                border: `1px solid ${agent.color}66`,
                boxShadow: `0 0 30px ${agent.color}30 inset`,
              }}
            >
              {agent.name.slice(0, 1)}
            </div>
            <div className="min-w-0 flex-1">
              <div
                className="mb-2 inline-flex items-center gap-1.5 rounded-none border px-2 py-0.5 font-mono text-[9px] font-black uppercase tracking-[0.2em]"
                style={{
                  borderColor: `${agent.color}55`,
                  background: `${agent.color}1A`,
                  color: agent.color,
                }}
              >
                <span className="inline-block h-[5px] w-[5px] animate-pulse rounded-full" style={{ background: agent.color }} />
                {agent.role}
              </div>
              <h1 className="text-[26px] font-black tracking-tight text-[#F4EFE6] sm:text-[34px]">{agent.name}</h1>
              <p className="font-mono text-[11px] text-[#F4EFE6]/45">{agent.handle}</p>
              <p className="mt-2 max-w-[480px] text-[12px] leading-relaxed text-[#F4EFE6]/75 sm:text-[13px]">{agent.desc}</p>
              <p
                className="mt-3 font-mono text-[10px] italic tracking-wide sm:text-[11px]"
                style={{ color: `${agent.color}` }}
              >
                &ldquo; {agent.catchphrase} &rdquo;
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            {agent.tools.map((t, i) => (
              <span
                key={i}
                className="grid h-7 w-7 place-items-center rounded-none border font-mono text-[12px]"
                style={{
                  borderColor: `${agent.color}33`,
                  background: `${agent.color}10`,
                  color: agent.color,
                }}
              >
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Chat */}
        <AgentChat
          slug={agent.slug}
          name={agent.name}
          color={agent.color}
          handle={agent.handle}
        />

        {/* Sister rail */}
        {siblings.length > 0 && (
          <div className="mt-10">
            <div className="mb-3 font-mono text-[9px] font-black uppercase tracking-[0.25em] text-[#F4EFE6]/50">
              SAME TIER · talk to a sibling
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {siblings.map((s) => (
                <Link
                  key={s.slug}
                  href={`/agents/${s.slug}`}
                  className="group flex items-center gap-3 rounded-none border border-[rgba(244,239,230,0.1)] bg-white p-3 transition hover:border-[rgba(16,128,202,0.4)] hover:bg-[#1B1B25]"
                >
                  <div
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-none font-mono text-[14px] font-black"
                    style={{
                      background: `${s.color}1A`,
                      color: s.color,
                      border: `1px solid ${s.color}33`,
                    }}
                  >
                    {s.name.slice(0, 1)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-[12px] font-black text-[#F4EFE6]">{s.name}</div>
                    <div className="truncate font-mono text-[10px] text-[#F4EFE6]/45">{s.handle}</div>
                  </div>
                  <span className="font-mono text-[10px] tracking-[0.18em] text-[#F4EFE6]/35 transition group-hover:text-[#1080CA]">
                    →
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
