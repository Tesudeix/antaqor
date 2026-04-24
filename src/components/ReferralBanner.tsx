"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

export default function ReferralBanner() {
  const { data: session } = useSession();
  const [code, setCode] = useState<string | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!session?.user) return;
    fetch("/api/credits")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) { setCode(d.referralCode); setBalance(d.balance); } })
      .catch(() => {});
  }, [session]);

  if (!session?.user || !code) return null;

  const inviteUrl = typeof window !== "undefined"
    ? `${window.location.origin}/auth/signup?ref=${code}`
    : `https://antaqor.com/auth/signup?ref=${code}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Antaqor — AI бүтээгчдийн нийгэмлэг",
          text: "Нэгдсэнд +50 кредит авч эхэл",
          url: inviteUrl,
        });
      } else {
        await copy();
      }
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="relative overflow-hidden rounded-[4px] border border-[rgba(239,44,88,0.2)] bg-gradient-to-br from-[rgba(239,44,88,0.08)] via-[#0F0F0F] to-[#0F0F0F] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="h-[2px] w-3 bg-[#EF2C58]" />
            <span className="text-[10px] font-bold tracking-[0.15em] text-[#EF2C58]">REFERRAL</span>
            <span className="rounded-full bg-[rgba(239,44,88,0.12)] px-1.5 py-0.5 text-[9px] font-black text-[#EF2C58]">
              {balance} credit
            </span>
          </div>
          <h3 className="mt-1.5 text-[15px] font-bold leading-tight text-[#E8E8E8]">
            2 найз урихад — <span className="text-[#EF2C58]">1 сар үнэгүй</span>
          </h3>
          <p className="mt-0.5 text-[11px] text-[#888]">
            Найз бүр бүртгэхэд <span className="font-bold text-[#E8E8E8]">+50</span>, Cyber Empire-д нэгдэхэд <span className="font-bold text-[#EF2C58]">+500</span> кредит
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-1.5">
          <button
            onClick={share}
            className="rounded-[4px] bg-[#EF2C58] px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-[#D4264E]"
          >
            Хуваалцах
          </button>
          <button
            onClick={copy}
            className="rounded-[4px] border border-[rgba(255,255,255,0.1)] bg-[#141414] px-3 py-1 text-[10px] font-semibold text-[#AAA] transition hover:text-[#EF2C58]"
          >
            {copied ? "Хуулсан" : "Линк хуулах"}
          </button>
        </div>
      </div>
      <Link href="/credits" className="mt-3 flex w-full items-center justify-center gap-1 text-[10px] font-bold text-[#666] transition hover:text-[#EF2C58]">
        Дэлгэрэнгүй самбар
        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
      </Link>
    </div>
  );
}
