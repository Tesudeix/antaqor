"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import Testimonials from "@/components/Testimonials";

const BANK_ACCOUNT = "5926153085";
const BANK_NAME = "Хаан банк";
const BANK_RECIPIENT = "Баянбилэг Дамбадаржаа";

function formatMNT(n: number) {
  return n.toLocaleString("mn-MN");
}

// ─── Single Tier ───
const CYBER_EMPIRE = {
  id: "entry",
  name: "Cyber Empire",
  price: 49000,
  period: "/сар",
  tagline: "AI бүтээгчдийн нийгэмлэгт нэгдэх",
  features: [
    { text: "Бүх постыг хязгааргүй үзэх", included: true },
    { text: "Бүх хичээл — promt, agent, automation", included: true },
    { text: "Хязгааргүй пост + image upload (10MB)", included: true },
    { text: "Telegram чат хандалт", included: true },
    { text: "1.5× XP multiplier — level-ээ хурдлуул", included: true },
    { text: "Credit эдийн засагт бүрэн оролцох", included: true },
    { text: "Market listing + 20% fee зөвхөн", included: true },
    { text: "Шинэ feature эрт хандалт", included: true },
  ],
  cta: "Нэгдэх",
  color: "#EF2C58",
};

type Step = "pricing" | "payment" | "pending";

interface PaymentState {
  _id?: string;
  status?: "pending" | "paid" | "failed";
  referenceCode?: string;
  amount?: number;
  receiptImage?: string;
  adminNote?: string;
}

export default function ClanPage() {
  const { data: session } = useSession();
  const [isMember, setIsMember] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // New payment-flow state
  const [step, setStep] = useState<Step>("pricing");
  const [payment, setPayment] = useState<PaymentState>({});

  useEffect(() => {
    checkMembership();
  }, [session]);

  useEffect(() => {
    if (session && !isMember && !loading) {
      const params = new URLSearchParams(window.location.search);
      if (params.get("pay") === "1") {
        handleJoin();
      }
    }
  }, [session, isMember, loading]);

  // Poll payment status while on pending step
  useEffect(() => {
    if (step !== "pending") return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch("/api/clan/payment-status");
        const data = await res.json();
        if (cancelled) return;
        if (data.payment) {
          setPayment({
            _id: data.payment._id,
            status: data.payment.status,
            referenceCode: data.payment.referenceCode,
            amount: data.payment.amount,
            receiptImage: data.payment.receiptImage,
            adminNote: data.payment.adminNote,
          });
          if (data.payment.status === "paid") {
            checkMembership();
          }
        }
      } catch {
        /* ignore */
      }
    };
    poll();
    const t = setInterval(poll, 10_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [step]);

  const checkMembership = async () => {
    try {
      const res = await fetch("/api/clan/status");
      const data = await res.json();
      setIsMember(data.isMember);
    } finally {
      setLoading(false);
    }
  };

  const tier = CYBER_EMPIRE;
  const displayPrice = formatMNT(tier.price);

  const handleJoin = async () => {
    if (!session) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/clan/join", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setUserEmail(data.email || session.user?.email || "");
        setPayment({
          _id: data.paymentId,
          status: data.status,
          referenceCode: data.referenceCode,
          amount: data.amount,
        });
        setShowPayment(true);
        // Always land on the payment step — user must SEE bank info to actually transfer.
        // They advance to "pending" themselves by clicking "Шилжүүллээ" after sending.
        setStep("payment");
      }
    } catch { /* ignore */ }
    finally { setSubmitting(false); }
  };

  const handleTransferred = () => {
    // User says they've done the transfer — go straight to pending; admin auto-matches via SMS reference code.
    setStep("pending");
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-2 w-2 animate-pulse rounded-[4px] bg-[#EF2C58]" />
      </div>
    );
  }

  // ─── Step: pending approval (after receipt uploaded OR if they're coming back) ───
  if (showPayment && session && step === "pending") {
    const status = payment.status || "pending";
    return (
      <div className="mx-auto max-w-md py-4">
        <AnimatePresence mode="wait">
          {status === "paid" ? (
            <motion.div
              key="paid"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex min-h-[60vh] flex-col items-center justify-center text-center"
            >
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#22C55E] shadow-[0_0_40px_rgba(34,197,94,0.3)]">
                <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-[24px] font-black text-[#E8E8E8]">Идэвхжлээ!</h1>
              <p className="mt-2 max-w-sm text-[13px] text-[#888]">
                Cyber Empire-д тавтай морил. Бүх контент одоо нээлттэй.
              </p>
              <div className="mt-6 flex gap-3">
                <Link href="/classroom" className="rounded-[8px] bg-[#EF2C58] px-5 py-2.5 text-[13px] font-bold text-white">Хичээл</Link>
                <Link href="/" className="rounded-[8px] border border-[rgba(255,255,255,0.08)] px-5 py-2.5 text-[13px] font-bold text-[#AAA]">Feed</Link>
              </div>
            </motion.div>
          ) : status === "failed" ? (
            <motion.div key="failed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-[8px] border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.06)] p-5 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(239,68,68,0.15)]">
                <svg className="h-6 w-6 text-[#EF4444]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" /></svg>
              </div>
              <h2 className="text-[17px] font-bold text-[#E8E8E8]">Төлбөр шалгагдсангүй</h2>
              {payment.adminNote && <p className="mt-1 text-[12px] text-[#EF4444]">{payment.adminNote}</p>}
              <p className="mt-2 text-[12px] text-[#888]">Дахин шилжүүлж баримт оруулна уу.</p>
              <button onClick={() => { setStep("payment"); }} className="mt-4 rounded-[8px] bg-[#EF2C58] px-5 py-2.5 text-[13px] font-bold text-white">Дахин оролдох</button>
            </motion.div>
          ) : (
            <motion.div key="pending" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <button
                onClick={() => setStep("payment")}
                className="mb-3 inline-flex items-center gap-1 text-[11px] text-[#666] transition hover:text-[#EF2C58]"
              >
                ← Банкны мэдээлэл харах
              </button>
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-[#FFC107]" />
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#FFC107]">ХҮЛЭЭЖ БАЙНА</span>
              </div>
              <h1 className="text-[22px] font-black leading-tight text-[#E8E8E8]">Төлбөрийг шалгаж байна</h1>
              <p className="mt-1.5 text-[13px] text-[#888]">
                Ердийн нөхцөлд <strong className="text-[#E8E8E8]">5–15 минутад</strong> идэвхжинэ. Энэ хуудсыг хаасан ч гэсэн идэвхжсэний мэдэгдэл утас/имэйлд ирнэ.
              </p>

              {payment.receiptImage && (
                <a href={payment.receiptImage} target="_blank" rel="noopener noreferrer" className="mt-4 block overflow-hidden rounded-[8px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A]">
                  <img src={payment.receiptImage} alt="Receipt" className="h-full w-full object-contain max-h-[280px]" />
                </a>
              )}

              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between rounded-[8px] border border-[rgba(255,255,255,0.08)] bg-[#141414] px-4 py-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-[#666]">Код</div>
                    <div className="mt-0.5 text-[16px] font-black tracking-[0.1em] text-[#EF2C58]">
                      {payment.referenceCode || "—"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wider text-[#666]">Дүн</div>
                    <div className="mt-0.5 text-[14px] font-bold text-[#E8E8E8]">₮{(payment.amount || tier.price).toLocaleString()}</div>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-[8px] border border-[rgba(255,255,255,0.06)] bg-[#0F0F0F] px-4 py-3 text-[11px]">
                  <span className="text-[#666]">Статус 10 сек тутам шалгана</span>
                  <div className="flex items-center gap-1.5 text-[#AAA]">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#22C55E]" />
                    <span>live</span>
                  </div>
                </div>
              </div>

              {/* Stronger contact fallback — most common reason for "stuck pending" is wrong reference code */}
              <div className="mt-4 rounded-[8px] border border-[rgba(255,255,255,0.08)] bg-[#0F0F0F] p-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#FFB020]">
                  30 минутаас удвал
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-[#888]">
                  Гүйлгээний утганд код буруу бичсэн байж болзошгүй. Гүйлгээний баримтын screenshot-г илгээ:
                </p>
                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  <a
                    href="tel:94641031"
                    className="flex items-center justify-center gap-1.5 rounded-[6px] border border-[rgba(255,255,255,0.08)] bg-[#141414] px-3 py-2 text-[12px] font-bold text-[#EF2C58] transition hover:border-[rgba(239,44,88,0.4)]"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                    </svg>
                    94641031
                  </a>
                  <a
                    href="mailto:antaqor@gmail.com?subject=Төлбөр идэвхжээгүй"
                    className="flex items-center justify-center gap-1.5 rounded-[6px] border border-[rgba(255,255,255,0.08)] bg-[#141414] px-3 py-2 text-[12px] font-bold text-[#EF2C58] transition hover:border-[rgba(239,44,88,0.4)]"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                    Имэйл
                  </a>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Already a member
  if (isMember) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[4px] bg-[#EF2C58]">
          <svg className="h-7 w-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-[22px] font-bold text-[#E8E8E8]">Та аль хэдийн гишүүн</h1>
        <p className="mt-2 max-w-sm text-[13px] text-[#666666]">
          Бүх сургалт, challenge, нийгэмлэгт бүрэн хандалттай.
        </p>
        <div className="mt-6 flex gap-3">
          <Link href="/classroom" className="rounded-[4px] bg-[#EF2C58] px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#D4264E]">
            Хичээл үзэх
          </Link>
          <Link href="/" className="rounded-[4px] border border-[rgba(255,255,255,0.08)] px-5 py-2.5 text-[13px] font-medium text-[#666666] transition hover:text-[#E8E8E8]">
            Нүүр
          </Link>
        </div>
      </div>
    );
  }

  // Show payment flow (bank details + "Төлбөр шилжүүлсэн" button)
  if (showPayment && session && step === "payment") {
    return (
      <div className="mx-auto max-w-md">
        <div className="pb-4 pt-2">
          <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#EF2C58]">Сүүлийн алхам</div>
          <h1 className="text-[22px] font-bold text-[#E8E8E8]">Төлбөр төлж гишүүн болох</h1>
          <p className="mt-1 text-[13px] text-[#666666]">
            {tier.name} — <span className="font-bold text-[#EF2C58]">₮{displayPrice}{tier.period}</span>
          </p>
        </div>

        {/* QPay QR */}
        <div className="mb-4 flex justify-center">
          <div className="rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#141414] p-3">
            <Image src="/qpay.png" alt="QPay QR" width={200} height={200} className="h-[200px] w-[200px] object-contain" />
          </div>
        </div>
        <p className="mb-4 text-center text-[12px] font-medium text-[#666666]">QPay / Банкны апп-аар QR уншуулах</p>

        {/* Transfer info */}
        <div className="divide-y divide-[rgba(255,255,255,0.06)] rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#141414] overflow-hidden">
          <PayRow label="Банк" value={BANK_NAME} copyText={BANK_NAME} field="bank" copied={copied} onCopy={copyToClipboard} />
          <PayRow label="Данс" value={BANK_ACCOUNT} copyText={BANK_ACCOUNT} field="account" copied={copied} onCopy={copyToClipboard} mono />
          <PayRow label="Хүлээн авагч" value={BANK_RECIPIENT} copyText={BANK_RECIPIENT} field="recipient" copied={copied} onCopy={copyToClipboard} subtitle="Antaqor үүсгэн байгуулагч · хувийн данс" />
          <PayRow label="Дүн" value={`₮${displayPrice}`} copyText={String(tier.price)} field="amount" copied={copied} onCopy={copyToClipboard} mono />
          {/* Reference — user's email, easier to remember than a random 6-char code */}
          <button
            type="button"
            onClick={() => copyToClipboard(userEmail, "ref")}
            className="group flex w-full items-center justify-between gap-3 border-l-2 border-[#EF2C58] bg-[rgba(239,44,88,0.06)] px-4 py-3 text-left transition hover:bg-[rgba(239,44,88,0.1)]"
          >
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-[1px] text-[#EF2C58]">Гүйлгээний утга</div>
              <div className="mt-0.5 truncate font-mono text-[14px] font-bold text-[#EF2C58]">
                {userEmail || "——"}
              </div>
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black tracking-wider transition ${
                copied === "ref" ? "bg-[#22C55E] text-white" : "bg-[#EF2C58] text-white group-hover:bg-[#D4264E]"
              }`}
            >
              {copied === "ref" ? "ХУУЛСАН" : "ХУУЛАХ"}
            </span>
          </button>
        </div>

        <div className="mt-3 rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#141414] px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[1px] text-[#666666]">Лавлах утас</div>
            <a href="tel:94641031" className="mt-0.5 block text-[14px] font-semibold text-[#E8E8E8]">94641031</a>
          </div>
          <CopyBtn text="94641031" field="phone" copied={copied} onCopy={copyToClipboard} />
        </div>

        <button
          onClick={handleTransferred}
          className="group relative mt-5 flex w-full items-center justify-center gap-2 overflow-hidden rounded-[10px] bg-[#EF2C58] py-4 text-[14px] font-black text-white shadow-[0_0_24px_rgba(239,44,88,0.25)] transition hover:shadow-[0_0_40px_rgba(239,44,88,0.4)]"
        >
          <span className="relative z-10">Шилжүүллээ — Идэвхжүүлэх</span>
          <svg className="relative z-10 h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
          <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
        </button>

        <p className="mt-2 text-center text-[10px] text-[#666]">
          Гүйлгээний утга дээрх <strong className="text-[#EF2C58]">{payment.referenceCode || "—"}</strong> кодоор автоматаар таних
        </p>
      </div>
    );
  }


  // If user landed via ?pay=1, suppress the pricing landing while handleJoin runs —
  // otherwise the headline flashes for a beat before the bank-info screen swaps in.
  if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("pay") === "1") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-3 w-3 animate-pulse rounded-[4px] bg-[#EF2C58]" />
      </div>
    );
  }

  // ─── Single-tier focused landing ───
  return (
    <div className="mx-auto max-w-md py-4">
      <div className="mb-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#EF2C58]"
        >
          CYBER EMPIRE
        </motion.div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mt-2 text-[13px] text-[#888]"
        >
          Хичээл · Чат · Пост · Market · Level system — бүгд нэг газар
        </motion.p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="relative overflow-hidden rounded-[12px] border border-[rgba(239,44,88,0.25)] bg-gradient-to-br from-[rgba(239,44,88,0.08)] via-[#111] to-[#0D0D0D] p-6 md:p-7"
      >
        <div className="flex items-baseline gap-1">
          <span className="text-[44px] font-black leading-none text-[#E8E8E8] md:text-[52px]">₮{formatMNT(CYBER_EMPIRE.price)}</span>
          <span className="text-[15px] font-semibold text-[#888]">{CYBER_EMPIRE.period}</span>
        </div>
        <div className="mt-1 text-[12px] text-[#888]">{CYBER_EMPIRE.tagline}</div>

        <div className="my-5 h-[1px] bg-gradient-to-r from-[rgba(239,44,88,0.35)] via-[rgba(239,44,88,0.1)] to-transparent" />

        <ul className="space-y-2.5">
          {CYBER_EMPIRE.features.map((f) => (
            <li key={f.text} className="flex items-start gap-2.5">
              <svg className="mt-0.5 h-4 w-4 shrink-0 text-[#EF2C58]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-[13px] leading-snug text-[#CCC]">{f.text}</span>
            </li>
          ))}
        </ul>

        {session ? (
          <button
            onClick={handleJoin}
            disabled={submitting}
            className="group relative mt-6 flex w-full items-center justify-center gap-2 overflow-hidden rounded-[10px] bg-[#EF2C58] py-4 text-[14px] font-black text-white shadow-[0_0_24px_rgba(239,44,88,0.25)] transition hover:shadow-[0_0_40px_rgba(239,44,88,0.45)] disabled:opacity-60"
          >
            <span className="relative z-10">
              {submitting ? "Төлбөр үүсгэж байна..." : `Нэгдэх · ₮${formatMNT(CYBER_EMPIRE.price)}`}
            </span>
            {!submitting && (
              <svg className="relative z-10 h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            )}
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
          </button>
        ) : (
          <Link
            href="/auth/signup"
            className="group relative mt-6 flex w-full items-center justify-center gap-2 overflow-hidden rounded-[10px] bg-[#EF2C58] py-4 text-[14px] font-black text-white shadow-[0_0_24px_rgba(239,44,88,0.25)] transition hover:shadow-[0_0_40px_rgba(239,44,88,0.45)]"
          >
            <span className="relative z-10">Бүртгүүлэж үргэлжлүүлэх</span>
            <svg className="relative z-10 h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] text-[#666]">
          <span>✓ Сараар шинэчлэгдэх</span>
          <span className="text-[#333]">·</span>
          <span>✓ QPay / Банкны шилжүүлэг</span>
          <span className="text-[#333]">·</span>
          <span>✓ 20 мин дотор идэвхжинэ</span>
        </div>
      </motion.div>

      {/* Social proof — members with results */}
      <Testimonials
        variant="grid"
        limit={3}
        className="mt-8"
        eyebrow="ГИШҮҮДИЙН ҮР ДҮН"
        heading="Чамаас өмнө нэгдсэн хүмүүс"
      />

      {/* Trust / support */}
      <div className="mt-5 rounded-[8px] border border-[rgba(255,255,255,0.06)] bg-[#0F0F0F] p-4 text-center">
        <p className="text-[12px] text-[#888]">
          Асуулт байна уу?{" "}
          <a href="mailto:antaqor@gmail.com" className="font-bold text-[#EF2C58] hover:underline">antaqor@gmail.com</a>
          {" · "}
          <a href="tel:94641031" className="font-bold text-[#EF2C58] hover:underline">94641031</a>
        </p>
        {!session && (
          <p className="mt-2 text-[11px] text-[#555]">
            Бүртгэлтэй юу?{" "}
            <Link href="/auth/signin" className="text-[#EF2C58]">Нэвтрэх</Link>
          </p>
        )}
      </div>
    </div>
  );
}

function PayRow({
  label, value, copyText, field, copied, onCopy, mono, subtitle,
}: {
  label: string; value: string; copyText: string; field: string;
  copied: string | null; onCopy: (t: string, f: string) => void; mono?: boolean; subtitle?: string;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-[1px] text-[#666666]">{label}</div>
        <div className={`mt-0.5 font-semibold text-[#E8E8E8] ${mono ? "text-[16px] tracking-wider" : "text-[14px]"}`}>
          {value}
        </div>
        {subtitle && <div className="mt-0.5 text-[10px] text-[#666]">{subtitle}</div>}
      </div>
      <CopyBtn text={copyText} field={field} copied={copied} onCopy={onCopy} />
    </div>
  );
}

function CopyBtn({
  text, field, copied, onCopy, accent,
}: {
  text: string; field: string; copied: string | null;
  onCopy: (t: string, f: string) => void; accent?: boolean;
}) {
  const done = copied === field;
  return (
    <button
      onClick={() => onCopy(text, field)}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] transition ${
        accent ? "text-[#EF2C58]/60 hover:text-[#EF2C58]" : "text-[#666666] hover:text-[#E8E8E8]"
      }`}
    >
      {done ? (
        <svg className="h-4 w-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )}
    </button>
  );
}

