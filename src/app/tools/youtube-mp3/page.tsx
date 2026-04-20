"use client";

import { useState, useRef } from "react";
import Link from "next/link";

type Status = "idle" | "loading" | "done" | "error";

export default function YouTubeMp3Page() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [info, setInfo] = useState<{ title: string; thumbnail: string; duration: string } | null>(null);
  const [progress, setProgress] = useState(0);
  const linkRef = useRef<HTMLAnchorElement>(null);

  const isValidUrl = (u: string) => {
    return /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)[\w-]+/.test(u);
  };

  const handleDownload = async () => {
    if (!url.trim() || !isValidUrl(url)) {
      setError("YouTube линк оруулна уу");
      return;
    }
    setError("");
    setStatus("loading");
    setProgress(0);
    setInfo(null);

    // Simulate progress
    const interval = setInterval(() => {
      setProgress((p) => Math.min(p + Math.random() * 15, 90));
    }, 500);

    try {
      const res = await fetch("/api/tools/youtube-mp3", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      clearInterval(interval);

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Татаж чадсангүй");
      }

      const data = await res.json();
      setInfo({ title: data.title, thumbnail: data.thumbnail, duration: data.duration });
      setProgress(100);
      setStatus("done");

      // Auto trigger download
      if (data.downloadUrl) {
        const a = document.createElement("a");
        a.href = data.downloadUrl;
        a.download = `${data.title || "audio"}.mp3`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (err) {
      clearInterval(interval);
      setError(err instanceof Error ? err.message : "Алдаа гарлаа");
      setStatus("error");
      setProgress(0);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setUrl(text);
    } catch {
      // clipboard access denied
    }
  };

  const reset = () => {
    setUrl("");
    setStatus("idle");
    setError("");
    setInfo(null);
    setProgress(0);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <div className="mx-auto max-w-lg px-4 py-12">
        {/* Back */}
        <Link href="/services" className="mb-8 inline-flex items-center gap-1.5 text-[12px] text-[#666] transition hover:text-[#EF2C58]">
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Үйлчилгээ
        </Link>

        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EF2C58]">
            <svg className="h-8 w-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
            </svg>
          </div>
          <h1 className="text-[24px] font-bold text-white">YouTube → MP3</h1>
          <p className="mt-1 text-[13px] text-[#666]">YouTube видеог MP3 аудио болгож татах</p>
        </div>

        {/* Input */}
        <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#111] p-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="url"
                value={url}
                onChange={(e) => { setUrl(e.target.value); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleDownload()}
                placeholder="https://youtube.com/watch?v=..."
                className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-4 py-3 pr-16 text-[14px] text-white outline-none transition placeholder:text-[#444] focus:border-[#EF2C58]"
                disabled={status === "loading"}
              />
              <button
                onClick={handlePaste}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-[rgba(255,255,255,0.06)] px-2.5 py-1 text-[10px] font-bold text-[#888] transition hover:bg-[rgba(255,255,255,0.1)] hover:text-white"
              >
                PASTE
              </button>
            </div>
          </div>

          {error && (
            <p className="mt-3 text-[12px] text-[#EF2C58]">{error}</p>
          )}

          {/* Progress */}
          {status === "loading" && (
            <div className="mt-4">
              <div className="h-1 overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
                <div
                  className="h-full rounded-full bg-[#EF2C58] transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-2 text-center text-[11px] text-[#666]">Хөрвүүлж байна... {Math.round(progress)}%</p>
            </div>
          )}

          {/* Result */}
          {status === "done" && info && (
            <div className="mt-4 rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#0A0A0A] p-4">
              <div className="flex items-center gap-3">
                {info.thumbnail && (
                  <img src={info.thumbnail} alt="" className="h-12 w-16 rounded-md object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-white">{info.title}</p>
                  <p className="text-[11px] text-[#666]">{info.duration}</p>
                </div>
                <svg className="h-5 w-5 shrink-0 text-[#22C55E]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                </svg>
              </div>
            </div>
          )}

          {/* Action button */}
          <button
            onClick={status === "done" ? reset : handleDownload}
            disabled={status === "loading"}
            className="mt-4 w-full rounded-lg bg-[#EF2C58] py-3 text-[14px] font-bold text-white transition hover:brightness-110 disabled:opacity-50"
          >
            {status === "loading" ? "Хөрвүүлж байна..." : status === "done" ? "Шинэ татах" : "MP3 татах"}
          </button>
        </div>

        {/* Features */}
        <div className="mt-8 grid grid-cols-3 gap-3">
          {[
            { icon: "M13 10V3L4 14h7v7l9-11h-7z", label: "Хурдан" },
            { icon: "M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3", label: "320kbps" },
            { icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z", label: "Аюулгүй" },
          ].map((f) => (
            <div key={f.label} className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#111] p-3 text-center">
              <svg className="mx-auto mb-1.5 h-5 w-5 text-[#EF2C58]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={f.icon} />
              </svg>
              <span className="text-[11px] font-semibold text-[#888]">{f.label}</span>
            </div>
          ))}
        </div>

        <p className="mt-6 text-center text-[10px] text-[#444]">
          Зөвхөн хувийн хэрэглээнд зориулагдсан. Зохиогчийн эрхийг хүндэтгэнэ үү.
        </p>
      </div>
      <a ref={linkRef} className="hidden" />
    </div>
  );
}
