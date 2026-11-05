"use client";

import { useSession } from "next-auth/react";
import { isAdminEmail } from "@/lib/adminClient";
import { emitXPFromResponse } from "@/lib/xpToast";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { REEL_CATEGORIES } from "@/lib/reelCategories";
import { BrandCard } from "@/components/BrandFeed";
import { motion, AnimatePresence } from "framer-motion";
import PaywallGate from "@/components/PaywallGate";
import PromptFile from "@/components/PromptFile";

// ─── Video upload constants ───
// 20 seconds max for short-form posts. We add 0.5s of slack so a 20.0–20.5s
// clip from a phone camera doesn't get rejected for sub-frame drift.
const MAX_VIDEO_DURATION_SEC = 60; // reel (2026-10-06; өмнө 20)
const VIDEO_DURATION_SLACK = 0.5;
const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024;

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

/* 2026-10-06: ЗӨВХӨН REEL — ангилал нь гуравхан (src/lib/reelCategories). */
const FALLBACK_CATEGORIES: Category[] = REEL_CATEGORIES.map((c, i) => ({
  slug: c.slug, name: c.name, color: "#2E29FF", iconPath: "", order: i,
}));

const DEFAULT_CAT_COLOR = "#2E29FF";

function tintFor(hex?: string) {
  // 12% alpha tint as rgba — keeps dark UI readable.
  // `hex` is optional on purpose: a Category row saved without a colour used
  // to reach here as undefined and throw on .match(), which took the whole
  // composer down behind the app error boundary.
  const m = hex?.match(/^#([0-9a-f]{6})$/i);
  if (!m) return "rgba(46,41,255,0.12)";
  const v = parseInt(m[1], 16);
  const r = (v >> 16) & 255, g = (v >> 8) & 255, b = v & 255;
  return `rgba(${r},${g},${b},0.12)`;
}

export default function NewPost() {
  return (
    <PaywallGate requireMembership={false}>
      <NewPostContent />
    </PaywallGate>
  );
}

const XP_TARGETS = [
  { key: "instagram", label: "Instagram" },
  { key: "facebook", label: "Facebook" },
  { key: "threads", label: "Threads" },
] as const;

function NewPostContent() {
  const { data: session } = useSession();
  const isAdmin = isAdminEmail(session?.user?.email);
  /* AI caption (2026-10-09) — видеоны кадр + санаанаас Gemini бичнэ. */
  const [aiBusy, setAiBusy] = useState(false);
  /* Давхар нийтлэх сувгууд (зөвхөн админ) — IG + FB анхдагчаар асаалттай. */
  /* 2026-10-11: Threads АНХДАГЧААР асаалттай — текст бичихэд Threads-д гарна
     (Instagram медиагүй постыг өөрөө алгасна). */
  const [xp, setXp] = useState<string[]>(["instagram", "facebook", "threads"]);
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
  const [category, setCategory] = useState<string>("ерөнхий");
  /* 2026-10-11: харьцаа (зураг/видео) ба брэнд карт (зөвхөн текст). */
  const [aspect, setAspect] = useState<string>("");
  const [card, setCard] = useState(false);
  /* Ноорог (2026-10-11): бичсэн текст энэ төхөөрөмж дээр автоматаар хадгалагдана;
     "Ноорог" товч хадгалаад хаана, амжилттай нийтлэхэд цэвэрлэнэ. */
  const [emojiOpen, setEmojiOpen] = useState(false);
  useEffect(() => {
    try { const d = localStorage.getItem("antaqor-draft"); if (d) setContent((c) => c || d); } catch { /* storage алга */ }
  }, []);
  useEffect(() => {
    try { if (content.trim()) localStorage.setItem("antaqor-draft", content); } catch { /* storage алга */ }
  }, [content]);
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
  const [uploadPct, setUploadPct] = useState(0);
  const videoFileRef = useRef<HTMLInputElement>(null);
  // PDF хавсралт (2026-10-27)
  const pdfFileRef = useRef<HTMLInputElement>(null);
  const [pdf, setPdf] = useState<{ url: string; name: string; size: number } | null>(null);
  const [pdfUploading, setPdfUploading] = useState(false);
  async function onPdfChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 15 * 1024 * 1024) { setError("PDF дээд тал нь 15MB"); return; }
    setPdfUploading(true); setError("");
    try {
      const fd = new FormData(); fd.append("file", f);
      const r = await fetch("/api/upload/pdf", { method: "POST", body: fd });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "PDF upload алдаа");
      setPdf({ url: d.url, name: d.name, size: d.size });
    } catch (err) { setError((err as Error).message); }
    finally { setPdfUploading(false); if (pdfFileRef.current) pdfFileRef.current.value = ""; }
  }

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
        // 2026-10-11: reel-only дууссан — бүх ангилал.
        const all = Array.isArray(d.categories) ? (d.categories as Category[]) : [];
        if (all.length > 0) setCategories(all);
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
      /* XHR — fetch нь илгээлтийн явцыг (%) мэдээлдэггүй. Удаан сүлжээнд
         "UPLOADING…" хөдөлгөөнгүй байх нь гацсан мэт харагддаг байв. */
      setUploadPct(0);
      const { ok, data } = await new Promise<{ ok: boolean; data: { url?: string; error?: string } }>((resolve) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/upload");
        xhr.upload.onprogress = (ev) => { if (ev.lengthComputable) setUploadPct(Math.round((ev.loaded / ev.total) * 100)); };
        xhr.onload = () => {
          let parsed: { url?: string; error?: string } = {};
          try { parsed = JSON.parse(xhr.responseText); } catch { /* хоосон хариу */ }
          resolve({ ok: xhr.status >= 200 && xhr.status < 300, data: parsed });
        };
        xhr.onerror = () => resolve({ ok: false, data: { error: "Сүлжээ тасарлаа. Дахин оролдоно уу." } });
        xhr.send(fd);
      });
      if (!ok || !data.url) {
        setError(data.error || "Видео илгээх амжилтгүй");
        setVideoPreview("");
        setVideoDurationSec(0);
        return;
      }
      setVideoUrl(data.url as string);
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
  // Текст, зураг эсвэл видео — аль нэг нь байхад хангалттай.
  const hasMedia = validUrls.length > 0 || videoUrl.length > 0;
  const canPost = !loading && !uploading && !videoUploading && !pdfUploading && (hasMedia || !!pdf || content.trim().length > 0);

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
        aspect,
        textStyle: card && !hasMedia ? "card" : "",
      };
      if (videoUrl) {
        body.video = videoUrl;
        body.videoDurationSec = videoDurationSec;
      }
      if (pdf) { body.fileUrl = pdf.url; body.fileName = pdf.name; body.fileSize = pdf.size; }
      if (selectedTask) body.taskId = selectedTask;
      // Админ: сонгосон сувгууд руу давхар нийтэлнэ (хоосон бол антакор дээр л).
      if (isAdmin) body.crosspost = xp;

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
      emitXPFromResponse(data, "BUILD");
      try { localStorage.removeItem("antaqor-draft"); } catch { /* storage алга */ }
      router.push("/");
    } finally {
      setLoading(false);
    }
  };

  if (!session) return null;

  const active = categories.find((c) => c.slug === category) || categories[0] || FALLBACK_CATEGORIES[0];
  const activeColor = active.color || DEFAULT_CAT_COLOR;
  const activeTint = tintFor(activeColor);
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
        {/* 2026-10-11: "+" → шууд энэ модал. Доороос дээш зөөлөн spring. */}
        <motion.div
          initial={{ y: "100%", opacity: 0.6 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", damping: 30, stiffness: 300, mass: 0.9 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-[600px] max-h-[92vh] overflow-hidden rounded-t-[4px] border-t border-[rgba(15,23,38,0.08)] bg-[#f2f5f8] shadow-[0_-12px_40px_rgba(0,0,0,0.5)] sm:rounded-[4px] sm:border"
        >
          {/* ─── Толгой (2026-10-11, X маяг): ✕ · Ноорог. Нийтлэх нь доод мөрөнд. ─── */}
          <div className="sticky top-0 z-20 flex items-center justify-between gap-3 bg-[#f2f5f8] px-3 py-2.5">
            <button
              type="button"
              onClick={() => router.back()}
              aria-label="Хаах"
              className="flex h-9 w-9 items-center justify-center rounded-[4px] text-[#0e1726] transition hover:bg-[rgba(15,23,38,0.06)]"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => {
                try { if (content.trim()) localStorage.setItem("antaqor-draft", content); } catch { /* storage алга */ }
                router.back();
              }}
              className="rounded-[4px] px-3 py-1.5 text-[15px] font-bold text-[#FCEE0A] transition hover:bg-[rgba(252,238,10,0.1)]"
            >
              Ноорог
            </button>
          </div>

          {/* ─── Scrollable body ─────────────────────────────────────────── */}
          <div className="max-h-[calc(92vh-56px)] overflow-y-auto">
            {error && (
              <div className="mx-4 mt-3 rounded-[4px] border border-[#0C3050]/50 bg-[#111111]/30 px-3 py-2 text-[12px] text-[#4C47FF]">
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
                <div className="pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-[4px] border-2 border-dashed border-[#2E29FF] bg-[rgba(46,41,255,0.08)] backdrop-blur-sm">
                  <span className="rounded-[4px] bg-[#2E29FF] px-3 py-1.5 text-[11px] font-bold text-white">
                    Зургийг энд тавь
                  </span>
                </div>
              )}

              {/* ─── Author row — avatar · name · category chip ─── */}
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-[4px] bg-[#F2F2F4]">
                  {userAvatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={userAvatar} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[14px] font-black text-[#E2E4E8]">
                      {userName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-bold text-[#0e1726]">{userName}</div>
                  <button
                    type="button"
                    onClick={() => setCatOpen(true)}
                    className="mt-0.5 inline-flex items-center gap-1.5 rounded-[4px] px-2 py-0.5 text-[11px] font-semibold transition hover:opacity-90"
                    style={{
                      background: activeTint,
                      color: activeColor,
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
                placeholder={category === "промт" ? "Промтоо шигтгэ..." : "Юу болж байна?"}
                rows={Math.min(20, Math.max(3, content.split("\n").length + 1))}
                maxLength={50000}
                autoFocus
                className={`mt-3 w-full resize-none border-0 bg-transparent text-[#0e1726] placeholder-[#62666F] focus:outline-none ${
                  category === "промт" || content.length > 500
                    ? "text-[13px] leading-[1.65] font-mono"
                    : "text-[20px] leading-[1.45]"
                }`}
                style={
                  category === "промт" || content.length > 500
                    ? { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }
                    : undefined
                }
              />

              {/* ─── AI caption + давхар нийтлэх (2026-10-09) ─── */}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={aiBusy || (!videoUrl && !content.trim())}
                  onClick={async () => {
                    setAiBusy(true); setError("");
                    try {
                      const r = await fetch("/api/posts/ai-caption", {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ video: videoUrl, hint: content.trim(), category }),
                      });
                      const d = await r.json();
                      if (!r.ok || !d.caption) throw new Error(d.error || "AI caption бичиж чадсангүй");
                      setContent(d.caption);
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "AI алдаа");
                    } finally { setAiBusy(false); }
                  }}
                  className="inline-flex h-9 items-center gap-1.5 rounded-[4px] bg-[#2E29FF] px-3 text-[13px] font-bold text-[#0A0A0A] transition hover:bg-[#1F1AD9] disabled:opacity-40"
                  title={!videoUrl && !content.trim() ? "Эхлээд видео оруул эсвэл санаагаа товч бич" : "Видеоноос AI caption бичүүлэх"}
                >
                  {aiBusy ? "AI бичиж байна…" : content.trim() ? "✨ AI-аар сайжруулах" : "✨ AI caption бичих"}
                </button>
                {isAdmin && (
                  <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Давхар нийтлэх">
                    <span className="text-[11.5px] font-semibold text-[#9C9CA6]">Давхар:</span>
                    {XP_TARGETS.map((t) => {
                      const on = xp.includes(t.key);
                      return (
                        <button
                          key={t.key}
                          type="button"
                          aria-pressed={on}
                          onClick={() => setXp((list) => (on ? list.filter((k) => k !== t.key) : [...list, t.key]))}
                          className="h-8 rounded-[4px] px-2.5 text-[12px] font-bold transition"
                          style={on
                            ? { background: "rgba(252,238,10,0.16)", color: "#FCEE0A", border: "1px solid rgba(252,238,10,0.6)" }
                            : { background: "transparent", color: "#565967", border: "1px solid rgba(255,255,255,0.14)" }}
                        >
                          {on ? "✓ " : ""}{t.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

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
                    className="group flex flex-col items-center justify-center gap-1.5 rounded-[4px] bg-[rgba(15,23,38,0.07)] px-3 py-5 text-center transition hover:bg-[rgba(15,23,38,0.13)]"
                  >
                    <svg className="h-6 w-6 text-[#E2E4E8] group-hover:text-[#2E29FF]" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
                      <rect x="3" y="4" width="18" height="16" rx="2" />
                      <path strokeLinejoin="round" d="m3 16 5-5 4 4 3-3 6 6" />
                    </svg>
                    <span className="text-[12px] font-bold text-[#0e1726]">Зураг нэмэх</span>
                    <span className="text-[10px] text-[#E2E4E8]">Карусель · 10 хүртэл</span>
                  </button>
                  {/* Видео (reel) — input нь өмнө нь байсан ч түүнийг нээх товч
                      БАЙГААГҮЙ тул гишүүд видео оруулж чаддаггүй байв. */}
                  <button
                    type="button"
                    onClick={() => { if (videoFileRef.current) videoFileRef.current.value = ""; videoFileRef.current?.click(); }}
                    className="group flex flex-col items-center justify-center gap-1.5 rounded-[4px] bg-[rgba(15,23,38,0.07)] px-3 py-5 text-center transition hover:bg-[rgba(15,23,38,0.13)]"
                  >
                    <svg className="h-6 w-6 text-[#E2E4E8] group-hover:text-[#2E29FF]" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
                      <rect x="6" y="2.5" width="12" height="19" rx="2" />
                      <path strokeLinejoin="round" d="M10.5 9.5v5l4-2.5z" />
                    </svg>
                    <span className="text-[12px] font-bold text-[#0e1726]">Видео нэмэх</span>
                    <span className="text-[10px] text-[#E2E4E8]">Reel 9:16 · 60с хүртэл</span>
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
                        className="relative h-28 w-28 shrink-0 overflow-hidden rounded-[4px] border border-[rgba(15,23,38,0.06)] bg-[#ffffff]"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt="" className="h-full w-full object-cover" />
                        {stillUploading && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#2E29FF]" />
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => removeImage(idx)}
                          className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-[4px] bg-black/80 text-white hover:text-white backdrop-blur-sm transition hover:bg-[#2E29FF]"
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
                    className="relative mx-auto mt-3 aspect-[9/16] max-w-[300px] overflow-hidden rounded-[4px] border border-[rgba(15,23,38,0.06)] bg-[#ffffff]"
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
                        <div className="flex w-[70%] flex-col items-center gap-2">
                          <span className="font-mono text-[12px] font-bold tracking-[0.12em] text-[#2E29FF]">
                            {uploadPct < 100 ? `ИЛГЭЭЖ БАЙНА · ${uploadPct}%` : "БОЛОВСРУУЛЖ БАЙНА…"}
                          </span>
                          <div className="h-1.5 w-full overflow-hidden rounded-[4px] bg-white/15">
                            <div className="h-full bg-[#2E29FF] transition-[width] duration-200" style={{ width: `${uploadPct}%` }} />
                          </div>
                        </div>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={removeVideo}
                      className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-[4px] bg-black/80 text-white hover:text-white backdrop-blur-sm transition hover:bg-[#2E29FF]"
                      aria-label="Устгах"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ─── Хэлбэр (2026-10-11): медиа → харьцаа; зөвхөн текст → брэнд карт ─── */}
              {hasMedia ? (
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <span className="mr-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#E2E4E8]">Харьцаа</span>
                  {(videoUrl ? ["", "9:16", "4:5", "1:1", "16:9"] : ["", "4:5", "1:1", "16:9", "9:16"]).map((r) => (
                    <button
                      key={r || "orig"}
                      type="button"
                      onClick={() => setAspect(r)}
                      className={`rounded-[4px] border px-2.5 py-1 text-[12px] font-bold transition ${aspect === r ? "border-[#2E29FF] bg-[rgba(46,41,255,0.14)]" : "border-[rgba(15,23,38,0.12)] text-[#334155]"}`}
                      style={aspect === r ? { color: "var(--neon-ink, #2E29FF)" } : undefined}
                    >
                      {r || (videoUrl ? "9:16 (эх)" : "Эх")}
                    </button>
                  ))}
                </div>
              ) : content.trim().length > 0 ? (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => setCard((v) => !v)}
                    aria-pressed={card}
                    className={`inline-flex items-center gap-2 rounded-[4px] border px-3 py-1.5 text-[12.5px] font-bold transition ${card ? "border-[#2E29FF] bg-[rgba(46,41,255,0.14)]" : "border-[rgba(15,23,38,0.12)] text-[#334155]"}`}
                    style={card ? { color: "var(--neon-ink, #2E29FF)" } : undefined}
                  >
                    <span aria-hidden>❝</span> Брэнд карт {card ? "· асаалттай" : ""}
                  </button>
                  {card && (
                    <div className="mt-3 max-w-[300px]">
                      <BrandCard p={{ _id: "", content: content, createdAt: "", author: { _id: "", name: userName, avatar: userAvatar } }} />
                    </div>
                  )}
                </div>
              ) : null}

              {/* ─── Quest selector (only when open tasks exist) ─── */}
              {tasks.length > 0 && (
                <div className="mt-4 overflow-hidden rounded-[4px] border border-[rgba(15,23,38,0.06)]">
                  <button
                    type="button"
                    onClick={() => setQuestOpen((v) => !v)}
                    className="flex w-full items-center justify-between px-3 py-2.5 text-left transition hover:bg-[rgba(15,23,38,0.02)]"
                  >
                    <div className="flex items-center gap-2">
                      <svg className="h-3.5 w-3.5 text-[#2E29FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span className="text-[12px] font-semibold text-[#0e1726]">
                        {selTask ? (
                          <>
                            {selTask.title}{" "}
                            <span className="text-[10px] font-bold text-[#2E29FF]">+{selTask.xpReward} XP</span>
                          </>
                        ) : (
                          "Даалгаварт холбож XP"
                        )}
                      </span>
                    </div>
                    <svg
                      className={`h-3.5 w-3.5 text-[#E2E4E8] transition-transform ${questOpen ? "rotate-180" : ""}`}
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
                              className={`rounded-[4px] border px-3 py-2 text-left transition ${
                                sel
                                  ? "border-[rgba(46,41,255,0.5)] bg-[rgba(46,41,255,0.06)]"
                                  : "border-[rgba(15,23,38,0.06)] bg-[#ffffff] hover:border-[rgba(15,23,38,0.12)]"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-bold ${sel ? "text-[#2E29FF]" : "text-[#E2E4E8]"}`}>
                                  #{i + 1}
                                </span>
                                <span className="flex-1 truncate text-[12px] font-semibold text-[#0e1726]">
                                  {task.title}
                                </span>
                                <span className="rounded-[4px] bg-[rgba(46,41,255,0.12)] px-1.5 py-0.5 text-[11px] font-bold text-[#2E29FF]">
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

              {/* ─── Хэн хариулах (мэдээлэл) ─── */}
              <div className="mt-4 flex items-center gap-2 text-[14px] font-bold text-[#FCEE0A]">
                <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden>
                  <circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
                </svg>
                Хүн бүр хариулж болно
              </div>

              {pdf && (
                <div className="mt-3 flex items-center gap-3 rounded-[4px] border border-[rgba(15,23,38,0.14)] px-3 py-2">
                  <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[4px] bg-[#2E29FF] text-[11px] font-extrabold text-white">PDF</span>
                  <span className="min-w-0 flex-1"><b className="block truncate text-[14px]">{pdf.name}</b><span className="text-[12px] opacity-60">{(pdf.size / 1048576).toFixed(1)} MB</span></span>
                  <button type="button" onClick={() => setPdf(null)} aria-label="PDF хасах" className="h-8 w-8 rounded-[4px] text-[18px] leading-none opacity-70">×</button>
                </div>
              )}

              {/* ─── Хэрэгслийн мөр (2026-10-11, X маяг): дүрснүүд · тоолуур · Нийтлэх ─── */}
              <div className="mt-3 flex items-center gap-0.5 border-t border-[rgba(15,23,38,0.1)] pt-3">
                <ToolBtn label="Зураг" disabled={imagePreviews.length >= MAX_IMAGES || !!videoPreview}
                  onClick={() => { if (fileRef.current) fileRef.current.value = ""; fileRef.current?.click(); }}
                  d="M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M15.5 8.5h.01" />
                <ToolBtn label="Видео" disabled={imagePreviews.length > 0 || !!videoPreview || videoUploading}
                  onClick={() => { if (videoFileRef.current) videoFileRef.current.value = ""; videoFileRef.current?.click(); }}
                  d="M6 3h12v18H6zM10.5 9.5v5l4-2.5z" />
                <ToolBtn label={pdfUploading ? "PDF илгээж байна…" : "PDF хавсаргах"} active={!!pdf} disabled={pdfUploading || !!pdf}
                  onClick={() => pdfFileRef.current?.click()}
                  d="M6 3h8l4 4v14H6zM14 3v4h4M9 13h6M9 17h6" />
                <ToolBtn label="Брэнд карт" active={card} disabled={hasMedia || !content.trim()}
                  onClick={() => setCard((v) => !v)}
                  d="M4 4h16v16H4zM8 9h8M8 13h5" />
                <div className="relative">
                  <ToolBtn label="Эможи" active={emojiOpen} onClick={() => setEmojiOpen((v) => !v)}
                    d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8.5 14.5c1.9 2 5.1 2 7 0M9 9.5h.01M15 9.5h.01" />
                  {emojiOpen && (
                    <div className="absolute bottom-full left-0 z-30 mb-2 grid w-[232px] grid-cols-6 gap-1 rounded-[4px] border border-[rgba(15,23,38,0.12)] bg-[#f2f5f8] p-2 shadow-[0_8px_30px_rgba(0,0,0,0.3)]">
                      {["🔥", "🚀", "💡", "✅", "👀", "🙌", "😂", "❤️", "🤖", "📈", "🎯", "⚡", "👇", "💰", "🧠", "🇲🇳", "✨", "📌"].map((em) => (
                        <button key={em} type="button" onClick={() => { setContent((c) => c + em); setEmojiOpen(false); }}
                          className="flex h-9 items-center justify-center rounded-[4px] text-[20px] hover:bg-[rgba(15,23,38,0.08)]">{em}</button>
                      ))}
                    </div>
                  )}
                </div>
                <ToolBtn label={`Ангилал: ${active.name}`} onClick={() => setCatOpen(true)}
                  d="M3 12V4h8l10 10-8 8zM7.5 8.5h.01" />
                <ToolBtn
                  label="AI-аар ангилал оноох"
                  disabled={content.trim().length < 8 || autoTagging}
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
                  d="M9.8 15.9 9 18.8l-.8-2.9a4.5 4.5 0 0 0-3.1-3.1L2.2 12l2.9-.8a4.5 4.5 0 0 0 3.1-3.1L9 5.2l.8 2.9a4.5 4.5 0 0 0 3.1 3.1l2.9.8-2.9.8a4.5 4.5 0 0 0-3.1 3.1z" />

                <span className="ml-auto flex items-center gap-3">
                  {content.length > 0 && (
                    /* Threads 500 тэмдэгт — илүүг нь таслаад холбоос тавина (feedCrosspost). */
                    <span
                      title="Threads-ийн хязгаар 500 тэмдэгт"
                      className={`text-[13.5px] font-semibold tabular-nums ${500 - content.length < 0 ? "text-[#FCEE0A]" : 500 - content.length <= 20 ? "text-[#FCEE0A]" : "text-[#62666F]"}`}
                    >
                      {500 - content.length}
                    </span>
                  )}
                  <button
                    type="submit"
                    disabled={!canPost}
                    className="h-9 rounded-[4px] bg-[#2E29FF] px-5 text-[14.5px] font-extrabold text-[#0A0A0A] transition hover:bg-[#1F1AD9] disabled:opacity-40"
                  >
                    {loading ? "…" : "Нийтлэх"}
                  </button>
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
                ref={pdfFileRef}
                type="file"
                accept="application/pdf,.pdf"
                onChange={onPdfChange}
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

/* Хэрэгслийн мөрийн дүрс товч — X маяг, 36px, tooltip = label. */
function ToolBtn({ d, label, onClick, disabled, active }: { d: string; label: string; onClick: () => void; disabled?: boolean; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`flex h-9 w-9 items-center justify-center rounded-[4px] transition disabled:opacity-30 ${
        active ? "bg-[rgba(46,41,255,0.16)] text-[#2E29FF]" : "text-[#2E29FF] hover:bg-[rgba(46,41,255,0.1)]"
      }`}
    >
      <svg className="h-[19px] w-[19px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden>
        <path d={d} />
      </svg>
    </button>
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
            className="w-full max-w-[480px] max-h-[88vh] overflow-y-auto rounded-t-[4px] border-t border-[rgba(15,23,38,0.08)] bg-[#f2f5f8] sm:max-h-[80vh] sm:rounded-[4px] sm:border"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[rgba(15,23,38,0.06)] bg-[#f2f5f8] px-5 py-3.5">
              <h2 className="text-[14px] font-black text-[#0e1726]">Категори сонгох</h2>
              <button onClick={onClose} aria-label="Хаах" className="flex h-7 w-7 items-center justify-center rounded-[4px] text-[#E2E4E8] transition hover:bg-[rgba(15,23,38,0.06)] hover:text-[#0e1726]">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 p-4">
              {categories.map((c) => {
                const isActive = c.slug === selected;
                const catColor = c.color || DEFAULT_CAT_COLOR;
                const tint = tintFor(catColor);
                return (
                  <button
                    key={c.slug}
                    type="button"
                    onClick={() => onPick(c.slug)}
                    className="group flex items-center gap-2.5 rounded-[4px] border px-3 py-3 text-left transition"
                    style={{
                      borderColor: isActive ? catColor : "rgba(15,23,38,0.08)",
                      background: isActive ? tint : "#16161c",
                    }}
                  >
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[4px]"
                      style={{ background: tint, color: catColor }}
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
                        style={{ color: isActive ? catColor : "#0e1726" }}
                      >
                        {c.name}
                      </span>
                      <span className="block truncate text-[10px] text-[#E2E4E8]">
                        {c.slug}
                      </span>
                    </span>
                    {isActive && (
                      <svg className="h-4 w-4 shrink-0" fill="none" stroke={catColor} strokeWidth={2.5} viewBox="0 0 24 24">
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
