"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useRef } from "react";
import PaywallGate from "@/components/PaywallGate";
import RichEditor from "@/components/RichEditor";

export default function NewPost() {
  return (
    <PaywallGate>
      <NewPostContent />
    </PaywallGate>
  );
}

const AI_MODELS = ["GPT-4o", "GPT-4", "GPT-3.5", "Claude Opus", "Claude Sonnet", "Claude Haiku", "Gemini Pro", "Gemini Ultra", "Llama 3", "Mistral", "DeepSeek", "Grok", "Бусад"];
const PROMPT_TAGS = ["System Prompt", "Creative", "Coding", "Data Analysis", "Writing", "Translation", "Business", "Marketing", "Education", "Research", "Roleplay", "Image Gen", "Automation", "Workflow", "Debugging", "Summarization"];

function NewPostContent() {
  const { data: session } = useSession();
  const router = useRouter();
  const [category, setCategory] = useState<"мэдээлэл" | "ялалт" | "prompt">("мэдээлэл");
  const [content, setContent] = useState("");
  const [richContent, setRichContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Prompt specific
  const [promptTitle, setPromptTitle] = useState("");
  const [promptModel, setPromptModel] = useState("");
  const [promptTags, setPromptTags] = useState<string[]>([]);

  const isPrompt = category === "prompt";

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) { setError("Зөвхөн зургийн файл"); return; }
    if (file.size > 10 * 1024 * 1024) { setError("Зураг 10MB-с бага байх ёстой"); return; }
    setError("");
    setImagePreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Оруулах амжилтгүй"); setImagePreview(""); return; }
      setImageUrl(data.url);
    } catch { setError("Оруулах амжилтгүй"); setImagePreview(""); } finally { setUploading(false); }
  };

  const handleImageUpload = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Upload failed");
    return data.url;
  };

  const removeImage = () => { setImageUrl(""); setImagePreview(""); if (fileRef.current) fileRef.current.value = ""; };

  const hasContent = isPrompt
    ? (richContent.trim().length > 0 && richContent !== "<br>" && richContent !== "<p><br></p>")
    : (content.trim().length > 0 || imageUrl);
  const canPost = !loading && !uploading && hasContent;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canPost) return;
    if (isPrompt && !promptTitle.trim()) { setError("Prompt-н гарчиг шаардлагатай"); return; }

    setError("");
    setLoading(true);
    try {
      const body: Record<string, unknown> = { category };
      if (isPrompt) {
        body.richContent = richContent;
        body.content = promptTitle;
        body.promptData = { title: promptTitle, model: promptModel, tags: promptTags };
        if (imageUrl) body.image = imageUrl;
      } else {
        body.content = content.trim();
        body.image = imageUrl;
      }

      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      router.push("/");
    } finally { setLoading(false); }
  };

  if (!session) return null;

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#eeeee8]">Пост үүсгэх</h1>
        <p className="mt-1 text-[12px] text-[#6a6a72]">Cyber Empire community-тэй хуваалцаарай</p>
      </div>

      {error && (
        <div className="mb-5 rounded-[8px] border border-[rgba(239,68,68,0.2)] bg-[rgba(239,68,68,0.06)] px-4 py-3 text-[12px] text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Category selector */}
        <div className="mb-5 flex items-center gap-2">
          {([
            { key: "мэдээлэл" as const, label: "Мэдээлэл", icon: "📢" },
            { key: "ялалт" as const, label: "Ялалт", icon: "🏆" },
            { key: "prompt" as const, label: "Prompt Lab", icon: "🧠" },
          ]).map(cat => (
            <button
              key={cat.key}
              type="button"
              onClick={() => setCategory(cat.key)}
              className={`inline-flex items-center gap-1.5 rounded-[8px] px-4 py-2 text-[12px] font-semibold transition ${
                category === cat.key
                  ? "bg-[rgba(255,211,0,0.1)] text-[#FFD300] border border-[rgba(255,211,0,0.3)]"
                  : "text-[#6a6a72] border border-[#2a2a2e] hover:text-[#eeeee8] hover:border-[#3a3a48]"
              }`}
            >
              <span>{cat.icon}</span> {cat.label}
            </button>
          ))}
        </div>

        {/* ═══ PROMPT MODE ═══ */}
        {isPrompt ? (
          <div className="space-y-4">
            {/* Prompt header card */}
            <div className="rounded-[14px] border border-[rgba(255,211,0,0.12)] bg-[#1a1a1e] overflow-hidden">
              <div className="border-b border-[rgba(255,211,0,0.08)] bg-[rgba(255,211,0,0.03)] px-5 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-[16px]">🧠</span>
                  <span className="text-[13px] font-bold text-[#eeeee8]">Prompt Lab</span>
                  <span className="text-[11px] text-[#4a4a55]">Share prompts with the community</span>
                </div>
              </div>
              <div className="p-5 space-y-4">
                {/* Title */}
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[#6a6a72]">Prompt гарчиг *</label>
                  <input
                    value={promptTitle}
                    onChange={(e) => setPromptTitle(e.target.value)}
                    placeholder="E.g., Code Review Assistant, Blog Post Generator..."
                    className="w-full rounded-[8px] border border-[#2a2a2e] bg-[#141416] px-4 py-2.5 text-[14px] text-[#eeeee8] placeholder-[#4a4a55] outline-none transition focus:border-[rgba(255,211,0,0.4)]"
                  />
                </div>

                {/* Model */}
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[#6a6a72]">AI Model</label>
                  <div className="flex flex-wrap gap-1.5">
                    {AI_MODELS.map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setPromptModel(promptModel === m ? "" : m)}
                        className={`rounded-[6px] px-2.5 py-1 text-[11px] font-medium transition ${
                          promptModel === m
                            ? "bg-[rgba(255,211,0,0.12)] text-[#FFD300] border border-[rgba(255,211,0,0.25)]"
                            : "text-[#6a6a72] border border-[#2a2a2e] hover:text-[#eeeee8] hover:border-[#3a3a48]"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[#6a6a72]">Tags</label>
                  <div className="flex flex-wrap gap-1.5">
                    {PROMPT_TAGS.map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setPromptTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])}
                        className={`rounded-[6px] px-2.5 py-1 text-[11px] font-medium transition ${
                          promptTags.includes(tag)
                            ? "bg-[rgba(168,85,247,0.12)] text-[#a855f7] border border-[rgba(168,85,247,0.25)]"
                            : "text-[#6a6a72] border border-[#2a2a2e] hover:text-[#eeeee8] hover:border-[#3a3a48]"
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Rich editor for prompt content */}
            <div>
              <label className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#6a6a72]">
                <span className="text-[13px]">📝</span> Prompt агуулга
              </label>
              <RichEditor
                value={richContent}
                onChange={setRichContent}
                placeholder="Use Prompt Lab templates from the toolbar: System Prompt, User Prompt, Assistant blocks... Add descriptions, examples, tips, and structure your prompt for maximum value."
                onImageUpload={handleImageUpload}
              />
            </div>

            {/* Optional image */}
            {imagePreview ? (
              <div className="relative overflow-hidden rounded-[10px] border border-[#2a2a2e]">
                <img src={imagePreview} alt="" className="w-full object-contain" style={{ maxHeight: 300 }} />
                {!uploading && (
                  <button type="button" onClick={removeImage} className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white/60 hover:text-white transition">
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-2 rounded-[8px] border border-dashed border-[#2a2a2e] px-4 py-2.5 text-[12px] text-[#6a6a72] transition hover:border-[rgba(255,211,0,0.2)] hover:text-[#eeeee8]">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                Screenshot нэмэх (заавал биш)
              </button>
            )}
          </div>
        ) : (
          /* ═══ REGULAR POST MODE ═══ */
          <div className="rounded-[14px] border border-[rgba(255,255,255,0.04)] bg-[#1a1a1e] overflow-hidden">
            <div className="p-5">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Та юу бодож байна? 💭"
                rows={4}
                maxLength={5000}
                className="w-full resize-none border-0 bg-transparent text-[14px] leading-[1.8] text-[#eeeee8] placeholder-[#4a4a55] focus:outline-none"
              />

              {imagePreview ? (
                <div className="relative mt-4 overflow-hidden rounded-[10px] border border-[#2a2a2e]">
                  <img src={imagePreview} alt="" className="w-full object-contain" style={{ maxHeight: 480 }} />
                  {uploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                      <div className="h-3 w-3 animate-pulse rounded-full bg-[#FFD300]" />
                    </div>
                  )}
                  {!uploading && (
                    <button type="button" onClick={removeImage} className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white/60 hover:text-white transition">
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  )}
                </div>
              ) : (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                  onClick={() => fileRef.current?.click()}
                  className={`mt-4 flex cursor-pointer flex-col items-center gap-2 rounded-[10px] border border-dashed py-8 transition ${
                    dragOver ? "border-[#FFD300] bg-[rgba(255,211,0,0.03)]" : "border-[#2a2a2e] hover:border-[#3a3a48]"
                  }`}
                >
                  <svg className="h-6 w-6 text-[#3a3a48]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-[11px] text-[#4a4a55]">Зураг дарах эсвэл чирэх</span>
                  <span className="text-[9px] text-[#3a3a42]">JPEG, PNG, WebP, GIF &middot; 10MB хүртэл</span>
                </div>
              )}
            </div>
          </div>
        )}

        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} className="hidden" />

        {/* Submit bar */}
        <div className="mt-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {!isPrompt && <span className="text-[11px] tabular-nums text-[#4a4a55]">{content.length}/5000</span>}
            {imageUrl && <span className="text-[11px] text-[#00e676]">Зураг бэлэн</span>}
          </div>
          <button type="submit" disabled={!canPost} className="rounded-[8px] bg-[#FFD300] px-6 py-2.5 text-[13px] font-semibold text-black transition hover:bg-[#e6be00] disabled:opacity-40">
            {loading ? "Нийтэлж байна..." : isPrompt ? "🧠 Prompt нийтлэх" : "Нийтлэх"}
          </button>
        </div>
      </form>
    </div>
  );
}
