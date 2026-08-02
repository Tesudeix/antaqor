"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { track } from "@/lib/analytics";

// IG-story-style strip — squared, small, playful + motion. On tap: card
// scales down, an accent-color ripple expands from the center, the avatar
// micro-rotates, and after ~220ms we navigate. Feels alive, not laggy.

interface Agent {
  _id: string;
  slug: string;
  name: string;
  description: string;
  avatar: string;
  href: string;
}

const ACCENT: Record<string, string> = {
  antaqor: "#1080CA",
  budjargal: "#6366F1",
};

const FALLBACK: Agent[] = [
  { _id: "a", slug: "antaqor",   name: "Antaqor",    description: "Антрепренёр",   avatar: "/antaqor.png",   href: "/companion" },
  { _id: "b", slug: "budjargal", name: "Буджаргал", description: "Бясалгагч",      avatar: "/budjargal.jpg", href: "/budjargal" },
];

const PLAYFUL_INVITES = [
  "ярилцмаар байна уу?",
  "юу шинэ юм бэ?",
  "сонсож байна шүү",
  "энд бай",
  "ярь даа",
  "юу хэлэх вэ?",
  "сайн уу?",
  "хэдэн минут бий юу?",
  "юу хийе?",
  "битгий ичиж бай",
  "одоо чөлөөтэй",
  "тэгэхэд та?",
];

function pickInvite(slug: string): string {
  if (typeof window === "undefined") return PLAYFUL_INVITES[0];
  const dayKey = new Date().toISOString().slice(0, 10);
  const seed = (dayKey + slug).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return PLAYFUL_INVITES[seed % PLAYFUL_INVITES.length];
}

export default function AiCompanionsDuo({ source = "home" }: { source?: string }) {
  const [agents, setAgents] = useState<Agent[]>(FALLBACK);

  useEffect(() => {
    fetch("/api/agents")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.agents) && d.agents.length >= 1) setAgents(d.agents);
      })
      .catch(() => { /* keep fallback */ });
  }, []);

  const invites = useMemo(() => {
    const m: Record<string, string> = {};
    agents.forEach((a) => { m[a.slug] = pickInvite(a.slug); });
    return m;
  }, [agents]);

  return (
    <section>
      {/* Eyebrow — keeps the cards visually dominant; section label recedes */}
      <div className="mb-2 flex items-baseline justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rotate-45 bg-[#1080CA] shadow-[0_0_6px_rgba(16,128,202,0.7)]" />
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#6b7280]">
            AI КОМПАНЬОН
          </span>
        </div>
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#94a3b8]">
          {agents.length} АГЕНТ
        </span>
      </div>
      <div className="-mx-3 overflow-x-auto scrollbar-hide sm:-mx-4">
        <div className="flex items-start gap-3 px-3 pb-1 sm:gap-4 sm:px-4">
          {agents.map((agent) => (
            <PersonaCard
              key={agent._id}
              agent={agent}
              accent={ACCENT[agent.slug] || "#1080CA"}
              invite={invites[agent.slug] || PLAYFUL_INVITES[0]}
              source={source}
            />
          ))}
          <ComingSoonCard />
        </div>
      </div>
    </section>
  );
}

function PersonaCard({
  agent,
  accent,
  invite,
  source,
}: {
  agent: Agent;
  accent: string;
  invite: string;
  source: string;
}) {
  const router = useRouter();
  const [tapping, setTapping] = useState(false);

  const handleTap = () => {
    if (tapping) return;
    setTapping(true);
    track("companion_card_click", { slug: agent.slug, source });
    // Let the ripple play for ~220ms before navigating.
    window.setTimeout(() => {
      router.push(agent.href);
    }, 220);
  };

  // ─── IG-story aesthetic, square. Gradient ring border around the avatar,
  // small caption below. Tap = ripple → navigate, same as before.
  return (
    <motion.button
      type="button"
      onClick={handleTap}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.94 }}
      transition={{ type: "spring", stiffness: 420, damping: 26 }}
      className="group flex w-[72px] shrink-0 cursor-pointer flex-col items-center gap-1 bg-transparent p-0 text-center sm:w-[84px]"
      aria-label={`Open ${agent.name}`}
    >
      {/* ── Gradient ring + avatar ── */}
      <div
        className="relative aspect-square w-full rounded-none p-[2px]"
        style={{
          // IG-story-style sweep — brand accent across the ring with a dark
          // dip in the middle so it feels like a halo, not a flat border.
          background: `conic-gradient(from 215deg, ${accent} 0deg, ${accent}aa 90deg, ${accent}44 180deg, ${accent}aa 270deg, ${accent} 360deg)`,
          boxShadow: `0 4px 14px rgba(0,0,0,0.45), 0 0 10px ${accent}55`,
        }}
      >
        <div className="relative h-full w-full overflow-hidden rounded-none bg-[#ffffff]">
          <motion.img
            src={agent.avatar}
            alt={agent.name}
            className="absolute inset-0 h-full w-full object-cover"
            animate={tapping ? { scale: 1.08 } : { scale: 1 }}
            transition={{ type: "spring", stiffness: 320, damping: 20 }}
          />

          {/* Live-agent pulse dot — bottom-right inside the ring */}
          <motion.span
            className="absolute bottom-1 right-1 flex h-2 w-2"
            animate={tapping ? { scale: [1, 1.4, 1] } : { scale: 1 }}
            transition={{ duration: 0.4 }}
          >
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#4FE065] opacity-75" />
            <span
              className="relative inline-flex h-2 w-2 rounded-full bg-[#4FE065]"
              style={{ boxShadow: "0 0 0 1.5px #ffffff" }}
            />
          </motion.span>

          {/* Tap ripple — accent burst inside the avatar */}
          <AnimatePresence>
            {tapping && (
              <motion.span
                key="ripple"
                className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ background: accent, mixBlendMode: "screen" }}
                initial={{ width: 0, height: 0, opacity: 0.55 }}
                animate={{ width: 140, height: 140, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              />
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Caption — name only at this scale, role kept tiny ── */}
      <div className="w-full px-0.5 leading-tight">
        <div className="truncate text-[11px] font-black text-[#0e1726] transition group-hover:text-white">
          {agent.name}
        </div>
        <div
          className="truncate font-mono text-[8px] font-bold uppercase tracking-[0.16em]"
          style={{ color: accent }}
        >
          {agent.description}
        </div>
      </div>
    </motion.button>
  );
}

function ComingSoonCard() {
  // Matches the IG-story square dimensions of PersonaCard so the strip reads
  // as a uniform row. Dashed ring instead of solid gradient — signals "slot".
  return (
    <div className="flex w-[72px] shrink-0 flex-col items-center gap-1 text-center sm:w-[84px]">
      <div className="aspect-square w-full rounded-none border border-dashed border-[rgba(15,23,38,0.15)] bg-[#ffffff] p-[2px]">
        <div className="flex h-full w-full items-center justify-center rounded-none bg-[#0F0F11]">
          <svg className="h-4 w-4 text-[#94a3b8]" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </div>
      </div>
      <div className="w-full px-0.5 leading-tight">
        <div className="truncate text-[11px] font-black text-[#6b7280]">
          Шинэ
        </div>
        <div className="font-mono text-[8px] font-bold uppercase tracking-[0.16em] text-[#94a3b8]">SOON</div>
      </div>
    </div>
  );
}
