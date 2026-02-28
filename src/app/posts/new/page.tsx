"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useRef } from "react";
import PaywallGate from "@/components/PaywallGate";
import { isAdminEmail } from "@/lib/adminClient";

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
  const [visibility, setVisibility] = useState<"free" | "members">("members");
  const fileRef = useRef<HTMLInputElement>(null);

  const userIsAdmin = isAdminEmail(session?.user?.email);

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
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          image: imageUrl,
          visibility: userIsAdmin ? visibility : "members",
        }),
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

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-2 font-[Bebas_Neue] text-4xl tracking-[2px] text-[#ede8df]">
        Пост үүсгэх
      </h1>
      <p className="mb-8 text-[11px] tracking-[2px] text-[#5a5550]">
        ДИЖИТАЛ ҮНДЭСТЭНТЭЙ ХУВААЛЦААРАЙ
      </p>

      {error && (
        <div className="mb-6 border-l-2 border-[#cc2200] bg-[rgba(204,34,0,0.08)] px-4 py-3 text-[12px] text-[#cc2200]">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="card p-5 md:p-6">
          {/* Admin visibility toggle */}
          {userIsAdmin && (
            <div className="mb-4 flex items-center gap-3 border-b border-[rgba(240,236,227,0.06)] pb-4">
              <span className="text-[10px] uppercase tracking-[1px] text-[#5a5550]">Харагдах:</span>
              <button
                type="button"
                onClick={() => setVisibility("free")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase tracking-[1px] transition ${
                  visibility === "free"
                    ? "bg-[rgba(34,197,94,0.1)] text-green-500 border border-[rgba(34,197,94,0.3)]"
                    : "text-[#5a5550] border border-[#1c1c1c] hover:text-[#c8c8c0]"
                }`}
              >
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                </svg>
                Нээлттэй
              </button>
              <button
                type="button"
                onClick={() => setVisibility("members")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase tracking-[1px] transition ${
                  visibility === "members"
                    ? "bg-[rgba(204,34,0,0.1)] text-[#cc2200] border border-[rgba(204,34,0,0.3)]"
                    : "text-[#5a5550] border border-[#1c1c1c] hover:text-[#c8c8c0]"
                }`}
              >
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Гишүүдэд
              </button>
            </div>
          )}

          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Та юу бодож байна? (зурагтай бол заавал биш)"
            rows={4}
            maxLength={2000}
            className="w-full resize-none border-0 bg-transparent text-[13px] leading-[1.9] text-[#ede8df] placeholder-[#5a5550] focus:outline-none"
          />

          {imagePreview && (
            <div className="relative mt-4 overflow-hidden border border-[#1c1c1c]">
              <img
                src={imagePreview}
                alt="Урьдчилан харах"
                className="w-full object-contain"
                style={{ maxHeight: "480px" }}
              />
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-[rgba(3,3,3,0.7)]">
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-3 w-3 animate-pulse bg-[#cc2200]" />
                    <span className="text-[10px] uppercase tracking-[0.5px] text-[#c8c8c0]">
                      Оновчилж байна...
                    </span>
                  </div>
                </div>
              )}
              {!uploading && (
                <button
                  type="button"
                  onClick={removeImage}
                  className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center bg-[rgba(3,3,3,0.8)] text-[#c8c8c0] transition hover:bg-[#cc2200] hover:text-white"
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
              className={`mt-4 flex cursor-pointer flex-col items-center gap-2 border border-dashed py-8 transition ${
                dragOver
                  ? "border-[#cc2200] bg-[rgba(204,34,0,0.05)]"
                  : "border-[#1c1c1c] hover:border-[rgba(240,236,227,0.15)]"
              }`}
            >
              <svg className="h-6 w-6 text-[#5a5550]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-[11px] tracking-[2px] text-[#5a5550]">
                {dragOver ? "ЗУРГАА ЭНД ТАВИНА УУ" : "ЗУРАГ ДАРАХ ЭСВЭЛ ЧИРЭХ"}
              </span>
              <span className="text-[9px] text-[#3a3835]">
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

          <div className="flex items-center justify-between border-t border-[rgba(240,236,227,0.06)] pt-4 mt-4">
            <div className="flex items-center gap-4">
              <span className="text-[10px] tracking-[2px] text-[#5a5550]">
                {content.length}/2000
              </span>
              {imageUrl && (
                <span className="flex items-center gap-1 text-[10px] tracking-[2px] text-[#cc2200]">
                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Зураг бэлэн
                </span>
              )}
              {userIsAdmin && (
                <span className={`text-[9px] uppercase tracking-[1px] ${visibility === "free" ? "text-green-500" : "text-[#5a5550]"}`}>
                  {visibility === "free" ? "Нээлттэй" : "Гишүүдэд"}
                </span>
              )}
            </div>
            <button
              type="submit"
              disabled={!canPost}
              className="btn-blood !py-2 !px-6 !text-[10px]"
            >
              {loading ? "Нийтэлж байна..." : "Нийтлэх"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
