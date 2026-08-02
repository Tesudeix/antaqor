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
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1080CA] border-t-transparent" />
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
        <div className="fixed top-4 right-4 z-50 rounded-none border border-[rgba(255,255,255,0.08)] bg-[#F2F2F4] px-4 py-2.5 text-[13px] text-[#E8E8E8] shadow-xl">
          {flash}
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#E8E8E8]">Credit Economy</h1>
          <p className="mt-0.5 text-[12px] text-[#56565E]">Кредит эдийн засгийн хяналт · Referral metric · гар тохируулга</p>
        </div>
        <Link href="/credits" target="_blank" className="rounded-none bg-[#1080CA] px-4 py-2 text-[12px] font-bold text-[#0E0E10] transition hover:bg-[#4FA8E8]">
          User view
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Эргэлтэнд (баланс)", value: summary.circulating, color: "text-[#1080CA]", hint: `${summary.activeUsers} хэрэглэгч` },
          { label: "Нийт олголт (lifetime)", value: summary.lifetime, color: "text-[#E8E8E8]" },
          { label: "Олголт (30 хоног)", value: summary.earned30d, color: "text-[#1080CA]" },
          { label: "Солилт (30 хоног)", value: summary.spent30d, color: "text-[#1080CA]" },
        ].map((s) => (
          <div key={s.label} className="rounded-none border border-[rgba(255,255,255,0.06)] bg-[#141419] p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#56565E]">{s.label}</div>
            <div className={`mt-1 text-2xl font-bold tabular-nums ${s.color}`}>{s.value.toLocaleString()}</div>
            {s.hint && <div className="mt-0.5 text-[10px] text-[#56565E]">{s.hint}</div>}
          </div>
        ))}
      </div>

      {/* Referral funnel + Reason breakdown */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-none border border-[rgba(255,255,255,0.06)] bg-[#141419] p-5">
          <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[#1080CA]">Referral funnel</div>
          <div className="space-y-2.5">
            {[
              { label: "Нийт урилсан", value: referrals.total, color: "#8A8A92" },
              { label: "Бүртгүүлсэн (+50)", value: referrals.signupAwarded, color: "#1080CA" },
              { label: "Edgerunners-д нэгдсэн (+500)", value: referrals.firstPaymentAwarded, color: "#1080CA" },
            ].map((row) => {
              const pct = referrals.total > 0 ? (row.value / referrals.total) * 100 : 0;
              return (
                <div key={row.label} className="flex items-center gap-3">
                  <span className="w-48 text-[11px] text-[#8A8A92]">{row.label}</span>
                  <div className="h-2 flex-1 rounded-full bg-[rgba(255,255,255,0.05)]">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: row.color }} />
                  </div>
                  <span className="w-14 text-right text-[11px] font-bold tabular-nums text-[#E8E8E8]">{row.value}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-4 rounded-none border border-[rgba(16,128,202,0.15)] bg-[rgba(16,128,202,0.06)] p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#1080CA]">Хөрвүүлэлтийн хувь</div>
            <div className="mt-1 text-[20px] font-black text-[#E8E8E8]">{referralConversion}%</div>
            <div className="text-[10px] text-[#8A8A92]">signup → payment conversion</div>
          </div>
        </div>

        <div className="rounded-none border border-[rgba(255,255,255,0.06)] bg-[#141419] p-5">
          <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[#1080CA]">Reason breakdown</div>
          <div className="space-y-1.5">
            {reasonBreakdown.slice(0, 12).map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px]">
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                    r._id.kind === "earn" ? "bg-[rgba(16,128,202,0.12)] text-[#1080CA]" : "bg-[rgba(16,128,202,0.12)] text-[#1080CA]"
                  }`}
                >
                  {r._id.kind}
                </span>
                <span className="flex-1 text-[#8A8A92]">{REASON_LABELS[r._id.reason] || r._id.reason}</span>
                <span className="text-[#8A8A92]">×{r.count}</span>
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
        <div className="rounded-none border border-[rgba(255,255,255,0.06)] bg-[#141419] p-5">
          <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[#1080CA]">Top — идэвхтэй үлдэгдэл</div>
          <div className="space-y-1.5">
            {topBalances.map((u, i) => (
              <div key={u._id} className="flex items-center gap-2 rounded-none px-2 py-1.5 transition hover:bg-[rgba(255,255,255,0.03)]">
                <span className="w-5 text-center text-[10px] font-black text-[#1080CA]">{i + 1}</span>
                {u.avatar ? <img src={u.avatar} alt="" className="h-6 w-6 rounded-full object-cover" /> : <div className="h-6 w-6 rounded-full bg-[rgba(16,128,202,0.1)]" />}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-bold text-[#8A8A92]">{u.name}</div>
                  <div className="truncate text-[10px] text-[#56565E]">{u.email}</div>
                </div>
                <div className="text-right">
                  <div className="text-[12px] font-bold text-[#1080CA] tabular-nums">{(u.credits || 0).toLocaleString()}</div>
                  {typeof u.referralCount === "number" && u.referralCount > 0 && (
                    <div className="text-[9px] text-[#8A8A92]">{u.referralCount} ref</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-none border border-[rgba(255,255,255,0.06)] bg-[#141419] p-5">
          <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[#1080CA]">Top — нийт хураасан</div>
          <div className="space-y-1.5">
            {topEarners.map((u, i) => (
              <div key={u._id} className="flex items-center gap-2 rounded-none px-2 py-1.5 transition hover:bg-[rgba(255,255,255,0.03)]">
                <span className="w-5 text-center text-[10px] font-black text-[#1080CA]">{i + 1}</span>
                {u.avatar ? <img src={u.avatar} alt="" className="h-6 w-6 rounded-full object-cover" /> : <div className="h-6 w-6 rounded-full bg-[rgba(16,128,202,0.1)]" />}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-bold text-[#8A8A92]">{u.name}</div>
                  <div className="truncate text-[10px] text-[#56565E]">{u.email}</div>
                </div>
                <div className="text-right">
                  <div className="text-[12px] font-bold text-[#1080CA] tabular-nums">{(u.creditsLifetime || 0).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Manual adjust */}
      <div className="rounded-none border border-[rgba(255,255,255,0.06)] bg-[#141419] p-5">
        <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[#1080CA]">Гар тохируулга</div>
        <div className="grid gap-3 sm:grid-cols-[1.4fr_0.8fr_1.4fr_0.6fr]">
          <input
            value={adjustUserId}
            onChange={(e) => setAdjustUserId(e.target.value)}
            placeholder="User ID (mongo _id)"
            className="rounded-none border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2.5 text-[13px] text-[#E8E8E8] placeholder-[#56565E] outline-none focus:border-[#1080CA]"
          />
          <input
            value={adjustAmount}
            onChange={(e) => setAdjustAmount(e.target.value)}
            placeholder="±amount"
            type="number"
            className="rounded-none border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2.5 text-[13px] text-[#E8E8E8] placeholder-[#56565E] outline-none focus:border-[#1080CA]"
          />
          <input
            value={adjustNote}
            onChange={(e) => setAdjustNote(e.target.value)}
            placeholder="Тайлбар (optional)"
            className="rounded-none border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2.5 text-[13px] text-[#E8E8E8] placeholder-[#56565E] outline-none focus:border-[#1080CA]"
          />
          <button
            onClick={doAdjust}
            disabled={!adjustUserId.trim() || !adjustAmount.trim() || adjusting}
            className="rounded-none bg-[#1080CA] px-4 py-2.5 text-[12px] font-bold text-[#0E0E10] transition hover:bg-[#4FA8E8] disabled:opacity-40"
          >
            {adjusting ? "..." : "Тохируулах"}
          </button>
        </div>
        <p className="mt-2 text-[10px] text-[#56565E]">
          Эерэг: олгох. Сөрөг: хасах. Хасах нь ≤0 хүрэхгүй байхаар clamping-тай.
        </p>
      </div>

      {/* Recent transactions */}
      <div className="rounded-none border border-[rgba(255,255,255,0.06)] bg-[#141419] p-5">
        <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[#1080CA]">Сүүлийн гүйлгээ</div>
        <div className="divide-y divide-[rgba(255,255,255,0.04)]">
          {recentTx.map((t) => (
            <div key={t._id} className="flex items-center gap-3 py-2">
              <div className={`h-6 w-6 shrink-0 rounded-full ${t.kind === "earn" ? "bg-[rgba(16,128,202,0.12)]" : "bg-[rgba(16,128,202,0.12)]"} flex items-center justify-center text-[10px] font-black ${t.kind === "earn" ? "text-[#1080CA]" : "text-[#1080CA]"}`}>
                {t.kind === "earn" ? "+" : "−"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-semibold text-[#8A8A92]">
                  {t.user?.name || "—"} · {REASON_LABELS[t.reason] || t.reason}
                </div>
                <div className="truncate text-[10px] text-[#56565E]">{new Date(t.createdAt).toLocaleString("mn-MN")}</div>
              </div>
              <div className={`text-[12px] font-bold tabular-nums ${t.kind === "earn" ? "text-[#1080CA]" : "text-[#1080CA]"}`}>
                {t.kind === "earn" ? "+" : "−"}{t.amount}
              </div>
            </div>
          ))}
          {recentTx.length === 0 && <div className="py-8 text-center text-[12px] text-[#56565E]">Гүйлгээ байхгүй</div>}
        </div>
      </div>
    </div>
  );
}
