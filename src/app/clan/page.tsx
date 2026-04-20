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

// ─── Tier Data ───
const TIERS = [
  {
    id: "entry",
    name: "Entry",
    price: 49000,
    period: "/сар",
    tagline: "AI суралцаж эхлэх",
    popular: false,
    features: [
      { text: "Community хандалт", included: true },
      { text: "Бичлэгтэй хичээлүүд (бүгд)", included: true },
      { text: "Challenge, даалгаврууд", included: true },
      { text: "Гишүүдийн форум", included: true },
      { text: "Live session", included: false },
      { text: "Шууд зөвлөгөө", included: false },
      { text: "Төслийн review", included: false },
    ],
    cta: "Эхлэх",
    color: "#888888",
  },
  {
    id: "core",
    name: "Core",
    price: 149000,
    period: "/сар",
    tagline: "Бодит ахиц гаргах",
    popular: true,
    features: [
      { text: "Entry-н бүх боломж", included: true },
      { text: "Live session (7 хоног бүр)", included: true },
      { text: "Шууд холбогдох эрх", included: true },
      { text: "Менторшип, feedback", included: true },
      { text: "Давуу эрхтэй challenge", included: true },
      { text: "Карьер зөвлөгөө", included: true },
      { text: "Inner Circle хандалт", included: false },
    ],
    cta: "Core болох",
    color: "#EF2C58",
  },
  {
    id: "inner",
    name: "Inner Circle",
    price: 990000,
    period: "/жил",
    tagline: "20 хүний жижиг бүлэг",
    popular: false,
    limit: 20,
    features: [
      { text: "Core-н бүх боломж", included: true },
      { text: "Шууд 1:1 зөвлөгөө", included: true },
      { text: "Төслийн review & feedback", included: true },
      { text: "Хаалттай бүлгийн уулзалт", included: true },
      { text: "Бизнес стратеги зөвлөгөө", included: true },
      { text: "Эрт хандалт — шинэ контент", included: true },
      { text: "Lifetime network", included: true },
    ],
    cta: "Хүсэлт илгээх",
    color: "#8B5CF6",
  },
];

export default function ClanPage() {
  const { data: session } = useSession();
  const [isMember, setIsMember] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [paymentSubmitted, setPaymentSubmitted] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<string>("entry");

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

  const tier = TIERS.find((t) => t.id === selectedTier) || TIERS[1];
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
          Таны төлбөр баталгаажуулалт хүлээгдэж байна. 24 цагийн дотор идэвхжинэ.
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

  // ─── Pricing Page — Three Tiers ───
  return (
    <div className="mx-auto max-w-4xl py-4">
      {/* Header */}
      <div className="mb-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-2 text-[11px] font-bold uppercase tracking-[0.15em] text-[#EF2C58]"
        >
          Гишүүнчлэл
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-[26px] font-bold text-[#E8E8E8]"
        >
          Өөрт тохирох түвшнээ сонго
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mt-2 text-[13px] text-[#666666]"
        >
          AI чадвар эзэмшиж, бодит төсөл дээр дадлагаж, хамтдаа өсөж суралц
        </motion.p>
      </div>

      {/* Tier Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {TIERS.map((t, i) => {
          const isSelected = selectedTier === t.id;
          const isPopular = t.popular;

          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.1 }}
              onClick={() => setSelectedTier(t.id)}
              className={`relative cursor-pointer rounded-[4px] border bg-[#141414] p-5 transition-all duration-200 ${
                isSelected
                  ? `border-[${t.color}] shadow-[0_0_0_1px_${t.color}] ring-1`
                  : "border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.15)]"
              }`}
              style={isSelected ? { borderColor: t.color, boxShadow: `0 0 0 1px ${t.color}20, 0 4px 24px ${t.color}10` } : {}}
            >
              {/* Popular badge */}
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#EF2C58] px-3 py-1 text-[9px] font-bold uppercase tracking-[1px] text-white">
                  Хамгийн их сонголт
                </div>
              )}

              {/* Limit badge */}
              {t.limit && (
                <div className="absolute -top-3 right-4 rounded-full bg-[#8B5CF6] px-2.5 py-1 text-[9px] font-bold text-white">
                  {t.limit} хүн
                </div>
              )}

              {/* Header */}
              <div className="mb-4 pt-1">
                <div className="text-[11px] font-bold uppercase tracking-[1px]" style={{ color: t.color }}>
                  {t.name}
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-[32px] font-bold text-[#E8E8E8]">₮{formatMNT(t.price)}</span>
                  <span className="text-[13px] text-[#666666]">{t.period}</span>
                </div>
                <div className="mt-1 text-[12px] text-[#666666]">{t.tagline}</div>
              </div>

              {/* Divider */}
              <div className="mb-4 h-[1px]" style={{ background: `linear-gradient(90deg, ${t.color}30, transparent)` }} />

              {/* Features */}
              <div className="space-y-2.5">
                {t.features.map((f) => (
                  <div key={f.text} className="flex items-start gap-2.5">
                    {f.included ? (
                      <svg className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: t.color }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#333]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                    <span className={`text-[12px] ${f.included ? "text-[#BBBBBB]" : "text-[#444]"}`}>
                      {f.text}
                    </span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              {session ? (
                <button
                  onClick={(e) => { e.stopPropagation(); setSelectedTier(t.id); handleJoin(); }}
                  disabled={submitting}
                  className="mt-5 flex w-full items-center justify-center rounded-[4px] py-3 text-[13px] font-bold transition disabled:opacity-50"
                  style={
                    isPopular
                      ? { background: t.color, color: "#fff" }
                      : { background: "transparent", border: `1px solid ${t.color}40`, color: t.color }
                  }
                >
                  {submitting && isSelected ? "..." : t.cta}
                </button>
              ) : (
                <Link
                  href="/auth/signup"
                  onClick={(e) => e.stopPropagation()}
                  className="mt-5 flex w-full items-center justify-center rounded-[4px] py-3 text-[13px] font-bold transition"
                  style={
                    isPopular
                      ? { background: t.color, color: "#fff" }
                      : { background: "transparent", border: `1px solid ${t.color}40`, color: t.color }
                  }
                >
                  {t.cta}
                </Link>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Comparison note */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-8 rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#141414] p-5"
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="text-center">
            <div className="text-[20px] font-bold text-[#888]">Entry</div>
            <div className="mt-1 text-[12px] text-[#888]">Суралцаж эхлэх</div>
            <div className="mt-2 text-[11px] text-[#555]">Бичлэгтэй хичээл + community хандалт. AI-н үндэс суурийг тавина.</div>
          </div>
          <div className="text-center">
            <div className="text-[20px] font-bold text-[#EF2C58]">Core</div>
            <div className="mt-1 text-[12px] text-[#EF2C58]">Бодит ахиц, бодит дэмжлэг</div>
            <div className="mt-2 text-[11px] text-[#555]">Live session + шууд холбогдох эрх. Чамтай тодорхой цагт шууд ярьж, зөвлөгөө авна.</div>
          </div>
          <div className="text-center">
            <div className="text-[20px] font-bold text-[#8B5CF6]">Inner Circle</div>
            <div className="mt-1 text-[12px] text-[#8B5CF6]">Хамгийн дээд түвшин</div>
            <div className="mt-2 text-[11px] text-[#555]">20 хүний жижиг бүлэг. 1:1 зөвлөгөө, төслийн review, бизнес стратеги.</div>
          </div>
        </div>
      </motion.div>

      {/* FAQ-style footer */}
      <div className="mt-6 text-center">
        <p className="text-[12px] text-[#888888]">
          Асуулт байна уу?{" "}
          <a href="mailto:antaqor@gmail.com" className="font-bold text-[#EF2C58] hover:underline">antaqor@gmail.com</a>
        </p>
        {!session && (
          <p className="mt-2 text-[12px] text-[#555]">
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
