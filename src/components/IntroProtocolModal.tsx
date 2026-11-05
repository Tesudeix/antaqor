"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

interface StepDef {
  key: keyof Answers;
  number: number;
  label: string;
  hint?: string;
  placeholder: string;
  multiline?: boolean;
  options?: string[];
  numeric?: boolean;
}

interface Answers {
  name: string;
  age: string;
  status: string;
  why: string;
  nowWorkingOn: string;
  longTermGoal: string;
  giveTake: string;
}

const STEPS: StepDef[] = [
  { key: "name", number: 1, label: "Нэр", placeholder: "Жинхэнэ нэрээ бичнэ үү" },
  { key: "age", number: 2, label: "Нас", placeholder: "Жнь: 27", numeric: true },
  {
    key: "status",
    number: 3,
    label: "Status",
    placeholder: "Сонгоно уу",
    options: ["single", "хостой", "гэрлэсэн"],
  },
  {
    key: "why",
    number: 4,
    label: "Чи яагаад ЯГ энэ замаар явж байна?",
    hint: "Юу чамайг өглөө сэрээдэг вэ?",
    placeholder: "Үнэн хэрэгтээ намайг яадгийг бич…",
    multiline: true,
  },
  {
    key: "nowWorkingOn",
    number: 5,
    label: "Яг одоо юу дээр ажиллаж байна?",
    hint: "Энэ долоо хоногийн battlefield",
    placeholder: "Project, target, болзол…",
    multiline: true,
  },
  {
    key: "longTermGoal",
    number: 6,
    label: "5–10 жилийн зорилго?",
    hint: "Тоо биш — мэдрэмж, газар, амьдрал",
    placeholder: "Хаана амьдарч, юу хийж байх вэ?",
    multiline: true,
  },
  {
    key: "giveTake",
    number: 7,
    label: "Энэ community-аас юу АВАХ, харин юу ӨГӨХ-ийг хүсэж байна?",
    placeholder: "Take: …  /  Give: …",
    multiline: true,
  },
];

export default function IntroProtocolModal({ open, onClose, onComplete }: Props) {
  const [step, setStep] = useState(0); // 0..6 questions, 7 = media, 8 = refining
  const [answers, setAnswers] = useState<Answers>({
    name: "", age: "", status: "", why: "", nowWorkingOn: "",
    longTermGoal: "", giveTake: "",
  });
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaPreview, setMediaPreview] = useState("");
  const [mediaIsVideo, setMediaIsVideo] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setError("");
    const t = setTimeout(() => {
      if (taRef.current) taRef.current.focus();
      else if (inputRef.current) inputRef.current.focus();
    }, 80);
    return () => clearTimeout(t);
  }, [open, step]);

  if (!open) return null;

  const total = STEPS.length + 1; // 7 questions + media
  const progress = Math.min(step, total) / total;

  const isQuestionStep = step >= 0 && step < STEPS.length;
  const current = isQuestionStep ? STEPS[step] : null;

  const advance = () => {
    setError("");
    if (current) {
      const value = answers[current.key].trim();
      if (!value) {
        setError("Хариулна уу");
        return;
      }
      if (current.numeric && !/^\d{1,3}$/.test(value)) {
        setError("Зөвхөн тоо");
        return;
      }
      setAnswers((p) => ({ ...p, [current.key]: value }));
    }
    setStep((s) => s + 1);
  };

  const back = () => {
    setError("");
    if (step > 0) setStep((s) => s - 1);
  };

  const setVal = (key: keyof Answers, v: string) => {
    setAnswers((p) => ({ ...p, [key]: v }));
  };

  const onFile = async (file: File) => {
    if (!file) return;
    setError("");
    const isVideo = file.type.startsWith("video/");
    setMediaIsVideo(isVideo);
    setMediaPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error || "Илгээх амжилтгүй");
        setMediaPreview("");
        setMediaIsVideo(false);
        return;
      }
      setMediaUrl(data.url);
    } catch {
      setError("Илгээх амжилтгүй");
      setMediaPreview("");
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    setError("");
    if (!mediaUrl) {
      setError("Зураг эсвэл видео хавсарга");
      return;
    }
    setSubmitting(true);
    setStep(STEPS.length + 1); // refining screen
    try {
      const res = await fetch("/api/users/me/intro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...answers, media: mediaUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Алдаа");
        setStep(STEPS.length); // back to media step
        return;
      }
      onComplete();
    } catch {
      setError("Сүлжээний алдаа");
      setStep(STEPS.length);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEnter = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !current?.multiline) {
      e.preventDefault();
      advance();
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && current?.multiline) {
      e.preventDefault();
      advance();
    }
  };

  const isMediaStep = step === STEPS.length;
  const isRefiningStep = step === STEPS.length + 1;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg overflow-hidden rounded-[4px] border border-[#2E29FF]/40 bg-[#0B0B0F] shadow-[0_0_60px_rgba(46,41,255,0.25)]">
        {/* Header */}
        <div className="border-b border-[rgba(15,23,38,0.06)] px-5 py-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="h-[2px] w-4 bg-[#2E29FF]" />
              <span
                className="text-[11px] font-black uppercase tracking-[0.22em] text-[#0e1726]"
                style={{ fontFamily: "Inter, system-ui, sans-serif" }}
              >
                [ INTRO PROTOCOL · ХҮРЭЭЛЭЛ ]
              </span>
            </div>
            {!isRefiningStep && (
              <button
                onClick={onClose}
                className="text-[#E2E4E8] transition hover:text-[#0e1726]"
                aria-label="Хаах"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <div className="mt-2 h-[2px] w-full overflow-hidden rounded bg-[rgba(46,41,255,0.12)]">
            <div
              className="h-full bg-[#2E29FF] transition-all duration-300"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-6 min-h-[280px]">
          {isQuestionStep && current && (
            <div className="space-y-3">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[12px] font-black text-[#2E29FF]">
                  {String(current.number).padStart(2, "0")} /
                </span>
                <span className="text-[10px] font-mono text-[#E2E4E8]">
                  {current.number} OF {STEPS.length}
                </span>
              </div>
              <h2 className="text-[16px] font-bold leading-snug text-[#0e1726]">
                {current.label}
              </h2>
              {current.hint && (
                <p className="text-[12px] italic text-[#E2E4E8]">({current.hint})</p>
              )}
              {current.options ? (
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {current.options.map((opt) => {
                    const active = answers[current.key] === opt;
                    return (
                      <button
                        key={opt}
                        onClick={() => {
                          setVal(current.key, opt);
                          setTimeout(advance, 120);
                        }}
                        className={`rounded-[4px] border px-3 py-2.5 text-[13px] font-semibold transition ${
                          active
                            ? "border-[#2E29FF] bg-[rgba(46,41,255,0.15)] text-white"
                            : "border-[rgba(15,23,38,0.08)] bg-[rgba(15,23,38,0.02)] text-[#E2E4E8] hover:border-[#2E29FF]/50 hover:text-[#0e1726]"
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              ) : current.multiline ? (
                <textarea
                  ref={taRef}
                  value={answers[current.key]}
                  onChange={(e) => setVal(current.key, e.target.value)}
                  onKeyDown={handleEnter}
                  placeholder={current.placeholder}
                  rows={4}
                  className="w-full resize-none rounded-[4px] border border-[rgba(15,23,38,0.08)] bg-[#f2f5f8] px-3 py-2.5 text-[14px] text-[#0e1726] outline-none transition focus:border-[#2E29FF]"
                />
              ) : (
                <input
                  ref={inputRef}
                  type={current.numeric ? "number" : "text"}
                  inputMode={current.numeric ? "numeric" : "text"}
                  value={answers[current.key]}
                  onChange={(e) => setVal(current.key, e.target.value)}
                  onKeyDown={handleEnter}
                  placeholder={current.placeholder}
                  className="w-full rounded-[4px] border border-[rgba(15,23,38,0.08)] bg-[#f2f5f8] px-3 py-3 text-[15px] text-[#0e1726] outline-none transition focus:border-[#2E29FF]"
                />
              )}
              {error && <p className="text-[12px] text-[#2E29FF]">{error}</p>}
            </div>
          )}

          {isMediaStep && (
            <div className="space-y-3">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[12px] font-black text-[#2E29FF]">⚡</span>
                <span className="text-[10px] font-mono text-[#E2E4E8]">FINAL · MEDIA</span>
              </div>
              <h2 className="text-[16px] font-bold leading-snug text-[#0e1726]">
                Гоё зураг ЭСВЭЛ ажил/амьдралын видео хавсарга
              </h2>
              <p className="text-[12px] italic text-[#E2E4E8]">
                (Зураггүй пост = invisible пост)
              </p>

              {!mediaPreview ? (
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="group flex w-full items-center justify-center gap-2 rounded-[4px] border-2 border-dashed border-[#2E29FF]/40 bg-[rgba(46,41,255,0.04)] px-4 py-8 transition hover:border-[#2E29FF]"
                >
                  <svg className="h-5 w-5 text-[#2E29FF]" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  <span className="text-[13px] font-semibold text-[#0e1726]">
                    {uploading ? "Илгээж байна…" : "Зураг / видео сонгох"}
                  </span>
                </button>
              ) : (
                <div className="relative overflow-hidden rounded-[4px] border border-[rgba(15,23,38,0.08)]">
                  {mediaIsVideo ? (
                    <video src={mediaPreview} controls className="max-h-[260px] w-full bg-black object-contain" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={mediaPreview} alt="preview" className="max-h-[260px] w-full bg-black object-contain" />
                  )}
                  <button
                    onClick={() => {
                      setMediaUrl("");
                      setMediaPreview("");
                      setMediaIsVideo(false);
                    }}
                    disabled={uploading}
                    className="absolute right-2 top-2 rounded-[4px] bg-black/70 p-1.5 text-white transition hover:bg-black"
                    aria-label="Устгах"
                  >
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  {uploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <div className="h-2 w-2 animate-pulse rounded-full bg-[#2E29FF]" />
                    </div>
                  )}
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*,video/mp4,video/quicktime,video/webm"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onFile(f);
                  e.target.value = "";
                }}
              />
              {error && <p className="text-[12px] text-[#2E29FF]">{error}</p>}
            </div>
          )}

          {isRefiningStep && (
            <div className="flex flex-col items-center justify-center gap-4 py-10">
              <div className="relative h-12 w-12">
                <div className="absolute inset-0 animate-ping rounded-[4px] bg-[#2E29FF]/30" />
                <div className="absolute inset-2 rounded-[4px] bg-[#2E29FF]" />
              </div>
              <p
                className="font-mono text-[12px] font-black tracking-[0.22em] text-[#2E29FF]"
                style={{ fontFamily: "Inter, system-ui, sans-serif" }}
              >
                REFINING ENTREPRENEUR PROFILE…
              </p>
              <p className="text-[11px] text-[#E2E4E8]">Танилцуулгыг AI боловсруулж байна.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {!isRefiningStep && (
          <div className="flex items-center justify-between gap-3 border-t border-[rgba(15,23,38,0.06)] bg-[#f2f5f8] px-5 py-3">
            <button
              onClick={back}
              disabled={step === 0}
              className="text-[12px] font-medium text-[#E2E4E8] transition hover:text-[#0e1726] disabled:opacity-30"
            >
              ← Буцах
            </button>
            {isMediaStep ? (
              <button
                onClick={submit}
                disabled={!mediaUrl || uploading || submitting}
                className="rounded-[4px] bg-[#2E29FF] px-5 py-2 text-[13px] font-bold text-white transition hover:shadow-[0_0_18px_rgba(46,41,255,0.45)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Танилцуулга илгээх →
              </button>
            ) : (
              <button
                onClick={advance}
                className="rounded-[4px] bg-[#2E29FF] px-5 py-2 text-[13px] font-bold text-white transition hover:shadow-[0_0_18px_rgba(46,41,255,0.45)]"
              >
                Үргэлжлүүлэх →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
