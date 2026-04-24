"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";

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

export default function ClanPage() {
  const { data: session } = useSession();
  const [isMember, setIsMember] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [paymentSubmitted, setPaymentSubmitted] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

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
        setShowPayment(true);
      }
    } catch {} finally { setSubmitting(false); }
  };

  const handleConfirmPayment = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/clan/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referenceId: userEmail }),
      });
      const data = await res.json();
      if (data.status === "submitted" || data.status === "paid") {
        setPaymentSubmitted(true);
      }
    } catch {} finally { setSubmitting(false); }
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

  // Payment confirmed
  if (paymentSubmitted) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-[4px] border border-[#EF2C58]">
          <svg className="h-7 w-7 text-[#EF2C58]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-[22px] font-bold text-[#E8E8E8]">Баярлалаа!</h1>
        <p className="mt-2 max-w-sm text-[13px] text-[#666666]">
          Таны төлбөр баталгаажуулалт хүлээгдэж байна. 20 минутын дотор идэвхжинэ.
        </p>
        <div className="mt-4 rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#141414] px-5 py-3">
          <div className="text-[10px] uppercase tracking-[1px] text-[#666666]">Гүйлгээний утга</div>
          <div className="mt-0.5 text-[14px] font-semibold text-[#EF2C58]">{userEmail}</div>
        </div>
        <div className="mt-3 rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#141414] px-5 py-3">
          <div className="text-[10px] uppercase tracking-[1px] text-[#666666]">Холбоо барих</div>
          <a href="tel:94641031" className="mt-0.5 block text-[14px] font-semibold text-[#E8E8E8]">94641031</a>
        </div>
        <Link href="/" className="mt-6 rounded-[4px] bg-[#EF2C58] px-6 py-2.5 text-[13px] font-bold text-white">Нүүр хуудас</Link>
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

  // Show payment flow
  if (showPayment && session) {
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
          <PayRow label="Хүлээн авагч" value={BANK_RECIPIENT} copyText={BANK_RECIPIENT} field="recipient" copied={copied} onCopy={copyToClipboard} />
          <PayRow label="Дүн" value={`₮${displayPrice}`} copyText={String(tier.price)} field="amount" copied={copied} onCopy={copyToClipboard} mono />
          <div className="flex items-center justify-between border-l-2 border-[#EF2C58] bg-[rgba(239,44,88,0.08)] px-4 py-3">
            <div>
              <div className="text-[10px] uppercase tracking-[1px] text-[#EF2C58]">Гүйлгээний утга</div>
              <div className="mt-0.5 text-[14px] font-bold text-[#EF2C58]">{userEmail}</div>
            </div>
            <CopyBtn text={userEmail} field="ref" copied={copied} onCopy={copyToClipboard} accent />
          </div>
        </div>

        <div className="mt-3 rounded-[4px] bg-[rgba(239,44,88,0.08)] border border-[rgba(239,44,88,0.15)] px-4 py-2.5">
          <p className="text-[11px] text-[#999999]">
            Гүйлгээний утга дээр <strong className="text-[#EF2C58]">{userEmail}</strong> имэйлээ заавал бичнэ үү.
          </p>
        </div>

        <div className="mt-3 rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#141414] px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[1px] text-[#666666]">Лавлах утас</div>
            <a href="tel:94641031" className="mt-0.5 block text-[14px] font-semibold text-[#E8E8E8]">94641031</a>
          </div>
          <CopyBtn text="94641031" field="phone" copied={copied} onCopy={copyToClipboard} />
        </div>

        <button
          onClick={handleConfirmPayment}
          disabled={submitting}
          className="mt-5 flex w-full items-center justify-center rounded-[4px] bg-[#EF2C58] py-3.5 text-[14px] font-bold text-white transition hover:bg-[#D4264E] disabled:opacity-50"
        >
          {submitting ? "Шалгаж байна..." : "Төлбөр шилжүүлсэн"}
        </button>
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
          className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#EF2C58]"
        >
          CYBER EMPIRE
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-[26px] font-black leading-tight text-[#E8E8E8] md:text-[30px]"
        >
          AI бүтээгчдийн<br />нийгэмлэгт нэгд
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
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
  label, value, copyText, field, copied, onCopy, mono,
}: {
  label: string; value: string; copyText: string; field: string;
  copied: string | null; onCopy: (t: string, f: string) => void; mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div>
        <div className="text-[10px] uppercase tracking-[1px] text-[#666666]">{label}</div>
        <div className={`mt-0.5 font-semibold text-[#E8E8E8] ${mono ? "text-[16px] tracking-wider" : "text-[14px]"}`}>
          {value}
        </div>
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
