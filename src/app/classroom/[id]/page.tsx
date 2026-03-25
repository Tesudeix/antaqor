"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect, use } from "react";
import Link from "next/link";
import { isAdminEmail } from "@/lib/adminClient";
import { formatDistanceToNow } from "@/lib/utils";

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
  commentsCount: number;
  createdAt: string;
  course: { _id: string; title: string };
}

function getEmbedUrl(url: string): string | null {
  if (!url) return null;
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  return null;
}

export default function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session } = useSession();
  const [lesson, setLesson] = useState<LessonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({ title: "", description: "", content: "", videoUrl: "" });
  const [saving, setSaving] = useState(false);
  const [userLevel, setUserLevel] = useState(1);

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

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/classroom/lessons/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editData),
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
    if (!confirm("Delete this lesson?")) return;
    const res = await fetch(`/api/classroom/lessons/${id}`, { method: "DELETE" });
    if (res.ok) window.location.href = "/classroom";
  };

  const toggleComplete = async () => {
    const res = await fetch(`/api/classroom/lessons/${id}/complete`, { method: "POST" });
    if (res.ok) fetchLesson();
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-2 w-2 animate-pulse rounded-full bg-[#006491]" />
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="py-16 text-center">
        <p className="text-[15px] text-[#6b6b78]">Хичээл олдсонгүй</p>
        <Link href="/classroom" className="mt-4 inline-block text-[13px] text-[#006491]">← Буцах</Link>
      </div>
    );
  }

  if ((lesson.requiredLevel || 0) > userLevel && !admin) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0c0c10]">
          <svg className="h-6 w-6 text-[#6b6b78]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <p className="text-[15px] font-medium text-[#e8e6e1]">LV.{lesson.requiredLevel} шаардлагатай</p>
        <p className="mt-1 text-[13px] text-[#6b6b78]">Таны түвшин: LV.{userLevel}</p>
        <Link href="/classroom" className="mt-6 text-[13px] text-[#006491]">← Буцах</Link>
      </div>
    );
  }

  const isCompleted = userId ? lesson.completedBy.includes(userId) : false;
  const embedUrl = getEmbedUrl(lesson.videoUrl);
  const isUploadedVideo = lesson.videoType === "upload" || lesson.videoUrl.startsWith("/uploads/");

  return (
    <div>
      {/* Back link */}
      <Link href="/classroom" className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-[#6b6b78] transition hover:text-[#e8e6e1]">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
        </svg>
        {lesson.course?.title || "Хичээл"}
      </Link>

      {/* Video */}
      {lesson.videoUrl && (
        <div className="mb-6 overflow-hidden rounded-xl bg-[#0c0c10]">
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
            <a href={lesson.videoUrl} target="_blank" rel="noopener noreferrer" className="block p-6 text-center text-[13px] text-[#006491]">
              Видео нээх →
            </a>
          )}
        </div>
      )}

      {/* Title + controls */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex-1">
          {editing ? (
            <div className="space-y-3">
              <input value={editData.title} onChange={(e) => setEditData((p) => ({ ...p, title: e.target.value }))} className="input-dark text-lg font-bold" />
              <textarea value={editData.description} onChange={(e) => setEditData((p) => ({ ...p, description: e.target.value }))} rows={3} className="input-dark resize-none" placeholder="Тайлбар" />
              <textarea value={editData.content} onChange={(e) => setEditData((p) => ({ ...p, content: e.target.value }))} rows={8} className="input-dark resize-none" placeholder="Контент" />
              <input value={editData.videoUrl} onChange={(e) => setEditData((p) => ({ ...p, videoUrl: e.target.value }))} className="input-dark" placeholder="Видео URL" />
              <div className="flex gap-2">
                <button onClick={handleSave} disabled={saving} className="btn-primary !text-[12px]">{saving ? "..." : "Хадгалах"}</button>
                <button onClick={() => setEditing(false)} className="btn-ghost !text-[12px]">Цуцлах</button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-[#e8e6e1]">{lesson.title}</h1>
              {lesson.description && (
                <p className="mt-2 text-[14px] leading-relaxed text-[#6b6b78]">{lesson.description}</p>
              )}
            </>
          )}
        </div>

        <div className="flex shrink-0 gap-2">
          {session && (
            <button
              onClick={toggleComplete}
              className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
                isCompleted ? "bg-[#006491] text-white" : "bg-[#0c0c10] text-[#6b6b78] hover:text-[#e8e6e1]"
              }`}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </button>
          )}
          {admin && !editing && (
            <>
              <button onClick={() => setEditing(true)} className="btn-ghost !py-2 !px-3 !text-[12px]">Засах</button>
              <button onClick={handleDelete} className="btn-ghost !py-2 !px-3 !text-[12px] !text-red-400">Устгах</button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      {lesson.content && !editing && (
        <div className="card mb-6 p-5">
          <div className="whitespace-pre-wrap text-[14px] leading-[1.9] text-[rgba(232,230,225,0.7)]">
            {lesson.content}
          </div>
        </div>
      )}

      <p className="text-[12px] text-[#6b6b78]">
        {formatDistanceToNow(lesson.createdAt)} · {lesson.completedBy.length} дуусгасан
      </p>
    </div>
  );
}
