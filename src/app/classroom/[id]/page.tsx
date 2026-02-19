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
  completedBy: string[];
  likes: string[];
  commentsCount: number;
  createdAt: string;
  course: { _id: string; title: string };
}

function getEmbedUrl(url: string): string | null {
  if (!url) return null;
  // YouTube
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  // Vimeo
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

  const admin = isAdminEmail(session?.user?.email);
  const userId = session ? (session.user as { id: string }).id : null;

  useEffect(() => {
    fetchLesson();
  }, [id]);

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
        <div className="h-3 w-3 animate-pulse rounded-full bg-[#cc2200]" />
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="py-16 text-center">
        <p className="font-[Bebas_Neue] text-2xl tracking-[2px] text-[rgba(240,236,227,0.3)]">Lesson not found</p>
        <Link href="/classroom" className="mt-4 inline-block text-[11px] tracking-[3px] text-[#cc2200]">← BACK</Link>
      </div>
    );
  }

  const isCompleted = userId ? lesson.completedBy.includes(userId) : false;
  const embedUrl = getEmbedUrl(lesson.videoUrl);
  const isUploadedVideo = lesson.videoType === "upload" || lesson.videoUrl.startsWith("/uploads/");

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/classroom" className="mb-6 inline-block text-[10px] uppercase tracking-[3px] text-[#5a5550] transition hover:text-[#cc2200]">
        ← {lesson.course?.title || "Classroom"}
      </Link>

      {/* Video */}
      {lesson.videoUrl && (
        <div className="mb-8">
          {embedUrl ? (
            <div className="relative aspect-video w-full overflow-hidden bg-[#0f0f0f]">
              <iframe
                src={embedUrl}
                className="absolute inset-0 h-full w-full"
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              />
            </div>
          ) : isUploadedVideo ? (
            <video controls className="w-full bg-[#0f0f0f]" preload="metadata">
              <source src={lesson.videoUrl} />
            </video>
          ) : (
            <a href={lesson.videoUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost inline-block">
              Open Video Link →
            </a>
          )}
        </div>
      )}

      {/* Title + Admin controls */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex-1">
          {editing ? (
            <div className="space-y-3">
              <input value={editData.title} onChange={(e) => setEditData((p) => ({ ...p, title: e.target.value }))} className="input-dark text-lg font-bold" />
              <textarea value={editData.description} onChange={(e) => setEditData((p) => ({ ...p, description: e.target.value }))} rows={3} className="input-dark resize-none" placeholder="Description" />
              <textarea value={editData.content} onChange={(e) => setEditData((p) => ({ ...p, content: e.target.value }))} rows={8} className="input-dark resize-none" placeholder="Lesson content (supports text)" />
              <input value={editData.videoUrl} onChange={(e) => setEditData((p) => ({ ...p, videoUrl: e.target.value }))} className="input-dark" placeholder="Video URL" />
              <div className="flex gap-2">
                <button onClick={handleSave} disabled={saving} className="btn-blood !py-2 !px-5 !text-[10px]">{saving ? "Saving..." : "Save"}</button>
                <button onClick={() => setEditing(false)} className="btn-ghost !py-2 !px-5 !text-[10px]">Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="font-[Bebas_Neue] text-3xl tracking-[3px] text-[#ede8df] md:text-4xl">
                {lesson.title}
              </h1>
              {lesson.description && (
                <p className="mt-3 text-[13px] leading-[1.9] text-[rgba(240,236,227,0.5)]">
                  {lesson.description}
                </p>
              )}
            </>
          )}
        </div>

        <div className="flex shrink-0 gap-2">
          {/* Complete toggle */}
          {session && (
            <button
              onClick={toggleComplete}
              className={`flex h-10 w-10 items-center justify-center border transition ${
                isCompleted ? "border-[#cc2200] bg-[#cc2200] text-[#ede8df]" : "border-[#2a2825] text-[#5a5550] hover:border-[#cc2200]"
              }`}
              title={isCompleted ? "Mark incomplete" : "Mark complete"}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </button>
          )}

          {admin && !editing && (
            <>
              <button onClick={() => setEditing(true)} className="btn-ghost !py-2 !px-3 !text-[9px]">Edit</button>
              <button onClick={handleDelete} className="btn-ghost !py-2 !px-3 !text-[9px] !text-[#cc2200] hover:!border-[#cc2200]">Del</button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      {lesson.content && !editing && (
        <div className="card mb-8 p-6">
          <div className="whitespace-pre-wrap text-[13px] leading-[2] text-[rgba(240,236,227,0.7)]">
            {lesson.content}
          </div>
        </div>
      )}

      <div className="text-[10px] tracking-[2px] text-[#5a5550]">
        {formatDistanceToNow(lesson.createdAt)} · {lesson.completedBy.length} completed
      </div>
    </div>
  );
}
