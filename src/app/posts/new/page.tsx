"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PaywallGate from "@/components/PaywallGate";
import PromptFile from "@/components/PromptFile";

// ─── Video upload constants ───
// 20 seconds max for short-form posts. We add 0.5s of slack so a 20.0–20.5s
// clip from a phone camera doesn't get rejected for sub-frame drift.
const MAX_VIDEO_DURATION_SEC = 20;
const VIDEO_DURATION_SLACK = 0.5;
const MAX_VIDEO_SIZE_BYTES = 25 * 1024 * 1024;

interface TaskData {
  _id: string;
  title: string;
  description: string;
  xpReward: number;
  status: string;
}

// Categories are loaded dynamically from /api/categories. Admins can add
// new ones at /admin/categories. The fixed list below is a fallback for
// instant render before the fetch resolves.
interface Category {
  slug: string;
  name: string;
  color: string;
  iconPath: string;
  order: number;
}

const FALLBACK_CATEGORIES: Category[] = [
  { slug: "пост", name: "пост", color: "#6b7280", iconPath: "", order: 0 },
];

function tintFor(hex: string) {
  // 12% alpha tint as rgba — keeps dark UI readable.
  const m = hex.match(/^#([0-9a-f]{6})$/i);
  if (!m) return "rgba(16,128,202,0.12)";
  const v = parseInt(m[1], 16);
  const r = (v >> 16) & 255, g = (v >> 8) & 255, b = v & 255;
  return `rgba(${r},${g},${b},0.12)`;
}

export default function NewPost() {
  return (
    <PaywallGate>
      <NewPostContent />
    </PaywallGate>
  );
}

function NewPostContent() {
  const { data: session } = useSession();
  const router = useRouter();
  const [content, setContent] = useState("");
  // Carousel arrays — parallel by index. URL is "" while upload in flight.
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [categories, setCategories] = useState<Category[]>(FALLBACK_CATEGORIES);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  // Default to "ялалт" (community wins) — most engagement, friendly default.
  // Old "пост" generic was retired from the visible category set.
  const [category, setCategory] = useState<string>("ялалт");
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [questOpen, setQuestOpen] = useState(false);
  const [autoTagging, setAutoTagging] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ─── Video state ───
  // Single video per post. preview = local blob URL for the player; url = the
  // server-hosted /uploads path returned by the upload API; duration is sent
  // to the post API for indexing.
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [videoPreview, setVideoPreview] = useState<string>("");
  const [videoDurationSec, setVideoDurationSec] = useState<number>(0);
  const [videoUploading, setVideoUploading] = useState(false);
  const videoFileRef = useRef<HTMLInputElement>(null);

  // Composer is text + media upload only. AI generation surfaces (Nano Banana
  // image gen, Kling i2v) were removed — those live in /tools/* as dedicated
  // products. The post composer stays focused: write, attach, ship.

  useEffect(() => {
    fetch("/api/tasks")
      .then((r) => r.json())
      .then((d) => {
        if (d.tasks) {
          const openTasks = d.tasks.filter((t: TaskData) => t.status === "open");
          setTasks(openTasks);
        }
      })
      .catch(() => {});
    fetch("/api/categories")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.categories) && d.categories.length > 0) {
          setCategories(d.categories);
          // Pick a sensible default from the visible whitelist; fall back to
          // the first category the API actually returns.
          const PREFERRED = ["ялалт", "промт", "мэдээлэл", "бүтээл"];
          const found = PREFERRED.find((slug) => d.categories.some((c: Category) => c.slug === slug));
          if (found) setCategory(found);
          else setCategory(d.categories[0].slug);
        }
      })
      .catch(() => {});
  }, []);

  const MAX_IMAGES = 10;

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;
    const remaining = MAX_IMAGES - imagePreviews.length;
    if (remaining <= 0) {
      setError(`Хамгийн ихдээ ${MAX_IMAGES} зураг`);
      return;
    }
    const accepted: File[] = [];
    // iOS sometimes hands back files with an empty MIME or
    // "application/octet-stream" for HEIC. Allow those through — the server
    // does the real magic-byte check.
    const looksLikeImage = (f: File) =>
      f.type === "" ||
      f.type.startsWith("image/") ||
      f.type === "application/octet-stream" ||
      /\.(jpg|jpeg|png|webp|gif|heic|heif|avif)$/i.test(f.name);
    let tooBig = 0;
    let wrongType = 0;
    for (const f of files.slice(0, remaining)) {
      if (!looksLikeImage(f)) { wrongType++; continue; }
      if (f.size > 12 * 1024 * 1024) { tooBig++; continue; }
      accepted.push(f);
    }
    if (accepted.length === 0) {
      // Be specific about why nothing was accepted
      if (tooBig > 0 && wrongType === 0) setError(`${tooBig} файл 12MB-с том. Багасгана уу.`);
      else if (wrongType > 0 && tooBig === 0) setError(`${wrongType} файл зураг биш.`);
      else setError("Зураг сонгогдсонгүй.");
      return;
    }
    // Partial-success feedback so users know SOME files were skipped
    if (tooBig > 0 || wrongType > 0) {
      const parts: string[] = [];
      if (tooBig > 0) parts.push(`${tooBig} нь дэндүү том`);
      if (wrongType > 0) parts.push(`${wrongType} нь зураг биш`);
      setError(`${parts.join(" · ")}, бусдыг нь оруулж байна`);
    }

    setError("");
    // Optimistic preview rows — keep order, blank URL until upload returns.
    const newPreviews = accepted.map((f) => URL.createObjectURL(f));
    setImagePreviews((prev) => [...prev, ...newPreviews]);
    setImageUrls((prev) => [...prev, ...accepted.map(() => "")]);
    setUploading(true);

    try {
      // Upload in parallel — preserve original order via base index.
      const baseIndex = imagePreviews.length;
      const results = await Promise.all(
        accepted.map(async (f) => {
          const fd = new FormData();
          fd.append("file", f);
          try {
            const res = await fetch("/api/upload", { method: "POST", body: fd });
            const data = await res.json();
            return res.ok && data.url ? data.url : null;
          } catch {
            return null;
          }
        })
      );

      // Drop failed uploads (and their previews) from the list.
      setImageUrls((prev) => {
        const next = [...prev];
        for (let i = 0; i < results.length; i++) {
          const url = results[i];
          if (url) next[baseIndex + i] = url;
        }
        return next;
      });
      const failedIdxs = results
        .map((url, i) => (url ? -1 : baseIndex + i))
        .filter((i) => i >= 0);
      if (failedIdxs.length > 0) {
        setError("Зарим зураг оруулах амжилтгүй");
        setImageUrls((prev) => prev.filter((_, i) => !failedIdxs.includes(i)));
        setImagePreviews((prev) => prev.filter((_, i) => !failedIdxs.includes(i)));
      }
    } finally {
      setUploading(false);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) handleFiles(files);
    if (fileRef.current) fileRef.current.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) handleFiles(files);
  };

  const removeImage = (idx: number) => {
    setImageUrls((prev) => prev.filter((_, i) => i !== idx));
    setImagePreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  // ─── Video upload ───
  // Probes duration via a hidden <video> element BEFORE uploading so we don't
  // waste bytes on >20s clips. If duration check passes, upload as a normal
  // multipart POST to /api/upload and store the returned URL.
  const probeVideoDuration = (file: File): Promise<number> => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.src = url;
    v.onloadedmetadata = () => {
      const d = v.duration;
      URL.revokeObjectURL(url);
      if (!Number.isFinite(d)) reject(new Error("no metadata"));
      else resolve(d);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode failed"));
    };
  });

  const handleVideoFile = async (file: File | undefined | null) => {
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      setError("Зөвхөн видео файл сонгоно уу");
      return;
    }
    if (file.size > MAX_VIDEO_SIZE_BYTES) {
      setError(`Видео ${Math.floor(MAX_VIDEO_SIZE_BYTES / 1024 / 1024)}MB-аас бага байх ёстой`);
      return;
    }
    setError("");

    let dur = 0;
    try {
      dur = await probeVideoDuration(file);
    } catch {
      setError("Видеоны мета мэдээлэл унших боломжгүй");
      return;
    }
    if (dur > MAX_VIDEO_DURATION_SEC + VIDEO_DURATION_SLACK) {
      setError(`Видео ${MAX_VIDEO_DURATION_SEC} секундээс хэтрэх ёсгүй (одоо ${dur.toFixed(1)}с).`);
      return;
    }

    // Local preview while uploading — feels instant
    const localUrl = URL.createObjectURL(file);
    setVideoPreview(localUrl);
    setVideoDurationSec(Math.round(dur));
    setVideoUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error || "Видео илгээх амжилтгүй");
        setVideoPreview("");
        setVideoDurationSec(0);
        return;
      }
      setVideoUrl(data.url);
    } catch {
      setError("Видео илгээх амжилтгүй");
      setVideoPreview("");
      setVideoDurationSec(0);
    } finally {
      setVideoUploading(false);
    }
  };

  const onVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleVideoFile(file);
    if (videoFileRef.current) videoFileRef.current.value = "";
  };

  const removeVideo = () => {
    if (videoPreview) URL.revokeObjectURL(videoPreview);
    setVideoUrl("");
    setVideoPreview("");
    setVideoDurationSec(0);
  };

  // A post is ready when any uploaded URL exists OR text is present.
  const validUrls = imageUrls.filter((u) => u.length > 0);
  const canPost = !loading && !uploading && !videoUploading && (content.trim().length > 0 || validUrls.length > 0 || videoUrl.length > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canPost) return;

    setError("");
    setLoading(true);

    try {
      const body: Record<string, unknown> = {
        content: content.trim(),
        // First image kept in `image` for back-compat; `images[]` is canonical.
        image: validUrls[0] || "",
        images: validUrls,
        category,
      };
      if (videoUrl) {
        body.video = videoUrl;
        body.videoDurationSec = videoDurationSec;
      }
      if (selectedTask) body.taskId = selectedTask;

      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      router.push("/");
    } finally {
      setLoading(false);
    }
  };

  if (!session) return null;

  const active = categories.find((c) => c.slug === category) || categories[0] || FALLBACK_CATEGORIES[0];
  const activeTint = tintFor(active.color);
  const selTask = tasks.find((t) => t._id === selectedTask);

  // Threads-style composer — modal frame on a dimmed backdrop, clean
  // single-column body, sticky top bar with close + post. Clicking the
  // backdrop closes by going back in history.
  const userName = (session.user as { name?: string })?.name || "Та";
  const userAvatar = (session.user as { image?: string })?.image || "";

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={() => router.back()}
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-start sm:p-6 sm:pt-[6vh]"
      >
        <motion.div
          initial={{ y: 24, opacity: 0.85 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-[600px] max-h-[92vh] overflow-hidden rounded-t-[16px] border-t border-[rgba(15,23,38,0.08)] bg-[#f2f5f8] shadow-[0_-12px_40px_rgba(0,0,0,0.5)] sm:rounded-none sm:border"
        >
          {/* ─── Sticky top bar: close ✕  ·  title  ·  Нийтлэх ─────────── */}
          <div className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-[rgba(15,23,38,0.06)] bg-[#f2f5f8] px-4 py-3">
            <button
              type="button"
              onClick={() => router.back()}
              aria-label="Хаах"
              className="flex h-8 w-8 items-center justify-center rounded-full text-[#6b7280] transition hover:bg-[rgba(15,23,38,0.06)] hover:text-[#0e1726]"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h1 className="text-[15px] font-black text-[#0e1726]">
              Шинэ пост
            </h1>
            <button
              type="submit"
              form="new-post-form"
              disabled={!canPost}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#0e1726] px-4 py-1.5 text-[13px] font-bold text-black transition hover:bg-white disabled:bg-[#e2e8ef] disabled:text-[#94a3b8]"
            >
              {loading ? "..." : "Нийтлэх"}
            </button>
          </div>

          {/* ─── Scrollable body ─────────────────────────────────────────── */}
          <div className="max-h-[calc(92vh-56px)] overflow-y-auto">
            {error && (
              <div className="mx-4 mt-3 rounded-none border border-[#0C3050]/50 bg-[#07203A]/30 px-3 py-2 text-[12px] text-[#4E94D0]">
                {error}
              </div>
            )}

            <form
              id="new-post-form"
              onSubmit={handleSubmit}
              onDragOver={(e) => {
                if (Array.from(e.dataTransfer.items || []).some((it) => it.kind === "file")) {
                  e.preventDefault();
                  if (!dragOver) setDragOver(true);
                }
              }}
              onDragLeave={(e) => {
                if (e.currentTarget === e.target) setDragOver(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const files = Array.from(e.dataTransfer.files || []);
                if (files.length > 0) handleFiles(files);
              }}
              onPaste={(e) => {
                const items = Array.from(e.clipboardData?.items || []);
                const imgs: File[] = [];
                for (const it of items) {
                  if (it.kind === "file" && it.type.startsWith("image/")) {
                    const f = it.getAsFile();
                    if (f) imgs.push(f);
                  }
                }
                if (imgs.length > 0) {
                  e.preventDefault();
                  handleFiles(imgs);
                }
              }}
              className="relative px-4 pb-6 pt-4 sm:px-5"
            >
              {/* Drag/drop overlay */}
              {dragOver && (
                <div className="pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-none border-2 border-dashed border-[#1080CA] bg-[rgba(16,128,202,0.08)] backdrop-blur-sm">
                  <span className="rounded-full bg-[#1080CA] px-3 py-1.5 text-[11px] font-bold text-[#0E0E10]">
                    Зургийг энд тавь
                  </span>
                </div>
              )}

              {/* ─── Author row — avatar · name · category chip ─── */}
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[#F2F2F4]">
                  {userAvatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={userAvatar} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[14px] font-black text-[#6b7280]">
                      {userName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-bold text-[#0e1726]">{userName}</div>
                  <button
                    type="button"
                    onClick={() => setCatOpen(true)}
                    className="mt-0.5 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold transition hover:opacity-90"
                    style={{
                      background: activeTint,
                      color: active.color,
                    }}
                  >
                    {active.iconPath && (
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d={active.iconPath} />
                      </svg>
                    )}
                    {active.name}
                    <svg className="h-2.5 w-2.5 opacity-60" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* ─── Main textarea — no border, lots of breathing room ─── */}
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={category === "промт" ? "Промтоо шигтгэ..." : "Юу шинэ?"}
                rows={Math.min(20, Math.max(3, content.split("\n").length + 1))}
                maxLength={50000}
                autoFocus
                className={`mt-3 w-full resize-none border-0 bg-transparent text-[#0e1726] placeholder-[#94a3b8] focus:outline-none ${
                  category === "промт" || content.length > 500
                    ? "text-[13px] leading-[1.65] font-mono"
                    : "text-[16px] leading-[1.55]"
                }`}
                style={
                  category === "промт" || content.length > 500
                    ? { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }
                    : undefined
                }
              />

              {/* ─── Prompt-file preview when content reads like a prompt ─── */}
              {(category === "промт" || content.length > 500) && content.trim().length > 20 && (
                <div className="mt-3">
                  <PromptFile
                    text={content}
                    category={category}
                    unlocked
                    hideAiLink
                    compact
                  />
                </div>
              )}

              {/* ─── Upload section — prominent tap zones (hide once anything uploaded) ─── */}
              {imagePreviews.length === 0 && !videoPreview && !videoUploading && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => { if (fileRef.current) fileRef.current.value = ""; fileRef.current?.click(); }}
                    className="group flex flex-col items-center justify-center gap-1.5 rounded-none border border-dashed border-[rgba(15,23,38,0.14)] bg-[rgba(15,23,38,0.02)] px-3 py-5 text-center transition hover:border-[rgba(16,128,202,0.5)] hover:bg-[rgba(16,128,202,0.04)]"
                  >
                    <svg className="h-6 w-6 text-[#5b6573] group-hover:text-[#1080CA]" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                    </svg>
                    <span className="text-[12px] font-bold text-[#0e1726]">Зураг нэмэх</span>
                    <span className="text-[10px] text-[#6b7280]">PNG · JPG · 4 хүртэл</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { if (videoFileRef.current) videoFileRef.current.value = ""; videoFileRef.current?.click(); }}
                    className="group flex flex-col items-center justify-center gap-1.5 rounded-none border border-dashed border-[rgba(15,23,38,0.14)] bg-[rgba(15,23,38,0.02)] px-3 py-5 text-center transition hover:border-[rgba(16,128,202,0.5)] hover:bg-[rgba(16,128,202,0.04)]"
                  >
                    <svg className="h-6 w-6 text-[#5b6573] group-hover:text-[#1080CA]" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                    <span className="text-[12px] font-bold text-[#0e1726]">Видео нэмэх</span>
                    <span className="text-[10px] text-[#6b7280]">MP4 · 20с · 3:4</span>
                  </button>
                </div>
              )}

              {/* ─── Image strip ─── */}
              {imagePreviews.length > 0 && (
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {imagePreviews.map((src, idx) => {
                    const url = imageUrls[idx];
                    const stillUploading = !url;
                    return (
                      <div
                        key={idx}
                        className="relative h-28 w-28 shrink-0 overflow-hidden rounded-none border border-[rgba(15,23,38,0.06)] bg-[#ffffff]"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt="" className="h-full w-full object-cover" />
                        {stillUploading && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#1080CA]" />
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => removeImage(idx)}
                          className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/80 text-white hover:text-[#0E0E10] backdrop-blur-sm transition hover:bg-[#1080CA]"
                          aria-label="Устгах"
                        >
                          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ─── Video preview ─── */}
              <AnimatePresence>
                {videoPreview && (
                  <motion.div
                    key="video-preview"
                    initial={{ opacity: 0, y: 6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    className="relative mx-auto mt-3 aspect-[3/4] max-w-[360px] overflow-hidden rounded-none border border-[rgba(15,23,38,0.06)] bg-[#ffffff]"
                  >
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                    <video
                      src={videoPreview}
                      className="absolute inset-0 h-full w-full object-cover bg-black"
                      controls
                      playsInline
                      preload="metadata"
                    />
                    {videoUploading && (
                      <div className="absolute inset-0 grid place-items-center bg-black/55">
                        <span className="font-mono text-[10px] tracking-[0.18em] text-[#1080CA]">UPLOADING…</span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={removeVideo}
                      className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/80 text-white hover:text-[#0E0E10] backdrop-blur-sm transition hover:bg-[#1080CA]"
                      aria-label="Устгах"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ─── Quest selector (only when open tasks exist) ─── */}
              {tasks.length > 0 && (
                <div className="mt-4 overflow-hidden rounded-none border border-[rgba(15,23,38,0.06)]">
                  <button
                    type="button"
                    onClick={() => setQuestOpen((v) => !v)}
                    className="flex w-full items-center justify-between px-3 py-2.5 text-left transition hover:bg-[rgba(15,23,38,0.02)]"
                  >
                    <div className="flex items-center gap-2">
                      <svg className="h-3.5 w-3.5 text-[#1080CA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span className="text-[12px] font-semibold text-[#0e1726]">
                        {selTask ? (
                          <>
                            {selTask.title}{" "}
                            <span className="text-[10px] font-bold text-[#1080CA]">+{selTask.xpReward} XP</span>
                          </>
                        ) : (
                          "Даалгаварт холбож XP"
                        )}
                      </span>
                    </div>
                    <svg
                      className={`h-3.5 w-3.5 text-[#6b7280] transition-transform ${questOpen ? "rotate-180" : ""}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {questOpen && (
                    <div className="border-t border-[rgba(15,23,38,0.06)] p-2.5">
                      <div className="grid gap-1.5 sm:grid-cols-2">
                        {tasks.map((task, i) => {
                          const sel = selectedTask === task._id;
                          return (
                            <button
                              key={task._id}
                              type="button"
                              onClick={() => setSelectedTask(sel ? null : task._id)}
                              className={`rounded-none border px-3 py-2 text-left transition ${
                                sel
                                  ? "border-[rgba(16,128,202,0.5)] bg-[rgba(16,128,202,0.06)]"
                                  : "border-[rgba(15,23,38,0.06)] bg-[#ffffff] hover:border-[rgba(15,23,38,0.12)]"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-bold ${sel ? "text-[#1080CA]" : "text-[#6b7280]"}`}>
                                  #{i + 1}
                                </span>
                                <span className="flex-1 truncate text-[12px] font-semibold text-[#0e1726]">
                                  {task.title}
                                </span>
                                <span className="rounded-none bg-[rgba(16,128,202,0.12)] px-1.5 py-0.5 text-[9px] font-bold text-[#1080CA]">
                                  +{task.xpReward}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ─── Action row: media icons · auto-tag · char counter ─── */}
              <div className="mt-4 flex items-center justify-between gap-2 border-t border-[rgba(15,23,38,0.06)] pt-3">
                <div className="flex items-center gap-1">
                  {/* Image + video as labeled pills — discoverable at a glance.
                      Counter pill on image shows how many are attached. Green
                      dot on video signals an attachment is already loaded. */}
                  <button
                    type="button"
                    onClick={() => { if (fileRef.current) fileRef.current.value = ""; fileRef.current?.click(); }}
                    disabled={imagePreviews.length >= MAX_IMAGES}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(15,23,38,0.08)] px-3 py-1.5 text-[12px] font-bold text-[#334155] transition hover:border-[rgba(16,128,202,0.4)] hover:text-[#1080CA] disabled:opacity-30"
                  >
                    <svg className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z" />
                    </svg>
                    Зураг
                    {imagePreviews.length > 0 && (
                      <span
                        className="rounded-full bg-[rgba(16,128,202,0.15)] px-1.5 text-[10px] font-black tabular-nums"
                        style={{ color: "#1080CA" }}
                      >
                        {imagePreviews.length}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => { if (videoFileRef.current) videoFileRef.current.value = ""; videoFileRef.current?.click(); }}
                    disabled={!!videoPreview}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(15,23,38,0.08)] px-3 py-1.5 text-[12px] font-bold text-[#334155] transition hover:border-[rgba(16,128,202,0.4)] hover:text-[#1080CA] disabled:opacity-30"
                  >
                    <svg className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                    Видео
                    {videoPreview && (
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: "#4FE065", boxShadow: "0 0 6px #4FE065" }}
                      />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (autoTagging) return;
                      const text = content.trim();
                      if (text.length < 8) return;
                      setAutoTagging(true);
                      try {
                        const r = await fetch("/api/posts/auto-tag", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ content: text }),
                        });
                        if (r.ok) {
                          const d = await r.json() as { category?: string };
                          if (d.category) setCategory(d.category);
                        }
                      } finally {
                        setAutoTagging(false);
                      }
                    }}
                    disabled={content.trim().length < 8 || autoTagging}
                    title="Категори оноох"
                    className="flex h-9 w-9 items-center justify-center rounded-full text-[#6b7280] transition hover:bg-[rgba(16,128,202,0.08)] hover:text-[#1080CA] disabled:opacity-30"
                  >
                    {autoTagging ? (
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-[#1080CA] border-t-transparent" />
                    ) : (
                      <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                      </svg>
                    )}
                  </button>
                </div>
                <span className="font-mono text-[10px] tabular-nums text-[#6b7280]">
                  {content.length.toLocaleString()}
                  {content.length > 500 && <> · ~{Math.max(1, Math.round(content.length / 4)).toLocaleString()}t</>}
                </span>
              </div>

              {/* Hidden file inputs — kept off-screen so Safari fires .click() */}
              <input
                ref={fileRef}
                type="file"
                multiple
                accept="image/*"
                onChange={onFileChange}
                style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0 }}
                tabIndex={-1}
                aria-hidden
              />
              <input
                ref={videoFileRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                onChange={onVideoChange}
                style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0 }}
                tabIndex={-1}
                aria-hidden
              />
            </form>
          </div>
        </motion.div>
      </motion.div>

      {/* ─── Category popup — opens from the chip in the author row ─── */}
      <CategoryPickerSheet
        open={catOpen}
        onClose={() => setCatOpen(false)}
        categories={categories}
        selected={category}
        onPick={(slug) => {
          setCategory(slug);
          setCatOpen(false);
        }}
      />
    </>
  );
}

// ─── Category picker — modal on desktop, bottom sheet on mobile ─────────
// Shows every available category as a tappable card so power users can pick
// the niche ones (the old composer hid them behind a 4-item whitelist).
function CategoryPickerSheet({
  open, onClose, categories, selected, onPick,
}: {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  selected: string;
  onPick: (slug: string) => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4"
        >
          <motion.div
            initial={{ y: 32, opacity: 0.6 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 32, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[480px] max-h-[88vh] overflow-y-auto rounded-t-[8px] border-t border-[rgba(15,23,38,0.08)] bg-[#f2f5f8] sm:max-h-[80vh] sm:rounded-none sm:border"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[rgba(15,23,38,0.06)] bg-[#f2f5f8] px-5 py-3.5">
              <h2 className="text-[14px] font-black text-[#0e1726]">Категори сонгох</h2>
              <button onClick={onClose} aria-label="Хаах" className="flex h-7 w-7 items-center justify-center rounded-none text-[#6b7280] transition hover:bg-[rgba(15,23,38,0.06)] hover:text-[#0e1726]">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 p-4">
              {categories.map((c) => {
                const isActive = c.slug === selected;
                const tint = tintFor(c.color);
                return (
                  <button
                    key={c.slug}
                    type="button"
                    onClick={() => onPick(c.slug)}
                    className="group flex items-center gap-2.5 rounded-none border px-3 py-3 text-left transition"
                    style={{
                      borderColor: isActive ? c.color : "rgba(15,23,38,0.08)",
                      background: isActive ? tint : "#16161c",
                    }}
                  >
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-none"
                      style={{ background: tint, color: c.color }}
                    >
                      {c.iconPath ? (
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d={c.iconPath} />
                        </svg>
                      ) : (
                        <span className="text-[14px] font-black">#</span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className="block truncate text-[13px] font-bold"
                        style={{ color: isActive ? c.color : "#0e1726" }}
                      >
                        {c.name}
                      </span>
                      <span className="block truncate text-[10px] text-[#6b7280]">
                        {c.slug}
                      </span>
                    </span>
                    {isActive && (
                      <svg className="h-4 w-4 shrink-0" fill="none" stroke={c.color} strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
