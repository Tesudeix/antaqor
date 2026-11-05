"use client";

// Per-course admin: edit course meta + list/manage lessons.
// All admin actions for a course live here, replacing the inline admin
// chrome on the public course page.

import { useCallback, useEffect, useState, use } from "react";
import Link from "next/link";
import CourseGroups from "@/components/classroom/CourseGroups";
import CourseReviews from "@/components/classroom/CourseReviews";
import { useRouter } from "next/navigation";

interface CourseInfo {
  _id: string;
  title: string;
  description?: string;
  thumbnail?: string;
  coverImage?: string;
  requiredLevel?: number;
}
interface LessonRow {
  _id: string;
  title: string;
  videoUrl?: string;
  content?: string;
  order?: number;
  thumbnail?: string;
}

export default function AdminCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [course, setCourse] = useState<CourseInfo | null>(null);
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [search, setSearch] = useState("");
  const [shown, setShown] = useState(30);
  const [loading, setLoading] = useState(true);

  // ─── Meta editing ─────────────────────────────────────────────────────
  const [meta, setMeta] = useState<{ title: string; description: string; category: string; requiredLevel: number; thumbnail: string; coverImage: string }>({
    title: "", description: "", category: "", requiredLevel: 0, thumbnail: "", coverImage: "",
  });
  const [savingMeta, setSavingMeta] = useState(false);
  const [uploadingField, setUploadingField] = useState<null | "thumbnail" | "coverImage">(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/classroom/courses/${id}`);
      const data = await res.json();
      if (res.ok) {
        setCourse(data.course);
        setLessons(data.lessons || []);
        setMeta({
          title: data.course.title || "",
          description: data.course.description || "",
          category: data.course.category || "",
          requiredLevel: data.course.requiredLevel || 0,
          thumbnail: data.course.thumbnail || "",
          coverImage: data.course.coverImage || "",
        });
      }
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const saveMeta = async () => {
    setSavingMeta(true);
    try {
      const res = await fetch(`/api/classroom/courses/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(meta),
      });
      if (res.ok) await load();
    } finally { setSavingMeta(false); }
  };

  const uploadImage = async (field: "thumbnail" | "coverImage", file: File) => {
    setUploadingField(field);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok && data.url) {
        setMeta((m) => ({ ...m, [field]: data.url }));
      }
    } finally { setUploadingField(null); }
  };

  const removeLesson = async (lesson: LessonRow) => {
    if (!confirm(`"${lesson.title}" хичээлийг устгах уу?`)) return;
    const res = await fetch(`/api/classroom/lessons/${lesson._id}`, { method: "DELETE" });
    if (res.ok) load();
  };

  const removeCourse = async () => {
    if (!course) return;
    if (!confirm(`"${course.title}" курс + ${lessons.length} хичээл бүгдийг устгах уу?`)) return;
    const res = await fetch(`/api/classroom/courses/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/admin/classroom");
  };

  if (loading) return <div className="py-12 text-center text-[12px] text-[#E2E4E8]">Ачаалж байна…</div>;
  if (!course) return <div className="py-12 text-center text-[12px] text-[#E2E4E8]">Курс олдсонгүй.</div>;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Link
        href="/admin/classroom"
        className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#E2E4E8] transition hover:text-[#2E29FF]"
      >
        <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Бүх курс
      </Link>

      {/* Meta editor */}
      <div className="rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0A0A0A] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[14px] font-black text-[#E8E8E8]">Курсийн мэдээлэл</h2>
          <button
            type="button"
            onClick={removeCourse}
            className="text-[10px] font-bold text-[#E2E4E8] transition hover:text-[#4C47FF]"
          >
            Курс устгах
          </button>
        </div>
        <div className="space-y-3">
          <Field label="Нэр" value={meta.title} onChange={(v) => setMeta((m) => ({ ...m, title: v }))} />
          <Field label="Тайлбар" textarea value={meta.description} onChange={(v) => setMeta((m) => ({ ...m, description: v }))} />
          <Field label="Категори" value={meta.category} onChange={(v) => setMeta((m) => ({ ...m, category: v }))} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ImageField
              label="Cover (hero)"
              value={meta.coverImage}
              onUpload={(f) => uploadImage("coverImage", f)}
              onClear={() => setMeta((m) => ({ ...m, coverImage: "" }))}
              busy={uploadingField === "coverImage"}
            />
            <ImageField
              label="Thumbnail (карт)"
              value={meta.thumbnail}
              onUpload={(f) => uploadImage("thumbnail", f)}
              onClear={() => setMeta((m) => ({ ...m, thumbnail: "" }))}
              busy={uploadingField === "thumbnail"}
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#E2E4E8]">Шаардах түвшин</label>
            <input
              type="number"
              min={0}
              max={100}
              value={meta.requiredLevel}
              onChange={(e) => setMeta((m) => ({ ...m, requiredLevel: Math.max(0, parseInt(e.target.value) || 0) }))}
              className="w-20 rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-1.5 text-center text-[12px] text-[#E8E8E8] outline-none focus:border-[rgba(46,41,255,0.4)]"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Link
              href={`/classroom/course/${id}`}
              target="_blank"
              className="rounded-[4px] border border-[rgba(255,255,255,0.08)] px-3 py-2 text-[11px] font-bold text-[#E2E4E8] transition hover:border-[rgba(255,255,255,0.2)] hover:text-[#E8E8E8]"
            >
              Үзэх
            </Link>
            <button
              type="button"
              onClick={saveMeta}
              disabled={savingMeta || !!uploadingField}
              className="rounded-[4px] bg-[#2E29FF] px-4 py-2 text-[12px] font-black text-white transition hover:bg-[#FF3D69] disabled:opacity-50"
            >
              {savingMeta ? "..." : "Хадгалах"}
            </button>
          </div>
        </div>
      </div>

      <CourseGroups courseId={id} />
      {/* Lessons */}
      <div className="rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0A0A0A]">
        <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] px-4 py-3">
          <div className="flex items-baseline gap-2">
            <h2 className="text-[14px] font-black text-[#E8E8E8]">Хичээл</h2>
            <span className="font-mono text-[10px] tabular-nums text-[#E2E4E8]">{lessons.length}</span>
          </div>
          <Link
            href={`/admin/classroom/courses/${id}/lessons/new`}
            className="inline-flex items-center gap-1.5 rounded-[4px] bg-[#2E29FF] px-3 py-1.5 text-[11px] font-black text-white transition hover:bg-[#FF3D69]"
          >
            <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Шинэ хичээл
          </Link>
        </div>
        <div className="p-4"><input aria-label="Хичээл хайх" type="search" value={search} onChange={e=>{setSearch(e.target.value);setShown(30);}} placeholder="Хичээл хайх…" className="w-full rounded border border-[#262626] bg-[#141414] p-3 text-sm text-[#E8E8E8]" /></div>
        {lessons.length === 0 ? (
          <div className="p-8 text-center text-[12px] text-[#E2E4E8]">
            Хичээл байхгүй. Дээрх «+ Шинэ хичээл» товчоор эхлүүлнэ үү.
          </div>
        ) : (
          <ul className="divide-y divide-[rgba(255,255,255,0.04)]">
            {lessons
              .slice()
              .sort((a, b) => (a.order || 0) - (b.order || 0))
              .filter(l=>l.title.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
              .slice(0,shown)
              .map((l, i) => (
                <li key={l._id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="w-6 shrink-0 font-mono text-[10px] tabular-nums text-[#E2E4E8]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="h-10 w-16 shrink-0 overflow-hidden rounded-[4px] bg-[#0A0A0A]">
                    {l.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={l.thumbnail} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <Link
                    href={`/admin/classroom/courses/${id}/lessons/${l._id}`}
                    className="min-w-0 flex-1 truncate text-[13px] font-bold text-[#E8E8E8] transition hover:text-[#2E29FF]"
                  >
                    {l.title || "Untitled"}
                  </Link>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {l.videoUrl && (
                      <span
                        className="rounded-[4px] px-1.5 py-0.5 font-mono text-[8.5px] font-bold uppercase tracking-[0.18em]"
                        style={{ background: "rgba(79,224,101,0.1)", color: "#4FE065" }}
                      >
                        VIDEO
                      </span>
                    )}
                    {l.content && l.content.trim().length > 20 && (
                      <span
                        className="rounded-[4px] px-1.5 py-0.5 font-mono text-[8.5px] font-bold uppercase tracking-[0.18em]"
                        style={{ background: "rgba(46,41,255,0.1)", color: "#2E29FF" }}
                      >
                        BLOG
                      </span>
                    )}
                  </div>
                  <Link
                    href={`/admin/classroom/courses/${id}/lessons/${l._id}`}
                    className="rounded-[4px] border border-[rgba(255,255,255,0.08)] px-2.5 py-1 text-[10px] font-bold text-[#E2E4E8] transition hover:border-[rgba(46,41,255,0.35)] hover:text-[#2E29FF]"
                  >
                    Засах
                  </Link>
                  <button
                    type="button"
                    onClick={() => removeLesson(l)}
                    className="rounded-[4px] px-2 py-1 text-[10px] font-bold text-[#E2E4E8] transition hover:text-[#4C47FF]"
                    title="Устгах"
                  >
                    ✕
                  </button>
                </li>
              ))}
          </ul>

        )}
        {lessons.filter(l=>l.title.toLocaleLowerCase().includes(search.toLocaleLowerCase())).length>shown && <button onClick={()=>setShown(n=>n+30)} className="m-4 rounded border px-4 py-2 text-sm">Дараагийн 30 хичээл</button>}
      </div>
      <div className="rounded-[4px] border border-[#262626] bg-[#141414]"><CourseReviews courseId={id} readOnly /></div>
    </div>
  );
}

// ─── Small UI primitives ────────────────────────────────────────────────
function Field({
  label, value, onChange, textarea,
}: { label: string; value: string; onChange: (v: string) => void; textarea?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#E2E4E8]">
        {label}
      </span>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="w-full resize-y rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2 text-[13px] leading-relaxed text-[#E8E8E8] outline-none focus:border-[rgba(46,41,255,0.4)]"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2 text-[13px] text-[#E8E8E8] outline-none focus:border-[rgba(46,41,255,0.4)]"
        />
      )}
    </label>
  );
}

function ImageField({
  label, value, onUpload, onClear, busy,
}: { label: string; value: string; onUpload: (f: File) => void; onClear: () => void; busy: boolean }) {
  return (
    <div>
      <span className="mb-1 block font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#E2E4E8]">
        {label}
      </span>
      <label className="flex aspect-[16/9] w-full cursor-pointer items-center justify-center overflow-hidden rounded-[4px] border border-dashed border-[rgba(255,255,255,0.1)] bg-[#0A0A0A] transition hover:border-[rgba(46,41,255,0.35)]">
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUpload(f);
            e.currentTarget.value = "";
          }}
        />
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-full w-full object-cover" />
        ) : busy ? (
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-[#2E29FF] border-t-transparent" />
        ) : (
          <span className="text-[10px] uppercase tracking-[0.2em] text-[#E2E4E8]">+ Зураг</span>
        )}
      </label>
      {value && (
        <button
          type="button"
          onClick={onClear}
          className="mt-1 text-[10px] font-bold text-[#E2E4E8] transition hover:text-[#4C47FF]"
        >
          Цэвэрлэх
        </button>
      )}
    </div>
  );
}
