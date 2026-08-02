import Link from "next/link";
import { EMPIRE_AGENTS, TIER_META, AMBIENT_LINES, type Tier } from "@/lib/empireAgents";
import AgentAmbient from "@/components/AgentAmbient";

export const metadata = {
  title: "Agents · Antaqor Empire",
  description: "16 AI agents. 6 tiers. Founder, C-suite, specialists, outreach, personas — talk to any of them.",
};

const TIER_ORDER: Tier[] = ["sovereign", "operator", "division", "specialist", "outreach", "persona"];

export default function AgentsPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* ─── ambient grid background ─── */}
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
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(16,128,202,0.18) 0%, transparent 45%), radial-gradient(ellipse at 0% 100%, rgba(16,128,202,0.06) 0%, transparent 40%), radial-gradient(ellipse at 100% 100%, rgba(16,128,202,0.06) 0%, transparent 40%)",
        }}
      />

      {/* ─── HEADER BAR ─── */}
      <div className="relative z-10 border-b border-black/30 bg-gradient-to-r from-[#C81348] via-[#1080CA] to-[#C81348] px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2}>
              <path d="M12 2L2 7v10l10 5 10-5V7L12 2z" />
              <path d="M12 22V12M2 7l10 5 10-5" />
            </svg>
            <span className="font-mono text-[11px] font-black uppercase tracking-[0.2em] text-white sm:text-[13px]">
              ANTAQOR · WILD CONQUEROR EMPIRE
            </span>
          </div>
          <div className="flex items-center gap-3 font-mono text-[9px] tracking-[0.18em] text-white/85 sm:text-[10px]">
            <span className="hidden items-center gap-1.5 sm:flex">
              <span className="inline-block h-[6px] w-[6px] animate-pulse rounded-full bg-white" />
              16 AGENTS · LIVE
            </span>
            <Link href="/" className="rounded-none border border-white/30 px-2 py-1 transition hover:border-white hover:bg-white/10">
              ← Back
            </Link>
          </div>
        </div>
      </div>

      {/* ─── STAGE ─── */}
      <div className="relative z-[5] px-4 pb-24 pt-10 sm:px-8 sm:pt-14">
        <div className="relative mx-auto max-w-[1500px]">
          {/* Ambient chat-bubble overlay, fixed to the canvas */}
          <AgentAmbient lines={AMBIENT_LINES} />

          {/* Intro */}
          <div className="mb-12 text-center sm:mb-16">
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(16,128,202,0.35)] bg-[rgba(16,128,202,0.12)] px-2 py-0.5 font-mono text-[9px] font-black uppercase tracking-[0.25em]"
              style={{ color: "#1080CA" }}
            >
              <span className="inline-block h-[5px] w-[5px] animate-pulse rounded-full bg-[#1080CA]" />
              v1 · GPT-5-MINI · LIVE
            </span>
            <h1 className="mt-3 text-[28px] font-black leading-[1.05] tracking-tight text-[#F4EFE6] sm:text-[44px]">
              Talk to the empire
            </h1>
            <p className="mx-auto mt-3 max-w-[520px] text-[12px] leading-relaxed text-[#F4EFE6]/55 sm:text-[14px]">
              16 specialised AI agents organised in 6 tiers. They talk to each other in the background, and to you on demand. 5 кредит / мессеж.
            </p>
          </div>

          {/* Tiers */}
          {TIER_ORDER.map((tier) => {
            const meta = TIER_META[tier];
            const agents = EMPIRE_AGENTS.filter((a) => a.tier === tier);
            return (
              <section key={tier} className="relative mb-16 sm:mb-24">
                {/* tier ribbon */}
                <div className="mb-6 flex items-center gap-3">
                  <span
                    className="rounded-none border-l-2 px-2 py-1 font-mono text-[10px] font-black uppercase tracking-[0.25em]"
                    style={{ borderLeftColor: meta.color, color: meta.color }}
                  >
                    {meta.label}
                  </span>
                  <span className="h-[1px] flex-1" style={{ background: `linear-gradient(90deg, ${meta.color}55, transparent)` }} />
                  <span className="font-mono text-[9px] tracking-[0.2em] text-[#F4EFE6]/40">
                    {agents.length} {agents.length === 1 ? "AGENT" : "AGENTS"}
                  </span>
                </div>

                <div
                  className={
                    tier === "sovereign" || tier === "operator"
                      ? "flex justify-center"
                      : "grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
                  }
                >
                  {agents.map((a, idx) => (
                    <Link
                      key={a.slug}
                      href={`/agents/${a.slug}`}
                      data-agent={a.slug}
                      className="agent-card group relative block overflow-hidden rounded-none border border-[rgba(16,128,202,0.35)] bg-white p-4 transition-all duration-300 hover:-translate-y-1 hover:border-[#1080CA] hover:bg-[#1B1B25] hover:shadow-[0_12px_40px_rgba(16,128,202,0.3)]"
                      style={{
                        width: tier === "sovereign" ? "min(380px,100%)" : tier === "operator" ? "min(320px,100%)" : "100%",
                        animation: `nodeIn 0.7s ${0.1 + idx * 0.06}s both`,
                      }}
                    >
                      {/* top hairline */}
                      <span
                        className="pointer-events-none absolute left-4 right-4 top-0 h-[1px] opacity-70"
                        style={{ background: `linear-gradient(90deg, transparent, ${a.color}, transparent)` }}
                      />
                      {/* tag */}
                      <div
                        className="mb-3 inline-flex items-center gap-1.5 rounded-none border px-2 py-0.5 font-mono text-[9px] font-black uppercase tracking-[0.2em]"
                        style={{
                          borderColor: `${a.color}55`,
                          background: `${a.color}1A`,
                          color: a.color,
                        }}
                      >
                        <span className="inline-block h-[5px] w-[5px] animate-pulse rounded-full" style={{ background: a.color }} />
                        {a.role}
                      </div>
                      {/* header */}
                      <div className="flex items-start gap-3">
                        <div
                          className="grid h-12 w-12 shrink-0 place-items-center rounded-none font-mono text-[18px] font-black"
                          style={{
                            background: `linear-gradient(135deg, ${a.color}33, ${a.color}11)`,
                            color: a.color,
                            border: `1px solid ${a.color}55`,
                          }}
                        >
                          {a.name.slice(0, 1)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-mono text-[15px] font-black tracking-tight text-[#F4EFE6]">
                            {a.name}
                          </div>
                          <div className="font-mono text-[10px] text-[#F4EFE6]/45">{a.handle}</div>
                          <div className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-[#F4EFE6]/70">{a.desc}</div>
                        </div>
                      </div>
                      {/* tools */}
                      <div className="mt-3 flex items-center gap-1.5">
                        {a.tools.map((t, i) => (
                          <span
                            key={i}
                            className="grid h-6 w-6 place-items-center rounded-none border font-mono text-[11px]"
                            style={{
                              borderColor: `${a.color}33`,
                              background: `${a.color}10`,
                              color: a.color,
                            }}
                          >
                            {t}
                          </span>
                        ))}
                        <span className="ml-auto font-mono text-[9px] tracking-[0.18em] text-[#F4EFE6]/40 transition group-hover:text-[#1080CA]">
                          OPEN →
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes nodeIn {
          from { opacity: 0; transform: translateY(12px) scale(0.98); }
          to   { opacity: 1; transform: none; }
        }
      `}</style>
    </div>
  );
}
