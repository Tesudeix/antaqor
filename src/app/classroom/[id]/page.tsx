"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect, useRef, use } from "react";
import Link from "next/link";
import { isAdminEmail } from "@/lib/adminClient";
import { formatDistanceToNow } from "@/lib/utils";
import { motion } from "framer-motion";
import PaywallGate from "@/components/PaywallGate";
import { LessonEditor } from "@/components/classroom/LessonEditor";
import { LessonArticle } from "@/components/classroom/LessonArticle";

type Attachment = { url: string; name: string; size?: number };

interface ReactionData {
  count: number;
  reacted: boolean;
}

interface LessonData {
  _id: string;
  title: string;
  description: string;
  content: string;
  videoUrl: string;
  videoType: string;
  requiredLevel: number;
  attachments?: { url: string; name: string; size?: number }[];
  completedBy: string[];
  likes: string[];
  reactions?: Record<string, string[]>;
  commentsCount: number;
  createdAt: string;
  course: { _id: string; title: string };
}

// Only 3 reactions for lesson player
const REACTION_KEYS = ["fire", "rocket", "think"];

const ReactionIcon = ({ type, active }: { type: string; active: boolean }) => {
  const color = active ? "#1080CA" : "currentColor";
  const props = { className: "h-[16px] w-[16px]", fill: "none", stroke: color, viewBox: "0 0 24 24", strokeWidth: active ? 2 : 1.5 };
  switch (type) {
    case "fire": return (<svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" fill={active ? "rgba(16,128,202,0.2)" : "none"} /></svg>);
    case "rocket": return (<svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" /></svg>);
    case "think": return (<svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" /></svg>);
    default: return null;
  }
};

const VIDEO_MIME: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  ogg: "video/ogg",
  ogv: "video/ogg",
  mkv: "video/x-matroska",
  avi: "video/x-msvideo",
};

function getVideoMime(url: string): string {
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase() || "";
  return VIDEO_MIME[ext] || "video/mp4";
}

function getEmbedUrl(url: string): string | null {
  if (!url) return null;
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  return null;
}

function buildReactionsFromLesson(lesson: LessonData, userId: string | null): Record<string, ReactionData> {
  const result: Record<string, ReactionData> = {};
  for (const key of REACTION_KEYS) {
    const users: string[] = lesson.reactions?.[key] || [];
    result[key] = { count: users.length, reacted: userId ? users.includes(userId) : false };
  }
  return result;
}

export default function LessonPageWrapper({ params }: { params: Promise<{ id: string }> }) {
  return (
    <PaywallGate>
      <LessonPage params={params} />
    </PaywallGate>
  );
}

function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session } = useSession();
  const [lesson, setLesson] = useState<LessonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({ title: "", description: "", content: "", videoUrl: "" });
  const [editAttachments, setEditAttachments] = useState<Attachment[]>([]);
  const [editVideoName, setEditVideoName] = useState("");
  const [editVideoSize, setEditVideoSize] = useState(0);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [pdfUploading, setPdfUploading] = useState(false);
  const [editError, setEditError] = useState("");
  const [userLevel, setUserLevel] = useState(1);
  const [reactions, setReactions] = useState<Record<string, ReactionData>>({});
  const [reactingEmoji, setReactingEmoji] = useState<string | null>(null);
  // Transcript toggle removed — article renders inline below the video.
  // Keeping the state setter only so legacy keyboard shortcuts compile;
  // the value isn't consumed anywhere now.

  const videoFileRef = useRef<HTMLInputElement>(null);
  const pdfFileRef = useRef<HTMLInputElement>(null);

  const admin = isAdminEmail(session?.user?.email);
  const userId = session ? (session.user as { id: string }).id : null;

  useEffect(() => {
    fetchLesson();
    if (userId) {
      fetch(`/api/users/${userId}`)
        .then((r) => r.json())
        .then((d) => { if (d.user?.level) setUserLevel(d.user.level); })
        .catch(() => {});
    }
  }, [id, userId]);

  const fetchLesson = async () => {
    try {
      const res = await fetch(`/api/classroom/lessons/${id}`);
      const data = await res.json();
      if (res.ok) {
        setLesson(data.lesson);
        setReactions(buildReactionsFromLesson(data.lesson, userId));
        setEditData({
          title: data.lesson.title,
          description: data.lesson.description,
          content: data.lesson.content,
          videoUrl: data.lesson.videoUrl,
        });
        setEditAttachments(Array.isArray(data.lesson.attachments) ? data.lesson.attachments : []);
        setEditVideoName("");
        setEditVideoSize(0);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReaction = async (emoji: string) => {
    if (!session || reactingEmoji) return;
    setReactingEmoji(emoji);
    try {
      const res = await fetch(`/api/classroom/lessons/${id}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
      const data = await res.json();
      if (res.ok) setReactions(data.reactions);
    } finally {
      setReactingEmoji(null);
    }
  };

  const handleEditVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditError("");
    if (!file.type.startsWith("video/")) {
      setEditError("Зөвхөн видео файл (mp4, webm, mov)");
      e.target.value = "";
      return;
    }
    if (file.size > 200 * 1024 * 1024) {
      setEditError("Видео 200MB-аас бага байх ёстой");
      e.target.value = "";
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const xhr = new XMLHttpRequest();
      const result = await new Promise<{ url: string; size?: number; name?: string }>((resolve, reject) => {
        xhr.upload.addEventListener("progress", (ev) => {
          if (ev.lengthComputable) setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
        });
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
          else {
            try { reject(new Error(JSON.parse(xhr.responseText).error || "Upload failed")); }
            catch { reject(new Error("Upload failed")); }
          }
        });
        xhr.addEventListener("error", () => reject(new Error("Upload failed")));
        xhr.open("POST", "/api/classroom/upload-video");
        xhr.send(formData);
      });
      setEditData((p) => ({ ...p, videoUrl: result.url }));
      setEditVideoName(file.name);
      setEditVideoSize(file.size);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Видео хадгалах алдаа");
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (videoFileRef.current) videoFileRef.current.value = "";
    }
  };

  const handleEditPdfPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setEditError("");
    setPdfUploading(true);
    try {
      for (const file of files) {
        if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
          setEditError("Зөвхөн PDF файл (.pdf)");
          continue;
        }
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/classroom/upload-pdf", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) {
          setEditError(data.error || "PDF хадгалах алдаа");
          continue;
        }
        setEditAttachments((p) => [...p, { url: data.url, name: file.name, size: file.size }].slice(0, 10));
      }
    } finally {
      setPdfUploading(false);
      if (pdfFileRef.current) pdfFileRef.current.value = "";
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setEditError("");
    try {
      const videoType = editData.videoUrl.startsWith("/uploads/") ? "upload" : "link";
      const res = await fetch(`/api/classroom/lessons/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editData, videoType, attachments: editAttachments }),
      });
      if (res.ok) {
        fetchLesson();
        setEditing(false);
      } else {
        const data = await res.json().catch(() => ({}));
        setEditError(data.error || "Хадгалах алдаа");
      }
    } finally {
      setSaving(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const handleDelete = async () => {
    if (!confirm("Энэ хичээлийг устгах уу?")) return;
    const res = await fetch(`/api/classroom/lessons/${id}`, { method: "DELETE" });
    if (res.ok && lesson?.course?._id) {
      window.location.href = `/classroom/course/${lesson.course._id}`;
    } else if (res.ok) {
      window.location.href = "/classroom";
    }
  };

  const toggleComplete = async () => {
    const res = await fetch(`/api/classroom/lessons/${id}/complete`, { method: "POST" });
    if (res.ok) fetchLesson();
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-2 w-2 animate-pulse-gold rounded-full bg-[#1080CA]" />
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="py-16 text-center">
        <p className="text-[15px] text-[#5b6573]">Хичээл олдсонгүй</p>
        <Link href="/classroom" className="mt-4 inline-block text-[13px] font-bold text-[#1080CA] transition-colors duration-200 hover:underline">← Буцах</Link>
      </div>
    );
  }

  if ((lesson.requiredLevel || 0) > userLevel && !admin) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-none border border-[rgba(15,23,38,0.10)] bg-[rgba(15,23,38,0.08)]">
          <svg className="h-7 w-7 text-[#5b6573]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <p className="text-[16px] font-bold text-[#0e1726]">LV.{lesson.requiredLevel} шаардлагатай</p>
        <p className="mt-1.5 text-[14px] text-[#5b6573]">Таны түвшин: LV.{userLevel}</p>
        <Link href="/classroom" className="mt-8 text-[13px] font-bold text-[#1080CA] transition-colors duration-200 hover:underline">← Буцах</Link>
      </div>
    );
  }

  const isCompleted = userId ? lesson.completedBy.includes(userId) : false;
  const embedUrl = getEmbedUrl(lesson.videoUrl);
  const isDirectVideoUrl = /\.(mp4|webm|mov|m4v|ogg|ogv|mkv|avi)(\?.*)?$/i.test(lesson.videoUrl);
  const isUploadedVideo = lesson.videoType === "upload" || lesson.videoUrl.startsWith("/uploads/") || isDirectVideoUrl;

  return (
    <div className="mx-auto max-w-[900px]">
      {/* Back + nav */}
      <div className="mb-6 flex items-center justify-between">
        <Link
          href={lesson.course?._id ? `/classroom/course/${lesson.course._id}` : "/classroom"}
          className="inline-flex items-center gap-2 text-[13px] font-medium text-[#5b6573] transition-colors duration-200 hover:text-[#0e1726]"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
          </svg>
          {lesson.course?.title || "Хичээлийн танхим"}
        </Link>
        {/* Lesson nav (prev/next) always visible */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#5b6573]">
            {formatDistanceToNow(lesson.createdAt)}
          </span>
        </div>
      </div>

      {/* ─── Video — dominant ─── */}
      {lesson.videoUrl && !editing && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="mb-6 overflow-hidden rounded-none border border-[rgba(15,23,38,0.10)] bg-black"
        >
          <LessonVideoPlayer
            videoUrl={lesson.videoUrl}
            embedUrl={embedUrl}
            isUploaded={isUploadedVideo}
          />
        </motion.div>
      )}

      {/* ─── Title + Actions ─── */}
      {!editing && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: "easeOut", delay: 0.05 }}
          className="mb-6"
        >
          <h1 className="text-[24px] font-bold leading-tight tracking-[-0.02em] text-[#0e1726] sm:text-[32px]">{lesson.title}</h1>
          {lesson.description && (
            <p className="mt-3 text-[16px] leading-relaxed text-[#5b6573]">{lesson.description}</p>
          )}

          {/* PDF / slide attachments */}
          {lesson.attachments && lesson.attachments.length > 0 && (
            <div className="mt-5 rounded-none border border-[rgba(15,23,38,0.10)] bg-black p-3">
              <div className="mb-2 flex items-center gap-2">
                <svg className="h-3.5 w-3.5 text-[#1080CA]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#5b6573]">
                  Хавсралт материал · {lesson.attachments.length}
                </span>
              </div>
              <ul className="space-y-1">
                {lesson.attachments.map((att, i) => (
                  <li key={i}>
                    <a
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={att.name}
                      className="group flex items-center gap-2.5 rounded-none border border-[rgba(15,23,38,0.10)] bg-black px-3 py-2 transition hover:border-[rgba(16,128,202,0.3)]"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-none bg-[rgba(16,128,202,0.12)] text-[9px] font-black text-[#1080CA]">
                        PDF
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[12px] font-bold text-[#0e1726] group-hover:text-[#1080CA]">
                        {att.name}
                      </span>
                      <svg className="h-3.5 w-3.5 text-[#6b7280] group-hover:text-[#1080CA]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions row */}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {session && (
              <button
                onClick={toggleComplete}
                className={`flex items-center gap-2 rounded-none px-5 py-2.5 text-[13px] font-bold transition-all duration-200 ${
                  isCompleted
                    ? "bg-[rgba(16,128,202,0.1)] border border-[rgba(16,128,202,0.3)] text-[#1080CA]"
                    : "bg-[#1080CA] text-[#0E0E10] hover:shadow-[0_0_24px_rgba(16,128,202,0.25)]"
                }`}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {isCompleted ? "Дууссан" : "Дуусгах"}
              </button>
            )}

            {/* Reactions — minimized inline */}
            {session && (
              <div className="flex items-center gap-1 ml-auto">
                {REACTION_KEYS.map((key) => {
                  const data = reactions[key];
                  const count = data?.count || 0;
                  const reacted = data?.reacted || false;
                  return (
                    <button
                      key={key}
                      onClick={() => handleReaction(key)}
                      disabled={reactingEmoji === key}
                      className={`inline-flex items-center gap-1 rounded-none px-2 py-1.5 transition-all duration-200 ${
                        reacted
                          ? "bg-[rgba(16,128,202,0.1)]"
                          : "text-[#5b6573] hover:bg-[rgba(15,23,38,0.06)]"
                      }`}
                    >
                      <ReactionIcon type={key} active={reacted} />
                      {count > 0 && (
                        <span className={`text-[10px] font-semibold ${reacted ? "text-[#1080CA]" : "text-[#5b6573]"}`}>{count}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {admin && (
              <div className="flex items-center gap-2">
                <button onClick={() => setEditing(true)} className="rounded-none border border-[rgba(15,23,38,0.10)] px-4 py-2 text-[12px] font-medium text-[#5b6573] transition-colors duration-200 hover:text-[#0e1726]">Засах</button>
                <button onClick={handleDelete} className="rounded-none border border-[rgba(15,23,38,0.10)] px-4 py-2 text-[12px] font-medium text-[#1080CA]/50 transition-colors duration-200 hover:text-[#4E94D0]">Устгах</button>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* ─── Edit form ─── */}
      {editing && (
        <div className="mb-8 space-y-4 rounded-none border border-[rgba(15,23,38,0.10)] bg-[rgba(15,23,38,0.08)] p-6">
          <input
            value={editData.title}
            onChange={(e) => setEditData((p) => ({ ...p, title: e.target.value }))}
            placeholder="Хичээлийн нэр"
            className="w-full rounded-none border border-[rgba(15,23,38,0.10)] bg-black px-4 py-3 text-[18px] font-bold text-[#0e1726] outline-none transition-colors duration-200 focus:border-[rgba(16,128,202,0.4)]"
          />
          <textarea
            value={editData.description}
            onChange={(e) => setEditData((p) => ({ ...p, description: e.target.value }))}
            rows={2}
            placeholder="Тайлбар"
            className="w-full resize-none rounded-none border border-[rgba(15,23,38,0.10)] bg-black px-4 py-3 text-[15px] text-[#0e1726] placeholder-[#94a3b8] outline-none transition-colors duration-200 focus:border-[rgba(16,128,202,0.4)]"
          />

          {/* Video */}
          <div>
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#5b6573]">Видео</div>
            {editData.videoUrl ? (
              <div className="flex items-center gap-2.5 rounded-none border border-[rgba(16,128,202,0.25)] bg-[rgba(16,128,202,0.04)] px-3 py-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-none bg-[rgba(16,128,202,0.15)] text-[#1080CA]">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                </span>
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="truncate text-[12px] font-bold text-[#0e1726]">
                    {editVideoName || (editData.videoUrl.startsWith("/uploads/") ? "lesson video" : editData.videoUrl)}
                  </div>
                  <div className="text-[10px] text-[#5b6573]">
                    {editVideoSize ? `${formatSize(editVideoSize)} · ` : ""}
                    {editData.videoUrl.startsWith("/uploads/") ? "хадгалагдсан" : "external link"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => videoFileRef.current?.click()}
                  disabled={uploading}
                  className="shrink-0 rounded-none border border-[rgba(15,23,38,0.12)] px-2.5 py-1.5 text-[11px] font-bold text-[#5b6573] transition hover:border-[rgba(16,128,202,0.4)] hover:text-[#1080CA] disabled:opacity-50"
                >
                  Солих
                </button>
                <button
                  type="button"
                  onClick={() => { setEditData((p) => ({ ...p, videoUrl: "" })); setEditVideoName(""); setEditVideoSize(0); }}
                  className="shrink-0 text-[#6b7280] hover:text-[#1080CA]"
                  aria-label="Устгах"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => videoFileRef.current?.click()}
                disabled={uploading}
                className="flex w-full items-center gap-2.5 rounded-none border-2 border-dashed border-[rgba(16,128,202,0.3)] bg-black px-3 py-3 text-left transition hover:border-[rgba(16,128,202,0.5)] disabled:opacity-50"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-none bg-[rgba(16,128,202,0.1)] text-[#1080CA]">
                  {uploading ? (
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#1080CA] border-t-transparent" />
                  ) : (
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                  )}
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block text-[12px] font-bold text-[#0e1726]">
                    {uploading ? `Хадгалж байна... ${uploadProgress}%` : "Видео сонгох"}
                  </span>
                  <span className="block text-[10px] text-[#6b7280]">MP4 / WebM / MOV · 200MB хүртэл</span>
                </span>
              </button>
            )}
            <input ref={videoFileRef} type="file" accept="video/*" onChange={handleEditVideoUpload} className="hidden" disabled={uploading} />
            {uploading && (
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[rgba(15,23,38,0.08)]">
                <div className="h-full rounded-full bg-[#1080CA] transition-all duration-200" style={{ width: `${uploadProgress}%` }} />
              </div>
            )}
            <div className="mt-2 flex items-center gap-2 text-[10px] text-[#6b7280]">
              <span>эсвэл YouTube / Vimeo / шууд .mp4 URL:</span>
              <input
                value={editData.videoUrl.startsWith("/uploads/") ? "" : editData.videoUrl}
                onChange={(e) => { setEditData((p) => ({ ...p, videoUrl: e.target.value })); setEditVideoName(""); setEditVideoSize(0); }}
                placeholder="https://youtube.com/... or https://cdn.../clip.mp4"
                className="flex-1 rounded-none border border-[rgba(15,23,38,0.10)] bg-black px-2.5 py-1 text-[11px] text-[#334155] outline-none focus:border-[rgba(16,128,202,0.4)]"
              />
            </div>
          </div>

          {/* PDF / slide attachments */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#5b6573]">PDF / Slide хавсралт</div>
              <span className="text-[9px] text-[#6b7280]">{editAttachments.length}/10</span>
            </div>
            {editAttachments.length > 0 && (
              <ul className="mb-2 space-y-1">
                {editAttachments.map((p, i) => (
                  <li key={i} className="flex items-center gap-2 rounded-none border border-[rgba(16,128,202,0.2)] bg-[rgba(16,128,202,0.04)] px-2.5 py-1.5">
                    <span className="rounded-none bg-[rgba(16,128,202,0.18)] px-1.5 py-0.5 text-[9px] font-black text-[#1080CA]">PDF</span>
                    <span className="min-w-0 flex-1 truncate text-[12px] text-[#0e1726]">{p.name}</span>
                    <button onClick={() => setEditAttachments((arr) => arr.filter((_, j) => j !== i))} className="text-[#6b7280] hover:text-[#1080CA]" aria-label="Устгах">
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {editAttachments.length < 10 && (
              <button
                type="button"
                onClick={() => pdfFileRef.current?.click()}
                disabled={pdfUploading}
                className="inline-flex items-center gap-1 rounded-none border border-dashed border-[rgba(16,128,202,0.3)] px-2.5 py-1.5 text-[10px] font-bold text-[#1080CA] hover:bg-[rgba(16,128,202,0.05)] disabled:opacity-50"
              >
                {pdfUploading ? "Хадгалж байна..." : "+ PDF нэмэх"}
              </button>
            )}
            <input ref={pdfFileRef} type="file" accept=".pdf,application/pdf" multiple onChange={handleEditPdfPick} className="hidden" />
          </div>

          {/* Medium-style markdown editor — split editor / preview, image
              upload via toolbar / paste / drag-drop. Renders the same way
              as LessonArticle below so what the admin sees IS the post. */}
          <LessonEditor
            value={editData.content}
            onChange={(v) => setEditData((p) => ({ ...p, content: v }))}
          />

          {editError && (
            <div className="rounded-none border border-[rgba(16,128,202,0.25)] bg-[rgba(16,128,202,0.08)] px-3 py-2 text-[11px] text-[#1080CA]">
              {editError}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving || uploading || pdfUploading}
              className="rounded-none bg-[#1080CA] px-6 py-2.5 text-[12px] font-bold text-[#0E0E10] transition-all duration-200 disabled:opacity-50"
            >
              {saving ? "Хадгалж байна..." : "Хадгалах"}
            </button>
            <button
              onClick={() => { setEditing(false); setEditError(""); }}
              className="rounded-none border border-[rgba(15,23,38,0.10)] px-5 py-2.5 text-[12px] font-medium text-[#5b6573] transition-colors duration-200 hover:text-[#0e1726]"
            >
              Цуцлах
            </button>
          </div>
        </div>
      )}

      {/* ─── Blog article — always visible when content is present.
            Medium-style typography: 680px column, 19px Inter body, generous
            leading, full-width inline images with captions. No toggle. ─── */}
      {lesson.content && !editing && (
        <LessonArticle content={lesson.content} />
      )}
    </div>
  );
}

// ─── Video player with skeleton + loading copy ───────────────────────────
function LessonVideoPlayer({
  videoUrl,
  embedUrl,
  isUploaded,
}: {
  videoUrl: string;
  embedUrl: string | null;
  isUploaded: boolean;
}) {
  const [ready, setReady] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [error, setError] = useState(false);

  if (embedUrl) {
    return (
      <div className="relative aspect-video w-full bg-black">
        {!ready && <VideoSkeleton text="Видео ачаалж байна. Түр хүлээгээрэй..." />}
        <iframe
          src={embedUrl}
          className={`absolute inset-0 h-full w-full transition-opacity duration-200 ${ready ? "opacity-100" : "opacity-0"}`}
          allowFullScreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          onLoad={() => setReady(true)}
        />
      </div>
    );
  }

  if (isUploaded) {
    return (
      <div className="relative aspect-video w-full bg-black">
        {!ready && !error && <VideoSkeleton text="Видео ачаалж байна. Түр хүлээгээрэй..." />}
        {ready && buffering && (
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-none bg-black/70 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur-sm">
            Буфер хийж байна...
          </div>
        )}
        {error && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black px-6 text-center">
            <svg className="h-7 w-7 text-[#1080CA]" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <p className="text-[12px] font-bold text-[#0e1726]">Видео ачаалж чадсангүй</p>
            <p className="text-[10px] text-[#5b6573]">Энэ форматыг таны хөтөч тоглуулж чадахгүй байж магадгүй.</p>
            <div className="mt-1 flex items-center gap-3">
              <button
                onClick={() => { setError(false); setReady(false); }}
                className="text-[11px] font-bold text-[#1080CA] hover:underline"
              >
                Дахин оролдох
              </button>
              <a
                href={videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                download
                className="text-[11px] font-bold text-[#0e1726] hover:underline"
              >
                Татаж авах
              </a>
            </div>
          </div>
        )}
        <video
          key={videoUrl + (error ? ":retry" : "")}
          controls
          // metadata-only preload + range-request streaming keeps the first
          // paint cheap on the 1-vCPU origin. Disable PiP/AirPlay to avoid
          // mobile UI controls that hijack the playhead and cause stalls.
          preload="metadata"
          playsInline
          controlsList="nodownload noplaybackrate"
          disableRemotePlayback
          disablePictureInPicture
          className={`h-full w-full bg-black transition-opacity duration-200 ${ready ? "opacity-100" : "opacity-0"}`}
          onLoadedMetadata={() => setReady(true)}
          onCanPlay={() => { setReady(true); setBuffering(false); }}
          onWaiting={() => setBuffering(true)}
          onPlaying={() => setBuffering(false)}
          onStalled={() => setBuffering(true)}
          onError={() => setError(true)}
        >
          {/* Explicit MIME hint so the browser can negotiate the right decoder
              without sniffing — measurable speedup on slow connections.
              Derive type from the URL extension so .mov / .webm don't get
              mis-tagged as video/mp4 (which makes Chrome refuse to play). */}
          <source src={videoUrl} type={getVideoMime(videoUrl)} />
        </video>
      </div>
    );
  }

  return (
    <a
      href={videoUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block p-8 text-center text-[14px] font-bold text-[#1080CA] transition-colors duration-200 hover:underline"
    >
      Видео нээх →
    </a>
  );
}

function VideoSkeleton({ text }: { text: string }) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 overflow-hidden bg-black">
      {/* shimmer band */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(16,128,202,0.06) 50%, transparent 100%)",
          animation: "videoShimmer 1.6s ease-in-out infinite",
        }}
      />
      <div className="relative z-10 flex flex-col items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-none bg-[rgba(16,128,202,0.1)]">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#1080CA] border-t-transparent" />
        </span>
        <p className="text-[12px] font-bold text-[#0e1726]">{text}</p>
        <p className="text-[10px] text-[#6b7280]">Хурд интернетээс хамаарна</p>
      </div>
      <style jsx>{`
        @keyframes videoShimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
