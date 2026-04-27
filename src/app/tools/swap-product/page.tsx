"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

const COST = 10;
const MAX_BYTES = 5 * 1024 * 1024;

type Slot = "subject" | "product";

export default function SwapProductPage() {
  const { data: session, status } = useSession();
  const subjectRef = useRef<HTMLInputElement>(null);
  const productRef = useRef<HTMLInputElement>(null);

  const [subjectFile, setSubjectFile] = useState<File | null>(null);
  const [productFile, setProductFile] = useState<File | null>(null);
  const [subjectPreview, setSubjectPreview] = useState("");
  const [productPreview, setProductPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [resultUrl, setResultUrl] = useState("");
  const [error, setError] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [drag, setDrag] = useState<Slot | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/credits")
      .then((r) => r.json())
      .then((d) => { if (typeof d.balance === "number") setBalance(d.balance); })
      .catch(() => {});
  }, [status]);

  useEffect(() => () => {
    if (subjectPreview) URL.revokeObjectURL(subjectPreview);
    if (productPreview) URL.revokeObjectURL(productPreview);
  }, [subjectPreview, productPreview]);

  const onPick = (slot: Slot, f: File | null | undefined) => {
    if (!f) return;
    setError("");
    setResultUrl("");
    if (!f.type.startsWith("image/")) {
      setError("Зөвхөн зургийн файл (JPG, PNG, WebP)");
      return;
    }
    if (f.size > MAX_BYTES) {
      setError("Зураг 5MB-аас бага байх ёстой");
      return;
    }
    if (slot === "subject") {
      if (subjectPreview) URL.revokeObjectURL(subjectPreview);
      setSubjectFile(f);
      setSubjectPreview(URL.createObjectURL(f));
    } else {
      if (productPreview) URL.revokeObjectURL(productPreview);
      setProductFile(f);
      setProductPreview(URL.createObjectURL(f));
    }
  };

  const onDrop = (slot: Slot, e: React.DragEvent) => {
    e.preventDefault();
    setDrag(null);
    onPick(slot, e.dataTransfer.files?.[0]);
  };

  const submit = async () => {
    if (!subjectFile || !productFile || busy) return;
    setBusy(true);
    setError("");
    setResultUrl("");
    try {
      const fd = new FormData();
      fd.append("subject", subjectFile);
      fd.append("product", productFile);
      const res = await fetch("/api/tools/swap-product", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        if (typeof data.balance === "number") setBalance(data.balance);
        setError(data.error || "Swap амжилтгүй");
        return;
      }
      setResultUrl(data.url);
      if (typeof data.balance === "number") setBalance(data.balance);
    } catch {
      setError("Сүлжээний алдаа. Дахин оролдоно уу.");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    if (subjectPreview) URL.revokeObjectURL(subjectPreview);
    if (productPreview) URL.revokeObjectURL(productPreview);
    setSubjectFile(null); setProductFile(null);
    setSubjectPreview(""); setProductPreview("");
    setResultUrl(""); setError("");
    if (subjectRef.current) subjectRef.current.value = "";
    if (productRef.current) productRef.current.value = "";
  };

  const canSubmit = !!subjectFile && !!productFile && !busy && (balance === null || balance >= COST);
  const lowBalance = balance !== null && balance < COST;

  return (
    <div className="relative mx-auto max-w-[1100px] pb-16">
      <div className="mb-3 flex items-center justify-between">
        <Link href="/tools" className="inline-flex items-center gap-1 text-[11px] text-[#666] transition hover:text-[#EF2C58]">
          ← Бүх хэрэгсэл
        </Link>
        {session && (
          <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(239,44,88,0.4)] bg-black/40 px-2 py-0.5 text-[10px] font-black text-[#EF2C58] backdrop-blur-md shadow-[0_0_12px_rgba(239,44,88,0.3)]">
            <svg className="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /></svg>
            {balance ?? "…"}₵
          </span>
        )}
      </div>

      <div className="mb-6">
        <span className="rounded-full bg-[rgba(239,44,88,0.12)] px-2 py-0.5 text-[9px] font-black tracking-[0.18em] text-[#EF2C58]">
          AI ХЭРЭГСЭЛ
        </span>
        <h1 className="mt-2 text-[24px] font-black leading-tight text-[#E8E8E8] sm:text-[30px]">
          Бүтээгдэхүүн солих
        </h1>
        <p className="mt-1.5 max-w-[640px] text-[13px] leading-relaxed text-[#888]">
          Хүний барьж байгаа бүтээгдэхүүнийг өөр бүтээгдэхүүнээр AI-аар солино.
          Influencer marketing, online дэлгүүр, brand partnership-д бэлэн зураг.
        </p>
      </div>

      {/* Two upload slots — stack on mobile, side-by-side on tablet+ */}
      <div className="grid gap-3 sm:grid-cols-2">
        <UploadSlot
          slot="subject"
          step={1}
          title="Хүн + одоогийн бүтээгдэхүүн"
          hint="Хүн юм барьсан зураг (бараа, утас, бараа гэх мэт)"
          file={subjectFile}
          preview={subjectPreview}
          inputRef={subjectRef}
          drag={drag === "subject"}
          setDrag={(b) => setDrag(b ? "subject" : null)}
          onPick={(f) => onPick("subject", f)}
          onDrop={(e) => onDrop("subject", e)}
          accent="rose"
        />
        <UploadSlot
          slot="product"
          step={2}
          title="Шинэ бүтээгдэхүүн"
          hint="Гарт нь оруулах шинэ бараа (цагаан фон илүү)"
          file={productFile}
          preview={productPreview}
          inputRef={productRef}
          drag={drag === "product"}
          setDrag={(b) => setDrag(b ? "product" : null)}
          onPick={(f) => onPick("product", f)}
          onDrop={(e) => onDrop("product", e)}
          accent="purple"
        />
      </div>

      {/* Visual flow indicator */}
      <div className="mt-3 flex items-center justify-center gap-2 text-[10px] font-bold text-[#666]">
        <span className="rounded-full bg-[#0F0F10] px-2 py-1">Хүн</span>
        <svg className="h-3 w-3 text-[#EF2C58]" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
        </svg>
        <span className="rounded-full bg-[#0F0F10] px-2 py-1">Шинэ бүтээгдэхүүн</span>
        <svg className="h-3 w-3 text-[#EF2C58]" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
        </svg>
        <span className="rounded-full bg-[rgba(239,44,88,0.1)] px-2 py-1 text-[#EF2C58]">AI үр дүн</span>
      </div>

      {lowBalance && !error && (
        <div className="mt-4 flex items-center justify-between rounded-[4px] border border-[rgba(239,44,88,0.3)] bg-[rgba(239,44,88,0.06)] px-4 py-3">
          <div>
            <div className="text-[12px] font-bold text-[#EF2C58]">Кредит дутуу</div>
            <div className="text-[11px] text-[#888]">Танд {balance}₵ байна, {COST}₵ шаардлагатай.</div>
          </div>
          <Link href="/credits/buy" className="rounded-[4px] bg-[#EF2C58] px-3 py-1.5 text-[11px] font-black text-white shadow-[0_0_18px_rgba(239,44,88,0.5)]">
            Кредит авах →
          </Link>
        </div>
      )}
      {error && (
        <div className="mt-4 rounded-[4px] border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.08)] px-3 py-2 text-[11px] text-[#EF4444]">
          {error}
        </div>
      )}

      {/* Submit — sticky on mobile */}
      <div className="sticky bottom-[80px] z-10 mt-4 lg:static lg:bottom-auto">
        <button
          onClick={submit}
          disabled={!canSubmit}
          className="inline-flex w-full items-center justify-center gap-2 rounded-[4px] bg-gradient-to-r from-[#EF2C58] to-[#A855F7] px-6 py-3.5 text-[13px] font-black text-white shadow-[0_0_24px_rgba(239,44,88,0.45)] transition hover:shadow-[0_0_36px_rgba(239,44,88,0.7)] disabled:opacity-40 disabled:shadow-none"
        >
          {busy ? (
            <>
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              AI боловсруулж байна...
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              Бүтээгдэхүүн солих · {COST}₵
            </>
          )}
        </button>
      </div>

      {/* Result */}
      {(busy || resultUrl) && (
        <div className="mt-6">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-[#666]">Үр дүн</div>
          <div className="relative rounded-[4px] border border-[rgba(239,44,88,0.3)] bg-[#0A0A0A] p-1 shadow-[0_0_28px_rgba(239,44,88,0.15)]">
            <div className="relative aspect-[3/2] w-full overflow-hidden rounded-[3px] bg-[#0F0F10]">
              {busy ? (
                <Skeleton />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={resultUrl} alt="" className="absolute inset-0 h-full w-full object-contain" />
              )}
            </div>
          </div>
          {resultUrl && !busy && (
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={resultUrl}
                download={`swap-${Date.now()}.png`}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-[4px] bg-[#EF2C58] py-2.5 text-[12px] font-black text-white transition hover:bg-[#D4264E]"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Татах
              </a>
              <button
                onClick={reset}
                className="rounded-[4px] border border-[rgba(255,255,255,0.08)] px-4 py-2.5 text-[12px] font-bold text-[#888] transition hover:text-[#E8E8E8]"
              >
                Шинээр
              </button>
            </div>
          )}
        </div>
      )}

      {/* How-to */}
      <details className="mt-8 rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0F0F10] p-4">
        <summary className="cursor-pointer text-[12px] font-bold text-[#E8E8E8]">
          Хэрхэн ашиглах вэ?
        </summary>
        <div className="mt-3 space-y-2 text-[12px] leading-relaxed text-[#888]">
          <p><strong className="text-[#EF2C58]">1-р зураг:</strong> Хүн ямар нэг бараа барьсан зураг (жишээ: гар утас, ундаа, кредит карт).</p>
          <p><strong className="text-[#EF2C58]">2-р зураг:</strong> Гарт нь оруулах шинэ бараа (цагаан фон дээр илүү сайн ажиллана).</p>
          <p>AI хүний хувцас, нүүр, поз, фоныг өөрчлөхгүй — зөвхөн гарт нь байсан барааг шинээр сольно.</p>
          <p className="text-[11px] text-[#666]">Powered by Google Gemini Nano Banana — multi-image edit AI.</p>
        </div>
      </details>
    </div>
  );
}

function UploadSlot({
  step, title, hint, file, preview, inputRef, drag, setDrag, onPick, onDrop, accent,
}: {
  slot: Slot;
  step: number;
  title: string;
  hint: string;
  file: File | null;
  preview: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  drag: boolean;
  setDrag: (b: boolean) => void;
  onPick: (f: File | null | undefined) => void;
  onDrop: (e: React.DragEvent) => void;
  accent: "rose" | "purple";
}) {
  const ringActive =
    accent === "rose"
      ? "border-[#EF2C58] bg-[rgba(239,44,88,0.06)]"
      : "border-[#A855F7] bg-[rgba(168,85,247,0.06)]";
  const ringIdle =
    accent === "rose"
      ? "border-[rgba(239,44,88,0.3)] hover:border-[rgba(239,44,88,0.5)]"
      : "border-[rgba(168,85,247,0.3)] hover:border-[rgba(168,85,247,0.55)]";
  const tone = accent === "rose" ? "#EF2C58" : "#A855F7";

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black text-white" style={{ background: tone }}>
          {step}
        </span>
        <div className="text-[12px] font-bold text-[#E8E8E8]">{title}</div>
      </div>
      {!preview ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          className={`flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-[4px] border-2 border-dashed bg-[#0A0A0A] p-4 text-center transition ${
            drag ? ringActive : ringIdle
          }`}
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-[4px]" style={{ background: `${tone}1A`, color: tone }}>
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z" />
            </svg>
          </span>
          <span>
            <span className="block text-[12px] font-bold text-[#E8E8E8]">Зураг сонгох</span>
            <span className="mt-0.5 block text-[10px] text-[#666]">эсвэл энд чирж тавь</span>
            <span className="mt-1.5 block text-[10px] text-[#555]">{hint}</span>
            <span className="mt-1 block text-[10px] text-[#444]">JPG / PNG / WebP · 5MB хүртэл</span>
          </span>
        </button>
      ) : (
        <div className="relative aspect-square w-full overflow-hidden rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="" className="absolute inset-0 h-full w-full object-contain" />
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent p-2">
            <span className="truncate text-[10px] font-medium text-white/80">{file?.name}</span>
            <div className="flex gap-1">
              <button
                onClick={() => inputRef.current?.click()}
                className="rounded-[3px] bg-black/60 px-2 py-1 text-[10px] font-bold text-white backdrop-blur-md transition hover:bg-black/80"
              >
                Солих
              </button>
            </div>
          </div>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={(e) => onPick(e.target.files?.[0])}
        className="hidden"
      />
    </div>
  );
}

function Skeleton() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 overflow-hidden bg-[#0A0A0A]">
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(90deg, transparent 0%, rgba(239,44,88,0.18) 50%, transparent 100%)",
          animation: "swapShimmer 1.4s ease-in-out infinite",
        }}
      />
      <div className="relative z-10 flex flex-col items-center gap-2.5">
        <span className="flex h-14 w-14 items-center justify-center rounded-[4px] bg-[rgba(239,44,88,0.1)] shadow-[0_0_24px_rgba(239,44,88,0.5)]">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-[#EF2C58] border-t-transparent" />
        </span>
        <p className="text-[12px] font-bold text-[#E8E8E8]">Бүтээгдэхүүн солиж байна</p>
        <p className="text-[10px] text-[#666]">10–25 секунд хүртэл хүлээгээрэй</p>
      </div>
      <style jsx>{`
        @keyframes swapShimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
