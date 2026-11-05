"use client";

import { useId, useMemo, useRef, useState } from "react";

/* ─── Самбарын график (2026-10-17) — гадны сангүй, SVG ─────────────────
   Spark: KPI картын жижиг муруй. Area: үндсэн график (одоо = дүүргэлттэй
   муруй, өмнөх үе = тасархай), hover дээр босоо шугам + tooltip.
   Donut: гишүүнчлэлийн хувиарлалт. Муруй нь "monotone" — 0-оос доош,
   хамгийн өндрөөс дээш хэтэрдэггүй (catmull-rom-ийн overshoot-гүй). */

function smooth(pts: [number, number][]): string {
  if (pts.length < 2) return pts.length ? `M${pts[0][0]},${pts[0][1]}` : "";
  const n = pts.length, dx: number[] = [], m: number[] = [], t: number[] = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0]; m[i] = (pts[i + 1][1] - pts[i][1]) / (dx[i] || 1); }
  t[0] = m[0]; t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / m[i], b = t[i + 1] / m[i], h = a * a + b * b;
    if (h > 9) { const k = 3 / Math.sqrt(h); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
  }
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${(pts[i][0] + h).toFixed(1)},${(pts[i][1] + t[i] * h).toFixed(1)} ${(pts[i + 1][0] - h).toFixed(1)},${(pts[i + 1][1] - t[i + 1] * h).toFixed(1)} ${pts[i + 1][0].toFixed(1)},${pts[i + 1][1].toFixed(1)}`;
  }
  return d;
}

export function Spark({ data, color, height = 44 }: { data: number[]; color: string; height?: number }) {
  const id = useId().replace(/:/g, "");
  const W = 200, H = height, max = Math.max(...data, 1), n = data.length;
  const pts = data.map((v, i) => [n > 1 ? (i / (n - 1)) * W : W / 2, H - 4 - (v / max) * (H - 10)] as [number, number]);
  const line = smooth(pts);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block w-full" style={{ height }} aria-hidden="true">
      <defs><linearGradient id={`s${id}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".32" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      {n > 1 && <path d={`${line} L${W},${H} L0,${H} Z`} fill={`url(#s${id})`} />}
      <path d={line} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinecap="round" className="dash-draw" />
    </svg>
  );
}

export function Area({ days, cur, prev, color, fmt }: { days: string[]; cur: number[]; prev: number[]; color: string; fmt: (n: number) => string }) {
  const id = useId().replace(/:/g, "");
  const box = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const W = 800, H = 260, L = 52, R = 12, T = 14, B = 30;
  const n = cur.length;
  const { max, ticks } = useMemo(() => {
    const raw = Math.max(...cur, ...prev, 1);
    const p = Math.pow(10, Math.floor(Math.log10(raw))); const step = [1, 2, 2.5, 5, 10].map((k) => k * p).find((s) => raw / s <= 4) || p * 10;
    const top = Math.ceil(raw / step) * step;
    return { max: top, ticks: Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step) };
  }, [cur, prev]);
  const x = (i: number) => L + (n > 1 ? (i / (n - 1)) * (W - L - R) : 0);
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const cp = cur.map((v, i) => [x(i), y(v)] as [number, number]);
  const pp = prev.map((v, i) => [x(i), y(v)] as [number, number]);
  const every = Math.max(1, Math.ceil(n / 7));
  const short = (d: string) => { const [, mo, da] = d.split("-"); return `${Number(mo)}/${Number(da)}`; };

  const onMove = (e: React.PointerEvent) => {
    const r = box.current?.getBoundingClientRect(); if (!r) return;
    const px = ((e.clientX - r.left) / r.width) * W;
    setHover(Math.max(0, Math.min(n - 1, Math.round(((px - L) / (W - L - R)) * (n - 1)))));
  };

  return (
    <div ref={box} className="relative" onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-[260px] w-full" preserveAspectRatio="none">
        <defs><linearGradient id={`a${id}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".28" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,.06)" vectorEffect="non-scaling-stroke" />
            <text x={L - 10} y={y(t) + 4} textAnchor="end" fontSize="11" fill="rgba(255,255,255,.4)">{fmt(t)}</text>
          </g>
        ))}
        {days.map((d, i) => (i % every === 0 || i === n - 1) && <text key={d} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="rgba(255,255,255,.4)">{short(d)}</text>)}
        <path d={smooth(pp)} fill="none" stroke="rgba(255,255,255,.28)" strokeWidth={1.5} strokeDasharray="5 5" vectorEffect="non-scaling-stroke" />
        <path d={`${smooth(cp)} L${x(n - 1)},${H - B} L${L},${H - B} Z`} fill={`url(#a${id})`} className="dash-fade" />
        <path d={smooth(cp)} fill="none" stroke={color} strokeWidth={2.5} vectorEffect="non-scaling-stroke" strokeLinecap="round" className="dash-draw" />
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="rgba(255,255,255,.18)" vectorEffect="non-scaling-stroke" />
            <circle cx={x(hover)} cy={y(cur[hover])} r={5} fill={color} stroke="#0A0A0A" strokeWidth={2} vectorEffect="non-scaling-stroke" />
          </g>
        )}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute top-2 rounded-[4px] border border-white/10 bg-[#080808]/95 px-3 py-2 text-[12px] shadow-xl backdrop-blur"
          style={{ left: `clamp(8px, calc(${(x(hover) / W) * 100}% - 80px), calc(100% - 168px))`, width: 160 }}>
          <div className="text-white/50">{days[hover]}</div>
          <div className="mt-1 flex items-center justify-between gap-2"><span className="flex items-center gap-1.5 text-white/70"><i className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />Одоо</span><b className="text-white">{fmt(cur[hover])}</b></div>
          <div className="flex items-center justify-between gap-2"><span className="flex items-center gap-1.5 text-white/50"><i className="inline-block h-[2px] w-2 bg-white/40" />Өмнөх</span><span className="text-white/60">{fmt(prev[hover] || 0)}</span></div>
        </div>
      )}
    </div>
  );
}

export function Donut({ parts, size = 180, label, sub }: { parts: { v: number; color: string }[]; size?: number; label: string; sub: string }) {
  const total = Math.max(1, parts.reduce((a, p) => a + p.v, 0));
  const r = 70, c = 2 * Math.PI * r, gap = parts.filter((p) => p.v > 0).length > 1 ? 4 : 0;
  let off = 0;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 180 180" width={size} height={size} className="-rotate-90">
        <circle cx="90" cy="90" r={r} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="18" />
        {parts.map((p, i) => {
          const len = Math.max(0, (p.v / total) * c - gap);
          const el = p.v > 0 ? <circle key={i} cx="90" cy="90" r={r} fill="none" stroke={p.color} strokeWidth="18" strokeLinecap="round"
            strokeDasharray={`${len} ${c}`} strokeDashoffset={-off} className="dash-ring" style={{ animationDelay: `${i * 120}ms` }} /> : null;
          off += (p.v / total) * c;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <b className="text-[30px] font-bold leading-none text-white">{label}</b>
        <span className="mt-1 text-[12px] text-white/50">{sub}</span>
      </div>
    </div>
  );
}
