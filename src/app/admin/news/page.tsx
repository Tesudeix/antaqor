"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Category = "AI" | "LLM" | "Agents" | "Research" | "Бизнес" | "Tool" | "Монгол";

interface NewsItem {
  _id: string;
  slug: string;
  title: string;
  excerpt: string;
  content?: string;
  coverImage: string;
  category: Category;
  tags: string[];
  source: string;
  sourceUrl: string;
  authorName: string;
  authorAvatar: string;
  featured: boolean;
  published: boolean;
  views: number;
  readingMinutes: number;
  publishedAt: string;
}

const CATEGORIES: Category[] = ["AI", "LLM", "Agents", "Research", "Бизнес", "Tool", "Монгол"];
const CATEGORY_COLORS: Record<Category, string> = {
  AI: "#EF2C58",
  LLM: "#A855F7",
  Agents: "#22C55E",
  Research: "#3B82F6",
  "Бизнес": "#F59E0B",
  Tool: "#06B6D4",
  "Монгол": "#EC4899",
};

const EMPTY = {
  title: "",
  excerpt: "",
  content: "",
  coverImage: "",
  category: "AI" as Category,
  tagsRaw: "",
  source: "",
  sourceUrl: "",
  authorName: "Antaqor Editorial",
  authorAvatar: "",
  featured: false,
};

export default function AdminNewsPage() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState("");

  const showFlash = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(""), 2500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/news?limit=50");
      const data = await res.json();
      setItems(data.items || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setForm(EMPTY);
    setEditingSlug(null);
  };

  const save = async () => {
    if (!form.title.trim() || saving) return;
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        excerpt: form.excerpt.trim(),
        content: form.content.trim(),
        coverImage: form.coverImage.trim(),
        category: form.category,
        tags: form.tagsRaw
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        source: form.source.trim(),
        sourceUrl: form.sourceUrl.trim(),
        authorName: form.authorName.trim(),
        authorAvatar: form.authorAvatar.trim(),
        featured: form.featured,
      };

      const url = editingSlug ? `/api/news/${editingSlug}` : "/api/news";
      const method = editingSlug ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "save failed");

      resetForm();
      await load();
      showFlash(editingSlug ? "Шинэчлэгдлээ" : "Нийтлэгдлээ");
    } catch (err) {
      showFlash("Алдаа: " + (err instanceof Error ? err.message : "unknown"));
    } finally {
      setSaving(false);
    }
  };

  const edit = (n: NewsItem) => {
    setEditingSlug(n.slug);
    setForm({
      title: n.title,
      excerpt: n.excerpt,
      content: n.content || "",
      coverImage: n.coverImage,
      category: n.category,
      tagsRaw: (n.tags || []).join(", "),
      source: n.source,
      sourceUrl: n.sourceUrl,
      authorName: n.authorName,
      authorAvatar: n.authorAvatar,
      featured: n.featured,
    });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const loadContentForEdit = async (slug: string) => {
    try {
      const res = await fetch(`/api/news/${slug}`);
      const data = await res.json();
      if (data.news) {
        edit(data.news);
      }
    } catch {
      showFlash("Уншиж чадсангүй");
    }
  };

  const remove = async (slug: string) => {
    if (!confirm("Энэ мэдээг устгах уу?")) return;
    const res = await fetch(`/api/news/${slug}`, { method: "DELETE" });
    if (res.ok) {
      setItems((prev) => prev.filter((i) => i.slug !== slug));
      showFlash("Устгагдлаа");
      if (editingSlug === slug) resetForm();
    }
  };

  const togglePublished = async (n: NewsItem) => {
    const res = await fetch(`/api/news/${n.slug}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: !n.published }),
    });
    if (res.ok) {
      await load();
      showFlash(n.published ? "Нуусан" : "Нийтэлсэн");
    }
  };

  return (
    <div className="space-y-5 pb-6">
      {flash && (
        <div className="fixed top-4 right-4 z-50 rounded-[8px] border border-[rgba(255,255,255,0.08)] bg-[#1A1A1A] px-4 py-2.5 text-[13px] text-[#E8E8E8] shadow-xl">
          {flash}
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#E8E8E8]">AI Мэдээ</h1>
          <p className="mt-0.5 text-[12px] text-[#555555]">Public блог/мэдээний удирдлага — нэвтрээгүй хэрэглэгчдэд ил</p>
        </div>
        <Link href="/news" target="_blank" className="rounded-[8px] bg-[#EF2C58] px-4 py-2 text-[12px] font-bold text-white transition hover:bg-[#D4264E]">
          Блог харах
        </Link>
      </div>

      {/* Editor */}
      <div className="rounded-[8px] border border-[rgba(255,255,255,0.06)] bg-[#141414] p-5">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#EF2C58]">
            {editingSlug ? "Засварлаж байна" : "Шинэ мэдээ"}
          </span>
          {editingSlug && (
            <button onClick={resetForm} className="text-[11px] text-[#666] hover:text-[#E8E8E8]">
              Цуцлах
            </button>
          )}
        </div>

        <div className="space-y-3">
          <input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Гарчиг"
            maxLength={220}
            className="w-full rounded-[8px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2.5 text-[14px] font-bold text-[#E8E8E8] placeholder-[#444] outline-none transition focus:border-[#EF2C58]"
          />
          <textarea
            value={form.excerpt}
            onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))}
            placeholder="Excerpt (богино тайлбар)"
            maxLength={400}
            rows={2}
            className="w-full resize-y rounded-[8px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2.5 text-[13px] text-[#E8E8E8] placeholder-[#444] outline-none transition focus:border-[#EF2C58]"
          />
          <textarea
            value={form.content}
            onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
            placeholder={"Үндсэн контент...\n\nShift+Enter = шинэ мөр. Давхар шинэ мөр = шинэ параграф.\n\n# H2 гарчиг\n## H3 гарчиг\n> иш татсан үг"}
            rows={10}
            className="w-full resize-y rounded-[8px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2.5 text-[13px] leading-relaxed text-[#E8E8E8] placeholder-[#444] outline-none transition focus:border-[#EF2C58]"
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={form.coverImage}
              onChange={(e) => setForm((f) => ({ ...f, coverImage: e.target.value }))}
              placeholder="Cover image URL"
              className="rounded-[8px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2.5 text-[13px] text-[#E8E8E8] placeholder-[#444] outline-none transition focus:border-[#EF2C58]"
            />
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as Category }))}
              className="rounded-[8px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2.5 text-[13px] text-[#E8E8E8] outline-none focus:border-[#EF2C58]"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              value={form.tagsRaw}
              onChange={(e) => setForm((f) => ({ ...f, tagsRaw: e.target.value }))}
              placeholder="Tags (таслалаар салга: claude, opus, 4.7)"
              className="rounded-[8px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2.5 text-[13px] text-[#E8E8E8] placeholder-[#444] outline-none transition focus:border-[#EF2C58]"
            />
            <input
              value={form.source}
              onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
              placeholder="Эх сурвалжийн нэр (жишээ: Anthropic)"
              className="rounded-[8px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2.5 text-[13px] text-[#E8E8E8] placeholder-[#444] outline-none transition focus:border-[#EF2C58]"
            />
            <input
              value={form.sourceUrl}
              onChange={(e) => setForm((f) => ({ ...f, sourceUrl: e.target.value }))}
              placeholder="Эх сурвалжийн URL"
              className="rounded-[8px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2.5 text-[13px] text-[#E8E8E8] placeholder-[#444] outline-none transition focus:border-[#EF2C58]"
            />
            <input
              value={form.authorName}
              onChange={(e) => setForm((f) => ({ ...f, authorName: e.target.value }))}
              placeholder="Зохиогчийн нэр"
              className="rounded-[8px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2.5 text-[13px] text-[#E8E8E8] placeholder-[#444] outline-none transition focus:border-[#EF2C58]"
            />
          </div>

          <div className="flex items-center justify-between gap-3 pt-2">
            <label className="flex cursor-pointer items-center gap-2 text-[12px] text-[#AAA]">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(e) => setForm((f) => ({ ...f, featured: e.target.checked }))}
                className="accent-[#EF2C58]"
              />
              Featured дээр гаргах
            </label>
            <button
              onClick={save}
              disabled={!form.title.trim() || saving}
              className="rounded-[8px] bg-[#EF2C58] px-6 py-2.5 text-[13px] font-bold text-white transition hover:bg-[#D4264E] disabled:opacity-40"
            >
              {saving ? "..." : editingSlug ? "Шинэчлэх" : "Нийтлэх"}
            </button>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="rounded-[8px] border border-[rgba(255,255,255,0.06)] bg-[#141414] p-5">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#EF2C58]">Бүх мэдээ ({items.length})</span>
          <button
            onClick={load}
            className="text-[11px] text-[#666] hover:text-[#EF2C58]"
          >
            Шинэчлэх
          </button>
        </div>

        {loading ? (
          <div className="py-10 text-center text-[12px] text-[#555]">Ачааллаж байна...</div>
        ) : items.length === 0 ? (
          <div className="py-10 text-center text-[12px] text-[#555]">Мэдээ байхгүй — эхнийхийг нэм</div>
        ) : (
          <div className="space-y-2">
            {items.map((n) => (
              <div
                key={n._id}
                className="flex items-center gap-3 rounded-[8px] border border-[rgba(255,255,255,0.06)] bg-[#0A0A0A] p-3 transition hover:border-[rgba(255,255,255,0.12)]"
              >
                <div className="h-14 w-20 shrink-0 overflow-hidden rounded-[6px] bg-[#1A1A1A]">
                  {n.coverImage ? (
                    <img src={n.coverImage} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[9px] text-[#333]">no img</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase"
                      style={{ background: `${CATEGORY_COLORS[n.category]}1F`, color: CATEGORY_COLORS[n.category] }}
                    >
                      {n.category}
                    </span>
                    {n.featured && (
                      <span className="rounded-full bg-[rgba(239,44,88,0.1)] px-1.5 py-0.5 text-[9px] font-bold text-[#EF2C58]">
                        FEATURED
                      </span>
                    )}
                    {!n.published && (
                      <span className="rounded-full bg-[rgba(239,68,68,0.1)] px-1.5 py-0.5 text-[9px] font-bold text-[#EF4444]">
                        DRAFT
                      </span>
                    )}
                    <span className="text-[10px] text-[#555]">{n.views.toLocaleString()} views</span>
                  </div>
                  <div className="mt-0.5 truncate text-[13px] font-bold text-[#E8E8E8]">{n.title}</div>
                  <div className="truncate text-[11px] text-[#555]">/{n.slug}</div>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    onClick={() => togglePublished(n)}
                    className="rounded-[6px] px-2.5 py-1 text-[11px] font-bold text-[#AAA] transition hover:bg-[rgba(255,255,255,0.06)]"
                  >
                    {n.published ? "Нуух" : "Нийтлэх"}
                  </button>
                  <button
                    onClick={() => loadContentForEdit(n.slug)}
                    className="rounded-[6px] px-2.5 py-1 text-[11px] font-bold text-[#EF2C58] transition hover:bg-[rgba(239,44,88,0.08)]"
                  >
                    Засах
                  </button>
                  <button
                    onClick={() => remove(n.slug)}
                    className="rounded-[6px] px-2.5 py-1 text-[11px] text-[#555] transition hover:bg-[rgba(239,68,68,0.08)] hover:text-[#EF4444]"
                  >
                    Устгах
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
