"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect, use, useRef } from "react";
import Link from "next/link";
import { isAdminEmail } from "@/lib/adminClient";
import { formatDistanceToNow } from "@/lib/utils";
import RichEditor from "@/components/RichEditor";

interface ReactionData {
  count: number;
  reacted: boolean;
}

interface LessonTask {
  _id?: string;
  text: string;
  assignedTo?: { _id: string; name: string; avatar?: string };
  completed: boolean;
}

interface Attachment {
  name: string;
  url: string;
  type: string;
  size: number;
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
  lessonTasks: LessonTask[];
  attachments: Attachment[];
  createdAt: string;
  course: { _id: string; title: string };
}

const REACTION_KEYS = ["fire", "heart", "clap", "rocket", "think", "hundred", "haha"];
const REACTION_EMOJIS: Record<string, string> = {
  fire: "🔥", heart: "❤️", clap: "👏", rocket: "🚀", think: "🤔", hundred: "💯", haha: "😂",
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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
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

  // Tasks
  const [editTasks, setEditTasks] = useState<LessonTask[]>([]);
  const [newTaskText, setNewTaskText] = useState("");

  // Attachments
  const [editAttachments, setEditAttachments] = useState<Attachment[]>([]);
  const [fileUploading, setFileUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        setEditTasks(data.lesson.lessonTasks || []);
        setEditAttachments(data.lesson.attachments || []);
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

  const handleImageUpload = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Upload failed");
    return data.url;
  };

  const handleFileAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const endpoint = file.type.startsWith("video/") ? "/api/upload/video" : "/api/upload";
      const res = await fetch(endpoint, { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) {
        setEditAttachments(prev => [...prev, {
          name: file.name,
          url: data.url,
          type: file.type,
          size: file.size,
        }]);
      }
    } catch {
      alert("Файл оруулахад алдаа гарлаа");
    } finally {
      setFileUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const videoType = editData.videoUrl.startsWith("/uploads/") ? "upload" : "link";
      const res = await fetch(`/api/classroom/lessons/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editData,
          videoType,
          lessonTasks: editTasks.map(t => ({ text: t.text, assignedTo: t.assignedTo?._id, completed: t.completed })),
          attachments: editAttachments,
        }),
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

  // Task actions for members
  const handleTaskAction = async (taskIndex: number, action: "claim" | "unclaim" | "complete") => {
    try {
      const res = await fetch(`/api/classroom/lessons/${id}/tasks`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskIndex, action }),
      });
      if (res.ok) {
        const data = await res.json();
        setLesson(prev => prev ? { ...prev, lessonTasks: data.lessonTasks } : prev);
      }
    } catch {}
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
        <Link href="/classroom" className="mt-4 inline-block text-[13px] text-[#FFD300] transition hover:text-[#e6be00]">&larr; Буцах</Link>
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
        <Link href="/classroom" className="mt-6 text-[13px] text-[#FFD300] transition hover:text-[#e6be00]">&larr; Буцах</Link>
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
        className="mb-5 inline-flex items-center gap-1.5 rounded-[4px] px-2 py-1 text-[13px] text-[#6a6a72] transition hover:bg-[#1a1a1e] hover:text-[#eeeee8]"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
        </svg>
        {lesson.course?.title || "Classroom"}
      </Link>

      {/* Video */}
      {lesson.videoUrl && !editing && (
        <div className="mb-6 overflow-hidden rounded-[14px] border border-[rgba(255,255,255,0.04)] bg-[#0e0e10]">
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
              Видео нээх &rarr;
            </a>
          )}
        </div>
      )}

      {/* ═══ EDITING MODE ═══ */}
      {editing ? (
        <div className="space-y-5">
          {/* Title */}
          <input
            value={editData.title}
            onChange={(e) => setEditData((p) => ({ ...p, title: e.target.value }))}
            className="w-full rounded-[8px] border border-[#2a2a2e] bg-[#141416] px-5 py-3 text-xl font-bold text-[#eeeee8] outline-none transition focus:border-[#FFD300]"
            placeholder="Хичээлийн нэр"
          />

          {/* Description */}
          <textarea
            value={editData.description}
            onChange={(e) => setEditData((p) => ({ ...p, description: e.target.value }))}
            rows={2}
            className="w-full rounded-[8px] border border-[#2a2a2e] bg-[#141416] px-5 py-3 text-[14px] text-[#eeeee8] placeholder-[#6a6a72] outline-none transition focus:border-[#FFD300] resize-none"
            placeholder="Богино тайлбар"
          />

          {/* Rich Content Editor */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <svg className="h-4 w-4 text-[#FFD300]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span className="text-[13px] font-semibold text-[#eeeee8]">Агуулга</span>
              <span className="text-[11px] text-[#4a4a55]">Blog editor - format, emoji, images</span>
            </div>
            <RichEditor
              value={editData.content}
              onChange={(html) => setEditData((p) => ({ ...p, content: html }))}
              placeholder="Хичээлийн агуулгыг энд бичнэ... Enter = шинэ мөр, Formatting toolbar дээрээс bold, italic, heading, list, code, quote, emoji гэх мэт..."
              onImageUpload={handleImageUpload}
            />
          </div>

          {/* Video URL */}
          <div className="flex items-center gap-3">
            <input
              value={editData.videoUrl}
              onChange={(e) => setEditData((p) => ({ ...p, videoUrl: e.target.value }))}
              className="flex-1 rounded-[8px] border border-[#2a2a2e] bg-[#141416] px-4 py-2.5 text-[14px] text-[#eeeee8] placeholder-[#6a6a72] outline-none transition focus:border-[#FFD300]"
              placeholder="YouTube/Vimeo URL"
            />
            <label className={`shrink-0 cursor-pointer rounded-[8px] border border-[#2a2a2e] bg-[#141416] px-4 py-2.5 text-[12px] font-medium text-[#6a6a72] transition hover:border-[#FFD300] hover:text-[#eeeee8] ${uploading ? "pointer-events-none opacity-50" : ""}`}>
              {uploading ? `${uploadProgress}%` : "Видео"}
              <input type="file" accept="video/mp4,video/webm,video/quicktime,image/*" onChange={handleEditVideoUpload} className="hidden" disabled={uploading} />
            </label>
          </div>
          {uploading && (
            <div className="h-1.5 overflow-hidden rounded-full bg-[#141416]">
              <div className="h-full rounded-full bg-gradient-to-r from-[#FFD300] to-[#ffeb80] transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
            </div>
          )}

          {/* ── Task Manager ── */}
          <div className="rounded-[12px] border border-[#2a2a2e] bg-[#1a1a1e] overflow-hidden">
            <div className="flex items-center gap-2 border-b border-[#2a2a2e] px-4 py-3 bg-[#141416]">
              <svg className="h-4 w-4 text-[#FFD300]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              <span className="text-[13px] font-semibold text-[#eeeee8]">Даалгаврууд</span>
              <span className="text-[11px] text-[#4a4a55]">Members can claim these</span>
            </div>
            <div className="p-4 space-y-2">
              {editTasks.map((task, i) => (
                <div key={i} className="flex items-center gap-3 rounded-[6px] border border-[#2a2a2e] bg-[#141416] px-3 py-2">
                  <span className="flex-1 text-[13px] text-[#eeeee8]">{task.text}</span>
                  <button onClick={() => setEditTasks(prev => prev.filter((_, idx) => idx !== i))} className="text-[#4a4a55] hover:text-red-400 transition">
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  value={newTaskText}
                  onChange={(e) => setNewTaskText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newTaskText.trim()) {
                      setEditTasks(prev => [...prev, { text: newTaskText.trim(), completed: false }]);
                      setNewTaskText("");
                    }
                  }}
                  placeholder="Даалгавар нэмэх... (Enter)"
                  className="flex-1 rounded-[6px] border border-[#2a2a2e] bg-[#141416] px-3 py-2 text-[13px] text-[#eeeee8] placeholder-[#4a4a55] outline-none focus:border-[rgba(255,211,0,0.3)]"
                />
                <button
                  onClick={() => {
                    if (newTaskText.trim()) {
                      setEditTasks(prev => [...prev, { text: newTaskText.trim(), completed: false }]);
                      setNewTaskText("");
                    }
                  }}
                  className="rounded-[6px] bg-[rgba(255,211,0,0.08)] px-3 py-2 text-[12px] font-semibold text-[#FFD300] transition hover:bg-[rgba(255,211,0,0.15)]"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* ── File Attachments ── */}
          <div className="rounded-[12px] border border-[#2a2a2e] bg-[#1a1a1e] overflow-hidden">
            <div className="flex items-center gap-2 border-b border-[#2a2a2e] px-4 py-3 bg-[#141416]">
              <svg className="h-4 w-4 text-[#FFD300]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              <span className="text-[13px] font-semibold text-[#eeeee8]">Хавсралтууд</span>
            </div>
            <div className="p-4 space-y-2">
              {editAttachments.map((att, i) => (
                <div key={i} className="flex items-center gap-3 rounded-[6px] border border-[#2a2a2e] bg-[#141416] px-3 py-2">
                  <span className="text-[13px]">📎</span>
                  <span className="flex-1 text-[13px] text-[#eeeee8] truncate">{att.name}</span>
                  <span className="text-[11px] text-[#4a4a55]">{formatFileSize(att.size)}</span>
                  <button onClick={() => setEditAttachments(prev => prev.filter((_, idx) => idx !== i))} className="text-[#4a4a55] hover:text-red-400 transition">
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
              <label className={`flex cursor-pointer items-center justify-center gap-2 rounded-[6px] border border-dashed border-[#2a2a2e] px-3 py-3 text-[12px] text-[#6a6a72] transition hover:border-[rgba(255,211,0,0.3)] hover:text-[#eeeee8] ${fileUploading ? "pointer-events-none opacity-50" : ""}`}>
                {fileUploading ? (
                  <div className="h-3 w-3 animate-spin rounded-full border border-[#FFD300] border-t-transparent" />
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" /></svg>
                    Файл хавсаргах
                  </>
                )}
                <input ref={fileInputRef} type="file" onChange={handleFileAttachment} className="hidden" disabled={fileUploading} />
              </label>
            </div>
          </div>

          {/* Save / Cancel */}
          <div className="flex gap-3 pt-2">
            <button onClick={handleSave} disabled={saving || uploading} className="rounded-[8px] bg-[#FFD300] px-6 py-2.5 text-[13px] font-semibold text-black transition hover:bg-[#e6be00] disabled:opacity-50">
              {saving ? "Хадгалж байна..." : "Хадгалах"}
            </button>
            <button onClick={() => { setEditing(false); setEditTasks(lesson.lessonTasks || []); setEditAttachments(lesson.attachments || []); }} className="rounded-[8px] border border-[#2a2a2e] px-5 py-2.5 text-[13px] font-medium text-[#6a6a72] transition hover:border-[#FFD300] hover:text-[#eeeee8]">
              Цуцлах
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* ═══ VIEW MODE - Blog Style ═══ */}

          {/* Title + Meta */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-[#eeeee8] sm:text-3xl leading-tight">{lesson.title}</h1>
            {lesson.description && (
              <p className="mt-2 text-[15px] leading-relaxed text-[#6a6a72]">{lesson.description}</p>
            )}
            <div className="mt-3 flex items-center gap-3 text-[12px] text-[#4a4a55]">
              <span>{formatDistanceToNow(lesson.createdAt)}</span>
              <span className="text-[#2a2a2e]">&middot;</span>
              <span>{lesson.completedBy.length} дуусгасан</span>
              {totalReactions > 0 && (
                <>
                  <span className="text-[#2a2a2e]">&middot;</span>
                  <span>{totalReactions} reaction</span>
                </>
              )}
              {(lesson.lessonTasks?.length || 0) > 0 && (
                <>
                  <span className="text-[#2a2a2e]">&middot;</span>
                  <span>{lesson.lessonTasks.filter(t => t.completed).length}/{lesson.lessonTasks.length} tasks</span>
                </>
              )}
            </div>
          </div>

          {/* Actions bar */}
          <div className="mb-6 flex flex-wrap items-center gap-2">
            {session && (
              <button
                onClick={toggleComplete}
                className={`inline-flex items-center gap-2 rounded-[8px] px-4 py-2 text-[12px] font-semibold transition ${
                  isCompleted
                    ? "bg-[rgba(0,230,118,0.1)] border border-[rgba(0,230,118,0.2)] text-[#00e676]"
                    : "bg-[#1a1a1e] border border-[rgba(255,255,255,0.04)] text-[#6a6a72] hover:text-[#eeeee8] hover:border-[rgba(255,211,0,0.2)]"
                }`}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {isCompleted ? "Дууссан" : "Дуусгах"}
              </button>
            )}
            {admin && (
              <>
                <button onClick={() => setEditing(true)} className="rounded-[8px] border border-[#2a2a2e] px-4 py-2 text-[12px] font-medium text-[#6a6a72] transition hover:border-[#FFD300] hover:text-[#eeeee8]">
                  ✏️ Засах
                </button>
                <button onClick={handleDelete} className="rounded-[8px] border border-[#2a2a2e] px-4 py-2 text-[12px] font-medium text-red-400/60 transition hover:border-red-400/30 hover:text-red-400">
                  Устгах
                </button>
              </>
            )}
          </div>

          {/* Reactions */}
          {session && (
            <div className="mb-6 flex flex-wrap items-center gap-1.5">
              {REACTION_KEYS.map((key) => {
                const data = reactions[key];
                const count = data?.count || 0;
                const reacted = data?.reacted || false;
                return (
                  <button
                    key={key}
                    onClick={() => handleReaction(key)}
                    disabled={reactingEmoji === key}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-all duration-200 ${
                      reacted
                        ? "bg-[rgba(255,211,0,0.1)] border border-[rgba(255,211,0,0.25)]"
                        : "bg-[#1a1a1e] border border-[rgba(255,255,255,0.04)] hover:border-[rgba(255,255,255,0.12)] hover:bg-[#222226]"
                    } ${reactingEmoji === key ? "scale-110" : "active:scale-95"}`}
                  >
                    <span className="text-[15px]">{REACTION_EMOJIS[key]}</span>
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

          {/* Read-only reactions for non-logged-in */}
          {!session && totalReactions > 0 && (
            <div className="mb-6 flex flex-wrap items-center gap-1.5">
              {REACTION_KEYS.filter((key) => (reactions[key]?.count || 0) > 0).map((key) => (
                <div key={key} className="inline-flex items-center gap-1.5 rounded-full bg-[#1a1a1e] border border-[rgba(255,255,255,0.04)] px-3 py-1.5">
                  <span className="text-[15px]">{REACTION_EMOJIS[key]}</span>
                  <span className="text-[11px] font-semibold text-[#6a6a72]">{reactions[key].count}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── Blog Content ── */}
          {lesson.content && (
            <article className="mb-8 rounded-[16px] border border-[rgba(255,255,255,0.04)] bg-[#1a1a1e] overflow-hidden">
              <div className="border-b border-[rgba(255,255,255,0.04)] px-6 py-3.5">
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-[#FFD300]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-[13px] font-semibold text-[#eeeee8]">Хичээлийн тэмдэглэл</span>
                </div>
              </div>
              <div className="px-6 py-5 sm:px-8 sm:py-6">
                <div
                  className="blog-content text-[15px] leading-[1.9] text-[rgba(238,238,232,0.75)]"
                  dangerouslySetInnerHTML={{ __html: lesson.content }}
                />
              </div>
            </article>
          )}

          {/* ── Tasks Section ── */}
          {lesson.lessonTasks && lesson.lessonTasks.length > 0 && (
            <div className="mb-8 rounded-[16px] border border-[rgba(255,255,255,0.04)] bg-[#1a1a1e] overflow-hidden">
              <div className="border-b border-[rgba(255,255,255,0.04)] px-6 py-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[16px]">📋</span>
                    <span className="text-[13px] font-semibold text-[#eeeee8]">Даалгаврууд</span>
                    <span className="rounded-full bg-[rgba(255,211,0,0.08)] px-2 py-0.5 text-[10px] font-bold text-[#FFD300]">
                      {lesson.lessonTasks.filter(t => t.completed).length}/{lesson.lessonTasks.length}
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[#141416]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#FFD300] to-[#00e676] transition-all duration-500"
                        style={{ width: `${lesson.lessonTasks.length > 0 ? (lesson.lessonTasks.filter(t => t.completed).length / lesson.lessonTasks.length * 100) : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="divide-y divide-[rgba(255,255,255,0.03)]">
                {lesson.lessonTasks.map((task, i) => {
                  const isMine = task.assignedTo && String(task.assignedTo._id) === userId;
                  const isClaimed = !!task.assignedTo;
                  return (
                    <div key={i} className={`flex items-center gap-3 px-6 py-3.5 transition ${task.completed ? "opacity-60" : ""}`}>
                      {/* Status indicator */}
                      <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] ${
                        task.completed ? "bg-[#00e676] text-black" : isClaimed ? "bg-[rgba(255,211,0,0.1)] border border-[rgba(255,211,0,0.2)]" : "bg-[#141416] border border-[#2a2a2e]"
                      }`}>
                        {task.completed ? "✓" : isClaimed ? "👤" : (i + 1)}
                      </div>

                      {/* Task text */}
                      <div className="flex-1 min-w-0">
                        <span className={`text-[14px] ${task.completed ? "text-[#4a4a55] line-through" : "text-[#eeeee8]"}`}>
                          {task.text}
                        </span>
                        {task.assignedTo && (
                          <span className="ml-2 text-[11px] text-[#6a6a72]">
                            &mdash; {task.assignedTo.name}
                          </span>
                        )}
                      </div>

                      {/* Actions */}
                      {session && (
                        <div className="flex shrink-0 gap-1.5">
                          {!isClaimed && (
                            <button onClick={() => handleTaskAction(i, "claim")} className="rounded-[6px] bg-[rgba(255,211,0,0.08)] px-3 py-1 text-[11px] font-semibold text-[#FFD300] transition hover:bg-[rgba(255,211,0,0.15)]">
                              Авах
                            </button>
                          )}
                          {isMine && !task.completed && (
                            <>
                              <button onClick={() => handleTaskAction(i, "complete")} className="rounded-[6px] bg-[rgba(0,230,118,0.08)] px-3 py-1 text-[11px] font-semibold text-[#00e676] transition hover:bg-[rgba(0,230,118,0.15)]">
                                Дуусгах
                              </button>
                              <button onClick={() => handleTaskAction(i, "unclaim")} className="rounded-[6px] border border-[#2a2a2e] px-2 py-1 text-[11px] text-[#4a4a55] transition hover:text-red-400">
                                ✕
                              </button>
                            </>
                          )}
                          {isMine && task.completed && (
                            <button onClick={() => handleTaskAction(i, "complete")} className="rounded-[6px] border border-[#2a2a2e] px-3 py-1 text-[11px] text-[#4a4a55] transition hover:text-[#eeeee8]">
                              Буцаах
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Attachments ── */}
          {lesson.attachments && lesson.attachments.length > 0 && (
            <div className="mb-8 rounded-[16px] border border-[rgba(255,255,255,0.04)] bg-[#1a1a1e] overflow-hidden">
              <div className="border-b border-[rgba(255,255,255,0.04)] px-6 py-3.5">
                <div className="flex items-center gap-2">
                  <span className="text-[16px]">📎</span>
                  <span className="text-[13px] font-semibold text-[#eeeee8]">Хавсралтууд</span>
                  <span className="text-[11px] text-[#4a4a55]">{lesson.attachments.length} файл</span>
                </div>
              </div>
              <div className="divide-y divide-[rgba(255,255,255,0.03)]">
                {lesson.attachments.map((att, i) => (
                  <a
                    key={i}
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-6 py-3 transition hover:bg-[rgba(255,211,0,0.03)]"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-[#141416] text-[16px]">
                      {att.type.includes("pdf") ? "📄" : att.type.includes("image") ? "🖼️" : att.type.includes("video") ? "🎬" : att.type.includes("zip") || att.type.includes("rar") ? "📦" : "📁"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-[#eeeee8] truncate">{att.name}</div>
                      <div className="text-[11px] text-[#4a4a55]">{formatFileSize(att.size)}</div>
                    </div>
                    <svg className="h-4 w-4 shrink-0 text-[#4a4a55]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </a>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
