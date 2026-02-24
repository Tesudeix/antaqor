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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [showNewCourse, setShowNewCourse] = useState(false);
  const [newCourseTitle, setNewCourseTitle] = useState("");
  const [newCourseDesc, setNewCourseDesc] = useState("");
  const [creating, setCreating] = useState(false);

  const [showNewLesson, setShowNewLesson] = useState(false);
  const [newLesson, setNewLesson] = useState({ title: "", description: "", videoUrl: "", videoType: "link" as "link" | "upload" });
  const [creatingLesson, setCreatingLesson] = useState(false);

  useEffect(() => {
    if (!memberLoading && isMember) {
      fetchCourses();
    } else if (!memberLoading) {
      setLoading(false);
    }
  }, [memberLoading, isMember]);

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
    setSidebarOpen(false);
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
        setNewLesson({ title: "", description: "", videoUrl: "", videoType: "link" });
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
        <div className="h-3 w-3 animate-pulse rounded-full bg-[#cc2200]" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <h1 className="mb-4 font-[Bebas_Neue] text-4xl tracking-[4px] text-[#ede8df]">Хичээлийн танхим</h1>
        <p className="mb-8 text-[13px] text-[rgba(240,236,227,0.5)]">Хичээлийн танхимд хандахын тулд нэвтэрнэ үү.</p>
        <Link href="/auth/signin" className="btn-blood">Нэвтрэх</Link>
      </div>
    );
  }

  if (!isMember) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <h1 className="mb-4 font-[Bebas_Neue] text-4xl tracking-[4px] text-[#ede8df]">Хичээлийн танхим</h1>
        <p className="mb-8 max-w-md text-[13px] leading-[2] text-[rgba(240,236,227,0.5)]">
          Хичээлийн танхим нь зөвхөн Кланы гишүүдэд зориулагдсан. Бүх хичээлд хандахын тулд Кланд нэгдээрэй.
        </p>
        <Link href="/clan" className="btn-blood">Кланд нэгдэх</Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] gap-0 md:gap-6">
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center bg-[#cc2200] text-[#ede8df] shadow-lg md:hidden"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h8m-8 6h16" />
        </svg>
      </button>

      <aside className={`
        fixed inset-y-0 left-0 z-30 w-72 overflow-y-auto border-r border-[#1c1c1c] bg-[#0a0a0a] p-5 pt-20 transition-transform md:relative md:inset-auto md:z-auto md:w-64 md:shrink-0 md:translate-x-0 md:border-r-0 md:bg-transparent md:p-0 md:pt-0
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        {lessons.length > 0 && (
          <div className="mb-6">
            <div className="mb-2 text-[10px] uppercase tracking-[3px] text-[#5a5550]">Явц</div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#cc2200]">{progressPercent}%</span>
              <span className="text-[10px] text-[#5a5550]">{completedCount}/{lessons.length}</span>
            </div>
            <div className="h-1.5 overflow-hidden bg-[#1c1c1c]">
              <div className="h-full bg-[#cc2200] transition-all" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
        )}

        <div className="space-y-1">
          {courses.map((course) => (
            <div key={course._id} className="group">
              <button
                onClick={() => selectCourse(course._id)}
                className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-[12px] transition ${
                  selectedCourse === course._id
                    ? "bg-[rgba(204,34,0,0.1)] text-[#ede8df]"
                    : "text-[#c8c8c0] hover:bg-[rgba(240,236,227,0.03)] hover:text-[#ede8df]"
                }`}
              >
                <span className="font-bold">{course.title}</span>
                <span className="text-[10px] text-[#5a5550]">{course.lessonsCount}</span>
              </button>
              {admin && (
                <button
                  onClick={() => handleDeleteCourse(course._id)}
                  className="ml-3 hidden text-[9px] text-[#5a5550] hover:text-[#cc2200] group-hover:inline"
                >
                  УСТГАХ
                </button>
              )}
            </div>
          ))}
        </div>

        {admin && (
          <div className="mt-6">
            {showNewCourse ? (
              <div className="space-y-2">
                <input value={newCourseTitle} onChange={(e) => setNewCourseTitle(e.target.value)} placeholder="Хичээлийн нэр" className="input-dark !py-2 !text-[11px]" />
                <input value={newCourseDesc} onChange={(e) => setNewCourseDesc(e.target.value)} placeholder="Тайлбар (заавал биш)" className="input-dark !py-2 !text-[11px]" />
                <div className="flex gap-2">
                  <button onClick={handleCreateCourse} disabled={creating} className="btn-blood !py-1.5 !px-4 !text-[9px]">
                    {creating ? "..." : "Үүсгэх"}
                  </button>
                  <button onClick={() => setShowNewCourse(false)} className="btn-ghost !py-1.5 !px-4 !text-[9px]">Цуцлах</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowNewCourse(true)} className="w-full border border-dashed border-[#2a2825] px-3 py-2 text-[10px] uppercase tracking-[2px] text-[#5a5550] transition hover:border-[#cc2200] hover:text-[#cc2200]">
                + Хичээл нэмэх
              </button>
            )}
          </div>
        )}

        {sidebarOpen && (
          <button onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-[-1] bg-black/50 md:hidden" />
        )}
      </aside>

      <main className="min-w-0 flex-1">
        {currentCourse ? (
          <>
            <div className="mb-8">
              <h1 className="font-[Bebas_Neue] text-3xl tracking-[3px] text-[#ede8df]">
                {currentCourse.title}
              </h1>
              {currentCourse.description && (
                <p className="mt-2 text-[12px] leading-[1.8] text-[rgba(240,236,227,0.5)]">
                  {currentCourse.description}
                </p>
              )}
            </div>

            {admin && (
              <div className="mb-6">
                {showNewLesson ? (
                  <div className="card space-y-3 p-5">
                    <input value={newLesson.title} onChange={(e) => setNewLesson((p) => ({ ...p, title: e.target.value }))} placeholder="Хичээлийн нэр" className="input-dark" />
                    <textarea value={newLesson.description} onChange={(e) => setNewLesson((p) => ({ ...p, description: e.target.value }))} placeholder="Тайлбар" rows={3} className="input-dark resize-none" />
                    <div className="flex flex-wrap items-center gap-3">
                      <input value={newLesson.videoUrl} onChange={(e) => setNewLesson((p) => ({ ...p, videoUrl: e.target.value, videoType: "link" }))} placeholder="Видео URL (YouTube гэх мэт)" className="input-dark flex-1" />
                      <span className="text-[10px] text-[#5a5550]">эсвэл</span>
                      <label className="btn-ghost cursor-pointer !py-2 !px-4 !text-[9px]">
                        Видео оруулах
                        <input type="file" accept="video/*,image/*" onChange={handleVideoUpload} className="hidden" />
                      </label>
                    </div>
                    {newLesson.videoUrl && (
                      <p className="text-[10px] text-[#cc2200] break-all">Видео: {newLesson.videoUrl}</p>
                    )}
                    <div className="flex gap-2">
                      <button onClick={handleCreateLesson} disabled={creatingLesson} className="btn-blood !py-2 !px-5 !text-[10px]">
                        {creatingLesson ? "Үүсгэж байна..." : "Хичээл нэмэх"}
                      </button>
                      <button onClick={() => setShowNewLesson(false)} className="btn-ghost !py-2 !px-5 !text-[10px]">Цуцлах</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowNewLesson(true)} className="w-full border border-dashed border-[#2a2825] px-4 py-3 text-[10px] uppercase tracking-[2px] text-[#5a5550] transition hover:border-[#cc2200] hover:text-[#cc2200]">
                    + Хичээл нэмэх
                  </button>
                )}
              </div>
            )}

            {lessonsLoading ? (
              <div className="flex justify-center py-12">
                <div className="h-3 w-3 animate-pulse rounded-full bg-[#cc2200]" />
              </div>
            ) : lessons.length === 0 ? (
              <p className="py-12 text-center text-[12px] text-[#5a5550]">Хичээл байхгүй байна.</p>
            ) : (
              <div className="space-y-3">
                {lessons.map((lesson) => {
                  const isCompleted = userId ? lesson.completedBy.includes(userId) : false;
                  return (
                    <div key={lesson._id} className="card group relative overflow-hidden p-5">
                      <div className="flex gap-4">
                        <button
                          onClick={() => toggleComplete(lesson._id)}
                          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border transition ${
                            isCompleted
                              ? "border-[#cc2200] bg-[#cc2200] text-[#ede8df]"
                              : "border-[#2a2825] text-transparent hover:border-[#5a5550]"
                          }`}
                        >
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>

                        <div className="min-w-0 flex-1">
                          <Link href={`/classroom/${lesson._id}`} className="block">
                            <h3 className={`text-[14px] font-bold transition ${isCompleted ? "text-[#5a5550] line-through" : "text-[#ede8df] group-hover:text-[#cc2200]"}`}>
                              {lesson.title}
                            </h3>
                            {lesson.description && (
                              <p className="mt-1 text-[12px] leading-[1.7] text-[rgba(240,236,227,0.4)] line-clamp-2">
                                {lesson.description}
                              </p>
                            )}
                          </Link>
                        </div>

                        {(lesson.videoUrl || lesson.thumbnail) && (
                          <Link href={`/classroom/${lesson._id}`} className="relative hidden h-16 w-24 shrink-0 overflow-hidden bg-[#1c1c1c] sm:block">
                            {lesson.thumbnail ? (
                              <img src={lesson.thumbnail} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center">
                                <svg className="h-6 w-6 text-[#5a5550]" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M8 5v14l11-7z" />
                                </svg>
                              </div>
                            )}
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : loading ? (
          <div className="flex justify-center py-16">
            <div className="h-3 w-3 animate-pulse rounded-full bg-[#cc2200]" />
          </div>
        ) : (
          <div className="py-16 text-center">
            <p className="font-[Bebas_Neue] text-2xl tracking-[2px] text-[rgba(240,236,227,0.3)]">
              {courses.length === 0 ? "Хичээл байхгүй" : "Хичээл сонгоно уу"}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
