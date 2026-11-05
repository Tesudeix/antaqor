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
    <div className="relative overflow-hidden rounded-[4px] border border-[rgba(46,41,255,0.2)] bg-gradient-to-br from-[rgba(46,41,255,0.08)] via-[#f2f5f8] to-[#f2f5f8] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="h-[2px] w-3 bg-[#2E29FF]" />
            <span className="text-[10px] font-bold tracking-[0.15em] text-[#2E29FF]">REFERRAL</span>
            <span className="rounded-[4px] bg-[rgba(46,41,255,0.12)] px-1.5 py-0.5 text-[11px] font-black text-[#2E29FF]">
              {balance} credit
            </span>
          </div>
          <h3 className="mt-1.5 text-[15px] font-bold leading-tight text-[#0e1726]">
            2 найз урихад — <span className="text-[#2E29FF]">1 сар үнэгүй</span>
          </h3>
          <p className="mt-0.5 text-[11px] text-[#E2E4E8]">
            Найз бүр бүртгэхэд <span className="font-bold text-[#0e1726]">+50</span>, Antaqor хүрээлэлд нэгдэхэд <span className="font-bold text-[#2E29FF]">+500</span> кредит
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-1.5">
          <button
            onClick={share}
            className="rounded-[4px] bg-[#2E29FF] px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-[#1F1AD9]"
          >
            Хуваалцах
          </button>
          <button
            onClick={copy}
            className="rounded-[4px] border border-[rgba(15,23,38,0.1)] bg-[#eef2f6] px-3 py-1 text-[10px] font-semibold text-[#475569] transition hover:text-[#2E29FF]"
          >
            {copied ? "Хуулсан" : "Линк хуулах"}
          </button>
        </div>
      </div>
      <Link href="/credits" className="mt-3 flex w-full items-center justify-center gap-1 text-[10px] font-bold text-[#E2E4E8] transition hover:text-[#2E29FF]">
        Дэлгэрэнгүй самбар
        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
      </Link>
    </div>
  );
}
