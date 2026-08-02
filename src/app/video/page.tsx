"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

type Duration = "5" | "10";
type Mode = "std" | "pro";
type Aspect = "16:9" | "9:16" | "1:1";
type Phase = "idle" | "uploading" | "submitting" | "polling" | "done" | "error";

const SUGGESTIONS = [
  "Камер удаанаар ойртож, дүр аажмаар инээмсэглэнэ",
  "Нар жаргах, гэрэл бүдгэрч салхи үсийг хөдөлгөнө",
  "Сансрын оддын дунд биет хөвж эргэлдэнэ",
  "Камер зүүнээс баруун тийш гулсаж панорам үзүүлнэ",
];

const ASPECT_OPTIONS: { value: Aspect; label: string; sub: string; w: number; h: number }[] = [
  { value: "16:9", label: "16:9", sub: "Дэлгэц", w: 32, h: 18 },
  { value: "1:1", label: "1:1", sub: "Квадрат", w: 24, h: 24 },
  { value: "9:16", label: "9:16", sub: "Утас", w: 18, h: 32 },
];

export default function VideoGenPage() {
  const { status } = useSession();

  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [duration, setDuration] = useState<Duration>("5");
  const [mode, setMode] = useState<Mode>("std");
  const [aspect, setAspect] = useState<Aspect>("16:9");

  // Job state
  const [taskId, setTaskId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string>("");
  const [elapsed, setElapsed] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);
  const [dragOver, setDragOver] = useState(false);

  // ─── Upload reference image ────────────────────────────────
  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Зөвхөн зураг файл сонгоно уу");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Файлын хэмжээ 10MB-аас бага байх ёстой");
      return;
    }
    setError(null);
    setPhase("uploading");

    // Local preview
    const localPreview = URL.createObjectURL(file);
    setImagePreview(localPreview);

    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Зураг ачааллахад алдаа гарлаа");
        setImagePreview(null);
        setPhase("idle");
        return;
      }
      setImageUrl(data.url);
      setPhase("idle");
    } catch {
      setError("Сүлжээний алдаа");
      setImagePreview(null);
      setPhase("idle");
    }
  };

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    e.target.value = "";
  };

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current += 1;
    setDragOver(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setDragOver(false);
    }
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const removeImage = () => {
    setImageUrl(null);
    setImagePreview(null);
  };

  // ─── Submit ───────────────────────────────────────────────
  const canSubmit =
    !!imageUrl &&
    prompt.trim().length >= 5 &&
    phase !== "submitting" &&
    phase !== "polling" &&
    phase !== "uploading";

  const submit = async () => {
    if (!canSubmit) return;
    setError(null);
    setPhase("submitting");
    try {
      const res = await fetch("/api/kling/image2video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl,
          prompt,
          negativePrompt,
          duration,
          mode,
          aspectRatio: aspect,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Видео үүсгэх боломжгүй");
        setPhase("error");
        return;
      }
      setTaskId(data.taskId);
      setStatusMsg("Дараалалд орлоо");
      setElapsed(0);
      setPhase("polling");
    } catch {
      setError("Сүлжээний алдаа");
      setPhase("error");
    }
  };

  // ─── Poll status ──────────────────────────────────────────
  useEffect(() => {
    if (phase !== "polling" || !taskId) return;
    let stopped = false;
    const startedAt = Date.now();

    const tick = async () => {
      if (stopped) return;
      try {
        const res = await fetch(`/api/kling/status/${taskId}`);
        const data = await res.json();
        if (!res.ok) {
          if (!stopped) {
            setError(data.error || "Статус авах боломжгүй");
            setPhase("error");
          }
          return;
        }
        if (stopped) return;
        setStatusMsg(
          data.status === "submitted" ? "Дараалалд орлоо"
          : data.status === "processing" ? "Боловсруулж байна"
          : data.status === "succeed" ? "Бэлэн боллоо"
          : data.status === "failed" ? (data.message || "Үүсгэхэд алдаа гарлаа")
          : ""
        );
        if (data.status === "succeed" && data.videoUrl) {
          setVideoUrl(data.videoUrl);
          setPhase("done");
          return;
        }
        if (data.status === "failed") {
          setError(data.message || "Үүсгэхэд алдаа гарлаа");
          setPhase("error");
          return;
        }
      } catch {
        // transient — keep polling
      }
    };

    tick();
    const id = setInterval(tick, 4000);
    const timerId = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => {
      stopped = true;
      clearInterval(id);
      clearInterval(timerId);
    };
  }, [phase, taskId]);

  const reset = () => {
    setPhase("idle");
    setTaskId(null);
    setVideoUrl(null);
    setError(null);
    setElapsed(0);
    setStatusMsg("");
  };

  const newVideo = () => {
    reset();
    setImageUrl(null);
    setImagePreview(null);
    setPrompt("");
    setNegativePrompt("");
  };

  // ─── Sign-in gate ─────────────────────────────────────────
  if (status === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-2 w-2 animate-pulse rounded-full bg-[#1080CA]" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-none bg-[rgba(16,128,202,0.1)]">
          <svg className="h-7 w-7 text-[#1080CA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </div>
        <h1 className="text-[22px] font-bold text-[#0e1726]">Видео үүсгэгч</h1>
        <p className="mt-2 text-[14px] text-[#6b7280]">Нэвтэрсний дараа AI видео үүсгэх боломжтой</p>
        <Link
          href="/auth/signin?callbackUrl=/video"
          className="mt-6 inline-flex rounded-none bg-[#1080CA] px-5 py-2 text-[13px] font-bold text-[#0E0E10] transition hover:shadow-[0_0_24px_rgba(16,128,202,0.25)]"
        >
          Нэвтрэх
        </Link>
      </div>
    );
  }

  // ─── DONE STATE ───────────────────────────────────────────
  if (phase === "done" && videoUrl) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="chrome text-[10px] text-[#6b7280]">RESULT · {duration}s · {mode.toUpperCase()} · {aspect}</p>
            <h1 className="mt-1 text-[20px] font-bold text-[#0e1726]">Видео бэлэн</h1>
          </div>
          <button
            onClick={newVideo}
            className="rounded-none bg-[#1080CA] px-4 py-1.5 text-[12px] font-bold text-[#0E0E10] transition hover:shadow-[0_0_16px_rgba(16,128,202,0.25)]"
          >
            + Шинэ видео
          </button>
        </div>

        <div className="overflow-hidden rounded-none border border-[#F2F2F4] bg-black">
          <video
            src={videoUrl}
            controls
            autoPlay
            loop
            playsInline
            className="w-full"
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={videoUrl}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-none bg-[#1080CA] px-4 py-2 text-[12px] font-bold text-[#0E0E10] transition hover:shadow-[0_0_16px_rgba(16,128,202,0.25)]"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Татаж авах
          </a>
          <button
            onClick={() => navigator.clipboard.writeText(videoUrl)}
            className="rounded-none border border-[#F2F2F4] bg-[#f7f9fb] px-4 py-2 text-[12px] font-medium text-[#475569] transition hover:text-[#0e1726]"
          >
            Линк хуулах
          </button>
          <Link
            href="/posts/new"
            className="rounded-none border border-[#F2F2F4] bg-[#f7f9fb] px-4 py-2 text-[12px] font-medium text-[#475569] transition hover:text-[#0e1726]"
          >
            Пост болгох →
          </Link>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-[120px_1fr]">
          {imagePreview && (
            <img src={imagePreview} alt="reference" className="h-[120px] w-[120px] rounded-none border border-[#F2F2F4] object-cover" />
          )}
          <div className="rounded-none border border-[#F2F2F4] bg-[#f7f9fb] p-3">
            <p className="chrome text-[9px] text-[#94a3b8]">PROMPT</p>
            <p className="mt-1 text-[13px] leading-relaxed text-[#334155]">{prompt}</p>
          </div>
        </div>
      </div>
    );
  }

  // ─── POLLING / SUBMITTING STATE ───────────────────────────
  if (phase === "polling" || phase === "submitting") {
    const estTotal = mode === "pro" ? 240 : 120;
    const pct = Math.min(95, Math.floor((elapsed / estTotal) * 100));
    return (
      <div className="mx-auto max-w-md py-12 text-center">
        <p className="chrome text-[10px] text-[#6b7280]">RENDERING · {duration}s · {mode.toUpperCase()}</p>
        <h1 className="mt-2 text-[22px] font-bold text-[#0e1726]">{statusMsg || "Илгээж байна..."}</h1>
        <p className="mt-1 text-[13px] text-[#6b7280]">
          Видео үүсгэхэд {mode === "pro" ? "3-5 минут" : "1-3 минут"} зарцуулагдана
        </p>

        <div className="mt-6 h-1 w-full overflow-hidden rounded-none bg-[#F2F2F4]">
          <div
            className="h-full bg-gradient-to-r from-[#1080CA] to-[#f2547a] transition-all duration-1000"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-2 text-[11px] tabular-nums text-[#94a3b8]">
          {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
        </p>

        {imagePreview && (
          <img
            src={imagePreview}
            alt="reference"
            className="mx-auto mt-8 h-32 w-32 rounded-none border border-[#F2F2F4] object-cover opacity-60"
          />
        )}

        <button
          onClick={reset}
          className="mt-6 text-[12px] text-[#6b7280] underline-offset-2 hover:text-[#0e1726] hover:underline"
        >
          Цуцлах
        </button>
      </div>
    );
  }

  // ─── IDLE / FORM ──────────────────────────────────────────
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <p className="chrome text-[10px] text-[#6b7280]">AI VIDEO · KLING</p>
        <h1 className="mt-1 text-[24px] font-bold tracking-tight text-[#0e1726] sm:text-[28px]">
          Зургаа видео болго
        </h1>
        <p className="mt-1 text-[13px] text-[#6b7280]">
          Лавлагаа зураг + тайлбар → 5-10 секундын видео
        </p>
      </div>

      {/* STEP 1: IMAGE */}
      <section className="mb-6">
        <div className="mb-2 flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-none bg-[#1080CA] text-[10px] font-bold text-[#0E0E10]">1</span>
          <h2 className="text-[13px] font-semibold text-[#0e1726]">Лавлагаа зураг</h2>
        </div>

        {!imagePreview ? (
          <label
            onDragOver={onDragOver}
            onDragEnter={onDragEnter}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-none border-2 border-dashed py-12 text-center transition ${
              dragOver
                ? "border-[#1080CA] bg-[rgba(16,128,202,0.04)]"
                : "border-[#F2F2F4] bg-[#f7f9fb] hover:border-[#2a2a35]"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={onPickFile}
              className="hidden"
            />
            <svg className="mb-3 h-8 w-8 text-[#94a3b8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-[13px] font-medium text-[#0e1726]">
              Чирээд тавих эсвэл <span className="text-[#1080CA]">сонгох</span>
            </p>
            <p className="mt-1 text-[11px] text-[#94a3b8]">JPG, PNG, WebP · 10MB хүртэл</p>
          </label>
        ) : (
          <div className="relative overflow-hidden rounded-none border border-[#F2F2F4] bg-[#f7f9fb]">
            <img src={imagePreview} alt="reference" className="max-h-[360px] w-full object-contain" />
            {phase === "uploading" && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <div className="text-[12px] text-white">Ачааллаж байна...</div>
              </div>
            )}
            <button
              onClick={removeImage}
              className="absolute right-2 top-2 rounded-none bg-black/70 px-2 py-1 text-[11px] font-medium text-white backdrop-blur transition hover:bg-black"
            >
              ✕ Солих
            </button>
          </div>
        )}
      </section>

      {/* STEP 2: PROMPT */}
      <section className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-none bg-[#1080CA] text-[10px] font-bold text-[#0E0E10]">2</span>
            <h2 className="text-[13px] font-semibold text-[#0e1726]">Хөдөлгөөний тайлбар</h2>
          </div>
          <span className="text-[10px] tabular-nums text-[#94a3b8]">{prompt.length}/2500</span>
        </div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value.slice(0, 2500))}
          placeholder="Жишээ: Камер удаанаар ойртож, дүр инээмсэглэн харна. Гэрэл дулаан өнгөтэй."
          rows={4}
          className="w-full resize-none rounded-none border border-[#F2F2F4] bg-[#f7f9fb] px-3 py-2.5 text-[14px] leading-relaxed text-[#0e1726] placeholder:text-[#94a3b8] focus:border-[#1080CA] focus:outline-none"
        />

        <div className="mt-2 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setPrompt(s)}
              className="rounded-none border border-[#F2F2F4] bg-[#f7f9fb] px-2 py-1 text-[11px] text-[#6b7280] transition hover:border-[#2a2a35] hover:text-[#0e1726]"
            >
              {s}
            </button>
          ))}
        </div>
      </section>

      {/* STEP 3: SETTINGS */}
      <section className="mb-6">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-none bg-[#1080CA] text-[10px] font-bold text-[#0E0E10]">3</span>
          <h2 className="text-[13px] font-semibold text-[#0e1726]">Тохиргоо</h2>
        </div>

        <div className="space-y-3">
          {/* Duration */}
          <div className="flex items-center justify-between gap-3 rounded-none border border-[#F2F2F4] bg-[#f7f9fb] p-3">
            <div>
              <p className="text-[12px] font-semibold text-[#0e1726]">Үргэлжлэх хугацаа</p>
              <p className="text-[10px] text-[#6b7280]">Видеоны урт</p>
            </div>
            <div className="flex gap-1 rounded-none border border-[#F2F2F4] bg-[#060608] p-1">
              {(["5", "10"] as Duration[]).map((d) => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className={`rounded-none px-3 py-1.5 text-[12px] font-semibold transition ${
                    duration === d
                      ? "bg-[#1080CA] text-[#0E0E10]"
                      : "text-[#6b7280] hover:text-[#0e1726]"
                  }`}
                >
                  {d} сек
                </button>
              ))}
            </div>
          </div>

          {/* Mode */}
          <div className="flex items-center justify-between gap-3 rounded-none border border-[#F2F2F4] bg-[#f7f9fb] p-3">
            <div>
              <p className="text-[12px] font-semibold text-[#0e1726]">Чанар</p>
              <p className="text-[10px] text-[#6b7280]">
                {mode === "pro" ? "Илүү дэлгэрэнгүй, удаан" : "Хурдан, чанар сайн"}
              </p>
            </div>
            <div className="flex gap-1 rounded-none border border-[#F2F2F4] bg-[#060608] p-1">
              {(["std", "pro"] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`rounded-none px-3 py-1.5 text-[12px] font-semibold transition ${
                    mode === m
                      ? "bg-[#1080CA] text-[#0E0E10]"
                      : "text-[#6b7280] hover:text-[#0e1726]"
                  }`}
                >
                  {m === "std" ? "Энгийн" : "Pro"}
                </button>
              ))}
            </div>
          </div>

          {/* Aspect */}
          <div className="rounded-none border border-[#F2F2F4] bg-[#f7f9fb] p-3">
            <p className="text-[12px] font-semibold text-[#0e1726]">Хэлбэр</p>
            <p className="mb-3 text-[10px] text-[#6b7280]">Хаана нийтлэх вэ?</p>
            <div className="grid grid-cols-3 gap-2">
              {ASPECT_OPTIONS.map((opt) => {
                const active = aspect === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setAspect(opt.value)}
                    className={`flex flex-col items-center gap-2 rounded-none border p-3 transition ${
                      active
                        ? "border-[#1080CA] bg-[rgba(16,128,202,0.06)]"
                        : "border-[#F2F2F4] bg-[#060608] hover:border-[#2a2a35]"
                    }`}
                  >
                    <div
                      className={`rounded-none border ${active ? "border-[#1080CA]" : "border-[#d5dce3]"}`}
                      style={{ width: opt.w, height: opt.h }}
                    />
                    <div className="text-center">
                      <p className={`text-[12px] font-bold ${active ? "text-[#1080CA]" : "text-[#0e1726]"}`}>{opt.label}</p>
                      <p className="text-[9px] text-[#6b7280]">{opt.sub}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ERROR */}
      {error && (
        <div className="mb-4 rounded-none border border-[#1080CA]/30 bg-[#1080CA]/5 p-3 text-[12px] text-[#8FC1EA]">
          {error}
        </div>
      )}

      {/* CTA */}
      <button
        onClick={submit}
        disabled={!canSubmit}
        className="flex w-full items-center justify-center gap-2 rounded-none bg-[#1080CA] py-3.5 text-[14px] font-bold text-[#0E0E10] transition hover:shadow-[0_0_24px_rgba(16,128,202,0.3)] disabled:cursor-not-allowed disabled:bg-[#F2F2F4] disabled:text-[#94a3b8] disabled:shadow-none"
      >
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
        Видео үүсгэх
        <span className="ml-2 rounded-none bg-black/20 px-2 py-0.5 text-[10px] font-mono">
          ~{mode === "pro" ? "3-5" : "1-3"} мин
        </span>
      </button>

      <p className="mt-3 text-center text-[10px] text-[#94a3b8]">
        Powered by Kling AI · {duration}s · {mode.toUpperCase()} · {aspect}
      </p>
    </div>
  );
}
