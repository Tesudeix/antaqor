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

  const checkMembership = async () => {
    try {
      const res = await fetch("/api/clan/status");
      const data = await res.json();
      setIsMember(data.isMember);
    } finally {
      setLoading(false);
    }
  };

  const displayPrice = pricing ? formatMNT(pricing.currentPrice) : "...";
  const rawPrice = pricing ? String(pricing.currentPrice) : "25000";

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
        <div className="h-2 w-2 animate-pulse rounded-[4px] bg-[#FFD300]" />
      </div>
    );
  }

  // Payment confirmed
  if (paymentSubmitted) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-[4px] border border-[#FFD300]">
          <svg className="h-7 w-7 text-[#FFD300]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-[22px] font-bold text-[#e8e6e1]">Хүлээн авлаа</h1>
        <p className="mt-2 max-w-sm text-[13px] text-[#6b6b78]">
          Таны төлбөр баталгаажуулалт хүлээгдэж байна. Ихэвчлэн 24 цагийн дотор шалгагдана.
        </p>
        <div className="mt-4 rounded-[4px] border border-[#1a1a22] bg-[#0c0c10] px-5 py-3">
          <div className="text-[10px] uppercase tracking-[1px] text-[#3a3a48]">Гүйлгээний утга</div>
          <div className="mt-0.5 text-[14px] font-semibold text-[#FFD300]">{userEmail}</div>
        </div>
        <Link href="/" className="btn-primary mt-6 text-[13px]">Нүүр хуудас</Link>
      </div>
    );
  }

  // Already a member
  if (isMember) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[4px] bg-[#FFD300]">
          <svg className="h-7 w-7 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-[22px] font-bold text-[#e8e6e1]">Та кланд байна</h1>
        <p className="mt-2 max-w-sm text-[13px] text-[#6b6b78]">
          Бүх контент, хичээл, нийгэмлэгт бүрэн хандалттай.
        </p>
        <div className="mt-6 flex gap-3">
          <Link href="/" className="rounded-[4px] bg-[#FFD300] px-5 py-2.5 text-[13px] font-semibold text-black transition hover:bg-[#e6be00]">
            Мэдээ
          </Link>
          <Link href="/classroom" className="rounded-[4px] border border-[#1a1a22] px-5 py-2.5 text-[13px] font-medium text-[#6b6b78] transition hover:text-[#e8e6e1]">
            Хичээл
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
          <h1 className="text-[24px] font-bold text-[#e8e6e1]">Кланд нэгдэх</h1>
          <p className="mt-2 max-w-md text-[13px] leading-relaxed text-[#6b6b78]">
            Бүртгүүлж, сарын гишүүнчлэлийн төлбөрөө хийгээд кланд нэгдээрэй.
          </p>
        </div>

        {/* Price card */}
        <div className="mx-5 rounded-[4px] border border-[#1a1a22] bg-[#0c0c10] overflow-hidden">
          <div className="bg-[#FFD300] px-5 py-5">
            <div className="text-[10px] uppercase tracking-[1px] text-black/50">Сарын гишүүнчлэл</div>
            <div className="mt-1 text-[32px] font-bold leading-none text-black">
              ₮{displayPrice}
            </div>
            {pricing && (
              <div className="mt-2 text-[11px] font-medium text-black/60">
                Гишүүн бүр +₮{formatMNT(pricing.increment)} нэмнэ
              </div>
            )}
          </div>
          <div className="space-y-0 divide-y divide-[#1a1a22] px-5">
            {["Бүх контент, хичээлд хандалт", "Гишүүдтэй чат, нийгэмлэг", "Менторшип, feedback"].map((b) => (
              <div key={b} className="flex items-center gap-3 py-3">
                <svg className="h-3.5 w-3.5 shrink-0 text-[#FFD300]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-[13px] text-[#6b6b78]">{b}</span>
              </div>
            ))}
          </div>
          <div className="p-5">
            <Link href="/auth/signup" className="flex w-full items-center justify-center rounded-[4px] bg-[#FFD300] py-3 text-[13px] font-semibold text-black transition hover:bg-[#e6be00]">
              Бүртгүүлэх
            </Link>
            <p className="mt-3 text-center text-[12px] text-[#3a3a48]">
              Бүртгэлтэй юу? <Link href="/auth/signin" className="text-[#FFD300]">Нэвтрэх</Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Logged in, not member — show payment
  return (
    <div className="-mx-5">
      <div className="px-5 pb-4 pt-2">
        <h1 className="text-[22px] font-bold text-[#e8e6e1]">Кланд нэгдэх</h1>
        <p className="mt-1 text-[13px] text-[#6b6b78]">
          Сарын гишүүнчлэл — <span className="font-semibold text-[#FFD300]">₮{displayPrice}</span>
        </p>
        {pricing && (
          <p className="mt-1 text-[11px] text-[#4a4a55]">
            Гишүүн бүр <span className="text-[#FFD300]">+₮{formatMNT(pricing.increment)}</span> нэмнэ · дараагийн үнэ ₮{formatMNT(pricing.nextPrice)}
          </p>
        )}
      </div>

      {!showPayment ? (
        /* Join button */
        <div className="mx-5 rounded-[4px] border border-[#1a1a22] bg-[#0c0c10] p-5">
          <div className="space-y-0 divide-y divide-[#1a1a22]">
            {["Бүх контент, хичээлд хандалт", "Гишүүдтэй чат, нийгэмлэг", "Менторшип, feedback"].map((b) => (
              <div key={b} className="flex items-center gap-3 py-3">
                <svg className="h-3.5 w-3.5 shrink-0 text-[#FFD300]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-[13px] text-[#6b6b78]">{b}</span>
              </div>
            ))}
          </div>
          <button
            onClick={handleJoin}
            disabled={submitting}
            className="mt-4 flex w-full items-center justify-center rounded-[4px] bg-[#FFD300] py-3 text-[13px] font-semibold text-black transition hover:bg-[#e6be00] disabled:opacity-50"
          >
            {submitting ? "..." : `Нэгдэх — ₮${displayPrice}/сар`}
          </button>
        </div>
      ) : (
        /* Payment details */
        <div className="px-5">
          {/* QR */}
          <div className="mb-4 flex justify-center">
            <div className="rounded-[4px] border border-[#1a1a22] bg-white p-3">
              <Image src="/qpay.png" alt="QPay QR" width={180} height={180} className="h-[180px] w-[180px] object-contain" />
            </div>
          </div>
          <p className="mb-4 text-center text-[11px] text-[#3a3a48]">Банкны апп-аар уншуулах</p>

          {/* Transfer info */}
          <div className="divide-y divide-[#1a1a22] rounded-[4px] border border-[#1a1a22] bg-[#0c0c10] overflow-hidden">
            <PayRow label="Банк" value={BANK_NAME} copyText={BANK_NAME} field="bank" copied={copied} onCopy={copyToClipboard} />
            <PayRow label="Данс" value={BANK_ACCOUNT} copyText={BANK_ACCOUNT} field="account" copied={copied} onCopy={copyToClipboard} mono />
            <PayRow label="Хүлээн авагч" value={BANK_RECIPIENT} copyText={BANK_RECIPIENT} field="recipient" copied={copied} onCopy={copyToClipboard} />
            <PayRow label="Дүн" value={`₮${displayPrice}`} copyText={rawPrice} field="amount" copied={copied} onCopy={copyToClipboard} mono />
            <div className="flex items-center justify-between border-l-2 border-[#FFD300] bg-[rgba(255,211,0,0.03)] px-4 py-3">
              <div>
                <div className="text-[10px] uppercase tracking-[1px] text-[#FFD300]">Гүйлгээний утга</div>
                <div className="mt-0.5 text-[14px] font-bold text-[#FFD300]">{userEmail}</div>
              </div>
              <CopyBtn text={userEmail} field="ref" copied={copied} onCopy={copyToClipboard} accent />
            </div>
          </div>

          <p className="mt-3 text-[11px] text-[#3a3a48]">
            Гүйлгээний утга дээр <strong className="text-[#FFD300]">{userEmail}</strong> имэйлээ бичнэ үү.
          </p>

          <button
            onClick={handleConfirmPayment}
            disabled={submitting}
            className="mt-5 flex w-full items-center justify-center rounded-[4px] bg-[#FFD300] py-3 text-[13px] font-semibold text-black transition hover:bg-[#e6be00] disabled:opacity-50"
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
        <div className="text-[10px] uppercase tracking-[1px] text-[#3a3a48]">{label}</div>
        <div className={`mt-0.5 font-semibold text-[#e8e6e1] ${mono ? "text-[16px] tracking-wider" : "text-[14px]"}`}>
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
        accent ? "text-[#FFD300]/60 hover:text-[#FFD300]" : "text-[#3a3a48] hover:text-[#e8e6e1]"
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
