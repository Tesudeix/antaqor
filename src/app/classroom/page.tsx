"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useMembership } from "@/lib/useMembership";

interface Course {
  _id: string;
  title: string;
  description: string;
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

export default function ClassroomPage() {
  const { data: session } = useSession();
  const { loading: memberLoading, isMember, isAdmin: admin } = useMembership();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>("");
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [lessonsLoading, setLessonsLoading] = useState(false);

  const [showNewCourse, setShowNewCourse] = useState(false);
  const [newCourseTitle, setNewCourseTitle] = useState("");
  const [newCourseDesc, setNewCourseDesc] = useState("");
  const [creating, setCreating] = useState(false);

  const [showNewLesson, setShowNewLesson] = useState(false);
  const [newLesson, setNewLesson] = useState({ title: "", description: "", videoUrl: "", videoType: "link" as "link" | "upload", requiredLevel: 0 });
  const [creatingLesson, setCreatingLesson] = useState(false);
  const [userLevel, setUserLevel] = useState(1);

  useEffect(() => {
    if (!memberLoading && isMember) {
      fetchCourses();
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
  }, [memberLoading, isMember, session]);

  const fetchCourses = async () => {
    try {
      const res = await fetch("/api/classroom/courses");
      const data = await res.json();
      if (res.ok) {
        setCourses(data.courses);
        if (data.courses.length > 0 && !selectedCourse) {
          const first = data.courses[0]._id;
          setSelectedCourse(first);
          fetchLessons(first);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchLessons = async (courseId: string) => {
    setLessonsLoading(true);
    try {
      const res = await fetch(`/api/classroom/courses/${courseId}`);
      const data = await res.json();
      if (res.ok) setLessons(data.lessons || []);
    } finally {
      setLessonsLoading(false);
    }
  };

  const selectCourse = (id: string) => {
    setSelectedCourse(id);
    fetchLessons(id);
  };

  const handleCreateCourse = async () => {
    if (!newCourseTitle.trim() || creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/classroom/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newCourseTitle, description: newCourseDesc, order: courses.length }),
      });
      if (res.ok) {
        setNewCourseTitle("");
        setNewCourseDesc("");
        setShowNewCourse(false);
        fetchCourses();
      }
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteCourse = async (id: string) => {
    if (!confirm("Энэ хичээл болон бүх контентыг устгах уу?")) return;
    await fetch(`/api/classroom/courses/${id}`, { method: "DELETE" });
    if (selectedCourse === id) {
      setSelectedCourse("");
      setLessons([]);
    }
    fetchCourses();
  };

  const handleCreateLesson = async () => {
    if (!newLesson.title.trim() || !selectedCourse || creatingLesson) return;
    setCreatingLesson(true);
    try {
      const res = await fetch("/api/classroom/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newLesson, course: selectedCourse, order: lessons.length }),
      });
      if (res.ok) {
        setNewLesson({ title: "", description: "", videoUrl: "", videoType: "link", requiredLevel: 0 });
        setShowNewLesson(false);
        fetchLessons(selectedCourse);
        fetchCourses();
      }
    } finally {
      setCreatingLesson(false);
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    const data = await res.json();
    if (res.ok) {
      setNewLesson((p) => ({ ...p, videoUrl: data.url, videoType: "upload" }));
    }
  };

  const toggleComplete = async (lessonId: string) => {
    const res = await fetch(`/api/classroom/lessons/${lessonId}/complete`, { method: "POST" });
    if (res.ok) fetchLessons(selectedCourse);
  };

  const userId = session?.user ? (session.user as { id?: string }).id ?? null : null;
  const currentCourse = courses.find((c) => c._id === selectedCourse);

  const completedCount = userId
    ? lessons.filter((l) => l.completedBy.includes(userId)).length
    : 0;
  const progressPercent = lessons.length > 0 ? Math.round((completedCount / lessons.length) * 100) : 0;

  if (memberLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-2 w-2 animate-pulse rounded-full bg-[#006491]" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <h1 className="mb-3 text-2xl font-bold text-[#e8e6e1]">Хичээл</h1>
        <p className="mb-6 text-[14px] text-[#6b6b78]">Хичээлд хандахын тулд нэвтэрнэ үү.</p>
        <Link href="/auth/signin" className="btn-primary">Нэвтрэх</Link>
      </div>
    );
  }

  if (!isMember) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <h1 className="mb-3 text-2xl font-bold text-[#e8e6e1]">Хичээл</h1>
        <p className="mb-6 max-w-sm text-[14px] leading-relaxed text-[#6b6b78]">
          Хичээл нь зөвхөн Кланы гишүүдэд зориулагдсан.
        </p>
        <Link href="/clan" className="btn-primary">Кланд нэгдэх</Link>
      </div>
    );
  }

  return (
    <div>
      {/* Header with course selector */}
      <div className="mb-6">
        <h1 className="mb-4 text-lg font-bold text-[#e8e6e1]">Хичээл</h1>

        {/* Course tabs */}
        {courses.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {courses.map((course) => (
              <button
                key={course._id}
                onClick={() => selectCourse(course._id)}
                className={`group flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-[13px] font-medium transition ${
                  selectedCourse === course._id
                    ? "bg-[#006491] text-white"
                    : "bg-[#0c0c10] text-[#6b6b78] hover:text-[#e8e6e1]"
                }`}
              >
                {course.title}
                <span className={`text-[11px] ${selectedCourse === course._id ? "text-white/60" : "text-[#3a3a48]"}`}>
                  {course.lessonsCount}
                </span>
                {admin && selectedCourse !== course._id && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteCourse(course._id); }}
                    className="ml-1 hidden text-[#6b6b78] hover:text-red-400 group-hover:inline"
                  >
                    ×
                  </button>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Admin: add course */}
        {admin && (
          <div className="mt-3">
            {showNewCourse ? (
              <div className="card space-y-3 p-4">
                <input value={newCourseTitle} onChange={(e) => setNewCourseTitle(e.target.value)} placeholder="Курсийн нэр" className="input-dark" />
                <input value={newCourseDesc} onChange={(e) => setNewCourseDesc(e.target.value)} placeholder="Тайлбар" className="input-dark" />
                <div className="flex gap-2">
                  <button onClick={handleCreateCourse} disabled={creating} className="btn-primary !text-[12px]">
                    {creating ? "..." : "Үүсгэх"}
                  </button>
                  <button onClick={() => setShowNewCourse(false)} className="btn-ghost !text-[12px]">Цуцлах</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowNewCourse(true)} className="text-[12px] font-medium text-[#006491] transition hover:text-[#0080b8]">
                + Курс нэмэх
              </button>
            )}
          </div>
        )}
      </div>

      {/* Progress */}
      {currentCourse && lessons.length > 0 && (
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between text-[12px]">
            <span className="text-[#6b6b78]">{currentCourse.title}</span>
            <span className="font-medium text-[#e8e6e1]">{completedCount}/{lessons.length}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[#1a1a22]">
            <div className="h-full rounded-full bg-[#006491] transition-all duration-500" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      )}

      {/* Admin: add lesson */}
      {admin && currentCourse && (
        <div className="mb-4">
          {showNewLesson ? (
            <div className="card space-y-3 p-5">
              <input value={newLesson.title} onChange={(e) => setNewLesson((p) => ({ ...p, title: e.target.value }))} placeholder="Хичээлийн нэр" className="input-dark" />
              <textarea value={newLesson.description} onChange={(e) => setNewLesson((p) => ({ ...p, description: e.target.value }))} placeholder="Тайлбар" rows={3} className="input-dark resize-none" />
              <div className="flex flex-wrap items-center gap-3">
                <input value={newLesson.videoUrl} onChange={(e) => setNewLesson((p) => ({ ...p, videoUrl: e.target.value, videoType: "link" }))} placeholder="Видео URL" className="input-dark flex-1" />
                <label className="btn-ghost cursor-pointer !py-2 !px-4 !text-[12px]">
                  Файл
                  <input type="file" accept="video/*,image/*" onChange={handleVideoUpload} className="hidden" />
                </label>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[12px] text-[#6b6b78]">Түвшин:</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={newLesson.requiredLevel}
                  onChange={(e) => setNewLesson((p) => ({ ...p, requiredLevel: parseInt(e.target.value) || 0 }))}
                  className="input-dark !w-20"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={handleCreateLesson} disabled={creatingLesson} className="btn-primary !text-[12px]">
                  {creatingLesson ? "..." : "Нэмэх"}
                </button>
                <button onClick={() => setShowNewLesson(false)} className="btn-ghost !text-[12px]">Цуцлах</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowNewLesson(true)} className="text-[12px] font-medium text-[#006491] transition hover:text-[#0080b8]">
              + Хичээл нэмэх
            </button>
          )}
        </div>
      )}

      {/* Lessons */}
      {currentCourse ? (
        lessonsLoading ? (
          <div className="flex justify-center py-16">
            <div className="h-2 w-2 animate-pulse rounded-full bg-[#006491]" />
          </div>
        ) : lessons.length === 0 ? (
          <p className="py-16 text-center text-[14px] text-[#6b6b78]">Хичээл байхгүй байна.</p>
        ) : (
          <div className="space-y-2">
            {lessons.map((lesson, index) => {
              const isCompleted = userId ? lesson.completedBy.includes(userId) : false;
              const isLocked = (lesson.requiredLevel || 0) > userLevel && !admin;
              return (
                <div key={lesson._id} className={`card overflow-hidden transition ${isLocked ? "opacity-50" : ""}`}>
                  <div className="flex items-center gap-4 p-4">
                    {/* Number / check / lock */}
                    {isLocked ? (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1a1a22] text-[#3a3a48]">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                    ) : (
                      <button
                        onClick={() => toggleComplete(lesson._id)}
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition ${
                          isCompleted
                            ? "bg-[#006491] text-white"
                            : "bg-[#1a1a22] text-[#3a3a48] hover:text-[#6b6b78]"
                        }`}
                      >
                        {isCompleted ? (
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <span className="text-[12px] font-medium">{index + 1}</span>
                        )}
                      </button>
                    )}

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      {isLocked ? (
                        <div>
                          <h3 className="text-[14px] font-medium text-[#3a3a48]">{lesson.title}</h3>
                          <p className="text-[11px] text-[#006491]">LV.{lesson.requiredLevel} шаардлагатай</p>
                        </div>
                      ) : (
                        <Link href={`/classroom/${lesson._id}`} className="block">
                          <h3 className={`text-[14px] font-medium transition ${isCompleted ? "text-[#6b6b78] line-through" : "text-[#e8e6e1]"}`}>
                            {lesson.title}
                          </h3>
                          {lesson.description && (
                            <p className="mt-0.5 text-[12px] text-[#6b6b78] line-clamp-1">{lesson.description}</p>
                          )}
                        </Link>
                      )}
                    </div>

                    {/* Video indicator */}
                    {lesson.videoUrl && !isLocked && (
                      <Link href={`/classroom/${lesson._id}`} className="shrink-0 text-[#3a3a48]">
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : loading ? (
        <div className="flex justify-center py-16">
          <div className="h-2 w-2 animate-pulse rounded-full bg-[#006491]" />
        </div>
      ) : (
        <div className="py-20 text-center">
          <p className="text-[15px] text-[#6b6b78]">
            {courses.length === 0 ? "Хичээл байхгүй" : "Курс сонгоно уу"}
          </p>
        </div>
      )}
    </div>
  );
}
