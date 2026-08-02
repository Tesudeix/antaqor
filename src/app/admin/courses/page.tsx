"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { T, MONO, Ico, Card, Metric, Btn, SectionHeader, Empty, Skeleton } from "@/components/admin/kit";

interface Course { _id?: string; slug?: string; title: string; lessonsCount?: number; coverImage?: string; description?: string }

export default function CoursesOverview() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/classroom/courses").then((r) => (r.ok ? r.json() : null)).catch(() => null).then((d) => {
      const list: Course[] = d?.courses || (Array.isArray(d) ? d : []);
      setCourses(list); setLoading(false);
    });
  }, []);

  const totalLessons = courses.reduce((a, c) => a + (c.lessonsCount || 0), 0);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: T.primary }}>Хичээл</div>
          <h1 className="mt-1 text-[26px] font-semibold tracking-tight" style={{ color: T.text }}>Courses</h1>
          <p className="mt-0.5 text-[12px]" style={{ color: T.faint }}>Сургалтын агуулга · бүтэц</p>
        </div>
        <Btn href="/admin/classroom" variant="primary"><span className="text-[16px] leading-none">+</span> Хичээл засах</Btn>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-[104px]" />)}</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <Metric label="Нийт курс" value={courses.length} accent="primary" />
          <Metric label="Нийт хичээл" value={totalLessons} accent="secondary" />
          <Metric label="Дундаж хичээл" value={courses.length ? Math.round(totalLessons / courses.length) : 0} />
        </div>
      )}

      <div className="mt-8">
        <SectionHeader title="Курсүүд" action={<Link href="/admin/classroom" className="text-[11px] font-bold" style={{ color: T.secondary }}>Бүрэн засварлагч →</Link>} />
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}</div>
        ) : courses.length === 0 ? (
          <Empty title="Курс алга" hint="Эхний сургалтаа үүсгэж эхлүүлнэ үү." cta={<Btn href="/admin/classroom" variant="secondary" size="sm">Курс үүсгэх</Btn>} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c, i) => (
              <Link key={c._id || c.slug || i} href="/admin/classroom">
                <Card hover className="flex h-full flex-col p-4">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-none" style={{ background: "rgba(16,128,202,0.1)", color: T.primary }}>
                      <Ico d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" className="h-[18px] w-[18px]" />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-semibold" style={{ color: T.text }}>{c.title}</div>
                      <div className="text-[11px]" style={{ fontFamily: MONO, color: T.faint }}>{c.lessonsCount || 0} хичээл</div>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
