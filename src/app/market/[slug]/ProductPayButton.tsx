"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import Image from "next/image";

interface PayInfo { paymentId: string; amount: number; referenceCode: string; qr: string; bank: { name: string; account: string; recipient: string } }

export default function ProductPayButton({ slug, price, title, className }: { slug: string; price: number; title: string; className?: string }) {
  // Sizing/layout is overridable so the same button can appear inline OR in the
  // mobile sticky buy-bar; brand fill + interactions stay constant.
  const sizeCls = className || "mt-5 px-6 py-3.5 text-[14px]";
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pay, setPay] = useState<PayInfo | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [copied, setCopied] = useState("");

  const copy = (v: string, k: string) => { navigator.clipboard.writeText(v).then(() => { setCopied(k); setTimeout(() => setCopied(""), 1500); }); };

  const start = async () => {
    if (!session) { window.location.href = `/auth/signin?next=/market/${slug}`; return; }
    setLoading(true);
    try {
      const r = await fetch("/api/payments/product", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug }) });
      const d = await r.json();
      if (r.ok) { setPay(d); setSubmitted(false); setOpen(true); }
    } finally { setLoading(false); }
  };

  if (price === 0) {
    return (
      <a href={`/market/${slug}`} className={`inline-flex items-center justify-center gap-2 rounded-none bg-[#1080CA] font-black text-[#0E0E10] ${sizeCls}`}>Үнэгүй авах</a>
    );
  }

  return (
    <>
      <button onClick={start} disabled={loading}
        className={`group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-none bg-[#1080CA] font-black text-[#0E0E10] shadow-[0_0_24px_rgba(16,128,202,0.2)] transition hover:shadow-[0_0_36px_rgba(16,128,202,0.35)] disabled:opacity-60 ${sizeCls}`}>
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" /></svg>
        {loading ? "..." : `QR-р төлөх · ₮${price.toLocaleString()}`}
      </button>

      {open && pay && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
          <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-sm rounded-none border border-[rgba(15,23,38,0.1)] bg-[#f7f9fb] p-6">
            <div className="text-center">
              <div className="text-[11px] font-bold uppercase tracking-[2px] text-[#1080CA]">QR-р төлөх</div>
              <h3 className="mt-1 truncate text-[15px] font-bold text-[#0e1726]">{title}</h3>
              <div className="mt-3 inline-block rounded-none bg-white p-2">
                <Image src={pay.qr} alt="QPay QR" width={170} height={170} className="h-[170px] w-[170px] object-contain" />
              </div>
              <div className="mt-3 text-[24px] font-black text-[#1080CA]">₮{pay.amount.toLocaleString()}</div>
            </div>

            <div className="mt-4 space-y-1.5 rounded-none border border-[#F2F2F4] bg-[#f2f5f8] p-3 text-[12px]">
              {[
                { l: "Банк", v: pay.bank.name, k: "b" },
                { l: "Данс", v: pay.bank.account, k: "a" },
                { l: "Хүлээн авагч", v: pay.bank.recipient, k: "r" },
                { l: "Гүйлгээний утга", v: pay.referenceCode, k: "c" },
              ].map((row) => (
                <button key={row.k} onClick={() => copy(row.v, row.k)} className="flex w-full items-center justify-between gap-2 py-0.5 text-left">
                  <span className="text-[#6b7280]">{row.l}</span>
                  <span className="font-mono font-semibold text-[#0e1726]">{row.v} {copied === row.k ? "✓" : "⧉"}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-center text-[11px] leading-relaxed text-[#6b7280]">QR-г банкны аппаар уншуулж, гүйлгээний утганд кодоо бичнэ үү.</p>

            {submitted ? (
              <div className="mt-4 rounded-none border border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.06)] px-4 py-3 text-center text-[12px] text-[#7d7]">Хүлээн авлаа ✓ Төлбөр баталгаажмагц идэвхжинэ.</div>
            ) : (
              <button onClick={() => setSubmitted(true)} className="mt-4 w-full rounded-none bg-[#1080CA] py-3 text-[13px] font-bold text-[#0E0E10]">Төлсөн</button>
            )}
            <button onClick={() => setOpen(false)} className="mt-2 w-full py-2 text-[12px] text-[#6b7280]">Хаах</button>
          </div>
        </div>
      )}
    </>
  );
}
