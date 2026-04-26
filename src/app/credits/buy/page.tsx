"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

const BANK_NAME = "Хаан банк";
const BANK_ACCOUNT = "5926153085";
const BANK_RECIPIENT = "Баянбилэг Дамбадаржаа";

interface CreditPackage {
  id: string;
  credits: number;
  price: number;
  pricePerCredit: number;
  label: string;
  blurb: string;
  badge?: string;
  highlight?: boolean;
}

interface PendingPurchase {
  paymentId: string;
  referenceCode: string;
  amount: number;
  credits: number;
  packageId: string;
  hasReceipt: boolean;
  createdAt: string;
}

export default function BuyCreditsPage() {
  const { data: session, status } = useSession();
  const fileRef = useRef<HTMLInputElement>(null);
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [pending, setPending] = useState<PendingPurchase | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<string>("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [paid, setPaid] = useState(false);
  const [grantedCredits, setGrantedCredits] = useState<number>(0);

  const refresh = useCallback(async () => {
    const r = await fetch("/api/credits/purchase");
    const d = await r.json();
    if (r.ok) {
      setPackages(d.packages || []);
      setPending(d.pending || null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (status === "loading") return;
    refresh();
  }, [status, refresh]);

  // Poll status while a pending purchase has a receipt — admin should approve in minutes
  useEffect(() => {
    if (!pending || !pending.hasReceipt || paid) return;
    const t = setInterval(async () => {
      const r = await fetch("/api/credits/purchase");
      const d = await r.json();
      if (r.ok && !d.pending) {
        // Pending row is gone → it was approved (status moved to paid)
        setPaid(true);
        setGrantedCredits(pending.credits);
        clearInterval(t);
      }
    }, 8000);
    return () => clearInterval(t);
  }, [pending, paid]);

  const buy = async (pkgId: string) => {
    setError("");
    setCreating(pkgId);
    try {
      const r = await fetch("/api/credits/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId: pkgId }),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error || "Үүсгэх амжилтгүй");
        return;
      }
      setPending({
        paymentId: d.paymentId,
        referenceCode: d.referenceCode,
        amount: d.amount,
        credits: d.credits,
        packageId: d.packageId,
        hasReceipt: !!d.hasReceipt,
        createdAt: new Date().toISOString(),
      });
    } catch {
      setError("Сүлжээний алдаа");
    } finally {
      setCreating("");
    }
  };

  const copy = (txt: string, field: string) => {
    navigator.clipboard.writeText(txt).catch(() => {});
    setCopied(field);
    setTimeout(() => setCopied(""), 1200);
  };

  const onReceiptPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || !pending) return;
    if (!f.type.startsWith("image/")) {
      setError("Зөвхөн зургийн файл");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setError("Зураг 5MB-аас бага байх ёстой");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", f);
      const up = await fetch("/api/upload", { method: "POST", body: fd });
      const upd = await up.json();
      if (!up.ok || !upd.url) {
        setError(upd.error || "Upload алдаа");
        return;
      }
      const att = await fetch("/api/clan/receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiptImage: upd.url, paymentId: pending.paymentId }),
      });
      const attd = await att.json();
      if (!att.ok) {
        setError(attd.error || "Баримт оруулах алдаа");
        return;
      }
      setPending((p) => (p ? { ...p, hasReceipt: true } : p));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const cancelAndPickAnother = async () => {
    // Soft cancel — we just go back to picker; old pending stays in DB until
    // user picks a new package (POST will mark old as failed).
    setPending(null);
  };

  if (status === "unauthenticated") {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-[20px] font-black text-[#E8E8E8]">Кредит худалдаж авах</h1>
        <p className="mt-2 text-[13px] text-[#888]">Эхлээд нэвтэрнэ үү.</p>
        <Link href="/auth/signin?next=/credits/buy" className="mt-4 inline-block rounded-[4px] bg-[#EF2C58] px-5 py-2.5 text-[12px] font-black text-white">
          Нэвтрэх
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-3 w-3 animate-pulse rounded-[4px] bg-[#EF2C58]" />
      </div>
    );
  }

  if (paid) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(239,44,88,0.12)] shadow-[0_0_28px_rgba(239,44,88,0.4)]">
          <svg className="h-7 w-7 text-[#EF2C58]" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-[24px] font-black text-[#E8E8E8]">+{grantedCredits}₵ амжилттай</h1>
        <p className="mt-2 text-[13px] text-[#888]">Кредит таны данс руу шилжсэн.</p>
        <div className="mt-5 flex flex-col gap-2">
          <Link href="/tools/generate-image" className="rounded-[4px] bg-[#EF2C58] px-5 py-2.5 text-[13px] font-black text-white shadow-[0_0_18px_rgba(239,44,88,0.4)]">
            AI зураг үүсгэх →
          </Link>
          <Link href="/credits" className="rounded-[4px] border border-[rgba(255,255,255,0.08)] px-5 py-2 text-[12px] font-bold text-[#888]">
            Кредитийн түүх
          </Link>
        </div>
      </div>
    );
  }

  // ─── Pending state — show bank info + receipt upload ───
  if (pending) {
    return (
      <div className="mx-auto max-w-[560px] pb-12">
        <Link href="/credits" className="mb-3 inline-flex items-center gap-1 text-[11px] text-[#666] transition hover:text-[#EF2C58]">
          ← Кредит
        </Link>

        <div className="mb-4 flex items-center gap-2">
          <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-[#FFC107]" />
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#FFC107]">ХҮЛЭЭЖ БАЙНА</span>
        </div>
        <h1 className="text-[22px] font-black leading-tight text-[#E8E8E8]">
          {pending.credits}₵ авахын тулд төлбөр шилжүүлнэ үү
        </h1>
        <p className="mt-1.5 text-[13px] text-[#888]">
          Төлбөр шалгагдангуут <strong className="text-[#E8E8E8]">5 минутад</strong> кредит данс руу шилжинэ. Хуудсыг хаасан ч мэдэгдэл ирнэ.
        </p>

        {/* Bank info card */}
        <div className="mt-5 rounded-[4px] border border-[rgba(239,44,88,0.25)] bg-[rgba(239,44,88,0.04)] p-4">
          <div className="mb-3 text-[10px] font-black uppercase tracking-[0.15em] text-[#EF2C58]">
            Шилжүүлэх мэдээлэл
          </div>
          <BankRow label="Банк" value={BANK_NAME} field="bank" copied={copied} onCopy={copy} />
          <BankRow label="Данс" value={BANK_ACCOUNT} field="account" copied={copied} onCopy={copy} mono />
          <BankRow label="Хүлээн авагч" value={BANK_RECIPIENT} field="recipient" copied={copied} onCopy={copy} />
          <BankRow label="Дүн" value={`₮${pending.amount.toLocaleString()}`} copyText={String(pending.amount)} field="amount" copied={copied} onCopy={copy} mono />
          <BankRow label="Гүйлгээний утга" value={pending.referenceCode} field="ref" copied={copied} onCopy={copy} accent mono />
          <p className="mt-3 text-[10px] leading-relaxed text-[#888]">
            <strong className="text-[#EF2C58]">Чухал:</strong> Гүйлгээний утга дээр <strong className="text-[#E8E8E8]">{pending.referenceCode}</strong> кодыг бичиж шилжүүлнэ үү. Энэ кодоор системд автоматаар таних боломжтой болно.
          </p>
        </div>

        {/* Receipt upload */}
        <div className="mt-4 rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0F0F10] p-4">
          {pending.hasReceipt ? (
            <div className="flex items-center gap-2 text-[12px]">
              <svg className="h-4 w-4 text-[#EF2C58]" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="font-bold text-[#E8E8E8]">Баримт хүлээн авлаа</span>
              <span className="text-[#666]">· admin шалгаж байна</span>
            </div>
          ) : (
            <>
              <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-[#888]">
                Шилжүүлсэн баримт
              </div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex w-full items-center gap-2.5 rounded-[4px] border-2 border-dashed border-[rgba(239,44,88,0.3)] bg-[#0A0A0A] px-3 py-3 text-left transition hover:border-[rgba(239,44,88,0.5)] disabled:opacity-50"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] bg-[rgba(239,44,88,0.1)] text-[#EF2C58]">
                  {uploading ? (
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#EF2C58] border-t-transparent" />
                  ) : (
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z" />
                    </svg>
                  )}
                </span>
                <span className="leading-tight">
                  <span className="block text-[12px] font-bold text-[#E8E8E8]">
                    {uploading ? "Хадгалж байна..." : "Баримтын зураг оруулах"}
                  </span>
                  <span className="block text-[10px] text-[#666]">JPG / PNG · 5MB хүртэл</span>
                </span>
              </button>
              <input ref={fileRef} type="file" accept="image/*" onChange={onReceiptPick} className="hidden" />
              <p className="mt-2 text-[10px] text-[#666]">
                Шилжүүлсэн screenshot оруулбал admin минутын дотор шалгана.
              </p>
            </>
          )}
        </div>

        {error && (
          <div className="mt-3 rounded-[4px] border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.08)] px-3 py-2 text-[11px] text-[#EF4444]">
            {error}
          </div>
        )}

        <button
          onClick={cancelAndPickAnother}
          className="mt-4 w-full text-center text-[11px] text-[#666] transition hover:text-[#EF2C58]"
        >
          Багц солих
        </button>
      </div>
    );
  }

  // ─── Picker — 3 cards ───
  return (
    <div className="mx-auto max-w-[820px] pb-12">
      <Link href="/credits" className="mb-3 inline-flex items-center gap-1 text-[11px] text-[#666] transition hover:text-[#EF2C58]">
        ← Кредит
      </Link>

      <div className="mb-6">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[rgba(239,44,88,0.12)] px-2 py-0.5 text-[9px] font-black tracking-[0.18em] text-[#EF2C58]">
            КРЕДИТ ЗАХИАЛАХ
          </span>
        </div>
        <h1 className="mt-2 text-[24px] font-black leading-tight text-[#E8E8E8] sm:text-[30px]">
          Багцаа сонгоно уу
        </h1>
        <p className="mt-1.5 text-[13px] text-[#888]">
          Кредит нь AI хэрэгслүүдэд (зураг үүсгэх г.м) ашиглагдана. <strong className="text-[#E8E8E8]">1 AI зураг = 10₵</strong>.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {packages.map((pkg) => (
          <button
            key={pkg.id}
            onClick={() => buy(pkg.id)}
            disabled={creating !== ""}
            className={`group relative flex flex-col items-start gap-2 rounded-[4px] border p-5 text-left transition disabled:opacity-50 ${
              pkg.highlight
                ? "border-[#EF2C58] bg-gradient-to-br from-[rgba(239,44,88,0.12)] to-[#0F0F10] shadow-[0_0_24px_rgba(239,44,88,0.18)]"
                : "border-[rgba(255,255,255,0.08)] bg-[#0F0F10] hover:border-[rgba(239,44,88,0.4)]"
            }`}
          >
            {pkg.badge && (
              <span className="absolute -top-2 right-3 rounded-full bg-[#EF2C58] px-2 py-0.5 text-[9px] font-black tracking-wider text-white shadow-[0_0_12px_rgba(239,44,88,0.5)]">
                {pkg.badge}
              </span>
            )}
            <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#888]">
              {pkg.label}
            </div>
            <div className="text-[28px] font-black leading-none text-[#E8E8E8]">
              {pkg.credits}<span className="text-[#EF2C58]">₵</span>
            </div>
            <div className="text-[14px] font-black text-[#E8E8E8]">
              ₮{pkg.price.toLocaleString()}
            </div>
            <p className="text-[11px] leading-relaxed text-[#888]">{pkg.blurb}</p>
            <div className="mt-2 inline-flex items-center gap-1 rounded-[4px] bg-[rgba(255,255,255,0.04)] px-2 py-1 text-[9px] font-bold text-[#666]">
              {pkg.pricePerCredit}₮ / 1₵
            </div>
            <div className="mt-auto w-full pt-3">
              <span className={`inline-flex w-full items-center justify-center rounded-[4px] py-2 text-[12px] font-black transition ${
                pkg.highlight
                  ? "bg-[#EF2C58] text-white group-hover:bg-[#D4264E]"
                  : "border border-[rgba(239,44,88,0.4)] text-[#EF2C58] group-hover:bg-[rgba(239,44,88,0.08)]"
              }`}>
                {creating === pkg.id ? "Үүсгэж байна..." : "Авах →"}
              </span>
            </div>
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-4 rounded-[4px] border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.08)] px-3 py-2 text-[11px] text-[#EF4444]">
          {error}
        </div>
      )}

      {/* Trust signals */}
      <div className="mt-8 grid gap-2 text-[11px] text-[#888] sm:grid-cols-3">
        <div className="rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0F0F10] p-3">
          <div className="font-bold text-[#E8E8E8]">📲 Шуурхай</div>
          <p className="mt-1 leading-relaxed">Гүйлгээний утга бичээд шилжүүлбэл 5 минутад автомат шалгагдана.</p>
        </div>
        <div className="rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0F0F10] p-3">
          <div className="font-bold text-[#E8E8E8]">🔒 Аюулгүй</div>
          <p className="mt-1 leading-relaxed">Хаан банкны хувийн данс руу. Зөвхөн админ хүлээн авна.</p>
        </div>
        <div className="rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0F0F10] p-3">
          <div className="font-bold text-[#E8E8E8]">⏳ Дуусдаггүй</div>
          <p className="mt-1 leading-relaxed">Авсан кредит хугацаа дуусахгүй. Хүссэн үедээ ашиглана.</p>
        </div>
      </div>
    </div>
  );
}

function BankRow({
  label, value, copyText, field, copied, onCopy, mono = false, accent = false,
}: {
  label: string; value: string; copyText?: string; field: string;
  copied: string; onCopy: (txt: string, f: string) => void;
  mono?: boolean; accent?: boolean;
}) {
  const text = copyText ?? value;
  return (
    <button
      type="button"
      onClick={() => onCopy(text, field)}
      className="group flex w-full items-center gap-2 border-b border-[rgba(255,255,255,0.04)] py-2 text-left last:border-b-0"
    >
      <span className="w-[110px] text-[11px] font-medium text-[#666]">{label}</span>
      <span className={`flex-1 truncate ${accent ? "text-[#EF2C58]" : "text-[#E8E8E8]"} ${mono ? "font-mono tracking-tight" : ""} text-[13px] font-bold`}>
        {value}
      </span>
      <span className={`shrink-0 text-[10px] font-bold transition ${copied === field ? "text-[#EF2C58]" : "text-[#555] group-hover:text-[#EF2C58]"}`}>
        {copied === field ? "✓ хуулагдсан" : "хуулах"}
      </span>
    </button>
  );
}
