"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useMembership } from "@/lib/useMembership";
import { motion } from "framer-motion";

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

  // Find current lesson (first uncompleted)
  const currentLessonIndex = userId
    ? lessons.findIndex((l) => !l.completedBy.includes(userId) && ((l.requiredLevel || 0) <= userLevel || admin))
    : 0;

  if (memberLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-2 w-2 animate-pulse-gold rounded-full bg-[#FFFF01]" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="py-16 text-center">
        <p className="text-[15px] text-[#6B6B6B]">Курс олдсонгүй</p>
        <Link href="/classroom" className="mt-4 inline-block text-[13px] font-bold text-[#FFFF01] transition-colors duration-200 hover:underline">← Буцах</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[900px]">
      {/* Back nav */}
      <Link href="/classroom" className="mb-8 inline-flex items-center gap-2 text-[13px] font-medium text-[#6B6B6B] transition-colors duration-200 hover:text-[#FAFAFA]">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
        </svg>
        Хичээлийн танхим
      </Link>

      {/* ─── Hero Section ─── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="mb-8"
      >
        {editingCourse ? (
          <div className="rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#141414] p-6 space-y-4">
            <input value={editCourse.title} onChange={(e) => setEditCourse((p) => ({ ...p, title: e.target.value }))} className="w-full rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0A0A0A] px-4 py-3 text-[18px] font-bold text-[#FAFAFA] outline-none transition-colors duration-200 focus:border-[rgba(255,255,1,0.4)]" />
            <textarea value={editCourse.description} onChange={(e) => setEditCourse((p) => ({ ...p, description: e.target.value }))} rows={3} className="w-full rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0A0A0A] px-4 py-3 text-[15px] text-[#FAFAFA] placeholder-[#6B6B6B] outline-none transition-colors duration-200 focus:border-[rgba(255,255,1,0.4)] resize-none" placeholder="Тайлбар" />
            <div className="flex gap-3">
              <button onClick={handleSaveCourse} disabled={savingCourse} className="rounded-[4px] bg-[#FFFF01] px-6 py-2.5 text-[12px] font-bold text-[#0A0A0A] transition-all duration-200 hover:shadow-[0_0_24px_rgba(255,255,1,0.25)] disabled:opacity-50">{savingCourse ? "..." : "Хадгалах"}</button>
              <button onClick={() => setEditingCourse(false)} className="rounded-[4px] border border-[rgba(255,255,255,0.06)] px-5 py-2.5 text-[12px] font-medium text-[#6B6B6B] transition-colors duration-200 hover:text-[#FAFAFA]">Цуцлах</button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="meta-label text-[#6B6B6B]">Курс</span>
              <h1 className="mt-1 text-[28px] font-bold tracking-[-0.02em] text-[#FAFAFA] sm:text-[36px]">{course.title}</h1>
              {course.description && (
                <p className="mt-3 text-[15px] leading-relaxed text-[#A3A3A3]">{course.description}</p>
              )}
              <div className="mt-4 flex items-center gap-4 text-[13px] text-[#6B6B6B]">
                <span>{lessons.length} хичээл</span>
                {completedCount > 0 && (
                  <span className="flex items-center gap-1.5 font-bold text-[#FFFF01]">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {completedCount} дуусгасан
                  </span>
                )}
              </div>
            </div>
            {admin && (
              <button onClick={() => setEditingCourse(true)} className="shrink-0 rounded-[4px] border border-[rgba(255,255,255,0.06)] px-4 py-2 text-[12px] font-medium text-[#6B6B6B] transition-colors duration-200 hover:border-[rgba(255,255,1,0.4)] hover:text-[#FAFAFA]">
                Засах
              </button>
            )}
          </div>
        )}
      </motion.div>

      {/* ─── Progress Journey Bar ─── */}
      {lessons.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: "easeOut", delay: 0.05 }}
          className="mb-8 rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#141414] p-6"
        >
          <div className="mb-4 flex items-center justify-between">
            <span className="text-[13px] font-medium text-[#6B6B6B]">Аялал</span>
            <span className="text-[13px] font-bold text-[#FFFF01]">{completedCount}/{lessons.length}</span>
          </div>
          {/* Journey dots */}
          <div className="flex items-center gap-1">
            {lessons.map((lesson, i) => {
              const isCompleted = userId ? lesson.completedBy.includes(userId) : false;
              const isCurrent = i === currentLessonIndex;
              return (
                <div
                  key={lesson._id}
                  className="flex-1 h-2 rounded-full transition-all duration-200"
                  style={{
                    background: isCompleted
                      ? "#FFFF01"
                      : isCurrent
                        ? "rgba(255,255,1,0.3)"
                        : "rgba(255,255,255,0.06)",
                  }}
                />
              );
            })}
          </div>
          <p className="mt-3 text-[12px] text-[#6B6B6B]">
            {progressPercent === 100
              ? "Баяр хүргэе! Бүх хичээлийг дуусгасан"
              : progressPercent > 0
                ? `${progressPercent}% дууссан — үргэлжлүүлээрэй`
                : "Аянаа эхлүүлээрэй"}
          </p>
        </motion.div>
      )}

      {/* ─── Admin: add lesson ─── */}
      {admin && (
        <div className="mb-8">
          {showNewLesson ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <div className="rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#141414] p-6 space-y-4">
                <input value={newLesson.title} onChange={(e) => setNewLesson((p) => ({ ...p, title: e.target.value }))} placeholder="Хичээлийн нэр" className="w-full rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0A0A0A] px-4 py-3 text-[15px] text-[#FAFAFA] placeholder-[#6B6B6B] outline-none transition-colors duration-200 focus:border-[rgba(255,255,1,0.4)]" />
                <textarea value={newLesson.description} onChange={(e) => setNewLesson((p) => ({ ...p, description: e.target.value }))} placeholder="Богино тайлбар" rows={2} className="w-full rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0A0A0A] px-4 py-3 text-[15px] text-[#FAFAFA] placeholder-[#6B6B6B] outline-none transition-colors duration-200 focus:border-[rgba(255,255,1,0.4)] resize-none" />
                <textarea value={newLesson.content} onChange={(e) => setNewLesson((p) => ({ ...p, content: e.target.value }))} placeholder="Хичээлийн агуулга (текст)" rows={5} className="w-full rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0A0A0A] px-4 py-3 text-[15px] text-[#FAFAFA] placeholder-[#6B6B6B] outline-none transition-colors duration-200 focus:border-[rgba(255,255,1,0.4)] resize-none" />
                <div className="flex items-center gap-3">
                  <input value={newLesson.videoUrl} onChange={(e) => setNewLesson((p) => ({ ...p, videoUrl: e.target.value, videoType: "link" }))} placeholder="YouTube/Vimeo URL" className="flex-1 rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0A0A0A] px-4 py-3 text-[14px] text-[#FAFAFA] placeholder-[#6B6B6B] outline-none transition-colors duration-200 focus:border-[rgba(255,255,1,0.4)]" />
                  <label className={`shrink-0 cursor-pointer rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0A0A0A] px-4 py-3 text-[12px] font-medium text-[#6B6B6B] transition-colors duration-200 hover:border-[rgba(255,255,1,0.4)] hover:text-[#FAFAFA] ${uploading ? "pointer-events-none opacity-50" : ""}`}>
                    {uploading ? `${uploadProgress}%` : "Файл"}
                    <input type="file" accept="video/mp4,video/webm,video/quicktime,image/*" onChange={handleVideoUpload} className="hidden" disabled={uploading} />
                  </label>
                </div>
                {uploading && (
                  <div className="h-1.5 overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
                    <div className="h-full rounded-full bg-[#FFFF01] transition-all duration-200" style={{ width: `${uploadProgress}%` }} />
                  </div>
                )}
                {newLesson.videoUrl && !uploading && (
                  <p className="text-[12px] font-bold text-[#FFFF01]">{newLesson.videoType === "upload" ? "Файл оруулсан" : "Линк оруулсан"}</p>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-[#6B6B6B]">Түвшин:</span>
                    <input
                      type="number" min={0} max={100}
                      value={newLesson.requiredLevel}
                      onChange={(e) => setNewLesson((p) => ({ ...p, requiredLevel: parseInt(e.target.value) || 0 }))}
                      className="w-16 rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0A0A0A] px-3 py-2 text-center text-[12px] text-[#FAFAFA] outline-none transition-colors duration-200 focus:border-[rgba(255,255,1,0.4)]"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setShowNewLesson(false)} className="rounded-[4px] border border-[rgba(255,255,255,0.06)] px-5 py-2 text-[12px] font-medium text-[#6B6B6B] transition-colors duration-200 hover:text-[#FAFAFA]">Цуцлах</button>
                    <button onClick={handleCreateLesson} disabled={creatingLesson} className="rounded-[4px] bg-[#FFFF01] px-6 py-2 text-[12px] font-bold text-[#0A0A0A] transition-all duration-200 hover:shadow-[0_0_24px_rgba(255,255,1,0.25)] disabled:opacity-50">
                      {creatingLesson ? "..." : "Нэмэх"}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <button onClick={() => setShowNewLesson(true)} className="w-full rounded-[4px] border-2 border-dashed border-[rgba(255,255,1,0.2)] px-4 py-4 text-[13px] font-bold text-[#6B6B6B] transition-all duration-200 hover:border-[#FFFF01] hover:text-[#FFFF01]">
              + Хичээл нэмэх
            </button>
          )}
        </div>
      )}

      {/* ─── Lesson List ─── */}
      <div className="mb-4 flex items-center gap-2">
        <div className="h-[2px] w-6 bg-[#FFFF01]" />
        <h2 className="meta-label">Хичээлүүд</h2>
      </div>

      {lessons.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[4px] border-2 border-dashed border-[rgba(255,255,1,0.2)] py-16 text-center">
          <p className="text-[14px] text-[#6B6B6B]">Хичээл байхгүй байна</p>
          {admin && (
            <button onClick={() => setShowNewLesson(true)} className="mt-4 rounded-[4px] bg-[#FFFF01] px-5 py-2 text-[13px] font-bold text-[#0A0A0A]">
              Эхний хичээлээ нэм
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {lessons.map((lesson, index) => {
            const isCompleted = userId ? lesson.completedBy.includes(userId) : false;
            const isLocked = (lesson.requiredLevel || 0) > userLevel && !admin;
            const isCurrent = index === currentLessonIndex;

            return (
              <motion.div
                key={lesson._id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: "easeOut", delay: index * 0.03 }}
                className={`group flex items-center gap-4 rounded-[4px] border px-5 py-4 transition-all duration-200 ${
                  isLocked
                    ? "border-[rgba(255,255,255,0.03)] bg-[rgba(20,20,20,0.5)] opacity-40"
                    : isCurrent
                      ? "border-[rgba(255,255,1,0.3)] bg-[#141414] shadow-[0_0_24px_rgba(255,255,1,0.05)]"
                      : isCompleted
                        ? "border-[rgba(255,255,255,0.06)] bg-[#141414]"
                        : "border-[rgba(255,255,255,0.06)] bg-[#141414] hover:-translate-y-[2px] hover:border-[rgba(255,255,1,0.3)] hover:shadow-[0_0_24px_rgba(255,255,1,0.08)]"
                }`}
              >
                {/* Status indicator */}
                {isLocked ? (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[4px] bg-[rgba(255,255,255,0.03)]">
                    <svg className="h-4 w-4 text-[#6B6B6B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                ) : (
                  <button
                    onClick={() => toggleComplete(lesson._id)}
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[4px] transition-all duration-200 ${
                      isCompleted
                        ? "bg-[#FFFF01] text-[#0A0A0A]"
                        : isCurrent
                          ? "border-2 border-[#FFFF01] bg-transparent text-[#FFFF01]"
                          : "bg-[rgba(255,255,255,0.04)] text-[#6B6B6B] hover:bg-[rgba(255,255,1,0.1)] hover:text-[#FFFF01]"
                    }`}
                  >
                    {isCompleted ? (
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span className="text-[13px] font-bold">{index + 1}</span>
                    )}
                  </button>
                )}

                {/* Content */}
                <div className="min-w-0 flex-1">
                  {isLocked ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[15px] font-medium text-[#6B6B6B]">{lesson.title}</span>
                      <span className="rounded-[4px] bg-[rgba(255,255,1,0.1)] px-2 py-0.5 text-[10px] font-bold text-[#FFFF01]">LV.{lesson.requiredLevel}</span>
                    </div>
                  ) : (
                    <Link href={`/classroom/${lesson._id}`} className="block">
                      <span className={`text-[15px] font-medium transition-colors duration-200 ${
                        isCompleted
                          ? "text-[#6B6B6B] line-through"
                          : isCurrent
                            ? "text-[#FAFAFA]"
                            : "text-[#A3A3A3] group-hover:text-[#FAFAFA]"
                      }`}>
                        {lesson.title}
                      </span>
                      {lesson.description && (
                        <p className="mt-0.5 text-[13px] text-[#6B6B6B] line-clamp-1">{lesson.description}</p>
                      )}
                    </Link>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {lesson.videoUrl && !isLocked && (
                    <Link href={`/classroom/${lesson._id}`} className="flex h-8 w-8 items-center justify-center rounded-[4px] bg-[rgba(255,255,255,0.04)] text-[#6B6B6B] transition-all duration-200 group-hover:bg-[rgba(255,255,1,0.1)] group-hover:text-[#FFFF01]" aria-label="Видео тоглуулах">
                      <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </Link>
                  )}
                  {admin && (
                    <button
                      onClick={() => handleDeleteLesson(lesson._id)}
                      className="hidden h-8 w-8 items-center justify-center rounded-[4px] text-[#6B6B6B] transition-colors duration-200 hover:text-red-400 group-hover:flex"
                      aria-label="Хичээл устгах"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
