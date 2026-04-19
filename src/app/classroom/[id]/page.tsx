"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect, use } from "react";
import Link from "next/link";
import { isAdminEmail } from "@/lib/adminClient";
import { formatDistanceToNow } from "@/lib/utils";
import { motion } from "framer-motion";

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
  const color = active ? "#EF2C58" : "currentColor";
  const props = { className: "h-[16px] w-[16px]", fill: "none", stroke: color, viewBox: "0 0 24 24", strokeWidth: active ? 2 : 1.5 };
  switch (type) {
    case "fire": return (<svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" fill={active ? "rgba(239,44,88,0.2)" : "none"} /></svg>);
    case "rocket": return (<svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" /></svg>);
    case "think": return (<svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" /></svg>);
    default: return null;
  }
};

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

export default function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session } = useSession();
  const [lesson, setLesson] = useState<LessonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({ title: "", description: "", content: "", videoUrl: "" });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [userLevel, setUserLevel] = useState(1);
  const [reactions, setReactions] = useState<Record<string, ReactionData>>({});
  const [reactingEmoji, setReactingEmoji] = useState<string | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);

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
    const isVideo = file.type.startsWith("video/");
    if (!isVideo && !file.type.startsWith("image/")) return;
    setUploading(true);
    setUploadProgress(0);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const endpoint = isVideo ? "/api/upload/video" : "/api/upload";
      const xhr = new XMLHttpRequest();
      const result = await new Promise<{ url: string }>((resolve, reject) => {
        xhr.upload.addEventListener("progress", (ev) => {
          if (ev.lengthComputable) setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
        });
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
          else reject(new Error("Upload failed"));
        });
        xhr.addEventListener("error", () => reject(new Error("Upload failed")));
        xhr.open("POST", endpoint);
        xhr.send(formData);
      });
      setEditData((p) => ({ ...p, videoUrl: result.url }));
    } catch {
      alert("Файл оруулахад алдаа гарлаа");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const videoType = editData.videoUrl.startsWith("/uploads/") ? "upload" : "link";
      const res = await fetch(`/api/classroom/lessons/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editData, videoType }),
      });
      if (res.ok) {
        fetchLesson();
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
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
        <div className="h-2 w-2 animate-pulse-gold rounded-full bg-[#EF2C58]" />
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="py-16 text-center">
        <p className="text-[15px] text-[#888888]">Хичээл олдсонгүй</p>
        <Link href="/classroom" className="mt-4 inline-block text-[13px] font-bold text-[#EF2C58] transition-colors duration-200 hover:underline">← Буцах</Link>
      </div>
    );
  }

  if ((lesson.requiredLevel || 0) > userLevel && !admin) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-[4px] border border-[rgba(0,0,0,0.08)] bg-[#FFFFFF]">
          <svg className="h-7 w-7 text-[#888888]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <p className="text-[16px] font-bold text-[#1A1A1A]">LV.{lesson.requiredLevel} шаардлагатай</p>
        <p className="mt-1.5 text-[14px] text-[#888888]">Таны түвшин: LV.{userLevel}</p>
        <Link href="/classroom" className="mt-8 text-[13px] font-bold text-[#EF2C58] transition-colors duration-200 hover:underline">← Буцах</Link>
      </div>
    );
  }

  const isCompleted = userId ? lesson.completedBy.includes(userId) : false;
  const embedUrl = getEmbedUrl(lesson.videoUrl);
  const isUploadedVideo = lesson.videoType === "upload" || lesson.videoUrl.startsWith("/uploads/");

  return (
    <div className="mx-auto max-w-[900px]">
      {/* Back + nav */}
      <div className="mb-6 flex items-center justify-between">
        <Link
          href={lesson.course?._id ? `/classroom/course/${lesson.course._id}` : "/classroom"}
          className="inline-flex items-center gap-2 text-[13px] font-medium text-[#888888] transition-colors duration-200 hover:text-[#1A1A1A]"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
          </svg>
          {lesson.course?.title || "Хичээлийн танхим"}
        </Link>
        {/* Lesson nav (prev/next) always visible */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#888888]">
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
          className="mb-6 overflow-hidden rounded-[4px] border border-[rgba(0,0,0,0.08)] bg-[#F8F8F6]"
        >
          {embedUrl ? (
            <div className="relative aspect-video w-full">
              <iframe
                src={embedUrl}
                className="absolute inset-0 h-full w-full"
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              />
            </div>
          ) : isUploadedVideo ? (
            <video controls className="w-full" preload="metadata">
              <source src={lesson.videoUrl} />
            </video>
          ) : (
            <a href={lesson.videoUrl} target="_blank" rel="noopener noreferrer" className="block p-8 text-center text-[14px] font-bold text-[#EF2C58] transition-colors duration-200 hover:underline">
              Видео нээх →
            </a>
          )}
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
          <h1 className="text-[24px] font-bold leading-tight tracking-[-0.02em] text-[#1A1A1A] sm:text-[32px]">{lesson.title}</h1>
          {lesson.description && (
            <p className="mt-3 text-[16px] leading-relaxed text-[#666666]">{lesson.description}</p>
          )}

          {/* Actions row */}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {session && (
              <button
                onClick={toggleComplete}
                className={`flex items-center gap-2 rounded-[4px] px-5 py-2.5 text-[13px] font-bold transition-all duration-200 ${
                  isCompleted
                    ? "bg-[rgba(239,44,88,0.1)] border border-[rgba(239,44,88,0.3)] text-[#EF2C58]"
                    : "bg-[#EF2C58] text-[#F8F8F6] hover:shadow-[0_0_24px_rgba(239,44,88,0.25)]"
                }`}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {isCompleted ? "Дууссан" : "Дуусгах"}
              </button>
            )}

            {/* Transcript toggle */}
            {lesson.content && (
              <button
                onClick={() => setShowTranscript(!showTranscript)}
                className={`rounded-[4px] border px-4 py-2.5 text-[12px] font-medium transition-all duration-200 ${
                  showTranscript
                    ? "border-[rgba(15,129,202,0.4)] bg-[rgba(15,129,202,0.1)] text-[#0F81CA]"
                    : "border-[rgba(0,0,0,0.08)] text-[#888888] hover:text-[#1A1A1A]"
                }`}
              >
                Тэмдэглэл
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
                      className={`inline-flex items-center gap-1 rounded-[4px] px-2 py-1.5 transition-all duration-200 ${
                        reacted
                          ? "bg-[rgba(239,44,88,0.1)]"
                          : "text-[#888888] hover:bg-[rgba(255,255,255,0.04)]"
                      }`}
                    >
                      <ReactionIcon type={key} active={reacted} />
                      {count > 0 && (
                        <span className={`text-[10px] font-semibold ${reacted ? "text-[#EF2C58]" : "text-[#888888]"}`}>{count}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {admin && (
              <div className="flex items-center gap-2">
                <button onClick={() => setEditing(true)} className="rounded-[4px] border border-[rgba(0,0,0,0.08)] px-4 py-2 text-[12px] font-medium text-[#888888] transition-colors duration-200 hover:text-[#1A1A1A]">Засах</button>
                <button onClick={handleDelete} className="rounded-[4px] border border-[rgba(0,0,0,0.08)] px-4 py-2 text-[12px] font-medium text-red-500/50 transition-colors duration-200 hover:text-red-400">Устгах</button>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* ─── Edit form ─── */}
      {editing && (
        <div className="mb-8 rounded-[4px] border border-[rgba(0,0,0,0.08)] bg-[#FFFFFF] p-6 space-y-4">
          <input value={editData.title} onChange={(e) => setEditData((p) => ({ ...p, title: e.target.value }))} className="w-full rounded-[4px] border border-[rgba(0,0,0,0.08)] bg-[#F8F8F6] px-4 py-3 text-[18px] font-bold text-[#1A1A1A] outline-none transition-colors duration-200 focus:border-[rgba(239,44,88,0.4)]" />
          <textarea value={editData.description} onChange={(e) => setEditData((p) => ({ ...p, description: e.target.value }))} rows={2} className="w-full rounded-[4px] border border-[rgba(0,0,0,0.08)] bg-[#F8F8F6] px-4 py-3 text-[15px] text-[#1A1A1A] placeholder-[#888888] outline-none transition-colors duration-200 focus:border-[rgba(239,44,88,0.4)] resize-none" placeholder="Тайлбар" />
          <textarea value={editData.content} onChange={(e) => setEditData((p) => ({ ...p, content: e.target.value }))} rows={12} className="w-full rounded-[4px] border border-[rgba(0,0,0,0.08)] bg-[#F8F8F6] px-4 py-3 text-[15px] text-[#1A1A1A] placeholder-[#888888] outline-none transition-colors duration-200 focus:border-[rgba(239,44,88,0.4)] resize-none" placeholder="Хичээлийн агуулга (текст)" />
          <div className="flex items-center gap-3">
            <input value={editData.videoUrl} onChange={(e) => setEditData((p) => ({ ...p, videoUrl: e.target.value }))} className="flex-1 rounded-[4px] border border-[rgba(0,0,0,0.08)] bg-[#F8F8F6] px-4 py-3 text-[14px] text-[#1A1A1A] placeholder-[#888888] outline-none transition-colors duration-200 focus:border-[rgba(239,44,88,0.4)]" placeholder="Видео URL" />
            <label className={`shrink-0 cursor-pointer rounded-[4px] border border-[rgba(0,0,0,0.08)] bg-[#F8F8F6] px-4 py-3 text-[12px] font-medium text-[#888888] transition-colors duration-200 hover:text-[#1A1A1A] ${uploading ? "pointer-events-none opacity-50" : ""}`}>
              {uploading ? `${uploadProgress}%` : "Файл"}
              <input type="file" accept="video/mp4,video/webm,video/quicktime,image/*" onChange={handleEditVideoUpload} className="hidden" disabled={uploading} />
            </label>
          </div>
          {uploading && (
            <div className="h-1.5 overflow-hidden rounded-full bg-[rgba(0,0,0,0.08)]">
              <div className="h-full rounded-full bg-[#EF2C58] transition-all duration-200" style={{ width: `${uploadProgress}%` }} />
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={handleSave} disabled={saving || uploading} className="rounded-[4px] bg-[#EF2C58] px-6 py-2.5 text-[12px] font-bold text-[#F8F8F6] transition-all duration-200 disabled:opacity-50">{saving ? "..." : "Хадгалах"}</button>
            <button onClick={() => setEditing(false)} className="rounded-[4px] border border-[rgba(0,0,0,0.08)] px-5 py-2.5 text-[12px] font-medium text-[#888888] transition-colors duration-200 hover:text-[#1A1A1A]">Цуцлах</button>
          </div>
        </div>
      )}

      {/* ─── Transcript Panel (toggleable) ─── */}
      {lesson.content && !editing && showTranscript && (
        <motion.article
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="mb-8 overflow-hidden"
        >
          <div className="rounded-[4px] border border-[rgba(0,0,0,0.08)] bg-[#FFFFFF] p-6">
            <div className="mb-4 flex items-center gap-2">
              <div className="h-[2px] w-6 bg-[#EF2C58]" />
              <span className="meta-label">Хичээлийн тэмдэглэл</span>
            </div>
            <div className="whitespace-pre-wrap text-[15px] leading-[1.8] text-[#666666]">
              {lesson.content}
            </div>
          </div>
        </motion.article>
      )}
    </div>
  );
}
