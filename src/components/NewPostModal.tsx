"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

type Category = "промт" | "бүтээл" | "ялалт" | "мэдээлэл" | "танилцуулга";

const CATEGORIES: {
  key: Category;
  label: string;
  blurb: string;
  color: string;
  iconPath: string;
  placeholder: string;
}[] = [
  { key: "промт", label: "Промт", blurb: "Ажилласан промтоо хуваалц", color: "#EF2C58",
    iconPath: "M8 9l-3 3 3 3m8-6l3 3-3 3M14 5l-4 14",
    placeholder: "Амжилттай ажилласан промтоо энд буулгаарай.\n\nЖишээ:\nAct as a senior UX designer..." },
  { key: "бүтээл", label: "Бүтээл", blurb: "AI-ээр хийсэн бүтээл", color: "#EF2C58",
    iconPath: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
    placeholder: "Юу бүтээсэн бэ? Аль AI ашигласан, ямар challenge тулгарсан, хэрхэн шийдсэнээ бичнэ үү." },
  { key: "ялалт", label: "Ялалт", blurb: "Амжилтаа тэмдэглэ", color: "#EF2C58",
    iconPath: "M12 15a4 4 0 004-4V4H8v7a4 4 0 004 4zm0 0v3m0 0H8m4 0h4M5 4h3m8 0h3m-3 3a3 3 0 003-3m-14 0a3 3 0 003 3",
    placeholder: "Ямар амжилт гаргасан бэ? Community-д урам өгөх story-оо бичнэ үү." },
  { key: "мэдээлэл", label: "Мэдээлэл", blurb: "AI ертөнцийн шинэ", color: "#3B82F6",
    iconPath: "M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2M7 8h6M7 12h6M7 16h4",
    placeholder: "AI ертөнцөд гарсан шинэ мэдээ, tool, release эсвэл шилдэг туршлагаа хуваалц." },
  { key: "танилцуулга", label: "Танилцуулга", blurb: "Өөрийгөө танилцуул", color: "#A855F7",
    iconPath: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
    placeholder: "Таны нэр, юу хийдэг, AI-тай ямар харилцаатай байдаг талаар хуваалц." },
];

export default function NewPostModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const [category, setCategory] = useState<Category>("промт");
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setCategory("промт");
    setContent("");
    setImageUrl("");
    setImagePreview("");
    setError("");
    setUploading(false);
    setSubmitting(false);
  };

  // Esc closes; lock scroll while open
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    setTimeout(() => textRef.current?.focus(), 80);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  const handleFile = async (file: File | undefined | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Зөвхөн зургийн файл сонгоно уу"); return; }
    if (file.size > 10 * 1024 * 1024) { setError("Зураг 10MB-аас бага байх ёстой"); return; }
    setError("");
    setImagePreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Оруулах амжилтгүй");
        setImagePreview("");
        return;
      }
      setImageUrl(data.url);
    } catch {
      setError("Сүлжээний алдаа");
      setImagePreview("");
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (submitting || uploading) return;
    if (!content.trim() && !imageUrl) { setError("Бичвэр эсвэл зураг шаардлагатай"); return; }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim(), image: imageUrl, category }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Илгээх амжилтгүй");
        return;
      }
      reset();
      onClose();
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  const active = CATEGORIES.find((c) => c.key === category)!;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4"
        >
          <motion.div
            initial={{ y: 32, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 32, opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[560px] max-h-[92vh] overflow-y-auto rounded-t-[4px] border-t border-[rgba(255,255,255,0.08)] bg-[#0F0F10] sm:max-h-[85vh] sm:rounded-[4px] sm:border"
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] bg-[#0F0F10] px-4 py-3">
              <h2 className="text-[14px] font-black text-[#E8E8E8]">Шинэ пост</h2>
              <button
                onClick={onClose}
                aria-label="Хаах"
                className="flex h-7 w-7 items-center justify-center rounded-full text-[#666] transition hover:bg-[rgba(255,255,255,0.06)] hover:text-[#E8E8E8]"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3 p-4">
              {/* Category — single horizontal scroll */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                {CATEGORIES.map((c) => {
                  const sel = category === c.key;
                  return (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setCategory(c.key)}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 transition-all duration-200"
                      style={{
                        borderColor: sel ? c.color : "rgba(255,255,255,0.08)",
                        background: sel ? `${c.color}1F` : "#0A0A0A",
                        color: sel ? c.color : "#888",
                      }}
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d={c.iconPath} />
                      </svg>
                      <span className="text-[12px] font-bold">{c.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Textarea */}
              <textarea
                ref={textRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={active.placeholder}
                rows={5}
                maxLength={2000}
                className="w-full resize-y rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] p-3 text-[13px] leading-relaxed text-[#E8E8E8] placeholder-[#555] outline-none transition focus:border-[rgba(239,44,88,0.4)]"
              />

              {/* Image preview / upload */}
              {imagePreview ? (
                <div className="relative overflow-hidden rounded-[4px] border border-[rgba(255,255,255,0.08)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imagePreview} alt="" className="w-full object-contain" style={{ maxHeight: 360 }} />
                  {uploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                      <div className="h-3 w-3 animate-pulse rounded-full bg-[#EF2C58]" />
                    </div>
                  )}
                  {!uploading && (
                    <button
                      type="button"
                      onClick={() => { setImageUrl(""); setImagePreview(""); if (fileRef.current) fileRef.current.value = ""; }}
                      className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white transition hover:bg-[#EF2C58]"
                      aria-label="Зураг устгах"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex w-full items-center gap-3 rounded-[4px] border border-dashed border-[rgba(255,255,255,0.1)] bg-[#0A0A0A] px-3 py-3 text-left transition hover:border-[rgba(239,44,88,0.4)]"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-[4px] bg-[rgba(239,44,88,0.1)] text-[#EF2C58]">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] font-bold text-[#E8E8E8]">Зураг нэмэх</span>
                    <span className="block text-[10px] text-[#666]">JPEG / PNG / WebP · 10MB хүртэл</span>
                  </span>
                </button>
              )}

              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={(e) => handleFile(e.target.files?.[0])}
                className="hidden"
              />

              {error && (
                <div className="rounded-[4px] border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.08)] px-3 py-2 text-[11px] text-[#EF4444]">
                  {error}
                </div>
              )}
            </div>

            {/* Sticky footer */}
            <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-[rgba(255,255,255,0.06)] bg-[#0F0F10] px-4 py-3">
              <span className="text-[10px] text-[#555]">{content.length}/2000</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="text-[12px] font-semibold text-[#666] transition hover:text-[#E8E8E8]"
                >
                  Болих
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={submitting || uploading || (!content.trim() && !imageUrl)}
                  className="inline-flex items-center gap-1.5 rounded-[4px] bg-[#EF2C58] px-4 py-2 text-[12px] font-black text-white transition hover:bg-[#D4264E] disabled:opacity-40"
                >
                  {submitting ? "Илгээж байна..." : "Нийтлэх"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
