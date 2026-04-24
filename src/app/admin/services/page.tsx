"use client";

import { useEffect, useState, useCallback } from "react";

interface ServiceData {
  _id: string;
  name: string;
  slug: string;
  description: string;
  logo: string;
  coverImage: string;
  category: string;
  url: string;
  domain: string;
  status: "active" | "coming_soon" | "inactive";
  featured: boolean;
  order: number;
  tags: string[];
  stats: { users?: number; rating?: number };
}

const EMPTY_FORM = {
  name: "",
  slug: "",
  description: "",
  logo: "",
  coverImage: "",
  category: "Технологи",
  url: "",
  domain: "",
  status: "active" as "active" | "coming_soon" | "inactive",
  featured: false,
  order: 10,
  tags: "",
  ratingStr: "",
};

const CATEGORIES = ["Зугаа цэнгэл", "Боловсрол", "Технологи", "AI & Automation", "Бизнес"];
const STATUSES = [
  { value: "active", label: "Active", color: "text-green-400" },
  { value: "coming_soon", label: "Coming Soon", color: "text-[#EF2C58]" },
  { value: "inactive", label: "Inactive", color: "text-red-400" },
];

export default function AdminServicesPage() {
  const [services, setServices] = useState<ServiceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const loadServices = useCallback(async () => {
    try {
      const res = await fetch("/api/services");
      if (res.ok) {
        const data = await res.json();
        setServices(data.services || []);
      }
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadServices(); }, [loadServices]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditing(null);
    setShowForm(false);
  };

  const startEdit = (s: ServiceData) => {
    setEditing(s._id);
    setForm({
      name: s.name,
      slug: s.slug,
      description: s.description,
      logo: s.logo || "",
      coverImage: s.coverImage || "",
      category: s.category,
      url: s.url,
      domain: s.domain || "",
      status: s.status,
      featured: s.featured,
      order: s.order || 10,
      tags: s.tags?.join(", ") || "",
      ratingStr: s.stats?.rating?.toString() || "",
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.slug.trim() || saving) return;
    setSaving(true);
    setMsg(null);

    const body = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      description: form.description.trim(),
      logo: form.logo.trim(),
      coverImage: form.coverImage.trim(),
      category: form.category,
      url: form.url.trim(),
      domain: form.domain.trim(),
      status: form.status,
      featured: form.featured,
      order: form.order,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      stats: { rating: form.ratingStr ? parseFloat(form.ratingStr) : 0 },
    };

    try {
      const isEdit = !!editing;
      const url = isEdit ? `/api/services/${editing}` : "/api/services";
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");

      if (isEdit) {
        setServices((prev) => prev.map((s) => (s._id === editing ? data.service : s)));
      } else {
        setServices((prev) => [...prev, data.service]);
      }
      resetForm();
      setMsg(isEdit ? "Шинэчлэгдлээ!" : "Нэмэгдлээ!");
      setTimeout(() => setMsg(null), 3000);
    } catch (err) {
      setMsg(`Алдаа: ${err instanceof Error ? err.message : "Failed"}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Устгах уу?")) return;
    try {
      await fetch(`/api/services/${id}`, { method: "DELETE" });
      setServices((prev) => prev.filter((s) => s._id !== id));
    } catch {}
  };

  const inputClass = "w-full rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2.5 text-[13px] text-[#E8E8E8] outline-none transition focus:border-[rgba(239,44,88,0.4)] placeholder:text-[#999999]";
  const selectClass = "rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2.5 text-[13px] text-[#E8E8E8] outline-none transition focus:border-[rgba(239,44,88,0.4)]";

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin border-2 border-[#EF2C58] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl tracking-[2px]">
            ҮЙЛЧИЛГЭЭ <span className="text-[#EF2C58]">УДИРДЛАГА</span>
          </h1>
          <p className="mt-1 text-[11px] text-[#999999]">
            {services.length} үйлчилгээ бүртгэгдсэн
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="rounded-[4px] bg-[#EF2C58] px-5 py-2.5 text-[12px] font-bold text-[#F8F8F6] transition hover:shadow-[0_0_24px_rgba(239,44,88,0.25)]"
        >
          + Нэмэх
        </button>
      </div>

      {msg && (
        <div className={`rounded-[4px] px-4 py-2.5 text-[12px] font-medium ${msg.startsWith("Алдаа") ? "border border-red-900/50 bg-red-950/30 text-red-400" : "border border-green-900/50 bg-green-950/30 text-green-400"}`}>
          {msg}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#141414] p-5 space-y-3">
          <div className="text-[10px] uppercase tracking-[2px] text-[#EF2C58] mb-2">
            {editing ? "Засварлах" : "Шинэ үйлчилгээ"}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Нэр"
              className={inputClass}
            />
            <input
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              placeholder="Slug (жиш: joybilliard)"
              className={inputClass}
            />
          </div>

          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Тайлбар"
            className={`${inputClass} min-h-[70px] resize-y`}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={form.url}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              placeholder="URL (https://...)"
              className={inputClass}
            />
            <input
              value={form.domain}
              onChange={(e) => setForm((f) => ({ ...f, domain: e.target.value }))}
              placeholder="Domain (жиш: joybilliard.mn)"
              className={inputClass}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={form.logo}
              onChange={(e) => setForm((f) => ({ ...f, logo: e.target.value }))}
              placeholder="Лого URL (заавал биш)"
              className={inputClass}
            />
            <input
              value={form.coverImage}
              onChange={(e) => setForm((f) => ({ ...f, coverImage: e.target.value }))}
              placeholder="Cover зураг URL (заавал биш)"
              className={inputClass}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className={selectClass}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ServiceData["status"] }))}
              className={selectClass}
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>

            <input
              type="number"
              value={form.order}
              onChange={(e) => setForm((f) => ({ ...f, order: parseInt(e.target.value) || 0 }))}
              placeholder="Order"
              className={`${inputClass} w-20`}
            />

            <input
              value={form.ratingStr}
              onChange={(e) => setForm((f) => ({ ...f, ratingStr: e.target.value }))}
              placeholder="Rating"
              className={`${inputClass} w-20`}
            />

            <label className="flex items-center gap-1.5 text-[11px] text-[#CCCCCC] cursor-pointer">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(e) => setForm((f) => ({ ...f, featured: e.target.checked }))}
                className="accent-[#EF2C58]"
              />
              Featured
            </label>
          </div>

          <input
            value={form.tags}
            onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
            placeholder="Tags (таслалаар: billiard, karaoke, vip)"
            className={inputClass}
          />

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={!form.name.trim() || !form.slug.trim() || saving}
              className="rounded-[4px] bg-[#EF2C58] px-5 py-2.5 text-[12px] font-bold text-[#F8F8F6] transition hover:shadow-[0_0_24px_rgba(239,44,88,0.25)] disabled:opacity-40"
            >
              {saving ? "Хадгалж байна..." : editing ? "Шинэчлэх" : "Нэмэх"}
            </button>
            <button
              onClick={resetForm}
              className="rounded-[4px] border border-[rgba(255,255,255,0.08)] px-4 py-2.5 text-[12px] text-[#999999] transition hover:text-[#CCCCCC]"
            >
              Болих
            </button>
          </div>
        </div>
      )}

      {/* Services list */}
      <div className="space-y-2">
        {services.map((s) => {
          const statusInfo = STATUSES.find((st) => st.value === s.status);
          return (
            <div key={s._id} className="flex items-center gap-4 rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#141414] p-4">
              {/* Icon */}
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[4px] bg-[#E8E8E6] text-[14px] font-black text-[#EF2C58]">
                {s.name.charAt(0)}
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-bold text-[#E8E8E8]">{s.name}</span>
                  {s.featured && (
                    <span className="rounded-[4px] bg-[rgba(239,44,88,0.12)] px-1.5 py-0.5 text-[8px] font-black text-[#EF2C58]">
                      FEATURED
                    </span>
                  )}
                  <span className={`text-[10px] font-bold ${statusInfo?.color || "text-[#999999]"}`}>
                    {statusInfo?.label}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] text-[#999999]">{s.category}</span>
                  {s.domain && <span className="text-[11px] text-[#999999]">· {s.domain}</span>}
                  <span className="text-[10px] text-[#999999]">order: {s.order}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => startEdit(s)}
                  className="rounded-[4px] border border-[rgba(255,255,255,0.08)] px-3 py-1.5 text-[11px] text-[#EF2C58] transition hover:border-[rgba(239,44,88,0.3)]"
                >
                  Засах
                </button>
                <button
                  onClick={() => handleDelete(s._id)}
                  className="rounded-[4px] border border-[rgba(255,255,255,0.08)] px-3 py-1.5 text-[11px] text-red-400 transition hover:border-red-900/50"
                >
                  Устгах
                </button>
              </div>
            </div>
          );
        })}
        {services.length === 0 && (
          <p className="py-10 text-center text-[13px] text-[#999999]">Үйлчилгээ бүртгэгдээгүй</p>
        )}
      </div>
    </div>
  );
}
