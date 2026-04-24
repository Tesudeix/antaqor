"use client";

import { useCallback, useEffect, useState } from "react";

interface TopUploader {
  _id: string;
  name: string;
  email?: string;
  avatar?: string;
  uploadBytesMonth?: number;
  uploadMonthResetAt?: string;
  subscriptionExpiresAt?: string;
  banned?: boolean;
}

interface BannedUser {
  _id: string;
  name: string;
  email?: string;
  avatar?: string;
  bannedReason?: string;
  bannedAt?: string;
}

interface RecentUser {
  _id: string;
  name: string;
  email?: string;
  avatar?: string;
  createdAt: string;
  subscriptionExpiresAt?: string;
  xp?: number;
  level?: number;
}

interface Payload {
  disk: { freeBytes: number; totalBytes: number; usedBytes: number; usedPct: number };
  sharp: { active: number; queued: number; max: number };
  users: { total: number; banned: number };
  topUploaders: TopUploader[];
  recentBans: BannedUser[];
  recentSignups: RecentUser[];
}

function fmtBytes(n: number): string {
  if (n === 0) return "0 B";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function relativeDate(iso?: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "сая";
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ц`;
  const d = Math.floor(h / 24);
  return `${d} ө`;
}

export default function SecurityDashboard() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState("");
  const [banningId, setBanningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/security");
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  const showFlash = (m: string) => {
    setFlash(m);
    setTimeout(() => setFlash(""), 2500);
  };

  const ban = async (userId: string, name: string) => {
    const reason = prompt(`Блоклох шалтгаан (${name}):`, "spam / abuse");
    if (reason === null) return;
    setBanningId(userId);
    try {
      const res = await fetch(`/api/admin/members/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ban", reason }),
      });
      const d = await res.json();
      if (res.ok) {
        showFlash(`${name} блокын жагсаалтад орлоо`);
        load();
      } else {
        showFlash("Алдаа: " + (d.error || "failed"));
      }
    } finally {
      setBanningId(null);
    }
  };

  const unban = async (userId: string, name: string) => {
    if (!confirm(`${name}-н блокыг цуцлах уу?`)) return;
    setBanningId(userId);
    try {
      const res = await fetch(`/api/admin/members/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unban" }),
      });
      const d = await res.json();
      if (res.ok) {
        showFlash(`${name} блок цуцлагдлаа`);
        load();
      } else {
        showFlash("Алдаа: " + (d.error || "failed"));
      }
    } finally {
      setBanningId(null);
    }
  };

  if (loading || !data) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#EF2C58] border-t-transparent" />
      </div>
    );
  }

  const diskWarn = data.disk.usedPct > 75;
  const diskCrit = data.disk.usedPct > 90;
  const diskColor = diskCrit ? "#EF4444" : diskWarn ? "#FFC107" : "#22C55E";

  return (
    <div className="space-y-5 pb-6">
      {flash && (
        <div className="fixed top-4 right-4 z-50 rounded-[8px] border border-[rgba(255,255,255,0.08)] bg-[#1A1A1A] px-4 py-2.5 text-[13px] text-[#E8E8E8] shadow-xl">
          {flash}
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#E8E8E8]">Security & Health</h1>
          <p className="mt-0.5 text-[12px] text-[#555]">Server resource monitor · abuse watchlist · one-click ban</p>
        </div>
        <button onClick={load} className="rounded-[8px] border border-[rgba(255,255,255,0.08)] bg-[#141414] px-4 py-2 text-[12px] font-bold text-[#AAA] hover:text-[#EF2C58]">
          Шинэчлэх
        </button>
      </div>

      {/* Resource cards */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="rounded-[8px] border bg-[#141414] p-5" style={{ borderColor: diskCrit ? `${diskColor}66` : "rgba(255,255,255,0.06)" }}>
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: diskColor }}>Upload disk</div>
            <span className="text-[10px] font-bold" style={{ color: diskColor }}>
              {data.disk.usedPct}% used
            </span>
          </div>
          <div className="mt-2 text-[22px] font-black text-[#E8E8E8]">
            {fmtBytes(data.disk.usedBytes)} <span className="text-[12px] font-semibold text-[#555]">/ {fmtBytes(data.disk.totalBytes)}</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[rgba(255,255,255,0.05)]">
            <div className="h-full rounded-full transition-all" style={{ width: `${data.disk.usedPct}%`, background: diskColor }} />
          </div>
          <div className="mt-2 text-[10px] text-[#555]">
            Free: {fmtBytes(data.disk.freeBytes)}
            {diskCrit && <span className="ml-2 text-[#EF4444]">⚠ Reject шинэ upload</span>}
          </div>
        </div>

        <div className="rounded-[8px] border border-[rgba(255,255,255,0.06)] bg-[#141414] p-5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#EF2C58]">Sharp concurrency</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-[22px] font-black text-[#E8E8E8]">{data.sharp.active}</span>
            <span className="text-[13px] font-semibold text-[#666]">/ {data.sharp.max} active</span>
          </div>
          <div className="mt-1 text-[10px] text-[#555]">Queue: {data.sharp.queued}</div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[rgba(255,255,255,0.05)]">
            <div className="h-full rounded-full bg-[#EF2C58]" style={{ width: `${(data.sharp.active / data.sharp.max) * 100}%` }} />
          </div>
        </div>

        <div className="rounded-[8px] border border-[rgba(255,255,255,0.06)] bg-[#141414] p-5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#EF2C58]">Users</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-[22px] font-black text-[#E8E8E8]">{data.users.total.toLocaleString()}</span>
            <span className="text-[13px] font-semibold text-[#666]">total</span>
          </div>
          <div className="mt-1 flex gap-3 text-[10px] text-[#555]">
            <span>🚫 {data.users.banned} banned</span>
          </div>
        </div>
      </div>

      {/* Top uploaders */}
      <div className="rounded-[8px] border border-[rgba(255,255,255,0.06)] bg-[#141414] p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#EF2C58]">Top uploaders (сарын)</span>
          <span className="text-[10px] text-[#555]">{data.topUploaders.length}</span>
        </div>
        {data.topUploaders.length === 0 ? (
          <div className="py-8 text-center text-[12px] text-[#555]">Одоогоор upload хийсэн хүн алга</div>
        ) : (
          <div className="space-y-1.5">
            {data.topUploaders.map((u, i) => {
              const bytes = u.uploadBytesMonth || 0;
              const paid = !!(u.subscriptionExpiresAt && new Date(u.subscriptionExpiresAt) > new Date());
              const cap = paid ? 500 * 1024 * 1024 : 50 * 1024 * 1024;
              const pct = Math.min(100, (bytes / cap) * 100);
              return (
                <div key={u._id} className={`flex items-center gap-2.5 rounded-[6px] px-2 py-1.5 ${u.banned ? "bg-[rgba(239,68,68,0.08)]" : "hover:bg-[rgba(255,255,255,0.03)]"}`}>
                  <span className="w-5 text-center text-[10px] font-black text-[#EF2C58]">{i + 1}</span>
                  {u.avatar ? <img src={u.avatar} alt="" className="h-6 w-6 rounded-full object-cover" /> : <div className="h-6 w-6 rounded-full bg-[rgba(239,44,88,0.1)]" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[12px] font-bold text-[#CCC]">{u.name}</span>
                      {u.banned && <span className="rounded-full bg-[rgba(239,68,68,0.15)] px-1.5 py-0.5 text-[9px] font-black text-[#EF4444]">BANNED</span>}
                      {paid && <span className="rounded-full bg-[rgba(34,197,94,0.12)] px-1.5 py-0.5 text-[9px] font-black text-[#22C55E]">PAID</span>}
                    </div>
                    <div className="truncate text-[10px] text-[#555]">{u.email}</div>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-[rgba(255,255,255,0.04)]">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct > 80 ? "#FFC107" : "#3B82F6" }} />
                      </div>
                      <span className="w-20 text-right text-[10px] font-bold text-[#AAA]">{fmtBytes(bytes)}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {u.banned ? (
                      <button onClick={() => unban(u._id, u.name)} disabled={banningId === u._id}
                        className="rounded-[6px] bg-[rgba(34,197,94,0.1)] px-2.5 py-1 text-[10px] font-bold text-[#22C55E] transition hover:bg-[rgba(34,197,94,0.2)] disabled:opacity-40">Unban</button>
                    ) : (
                      <button onClick={() => ban(u._id, u.name)} disabled={banningId === u._id}
                        className="rounded-[6px] bg-[rgba(239,68,68,0.1)] px-2.5 py-1 text-[10px] font-bold text-[#EF4444] transition hover:bg-[rgba(239,68,68,0.2)] disabled:opacity-40">Ban</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent bans */}
      {data.recentBans.length > 0 && (
        <div className="rounded-[8px] border border-[rgba(255,255,255,0.06)] bg-[#141414] p-5">
          <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[#EF2C58]">Recent bans</div>
          <div className="space-y-1.5">
            {data.recentBans.map((b) => (
              <div key={b._id} className="flex items-center gap-2.5 rounded-[6px] bg-[rgba(239,68,68,0.04)] px-2 py-2">
                {b.avatar ? <img src={b.avatar} alt="" className="h-6 w-6 rounded-full object-cover" /> : <div className="h-6 w-6 rounded-full bg-[rgba(239,68,68,0.1)]" />}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-bold text-[#CCC]">{b.name}</div>
                  <div className="truncate text-[10px] text-[#555]">{b.email} · {relativeDate(b.bannedAt)}</div>
                  {b.bannedReason && <div className="mt-0.5 truncate text-[10px] text-[#EF4444]">{b.bannedReason}</div>}
                </div>
                <button onClick={() => unban(b._id, b.name)} disabled={banningId === b._id}
                  className="rounded-[6px] bg-[rgba(34,197,94,0.1)] px-2.5 py-1 text-[10px] font-bold text-[#22C55E] transition hover:bg-[rgba(34,197,94,0.2)] disabled:opacity-40">Unban</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent signups */}
      <div className="rounded-[8px] border border-[rgba(255,255,255,0.06)] bg-[#141414] p-5">
        <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[#EF2C58]">Recent signups (spot-check)</div>
        <div className="space-y-1">
          {data.recentSignups.slice(0, 15).map((u) => {
            const veryFresh = (Date.now() - new Date(u.createdAt).getTime()) < 60 * 60_000;
            return (
              <div key={u._id} className="flex items-center gap-2.5 rounded-[6px] px-2 py-1.5 hover:bg-[rgba(255,255,255,0.03)]">
                {u.avatar ? <img src={u.avatar} alt="" className="h-6 w-6 rounded-full object-cover" /> : <div className="h-6 w-6 rounded-full bg-[rgba(239,44,88,0.1)]" />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[12px] font-bold text-[#CCC]">{u.name}</span>
                    {veryFresh && <span className="rounded-full bg-[rgba(239,44,88,0.12)] px-1.5 py-0.5 text-[9px] font-black text-[#EF2C58]">NEW</span>}
                  </div>
                  <div className="truncate text-[10px] text-[#555]">{u.email} · {relativeDate(u.createdAt)} · L{u.level || 1}</div>
                </div>
                <button onClick={() => ban(u._id, u.name)} disabled={banningId === u._id}
                  className="rounded-[6px] bg-[rgba(239,68,68,0.1)] px-2.5 py-1 text-[10px] font-bold text-[#EF4444] transition hover:bg-[rgba(239,68,68,0.2)] disabled:opacity-40">Ban</button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Defensive settings explainer */}
      <div className="rounded-[8px] border border-[rgba(255,255,255,0.06)] bg-[#0A0A0A] p-5 text-[11px] leading-relaxed text-[#888]">
        <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#EF2C58]">Идэвхтэй хамгаалалтууд</div>
        <ul className="list-inside list-disc space-y-1">
          <li><span className="font-bold text-[#CCC]">Upload rate</span>: 3/min burst · 5/day free, 30/day paid, 500MB/30d paid, 50MB/30d free</li>
          <li><span className="font-bold text-[#CCC]">Upload file size</span>: 2MB free, 10MB paid</li>
          <li><span className="font-bold text-[#CCC]">Magic byte check</span>: зөвхөн JPEG/PNG/WebP/GIF (header biш real buffer-аас)</li>
          <li><span className="font-bold text-[#CCC]">Sharp concurrency</span>: max 3 зэрэг, 15s queue timeout</li>
          <li><span className="font-bold text-[#CCC]">Signup rate</span>: 3 per IP per hour</li>
          <li><span className="font-bold text-[#CCC]">Post rate</span>: free 3/ц, paid 30/ц (admin unlimited)</li>
          <li><span className="font-bold text-[#CCC]">Disk guard</span>: &lt;500MB free үед ерөнхий upload reject</li>
          <li><span className="font-bold text-[#CCC]">URL safety</span>: post/market external URL-уудад private network/localhost block</li>
        </ul>
      </div>
    </div>
  );
}
