"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";

type Network = "instagram" | "tiktok" | "youtube" | "facebook" | "threads" | "x";
type Tier = "nano" | "micro" | "macro" | "mega" | "celebrity";
interface Platform { network: Network; url: string; followers: number }
interface Influencer {
  _id: string; name: string; handle: string; slug: string; avatar: string; cover: string;
  bio: string; location: string; niche: string; tier: Tier; platforms: Platform[];
  totalFollowers: number; engagementRate: number; tags: string[]; rateFrom: number;
  verified: boolean; featured: boolean; stats?: { campaigns?: number; rating?: number };
}

const TIERS: Record<Tier, { label: string; color: string }> = {
  nano: { label: "НАНО", color: "#B4B4BA" }, micro: { label: "МИКРО", color: "#1080CA" },
  macro: { label: "МАКРО", color: "#4FA8E8" }, mega: { label: "МЕГА", color: "#FF6E86" },
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
function fmt(n: number): string {
  if (!n) return "0";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1) + "K";
  return String(n);
}
const inputCls = "w-full rounded-[2px] border border-[var(--color-border)] bg-[#0a0a0c] px-3 py-2.5 text-[13px] text-[var(--color-ink)] placeholder-[var(--color-dim)] outline-none focus:border-[rgba(16,128,202,0.5)]";

export default function InfluencerProfile({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [inf, setInf] = useState<Influencer | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing">("loading");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/influencers/${encodeURIComponent(slug)}`, { cache: "no-store" });
        if (!res.ok) { setState("missing"); return; }
        const data = await res.json();
        if (data.influencer) { setInf(data.influencer); setState("ok"); } else setState("missing");
      } catch { setState("missing"); }
    })();
  }, [slug]);

  if (state === "loading") {
    return <div className="mx-auto max-w-3xl"><div className="h-64 animate-pulse rounded-[2px] border border-[var(--color-border)] bg-[#101014]" /></div>;
  }
  if (state === "missing" || !inf) {
    return (
      <div className="mx-auto max-w-3xl py-20 text-center">
        <p className="chrome text-[10px] text-[var(--color-dim)]">404 // NOT FOUND</p>
        <h1 className="headline mt-3 text-[28px]">Креатор олдсонгүй<span className="dot">.</span></h1>
        <Link href="/influencers" className="mt-5 inline-block rounded-[2px] bg-[var(--color-accent)] px-5 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-white">← Сүлжээ рүү</Link>
      </div>
    );
  }

  const tier = TIERS[inf.tier] || TIERS.micro;
  const accent = "#1080CA";
  const initials = (inf.name || "?").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="light-page mx-auto max-w-3xl">
      <Link href="/influencers" className="chrome inline-flex items-center gap-1 text-[10px] text-[var(--color-dim)] transition hover:text-[var(--color-accent)]">← INFLUENCER NETWORK</Link>

      <div className="mt-3 overflow-hidden rounded-[2px] border border-[var(--color-border)] bg-[#101014]">
        {/* cover */}
        <div className="relative h-40 sm:h-52">
          {inf.cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={inf.cover} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full" style={{ background: `radial-gradient(100% 120% at 80% 0%, ${accent}55, transparent 55%), linear-gradient(180deg,#141018,#0b0b0e)` }} />
          )}
          <div className="pointer-events-none absolute inset-0 opacity-[0.08]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
          <div className="absolute inset-0 bg-gradient-to-t from-[#101014] to-transparent" />
          {inf.featured && <span className="absolute right-3 top-3 rounded-[2px] bg-[var(--color-accent)] px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-white">FEATURED</span>}
        </div>

        <div className="px-5 pb-6 sm:px-8">
          <div className="-mt-12 flex flex-wrap items-end gap-4">
            <div className="h-24 w-24 overflow-hidden rounded-[3px] border-2 border-[#101014] bg-[#0a0a0c]" style={{ boxShadow: `0 0 0 1px ${accent}66, 0 0 30px ${accent}33` }}>
              {inf.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={inf.avatar} alt={inf.name} className="h-full w-full object-cover" />
              ) : <div className="flex h-full w-full items-center justify-center font-display text-[26px] font-extrabold" style={{ color: accent }}>{initials}</div>}
            </div>
            <div className="mb-1 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="headline text-[26px] sm:text-[32px]">{inf.name}</h1>
                {inf.verified && <svg className="h-5 w-5 text-[var(--color-accent)]" viewBox="0 0 24 24" fill="currentColor"><path d="M10 15.2 6.5 11.7l1.4-1.4 2.1 2.1 5.1-5.1 1.4 1.4z M12 1 3 5v6c0 5.5 3.8 10.7 9 12 5.2-1.3 9-6.5 9-12V5z" opacity=".2"/><path d="M10 15.2 6.5 11.7l1.4-1.4 2.1 2.1 5.1-5.1 1.4 1.4z"/></svg>}
                <span className="rounded-[2px] px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: tier.color, background: `${tier.color}1a`, border: `1px solid ${tier.color}44` }}>{tier.label}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-[var(--color-dim)]">
                {inf.handle && <span>@{inf.handle}</span>}
                {inf.niche && <span>· {inf.niche}</span>}
                {inf.location && <span>· {inf.location}</span>}
              </div>
            </div>
          </div>

          {inf.bio && <p className="mt-4 max-w-xl text-[14px] leading-relaxed text-[var(--color-muted)]">{inf.bio}</p>}

          {inf.tags?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {inf.tags.map((t) => <span key={t} className="rounded-[2px] border border-[var(--color-border)] bg-[#0a0a0c] px-2 py-0.5 font-mono text-[10px] text-[var(--color-muted)]">#{t}</span>)}
            </div>
          )}

          {/* metrics */}
          <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-[2px] border border-[var(--color-border)] bg-[var(--color-border)] sm:grid-cols-4">
            {[
              { k: fmt(inf.totalFollowers), v: "Нийт дагагч" },
              { k: inf.engagementRate ? inf.engagementRate.toFixed(1) + "%" : "—", v: "Engagement" },
              { k: inf.stats?.campaigns ? String(inf.stats.campaigns) : "—", v: "Кампанит" },
              { k: inf.rateFrom ? "₮" + fmt(inf.rateFrom) : "Уулзалт", v: inf.rateFrom ? "Үнэ (эхлэх)" : "Үнэ" },
            ].map((s) => (
              <div key={s.v} className="bg-[#0c0c0f] px-4 py-3">
                <div className="font-display text-[20px] font-extrabold text-[var(--color-ink)]">{s.k}</div>
                <div className="chrome mt-1 text-[8px] text-[var(--color-dim)]">{s.v}</div>
              </div>
            ))}
          </div>

          {/* platforms */}
          {inf.platforms?.length > 0 && (
            <div className="mt-5">
              <p className="chrome mb-2 text-[9px] text-[var(--color-dim)]">ПЛАТФОРМ</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {inf.platforms.map((p) => (
                  <a key={p.network} href={p.url || undefined} target="_blank" rel="noreferrer"
                    className="flex items-center gap-2.5 rounded-[2px] border border-[var(--color-border)] bg-[#0a0a0c] px-3 py-2.5 transition hover:border-[rgba(16,128,202,0.4)]">
                    <svg viewBox="0 0 24 24" className="h-5 w-5 text-[var(--color-ink)]" fill="currentColor"><path d={NETWORKS[p.network]?.path} /></svg>
                    <div className="min-w-0">
                      <div className="truncate text-[12px] font-bold text-[var(--color-ink)]">{NETWORKS[p.network]?.label}</div>
                      <div className="font-mono text-[10px] text-[var(--color-dim)]">{fmt(p.followers)} дагагч</div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* collab CTA */}
      <ProfileCollab inf={inf} />
    </div>
  );
}

function ProfileCollab({ inf }: { inf: Influencer }) {
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
        body: JSON.stringify({ ...f, budget: Number(f.budget) || 0, influencer: inf.slug }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || "Алдаа гарлаа"); return; }
      setDone(true);
    } finally { setBusy(false); }
  };

  return (
    <div className="mt-4 overflow-hidden rounded-[2px] border border-[rgba(16,128,202,0.25)] bg-gradient-to-br from-[#141018] to-[#0d0d10] p-5 sm:p-7">
      <p className="chrome text-[10px] text-[var(--color-accent)]">COLLAB REQUEST</p>
      <h2 className="headline mt-2 text-[22px]">{inf.name}-тэй <span className="accent">хамтрах</span></h2>
      {done ? (
        <div className="py-6 text-center">
          <p className="text-[14px] text-[var(--color-ink)]">Хүсэлт хүлээн авлаа. 24 цагийн дотор холбогдоно.</p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input className={inputCls} value={f.brand} onChange={(e) => set("brand", e.target.value)} placeholder="Брэнд / компани" />
            <input className={inputCls} value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Хариуцагчийн нэр *" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input className={inputCls} type="email" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="Имэйл *" />
            <input className={inputCls} value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="Утас" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <select className={inputCls} value={f.goal} onChange={(e) => set("goal", e.target.value)}>
              {GOALS.map((g) => <option key={g.k} value={g.k}>{g.v}</option>)}
            </select>
            <input className={inputCls} type="number" value={f.budget} onChange={(e) => set("budget", e.target.value)} placeholder="Төсөв (₮)" />
          </div>
          <textarea className={inputCls + " min-h-[90px] resize-y"} value={f.message} onChange={(e) => set("message", e.target.value)} placeholder="Кампанит ажлын зорилго, хугацаа, хүлээлт… *" />
          {err && <p className="text-[11px] text-[var(--color-accent)]">{err}</p>}
          <button onClick={submit} disabled={busy} className="w-full rounded-[2px] bg-[var(--color-accent)] px-4 py-3 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-white transition hover:shadow-[0_0_20px_rgba(16,128,202,0.5)] disabled:opacity-50">
            {busy ? "Илгээж байна…" : "Хүсэлт илгээх"}
          </button>
        </div>
      )}
    </div>
  );
}
