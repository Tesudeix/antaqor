"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";

// ─────────────────────────────────────────────────────────────────────────
// /influencers — Antaqor Influencer Network. A dark, HUD-styled marketplace
// pairing Mongolian creators with brands. Roster is admin-managed; creators
// apply and brands fire collab briefs straight into the admin panel.
// ─────────────────────────────────────────────────────────────────────────

type Network = "instagram" | "tiktok" | "youtube" | "facebook" | "threads" | "x";
type Tier = "nano" | "micro" | "macro" | "mega" | "celebrity";

interface Platform { network: Network; url: string; followers: number }
interface Influencer {
  _id: string;
  name: string;
  handle: string;
  slug: string;
  avatar: string;
  cover: string;
  bio: string;
  location: string;
  niche: string;
  tier: Tier;
  platforms: Platform[];
  totalFollowers: number;
  engagementRate: number;
  tags: string[];
  rateFrom: number;
  verified: boolean;
  featured: boolean;
  stats?: { campaigns?: number; rating?: number };
}

const TIERS: Record<Tier, { label: string; color: string }> = {
  nano: { label: "НАНО", color: "#B4B4BA" },
  micro: { label: "МИКРО", color: "#1080CA" },
  macro: { label: "МАКРО", color: "#4FA8E8" },
  mega: { label: "МЕГА", color: "#FF6E86" },
  celebrity: { label: "ОД", color: "#F5C542" },
};

const NETWORKS: Record<Network, { label: string; path: string }> = {
  instagram: { label: "Instagram", path: "M12 2.2c3.2 0 3.6 0 4.9.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.87s0 3.6-.07 4.87c-.05 1.17-.25 1.8-.41 2.23a3.7 3.7 0 01-.9 1.38 3.7 3.7 0 01-1.38.9c-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.87.07s-3.6 0-4.87-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 01-1.38-.9 3.7 3.7 0 01-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.21 15.6 2.2 15.22 2.2 12s0-3.6.07-4.87c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.4 2.21 8.8 2.2 12 2.2zm0 3.06A6.74 6.74 0 1018.74 12 6.74 6.74 0 0012 5.26zm0 11.12A4.38 4.38 0 1116.38 12 4.38 4.38 0 0112 16.38zm6.96-11.4a1.58 1.58 0 11-1.58-1.57 1.58 1.58 0 011.58 1.57z" },
  tiktok: { label: "TikTok", path: "M16.6 5.82a4.28 4.28 0 01-1.05-2.82h-3.02v12.03a2.42 2.42 0 11-1.7-2.31V9.6a5.44 5.44 0 103.72 5.16V9.01a7.3 7.3 0 004.25 1.36V7.35a4.28 4.28 0 01-2.2-1.53z" },
  youtube: { label: "YouTube", path: "M23 12s0-3.2-.41-4.73a2.48 2.48 0 00-1.75-1.75C19.31 5.11 12 5.11 12 5.11s-7.31 0-8.84.41a2.48 2.48 0 00-1.75 1.75C1 8.8 1 12 1 12s0 3.2.41 4.73a2.48 2.48 0 001.75 1.75c1.53.41 8.84.41 8.84.41s7.31 0 8.84-.41a2.48 2.48 0 001.75-1.75C23 15.2 23 12 23 12zM9.75 15.02V8.98L15.5 12z" },
  facebook: { label: "Facebook", path: "M22 12a10 10 0 10-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.78-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0022 12z" },
  threads: { label: "Threads", path: "M12.19 21.5c-3.02-.02-5.34-1.02-6.9-2.97C3.9 16.79 3.2 14.4 3.17 11.5v-.02c.03-2.9.73-5.29 2.12-7.03C6.85 2.52 9.17 1.52 12.19 1.5h.02c2.32.02 4.26.62 5.75 1.79 1.4 1.1 2.38 2.66 2.92 4.65l-1.98.55c-.9-3.24-3.2-4.9-6.7-4.93-2.32.02-4.06.75-5.18 2.17-1.05 1.33-1.6 3.26-1.63 5.75.03 2.49.58 4.42 1.63 5.75 1.12 1.42 2.86 2.15 5.18 2.17 2.09-.02 3.48-.51 4.63-1.63.83-.81 1.29-1.86 1.4-3.13-.66-.4-1.5-.68-2.47-.83-.16 1.03-.5 1.78-1.02 2.24-.53.47-1.24.7-2.14.7-.98 0-1.79-.29-2.36-.85-.55-.54-.85-1.28-.85-2.09 0-1.72 1.4-2.93 3.68-2.93.5 0 .97.03 1.4.09v-.28c0-1.5-.79-2.28-2.24-2.28-1.02 0-1.77.42-2.15 1.2l-1.8-.9c.7-1.4 2.07-2.19 3.95-2.19 2.66 0 4.24 1.6 4.24 4.28v.6c1.4.36 2.5.98 3.24 1.85l.02.02c.4-1.02.6-2.2.62-3.53z" },
  x: { label: "X", path: "M17.53 3H21l-7.19 8.21L22.5 21h-6.63l-5.2-6.79L4.7 21H1.23l7.7-8.8L1.5 3h6.8l4.7 6.22zm-1.16 16h1.83L7.7 4.9H5.74z" },
};

const NICHE_PRESETS = ["Гоо сайхан", "Фэшн", "Технологи", "Хоол", "Аялал", "Фитнес", "Гэйминг", "Бизнес", "Хошин шог", "Хөгжим"];

function fmt(n: number): string {
  if (!n) return "0";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1) + "K";
  return String(n);
}
function accentFor(seed: string): string {
  const p = ["#1080CA", "#4FA8E8", "#FF6E86", "#0C669E"];
  return p[(seed.charCodeAt(0) || 0) % p.length];
}

export default function InfluencersPage() {
  const [list, setList] = useState<Influencer[]>([]);
  const [niches, setNiches] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [niche, setNiche] = useState("all");
  const [tier, setTier] = useState("all");
  const [platform, setPlatform] = useState<string>("all");

  const [applyOpen, setApplyOpen] = useState(false);
  const [collabFor, setCollabFor] = useState<Influencer | "open" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/influencers", { cache: "no-store" });
      const data = await res.json();
      if (Array.isArray(data.influencers)) setList(data.influencers);
      if (Array.isArray(data.niches)) setNiches(data.niches);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return list.filter((i) => {
      if (niche !== "all" && i.niche !== niche) return false;
      if (tier !== "all" && i.tier !== tier) return false;
      if (platform !== "all" && !i.platforms?.some((p) => p.network === platform)) return false;
      if (needle) {
        const hay = `${i.name} ${i.handle} ${i.niche} ${(i.tags || []).join(" ")}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [list, q, niche, tier, platform]);

  const totalReach = useMemo(() => list.reduce((s, i) => s + (i.totalFollowers || 0), 0), [list]);
  const nicheOptions = useMemo(() => {
    const set = new Set<string>([...niches, ...NICHE_PRESETS]);
    return Array.from(set).filter(Boolean);
  }, [niches]);

  return (
    <div className="light-page mx-auto max-w-6xl">
      {/* ── HERO ──────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-[2px] border border-[var(--color-border)] bg-[#0d0d10]">
        {/* neon grid + glow */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.5]"
          style={{ background: "radial-gradient(60% 80% at 85% 0%, rgba(16,128,202,0.22), transparent 60%), radial-gradient(50% 60% at 0% 100%, rgba(255,61,92,0.12), transparent 60%)" }} />
        <div className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)", backgroundSize: "44px 44px" }} />

        <div className="relative px-6 py-12 sm:px-10 sm:py-16">
          <div className="chrome flex items-center gap-2 text-[10px] text-[var(--color-accent)]">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--color-accent)]" />
            ANTAQOR // INFLUENCER NETWORK
          </div>

          <h1 className="headline mt-4 text-[42px] leading-[0.95] sm:text-[68px]">
            ИНФЛЮЕНСЕР<br />
            <span className="accent">СҮЛЖЭЭ</span><span className="dot">.</span>
          </h1>

          <p className="mt-5 max-w-xl text-[14px] leading-relaxed text-[var(--color-muted)] sm:text-[15px]">
            Монголын хамгийн нөлөө бүхий креаторуудыг брэндүүдтэй холбоно. Жинхэнэ тоо баримт,
            ил тод үнэ, хэмжигдэх үр дүн. Кампанит ажлаа өнөөдөр эхлүүл.
          </p>

          {/* stat strip */}
          <div className="mt-8 grid max-w-lg grid-cols-3 gap-px overflow-hidden rounded-[2px] border border-[var(--color-border)] bg-[var(--color-border)]">
            {[
              { k: fmt(list.length).replace("K", "K+"), v: "Креатор" },
              { k: fmt(totalReach), v: "Нийт хүрэлт" },
              { k: String(nicheOptions.length), v: "Чиглэл" },
            ].map((s) => (
              <div key={s.v} className="bg-[#0d0d10] px-4 py-4">
                <div className="font-display text-[22px] font-extrabold text-[var(--color-ink)] sm:text-[26px]">{s.k}</div>
                <div className="chrome mt-1 text-[9px] text-[var(--color-dim)]">{s.v}</div>
              </div>
            ))}
          </div>

          {/* CTAs */}
          <div className="mt-8 flex flex-wrap gap-3">
            <button onClick={() => setCollabFor("open")}
              className="group inline-flex items-center gap-2 rounded-[2px] bg-[var(--color-accent)] px-5 py-3 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-white transition hover:shadow-[0_0_28px_rgba(16,128,202,0.5)]">
              Брэнд · Кампанит ажил
              <span className="transition group-hover:translate-x-0.5">→</span>
            </button>
            <button onClick={() => setApplyOpen(true)}
              className="inline-flex items-center gap-2 rounded-[2px] border border-[var(--color-border)] bg-[#141418] px-5 py-3 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-ink)] transition hover:border-[rgba(16,128,202,0.5)] hover:text-[var(--color-accent)]">
              Креатор болох
            </button>
          </div>
        </div>
      </section>

      {/* ── FILTER BAR ────────────────────────────────────────────────── */}
      <div className="sticky top-2 z-20 mt-6">
        <div className="rounded-[2px] border border-[var(--color-border)] bg-[rgba(13,13,16,0.85)] p-3 backdrop-blur-xl">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <svg className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-dim)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
              </svg>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Креатор, чиглэл, tag хайх…"
                className="w-full rounded-[2px] border border-[var(--color-border)] bg-[#0a0a0c] py-2 pl-9 pr-3 text-[13px] text-[var(--color-ink)] placeholder-[var(--color-dim)] outline-none focus:border-[rgba(16,128,202,0.5)]" />
            </div>
            {/* platform quick filter */}
            <div className="flex items-center gap-1">
              <Chip active={platform === "all"} onClick={() => setPlatform("all")}>Бүгд</Chip>
              {(Object.keys(NETWORKS) as Network[]).map((n) => (
                <button key={n} onClick={() => setPlatform(platform === n ? "all" : n)}
                  title={NETWORKS[n].label}
                  className={`flex h-8 w-8 items-center justify-center rounded-[2px] border transition ${platform === n ? "border-[var(--color-accent)] bg-[rgba(16,128,202,0.12)] text-[var(--color-accent)]" : "border-[var(--color-border)] bg-[#0a0a0c] text-[var(--color-dim)] hover:text-[var(--color-ink)]"}`}>
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d={NETWORKS[n].path} /></svg>
                </button>
              ))}
            </div>
          </div>

          {/* niche + tier chips */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Chip active={niche === "all"} onClick={() => setNiche("all")}>Бүх чиглэл</Chip>
            {nicheOptions.map((n) => (
              <Chip key={n} active={niche === n} onClick={() => setNiche(niche === n ? "all" : n)}>{n}</Chip>
            ))}
            <span className="mx-1 h-4 w-px bg-[var(--color-border)]" />
            {(Object.keys(TIERS) as Tier[]).map((t) => (
              <Chip key={t} active={tier === t} onClick={() => setTier(tier === t ? "all" : t)} color={TIERS[t].color}>
                {TIERS[t].label}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      {/* ── GRID ──────────────────────────────────────────────────────── */}
      <div className="mt-6 pb-4">
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[320px] animate-pulse rounded-[2px] border border-[var(--color-border)] bg-[#101014]" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-[2px] border-2 border-dashed border-[var(--color-border)] p-16 text-center">
            <p className="chrome text-[10px] text-[var(--color-dim)]">ҮР ДҮН ОЛДСОНГҮЙ</p>
            <p className="mt-2 text-[13px] text-[var(--color-muted)]">Шүүлтүүрээ өөрчлөх эсвэл эхний креатор болж бүртгүүл.</p>
            <button onClick={() => setApplyOpen(true)} className="mt-4 rounded-[2px] bg-[var(--color-accent)] px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-white">
              Креатор болох
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((inf, idx) => (
              <Card key={inf._id} inf={inf} idx={idx} onCollab={() => setCollabFor(inf)} />
            ))}
          </div>
        )}
      </div>

      {/* ── BRAND BAND ────────────────────────────────────────────────── */}
      <section className="mt-8 mb-4 overflow-hidden rounded-[2px] border border-[rgba(16,128,202,0.25)] bg-gradient-to-br from-[#141018] to-[#0d0d10] px-6 py-10 text-center sm:px-10">
        <p className="chrome text-[10px] text-[var(--color-accent)]">БРЭНДҮҮДЭД</p>
        <h2 className="headline mt-3 text-[26px] sm:text-[34px]">Зөв креатор. Хэмжигдэх <span className="accent">үр дүн</span>.</h2>
        <p className="mx-auto mt-3 max-w-lg text-[13px] text-[var(--color-muted)]">
          Брифээ илгээ — бид зорилго, төсөв, чиглэлд тохирсон креаторуудыг санал болгож,
          кампанит ажлыг эхнээс нь дуустал зохион байгуулна.
        </p>
        <button onClick={() => setCollabFor("open")} className="mt-6 inline-flex items-center gap-2 rounded-[2px] bg-[var(--color-accent)] px-6 py-3 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-white transition hover:shadow-[0_0_28px_rgba(16,128,202,0.5)]">
          Бриф илгээх →
        </button>
      </section>

      <AnimatePresence>
        {applyOpen && <ApplyModal onClose={() => setApplyOpen(false)} niches={nicheOptions} />}
        {collabFor && (
          <CollabModal
            target={collabFor === "open" ? null : collabFor}
            onClose={() => setCollabFor(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Chip ─────────────────────────────────────────────────────────────── */
function Chip({ active, onClick, children, color }: { active: boolean; onClick: () => void; children: React.ReactNode; color?: string }) {
  return (
    <button onClick={onClick}
      style={active && color ? { borderColor: color, color, background: `${color}1a` } : undefined}
      className={`rounded-[2px] border px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] transition ${active ? "border-[var(--color-accent)] bg-[rgba(16,128,202,0.12)] text-[var(--color-accent)]" : "border-[var(--color-border)] bg-[#0a0a0c] text-[var(--color-dim)] hover:text-[var(--color-ink)]"}`}>
      {children}
    </button>
  );
}

/* ── Card ─────────────────────────────────────────────────────────────── */
function Card({ inf, idx, onCollab }: { inf: Influencer; idx: number; onCollab: () => void }) {
  const accent = accentFor(inf.name || "A");
  const tier = TIERS[inf.tier] || TIERS.micro;
  const initials = (inf.name || "?").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(idx * 0.04, 0.4) }}
      className="group relative flex flex-col overflow-hidden rounded-[2px] border border-[var(--color-border)] bg-[#101014] transition hover:border-[rgba(16,128,202,0.45)]">
      {inf.featured && (
        <span className="absolute right-2 top-2 z-10 rounded-[2px] bg-[var(--color-accent)] px-2 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.18em] text-white">FEATURED</span>
      )}
      {/* cover */}
      <Link href={`/influencers/${inf.slug}`} className="relative block h-24 overflow-hidden">
        {inf.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={inf.cover} alt="" className="h-full w-full object-cover opacity-80 transition group-hover:scale-105 group-hover:opacity-100" />
        ) : (
          <div className="h-full w-full" style={{ background: `radial-gradient(120% 100% at 80% 0%, ${accent}44, transparent 60%), #0b0b0e` }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#101014] to-transparent" />
      </Link>

      <div className="relative -mt-8 flex flex-1 flex-col px-4 pb-4">
        <div className="flex items-end gap-3">
          <Link href={`/influencers/${inf.slug}`} className="relative">
            <div className="h-16 w-16 overflow-hidden rounded-[2px] border-2 border-[#101014] bg-[#0a0a0c] shadow-lg" style={{ boxShadow: `0 0 0 1px ${accent}55` }}>
              {inf.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={inf.avatar} alt={inf.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center font-display text-[18px] font-extrabold" style={{ color: accent }}>{initials}</div>
              )}
            </div>
          </Link>
          <span className="mb-1 rounded-[2px] px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.14em]"
            style={{ color: tier.color, background: `${tier.color}1a`, border: `1px solid ${tier.color}44` }}>{tier.label}</span>
        </div>

        <div className="mt-3">
          <Link href={`/influencers/${inf.slug}`} className="flex items-center gap-1.5">
            <span className="truncate text-[15px] font-bold text-[var(--color-ink)] group-hover:text-white">{inf.name}</span>
            {inf.verified && (
              <svg className="h-3.5 w-3.5 shrink-0 text-[var(--color-accent)]" viewBox="0 0 24 24" fill="currentColor"><path d="M9.6 16.6 5 12l1.4-1.4 3.2 3.2 7-7L18 8.2z M12 1 3 5v6c0 5.5 3.8 10.7 9 12 5.2-1.3 9-6.5 9-12V5z" opacity=".18"/><path d="M10 15.2 6.5 11.7l1.4-1.4 2.1 2.1 5.1-5.1 1.4 1.4z"/></svg>
            )}
          </Link>
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[var(--color-dim)]">
            {inf.handle && <span>@{inf.handle}</span>}
            {inf.niche && <span className="truncate">· {inf.niche}</span>}
          </div>
        </div>

        {inf.bio && <p className="mt-2 line-clamp-2 text-[12px] leading-relaxed text-[var(--color-muted)]">{inf.bio}</p>}

        {/* metrics */}
        <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-[2px] border border-[var(--color-border)] bg-[var(--color-border)]">
          <div className="bg-[#0c0c0f] px-3 py-2">
            <div className="font-display text-[16px] font-extrabold text-[var(--color-ink)]">{fmt(inf.totalFollowers)}</div>
            <div className="chrome text-[8px] text-[var(--color-dim)]">Дагагч</div>
          </div>
          <div className="bg-[#0c0c0f] px-3 py-2">
            <div className="font-display text-[16px] font-extrabold" style={{ color: accent }}>{inf.engagementRate ? inf.engagementRate.toFixed(1) + "%" : "—"}</div>
            <div className="chrome text-[8px] text-[var(--color-dim)]">Engagement</div>
          </div>
        </div>

        {/* platforms */}
        {inf.platforms?.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {inf.platforms.map((p) => (
              <a key={p.network} href={p.url || undefined} target="_blank" rel="noreferrer"
                title={`${NETWORKS[p.network]?.label} · ${fmt(p.followers)}`}
                className="flex items-center gap-1 rounded-[2px] border border-[var(--color-border)] bg-[#0a0a0c] px-1.5 py-1 text-[var(--color-muted)] transition hover:border-[rgba(16,128,202,0.4)] hover:text-[var(--color-ink)]">
                <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor"><path d={NETWORKS[p.network]?.path} /></svg>
                <span className="font-mono text-[9px] font-bold">{fmt(p.followers)}</span>
              </a>
            ))}
          </div>
        )}

        <div className="mt-auto flex items-center gap-2 pt-4">
          <button onClick={onCollab}
            className="flex-1 rounded-[2px] bg-[var(--color-accent)] px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-white transition hover:shadow-[0_0_18px_rgba(16,128,202,0.45)]">
            Хамтрах
          </button>
          <Link href={`/influencers/${inf.slug}`}
            className="rounded-[2px] border border-[var(--color-border)] px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-muted)] transition hover:border-[rgba(16,128,202,0.4)] hover:text-[var(--color-ink)]">
            Профайл
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Modal shell ──────────────────────────────────────────────────────── */
function Modal({ title, eyebrow, onClose, children }: { title: string; eyebrow: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-[10px] border border-[var(--color-border)] bg-[#0d0d10] p-6 sm:rounded-[4px]">
        <button onClick={onClose} aria-label="Хаах" className="absolute right-4 top-4 text-[var(--color-dim)] transition hover:text-[var(--color-ink)]">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
        <p className="chrome text-[10px] text-[var(--color-accent)]">{eyebrow}</p>
        <h3 className="headline mt-2 text-[24px]">{title}</h3>
        <div className="mt-5">{children}</div>
      </motion.div>
    </motion.div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="chrome mb-1.5 block text-[9px] text-[var(--color-dim)]">{label}</span>
      {children}
    </label>
  );
}
const inputCls = "w-full rounded-[2px] border border-[var(--color-border)] bg-[#0a0a0c] px-3 py-2.5 text-[13px] text-[var(--color-ink)] placeholder-[var(--color-dim)] outline-none focus:border-[rgba(16,128,202,0.5)]";

/* ── Apply modal (creator) ────────────────────────────────────────────── */
function ApplyModal({ onClose, niches }: { onClose: () => void; niches: string[] }) {
  const [f, setF] = useState({ name: "", handle: "", email: "", phone: "", niche: "", primaryPlatform: "instagram", followers: "", portfolioUrl: "", message: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));

  const submit = async () => {
    if (!f.name.trim() || !f.email.trim()) { setErr("Нэр болон имэйл заавал."); return; }
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/influencers/apply", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, followers: Number(f.followers) || 0 }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || "Алдаа гарлаа"); return; }
      setDone(true);
    } finally { setBusy(false); }
  };

  return (
    <Modal eyebrow="ROSTER // APPLY" title={done ? "Хүлээн авлаа" : "Креатор болох"} onClose={onClose}>
      {done ? (
        <div className="py-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(16,128,202,0.12)]">
            <svg className="h-7 w-7 text-[var(--color-accent)]" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          </div>
          <p className="mt-4 text-[14px] text-[var(--color-ink)]">Өргөдөл хүлээн авлаа.</p>
          <p className="mt-1 text-[12px] text-[var(--color-muted)]">Багийнхан тун удахгүй холбогдоно.</p>
          <button onClick={onClose} className="mt-5 rounded-[2px] bg-[var(--color-accent)] px-5 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-white">Хаах</button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Нэр *"><input className={inputCls} value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Таны нэр" /></Field>
            <Field label="@Handle"><input className={inputCls} value={f.handle} onChange={(e) => set("handle", e.target.value)} placeholder="username" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Имэйл *"><input className={inputCls} type="email" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="you@mail.com" /></Field>
            <Field label="Утас"><input className={inputCls} value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="9911..." /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Чиглэл">
              <input className={inputCls} list="niche-list" value={f.niche} onChange={(e) => set("niche", e.target.value)} placeholder="Гоо сайхан…" />
              <datalist id="niche-list">{niches.map((n) => <option key={n} value={n} />)}</datalist>
            </Field>
            <Field label="Гол платформ">
              <select className={inputCls} value={f.primaryPlatform} onChange={(e) => set("primaryPlatform", e.target.value)}>
                {Object.entries(NETWORKS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Нийт дагагч"><input className={inputCls} type="number" value={f.followers} onChange={(e) => set("followers", e.target.value)} placeholder="10000" /></Field>
            <Field label="Portfolio / линк"><input className={inputCls} value={f.portfolioUrl} onChange={(e) => set("portfolioUrl", e.target.value)} placeholder="https://…" /></Field>
          </div>
          <Field label="Танилцуулга"><textarea className={inputCls + " min-h-[80px] resize-y"} value={f.message} onChange={(e) => set("message", e.target.value)} placeholder="Юу бүтээдэг вэ? Ямар брэндтэй ажилламаар байна?" /></Field>
          {err && <p className="text-[11px] text-[var(--color-accent)]">{err}</p>}
          <button onClick={submit} disabled={busy} className="w-full rounded-[2px] bg-[var(--color-accent)] px-4 py-3 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-white transition hover:shadow-[0_0_20px_rgba(16,128,202,0.5)] disabled:opacity-50">
            {busy ? "Илгээж байна…" : "Өргөдөл илгээх"}
          </button>
        </div>
      )}
    </Modal>
  );
}

/* ── Collab modal (brand) ─────────────────────────────────────────────── */
function CollabModal({ target, onClose }: { target: Influencer | null; onClose: () => void }) {
  const [f, setF] = useState({ brand: "", name: "", email: "", phone: "", budget: "", goal: "awareness", message: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));

  const GOALS = [
    { k: "awareness", v: "Танилт нэмэх" }, { k: "launch", v: "Бүтээгдэхүүн нээлт" },
    { k: "sales", v: "Борлуулалт" }, { k: "ugc", v: "UGC контент" }, { k: "event", v: "Эвент" },
  ];

  const submit = async () => {
    if (!f.name.trim() || !f.email.trim() || !f.message.trim()) { setErr("Нэр, имэйл, зорилго заавал."); return; }
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/influencers/collab", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, budget: Number(f.budget) || 0, influencer: target?.slug || "" }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || "Алдаа гарлаа"); return; }
      setDone(true);
    } finally { setBusy(false); }
  };

  return (
    <Modal eyebrow={target ? "COLLAB REQUEST" : "OPEN BRIEF"} title={done ? "Хүлээн авлаа" : target ? `${target.name}-тэй хамтрах` : "Кампанит ажил"} onClose={onClose}>
      {done ? (
        <div className="py-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(16,128,202,0.12)]">
            <svg className="h-7 w-7 text-[var(--color-accent)]" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          </div>
          <p className="mt-4 text-[14px] text-[var(--color-ink)]">Хүсэлт хүлээн авлаа.</p>
          <p className="mt-1 text-[12px] text-[var(--color-muted)]">Бид 24 цагийн дотор холбогдоно.</p>
          <button onClick={onClose} className="mt-5 rounded-[2px] bg-[var(--color-accent)] px-5 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-white">Хаах</button>
        </div>
      ) : (
        <div className="space-y-3">
          {target && (
            <div className="flex items-center gap-3 rounded-[2px] border border-[rgba(16,128,202,0.25)] bg-[rgba(16,128,202,0.06)] p-2.5">
              <div className="h-9 w-9 overflow-hidden rounded-[2px] bg-[#0a0a0c]">
                {target.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={target.avatar} alt="" className="h-full w-full object-cover" />
                ) : <div className="flex h-full w-full items-center justify-center text-[11px] font-bold text-[var(--color-accent)]">{(target.name[0] || "?").toUpperCase()}</div>}
              </div>
              <div className="min-w-0">
                <div className="truncate text-[12px] font-bold text-[var(--color-ink)]">{target.name}</div>
                <div className="text-[10px] text-[var(--color-dim)]">{fmt(target.totalFollowers)} дагагч · {target.niche}</div>
              </div>
            </div>
          )}
          <Field label="Брэнд / компани"><input className={inputCls} value={f.brand} onChange={(e) => set("brand", e.target.value)} placeholder="Компанийн нэр" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Хариуцагч *"><input className={inputCls} value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Таны нэр" /></Field>
            <Field label="Утас"><input className={inputCls} value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="9911..." /></Field>
          </div>
          <Field label="Имэйл *"><input className={inputCls} type="email" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="brand@mail.com" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Зорилго">
              <select className={inputCls} value={f.goal} onChange={(e) => set("goal", e.target.value)}>
                {GOALS.map((g) => <option key={g.k} value={g.k}>{g.v}</option>)}
              </select>
            </Field>
            <Field label="Төсөв (₮)"><input className={inputCls} type="number" value={f.budget} onChange={(e) => set("budget", e.target.value)} placeholder="1000000" /></Field>
          </div>
          <Field label="Брифийн тайлбар *"><textarea className={inputCls + " min-h-[90px] resize-y"} value={f.message} onChange={(e) => set("message", e.target.value)} placeholder="Кампанит ажлын зорилго, хугацаа, хүлээлт…" /></Field>
          {err && <p className="text-[11px] text-[var(--color-accent)]">{err}</p>}
          <button onClick={submit} disabled={busy} className="w-full rounded-[2px] bg-[var(--color-accent)] px-4 py-3 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-white transition hover:shadow-[0_0_20px_rgba(16,128,202,0.5)] disabled:opacity-50">
            {busy ? "Илгээж байна…" : "Хүсэлт илгээх"}
          </button>
        </div>
      )}
    </Modal>
  );
}
