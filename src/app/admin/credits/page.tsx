"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface Summary {
  circulating: number;
  lifetime: number;
  activeUsers: number;
  earned: number;
  spent: number;
  earned30d: number;
  spent30d: number;
}

interface ReferralStats {
  total: number;
  signupAwarded: number;
  firstPaymentAwarded: number;
}

interface ReasonRow {
  _id: { reason: string; kind: "earn" | "spend" };
  total: number;
  count: number;
}

interface TopUser {
  _id: string;
  name: string;
  email?: string;
  avatar?: string;
  credits?: number;
  creditsLifetime?: number;
  referralCount?: number;
}

interface Tx {
  _id: string;
  kind: "earn" | "spend";
  amount: number;
  reason: string;
  balanceAfter: number;
  createdAt: string;
  user: { _id: string; name: string; email?: string; avatar?: string } | null;
}

interface Payload {
  summary: Summary;
  referrals: ReferralStats;
  reasonBreakdown: ReasonRow[];
  topBalances: TopUser[];
  topEarners: TopUser[];
  recentTx: Tx[];
}

const REASON_LABELS: Record<string, string> = {
  SIGNUP_BONUS: "Welcome",
  REFERRAL_SIGNUP: "Ref · signup",
  REFERRAL_PAID: "Ref · paid",
  SHARE_POST: "Share post",
  SHARE_NEWS: "Share news",
  POST_CREATE: "Post created",
  LIKE_RECEIVED: "Like received",
  DAILY_LOGIN: "Daily login",
  REDEEM_MEMBERSHIP: "Redeem",
  ADMIN_ADJUST: "Admin adjust",
};

export default function AdminCreditsPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [adjustUserId, setAdjustUserId] = useState("");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  const [flash, setFlash] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/credits");
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const doAdjust = async () => {
    if (!adjustUserId.trim() || !adjustAmount.trim()) return;
    setAdjusting(true);
    try {
      const res = await fetch("/api/admin/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: adjustUserId.trim(),
          amount: Number(adjustAmount),
          note: adjustNote.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setFlash("Алдаа: " + (json.error || "failed"));
      } else {
        setFlash(`Тохируулга амжилттай. Шинэ үлдэгдэл: ${json.balance}`);
        setAdjustUserId(""); setAdjustAmount(""); setAdjustNote("");
        load();
      }
    } finally {
      setAdjusting(false);
      setTimeout(() => setFlash(""), 4000);
    }
  };

  if (loading || !data) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#EF2C58] border-t-transparent" />
      </div>
    );
  }

  const { summary, referrals, reasonBreakdown, topBalances, topEarners, recentTx } = data;

  const referralConversion = referrals.total > 0
    ? ((referrals.firstPaymentAwarded / referrals.total) * 100).toFixed(1)
    : "0.0";

  return (
    <div className="space-y-5 pb-6">
      {flash && (
        <div className="fixed top-4 right-4 z-50 rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#1A1A1A] px-4 py-2.5 text-[13px] text-[#E8E8E8] shadow-xl">
          {flash}
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#E8E8E8]">Credit Economy</h1>
          <p className="mt-0.5 text-[12px] text-[#555]">Кредит эдийн засгийн хяналт · Referral metric · гар тохируулга</p>
        </div>
        <Link href="/credits" target="_blank" className="rounded-[4px] bg-[#EF2C58] px-4 py-2 text-[12px] font-bold text-white transition hover:bg-[#D4264E]">
          User view
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Эргэлтэнд (баланс)", value: summary.circulating, color: "text-[#EF2C58]", hint: `${summary.activeUsers} хэрэглэгч` },
          { label: "Нийт олголт (lifetime)", value: summary.lifetime, color: "text-[#E8E8E8]" },
          { label: "Олголт (30 хоног)", value: summary.earned30d, color: "text-[#EF2C58]" },
          { label: "Солилт (30 хоног)", value: summary.spent30d, color: "text-[#A855F7]" },
        ].map((s) => (
          <div key={s.label} className="rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#141414] p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#555]">{s.label}</div>
            <div className={`mt-1 text-2xl font-bold tabular-nums ${s.color}`}>{s.value.toLocaleString()}</div>
            {s.hint && <div className="mt-0.5 text-[10px] text-[#555]">{s.hint}</div>}
          </div>
        ))}
      </div>

      {/* Referral funnel + Reason breakdown */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#141414] p-5">
          <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[#EF2C58]">Referral funnel</div>
          <div className="space-y-2.5">
            {[
              { label: "Нийт урилсан", value: referrals.total, color: "#888" },
              { label: "Бүртгүүлсэн (+50)", value: referrals.signupAwarded, color: "#EF2C58" },
              { label: "Cyber Empire-д нэгдсэн (+500)", value: referrals.firstPaymentAwarded, color: "#EF2C58" },
            ].map((row) => {
              const pct = referrals.total > 0 ? (row.value / referrals.total) * 100 : 0;
              return (
                <div key={row.label} className="flex items-center gap-3">
                  <span className="w-48 text-[11px] text-[#AAA]">{row.label}</span>
                  <div className="h-2 flex-1 rounded-full bg-[rgba(255,255,255,0.05)]">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: row.color }} />
                  </div>
                  <span className="w-14 text-right text-[11px] font-bold tabular-nums text-[#E8E8E8]">{row.value}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-4 rounded-[4px] border border-[rgba(239,44,88,0.15)] bg-[rgba(239,44,88,0.06)] p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#EF2C58]">Хөрвүүлэлтийн хувь</div>
            <div className="mt-1 text-[20px] font-black text-[#E8E8E8]">{referralConversion}%</div>
            <div className="text-[10px] text-[#666]">signup → payment conversion</div>
          </div>
        </div>

        <div className="rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#141414] p-5">
          <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[#EF2C58]">Reason breakdown</div>
          <div className="space-y-1.5">
            {reasonBreakdown.slice(0, 12).map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px]">
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                    r._id.kind === "earn" ? "bg-[rgba(239,44,88,0.12)] text-[#EF2C58]" : "bg-[rgba(239,44,88,0.12)] text-[#EF2C58]"
                  }`}
                >
                  {r._id.kind}
                </span>
                <span className="flex-1 text-[#CCC]">{REASON_LABELS[r._id.reason] || r._id.reason}</span>
                <span className="text-[#666]">×{r.count}</span>
                <span className="w-16 text-right font-bold tabular-nums text-[#E8E8E8]">
                  {r.total.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top users */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#141414] p-5">
          <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[#EF2C58]">Top — идэвхтэй үлдэгдэл</div>
          <div className="space-y-1.5">
            {topBalances.map((u, i) => (
              <div key={u._id} className="flex items-center gap-2 rounded-[4px] px-2 py-1.5 transition hover:bg-[rgba(255,255,255,0.03)]">
                <span className="w-5 text-center text-[10px] font-black text-[#EF2C58]">{i + 1}</span>
                {u.avatar ? <img src={u.avatar} alt="" className="h-6 w-6 rounded-full object-cover" /> : <div className="h-6 w-6 rounded-full bg-[rgba(239,44,88,0.1)]" />}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-bold text-[#CCC]">{u.name}</div>
                  <div className="truncate text-[10px] text-[#555]">{u.email}</div>
                </div>
                <div className="text-right">
                  <div className="text-[12px] font-bold text-[#EF2C58] tabular-nums">{(u.credits || 0).toLocaleString()}</div>
                  {typeof u.referralCount === "number" && u.referralCount > 0 && (
                    <div className="text-[9px] text-[#666]">{u.referralCount} ref</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#141414] p-5">
          <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[#EF2C58]">Top — нийт хураасан</div>
          <div className="space-y-1.5">
            {topEarners.map((u, i) => (
              <div key={u._id} className="flex items-center gap-2 rounded-[4px] px-2 py-1.5 transition hover:bg-[rgba(255,255,255,0.03)]">
                <span className="w-5 text-center text-[10px] font-black text-[#EF2C58]">{i + 1}</span>
                {u.avatar ? <img src={u.avatar} alt="" className="h-6 w-6 rounded-full object-cover" /> : <div className="h-6 w-6 rounded-full bg-[rgba(239,44,88,0.1)]" />}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-bold text-[#CCC]">{u.name}</div>
                  <div className="truncate text-[10px] text-[#555]">{u.email}</div>
                </div>
                <div className="text-right">
                  <div className="text-[12px] font-bold text-[#EF2C58] tabular-nums">{(u.creditsLifetime || 0).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Manual adjust */}
      <div className="rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#141414] p-5">
        <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[#EF2C58]">Гар тохируулга</div>
        <div className="grid gap-3 sm:grid-cols-[1.4fr_0.8fr_1.4fr_0.6fr]">
          <input
            value={adjustUserId}
            onChange={(e) => setAdjustUserId(e.target.value)}
            placeholder="User ID (mongo _id)"
            className="rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2.5 text-[13px] text-[#E8E8E8] placeholder-[#444] outline-none focus:border-[#EF2C58]"
          />
          <input
            value={adjustAmount}
            onChange={(e) => setAdjustAmount(e.target.value)}
            placeholder="±amount"
            type="number"
            className="rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2.5 text-[13px] text-[#E8E8E8] placeholder-[#444] outline-none focus:border-[#EF2C58]"
          />
          <input
            value={adjustNote}
            onChange={(e) => setAdjustNote(e.target.value)}
            placeholder="Тайлбар (optional)"
            className="rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2.5 text-[13px] text-[#E8E8E8] placeholder-[#444] outline-none focus:border-[#EF2C58]"
          />
          <button
            onClick={doAdjust}
            disabled={!adjustUserId.trim() || !adjustAmount.trim() || adjusting}
            className="rounded-[4px] bg-[#EF2C58] px-4 py-2.5 text-[12px] font-bold text-white transition hover:bg-[#D4264E] disabled:opacity-40"
          >
            {adjusting ? "..." : "Тохируулах"}
          </button>
        </div>
        <p className="mt-2 text-[10px] text-[#555]">
          Эерэг: олгох. Сөрөг: хасах. Хасах нь ≤0 хүрэхгүй байхаар clamping-тай.
        </p>
      </div>

      {/* Recent transactions */}
      <div className="rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#141414] p-5">
        <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[#EF2C58]">Сүүлийн гүйлгээ</div>
        <div className="divide-y divide-[rgba(255,255,255,0.04)]">
          {recentTx.map((t) => (
            <div key={t._id} className="flex items-center gap-3 py-2">
              <div className={`h-6 w-6 shrink-0 rounded-full ${t.kind === "earn" ? "bg-[rgba(239,44,88,0.12)]" : "bg-[rgba(239,44,88,0.12)]"} flex items-center justify-center text-[10px] font-black ${t.kind === "earn" ? "text-[#EF2C58]" : "text-[#EF2C58]"}`}>
                {t.kind === "earn" ? "+" : "−"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-semibold text-[#CCC]">
                  {t.user?.name || "—"} · {REASON_LABELS[t.reason] || t.reason}
                </div>
                <div className="truncate text-[10px] text-[#555]">{new Date(t.createdAt).toLocaleString("mn-MN")}</div>
              </div>
              <div className={`text-[12px] font-bold tabular-nums ${t.kind === "earn" ? "text-[#EF2C58]" : "text-[#EF2C58]"}`}>
                {t.kind === "earn" ? "+" : "−"}{t.amount}
              </div>
            </div>
          ))}
          {recentTx.length === 0 && <div className="py-8 text-center text-[12px] text-[#555]">Гүйлгээ байхгүй</div>}
        </div>
      </div>
    </div>
  );
}
