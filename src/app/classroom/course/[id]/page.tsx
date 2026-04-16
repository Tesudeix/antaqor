"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useMembership } from "@/lib/useMembership";

interface Course {
  _id: string;
  title: string;
  description: string;
  thumbnail: string;
  lessonsCount: number;
}

interface Lesson {
  _id: string;
  title: string;
  description: string;
  videoUrl: string;
  thumbnail: string;
  requiredLevel: number;
  completedBy: string[];
  likes: string[];
  commentsCount: number;
  createdAt: string;
}

export default function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session } = useSession();
  const { loading: memberLoading, isMember, isAdmin: admin } = useMembership();
  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLevel, setUserLevel] = useState(1);

  // Admin: new lesson
  const [showNewLesson, setShowNewLesson] = useState(false);
  const [newLesson, setNewLesson] = useState({ title: "", description: "", content: "", videoUrl: "", videoType: "link" as "link" | "upload", requiredLevel: 0 });
  const [creatingLesson, setCreatingLesson] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  // Admin: edit course
  const [editingCourse, setEditingCourse] = useState(false);
  const [editCourse, setEditCourse] = useState({ title: "", description: "" });
  const [savingCourse, setSavingCourse] = useState(false);

  useEffect(() => {
    if (!memberLoading && isMember) {
      fetchCourseData();
      if (session?.user) {
        const uid = (session.user as { id?: string }).id;
        if (uid) {
          fetch(`/api/users/${uid}`)
            .then((r) => r.json())
            .then((d) => { if (d.user?.level) setUserLevel(d.user.level); })
            .catch(() => {});
        }
      }
    } else if (!memberLoading) {
      setLoading(false);
    }
  }, [memberLoading, isMember, session, id]);

  const fetchCourseData = async () => {
    try {
      const res = await fetch(`/api/classroom/courses/${id}`);
      const data = await res.json();
      if (res.ok) {
        setCourse(data.course);
        setLessons(data.lessons || []);
        setEditCourse({ title: data.course.title, description: data.course.description || "" });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLesson = async () => {
    if (!newLesson.title.trim() || creatingLesson) return;
    setCreatingLesson(true);
    try {
      const res = await fetch("/api/classroom/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newLesson, course: id, order: lessons.length }),
      });
      if (res.ok) {
        setNewLesson({ title: "", description: "", content: "", videoUrl: "", videoType: "link", requiredLevel: 0 });
        setShowNewLesson(false);
        fetchCourseData();
      }
    } finally {
      setCreatingLesson(false);
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    if (!isVideo && !isImage) { alert("Зөвхөн видео эсвэл зураг файл оруулна уу"); return; }
    if (isVideo && file.size > 500 * 1024 * 1024) { alert("Видео файл 500MB-аас хэтэрсэн байна"); return; }

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
          else { const err = JSON.parse(xhr.responseText); reject(new Error(err.error || "Upload failed")); }
        });
        xhr.addEventListener("error", () => reject(new Error("Upload failed")));
        xhr.open("POST", endpoint);
        xhr.send(formData);
      });
      setNewLesson((p) => ({ ...p, videoUrl: result.url, videoType: isVideo ? "upload" : "link" }));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Файл оруулахад алдаа гарлаа");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const toggleComplete = async (lessonId: string) => {
    const res = await fetch(`/api/classroom/lessons/${lessonId}/complete`, { method: "POST" });
    if (res.ok) fetchCourseData();
  };

  const handleDeleteLesson = async (lessonId: string) => {
    if (!confirm("Энэ хичээлийг устгах уу?")) return;
    await fetch(`/api/classroom/lessons/${lessonId}`, { method: "DELETE" });
    fetchCourseData();
  };

  const handleSaveCourse = async () => {
    setSavingCourse(true);
    try {
      const res = await fetch(`/api/classroom/courses/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editCourse),
      });
      if (res.ok) {
        fetchCourseData();
        setEditingCourse(false);
      }
    } finally {
      setSavingCourse(false);
    }
  };

  const userId = session?.user ? (session.user as { id?: string }).id ?? null : null;
  const completedCount = userId ? lessons.filter((l) => l.completedBy.includes(userId)).length : 0;
  const progressPercent = lessons.length > 0 ? Math.round((completedCount / lessons.length) * 100) : 0;

  if (memberLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-2 w-2 animate-pulse rounded-full bg-[#0a0a0a]" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="py-16 text-center">
        <p className="text-[15px] text-[rgba(0,0,0,0.4)]">Курс олдсонгүй</p>
        <Link href="/classroom" className="mt-4 inline-block text-[13px] font-bold text-[#0a0a0a] transition hover:underline">← Буцах</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      {/* Back nav */}
      <Link href="/classroom" className="mb-8 inline-flex items-center gap-2 text-[13px] font-semibold text-[rgba(0,0,0,0.4)] transition hover:text-[#0a0a0a]">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
        </svg>
        Classroom
      </Link>

      {/* Course header */}
      <div className="mb-8">
        {course.thumbnail && (
          <div className="mb-6 overflow-hidden rounded-[4px]">
            <img src={course.thumbnail} alt={course.title} className="w-full object-cover" style={{ maxHeight: "280px" }} />
          </div>
        )}

        {editingCourse ? (
          <div className="space-y-4">
            <input value={editCourse.title} onChange={(e) => setEditCourse((p) => ({ ...p, title: e.target.value }))} className="w-full rounded-[4px] border border-[rgba(0,0,0,0.1)] bg-white px-4 py-3 text-[18px] font-bold text-[#0a0a0a] outline-none transition focus:border-[#0a0a0a]" />
            <textarea value={editCourse.description} onChange={(e) => setEditCourse((p) => ({ ...p, description: e.target.value }))} rows={3} className="w-full rounded-[4px] border border-[rgba(0,0,0,0.1)] bg-white px-4 py-3 text-[15px] text-[#0a0a0a] placeholder-[rgba(0,0,0,0.3)] outline-none transition focus:border-[#0a0a0a] resize-none" placeholder="Тайлбар" />
            <div className="flex gap-3">
              <button onClick={handleSaveCourse} disabled={savingCourse} className="rounded-[4px] bg-[#0a0a0a] px-6 py-2.5 text-[12px] font-bold text-[#FFFF01] transition hover:scale-105 disabled:opacity-50">{savingCourse ? "..." : "Хадгалах"}</button>
              <button onClick={() => setEditingCourse(false)} className="rounded-[4px] border border-[rgba(0,0,0,0.1)] px-5 py-2.5 text-[12px] font-semibold text-[rgba(0,0,0,0.4)] transition hover:text-[#0a0a0a]">Цуцлах</button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-[28px] font-black text-[#0a0a0a] sm:text-[36px]">{course.title}</h1>
              {course.description && (
                <p className="mt-3 text-[15px] leading-relaxed text-[rgba(0,0,0,0.45)]">{course.description}</p>
              )}
              <div className="mt-4 flex items-center gap-4 text-[13px] text-[rgba(0,0,0,0.3)]">
                <span className="flex items-center gap-1.5">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {lessons.length} хичээл
                </span>
                {completedCount > 0 && (
                  <span className="flex items-center gap-1.5 text-[#00e676] font-bold">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {completedCount} дуусгасан
                  </span>
                )}
              </div>
            </div>
            {admin && (
              <button onClick={() => setEditingCourse(true)} className="shrink-0 rounded-[4px] border border-[rgba(0,0,0,0.1)] px-4 py-2 text-[12px] font-semibold text-[rgba(0,0,0,0.4)] transition hover:border-[#0a0a0a] hover:text-[#0a0a0a]">
                Засах
              </button>
            )}
          </div>
        )}
      </div>

      {/* Progress bar */}
      {lessons.length > 0 && (
        <div className="mb-8 rounded-[4px] bg-[#0a0a0a] p-5">
          <div className="mb-3 flex items-center justify-between text-[13px]">
            <span className="text-[rgba(255,255,255,0.4)]">Явц</span>
            <span className="font-black text-[#FFFF01]">{progressPercent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]">
            <div
              className="h-full rounded-full bg-[#FFFF01] transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="mt-2 text-[12px] text-[rgba(255,255,255,0.25)]">{completedCount}/{lessons.length} хичээл дуусгасан</p>
        </div>
      )}

      {/* Admin: add lesson */}
      {admin && (
        <div className="mb-8">
          {showNewLesson ? (
            <div className="rounded-[4px] border border-[rgba(0,0,0,0.1)] bg-[rgba(0,0,0,0.03)] p-6 space-y-4">
              <input value={newLesson.title} onChange={(e) => setNewLesson((p) => ({ ...p, title: e.target.value }))} placeholder="Хичээлийн нэр" className="w-full rounded-[4px] border border-[rgba(0,0,0,0.1)] bg-white px-4 py-3 text-[15px] text-[#0a0a0a] placeholder-[rgba(0,0,0,0.3)] outline-none transition focus:border-[#0a0a0a]" />
              <textarea value={newLesson.description} onChange={(e) => setNewLesson((p) => ({ ...p, description: e.target.value }))} placeholder="Богино тайлбар" rows={2} className="w-full rounded-[4px] border border-[rgba(0,0,0,0.1)] bg-white px-4 py-3 text-[15px] text-[#0a0a0a] placeholder-[rgba(0,0,0,0.3)] outline-none transition focus:border-[#0a0a0a] resize-none" />
              <textarea value={newLesson.content} onChange={(e) => setNewLesson((p) => ({ ...p, content: e.target.value }))} placeholder="Хичээлийн агуулга (текст)" rows={5} className="w-full rounded-[4px] border border-[rgba(0,0,0,0.1)] bg-white px-4 py-3 text-[15px] text-[#0a0a0a] placeholder-[rgba(0,0,0,0.3)] outline-none transition focus:border-[#0a0a0a] resize-none" />
              <div className="flex items-center gap-3">
                <input value={newLesson.videoUrl} onChange={(e) => setNewLesson((p) => ({ ...p, videoUrl: e.target.value, videoType: "link" }))} placeholder="YouTube/Vimeo URL" className="flex-1 rounded-[4px] border border-[rgba(0,0,0,0.1)] bg-white px-4 py-3 text-[14px] text-[#0a0a0a] placeholder-[rgba(0,0,0,0.3)] outline-none transition focus:border-[#0a0a0a]" />
                <label className={`shrink-0 cursor-pointer rounded-[4px] border border-[rgba(0,0,0,0.1)] bg-white px-4 py-3 text-[12px] font-medium text-[rgba(0,0,0,0.4)] transition hover:border-[#0a0a0a] hover:text-[#0a0a0a] ${uploading ? "pointer-events-none opacity-50" : ""}`}>
                  {uploading ? `${uploadProgress}%` : "Файл"}
                  <input type="file" accept="video/mp4,video/webm,video/quicktime,image/*" onChange={handleVideoUpload} className="hidden" disabled={uploading} />
                </label>
              </div>
              {uploading && (
                <div className="h-1.5 overflow-hidden rounded-full bg-[rgba(0,0,0,0.05)]">
                  <div className="h-full rounded-full bg-[#0a0a0a] transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                </div>
              )}
              {newLesson.videoUrl && !uploading && (
                <p className="text-[12px] font-bold text-[#00e676]">{newLesson.videoType === "upload" ? "Файл оруулсан" : "Линк оруулсан"}</p>
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] text-[rgba(0,0,0,0.4)]">Түвшин:</span>
                  <input
                    type="number" min={0} max={100}
                    value={newLesson.requiredLevel}
                    onChange={(e) => setNewLesson((p) => ({ ...p, requiredLevel: parseInt(e.target.value) || 0 }))}
                    className="w-16 rounded-[4px] border border-[rgba(0,0,0,0.1)] bg-white px-3 py-2 text-center text-[12px] text-[#0a0a0a] outline-none transition focus:border-[#0a0a0a]"
                  />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setShowNewLesson(false)} className="rounded-[4px] border border-[rgba(0,0,0,0.1)] px-5 py-2 text-[12px] font-semibold text-[rgba(0,0,0,0.4)] transition hover:text-[#0a0a0a]">Цуцлах</button>
                  <button onClick={handleCreateLesson} disabled={creatingLesson} className="rounded-[4px] bg-[#0a0a0a] px-6 py-2 text-[12px] font-bold text-[#FFFF01] transition hover:scale-105 disabled:opacity-50">
                    {creatingLesson ? "..." : "Нэмэх"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowNewLesson(true)} className="w-full rounded-[4px] border-2 border-dashed border-[rgba(0,0,0,0.12)] px-4 py-4 text-[13px] font-bold text-[rgba(0,0,0,0.35)] transition hover:border-[#0a0a0a] hover:text-[#0a0a0a]">
              + Хичээл нэмэх
            </button>
          )}
        </div>
      )}

      {/* Lessons list — text-blog style */}
      <div className="mb-4 flex items-center gap-2">
        <div className="h-[2px] w-6 bg-[#0a0a0a]" />
        <h2 className="text-[12px] font-bold uppercase tracking-[2px] text-[rgba(0,0,0,0.3)]">Хичээлүүд</h2>
      </div>

      {lessons.length === 0 ? (
        <div className="rounded-[4px] border border-[rgba(0,0,0,0.08)] py-16 text-center">
          <p className="text-[14px] text-[rgba(0,0,0,0.3)]">Хичээл байхгүй байна</p>
        </div>
      ) : (
        <div className="space-y-1">
          {lessons.map((lesson, index) => {
            const isCompleted = userId ? lesson.completedBy.includes(userId) : false;
            const isLocked = (lesson.requiredLevel || 0) > userLevel && !admin;
            return (
              <div
                key={lesson._id}
                className={`group flex items-center gap-4 rounded-[4px] py-4 px-4 transition ${
                  isLocked
                    ? "opacity-35"
                    : isCompleted
                      ? "bg-[rgba(0,230,118,0.04)]"
                      : "hover:bg-[rgba(0,0,0,0.03)]"
                }`}
              >
                {/* Check / number / lock */}
                {isLocked ? (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[4px] bg-[rgba(0,0,0,0.06)]">
                    <svg className="h-4 w-4 text-[rgba(0,0,0,0.2)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                ) : (
                  <button
                    onClick={() => toggleComplete(lesson._id)}
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[4px] transition ${
                      isCompleted
                        ? "bg-[#00e676] text-black"
                        : "bg-[#0a0a0a] text-[rgba(255,255,255,0.4)] hover:text-[#FFFF01]"
                    }`}
                  >
                    {isCompleted ? (
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span className="text-[13px] font-black">{index + 1}</span>
                    )}
                  </button>
                )}

                {/* Content */}
                <div className="min-w-0 flex-1">
                  {isLocked ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[15px] font-medium text-[rgba(0,0,0,0.3)]">{lesson.title}</span>
                      <span className="rounded-[4px] bg-[#0a0a0a] px-2 py-0.5 text-[10px] font-bold text-[#FFFF01]">LV.{lesson.requiredLevel}</span>
                    </div>
                  ) : (
                    <Link href={`/classroom/${lesson._id}`} className="block">
                      <span className={`text-[15px] font-semibold transition ${isCompleted ? "text-[rgba(0,0,0,0.3)] line-through" : "text-[#0a0a0a] group-hover:text-[#0a0a0a]"}`}>
                        {lesson.title}
                      </span>
                      {lesson.description && (
                        <p className="mt-0.5 text-[13px] text-[rgba(0,0,0,0.35)] line-clamp-1">{lesson.description}</p>
                      )}
                    </Link>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {lesson.videoUrl && !isLocked && (
                    <Link href={`/classroom/${lesson._id}`} className="flex h-8 w-8 items-center justify-center rounded-[4px] bg-[rgba(0,0,0,0.05)] text-[rgba(0,0,0,0.25)] transition group-hover:bg-[#0a0a0a] group-hover:text-[#FFFF01]">
                      <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </Link>
                  )}
                  {admin && (
                    <button
                      onClick={() => handleDeleteLesson(lesson._id)}
                      className="hidden h-8 w-8 items-center justify-center rounded-[4px] text-[rgba(0,0,0,0.2)] transition hover:text-red-500 group-hover:flex"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
