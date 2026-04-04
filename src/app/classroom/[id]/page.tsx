"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect, use } from "react";
import Link from "next/link";
import { isAdminEmail } from "@/lib/adminClient";
import { formatDistanceToNow } from "@/lib/utils";

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

const REACTION_KEYS = ["fire", "heart", "clap", "rocket", "think", "hundred", "haha"];

const ReactionIcon = ({ type, active }: { type: string; active: boolean }) => {
  const color = active ? "#FFD300" : "currentColor";
  const props = { className: "h-[16px] w-[16px]", fill: "none", stroke: color, viewBox: "0 0 24 24", strokeWidth: active ? 2 : 1.5 };
  switch (type) {
    case "fire": return (<svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" fill={active ? "rgba(255,211,0,0.2)" : "none"} /></svg>);
    case "heart": return (<svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" fill={active ? "rgba(255,211,0,0.2)" : "none"} /></svg>);
    case "clap": return (<svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.25c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75 2.25 2.25 0 012.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282m0 0h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23H5.904m10.598-9.75H14.25M5.904 18.5c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 01-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 9.953 4.167 9.5 5 9.5h1.053c.472 0 .745.556.5.96a8.958 8.958 0 00-1.302 4.665c0 1.194.232 2.333.654 3.375z" /></svg>);
    case "rocket": return (<svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" /></svg>);
    case "think": return (<svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" /></svg>);
    case "hundred": return (<svg {...props} fill={active ? "rgba(255,211,0,0.2)" : "none"}><path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" /></svg>);
    case "haha": return (<svg {...props}><circle cx="12" cy="12" r="9" fill={active ? "rgba(255,211,0,0.15)" : "none"} /><path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" /></svg>);
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
        <div className="h-2 w-2 animate-pulse rounded-full bg-[#FFD300]" />
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="py-16 text-center">
        <p className="text-[15px] text-[#6a6a72]">Хичээл олдсонгүй</p>
        <Link href="/classroom" className="mt-4 inline-block text-[13px] text-[#FFD300] transition hover:text-[#e6be00]">← Буцах</Link>
      </div>
    );
  }

  if ((lesson.requiredLevel || 0) > userLevel && !admin) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#1a1a1e] border border-[rgba(255,211,0,0.1)]">
          <svg className="h-6 w-6 text-[#6a6a72]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <p className="text-[15px] font-medium text-[#eeeee8]">LV.{lesson.requiredLevel} шаардлагатай</p>
        <p className="mt-1 text-[13px] text-[#6a6a72]">Таны түвшин: LV.{userLevel}</p>
        <Link href="/classroom" className="mt-6 text-[13px] text-[#FFD300] transition hover:text-[#e6be00]">← Буцах</Link>
      </div>
    );
  }

  const isCompleted = userId ? lesson.completedBy.includes(userId) : false;
  const embedUrl = getEmbedUrl(lesson.videoUrl);
  const isUploadedVideo = lesson.videoType === "upload" || lesson.videoUrl.startsWith("/uploads/");
  const totalReactions = Object.values(reactions).reduce((sum, r) => sum + r.count, 0);

  return (
    <div className="mx-auto max-w-4xl">
      {/* Back link */}
      <Link
        href={lesson.course?._id ? `/classroom/course/${lesson.course._id}` : "/classroom"}
        className="mb-5 inline-flex items-center gap-1.5 rounded-[8px] px-2 py-1 text-[13px] text-[#6a6a72] transition hover:bg-[#1a1a1e] hover:text-[#eeeee8]"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
        </svg>
        {lesson.course?.title || "Classroom"}
      </Link>

      {/* Video */}
      {lesson.videoUrl && !editing && (
        <div className="mb-5 overflow-hidden rounded-[12px] border border-[rgba(255,255,255,0.04)] bg-[#0e0e10]">
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
            <a href={lesson.videoUrl} target="_blank" rel="noopener noreferrer" className="block p-6 text-center text-[13px] text-[#FFD300] transition hover:text-[#e6be00]">
              Видео нээх →
            </a>
          )}
        </div>
      )}

      {/* Title + actions */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="space-y-3">
              <input value={editData.title} onChange={(e) => setEditData((p) => ({ ...p, title: e.target.value }))} className="w-full rounded-[10px] border border-[#2a2a2e] bg-[#141416] px-4 py-2.5 text-lg font-bold text-[#eeeee8] outline-none transition focus:border-[#FFD300]" />
              <textarea value={editData.description} onChange={(e) => setEditData((p) => ({ ...p, description: e.target.value }))} rows={2} className="w-full rounded-[10px] border border-[#2a2a2e] bg-[#141416] px-4 py-2.5 text-[14px] text-[#eeeee8] placeholder-[#6a6a72] outline-none transition focus:border-[#FFD300] resize-none" placeholder="Тайлбар" />
              <textarea value={editData.content} onChange={(e) => setEditData((p) => ({ ...p, content: e.target.value }))} rows={10} className="w-full rounded-[10px] border border-[#2a2a2e] bg-[#141416] px-4 py-2.5 text-[14px] text-[#eeeee8] placeholder-[#6a6a72] outline-none transition focus:border-[#FFD300] resize-none" placeholder="Хичээлийн агуулга (текст)" />
              <div className="flex items-center gap-3">
                <input value={editData.videoUrl} onChange={(e) => setEditData((p) => ({ ...p, videoUrl: e.target.value }))} className="flex-1 rounded-[10px] border border-[#2a2a2e] bg-[#141416] px-4 py-2.5 text-[14px] text-[#eeeee8] placeholder-[#6a6a72] outline-none transition focus:border-[#FFD300]" placeholder="Видео URL" />
                <label className={`shrink-0 cursor-pointer rounded-[10px] border border-[#2a2a2e] bg-[#141416] px-4 py-2.5 text-[12px] font-medium text-[#6a6a72] transition hover:border-[#FFD300] hover:text-[#eeeee8] ${uploading ? "pointer-events-none opacity-50" : ""}`}>
                  {uploading ? `${uploadProgress}%` : "Файл"}
                  <input type="file" accept="video/mp4,video/webm,video/quicktime,image/*" onChange={handleEditVideoUpload} className="hidden" disabled={uploading} />
                </label>
              </div>
              {uploading && (
                <div className="h-1.5 overflow-hidden rounded-full bg-[#141416]">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#FFD300] to-[#ffeb80] transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={handleSave} disabled={saving || uploading} className="rounded-[10px] bg-[#FFD300] px-5 py-2 text-[12px] font-semibold text-black transition hover:bg-[#e6be00] disabled:opacity-50">{saving ? "..." : "Хадгалах"}</button>
                <button onClick={() => setEditing(false)} className="rounded-[10px] border border-[#2a2a2e] px-4 py-2 text-[12px] font-medium text-[#6a6a72] transition hover:border-[#FFD300] hover:text-[#eeeee8]">Цуцлах</button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-bold text-[#eeeee8] sm:text-2xl">{lesson.title}</h1>
              {lesson.description && (
                <p className="mt-1.5 text-[14px] leading-relaxed text-[#6a6a72]">{lesson.description}</p>
              )}
              <div className="mt-2 flex items-center gap-3 text-[12px] text-[#4a4a55]">
                <span>{formatDistanceToNow(lesson.createdAt)}</span>
                <span>·</span>
                <span>{lesson.completedBy.length} дуусгасан</span>
                {totalReactions > 0 && (
                  <>
                    <span>·</span>
                    <span>{totalReactions} reaction</span>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {!editing && (
          <div className="flex shrink-0 gap-2">
            {session && (
              <button
                onClick={toggleComplete}
                className={`flex h-9 w-9 items-center justify-center rounded-[10px] transition ${
                  isCompleted ? "bg-[#00e676] text-black" : "bg-[#1a1a1e] border border-[rgba(255,255,255,0.04)] text-[#6a6a72] hover:text-[#eeeee8] hover:border-[rgba(255,211,0,0.2)]"
                }`}
                title={isCompleted ? "Дууссан" : "Дуусгах"}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </button>
            )}
            {admin && (
              <>
                <button onClick={() => setEditing(true)} className="rounded-[10px] border border-[#2a2a2e] px-3 py-1.5 text-[12px] font-medium text-[#6a6a72] transition hover:border-[#FFD300] hover:text-[#eeeee8]">Засах</button>
                <button onClick={handleDelete} className="rounded-[10px] border border-[#2a2a2e] px-3 py-1.5 text-[12px] font-medium text-red-400/60 transition hover:border-red-400/30 hover:text-red-400">Устгах</button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Reactions bar */}
      {!editing && session && (
        <div className="mb-5 flex flex-wrap items-center gap-1.5">
          {REACTION_KEYS.map((key) => {
            const data = reactions[key];
            const count = data?.count || 0;
            const reacted = data?.reacted || false;
            return (
              <button
                key={key}
                onClick={() => handleReaction(key)}
                disabled={reactingEmoji === key}
                className={`inline-flex items-center gap-1.5 rounded-[8px] px-2.5 py-1.5 transition-all duration-200 ${
                  reacted
                    ? "bg-[rgba(255,211,0,0.08)] border border-[rgba(255,211,0,0.25)] shadow-[0_0_8px_rgba(255,211,0,0.08)]"
                    : "bg-[#1a1a1e] border border-[rgba(255,255,255,0.04)] hover:border-[rgba(255,255,255,0.12)] hover:bg-[#222226]"
                } ${reactingEmoji === key ? "scale-110" : "active:scale-95"}`}
              >
                <ReactionIcon type={key} active={reacted} />
                {count > 0 && (
                  <span className={`text-[11px] font-semibold tabular-nums ${reacted ? "text-[#FFD300]" : "text-[#6a6a72]"}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Reactions display for non-logged-in */}
      {!editing && !session && totalReactions > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-1.5">
          {REACTION_KEYS.filter((key) => (reactions[key]?.count || 0) > 0).map((key) => (
            <div key={key} className="inline-flex items-center gap-1.5 rounded-[8px] bg-[#1a1a1e] border border-[rgba(255,255,255,0.04)] px-2.5 py-1.5">
              <ReactionIcon type={key} active={false} />
              <span className="text-[11px] font-semibold text-[#6a6a72]">{reactions[key].count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Text content section */}
      {lesson.content && !editing && (
        <div className="mb-6 rounded-[12px] border border-[rgba(255,255,255,0.04)] bg-[#1a1a1e]">
          <div className="border-b border-[rgba(255,255,255,0.04)] px-5 py-3">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-[#FFD300]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-[13px] font-semibold text-[#eeeee8]">Хичээлийн тэмдэглэл</span>
            </div>
          </div>
          <div className="px-5 py-4">
            <div className="whitespace-pre-wrap text-[14px] leading-[1.85] text-[rgba(238,238,232,0.7)]">
              {lesson.content}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
