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
  const [category, setCategory] = useState<"мэдээлэл" | "ялалт" | "промт" | "бүтээл" | "танилцуулга">("мэдээлэл");
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Fetch open tasks
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

  const selTask = tasks.find((t) => t._id === selectedTask);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-2 text-[22px] font-bold text-[#E8E8E8]">
        Пост үүсгэх
      </h1>
      <p className="mb-6 text-[13px] text-[#999999]">
        Дижитал үндэстэнтэй хуваалцаарай
      </p>

      {error && (
        <div className="mb-4 rounded-[4px] border border-red-900/50 bg-red-950/30 px-4 py-3 text-[12px] text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#141414] p-5">
          {/* Task selector */}
          {tasks.length > 0 && (
            <div className="mb-4 border-b border-[rgba(255,255,255,0.08)] pb-4">
              <div className="mb-2 flex items-center gap-2">
                <svg className="h-4 w-4 text-[#EF2C58]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
                <span className="text-[11px] font-bold uppercase tracking-wide text-[#EF2C58]">Даалгавар сонгох</span>
                <span className="text-[10px] text-[#999999]">· XP авах</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {tasks.map((task, i) => (
                  <button
                    key={task._id}
                    type="button"
                    onClick={() => setSelectedTask(selectedTask === task._id ? null : task._id)}
                    className={`rounded-[4px] px-3 py-2 text-left transition ${
                      selectedTask === task._id
                        ? "border border-[rgba(239,44,88,0.4)] bg-[rgba(239,44,88,0.08)]"
                        : "border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] hover:border-[rgba(255,255,255,0.15)]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`text-[12px] font-bold ${selectedTask === task._id ? "text-[#EF2C58]" : "text-[#999999]"}`}>
                        #{i + 1}
                      </span>
                      <span className={`text-[12px] font-semibold ${selectedTask === task._id ? "text-[#E8E8E8]" : "text-[#999999]"}`}>
                        {task.title}
                      </span>
                      <span className="rounded-[4px] bg-[rgba(239,44,88,0.12)] px-1.5 py-0.5 text-[9px] font-bold text-[#EF2C58]">
                        +{task.xpReward} XP
                      </span>
                    </div>
                    {task.description && (
                      <p className="mt-0.5 text-[10px] text-[#999999] line-clamp-1">{task.description}</p>
                    )}
                  </button>
                ))}
              </div>
              {selTask && (
                <div className="mt-2 rounded-[4px] bg-[rgba(239,44,88,0.04)] border border-[rgba(239,44,88,0.1)] px-3 py-2 text-[11px] text-[#999999]">
                  Энэ постыг <span className="font-bold text-[#EF2C58]">#{tasks.findIndex((t) => t._id === selectedTask) + 1} {selTask.title}</span> даалгавартай холбож <span className="font-bold text-[#EF2C58]">+{selTask.xpReward} XP</span> авна
                </div>
              )}
            </div>
          )}

          {/* Category selector */}
          <div className="mb-4 border-b border-[rgba(255,255,255,0.08)] pb-4">
            <div className="mb-2 text-[10px] uppercase tracking-[1px] text-[#555555]">Ангилал</div>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {([
                { key: "мэдээлэл" as const, label: "Мэдээлэл" },
                { key: "ялалт" as const, label: "Ялалт" },
                { key: "промт" as const, label: "Промт" },
                { key: "бүтээл" as const, label: "Бүтээл" },
                { key: "танилцуулга" as const, label: "Танилцуулга" },
              ]).map((cat) => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setCategory(cat.key)}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition ${
                    category === cat.key
                      ? "bg-[#EF2C58] text-white"
                      : "text-[#666666] bg-[rgba(255,255,255,0.04)] hover:text-[#999999]"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Та юу бодож байна? (зурагтай бол заавал биш)"
            rows={4}
            maxLength={2000}
            className="w-full resize-none border-0 bg-transparent text-[13px] leading-[1.9] text-[#E8E8E8] placeholder-[#555555] focus:outline-none"
          />

          {imagePreview && (
            <div className="relative mt-4 overflow-hidden rounded-[4px] border border-[rgba(255,255,255,0.08)]">
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
          )}

          {!imagePreview && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              className={`mt-4 flex cursor-pointer flex-col items-center gap-2 rounded-[4px] border border-dashed py-8 transition ${
                dragOver
                  ? "border-[#EF2C58] bg-[rgba(239,44,88,0.03)]"
                  : "border-[rgba(255,255,255,0.1)] hover:border-[rgba(255,255,255,0.2)]"
              }`}
            >
              <svg className="h-6 w-6 text-[#999999]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-[11px] text-[#999999]">
                {dragOver ? "Зургаа энд тавина уу" : "Зураг дарах эсвэл чирэх"}
              </span>
              <span className="text-[9px] text-[#999999]">
                JPEG, PNG, WebP, GIF · Хамгийн ихдээ 10MB
              </span>
            </div>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={onFileChange}
            className="hidden"
          />

          <div className="flex items-center justify-between border-t border-[rgba(255,255,255,0.08)] pt-4 mt-4">
            <div className="flex items-center gap-4">
              <span className="text-[10px] text-[#999999]">
                {content.length}/2000
              </span>
              {imageUrl && (
                <span className="flex items-center gap-1 text-[10px] text-[#EF2C58]">
                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Зураг бэлэн
                </span>
              )}
              {selectedTask && (
                <span className="flex items-center gap-1 text-[10px] text-[#EF2C58]">
                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Даалгавар
                </span>
              )}
            </div>
            <button
              type="submit"
              disabled={!canPost}
              className="rounded-[4px] bg-[#EF2C58] px-6 py-2 text-[12px] font-bold text-[#F8F8F6] transition hover:shadow-[0_0_24px_rgba(239,44,88,0.25)] disabled:opacity-40"
            >
              {loading ? "Нийтлэж байна..." : selectedTask ? `Нийтлэх (+${selTask?.xpReward || 0} XP)` : "Нийтлэх"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
