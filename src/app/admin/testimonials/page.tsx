"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

interface Testimonial {
  _id: string;
  name: string;
  avatar?: string;
  role?: string;
  result: string;
  quote?: string;
  tags?: string[];
  link?: string;
  featured: boolean;
  published: boolean;
  order: number;
  createdAt: string;
}

const EMPTY = {
  name: "",
  avatar: "",
  role: "",
  result: "",
  quote: "",
  tagsRaw: "",
  link: "",
  featured: false,
  published: true,
  order: 0,
};

async function uploadImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Upload failed");
  return data.url as string;
}

export default function AdminTestimonialsPage() {
  const [items, setItems] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);

  const showFlash = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(""), 2500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/testimonials?all=1&limit=50");
      const data = await res.json();
      setItems(data.items || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onAvatarPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      const url = await uploadImage(file);
      setForm((f) => ({ ...f, avatar: url }));
      showFlash("Зураг оруулагдлаа");
    } catch (err) {
      showFlash("Алдаа: " + (err instanceof Error ? err.message : "upload"));
    } finally {
      setAvatarUploading(false);
      if (avatarRef.current) avatarRef.current.value = "";
    }
  };

  const resetForm = () => { setForm(EMPTY); setEditingId(null); };

  const save = async () => {
    if (!form.name.trim() || !form.result.trim() || saving) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        avatar: form.avatar.trim(),
        role: form.role.trim(),
        result: form.result.trim(),
        quote: form.quote.trim(),
        tags: form.tagsRaw.split(",").map((t) => t.trim()).filter(Boolean),
        link: form.link.trim(),
        featured: form.featured,
        published: form.published,
        order: Number(form.order) || 0,
      };
      const url = editingId ? `/api/testimonials/${editingId}` : "/api/testimonials";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "save failed");
      resetForm();
      await load();
      showFlash(editingId ? "Шинэчлэгдлээ" : "Нэмэгдлээ");
    } catch (err) {
      showFlash("Алдаа: " + (err instanceof Error ? err.message : "unknown"));
    } finally {
      setSaving(false);
    }
  };

  const edit = (t: Testimonial) => {
    setEditingId(t._id);
    setForm({
      name: t.name,
      avatar: t.avatar || "",
      role: t.role || "",
      result: t.result,
      quote: t.quote || "",
      tagsRaw: (t.tags || []).join(", "),
      link: t.link || "",
      featured: t.featured,
      published: t.published,
      order: t.order,
    });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const remove = async (id: string) => {
    if (!confirm("Testimonial-г устгах уу?")) return;
    const res = await fetch(`/api/testimonials/${id}`, { method: "DELETE" });
    if (res.ok) {
      setItems((prev) => prev.filter((t) => t._id !== id));
      showFlash("Устгагдлаа");
      if (editingId === id) resetForm();
    }
  };

  const togglePublished = async (t: Testimonial) => {
    const res = await fetch(`/api/testimonials/${t._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: !t.published }),
    });
    if (res.ok) { await load(); showFlash(t.published ? "Нуусан" : "Нийтэлсэн"); }
  };

  const toggleFeatured = async (t: Testimonial) => {
    const res = await fetch(`/api/testimonials/${t._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ featured: !t.featured }),
    });
    if (res.ok) { await load(); showFlash(t.featured ? "Featured off" : "Featured on"); }
  };

  return (
    <div className="space-y-5 pb-6">
      {flash && (
        <div className="fixed top-4 right-4 z-50 rounded-[8px] border border-[rgba(255,255,255,0.08)] bg-[#1A1A1A] px-4 py-2.5 text-[13px] text-[#E8E8E8] shadow-xl">{flash}</div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#E8E8E8]">Testimonials</h1>
          <p className="mt-0.5 text-[12px] text-[#555]">Гишүүдийн үр дүн · Homepage + /clan-д social proof</p>
        </div>
        <Link href="/" target="_blank" className="rounded-[8px] bg-[#EF2C58] px-4 py-2 text-[12px] font-bold text-white">
          Homepage харах
        </Link>
      </div>

      {/* Editor */}
      <div className="rounded-[8px] border border-[rgba(255,255,255,0.06)] bg-[#141414] p-5">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#EF2C58]">
            {editingId ? "Засварлаж байна" : "Шинэ testimonial"}
          </span>
          {editingId && (
            <button onClick={resetForm} className="text-[11px] text-[#666] hover:text-[#E8E8E8]">Цуцлах</button>
          )}
        </div>

        {/* Avatar */}
        <div className="mb-4 flex items-center gap-3.5">
          <button
            type="button"
            onClick={() => avatarRef.current?.click()}
            disabled={avatarUploading}
            className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-dashed border-[rgba(255,255,255,0.12)] bg-[#0A0A0A] transition hover:border-[rgba(239,44,88,0.4)]"
          >
            {form.avatar ? (
              <img src={form.avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[#555]">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              </div>
            )}
          </button>
          <div className="leading-tight">
            <div className="text-[12px] font-bold text-[#E8E8E8]">Нүүрний зураг</div>
            <div className="text-[10px] text-[#666]">{avatarUploading ? "Байршуулж байна..." : "Дүгрэг товч дарж сонго"}</div>
          </div>
          {form.avatar && (
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, avatar: "" }))}
              className="ml-auto text-[10px] text-[#555] hover:text-[#EF4444]"
            >
              Устгах
            </button>
          )}
          <input ref={avatarRef} type="file" accept="image/*" onChange={onAvatarPick} className="hidden" />
        </div>

        <div className="space-y-2.5">
          <div className="grid gap-2.5 sm:grid-cols-2">
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Нэр · жишээ: Болор Б."
              className="rounded-[6px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2.5 text-[13px] font-bold text-[#E8E8E8] placeholder-[#444] outline-none focus:border-[#EF2C58]" maxLength={100} />
            <input value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} placeholder="Role · жишээ: AI freelancer"
              className="rounded-[6px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2.5 text-[13px] text-[#E8E8E8] placeholder-[#444] outline-none focus:border-[#EF2C58]" maxLength={100} />
          </div>
          <input value={form.result} onChange={(e) => setForm((f) => ({ ...f, result: e.target.value }))}
            placeholder='Result headline · жишээ: "Сард ₮2m нэмж олсон"'
            className="w-full rounded-[6px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2.5 text-[14px] font-bold text-[#E8E8E8] placeholder-[#444] outline-none focus:border-[#EF2C58]" maxLength={160} />
          <textarea value={form.quote} onChange={(e) => setForm((f) => ({ ...f, quote: e.target.value }))}
            placeholder='Quote body (заавал биш) · Нарийн тайлбар'
            rows={3} className="w-full resize-y rounded-[6px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2.5 text-[13px] text-[#E8E8E8] placeholder-[#444] outline-none focus:border-[#EF2C58]" maxLength={1000} />
          <div className="grid gap-2.5 sm:grid-cols-2">
            <input value={form.tagsRaw} onChange={(e) => setForm((f) => ({ ...f, tagsRaw: e.target.value }))} placeholder="Tags (comma: ai, automation)"
              className="rounded-[6px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2.5 text-[13px] text-[#E8E8E8] placeholder-[#444] outline-none focus:border-[#EF2C58]" />
            <input value={form.link} onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))} placeholder="Social / profile link (optional)"
              className="rounded-[6px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2.5 text-[13px] text-[#E8E8E8] placeholder-[#444] outline-none focus:border-[#EF2C58]" />
            <input type="number" value={form.order} onChange={(e) => setForm((f) => ({ ...f, order: Number(e.target.value) || 0 }))} placeholder="Order (lower = earlier)"
              className="rounded-[6px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2.5 text-[13px] text-[#E8E8E8] placeholder-[#444] outline-none focus:border-[#EF2C58]" />
            <div className="flex items-center gap-4 rounded-[6px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2.5">
              <label className="flex cursor-pointer items-center gap-1.5 text-[12px] text-[#AAA]">
                <input type="checkbox" checked={form.featured} onChange={(e) => setForm((f) => ({ ...f, featured: e.target.checked }))} className="accent-[#EF2C58]" />
                Featured
              </label>
              <label className="flex cursor-pointer items-center gap-1.5 text-[12px] text-[#AAA]">
                <input type="checkbox" checked={form.published} onChange={(e) => setForm((f) => ({ ...f, published: e.target.checked }))} className="accent-[#EF2C58]" />
                Published
              </label>
            </div>
          </div>

          <button onClick={save} disabled={!form.name.trim() || !form.result.trim() || saving}
            className="w-full rounded-[8px] bg-[#EF2C58] px-6 py-2.5 text-[13px] font-bold text-white transition hover:bg-[#D4264E] disabled:opacity-40">
            {saving ? "..." : editingId ? "Шинэчлэх" : "Нэмэх"}
          </button>
        </div>
      </div>

      {/* List */}
      <div className="rounded-[8px] border border-[rgba(255,255,255,0.06)] bg-[#141414] p-5">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#EF2C58]">Бүх testimonial ({items.length})</span>
          <button onClick={load} className="text-[11px] text-[#666] hover:text-[#EF2C58]">Шинэчлэх</button>
        </div>
        {loading ? (
          <div className="py-10 text-center text-[12px] text-[#555]">Ачааллаж байна...</div>
        ) : items.length === 0 ? (
          <div className="py-10 text-center text-[12px] text-[#555]">
            Testimonial байхгүй — эхний 3-ыг нэм (Homepage + /clan дээр автоматаар гарна)
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((t) => (
              <div key={t._id} className="flex items-start gap-3 rounded-[8px] border border-[rgba(255,255,255,0.06)] bg-[#0A0A0A] p-3 transition hover:border-[rgba(255,255,255,0.12)]">
                {t.avatar ? (
                  <img src={t.avatar} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[rgba(239,44,88,0.1)] text-[16px] font-black text-[#EF2C58]">
                    {t.name.charAt(0)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[13px] font-bold text-[#E8E8E8]">{t.name}</span>
                    {t.role && <span className="truncate text-[10px] text-[#666]">· {t.role}</span>}
                    {t.featured && <span className="rounded-full bg-[rgba(239,44,88,0.1)] px-1.5 py-0.5 text-[9px] font-bold text-[#EF2C58]">FEATURED</span>}
                    {!t.published && <span className="rounded-full bg-[rgba(239,68,68,0.1)] px-1.5 py-0.5 text-[9px] font-bold text-[#EF4444]">DRAFT</span>}
                    <span className="text-[10px] text-[#555]">#{t.order}</span>
                  </div>
                  <div className="mt-0.5 truncate text-[12px] font-semibold text-[#EF2C58]">{t.result}</div>
                  {t.quote && <div className="mt-0.5 line-clamp-2 text-[11px] text-[#666]">{t.quote}</div>}
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button onClick={() => toggleFeatured(t)} title={t.featured ? "Unfeature" : "Feature"}
                    className="rounded-[6px] px-2 py-1 text-[11px] font-bold text-[#AAA] transition hover:bg-[rgba(255,255,255,0.06)]">⭐</button>
                  <button onClick={() => togglePublished(t)}
                    className="rounded-[6px] px-2.5 py-1 text-[11px] font-bold text-[#AAA] transition hover:bg-[rgba(255,255,255,0.06)]">{t.published ? "Нуух" : "Нийтлэх"}</button>
                  <button onClick={() => edit(t)}
                    className="rounded-[6px] px-2.5 py-1 text-[11px] font-bold text-[#EF2C58] transition hover:bg-[rgba(239,44,88,0.08)]">Засах</button>
                  <button onClick={() => remove(t._id)}
                    className="rounded-[6px] px-2.5 py-1 text-[11px] text-[#555] transition hover:bg-[rgba(239,68,68,0.08)] hover:text-[#EF4444]">Устгах</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
