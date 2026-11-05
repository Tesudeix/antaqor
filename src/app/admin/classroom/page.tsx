"use client";

// Admin classroom hub — central place to manage every course + its lessons.
// Grid of courses with quick stats; admin can create / edit / delete / drill
// into any of them. Replaces the inline admin tools that used to live on
// the public course page.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface Course {
  _id: string;
  title: string;
  description?: string;
  thumbnail?: string;
  coverImage?: string;
  lessonsCount?: number;
  requiredLevel?: number;
  order?: number;
  updatedAt?: string;
}

export default function AdminClassroomHubPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/classroom/courses");
      const data = await res.json();
      if (res.ok) setCourses(data.courses || []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const createCourse = async () => {
    const title = newTitle.trim();
    if (!title || creating) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/classroom/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, order: courses.length }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Үүсгэж чадсангүй");
        return;
      }
      setNewTitle("");
      await load();
    } finally { setCreating(false); }
  };

  const removeCourse = async (id: string, title: string) => {
    if (!confirm(`"${title}" курс + бүх хичээл устгах уу?`)) return;
    const res = await fetch(`/api/classroom/courses/${id}`, { method: "DELETE" });
    if (res.ok) load();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-black text-[#E8E8E8] sm:text-[22px] md:text-[30px]">Classroom</h1>
          <p className="mt-1 text-[12px] text-[#E2E4E8]">Курс + хичээл удирдлага</p>
        </div>
        <Link
          href="/classroom"
          className="rounded-[4px] border border-[rgba(255,255,255,0.08)] px-3 py-1.5 text-[11px] font-bold text-[#E2E4E8] transition hover:border-[rgba(46,41,255,0.35)] hover:text-[#2E29FF]"
        >
          Олон нийтийн харагдац →
        </Link>
      </div>

      {/* Create */}
      <div className="rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0A0A0A] p-4">
        <div className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#E2E4E8]">
          Шинэ курс
        </div>
        <div className="flex gap-2">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") createCourse(); }}
            placeholder="Жнь: Claude Empire"
            className="flex-1 rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2 text-[13px] text-[#E8E8E8] placeholder-[#62666F] outline-none focus:border-[rgba(46,41,255,0.4)]"
          />
          <button
            type="button"
            onClick={createCourse}
            disabled={!newTitle.trim() || creating}
            className="rounded-[4px] bg-[#2E29FF] px-4 py-2 text-[12px] font-black text-white transition hover:bg-[#FF3D69] disabled:opacity-40"
          >
            {creating ? "..." : "Үүсгэх"}
          </button>
        </div>
        {error && (
          <p className="mt-2 text-[11px] text-[#FF8B8B]">{error}</p>
        )}
      </div>

      {/* Course grid */}
      {loading ? (
        <div className="py-10 text-center">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[#2E29FF]" />
        </div>
      ) : courses.length === 0 ? (
        <div className="rounded-[4px] border border-dashed border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] py-12 text-center text-[12px] text-[#E2E4E8]">
          Курс байхгүй байна.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => (
            <div key={c._id} className="overflow-hidden rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0A0A0A] transition hover:border-[rgba(46,41,255,0.3)]">
              {/* Hero */}
              <Link
                href={`/admin/classroom/courses/${c._id}`}
                className="block aspect-[16/9] w-full overflow-hidden bg-[#0A0A0A]"
              >
                {c.coverImage || c.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.coverImage || c.thumbnail} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-[0.2em] text-[#E2E4E8]">
                    no cover
                  </div>
                )}
              </Link>
              {/* Body */}
              <div className="p-3.5">
                <Link
                  href={`/admin/classroom/courses/${c._id}`}
                  className="block truncate text-[14px] font-black text-[#E8E8E8] transition hover:text-[#2E29FF]"
                >
                  {c.title}
                </Link>
                <div className="mt-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[#E2E4E8]">
                  <span>{c.lessonsCount ?? 0} ХИЧЭЭЛ</span>
                  {!!c.requiredLevel && (
                    <>
                      <span className="text-[#d5dce3]">·</span>
                      <span style={{ color: "#FFD300" }}>LV.{c.requiredLevel}</span>
                    </>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Link
                    href={`/admin/classroom/courses/${c._id}`}
                    className="flex-1 rounded-[4px] bg-[#2E29FF] px-3 py-1.5 text-center text-[11px] font-bold text-white transition hover:bg-[#FF3D69]"
                  >
                    Удирдах
                  </Link>
                  <Link
                    href={`/classroom/course/${c._id}`}
                    target="_blank"
                    className="rounded-[4px] border border-[rgba(255,255,255,0.08)] px-3 py-1.5 text-[11px] font-bold text-[#E2E4E8] transition hover:border-[rgba(255,255,255,0.2)] hover:text-[#E8E8E8]"
                  >
                    Үзэх
                  </Link>
                  <button
                    type="button"
                    onClick={() => removeCourse(c._id, c.title)}
                    className="rounded-[4px] border border-[rgba(255,255,255,0.06)] px-2.5 py-1.5 text-[11px] font-bold text-[#E2E4E8] transition hover:border-[#2E29FF]/30 hover:text-[#4C47FF]"
                    title="Устгах"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
