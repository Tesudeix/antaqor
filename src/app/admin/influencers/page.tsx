"use client";

import { useEffect, useState, useCallback } from "react";

interface InfluencerData {
  _id: string;
  name: string;
  slug: string;
  bio: string;
  avatar: string;
  coverImage: string;
  category: string;
  socials: { instagram?: string; tiktok?: string; youtube?: string; facebook?: string; twitter?: string };
  stats: { followers: number; engagement: number; avgViews: number; avgLikes: number };
  pricing: { story: number; post: number; reel: number; campaign: number };
  tags: string[];
  status: "active" | "pending" | "inactive";
  featured: boolean;
  verified: boolean;
  order: number;
  contactEmail: string;
  contactPhone: string;
  portfolio: string[];
}

const EMPTY_FORM = {
  name: "", slug: "", bio: "", avatar: "", coverImage: "", category: "Lifestyle",
  instagram: "", tiktok: "", youtube: "", facebook: "", twitter: "",
  followers: "", engagement: "", avgViews: "", avgLikes: "",
  pStory: "", pPost: "", pReel: "", pCampaign: "",
  tags: "", status: "active" as "active" | "pending" | "inactive",
  featured: false, verified: false, order: 0,
  contactEmail: "", contactPhone: "", portfolio: "",
};

const CATEGORIES = ["Lifestyle", "Fashion", "Tech", "Food", "Travel", "Fitness", "Gaming", "Beauty", "Business", "Music", "Comedy"];
const STATUSES = [
  { value: "active", label: "Active", color: "text-green-400" },
  { value: "pending", label: "Pending", color: "text-yellow-400" },
  { value: "inactive", label: "Inactive", color: "text-red-400" },
];

function formatNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

export default function AdminInfluencersPage() {
  const [influencers, setInfluencers] = useState<InfluencerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/influencers?all=true");
      if (res.ok) {
        const data = await res.json();
        setInfluencers(data.influencers || []);
      }
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => { setForm(EMPTY_FORM); setEditing(null); setShowForm(false); };

  const startEdit = (inf: InfluencerData) => {
    setEditing(inf._id);
    setForm({
      name: inf.name, slug: inf.slug, bio: inf.bio, avatar: inf.avatar || "",
      coverImage: inf.coverImage || "", category: inf.category,
      instagram: inf.socials?.instagram || "", tiktok: inf.socials?.tiktok || "",
      youtube: inf.socials?.youtube || "", facebook: inf.socials?.facebook || "",
      twitter: inf.socials?.twitter || "",
      followers: inf.stats?.followers?.toString() || "",
      engagement: inf.stats?.engagement?.toString() || "",
      avgViews: inf.stats?.avgViews?.toString() || "",
      avgLikes: inf.stats?.avgLikes?.toString() || "",
      pStory: inf.pricing?.story?.toString() || "",
      pPost: inf.pricing?.post?.toString() || "",
      pReel: inf.pricing?.reel?.toString() || "",
      pCampaign: inf.pricing?.campaign?.toString() || "",
      tags: inf.tags?.join(", ") || "",
      status: inf.status, featured: inf.featured, verified: inf.verified,
      order: inf.order || 0,
      contactEmail: inf.contactEmail || "", contactPhone: inf.contactPhone || "",
      portfolio: inf.portfolio?.join(", ") || "",
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.slug.trim() || saving) return;
    setSaving(true); setMsg(null);

    const body = {
      name: form.name.trim(), slug: form.slug.trim(), bio: form.bio.trim(),
      avatar: form.avatar.trim(), coverImage: form.coverImage.trim(),
      category: form.category,
      socials: {
        instagram: form.instagram.trim(), tiktok: form.tiktok.trim(),
        youtube: form.youtube.trim(), facebook: form.facebook.trim(),
        twitter: form.twitter.trim(),
      },
      stats: {
        followers: parseInt(form.followers) || 0,
        engagement: parseFloat(form.engagement) || 0,
        avgViews: parseInt(form.avgViews) || 0,
        avgLikes: parseInt(form.avgLikes) || 0,
      },
      pricing: {
        story: parseInt(form.pStory) || 0, post: parseInt(form.pPost) || 0,
        reel: parseInt(form.pReel) || 0, campaign: parseInt(form.pCampaign) || 0,
      },
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      status: form.status, featured: form.featured, verified: form.verified,
      order: form.order,
      contactEmail: form.contactEmail.trim(), contactPhone: form.contactPhone.trim(),
      portfolio: form.portfolio.split(",").map((t) => t.trim()).filter(Boolean),
    };

    try {
      const isEdit = !!editing;
      const url = isEdit ? `/api/influencers/${editing}` : "/api/influencers";
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");

      if (isEdit) {
        setInfluencers((prev) => prev.map((i) => (i._id === editing ? data.influencer : i)));
      } else {
        setInfluencers((prev) => [...prev, data.influencer]);
      }
      resetForm();
      setMsg(isEdit ? "Шинэчлэгдлээ!" : "Нэмэгдлээ!");
      setTimeout(() => setMsg(null), 3000);
    } catch (err) {
      setMsg(`Алдаа: ${err instanceof Error ? err.message : "Failed"}`);
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Устгах уу?")) return;
    try {
      await fetch(`/api/influencers/${id}`, { method: "DELETE" });
      setInfluencers((prev) => prev.filter((i) => i._id !== id));
    } catch {}
  };

  const ic = "w-full rounded-[4px] border border-[#1c1c1c] bg-[#0a0a0a] px-3 py-2.5 text-[13px] text-[#1A1A1A] outline-none transition focus:border-[rgba(239,44,88,0.4)] placeholder:text-[#3a3835]";
  const sc = "rounded-[4px] border border-[#1c1c1c] bg-[#0a0a0a] px-3 py-2.5 text-[13px] text-[#1A1A1A] outline-none focus:border-[rgba(239,44,88,0.4)]";

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
            INFLUENCER <span className="text-[#EF2C58]">УДИРДЛАГА</span>
          </h1>
          <p className="mt-1 text-[11px] text-[#5a5550]">{influencers.length} инфлүүнсер бүртгэгдсэн</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="rounded-[4px] bg-[#EF2C58] px-5 py-2.5 text-[12px] font-bold text-[#F8F8F6] transition hover:shadow-[0_0_24px_rgba(239,44,88,0.25)]">
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
        <div className="rounded-[4px] border border-[#1c1c1c] bg-[#111] p-5 space-y-4">
          <div className="text-[10px] uppercase tracking-[2px] text-[#EF2C58]">
            {editing ? "Засварлах" : "Шинэ инфлүүнсер"}
          </div>

          {/* Basic info */}
          <div className="text-[9px] uppercase tracking-wide text-[#5a5550]">Үндсэн мэдээлэл</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Нэр" className={ic} />
            <input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} placeholder="Slug (жиш: munkh_influencer)" className={ic} />
          </div>
          <textarea value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} placeholder="Танилцуулга" className={`${ic} min-h-[60px] resize-y`} />
          <div className="grid gap-3 sm:grid-cols-2">
            <input value={form.avatar} onChange={(e) => setForm((f) => ({ ...f, avatar: e.target.value }))} placeholder="Профайл зураг URL" className={ic} />
            <input value={form.coverImage} onChange={(e) => setForm((f) => ({ ...f, coverImage: e.target.value }))} placeholder="Cover зураг URL" className={ic} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input value={form.contactEmail} onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))} placeholder="Имэйл" className={ic} />
            <input value={form.contactPhone} onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))} placeholder="Утас" className={ic} />
          </div>

          {/* Socials */}
          <div className="text-[9px] uppercase tracking-wide text-[#5a5550] mt-2">Сошиал хаягууд</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input value={form.instagram} onChange={(e) => setForm((f) => ({ ...f, instagram: e.target.value }))} placeholder="Instagram URL" className={ic} />
            <input value={form.tiktok} onChange={(e) => setForm((f) => ({ ...f, tiktok: e.target.value }))} placeholder="TikTok URL" className={ic} />
            <input value={form.youtube} onChange={(e) => setForm((f) => ({ ...f, youtube: e.target.value }))} placeholder="YouTube URL" className={ic} />
            <input value={form.facebook} onChange={(e) => setForm((f) => ({ ...f, facebook: e.target.value }))} placeholder="Facebook URL" className={ic} />
          </div>

          {/* Stats */}
          <div className="text-[9px] uppercase tracking-wide text-[#5a5550] mt-2">Статистик</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <input value={form.followers} onChange={(e) => setForm((f) => ({ ...f, followers: e.target.value }))} placeholder="Дагагч" className={ic} type="number" />
            <input value={form.engagement} onChange={(e) => setForm((f) => ({ ...f, engagement: e.target.value }))} placeholder="ER %" className={ic} />
            <input value={form.avgViews} onChange={(e) => setForm((f) => ({ ...f, avgViews: e.target.value }))} placeholder="Дундаж үзэлт" className={ic} type="number" />
            <input value={form.avgLikes} onChange={(e) => setForm((f) => ({ ...f, avgLikes: e.target.value }))} placeholder="Дундаж like" className={ic} type="number" />
          </div>

          {/* Pricing */}
          <div className="text-[9px] uppercase tracking-wide text-[#5a5550] mt-2">Үнийн санал (₮)</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <input value={form.pStory} onChange={(e) => setForm((f) => ({ ...f, pStory: e.target.value }))} placeholder="Story" className={ic} type="number" />
            <input value={form.pPost} onChange={(e) => setForm((f) => ({ ...f, pPost: e.target.value }))} placeholder="Post" className={ic} type="number" />
            <input value={form.pReel} onChange={(e) => setForm((f) => ({ ...f, pReel: e.target.value }))} placeholder="Reel" className={ic} type="number" />
            <input value={form.pCampaign} onChange={(e) => setForm((f) => ({ ...f, pCampaign: e.target.value }))} placeholder="Campaign" className={ic} type="number" />
          </div>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-3">
            <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className={sc}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as InfluencerData["status"] }))} className={sc}>
              {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <input type="number" value={form.order} onChange={(e) => setForm((f) => ({ ...f, order: parseInt(e.target.value) || 0 }))} placeholder="Order" className={`${ic} w-20`} />
            <label className="flex items-center gap-1.5 text-[11px] text-[#c8c8c0] cursor-pointer">
              <input type="checkbox" checked={form.featured} onChange={(e) => setForm((f) => ({ ...f, featured: e.target.checked }))} className="accent-[#EF2C58]" />
              Featured
            </label>
            <label className="flex items-center gap-1.5 text-[11px] text-[#c8c8c0] cursor-pointer">
              <input type="checkbox" checked={form.verified} onChange={(e) => setForm((f) => ({ ...f, verified: e.target.checked }))} className="accent-[#EF2C58]" />
              Verified
            </label>
          </div>

          <input value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} placeholder="Tags (таслалаар: lifestyle, fashion, beauty)" className={ic} />
          <input value={form.portfolio} onChange={(e) => setForm((f) => ({ ...f, portfolio: e.target.value }))} placeholder="Portfolio URLs (таслалаар)" className={ic} />

          <div className="flex items-center gap-2 pt-1">
            <button onClick={handleSave} disabled={!form.name.trim() || !form.slug.trim() || saving} className="rounded-[4px] bg-[#EF2C58] px-5 py-2.5 text-[12px] font-bold text-[#F8F8F6] transition hover:shadow-[0_0_24px_rgba(239,44,88,0.25)] disabled:opacity-40">
              {saving ? "Хадгалж байна..." : editing ? "Шинэчлэх" : "Нэмэх"}
            </button>
            <button onClick={resetForm} className="rounded-[4px] border border-[#1c1c1c] px-4 py-2.5 text-[12px] text-[#5a5550] transition hover:text-[#c8c8c0]">
              Болих
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="space-y-2">
        {influencers.map((inf) => {
          const st = STATUSES.find((s) => s.value === inf.status);
          return (
            <div key={inf._id} className="flex items-center gap-4 rounded-[4px] border border-[#1c1c1c] bg-[#111] p-4">
              {inf.avatar ? (
                <img src={inf.avatar} alt={inf.name} className="h-10 w-10 shrink-0 rounded-full object-cover" />
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1c1c1c] text-[14px] font-black text-[#EF2C58]">
                  {inf.name.charAt(0)}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-bold text-[#1A1A1A]">{inf.name}</span>
                  {inf.verified && (
                    <div className="flex h-4 w-4 items-center justify-center rounded-full bg-[#EF2C58]">
                      <svg className="h-2.5 w-2.5 text-[#F8F8F6]" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" /></svg>
                    </div>
                  )}
                  {inf.featured && <span className="rounded-[4px] bg-[rgba(239,44,88,0.12)] px-1.5 py-0.5 text-[8px] font-black text-[#EF2C58]">TOP</span>}
                  <span className={`text-[10px] font-bold ${st?.color || "text-[#5a5550]"}`}>{st?.label}</span>
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-[11px] text-[#5a5550]">{inf.category}</span>
                  <span className="text-[11px] font-bold text-[#EF2C58]">{formatNum(inf.stats?.followers || 0)} дагагч</span>
                  {inf.stats?.engagement > 0 && <span className="text-[11px] text-[#5a5550]">ER: {inf.stats.engagement}%</span>}
                </div>
              </div>

              <div className="flex shrink-0 gap-2">
                <button onClick={() => startEdit(inf)} className="rounded-[4px] border border-[#1c1c1c] px-3 py-1.5 text-[11px] text-[#EF2C58] transition hover:border-[rgba(239,44,88,0.3)]">
                  Засах
                </button>
                <button onClick={() => handleDelete(inf._id)} className="rounded-[4px] border border-[#1c1c1c] px-3 py-1.5 text-[11px] text-red-400 transition hover:border-red-900/50">
                  Устгах
                </button>
              </div>
            </div>
          );
        })}
        {influencers.length === 0 && (
          <p className="py-10 text-center text-[13px] text-[#5a5550]">Инфлүүнсер бүртгэгдээгүй</p>
        )}
      </div>
    </div>
  );
}
