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
        <div className="h-2 w-2 animate-pulse rounded-full bg-[#FFFF01]" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-4">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-[4px] bg-[#0a0a0a]">
          <svg className="h-7 w-7 text-[#FFFF01]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
        <h1 className="mb-2 text-2xl font-black text-[#0a0a0a]">Classroom</h1>
        <p className="mb-6 text-[14px] text-[rgba(0,0,0,0.4)]">Хичээлд хандахын тулд нэвтэрнэ үү</p>
        <Link href="/auth/signin" className="rounded-[4px] bg-[#0a0a0a] px-8 py-3 text-[13px] font-bold text-[#FFFF01] transition hover:scale-105">
          Нэвтрэх
        </Link>
      </div>
    );
  }

  if (!isMember) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-4">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-[4px] bg-[#0a0a0a]">
          <svg className="h-7 w-7 text-[#FFFF01]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h1 className="mb-2 text-2xl font-black text-[#0a0a0a]">Classroom</h1>
        <p className="mb-6 max-w-xs text-[14px] leading-relaxed text-[rgba(0,0,0,0.4)]">
          Зөвхөн Кланы гишүүдэд зориулагдсан
        </p>
        <Link href="/clan" className="rounded-[4px] bg-[#0a0a0a] px-8 py-3 text-[13px] font-bold text-[#FFFF01] transition hover:scale-105">
          Кланд нэгдэх
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-black text-[#0a0a0a] lg:text-4xl">Classroom</h1>
          <p className="mt-2 text-[14px] text-[rgba(0,0,0,0.4)]">
            {courses.length} курс
          </p>
        </div>
        {admin && (
          <button
            onClick={() => setShowNewCourse(!showNewCourse)}
            className="rounded-[4px] bg-[#0a0a0a] px-5 py-2.5 text-[12px] font-bold text-[#FFFF01] transition hover:scale-105"
          >
            {showNewCourse ? "Цуцлах" : "+ Курс"}
          </button>
        )}
      </div>

      {/* Admin: new course form */}
      {admin && showNewCourse && (
        <div className="mb-8 rounded-[4px] border border-[rgba(0,0,0,0.1)] bg-[rgba(0,0,0,0.03)] p-6 space-y-4">
          <input value={newCourseTitle} onChange={(e) => setNewCourseTitle(e.target.value)} placeholder="Курсийн нэр" className="w-full rounded-[4px] border border-[rgba(0,0,0,0.1)] bg-white px-4 py-3 text-[15px] text-[#0a0a0a] placeholder-[rgba(0,0,0,0.3)] outline-none transition focus:border-[#0a0a0a]" />
          <textarea value={newCourseDesc} onChange={(e) => setNewCourseDesc(e.target.value)} placeholder="Тайлбар (заавал биш)" rows={2} className="w-full rounded-[4px] border border-[rgba(0,0,0,0.1)] bg-white px-4 py-3 text-[15px] text-[#0a0a0a] placeholder-[rgba(0,0,0,0.3)] outline-none transition focus:border-[#0a0a0a] resize-none" />
          <div className="flex items-center gap-3">
            <label className={`cursor-pointer rounded-[4px] border border-[rgba(0,0,0,0.1)] bg-white px-4 py-2.5 text-[12px] font-medium text-[rgba(0,0,0,0.4)] transition hover:border-[#0a0a0a] hover:text-[#0a0a0a] ${thumbUploading ? "pointer-events-none opacity-50" : ""}`}>
              {thumbUploading ? "..." : newCourseThumbnail ? "Солих" : "Thumbnail"}
              <input type="file" accept="image/*" onChange={handleThumbnailUpload} className="hidden" disabled={thumbUploading} />
            </label>
            {newCourseThumbnail && (
              <img src={newCourseThumbnail} alt="" className="h-14 w-10 rounded-[4px] object-cover border border-[rgba(0,0,0,0.1)]" />
            )}
            <div className="flex-1" />
            <button onClick={handleCreateCourse} disabled={creating || !newCourseTitle.trim()} className="rounded-[4px] bg-[#0a0a0a] px-6 py-2.5 text-[12px] font-bold text-[#FFFF01] transition hover:scale-105 disabled:opacity-50">
              {creating ? "..." : "Үүсгэх"}
            </button>
          </div>
        </div>
      )}

      {/* Course list — blog-style cards */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-2 w-2 animate-pulse rounded-full bg-[#0a0a0a]" />
        </div>
      ) : courses.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[4px] border border-[rgba(0,0,0,0.08)] py-20">
          <svg className="mb-4 h-10 w-10 text-[rgba(0,0,0,0.15)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <p className="text-[15px] text-[rgba(0,0,0,0.3)]">Курс байхгүй байна</p>
        </div>
      ) : (
        <div className="space-y-4">
          {courses.map((course) => (
            <Link
              key={course._id}
              href={`/classroom/course/${course._id}`}
              className="group flex gap-5 rounded-[4px] bg-[#0a0a0a] p-5 transition hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.2)] sm:p-6"
            >
              {/* Thumbnail */}
              {course.thumbnail ? (
                <div className="hidden shrink-0 overflow-hidden rounded-[4px] sm:block">
                  <img
                    src={course.thumbnail}
                    alt={course.title}
                    className="h-24 w-20 object-cover transition-transform duration-300 group-hover:scale-105 lg:h-28 lg:w-24"
                  />
                </div>
              ) : (
                <div className="hidden h-24 w-20 shrink-0 items-center justify-center rounded-[4px] bg-[rgba(255,255,1,0.06)] sm:flex lg:h-28 lg:w-24">
                  <svg className="h-8 w-8 text-[rgba(255,255,1,0.2)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              )}

              {/* Content */}
              <div className="min-w-0 flex-1">
                <h2 className="text-[17px] font-bold text-white group-hover:text-[#FFFF01] transition-colors leading-snug lg:text-[19px]">
                  {course.title}
                </h2>
                {course.description && (
                  <p className="mt-2 text-[13px] leading-relaxed text-[rgba(255,255,255,0.4)] line-clamp-2 lg:text-[14px]">
                    {course.description}
                  </p>
                )}
                <div className="mt-3 flex items-center gap-3 text-[12px] text-[rgba(255,255,255,0.25)]">
                  <span className="flex items-center gap-1">
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {course.lessonsCount} хичээл
                  </span>
                </div>
              </div>

              {/* Arrow */}
              <div className="hidden items-center sm:flex">
                <svg className="h-5 w-5 text-[rgba(255,255,255,0.15)] transition group-hover:text-[#FFFF01] group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>

              {/* Admin delete */}
              {admin && (
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteCourse(course._id); }}
                  className="hidden shrink-0 items-center justify-center rounded-[4px] p-2 text-[rgba(255,255,255,0.2)] transition hover:text-red-400 group-hover:flex"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
