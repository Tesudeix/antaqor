"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";

export default function NewPost() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Only image files are allowed");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Image must be under 10MB");
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
        setError(data.error || "Upload failed");
        setImagePreview("");
        return;
      }
      setImageUrl(data.url);
    } catch {
      setError("Upload failed. Try again.");
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

  if (status === "loading") {
    return (
      <div className="flex justify-center py-16">
        <div className="h-3 w-3 animate-pulse rounded-full bg-[#cc2200]" />
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-2 font-[Bebas_Neue] text-4xl tracking-[4px] text-[#ede8df]">
        Create a Post
      </h1>
      <p className="mb-8 text-[11px] tracking-[2px] text-[#5a5550]">
        SHARE WITH THE DIGITAL NATION
      </p>

      {error && (
        <div className="mb-6 border-l-2 border-[#cc2200] bg-[rgba(204,34,0,0.08)] px-4 py-3 text-[12px] text-[#cc2200]">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="card p-5 md:p-6">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's on your mind? (optional with image)"
            rows={4}
            maxLength={2000}
            className="w-full resize-none border-0 bg-transparent text-[13px] leading-[1.9] text-[#ede8df] placeholder-[#5a5550] focus:outline-none"
          />

          {/* Image preview */}
          {imagePreview && (
            <div className="relative mt-4 overflow-hidden border border-[#1c1c1c]">
              <img
                src={imagePreview}
                alt="Preview"
                className="w-full object-contain"
                style={{ maxHeight: "480px" }}
              />
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-[rgba(3,3,3,0.7)]">
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-3 w-3 animate-pulse rounded-full bg-[#cc2200]" />
                    <span className="text-[10px] uppercase tracking-[3px] text-[#c8c8c0]">
                      Optimizing...
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

          {/* Upload zone */}
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
                {dragOver ? "DROP IMAGE HERE" : "CLICK OR DRAG IMAGE"}
              </span>
              <span className="text-[9px] text-[#3a3835]">
                JPEG, PNG, WebP, GIF · Max 10MB
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
                  Image ready
                </span>
              )}
            </div>
            <button
              type="submit"
              disabled={!canPost}
              className="btn-blood !py-2 !px-6 !text-[10px]"
            >
              {loading ? "Posting..." : "Post"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
