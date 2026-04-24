"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";

interface HistoryEntry {
  _id: string;
  kind: "earn" | "spend";
  amount: number;
  reason: string;
  xpAwarded: number;
  ref?: string;
  balanceAfter: number;
  createdAt: string;
  meta?: { days?: number; channel?: string; note?: string };
}

interface Referral {
  referee: { _id: string; name: string; avatar?: string; isPaid: boolean } | null;
  signupAt: string;
  firstPaymentAt?: string;
  awarded: { signup: boolean; firstPayment: boolean };
}

interface RedeemOption {
  credits: number;
  days: number;
  label: string;
  note?: string;
}

interface Payload {
  balance: number;
  lifetime: number;
  referralCount: number;
  referralCode: string;
  history: HistoryEntry[];
  referrals: Referral[];
  redeemOptions: RedeemOption[];
}

const REASON_LABELS: Record<string, string> = {
  SIGNUP_BONUS: "Тавтай морил бонус",
  REFERRAL_SIGNUP: "Найз бүртгүүлсэн",
  REFERRAL_PAID: "Найз нэгдсэн",
  SHARE_POST: "Пост хуваалцсан",
  SHARE_NEWS: "Мэдээ хуваалцсан",
  POST_CREATE: "Пост нийтэлсэн",
  LIKE_RECEIVED: "Лайк авсан",
  DAILY_LOGIN: "Өдөр тутмын нэвтрэлт",
  REDEEM_MEMBERSHIP: "Гишүүнчлэл рүү сольсон",
  ADMIN_ADJUST: "Админ тохируулга",
};

function relativeDate(iso: string): string {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60_000);
  if (m < 1) return "сая";
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ц`;
  const dd = Math.floor(h / 24);
  if (dd < 7) return `${dd} өдөр`;
  return new Date(iso).toLocaleDateString("mn-MN", { month: "short", day: "numeric" });
}

export default function CreditsPage() {
  const { status } = useSession();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState<number | null>(null);
  const [flash, setFlash] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/credits");
      if (!res.ok) return;
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") load();
    else if (status === "unauthenticated") setLoading(false);
  }, [status, load]);

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#EF2C58] border-t-transparent" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <h2 className="text-[22px] font-bold text-[#E8E8E8]">Нэвтрэх шаардлагатай</h2>
        <p className="mt-2 text-[13px] text-[#666]">Кредит, найзыг урих дэд самбарт хандахын тулд нэвтэрнэ үү.</p>
        <Link href="/auth/signin" className="mt-6 inline-block rounded-[8px] bg-[#EF2C58] px-6 py-3 text-[13px] font-bold text-white">
          Нэвтрэх
        </Link>
      </div>
    );
  }

  if (!data) return null;

  const inviteUrl = typeof window !== "undefined"
    ? `${window.location.origin}/auth/signup?ref=${data.referralCode}`
    : `https://antaqor.com/auth/signup?ref=${data.referralCode}`;

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const shareInvite = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Antaqor — AI бүтээгчдийн нийгэмлэг",
          text: "Antaqor нэгдэхэд +50 кредит авч эхлэ",
          url: inviteUrl,
        });
      } else {
        await copyInvite();
      }
    } catch {
      /* ignore */
    }
  };

  const redeem = async (optionIndex: number) => {
    if (redeeming !== null) return;
    const opt = data.redeemOptions[optionIndex];
    if (!opt) return;
    if (data.balance < opt.credits) {
      setFlash(`${opt.credits - data.balance} кредит дутуу байна`);
      setTimeout(() => setFlash(""), 2500);
      return;
    }
    if (!confirm(`${opt.credits} кредит → ${opt.days} хоногийн гишүүнчлэл? Энэ үйлдэл буцаах боломжгүй.`)) return;
    setRedeeming(optionIndex);
    try {
      const res = await fetch("/api/credits/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionIndex }),
      });
      const json = await res.json();
      if (!res.ok) {
        setFlash("Алдаа: " + (json.error || "redeem failed"));
        setTimeout(() => setFlash(""), 3000);
        return;
      }
      setFlash(`${opt.days} хоногийн гишүүнчлэл идэвхжлээ!`);
      setTimeout(() => setFlash(""), 3500);
      load();
    } finally {
      setRedeeming(null);
    }
  };

  const nextRedemption = data.redeemOptions.find((o) => o.credits > data.balance);
  const affordable = data.redeemOptions.find((o) => o.credits <= data.balance);
  const progressTarget = nextRedemption?.credits || (affordable?.credits || 1000);
  const progressPct = Math.min(100, (data.balance / progressTarget) * 100);

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-10">
      {flash && (
        <div className="fixed top-4 right-4 z-50 rounded-[8px] border border-[rgba(255,255,255,0.08)] bg-[#1A1A1A] px-4 py-2.5 text-[13px] text-[#E8E8E8] shadow-xl">
          {flash}
        </div>
      )}

      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <div className="h-[2px] w-5 bg-[#EF2C58]" />
          <span className="text-[11px] font-bold tracking-[0.2em] text-[#EF2C58]">CREDITS · REFERRAL</span>
        </div>
        <h1 className="mt-2 text-[26px] font-black leading-tight tracking-tight text-[#E8E8E8] md:text-[32px]">
          Найзаа урьж, гишүүнчлэлээ <span className="text-[#EF2C58]">үнэгүй</span> авч болно
        </h1>
        <p className="mt-1.5 max-w-xl text-[13px] text-[#666]">
          2 найз Cyber Empire-д нэгдэхэд 1 сарын гишүүнчлэл үнэгүй. Зөвхөн найз урьснаас гадна пост/мэдээ хуваалцаж ч кредит хуримтлуулах боломжтой.
        </p>
      </div>

      {/* Balance + referral widgets */}
      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        {/* Balance card */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-[8px] border border-[rgba(239,44,88,0.2)] bg-gradient-to-br from-[rgba(239,44,88,0.08)] via-[#111] to-[#0D0D0D] p-5"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#EF2C58]">Миний үлдэгдэл</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-[42px] font-black leading-none text-[#E8E8E8]">
                  {data.balance.toLocaleString()}
                </span>
                <span className="text-[13px] font-semibold text-[#666]">кредит</span>
              </div>
              <div className="mt-1 text-[11px] text-[#555]">
                Нийт: {data.lifetime.toLocaleString()} · {data.referralCount} урилгатай
              </div>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[rgba(239,44,88,0.12)]">
              <svg className="h-6 w-6 text-[#EF2C58]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
          </div>

          {/* Progress to next redemption */}
          {nextRedemption && (
            <div className="mt-5">
              <div className="mb-1.5 flex items-center justify-between text-[11px]">
                <span className="text-[#999]">
                  Дараагийн солилт: <span className="font-bold text-[#E8E8E8]">{nextRedemption.label}</span>
                </span>
                <span className="font-bold text-[#EF2C58]">{data.balance} / {nextRedemption.credits}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[rgba(255,255,255,0.05)]">
                <motion.div
                  className="h-full bg-gradient-to-r from-[#EF2C58] to-[#ff6685]"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPct}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
            </div>
          )}

          {/* Redeem buttons */}
          <div className="mt-5">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#555]">Гишүүнчлэл рүү солих</div>
            <div className="grid grid-cols-3 gap-2">
              {data.redeemOptions.map((opt, i) => {
                const canAfford = data.balance >= opt.credits;
                return (
                  <button
                    key={opt.credits}
                    onClick={() => redeem(i)}
                    disabled={!canAfford || redeeming !== null}
                    className={`relative rounded-[6px] border px-3 py-3 text-left transition ${
                      canAfford
                        ? "border-[rgba(239,44,88,0.3)] bg-[rgba(239,44,88,0.08)] hover:bg-[rgba(239,44,88,0.15)]"
                        : "border-[rgba(255,255,255,0.06)] bg-[#0A0A0A] opacity-60"
                    } disabled:cursor-not-allowed`}
                  >
                    {opt.note && (
                      <span className="absolute -top-1.5 right-1.5 rounded-full bg-[#EF2C58] px-1.5 py-0.5 text-[8px] font-black text-white">
                        {opt.note}
                      </span>
                    )}
                    <div className="text-[14px] font-black text-[#E8E8E8]">{opt.label}</div>
                    <div className={`mt-0.5 text-[11px] font-bold ${canAfford ? "text-[#EF2C58]" : "text-[#555]"}`}>
                      {redeeming === i ? "..." : `${opt.credits} кредит`}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </motion.div>

        {/* Referral share card */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-[8px] border border-[rgba(255,255,255,0.06)] bg-[#111] p-5"
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#EF2C58]">Миний урилгын холбоос</div>
            <span className="rounded-full bg-[rgba(255,255,255,0.04)] px-2 py-0.5 text-[9px] font-bold text-[#999]">
              {data.referralCode.toUpperCase()}
            </span>
          </div>

          <div className="flex items-center gap-2 rounded-[6px] border border-[rgba(255,255,255,0.06)] bg-[#0A0A0A] p-2">
            <input
              readOnly
              value={inviteUrl}
              className="flex-1 bg-transparent text-[11px] text-[#AAA] outline-none"
              onFocus={(e) => e.currentTarget.select()}
            />
            <button
              onClick={copyInvite}
              className="rounded-[4px] bg-[#EF2C58] px-3 py-1.5 text-[10px] font-bold text-white transition hover:bg-[#D4264E]"
            >
              {copied ? "Хуулсан" : "Хуулах"}
            </button>
          </div>

          <button
            onClick={shareInvite}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-[6px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] py-2.5 text-[12px] font-bold text-[#AAA] transition hover:border-[rgba(239,44,88,0.3)] hover:text-[#EF2C58]"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
            Хуваалцах
          </button>

          <div className="mt-5 space-y-2 rounded-[6px] bg-[#0A0A0A] p-3">
            <div className="flex items-center gap-2 text-[12px]">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[rgba(34,197,94,0.15)] text-[10px] font-black text-[#22C55E]">1</span>
              <span className="text-[#CCC]">Холбоосоор найз бүртгүүлбэл</span>
              <span className="ml-auto text-[11px] font-bold text-[#22C55E]">+50</span>
            </div>
            <div className="flex items-center gap-2 text-[12px]">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[rgba(239,44,88,0.15)] text-[10px] font-black text-[#EF2C58]">2</span>
              <span className="text-[#CCC]">Найз Cyber Empire-д нэгдэхэд</span>
              <span className="ml-auto text-[11px] font-bold text-[#EF2C58]">+500</span>
            </div>
            <div className="flex items-center gap-2 text-[12px]">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[rgba(168,85,247,0.15)] text-[10px] font-black text-[#A855F7]">↻</span>
              <span className="text-[#CCC]">Пост/мэдээ хуваалцах бүрт</span>
              <span className="ml-auto text-[11px] font-bold text-[#A855F7]">+3</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Referrals list */}
      {data.referrals.length > 0 && (
        <div className="rounded-[8px] border border-[rgba(255,255,255,0.06)] bg-[#111] p-5">
          <div className="mb-3 flex items-center gap-2">
            <div className="h-[2px] w-4 bg-[#22C55E]" />
            <span className="text-[11px] font-bold tracking-[0.12em] text-[#E8E8E8]">МИНИЙ УРИЛСАН</span>
            <span className="text-[10px] text-[#555]">({data.referrals.length})</span>
          </div>
          <div className="space-y-2">
            {data.referrals.map((r, i) => r.referee && (
              <div key={i} className="flex items-center gap-3 rounded-[6px] bg-[#0A0A0A] p-3">
                {r.referee.avatar ? (
                  <img src={r.referee.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(239,44,88,0.1)] text-[12px] font-bold text-[#EF2C58]">
                    {r.referee.name.charAt(0)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-bold text-[#E8E8E8]">{r.referee.name}</div>
                  <div className="text-[10px] text-[#555]">Бүртгүүлсэн: {relativeDate(r.signupAt)}</div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {r.awarded.signup && (
                    <span className="rounded-full bg-[rgba(34,197,94,0.1)] px-2 py-0.5 text-[9px] font-bold text-[#22C55E]">
                      +50 ✓
                    </span>
                  )}
                  {r.awarded.firstPayment ? (
                    <span className="rounded-full bg-[rgba(239,44,88,0.12)] px-2 py-0.5 text-[9px] font-bold text-[#EF2C58]">
                      +500 ✓
                    </span>
                  ) : r.referee.isPaid ? (
                    <span className="rounded-full bg-[rgba(255,255,255,0.04)] px-2 py-0.5 text-[9px] font-bold text-[#666]">
                      processing
                    </span>
                  ) : (
                    <span className="rounded-full border border-dashed border-[rgba(239,44,88,0.3)] px-2 py-0.5 text-[9px] font-bold text-[#EF2C58]">
                      +500 хүлээгдэж буй
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transaction history */}
      <div className="rounded-[8px] border border-[rgba(255,255,255,0.06)] bg-[#111] p-5">
        <div className="mb-3 flex items-center gap-2">
          <div className="h-[2px] w-4 bg-[#EF2C58]" />
          <span className="text-[11px] font-bold tracking-[0.12em] text-[#E8E8E8]">ГҮЙЛГЭЭНИЙ ТҮҮХ</span>
        </div>
        {data.history.length === 0 ? (
          <div className="py-8 text-center text-[12px] text-[#555]">Гүйлгээ алга байна</div>
        ) : (
          <div className="divide-y divide-[rgba(255,255,255,0.04)]">
            {data.history.map((h) => (
              <div key={h._id} className="flex items-center gap-3 py-2.5">
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                    h.kind === "earn" ? "bg-[rgba(34,197,94,0.1)]" : "bg-[rgba(239,44,88,0.1)]"
                  }`}
                >
                  <svg
                    className={`h-3.5 w-3.5 ${h.kind === "earn" ? "text-[#22C55E]" : "text-[#EF2C58]"}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d={h.kind === "earn" ? "M12 6v12m6-6H6" : "M6 12h12"} />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-semibold text-[#CCC]">
                    {REASON_LABELS[h.reason] || h.reason}
                  </div>
                  <div className="text-[10px] text-[#555]">
                    {relativeDate(h.createdAt)}
                    {h.meta?.days && ` · ${h.meta.days} хоног`}
                    {h.xpAwarded > 0 && ` · +${h.xpAwarded} XP`}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-[13px] font-bold ${h.kind === "earn" ? "text-[#22C55E]" : "text-[#EF2C58]"}`}>
                    {h.kind === "earn" ? "+" : "−"}{h.amount}
                  </div>
                  <div className="text-[9px] text-[#555]">үлд: {h.balanceAfter}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
