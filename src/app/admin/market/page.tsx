"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

type Category = "Prompt" | "Course" | "Template" | "Agent" | "Service" | "Digital";

const CATEGORIES: Category[] = ["Prompt", "Course", "Template", "Agent", "Service", "Digital"];
const CATEGORY_COLORS: Record<Category, string> = {
  Prompt: "#A855F7",
  Course: "#22C55E",
  Template: "#06B6D4",
  Agent: "#F59E0B",
  Service: "#EC4899",
  Digital: "#3B82F6",
};

interface Product {
  _id: string;
  title: string;
  slug: string;
  summary: string;
  description?: string;
  coverImage: string;
  category: Category;
  price: number;
  compareAtPrice: number;
  tags: string[];
  sellerName: string;
  sellerAvatar: string;
  externalUrl: string;
  featured: boolean;
  published: boolean;
  approved: boolean;
  views: number;
  clicks: number;
}

const EMPTY = {
  title: "",
  summary: "",
  description: "",
  coverImage: "",
  category: "Prompt" as Category,
  price: "0",
  compareAtPrice: "0",
  tagsRaw: "",
  sellerName: "Antaqor",
  sellerAvatar: "",
  externalUrl: "",
  featured: false,
};

async function uploadImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Upload failed");
  return data.url as string;
}

export default function AdminMarketPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState("");
  const [coverUploading, setCoverUploading] = useState(false);
  const coverRef = useRef<HTMLInputElement>(null);

  const showFlash = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(""), 2500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/market?limit=50");
      const data = await res.json();
      setItems(data.items || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onCoverPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverUploading(true);
    try {
      const url = await uploadImage(file);
      setForm((f) => ({ ...f, coverImage: url }));
      showFlash("Cover оруулагдлаа");
    } catch (err) {
      showFlash("Алдаа: " + (err instanceof Error ? err.message : "upload"));
    } finally {
      setCoverUploading(false);
      if (coverRef.current) coverRef.current.value = "";
    }
  };

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
        summary: form.summary.trim(),
        description: form.description.trim(),
        coverImage: form.coverImage.trim(),
        category: form.category,
        price: Math.max(0, Number(form.price) || 0),
        compareAtPrice: Math.max(0, Number(form.compareAtPrice) || 0),
        tags: form.tagsRaw.split(",").map((t) => t.trim()).filter(Boolean),
        sellerName: form.sellerName.trim(),
        sellerAvatar: form.sellerAvatar.trim(),
        externalUrl: form.externalUrl.trim(),
        featured: form.featured,
      };
      const url = editingSlug ? `/api/market/${editingSlug}` : "/api/market";
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

  const edit = async (slug: string) => {
    try {
      const res = await fetch(`/api/market/${slug}`);
      const data = await res.json();
      const n = data.product as Product;
      if (!n) return;
      setEditingSlug(n.slug);
      setForm({
        title: n.title,
        summary: n.summary || "",
        description: n.description || "",
        coverImage: n.coverImage,
        category: n.category,
        price: String(n.price || 0),
        compareAtPrice: String(n.compareAtPrice || 0),
        tagsRaw: (n.tags || []).join(", "),
        sellerName: n.sellerName || "Antaqor",
        sellerAvatar: n.sellerAvatar || "",
        externalUrl: n.externalUrl || "",
        featured: !!n.featured,
      });
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      showFlash("Уншиж чадсангүй");
    }
  };

  const remove = async (slug: string) => {
    if (!confirm("Устгах уу?")) return;
    const res = await fetch(`/api/market/${slug}`, { method: "DELETE" });
    if (res.ok) {
      setItems((prev) => prev.filter((i) => i.slug !== slug));
      showFlash("Устгагдлаа");
      if (editingSlug === slug) resetForm();
    }
  };

  const togglePublished = async (p: Product) => {
    const res = await fetch(`/api/market/${p.slug}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: !p.published }),
    });
    if (res.ok) { await load(); showFlash(p.published ? "Нуусан" : "Нийтэлсэн"); }
  };

  const toggleFeatured = async (p: Product) => {
    const res = await fetch(`/api/market/${p.slug}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ featured: !p.featured }),
    });
    if (res.ok) { await load(); showFlash(p.featured ? "Featured off" : "Featured on"); }
  };

  return (
    <div className="space-y-5 pb-6">
      {flash && (
        <div className="fixed top-4 right-4 z-50 rounded-[8px] border border-[rgba(255,255,255,0.08)] bg-[#1A1A1A] px-4 py-2.5 text-[13px] text-[#E8E8E8] shadow-xl">{flash}</div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#E8E8E8]">Market</h1>
          <p className="mt-0.5 text-[12px] text-[#555]">Marketplace listing management · public catalog</p>
        </div>
        <Link href="/market" target="_blank" className="rounded-[8px] bg-[#EF2C58] px-4 py-2 text-[12px] font-bold text-white transition hover:bg-[#D4264E]">
          Market харах
        </Link>
      </div>

      {/* Editor */}
      <div className="rounded-[8px] border border-[rgba(255,255,255,0.06)] bg-[#141414] p-5">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#EF2C58]">
            {editingSlug ? "Засварлаж байна" : "Шинэ бүтээгдэхүүн"}
          </span>
          {editingSlug && (
            <button onClick={resetForm} className="text-[11px] text-[#666] hover:text-[#E8E8E8]">Цуцлах</button>
          )}
        </div>

        <div className="space-y-3">
          <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Гарчиг" maxLength={200}
            className="w-full rounded-[8px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2.5 text-[14px] font-bold text-[#E8E8E8] placeholder-[#444] outline-none focus:border-[#EF2C58]" />
          <textarea value={form.summary} onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))} placeholder="Summary (богино)" maxLength={300} rows={2}
            className="w-full resize-y rounded-[8px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2.5 text-[13px] text-[#E8E8E8] placeholder-[#444] outline-none focus:border-[#EF2C58]" />
          <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Дэлгэрэнгүй тайлбар..." rows={6}
            className="w-full resize-y rounded-[8px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2.5 text-[13px] leading-relaxed text-[#E8E8E8] placeholder-[#444] outline-none focus:border-[#EF2C58]" />

          {/* Cover */}
          <div className="rounded-[8px] border border-dashed border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#555]">Cover зураг</span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => coverRef.current?.click()} disabled={coverUploading}
                  className="rounded-[6px] border border-[rgba(255,255,255,0.08)] bg-[#141414] px-2.5 py-1 text-[10px] font-bold text-[#AAA] transition hover:text-[#EF2C58] disabled:opacity-50">
                  {coverUploading ? "Байршуулж..." : form.coverImage ? "Солих" : "Сонгох"}
                </button>
                {form.coverImage && (
                  <button type="button" onClick={() => setForm((f) => ({ ...f, coverImage: "" }))} className="text-[10px] text-[#555] hover:text-[#EF4444]">Устгах</button>
                )}
                <input ref={coverRef} type="file" accept="image/*" onChange={onCoverPick} className="hidden" />
              </div>
            </div>
            {form.coverImage ? (
              <div className="relative aspect-[4/3] max-w-[280px] overflow-hidden rounded-[6px] bg-[#141414]">
                <img src={form.coverImage} alt="" className="h-full w-full object-cover" />
              </div>
            ) : (
              <div className="py-4 text-center text-[11px] text-[#444]">JPG / PNG / WebP · max 10MB</div>
            )}
            <input value={form.coverImage} onChange={(e) => setForm((f) => ({ ...f, coverImage: e.target.value }))} placeholder="эсвэл URL"
              className="mt-2 w-full rounded-[6px] border border-[rgba(255,255,255,0.06)] bg-[#141414] px-2.5 py-1.5 text-[11px] text-[#AAA] placeholder-[#333] outline-none focus:border-[rgba(239,44,88,0.3)]" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as Category }))}
              className="rounded-[8px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2.5 text-[13px] text-[#E8E8E8] outline-none focus:border-[#EF2C58]">
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input value={form.tagsRaw} onChange={(e) => setForm((f) => ({ ...f, tagsRaw: e.target.value }))} placeholder="Tags (comma-separated)"
              className="rounded-[8px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2.5 text-[13px] text-[#E8E8E8] placeholder-[#444] outline-none focus:border-[#EF2C58]" />
            <input value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} type="number" min={0} placeholder="Үнэ (MNT)"
              className="rounded-[8px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2.5 text-[13px] text-[#E8E8E8] placeholder-[#444] outline-none focus:border-[#EF2C58]" />
            <input value={form.compareAtPrice} onChange={(e) => setForm((f) => ({ ...f, compareAtPrice: e.target.value }))} type="number" min={0} placeholder="Хуучин үнэ (discount badge)"
              className="rounded-[8px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2.5 text-[13px] text-[#E8E8E8] placeholder-[#444] outline-none focus:border-[#EF2C58]" />
            <input value={form.sellerName} onChange={(e) => setForm((f) => ({ ...f, sellerName: e.target.value }))} placeholder="Seller name"
              className="rounded-[8px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2.5 text-[13px] text-[#E8E8E8] placeholder-[#444] outline-none focus:border-[#EF2C58]" />
            <input value={form.sellerAvatar} onChange={(e) => setForm((f) => ({ ...f, sellerAvatar: e.target.value }))} placeholder="Seller avatar URL"
              className="rounded-[8px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2.5 text-[13px] text-[#E8E8E8] placeholder-[#444] outline-none focus:border-[#EF2C58]" />
            <input value={form.externalUrl} onChange={(e) => setForm((f) => ({ ...f, externalUrl: e.target.value }))} placeholder="Checkout URL (Stripe, Gumroad, etc)"
              className="sm:col-span-2 rounded-[8px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2.5 text-[13px] text-[#E8E8E8] placeholder-[#444] outline-none focus:border-[#EF2C58]" />
          </div>

          <div className="flex items-center justify-between gap-3 pt-2">
            <label className="flex cursor-pointer items-center gap-2 text-[12px] text-[#AAA]">
              <input type="checkbox" checked={form.featured} onChange={(e) => setForm((f) => ({ ...f, featured: e.target.checked }))} className="accent-[#EF2C58]" />
              Featured
            </label>
            <button onClick={save} disabled={!form.title.trim() || saving}
              className="rounded-[8px] bg-[#EF2C58] px-6 py-2.5 text-[13px] font-bold text-white transition hover:bg-[#D4264E] disabled:opacity-40">
              {saving ? "..." : editingSlug ? "Шинэчлэх" : "Нийтлэх"}
            </button>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="rounded-[8px] border border-[rgba(255,255,255,0.06)] bg-[#141414] p-5">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#EF2C58]">Бүх бүтээгдэхүүн ({items.length})</span>
          <button onClick={load} className="text-[11px] text-[#666] hover:text-[#EF2C58]">Шинэчлэх</button>
        </div>
        {loading ? (
          <div className="py-10 text-center text-[12px] text-[#555]">Ачааллаж байна...</div>
        ) : items.length === 0 ? (
          <div className="py-10 text-center text-[12px] text-[#555]">Бүтээгдэхүүн байхгүй</div>
        ) : (
          <div className="space-y-2">
            {items.map((p) => (
              <div key={p._id} className="flex items-center gap-3 rounded-[8px] border border-[rgba(255,255,255,0.06)] bg-[#0A0A0A] p-3 transition hover:border-[rgba(255,255,255,0.12)]">
                <div className="h-14 w-20 shrink-0 overflow-hidden rounded-[6px] bg-[#1A1A1A]">
                  {p.coverImage ? <img src={p.coverImage} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-[9px] text-[#333]">no img</div>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase" style={{ background: `${CATEGORY_COLORS[p.category]}1F`, color: CATEGORY_COLORS[p.category] }}>{p.category}</span>
                    {p.featured && <span className="rounded-full bg-[rgba(239,44,88,0.1)] px-1.5 py-0.5 text-[9px] font-bold text-[#EF2C58]">FEATURED</span>}
                    {!p.published && <span className="rounded-full bg-[rgba(239,68,68,0.1)] px-1.5 py-0.5 text-[9px] font-bold text-[#EF4444]">DRAFT</span>}
                    <span className="text-[10px] text-[#555]">{p.views} view · {p.clicks} click · ₮{p.price.toLocaleString()}</span>
                  </div>
                  <div className="mt-0.5 truncate text-[13px] font-bold text-[#E8E8E8]">{p.title}</div>
                  <div className="truncate text-[11px] text-[#555]">/{p.slug} · by {p.sellerName}</div>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button onClick={() => toggleFeatured(p)} className="rounded-[6px] px-2 py-1 text-[11px] font-bold text-[#AAA] transition hover:bg-[rgba(255,255,255,0.06)]">⭐</button>
                  <button onClick={() => togglePublished(p)} className="rounded-[6px] px-2.5 py-1 text-[11px] font-bold text-[#AAA] transition hover:bg-[rgba(255,255,255,0.06)]">{p.published ? "Нуух" : "Нийтлэх"}</button>
                  <button onClick={() => edit(p.slug)} className="rounded-[6px] px-2.5 py-1 text-[11px] font-bold text-[#EF2C58] transition hover:bg-[rgba(239,44,88,0.08)]">Засах</button>
                  <button onClick={() => remove(p.slug)} className="rounded-[6px] px-2.5 py-1 text-[11px] text-[#555] transition hover:bg-[rgba(239,68,68,0.08)] hover:text-[#EF4444]">Устгах</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
