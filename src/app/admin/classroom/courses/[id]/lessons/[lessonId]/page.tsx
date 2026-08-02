"use client";

// Full lesson editor — handles both create (`lessonId="new"`) and edit.
// Layout: title → video (upload or URL) → blog editor (markdown + image
// upload) → save. The post-creation flow the user wanted.

import { useCallback, useEffect, useRef, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LessonEditor } from "@/components/classroom/LessonEditor";

interface LessonForm {
  title: string;
  description: string;
  content: string;
  videoUrl: string;
  videoType: "link" | "upload";
  thumbnail: string;
  requiredLevel: number;
  durationSec: number;
}

const EMPTY: LessonForm = {
  title: "",
  description: "",
  content: "",
  videoUrl: "",
  videoType: "link",
  thumbnail: "",
  requiredLevel: 0,
  durationSec: 0,
};

export default function AdminLessonEditorPage({
  params,
}: { params: Promise<{ id: string; lessonId: string }> }) {
  const { id: courseId, lessonId } = use(params);
  const isNew = lessonId === "new";
  const router = useRouter();
  const [form, setForm] = useState<LessonForm>(EMPTY);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [uploadingThumb, setUploadingThumb] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoFileRef = useRef<HTMLInputElement>(null);
  const thumbFileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (isNew) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/classroom/lessons/${lessonId}`);
      const data = await res.json();
      if (res.ok && data.lesson) {
        const l = data.lesson;
        setForm({
          title: l.title || "",
          description: l.description || "",
          content: l.content || "",
          videoUrl: l.videoUrl || "",
          videoType: (l.videoType as "link" | "upload") || (l.videoUrl?.startsWith("/uploads/") ? "upload" : "link"),
          thumbnail: l.thumbnail || "",
          requiredLevel: l.requiredLevel || 0,
          durationSec: l.durationSec || 0,
        });
      }
    } finally { setLoading(false); }
  }, [isNew, lessonId]);

  useEffect(() => { load(); }, [load]);

  // ─── Video upload ────────────────────────────────────────────────────
  const onVideoPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      setError("Зөвхөн видео файл");
      return;
    }
    if (file.size > 200 * 1024 * 1024) {
      setError("200MB-аас бага");
      return;
    }
    setError(null);
    setUploadingVideo(true);
    setVideoProgress(0);
    try {
      const data = await new Promise<{ url?: string; error?: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/classroom/upload-video");
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) setVideoProgress(Math.round((ev.loaded / ev.total) * 100));
        };
        xhr.onload = () => {
          try {
            const body = JSON.parse(xhr.responseText || "{}");
            if (xhr.status >= 200 && xhr.status < 300) resolve(body);
            else resolve({ error: body.error || `Upload ${xhr.status}` });
          } catch {
            resolve({ error: `Upload ${xhr.status}` });
          }
        };
        xhr.onerror = () => reject(new Error("net"));
        const fd = new FormData();
        fd.append("file", file);
        xhr.send(fd);
      });
      if (!data.url) {
        setError(data.error || "Upload алдаа");
        return;
      }
      setForm((f) => ({ ...f, videoUrl: data.url!, videoType: "upload" }));
    } catch {
      setError("Сүлжээний алдаа");
    } finally {
      setUploadingVideo(false);
      setVideoProgress(0);
      if (videoFileRef.current) videoFileRef.current.value = "";
    }
  };

  const onThumbPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingThumb(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok && data.url) setForm((f) => ({ ...f, thumbnail: data.url }));
    } finally {
      setUploadingThumb(false);
      if (thumbFileRef.current) thumbFileRef.current.value = "";
    }
  };

  // ─── Save ────────────────────────────────────────────────────────────
  const save = async () => {
    if (!form.title.trim()) {
      setError("Гарчиг оруулна уу");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // Derive videoType from URL shape — /uploads/ is server-hosted.
      const videoType: "link" | "upload" =
        form.videoUrl.startsWith("/uploads/") ? "upload" : "link";
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        content: form.content,
        videoUrl: form.videoUrl,
        videoType,
        thumbnail: form.thumbnail,
        requiredLevel: form.requiredLevel,
        durationSec: form.durationSec,
      };
      const res = isNew
        ? await fetch("/api/classroom/lessons", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...payload, course: courseId }),
          })
        : await fetch(`/api/classroom/lessons/${lessonId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Хадгалж чадсангүй");
        return;
      }
      // After create: go back to course admin so we can manage order/add another.
      // After edit: stay here so the user can keep iterating.
      if (isNew) router.push(`/admin/classroom/courses/${courseId}`);
      else await load();
    } catch {
      setError("Сүлжээний алдаа");
    } finally { setSaving(false); }
  };

  if (loading) return <div className="py-12 text-center text-[12px] text-[#8A8A92]">Ачаалж байна…</div>;

  // ─── Editable URL string — strip /uploads/ paths so the user can type a
  //     remote URL without seeing the local path noise in the input.
  const externalUrlValue = form.videoUrl.startsWith("/uploads/") ? "" : form.videoUrl;

  return (
    <div className="space-y-6 pb-12">
      {/* Breadcrumb */}
      <Link
        href={`/admin/classroom/courses/${courseId}`}
        className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#8A8A92] transition hover:text-[#1080CA]"
      >
        <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Курсэд буцах
      </Link>

      <div>
        <h1 className="text-[24px] font-black text-[#E8E8E8] sm:text-[30px]">
          {isNew ? "Шинэ хичээл" : "Хичээл засах"}
        </h1>
        <p className="mt-1 text-[12px] text-[#8A8A92]">
          Гарчиг → видео → блог пост → хадгалах
        </p>
      </div>

      {error && (
        <div className="rounded-none border border-[#1080CA]/30 bg-[#1080CA]/5 px-3 py-2 text-[12px] text-[#8FC1EA]">
          {error}
        </div>
      )}

      {/* ─── 1. Title / description ─── */}
      <Section step={1} title="Гарчиг">
        <input
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          placeholder="Хичээлийн гарчиг"
          autoFocus
          className="w-full rounded-none border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-4 py-3 text-[18px] font-bold text-[#E8E8E8] placeholder-[#56565E] outline-none focus:border-[rgba(16,128,202,0.4)]"
        />
        <textarea
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          rows={2}
          placeholder="Богино тайлбар — хичээлийн картын доор харагдана"
          className="mt-2 w-full resize-y rounded-none border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-4 py-2.5 text-[13px] leading-relaxed text-[#E8E8E8] placeholder-[#56565E] outline-none focus:border-[rgba(16,128,202,0.4)]"
        />
        <input
          type="number"
          min={0}
          value={form.durationSec ? Math.round(form.durationSec / 60) : ""}
          onChange={(e) => setForm((f) => ({ ...f, durationSec: Math.max(0, parseInt(e.target.value) || 0) * 60 }))}
          placeholder="Үргэлжлэх хугацаа (минут)"
          className="mt-2 w-full rounded-none border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-4 py-2.5 text-[13px] text-[#E8E8E8] placeholder-[#56565E] outline-none focus:border-[rgba(16,128,202,0.4)]"
        />
      </Section>

      {/* ─── 2. Video ─── */}
      <Section step={2} title="Видео" hint="сонгох → upload эсвэл URL">
        {form.videoUrl && form.videoType === "upload" ? (
          <div className="flex items-center gap-3 rounded-none border border-[rgba(79,224,101,0.25)] bg-[rgba(79,224,101,0.05)] p-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-none" style={{ background: "rgba(79,224,101,0.15)", color: "#4FE065" }}>
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-bold text-[#E8E8E8]">Хадгалагдсан видео</div>
              <div className="truncate font-mono text-[10px] text-[#8A8A92]">{form.videoUrl}</div>
            </div>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, videoUrl: "" }))}
              className="rounded-none px-2 py-1 text-[10px] font-bold text-[#8A8A92] hover:text-[#4E94D0]"
            >
              Устгах
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => videoFileRef.current?.click()}
            disabled={uploadingVideo}
            className="flex w-full items-center justify-center gap-2 rounded-none border-2 border-dashed border-[rgba(16,128,202,0.3)] bg-[#0A0A0A] px-4 py-4 text-[13px] font-bold text-[#E8E8E8] transition hover:border-[rgba(16,128,202,0.5)] disabled:opacity-50"
          >
            {uploadingVideo ? (
              <>
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-[#1080CA] border-t-transparent" />
                Хадгалж байна… {videoProgress}%
              </>
            ) : (
              <>
                <svg className="h-4 w-4 text-[#1080CA]" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                </svg>
                Видео файл сонгох
              </>
            )}
          </button>
        )}
        {uploadingVideo && (
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
            <div className="h-full bg-[#1080CA] transition-all duration-200" style={{ width: `${videoProgress}%` }} />
          </div>
        )}
        <input ref={videoFileRef} type="file" accept="video/*" className="hidden" onChange={onVideoPick} />

        {/* URL fallback — pasted YouTube/Vimeo or direct mp4 */}
        <div className="mt-2 flex items-center gap-2 text-[10px] text-[#8A8A92]">
          <span>эсвэл URL:</span>
          <input
            value={externalUrlValue}
            onChange={(e) => setForm((f) => ({ ...f, videoUrl: e.target.value, videoType: "link" }))}
            placeholder="https://youtube.com/... or https://cdn/clip.mp4"
            className="flex-1 rounded-none border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-2.5 py-1.5 text-[11px] text-[#8A8A92] outline-none focus:border-[rgba(16,128,202,0.4)]"
          />
        </div>
      </Section>

      {/* ─── 3. Blog content (Medium-style markdown + image upload) ─── */}
      <Section step={3} title="Блог пост" hint="markdown · зураг · live preview">
        <LessonEditor value={form.content} onChange={(v) => setForm((f) => ({ ...f, content: v }))} />
      </Section>

      {/* ─── 4. Thumbnail + level (optional) ─── */}
      <Section step={4} title="Карт + түвшин" hint="сонгох">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[200px_1fr]">
          <label className="flex aspect-[16/9] w-full cursor-pointer items-center justify-center overflow-hidden rounded-none border border-dashed border-[rgba(255,255,255,0.1)] bg-[#0A0A0A] transition hover:border-[rgba(16,128,202,0.35)]">
            <input
              ref={thumbFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onThumbPick}
            />
            {form.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.thumbnail} alt="" className="h-full w-full object-cover" />
            ) : uploadingThumb ? (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-[#1080CA] border-t-transparent" />
            ) : (
              <span className="text-[10px] uppercase tracking-[0.2em] text-[#56565E]">+ Карт зураг</span>
            )}
          </label>
          <div className="flex flex-col gap-2">
            {form.thumbnail && (
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, thumbnail: "" }))}
                className="self-start text-[10px] font-bold text-[#8A8A92] transition hover:text-[#4E94D0]"
              >
                Карт цэвэрлэх
              </button>
            )}
            <label className="block">
              <span className="mb-1 block font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#8A8A92]">
                Шаардах түвшин
              </span>
              <input
                type="number"
                min={0}
                max={100}
                value={form.requiredLevel}
                onChange={(e) => setForm((f) => ({ ...f, requiredLevel: Math.max(0, parseInt(e.target.value) || 0) }))}
                className="w-24 rounded-none border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-1.5 text-center text-[12px] text-[#E8E8E8] outline-none focus:border-[rgba(16,128,202,0.4)]"
              />
            </label>
          </div>
        </div>
      </Section>

      {/* ─── Sticky save bar ─── */}
      <div className="sticky bottom-3 z-10 flex items-center justify-end gap-2 rounded-none border border-[rgba(255,255,255,0.08)] bg-[rgba(15,15,16,0.96)] p-3 backdrop-blur-md">
        <Link
          href={`/admin/classroom/courses/${courseId}`}
          className="rounded-none border border-[rgba(255,255,255,0.08)] px-4 py-2 text-[12px] font-bold text-[#8A8A92] transition hover:border-[rgba(255,255,255,0.2)] hover:text-[#E8E8E8]"
        >
          Цуцлах
        </Link>
        <button
          type="button"
          onClick={save}
          disabled={saving || uploadingVideo || uploadingThumb || !form.title.trim()}
          className="inline-flex items-center gap-2 rounded-none bg-[#1080CA] px-5 py-2 text-[12px] font-black text-[#0E0E10] transition hover:bg-[#FF3D69] disabled:opacity-50"
        >
          {saving ? (
            <>
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Хадгалж байна…
            </>
          ) : isNew ? "Хичээл үүсгэх" : "Хадгалах"}
        </button>
      </div>
    </div>
  );
}

// ─── Section wrapper ────────────────────────────────────────────────────
function Section({
  step, title, hint, children,
}: { step: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-2">
        <span
          className="flex h-5 w-5 items-center justify-center rounded-none font-mono text-[10px] font-bold"
          style={{ background: "rgba(16,128,202,0.1)", color: "#1080CA" }}
        >
          {step}
        </span>
        <h2 className="text-[14px] font-black text-[#E8E8E8]">{title}</h2>
        {hint && (
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#56565E]">
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
