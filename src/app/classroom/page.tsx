"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useMembership } from "@/lib/useMembership";

interface Course {
  _id: string;
  title: string;
  description: string;
  thumbnail: string;
  lessonsCount: number;
  createdAt: string;
}

export default function ClassroomPage() {
  const { data: session } = useSession();
  const { loading: memberLoading, isMember, isAdmin: admin } = useMembership();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  // Admin: new course
  const [showNewCourse, setShowNewCourse] = useState(false);
  const [newCourseTitle, setNewCourseTitle] = useState("");
  const [newCourseDesc, setNewCourseDesc] = useState("");
  const [newCourseThumbnail, setNewCourseThumbnail] = useState("");
  const [creating, setCreating] = useState(false);
  const [thumbUploading, setThumbUploading] = useState(false);

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
      if (res.ok) setCourses(data.courses);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCourse = async () => {
    if (!newCourseTitle.trim() || creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/classroom/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newCourseTitle, description: newCourseDesc, thumbnail: newCourseThumbnail, order: courses.length }),
      });
      if (res.ok) {
        setNewCourseTitle("");
        setNewCourseDesc("");
        setNewCourseThumbnail("");
        setShowNewCourse(false);
        fetchCourses();
      }
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteCourse = async (id: string) => {
    if (!confirm("Энэ курс болон бүх хичээлийг устгах уу?")) return;
    await fetch(`/api/classroom/courses/${id}`, { method: "DELETE" });
    fetchCourses();
  };

  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setThumbUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) setNewCourseThumbnail(data.url);
    } catch {
      alert("Зураг оруулахад алдаа гарлаа");
    } finally {
      setThumbUploading(false);
    }
  };

  if (memberLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-2 w-2 animate-pulse rounded-full bg-[#FFD300]" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-4">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#1a1a1e] border border-[rgba(255,211,0,0.1)]">
          <svg className="h-6 w-6 text-[#FFD300]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
        <h1 className="mb-1.5 text-xl font-bold text-[#eeeee8]">Classroom</h1>
        <p className="mb-5 text-[13px] text-[#6a6a72]">Хичээлд хандахын тулд нэвтэрнэ үү</p>
        <Link href="/auth/signin" className="rounded-[10px] bg-[#FFD300] px-6 py-2.5 text-[13px] font-semibold text-black transition hover:bg-[#e6be00]">
          Нэвтрэх
        </Link>
      </div>
    );
  }

  if (!isMember) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-4">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#1a1a1e] border border-[rgba(255,211,0,0.1)]">
          <svg className="h-6 w-6 text-[#FFD300]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h1 className="mb-1.5 text-xl font-bold text-[#eeeee8]">Classroom</h1>
        <p className="mb-5 max-w-xs text-[13px] leading-relaxed text-[#6a6a72]">
          Зөвхөн Кланы гишүүдэд зориулагдсан
        </p>
        <Link href="/clan" className="rounded-[10px] bg-[#FFD300] px-6 py-2.5 text-[13px] font-semibold text-black transition hover:bg-[#e6be00]">
          Кланд нэгдэх
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#eeeee8]">Classroom</h1>
          <p className="mt-1 text-[13px] text-[#6a6a72]">
            {courses.length} курс
          </p>
        </div>
        {admin && (
          <button
            onClick={() => setShowNewCourse(!showNewCourse)}
            className="rounded-[10px] bg-[rgba(255,211,0,0.08)] px-4 py-2 text-[12px] font-semibold text-[#FFD300] transition hover:bg-[rgba(255,211,0,0.15)]"
          >
            {showNewCourse ? "Цуцлах" : "+ Курс"}
          </button>
        )}
      </div>

      {/* Admin: new course form */}
      {admin && showNewCourse && (
        <div className="mb-6 rounded-[14px] border border-[rgba(255,211,0,0.12)] bg-[#1a1a1e] p-5 space-y-3">
          <input value={newCourseTitle} onChange={(e) => setNewCourseTitle(e.target.value)} placeholder="Курсийн нэр" className="w-full rounded-[10px] border border-[#2a2a2e] bg-[#141416] px-4 py-2.5 text-[14px] text-[#eeeee8] placeholder-[#6a6a72] outline-none transition focus:border-[#FFD300]" />
          <textarea value={newCourseDesc} onChange={(e) => setNewCourseDesc(e.target.value)} placeholder="Тайлбар (заавал биш)" rows={2} className="w-full rounded-[10px] border border-[#2a2a2e] bg-[#141416] px-4 py-2.5 text-[14px] text-[#eeeee8] placeholder-[#6a6a72] outline-none transition focus:border-[#FFD300] resize-none" />
          <div className="flex items-center gap-3">
            <label className={`cursor-pointer rounded-[10px] border border-[#2a2a2e] bg-[#141416] px-4 py-2 text-[12px] font-medium text-[#6a6a72] transition hover:border-[#FFD300] hover:text-[#eeeee8] ${thumbUploading ? "pointer-events-none opacity-50" : ""}`}>
              {thumbUploading ? "..." : newCourseThumbnail ? "Солих" : "Thumbnail"}
              <input type="file" accept="image/*" onChange={handleThumbnailUpload} className="hidden" disabled={thumbUploading} />
            </label>
            {newCourseThumbnail && (
              <img src={newCourseThumbnail} alt="" className="h-14 w-10 rounded-[8px] object-cover border border-[#2a2a2e]" />
            )}
            <div className="flex-1" />
            <button onClick={handleCreateCourse} disabled={creating || !newCourseTitle.trim()} className="rounded-[10px] bg-[#FFD300] px-5 py-2 text-[12px] font-semibold text-black transition hover:bg-[#e6be00] disabled:opacity-50">
              {creating ? "..." : "Үүсгэх"}
            </button>
          </div>
        </div>
      )}

      {/* Course grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-2 w-2 animate-pulse rounded-full bg-[#FFD300]" />
        </div>
      ) : courses.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[14px] border border-[rgba(255,255,255,0.04)] bg-[#1a1a1e] py-20">
          <svg className="mb-3 h-10 w-10 text-[#2a2a2e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <p className="text-[14px] text-[#6a6a72]">Курс байхгүй байна</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          {courses.map((course) => (
            <Link
              key={course._id}
              href={`/classroom/course/${course._id}`}
              className="group relative overflow-hidden rounded-[14px] border border-[rgba(255,255,255,0.04)] bg-[#1a1a1e] transition-all duration-300 hover:border-[rgba(255,211,0,0.2)] hover:shadow-[0_4px_24px_rgba(255,211,0,0.05)]"
            >
              {/* Thumbnail */}
              <div className="relative aspect-[3/4] w-full overflow-hidden bg-[#141416]">
                {course.thumbnail ? (
                  <img
                    src={course.thumbnail}
                    alt={course.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#1c1c22] to-[#111114]">
                    <svg className="h-10 w-10 text-[#2a2a2e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                )}

                {/* Bottom gradient */}
                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#1a1a1e] to-transparent" />

                {/* Lesson count pill */}
                <div className="absolute top-2.5 right-2.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white/80 backdrop-blur-sm">
                  {course.lessonsCount} хичээл
                </div>

                {/* Course info at bottom */}
                <div className="absolute inset-x-0 bottom-0 p-3.5">
                  <h3 className="text-[14px] font-bold leading-snug text-white group-hover:text-[#FFD300] transition-colors line-clamp-2">
                    {course.title}
                  </h3>
                  {course.description && (
                    <p className="mt-1 text-[11px] leading-relaxed text-white/40 line-clamp-2">
                      {course.description}
                    </p>
                  )}
                </div>

                {/* Admin delete */}
                {admin && (
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteCourse(course._id); }}
                    className="absolute top-2.5 left-2.5 hidden rounded-full bg-black/60 p-1.5 text-white/40 backdrop-blur-sm transition hover:text-red-400 group-hover:flex"
                  >
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
