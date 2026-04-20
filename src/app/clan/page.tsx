"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";

const BANK_ACCOUNT = "5926153085";
const BANK_NAME = "Хаан банк";
const BANK_RECIPIENT = "Баянбилэг Дамбадаржаа";

interface PricingData {
  paidMembers: number;
  currentPrice: number;
  nextPrice: number;
  increment: number;
}

function formatMNT(n: number) {
  return n.toLocaleString("mn-MN");
}

const BENEFITS = [
  { icon: "book", text: "AI сургалт, хичээл, бодит кейс судалгаа" },
  { icon: "users", text: "Бүтээгчдийн хүрээлэл, хамтын суралцах орчин" },
  { icon: "trophy", text: "Challenge, өрсөлдөөн, шагналтай даалгавар" },
  { icon: "zap", text: "Менторшип, feedback, карьер зөвлөгөө" },
  { icon: "tool", text: "AI хэрэгсэл бүтээх чадвар, практик дадлага" },
];

function BenefitIcon({ icon }: { icon: string }) {
  switch (icon) {
    case "book": return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />;
    case "users": return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />;
    case "trophy": return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />;
    case "zap": return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />;
    case "tool": return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />;
    default: return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />;
  }
}

export default function ClanPage() {
  const { data: session } = useSession();
  const [isMember, setIsMember] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [paymentSubmitted, setPaymentSubmitted] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [pricing, setPricing] = useState<PricingData | null>(null);

  useEffect(() => {
    checkMembership();
    fetch("/api/pricing")
      .then((r) => r.json())
      .then((d) => { if (typeof d.currentPrice === "number") setPricing(d); })
      .catch(() => {});
  }, [session]);

  // Auto-show payment if redirected after signup
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

  const displayPrice = pricing ? formatMNT(pricing.currentPrice) : "29,000";
  const rawPrice = pricing ? String(pricing.currentPrice) : "29000";

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
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
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
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
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
        <h1 className="text-[22px] font-bold text-[#1A1A1A]">Баярлалаа!</h1>
        <p className="mt-2 max-w-sm text-[13px] text-[#888888]">
          Таны төлбөр баталгаажуулалт хүлээгдэж байна. 24 цагийн дотор идэвхжинэ.
        </p>
        <div className="mt-4 rounded-[4px] border border-[rgba(0,0,0,0.08)] bg-[#FFFFFF] px-5 py-3">
          <div className="text-[10px] uppercase tracking-[1px] text-[#AAAAAA]">Гүйлгээний утга</div>
          <div className="mt-0.5 text-[14px] font-semibold text-[#EF2C58]">{userEmail}</div>
        </div>
        <Link href="/" className="btn-primary mt-6 text-[13px]">Нүүр хуудас</Link>
      </div>
    );
  }

  // Already a member
  if (isMember) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[4px] bg-[#EF2C58]">
          <svg className="h-7 w-7 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-[22px] font-bold text-[#1A1A1A]">Та аль хэдийн гишүүн</h1>
        <p className="mt-2 max-w-sm text-[13px] text-[#888888]">
          Бүх сургалт, challenge, нийгэмлэгт бүрэн хандалттай.
        </p>
        <div className="mt-6 flex gap-3">
          <Link href="/classroom" className="rounded-[4px] bg-[#EF2C58] px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#D4264E]">
            Хичээл үзэх
          </Link>
          <Link href="/" className="rounded-[4px] border border-[rgba(0,0,0,0.08)] px-5 py-2.5 text-[13px] font-medium text-[#888888] transition hover:text-[#1A1A1A]">
            Нүүр
          </Link>
        </div>
      </div>
    );
  }

  // Not logged in
  if (!session) {
    return (
      <div className="-mx-5">
        <div className="px-5 py-8">
          <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#EF2C58]">AI Training Ground</div>
          <h1 className="text-[26px] font-bold text-[#1A1A1A]">Чадвараа хөгжүүл, хамтдаа өс</h1>
          <p className="mt-2 max-w-md text-[13px] leading-relaxed text-[#888888]">
            AI чадвар эзэмшиж, бодит төсөл дээр дадлагажиж, ижил зорилготой бүтээгчидтэй хамт өрсөлдөж суралц.
          </p>
        </div>

        {/* Price card */}
        <div className="mx-5 rounded-[4px] border border-[rgba(0,0,0,0.08)] bg-[#FFFFFF] overflow-hidden">
          <div className="bg-[#EF2C58] px-5 py-5">
            <div className="text-[10px] uppercase tracking-[1px] text-black/50">Сарын гишүүнчлэл</div>
            <div className="mt-1 text-[32px] font-bold leading-none text-black">
              ₮{displayPrice}
            </div>
            <div className="mt-2 text-[11px] font-medium text-black/60">
              /сар · хүссэн үедээ цуцлах боломжтой
            </div>
          </div>
          <div className="space-y-0 divide-y divide-[rgba(0,0,0,0.08)] px-5">
            {BENEFITS.map((b) => (
              <div key={b.text} className="flex items-center gap-3 py-3">
                <svg className="h-4 w-4 shrink-0 text-[#EF2C58]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <BenefitIcon icon={b.icon} />
                </svg>
                <span className="text-[13px] text-[#666666]">{b.text}</span>
              </div>
            ))}
          </div>
          <div className="p-5">
            <Link href="/auth/signup" className="flex w-full items-center justify-center rounded-[4px] bg-[#EF2C58] py-3 text-[14px] font-bold text-white transition hover:bg-[#D4264E]">
              Бүртгүүлж эхлэх
            </Link>
            <p className="mt-3 text-center text-[12px] text-[#AAAAAA]">
              Бүртгэлтэй юу? <Link href="/auth/signin" className="text-[#EF2C58]">Нэвтрэх</Link>
            </p>
          </div>
        </div>

        {/* Social proof */}
        {pricing && pricing.paidMembers > 0 && (
          <div className="mx-5 mt-4 rounded-[4px] border border-[rgba(0,0,0,0.08)] bg-[#FFFFFF] p-4 text-center">
            <div className="text-[20px] font-bold text-[#1A1A1A]">{pricing.paidMembers}+</div>
            <div className="text-[11px] text-[#888888]">гишүүн аль хэдийн суралцаж байна</div>
          </div>
        )}
      </div>
    );
  }

  // Logged in, not member — show payment
  return (
    <div className="-mx-5">
      <div className="px-5 pb-4 pt-2">
        <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#EF2C58]">Сүүлийн алхам</div>
        <h1 className="text-[22px] font-bold text-[#1A1A1A]">Төлбөр төлж гишүүн болох</h1>
        <p className="mt-1 text-[13px] text-[#888888]">
          Сарын гишүүнчлэл — <span className="font-bold text-[#EF2C58]">₮{displayPrice}</span>
        </p>
      </div>

      {!showPayment ? (
        /* Benefits + Join button */
        <div className="mx-5 rounded-[4px] border border-[rgba(0,0,0,0.08)] bg-[#FFFFFF] p-5">
          <div className="space-y-0 divide-y divide-[rgba(0,0,0,0.08)]">
            {BENEFITS.map((b) => (
              <div key={b.text} className="flex items-center gap-3 py-3">
                <svg className="h-4 w-4 shrink-0 text-[#EF2C58]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <BenefitIcon icon={b.icon} />
                </svg>
                <span className="text-[13px] text-[#666666]">{b.text}</span>
              </div>
            ))}
          </div>
          <button
            onClick={handleJoin}
            disabled={submitting}
            className="mt-4 flex w-full items-center justify-center rounded-[4px] bg-[#EF2C58] py-3.5 text-[14px] font-bold text-white transition hover:bg-[#D4264E] disabled:opacity-50"
          >
            {submitting ? "..." : `Төлбөр шилжүүлэх — ₮${displayPrice}/сар`}
          </button>
        </div>
      ) : (
        /* Payment details */
        <div className="px-5">
          {/* QPay QR */}
          <div className="mb-4 flex justify-center">
            <div className="rounded-[4px] border border-[rgba(0,0,0,0.08)] bg-white p-3">
              <Image src="/qpay.png" alt="QPay QR" width={200} height={200} className="h-[200px] w-[200px] object-contain" />
            </div>
          </div>
          <p className="mb-4 text-center text-[12px] font-medium text-[#888888]">QPay / Банкны апп-аар QR уншуулах</p>

          {/* Transfer info */}
          <div className="divide-y divide-[rgba(0,0,0,0.08)] rounded-[4px] border border-[rgba(0,0,0,0.08)] bg-[#FFFFFF] overflow-hidden">
            <PayRow label="Банк" value={BANK_NAME} copyText={BANK_NAME} field="bank" copied={copied} onCopy={copyToClipboard} />
            <PayRow label="Данс" value={BANK_ACCOUNT} copyText={BANK_ACCOUNT} field="account" copied={copied} onCopy={copyToClipboard} mono />
            <PayRow label="Хүлээн авагч" value={BANK_RECIPIENT} copyText={BANK_RECIPIENT} field="recipient" copied={copied} onCopy={copyToClipboard} />
            <PayRow label="Дүн" value={`₮${displayPrice}`} copyText={rawPrice} field="amount" copied={copied} onCopy={copyToClipboard} mono />
            <div className="flex items-center justify-between border-l-2 border-[#EF2C58] bg-[rgba(239,44,88,0.03)] px-4 py-3">
              <div>
                <div className="text-[10px] uppercase tracking-[1px] text-[#EF2C58]">Гүйлгээний утга</div>
                <div className="mt-0.5 text-[14px] font-bold text-[#EF2C58]">{userEmail}</div>
              </div>
              <CopyBtn text={userEmail} field="ref" copied={copied} onCopy={copyToClipboard} accent />
            </div>
          </div>

          <div className="mt-3 rounded-[4px] bg-[rgba(239,44,88,0.04)] border border-[rgba(239,44,88,0.1)] px-4 py-2.5">
            <p className="text-[11px] text-[#888888]">
              Гүйлгээний утга дээр <strong className="text-[#EF2C58]">{userEmail}</strong> имэйлээ заавал бичнэ үү.
            </p>
          </div>

          <button
            onClick={handleConfirmPayment}
            disabled={submitting}
            className="mt-5 flex w-full items-center justify-center rounded-[4px] bg-[#EF2C58] py-3.5 text-[14px] font-bold text-white transition hover:bg-[#D4264E] disabled:opacity-50"
          >
            {submitting ? "Шалгаж байна..." : "Төлбөр шилжүүлсэн"}
          </button>
        </div>
      )}
    </div>
  );
}

function PayRow({
  label,
  value,
  copyText,
  field,
  copied,
  onCopy,
  mono,
}: {
  label: string;
  value: string;
  copyText: string;
  field: string;
  copied: string | null;
  onCopy: (t: string, f: string) => void;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div>
        <div className="text-[10px] uppercase tracking-[1px] text-[#AAAAAA]">{label}</div>
        <div className={`mt-0.5 font-semibold text-[#1A1A1A] ${mono ? "text-[16px] tracking-wider" : "text-[14px]"}`}>
          {value}
        </div>
      </div>
      <CopyBtn text={copyText} field={field} copied={copied} onCopy={onCopy} />
    </div>
  );
}

function CopyBtn({
  text,
  field,
  copied,
  onCopy,
  accent,
}: {
  text: string;
  field: string;
  copied: string | null;
  onCopy: (t: string, f: string) => void;
  accent?: boolean;
}) {
  const done = copied === field;
  return (
    <button
      onClick={() => onCopy(text, field)}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] transition ${
        accent ? "text-[#EF2C58]/60 hover:text-[#EF2C58]" : "text-[#AAAAAA] hover:text-[#1A1A1A]"
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
