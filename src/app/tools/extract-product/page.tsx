"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import PaywallGate from "@/components/PaywallGate";

const EXAMPLES = ["outfit", "shirt", "shoes", "bag", "dress", "watch", "hat", "jewelry"];
const MAX_BYTES = 5 * 1024 * 1024;

export default function ExtractProductPageWrapper() {
  return (
    <PaywallGate>
      <ExtractProductPage />
    </PaywallGate>
  );
}

function ExtractProductPage() {
  const { data: session } = useSession();
  const fileRef = useRef<HTMLInputElement>(null);

  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [product, setProduct] = useState<string>("outfit");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>("");
  const [resultUrl, setResultUrl] = useState<string>("");
  const [dragOver, setDragOver] = useState(false);

  // Cleanup blob URLs
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const handlePick = (f: File | undefined | null) => {
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
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handlePick(e.dataTransfer.files?.[0]);
  };

  const submit = async () => {
    if (!file || busy) return;
    setBusy(true);
    setError("");
    setResultUrl("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("product", product || "outfit");
      const res = await fetch("/api/tools/extract-product", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "AI боловсруулалт амжилтгүй");
        return;
      }
      setResultUrl(data.url);
    } catch {
      setError("Сүлжээний алдаа. Дахин оролдоно уу.");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl("");
    setResultUrl("");
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="mx-auto max-w-[820px] pb-16">
      {/* Back */}
      <Link href="/tools" className="mb-3 inline-flex items-center gap-1 text-[11px] text-[#666] transition hover:text-[#EF2C58]">
        ← Бүх хэрэгсэл
      </Link>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[rgba(239,44,88,0.12)] px-2 py-0.5 text-[9px] font-black tracking-[0.18em] text-[#EF2C58]">
            AI ХЭРЭГСЭЛ
          </span>
        </div>
        <h1 className="mt-2 text-[24px] font-black leading-tight text-[#E8E8E8] sm:text-[30px]">
          Бүтээгдэхүүний зураг гаргах
        </h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-[#888]">
          Загвар, биеэс цэвэрлэгдсэн, цагаан фон дээр 1:1 product photo. Online дэлгүүр, маркетингд бэлэн.
        </p>
      </div>

      {/* Two-column workspace */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* INPUT side */}
        <div className="space-y-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#888]">1. Эх зураг</div>

          {!previewUrl ? (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={`flex aspect-square w-full flex-col items-center justify-center gap-3 rounded-[4px] border-2 border-dashed bg-[#0A0A0A] p-6 text-center transition ${
                dragOver
                  ? "border-[#EF2C58] bg-[rgba(239,44,88,0.06)]"
                  : "border-[rgba(239,44,88,0.3)] hover:border-[rgba(239,44,88,0.5)]"
              }`}
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-[4px] bg-[rgba(239,44,88,0.1)] text-[#EF2C58]">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z" />
                </svg>
              </span>
              <span>
                <span className="block text-[13px] font-bold text-[#E8E8E8]">Зураг сонгох</span>
                <span className="mt-0.5 block text-[11px] text-[#666]">эсвэл энд чирж тавь</span>
                <span className="mt-1.5 block text-[10px] text-[#555]">JPG / PNG / WebP · 5MB хүртэл</span>
              </span>
            </button>
          ) : (
            <div className="relative aspect-square w-full overflow-hidden rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="" className="absolute inset-0 h-full w-full object-contain" />
              <button
                onClick={reset}
                className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-[4px] bg-black/70 text-white backdrop-blur-md transition hover:bg-[#EF4444]"
                aria-label="Цэвэрлэх"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" onChange={(e) => handlePick(e.target.files?.[0])} className="hidden" />

          {/* Product label */}
          <div className="mt-3">
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.15em] text-[#888]">
              2. Юу нь Бүтээгдэхүүн?
            </label>
            <input
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              placeholder="outfit"
              className="w-full rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2 text-[13px] text-[#E8E8E8] placeholder-[#555] outline-none transition focus:border-[rgba(239,44,88,0.4)]"
            />
            <div className="mt-2 flex flex-wrap gap-1">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setProduct(ex)}
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold transition ${
                    product === ex
                      ? "bg-[#EF2C58] text-white"
                      : "border border-[rgba(255,255,255,0.08)] bg-[#141414] text-[#888] hover:border-[rgba(239,44,88,0.3)] hover:text-[#E8E8E8]"
                  }`}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-[4px] border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.08)] px-3 py-2 text-[11px] text-[#EF4444]">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={submit}
            disabled={!file || busy || !session}
            className="w-full rounded-[4px] bg-[#EF2C58] py-3 text-[13px] font-black text-white transition hover:bg-[#D4264E] disabled:opacity-40"
          >
            {busy ? "AI боловсруулж байна..." : "Бүтээгдэхүүн гаргах"}
          </button>
          <p className="text-[10px] text-[#555]">
            Боловсруулалт ~10–25 секунд үргэлжилнэ. Хязгаар: 2/мин · 20/өдөр.
          </p>
        </div>

        {/* OUTPUT side */}
        <div className="space-y-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#888]">3. Үр дүн</div>

          <div className="relative aspect-square w-full overflow-hidden rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-white">
            {busy ? (
              <ResultSkeleton />
            ) : resultUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={resultUrl} alt="" className="absolute inset-0 h-full w-full object-contain" />
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#0F0F10] text-center">
                <svg className="h-7 w-7 text-[#333]" fill="none" stroke="currentColor" strokeWidth={1.4} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                </svg>
                <p className="text-[11px] text-[#555]">Үр дүн энд гарч ирнэ</p>
              </div>
            )}
          </div>

          {resultUrl && !busy && (
            <div className="flex gap-2">
              <a
                href={resultUrl}
                download={`product-${Date.now()}.png`}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-[4px] bg-[#EF2C58] py-2.5 text-[12px] font-black text-white transition hover:bg-[#D4264E]"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Татаж авах
              </a>
              <button
                onClick={() => { setResultUrl(""); setError(""); }}
                className="rounded-[4px] border border-[rgba(255,255,255,0.08)] px-4 py-2.5 text-[12px] font-bold text-[#888] transition hover:text-[#E8E8E8]"
              >
                Дахин
              </button>
            </div>
          )}
        </div>
      </div>

      {/* How-to */}
      <details className="mt-8 rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0F0F10] p-4">
        <summary className="cursor-pointer text-[12px] font-bold text-[#E8E8E8]">
          Хэрхэн ашиглах вэ?
        </summary>
        <div className="mt-3 space-y-2 text-[12px] leading-relaxed text-[#888]">
          <p>1. Бүтээгдэхүүнтэй (хүн өмссөн ч болно) зургаа upload хий.</p>
          <p>2. Бүтээгдэхүүний нэрийг бичнэ үү (жишээ: shirt, dress, shoes).</p>
          <p>3. AI хүн, фон, гэрэл — бүгдийг арилгаж зөвхөн product-ыг цагаан фон дээр гаргана.</p>
          <p className="text-[11px] text-[#666]">Powered by Google Gemini Nano Banana — image-to-image AI.</p>
        </div>
      </details>
    </div>
  );
}

function ResultSkeleton() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 overflow-hidden bg-[#0F0F10]">
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(239,44,88,0.08) 50%, transparent 100%)",
          animation: "extractShimmer 1.6s ease-in-out infinite",
        }}
      />
      <div className="relative z-10 flex flex-col items-center gap-2">
        <span className="flex h-12 w-12 items-center justify-center rounded-[4px] bg-[rgba(239,44,88,0.1)]">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#EF2C58] border-t-transparent" />
        </span>
        <p className="text-[12px] font-bold text-[#E8E8E8]">AI боловсруулж байна...</p>
        <p className="text-[10px] text-[#666]">Загвар, фон, гэрэл арилгаж байна</p>
      </div>
      <style jsx>{`
        @keyframes extractShimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
