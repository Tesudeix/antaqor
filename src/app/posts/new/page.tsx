"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import PaywallGate from "@/components/PaywallGate";

interface TaskData {
  _id: string;
  title: string;
  description: string;
  xpReward: number;
  status: string;
}

type Category = "промт" | "бүтээл" | "ялалт" | "мэдээлэл" | "танилцуулга";

const CATEGORIES: {
  key: Category;
  label: string;
  blurb: string;
  color: string;
  tint: string;
  placeholder: string;
  icon: React.ReactNode;
}[] = [
  {
    key: "промт",
    label: "Промт",
    blurb: "Ажилласан промтоо хуваалц",
    color: "#0F81CA",
    tint: "rgba(15,129,202,0.12)",
    placeholder:
      "Амжилттай ажилласан промтоо энд буулгаарай.\n\nЖишээ:\nAct as a senior UX designer. Given …",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M8 9l-3 3 3 3m8-6l3 3-3 3M14 5l-4 14" />
      </svg>
    ),
  },
  {
    key: "бүтээл",
    label: "Бүтээл",
    blurb: "AI-ээр хийсэн бүтээл",
    color: "#22C55E",
    tint: "rgba(34,197,94,0.12)",
    placeholder:
      "Юу бүтээсэн бэ? Аль AI ашигласан, ямар challenge тулгарч, хэрхэн шийдсэнээ бичнэ үү.",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    key: "ялалт",
    label: "Ялалт",
    blurb: "Амжилтаа тэмдэглэ",
    color: "#EF2C58",
    tint: "rgba(239,44,88,0.12)",
    placeholder: "Ямар амжилт гаргасан бэ? Community-д урам өгөх storyоо бичнэ үү.",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M12 15a4 4 0 004-4V4H8v7a4 4 0 004 4zm0 0v3m0 0H8m4 0h4M5 4h3m8 0h3m-3 3a3 3 0 003-3m-14 0a3 3 0 003 3" />
      </svg>
    ),
  },
  {
    key: "мэдээлэл",
    label: "Мэдээлэл",
    blurb: "AI ертөнцийн шинэ",
    color: "#3B82F6",
    tint: "rgba(59,130,246,0.12)",
    placeholder:
      "AI ертөнцөд гарсан шинэ мэдээ, tool, release эсвэл шилдэг туршлагаа хуваалц.",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2M7 8h6M7 12h6M7 16h4" />
      </svg>
    ),
  },
  {
    key: "танилцуулга",
    label: "Танилцуулга",
    blurb: "Өөрийгөө танилцуул",
    color: "#A855F7",
    tint: "rgba(168,85,247,0.12)",
    placeholder: "Таны нэр, юу хийдэг, AI-тай ямар харилцаатай байдаг талаар хуваалц.",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
];

export default function NewPost() {
  return (
    <PaywallGate>
      <NewPostContent />
    </PaywallGate>
  );
}

function NewPostContent() {
  const { data: session } = useSession();
  const router = useRouter();
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [category, setCategory] = useState<Category>("промт");
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [questOpen, setQuestOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/tasks")
      .then((r) => r.json())
      .then((d) => {
        if (d.tasks) {
          const openTasks = d.tasks.filter((t: TaskData) => t.status === "open");
          setTasks(openTasks);
        }
      })
      .catch(() => {});
  }, []);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Зөвхөн зургийн файл зөвшөөрөгдөнө");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Зураг 10MB-с бага байх ёстой");
      return;
    }

    setError("");
    setImagePreview(URL.createObjectURL(file));
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Оруулах амжилтгүй");
        setImagePreview("");
        return;
      }
      setImageUrl(data.url);
    } catch {
      setError("Оруулах амжилтгүй. Дахин оролдоно уу.");
      setImagePreview("");
    } finally {
      setUploading(false);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const removeImage = () => {
    setImageUrl("");
    setImagePreview("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const canPost = !loading && !uploading && (content.trim().length > 0 || imageUrl);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canPost) return;

    setError("");
    setLoading(true);

    try {
      const body: Record<string, string | null> = {
        content: content.trim(),
        image: imageUrl,
        category,
      };
      if (selectedTask) body.taskId = selectedTask;

      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      router.push("/");
    } finally {
      setLoading(false);
    }
  };

  if (!session) return null;

  const active = CATEGORIES.find((c) => c.key === category)!;
  const selTask = tasks.find((t) => t._id === selectedTask);

  return (
    <div className="mx-auto max-w-2xl pb-28 md:pb-10">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-[22px] font-bold tracking-tight text-[#E8E8E8]">
          Community-д хуваалц
        </h1>
        <p className="mt-1 text-[12px] text-[#888888]">
          AI-тэй бүтээж буй зүйлээ, туршлагаа эсвэл олсон юмаа хуваалцаарай.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-[4px] border border-red-900/50 bg-red-950/30 px-4 py-3 text-[12px] text-red-400">
          {error}
        </div>
      )}

      <form id="new-post-form" onSubmit={handleSubmit} className="space-y-4">
        {/* Intent picker — visual tiles */}
        <div>
          <div className="mb-2 text-[10px] uppercase tracking-[1.5px] text-[#555555]">
            1. Юу хуваалцах вэ?
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {CATEGORIES.map((cat) => {
              const isActive = category === cat.key;
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setCategory(cat.key)}
                  className="group relative flex flex-col items-start gap-1.5 rounded-[6px] border p-3 text-left transition-all duration-200"
                  style={{
                    borderColor: isActive ? cat.color : "rgba(255,255,255,0.08)",
                    background: isActive ? cat.tint : "#141414",
                    boxShadow: isActive ? `0 0 0 1px ${cat.color} inset` : "none",
                  }}
                >
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-[4px]"
                    style={{ background: cat.tint, color: cat.color }}
                  >
                    {cat.icon}
                  </div>
                  <div>
                    <div
                      className="text-[12px] font-bold"
                      style={{ color: isActive ? cat.color : "#E8E8E8" }}
                    >
                      {cat.label}
                    </div>
                    <div className="text-[10px] leading-tight text-[#888888]">
                      {cat.blurb}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content card */}
        <div className="rounded-[6px] border border-[rgba(255,255,255,0.08)] bg-[#141414] p-4 sm:p-5">
          <div className="mb-2 flex items-center gap-2">
            <span
              className="inline-flex h-5 items-center gap-1 rounded-[4px] px-2 text-[10px] font-bold uppercase tracking-wide"
              style={{ background: active.tint, color: active.color }}
            >
              {active.label}
            </span>
            <span className="text-[11px] text-[#666666]">· {active.blurb}</span>
          </div>

          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={active.placeholder}
            rows={6}
            maxLength={2000}
            className="w-full resize-none border-0 bg-transparent text-[14px] leading-[1.75] text-[#E8E8E8] placeholder-[#555555] focus:outline-none"
          />

          {imagePreview ? (
            <div className="relative mt-3 overflow-hidden rounded-[4px] border border-[rgba(255,255,255,0.08)]">
              <img
                src={imagePreview}
                alt="Урьдчилан харах"
                className="w-full object-contain"
                style={{ maxHeight: "480px" }}
              />
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-[rgba(0,0,0,0.7)]">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-[#EF2C58]" />
                </div>
              )}
              {!uploading && (
                <button
                  type="button"
                  onClick={removeImage}
                  className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-[rgba(0,0,0,0.7)] text-white transition hover:bg-red-500"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ) : (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              className={`mt-3 flex cursor-pointer items-center gap-3 rounded-[4px] border border-dashed px-4 py-3 transition ${
                dragOver
                  ? "border-[#EF2C58] bg-[rgba(239,44,88,0.03)]"
                  : "border-[rgba(255,255,255,0.1)] hover:border-[rgba(255,255,255,0.2)]"
              }`}
            >
              <svg className="h-5 w-5 shrink-0 text-[#888888]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] text-[#CCCCCC]">
                  {dragOver ? "Зургаа энд тавина уу" : "Зураг нэмэх"}
                  <span className="ml-1 text-[10px] text-[#666666]">
                    (заавал биш)
                  </span>
                </div>
                <div className="text-[10px] text-[#666666]">JPEG, PNG, WebP, GIF · 10MB хүртэл</div>
              </div>
            </div>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={onFileChange}
            className="hidden"
          />
        </div>

        {/* Quest — collapsed by default */}
        {tasks.length > 0 && (
          <div className="rounded-[6px] border border-[rgba(255,255,255,0.08)] bg-[#141414]">
            <button
              type="button"
              onClick={() => setQuestOpen((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 text-[#EF2C58]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="text-[12px] font-semibold text-[#E8E8E8]">
                  {selTask ? (
                    <>
                      Даалгавар: <span className="text-[#EF2C58]">{selTask.title}</span>{" "}
                      <span className="text-[10px] font-bold text-[#EF2C58]">+{selTask.xpReward} XP</span>
                    </>
                  ) : (
                    "Даалгаварт холбож XP авах"
                  )}
                </span>
              </div>
              <svg
                className={`h-4 w-4 text-[#888888] transition-transform ${questOpen ? "rotate-180" : ""}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {questOpen && (
              <div className="border-t border-[rgba(255,255,255,0.08)] p-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  {tasks.map((task, i) => {
                    const sel = selectedTask === task._id;
                    return (
                      <button
                        key={task._id}
                        type="button"
                        onClick={() => setSelectedTask(sel ? null : task._id)}
                        className={`rounded-[4px] border px-3 py-2 text-left transition ${
                          sel
                            ? "border-[rgba(239,44,88,0.5)] bg-[rgba(239,44,88,0.08)]"
                            : "border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] hover:border-[rgba(255,255,255,0.15)]"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`text-[11px] font-bold ${sel ? "text-[#EF2C58]" : "text-[#666666]"}`}>
                            #{i + 1}
                          </span>
                          <span className="flex-1 truncate text-[12px] font-semibold text-[#E8E8E8]">
                            {task.title}
                          </span>
                          <span className="rounded-[4px] bg-[rgba(239,44,88,0.12)] px-1.5 py-0.5 text-[9px] font-bold text-[#EF2C58]">
                            +{task.xpReward}
                          </span>
                        </div>
                        {task.description && (
                          <p className="mt-0.5 text-[10px] text-[#888888] line-clamp-1">
                            {task.description}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Desktop submit row */}
        <div className="hidden items-center justify-between md:flex">
          <span className="text-[11px] text-[#666666]">{content.length}/2000</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="text-[12px] font-medium text-[#888888] transition hover:text-[#E8E8E8]"
            >
              Буцах
            </button>
            <button
              type="submit"
              disabled={!canPost}
              className="rounded-[4px] bg-[#EF2C58] px-6 py-2 text-[12px] font-bold text-white transition hover:shadow-[0_0_24px_rgba(239,44,88,0.3)] disabled:opacity-40 disabled:hover:shadow-none"
            >
              {loading ? "Нийтлэж байна..." : selTask ? `Нийтлэх · +${selTask.xpReward} XP` : "Нийтлэх"}
            </button>
          </div>
        </div>
      </form>

      {/* Mobile sticky submit — sits above BottomBar */}
      <div
        className="fixed left-0 right-0 z-40 border-t border-[rgba(255,255,255,0.08)] bg-[rgba(10,10,10,0.98)] backdrop-blur-xl md:hidden"
        style={{ bottom: "calc(56px + env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center gap-3 px-4 py-2.5">
          <span className="text-[10px] text-[#666666]">{content.length}/2000</span>
          <button
            type="submit"
            form="new-post-form"
            disabled={!canPost}
            className="ml-auto rounded-[4px] bg-[#EF2C58] px-5 py-2.5 text-[12px] font-bold text-white transition disabled:opacity-40"
          >
            {loading ? "Нийтлэж байна..." : selTask ? `Нийтлэх · +${selTask.xpReward} XP` : "Нийтлэх"}
          </button>
        </div>
      </div>
    </div>
  );
}
