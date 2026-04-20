"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface DashboardStats {
  totalUsers: number;
  totalMembers: number;
  totalPosts: number;
  recentSignups: number;
  aiLevelCounts: { _id: string; count: number }[];
  interestCounts: { _id: string; count: number }[];
  levelDistribution: { _id: number; count: number }[];
  topXPUsers: { _id: string; name: string; avatar?: string; xp: number; level: number }[];
}

const AI_LEVEL_LABELS: Record<string, string> = {
  beginner: "Эхлэгч",
  intermediate: "Дунд",
  advanced: "Ахисан",
  expert: "Мэргэжилтэн",
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"hero" | "tasks" | "announcements">("hero");

  // Announcements
  const [announcements, setAnnouncements] = useState<{_id:string;title:string;content:string;image?:string;tag:string;pinned:boolean;published:boolean;createdAt:string}[]>([]);
  const [annForm, setAnnForm] = useState({title:"",content:"",image:"",tag:"мэдэгдэл",pinned:false});
  const [annEditing, setAnnEditing] = useState<string|null>(null);
  const [annSaving, setAnnSaving] = useState(false);

  // Tasks
  const [tasks, setTasks] = useState<{_id:string;title:string;description:string;xpReward:number;status:string;assignedTo?:{_id:string;name:string}|null;createdAt:string}[]>([]);
  const [taskForm, setTaskForm] = useState({title:"",description:"",xpReward:"500"});
  const [taskSaving, setTaskSaving] = useState(false);

  // Hero Slider
  const [heroSlides, setHeroSlides] = useState<{url:string;type:string}[]>([]);
  const [heroUploading, setHeroUploading] = useState(false);
  const [heroVideoUrl, setHeroVideoUrl] = useState("");

  // Hero Music
  const [heroMusicUrl, setHeroMusicUrl] = useState("/fire-again.mp3");
  const [musicUploading, setMusicUploading] = useState(false);

  const flash = (msg: string) => {
    setSaveStatus(msg);
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const loadData = useCallback(async () => {
    try {
      const [statsRes, annRes, taskRes, heroRes, musicRes] = await Promise.all([
        fetch("/api/admin/stats"),
        fetch("/api/announcements?limit=50"),
        fetch("/api/tasks"),
        fetch("/api/hero/slides"),
        fetch("/api/hero/music"),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (annRes.ok) { const d = await annRes.json(); setAnnouncements(d.announcements || []); }
      if (taskRes.ok) { const d = await taskRes.json(); setTasks(d.tasks || []); }
      if (heroRes.ok) { const d = await heroRes.json(); setHeroSlides(d.slides || []); }
      if (musicRes.ok) { const d = await musicRes.json(); setHeroMusicUrl(d.url || "/fire-again.mp3"); }
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Announcement handlers ──
  const handleAnnSave = async () => {
    if (!annForm.title.trim() || !annForm.content.trim() || annSaving) return;
    setAnnSaving(true);
    try {
      const isEdit = !!annEditing;
      const res = await fetch(isEdit ? `/api/announcements/${annEditing}` : "/api/announcements", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(annForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (isEdit) setAnnouncements(prev => prev.map(a => a._id === annEditing ? data.announcement : a));
      else setAnnouncements(prev => [data.announcement, ...prev]);
      setAnnForm({title:"",content:"",image:"",tag:"мэдэгдэл",pinned:false});
      setAnnEditing(null);
      flash(isEdit ? "Мэдэгдэл шинэчлэгдлээ" : "Мэдэгдэл нэмэгдлээ");
    } catch { flash("Алдаа гарлаа"); }
    finally { setAnnSaving(false); }
  };
  const handleAnnDelete = async (id: string) => {
    await fetch(`/api/announcements/${id}`, { method: "DELETE" });
    setAnnouncements(prev => prev.filter(a => a._id !== id));
    flash("Устгагдлаа");
  };

  // ── Task handlers ──
  const handleTaskCreate = async () => {
    if (!taskForm.title.trim() || taskSaving) return;
    setTaskSaving(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: taskForm.title.trim(), description: taskForm.description.trim(), xpReward: parseInt(taskForm.xpReward) || 500 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTasks(prev => [data.task, ...prev]);
      setTaskForm({title:"",description:"",xpReward:"500"});
      flash("Даалгавар нэмэгдлээ");
    } catch { flash("Алдаа гарлаа"); }
    finally { setTaskSaving(false); }
  };
  const handleTaskAction = async (id: string, action: string) => {
    const res = await fetch(`/api/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    const data = await res.json();
    if (res.ok) { setTasks(prev => prev.map(t => t._id === id ? data.task : t)); flash(action === "accept" ? "Баталсан" : "Татгалзсан"); }
  };
  const handleTaskDelete = async (id: string) => {
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    setTasks(prev => prev.filter(t => t._id !== id));
    flash("Устгагдлаа");
  };

  // ── Hero handlers ──
  const handleHeroImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setHeroUploading(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/hero/slides", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok) { setHeroSlides(data.slides); flash("Слайд нэмэгдлээ"); }
      else flash("Алдаа: " + (data.error || "Upload failed"));
    } catch { flash("Network алдаа"); }
    finally { setHeroUploading(false); e.target.value = ""; }
  };

  const handleHeroVideoAdd = async () => {
    const url = heroVideoUrl.trim();
    if (!url) return;
    setHeroUploading(true);
    try {
      const res = await fetch("/api/hero/slides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl: url }),
      });
      const data = await res.json();
      if (res.ok) { setHeroSlides(data.slides); setHeroVideoUrl(""); flash("Видео нэмэгдлээ"); }
      else flash("Алдаа: " + (data.error || "Failed"));
    } catch { flash("Network алдаа"); }
    finally { setHeroUploading(false); }
  };

  const handleHeroSlideDelete = async (index: number) => {
    const res = await fetch("/api/hero/slides", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ index }) });
    const data = await res.json();
    if (res.ok) { setHeroSlides(data.slides); flash("Слайд устгагдлаа"); }
  };

  const handleMusicUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMusicUploading(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/hero/music", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok) { setHeroMusicUrl(data.url); flash("Хөгжим солигдлоо"); }
    } catch { flash("Алдаа"); }
    finally { setMusicUploading(false); e.target.value = ""; }
  };

  const handleMusicReset = async () => {
    setMusicUploading(true);
    try {
      const res = await fetch("/api/hero/music", { method: "DELETE" });
      const data = await res.json();
      if (res.ok) { setHeroMusicUrl(data.url); flash("Анхны хөгжим сэргээгдлээ"); }
    } catch {} finally { setMusicUploading(false); }
  };

  if (loading) return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#EF2C58] border-t-transparent" />
    </div>
  );

  const tabs = [
    { key: "hero" as const, label: "Hero & Хөгжим", count: heroSlides.length },
    { key: "tasks" as const, label: "Даалгавар", count: tasks.length },
    { key: "announcements" as const, label: "Мэдэгдэл", count: announcements.length },
  ];

  const statusColors: Record<string, string> = { open: "bg-green-100 text-green-700", submitted: "bg-yellow-100 text-yellow-700", accepted: "bg-[rgba(239,44,88,0.12)] text-[#EF2C58]", rejected: "bg-red-100 text-red-700" };
  const statusLabels: Record<string, string> = { open: "Нээлттэй", submitted: "Хүлээж буй", accepted: "Баталсан", rejected: "Татгалзсан" };

  return (
    <div className="space-y-6 pb-6">
      {/* Save toast */}
      {saveStatus && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-lg bg-[#1A1A1A] px-4 py-2.5 shadow-xl animate-in fade-in slide-in-from-top-2">
          <svg className="h-4 w-4 text-green-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          <span className="text-[13px] text-white">{saveStatus}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A] md:text-3xl">Dashboard</h1>
          <p className="mt-1 text-[12px] text-[#999999]">Нийгэмлэгийн удирдлагын самбар</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setLoading(true); loadData(); }}
            className="flex items-center gap-1.5 rounded-lg border border-[rgba(0,0,0,0.08)] px-3 py-2 text-[12px] text-[#666] transition hover:border-[#EF2C58] hover:text-[#EF2C58]"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Шинэчлэх
          </button>
          <Link href="/" target="_blank" className="rounded-lg bg-[#EF2C58] px-4 py-2 text-[12px] font-bold text-white transition hover:bg-[#D4264E]">
            Сайт харах
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "Хэрэглэгч", value: stats.totalUsers, color: "text-[#1A1A1A]" },
            { label: "Клан гишүүд", value: stats.totalMembers, color: "text-[#EF2C58]" },
            { label: "Нийтлэл", value: stats.totalPosts, color: "text-[#1A1A1A]" },
            { label: "Шинэ (7 хоног)", value: stats.recentSignups, color: "text-[#1A1A1A]" },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-[rgba(0,0,0,0.06)] bg-white p-4">
              <div className="text-[10px] font-medium uppercase tracking-wider text-[#999]">{s.label}</div>
              <div className={`mt-1 text-2xl font-bold ${s.color}`}>{s.value.toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}

      {/* AI Level + Top XP — collapsed into a compact row */}
      {stats && (
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-[rgba(0,0,0,0.06)] bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#EF2C58]">AI Түвшин</span>
              <Link href="/admin/members" className="text-[10px] text-[#999] hover:text-[#EF2C58]">Бүгд →</Link>
            </div>
            <div className="space-y-2">
              {(["beginner","intermediate","advanced","expert"] as const).map(level => {
                const count = stats.aiLevelCounts.find(a => a._id === level)?.count || 0;
                const pct = stats.totalUsers > 0 ? (count / stats.totalUsers) * 100 : 0;
                return (
                  <div key={level} className="flex items-center gap-2">
                    <span className="w-20 text-[11px] text-[#666]">{AI_LEVEL_LABELS[level]}</span>
                    <div className="h-1.5 flex-1 rounded-full bg-[#F0F0EE]"><div className="h-full rounded-full bg-[#EF2C58] transition-all" style={{ width: `${pct}%` }} /></div>
                    <span className="w-8 text-right text-[11px] text-[#999]">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="rounded-xl border border-[rgba(0,0,0,0.06)] bg-white p-4">
            <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[#EF2C58]">Шилдэг XP</div>
            <div className="space-y-1">
              {(stats.topXPUsers || []).slice(0, 5).map((u, i) => (
                <Link key={u._id} href={`/profile/${u._id}`} className="flex items-center gap-2 rounded-lg py-1.5 px-2 transition hover:bg-[#F8F8F6]">
                  <span className={`w-5 text-center text-[11px] font-bold ${i < 3 ? "text-[#EF2C58]" : "text-[#999]"}`}>{i+1}</span>
                  {u.avatar ? <img src={u.avatar} alt="" className="h-6 w-6 rounded-full object-cover" /> : <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#F0F0EE] text-[9px] font-bold text-[#666]">{u.name?.charAt(0)}</div>}
                  <span className="flex-1 text-[12px] text-[#444] truncate">{u.name}</span>
                  <span className="text-[11px] font-bold text-[#EF2C58]">{(u.xp||0).toLocaleString()} XP</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 rounded-xl border border-[rgba(0,0,0,0.06)] bg-white p-1">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 rounded-lg px-4 py-2.5 text-[13px] font-semibold transition ${
              activeTab === tab.key ? "bg-[#EF2C58] text-white" : "text-[#888] hover:text-[#666] hover:bg-[#F8F8F6]"
            }`}
          >
            {tab.label}
            <span className={`ml-1.5 text-[10px] ${activeTab === tab.key ? "text-white/70" : "text-[#bbb]"}`}>({tab.count})</span>
          </button>
        ))}
      </div>

      {/* ═══ Hero & Music Tab ═══ */}
      {activeTab === "hero" && (
        <div className="space-y-4">
          {/* Slides */}
          <div className="rounded-xl border border-[rgba(0,0,0,0.06)] bg-white p-5">
            <div className="mb-4 text-[11px] font-bold uppercase tracking-wider text-[#999]">Hero Slider</div>

            {heroSlides.length > 0 ? (
              <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                {heroSlides.map((slide, i) => (
                  <div key={i} className="group relative aspect-[3/4] overflow-hidden rounded-lg border border-[rgba(0,0,0,0.06)] bg-[#F8F8F6]">
                    {slide.type === "video" ? (
                      <video src={slide.url} muted loop playsInline className="h-full w-full object-cover" />
                    ) : (
                      <img src={slide.url} alt={`Slide ${i+1}`} className="h-full w-full object-cover" />
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/40">
                      <button onClick={() => handleHeroSlideDelete(i)} className="rounded-full bg-red-500 p-2 text-white opacity-0 transition group-hover:opacity-100 hover:bg-red-600">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                    <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[8px] font-bold text-white uppercase">{slide.type}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mb-4 rounded-lg border-2 border-dashed border-[rgba(0,0,0,0.08)] p-8 text-center text-[12px] text-[#999]">Слайд байхгүй — fallback зураг ашиглагдана</div>
            )}

            {/* Upload controls */}
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-[#888]">Зураг нэмэх</label>
                <input type="file" accept="image/*" onChange={handleHeroImageUpload} disabled={heroUploading}
                  className="text-[12px] text-[#666] file:mr-2 file:rounded-lg file:border-0 file:bg-[#EF2C58] file:px-4 file:py-2 file:text-[11px] file:font-bold file:text-white file:cursor-pointer hover:file:bg-[#D4264E]" />
              </div>
              <div className="flex items-end gap-2">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-[#888]">Видео URL</label>
                  <input
                    type="text"
                    value={heroVideoUrl}
                    onChange={e => setHeroVideoUrl(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleHeroVideoAdd(); }}
                    placeholder="https://example.com/video.mp4"
                    className="w-[260px] rounded-lg border border-[rgba(0,0,0,0.08)] bg-[#F8F8F6] px-3 py-2 text-[13px] text-[#1A1A1A] placeholder-[#bbb] outline-none transition focus:border-[#EF2C58]"
                  />
                </div>
                <button onClick={handleHeroVideoAdd} disabled={!heroVideoUrl.trim() || heroUploading}
                  className="rounded-lg bg-[#EF2C58] px-4 py-2 text-[12px] font-bold text-white transition hover:bg-[#D4264E] disabled:opacity-40">
                  Нэмэх
                </button>
              </div>
            </div>
            {heroUploading && <div className="mt-3 flex items-center gap-2 text-[12px] text-[#999]"><div className="h-3 w-3 animate-spin rounded-full border-2 border-[#EF2C58] border-t-transparent" /> Байршуулж байна...</div>}
          </div>

          {/* Music */}
          <div className="rounded-xl border border-[rgba(0,0,0,0.06)] bg-white p-5">
            <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[#999]">🎵 Арын хөгжим</div>
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-2 rounded-lg bg-[#F8F8F6] px-3 py-2">
                <svg className="h-4 w-4 text-[#EF2C58]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
                <span className="text-[12px] text-[#666] max-w-[200px] truncate">{heroMusicUrl === "/fire-again.mp3" ? "fire-again.mp3 (default)" : heroMusicUrl.split("/").pop()}</span>
              </div>
              <audio src={heroMusicUrl} controls className="h-8" style={{maxWidth: 200}} />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-[#888]">Хөгжим солих</label>
                <input type="file" accept="audio/*" onChange={handleMusicUpload} disabled={musicUploading}
                  className="text-[12px] text-[#666] file:mr-2 file:rounded-lg file:border-0 file:bg-[#EF2C58] file:px-4 file:py-2 file:text-[11px] file:font-bold file:text-white file:cursor-pointer" />
              </div>
              {heroMusicUrl !== "/fire-again.mp3" && (
                <button onClick={handleMusicReset} disabled={musicUploading}
                  className="rounded-lg border border-[rgba(0,0,0,0.08)] px-4 py-2 text-[12px] text-[#888] transition hover:border-[#EF2C58] hover:text-[#EF2C58]">
                  Default сэргээх
                </button>
              )}
            </div>
            {musicUploading && <div className="mt-3 flex items-center gap-2 text-[12px] text-[#999]"><div className="h-3 w-3 animate-spin rounded-full border-2 border-[#EF2C58] border-t-transparent" /> Байршуулж байна...</div>}
          </div>
        </div>
      )}

      {/* ═══ Tasks Tab ═══ */}
      {activeTab === "tasks" && (
        <div className="rounded-xl border border-[rgba(0,0,0,0.06)] bg-white p-5">
          <div className="mb-4 text-[11px] font-bold uppercase tracking-wider text-[#EF2C58]">Даалгавар удирдлага</div>
          <div className="mb-5 space-y-3 rounded-lg bg-[#F8F8F6] p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <input value={taskForm.title} onChange={e => setTaskForm(f => ({...f, title: e.target.value}))} placeholder="Даалгаврын нэр"
                className="rounded-lg border border-[rgba(0,0,0,0.08)] bg-white px-3 py-2.5 text-[13px] outline-none transition focus:border-[#EF2C58]" maxLength={200} />
              <input value={taskForm.xpReward} onChange={e => setTaskForm(f => ({...f, xpReward: e.target.value}))} placeholder="XP (200-5000)"
                className="rounded-lg border border-[rgba(0,0,0,0.08)] bg-white px-3 py-2.5 text-[13px] outline-none transition focus:border-[#EF2C58]" type="number" min={200} max={5000} />
            </div>
            <input value={taskForm.description} onChange={e => setTaskForm(f => ({...f, description: e.target.value}))} placeholder="Тайлбар (заавал биш)"
              className="w-full rounded-lg border border-[rgba(0,0,0,0.08)] bg-white px-3 py-2.5 text-[13px] outline-none transition focus:border-[#EF2C58]" maxLength={2000} />
            <button onClick={handleTaskCreate} disabled={!taskForm.title.trim() || taskSaving}
              className="rounded-lg bg-[#EF2C58] px-5 py-2.5 text-[13px] font-bold text-white transition hover:bg-[#D4264E] disabled:opacity-40">
              {taskSaving ? "Нэмж байна..." : "+ Даалгавар нэмэх"}
            </button>
          </div>
          <div className="space-y-2">
            {tasks.map((t, i) => (
              <div key={t._id} className="flex items-center justify-between gap-3 rounded-lg border border-[rgba(0,0,0,0.06)] p-3 transition hover:border-[rgba(239,44,88,0.2)]">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[12px] font-bold text-[#EF2C58]">#{i+1}</span>
                    <span className="text-[13px] font-bold text-[#1A1A1A] truncate">{t.title}</span>
                    <span className="rounded-md bg-[rgba(239,44,88,0.08)] px-1.5 py-0.5 text-[10px] font-bold text-[#EF2C58]">+{t.xpReward} XP</span>
                    <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${statusColors[t.status] || "bg-gray-100 text-gray-500"}`}>{statusLabels[t.status] || t.status}</span>
                  </div>
                  {t.description && <div className="mt-0.5 text-[11px] text-[#999] line-clamp-1">{t.description}</div>}
                </div>
                <div className="flex shrink-0 gap-2">
                  {t.status === "submitted" && (
                    <>
                      <button onClick={() => handleTaskAction(t._id, "accept")} className="rounded-md bg-green-50 px-2.5 py-1 text-[11px] font-bold text-green-600 transition hover:bg-green-100">Батлах</button>
                      <button onClick={() => handleTaskAction(t._id, "reject")} className="rounded-md bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-500 transition hover:bg-red-100">Татгалзах</button>
                    </>
                  )}
                  <button onClick={() => handleTaskDelete(t._id)} className="rounded-md px-2 py-1 text-[11px] text-red-400 transition hover:bg-red-50 hover:text-red-600">Устгах</button>
                </div>
              </div>
            ))}
            {tasks.length === 0 && <div className="py-8 text-center text-[12px] text-[#999]">Даалгавар байхгүй</div>}
          </div>
        </div>
      )}

      {/* ═══ Announcements Tab ═══ */}
      {activeTab === "announcements" && (
        <div className="rounded-xl border border-[rgba(0,0,0,0.06)] bg-white p-5">
          <div className="mb-4 text-[11px] font-bold uppercase tracking-wider text-[#EF2C58]">Мэдэгдэл удирдлага</div>
          <div className="mb-5 space-y-3 rounded-lg bg-[#F8F8F6] p-4">
            <input value={annForm.title} onChange={e => setAnnForm(f => ({...f, title: e.target.value}))} placeholder="Гарчиг"
              className="w-full rounded-lg border border-[rgba(0,0,0,0.08)] bg-white px-3 py-2.5 text-[13px] outline-none transition focus:border-[#EF2C58]" maxLength={200} />
            <textarea value={annForm.content} onChange={e => setAnnForm(f => ({...f, content: e.target.value}))} placeholder="Агуулга..."
              className="w-full rounded-lg border border-[rgba(0,0,0,0.08)] bg-white px-3 py-2.5 text-[13px] outline-none transition focus:border-[#EF2C58] min-h-[80px] resize-y" maxLength={5000} />
            <div className="flex flex-wrap items-center gap-3">
              <select value={annForm.tag} onChange={e => setAnnForm(f => ({...f, tag: e.target.value}))}
                className="rounded-lg border border-[rgba(0,0,0,0.08)] bg-white px-3 py-2 text-[13px] outline-none">
                {["мэдэгдэл","шинэчлэл","AI","эвент","бусад"].map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
              </select>
              <label className="flex items-center gap-1.5 text-[12px] text-[#666] cursor-pointer">
                <input type="checkbox" checked={annForm.pinned} onChange={e => setAnnForm(f => ({...f, pinned: e.target.checked}))} className="accent-[#EF2C58]" />
                Pinned
              </label>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleAnnSave} disabled={!annForm.title.trim() || !annForm.content.trim() || annSaving}
                className="rounded-lg bg-[#EF2C58] px-5 py-2.5 text-[13px] font-bold text-white transition hover:bg-[#D4264E] disabled:opacity-40">
                {annSaving ? "..." : annEditing ? "Шинэчлэх" : "Нэмэх"}
              </button>
              {annEditing && (
                <button onClick={() => { setAnnEditing(null); setAnnForm({title:"",content:"",image:"",tag:"мэдэгдэл",pinned:false}); }}
                  className="rounded-lg border border-[rgba(0,0,0,0.08)] px-4 py-2 text-[12px] text-[#888] transition hover:text-[#666]">Болих</button>
              )}
            </div>
          </div>
          <div className="space-y-2">
            {announcements.map(a => (
              <div key={a._id} className="flex items-start justify-between gap-3 rounded-lg border border-[rgba(0,0,0,0.06)] p-3 transition hover:border-[rgba(239,44,88,0.2)]">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    {a.pinned && <span className="rounded bg-[rgba(239,44,88,0.1)] px-1.5 py-0.5 text-[9px] font-bold text-[#EF2C58]">PIN</span>}
                    <span className="rounded bg-[#F0F0EE] px-1.5 py-0.5 text-[9px] font-bold text-[#888] uppercase">{a.tag}</span>
                  </div>
                  <div className="text-[13px] font-bold text-[#1A1A1A] truncate">{a.title}</div>
                  <div className="text-[11px] text-[#999] line-clamp-1">{a.content}</div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button onClick={() => { setAnnEditing(a._id); setAnnForm({title:a.title,content:a.content,image:a.image||"",tag:a.tag,pinned:a.pinned}); setActiveTab("announcements"); }}
                    className="rounded-md px-2.5 py-1 text-[11px] font-bold text-[#EF2C58] transition hover:bg-[rgba(239,44,88,0.06)]">Засах</button>
                  <button onClick={() => handleAnnDelete(a._id)}
                    className="rounded-md px-2 py-1 text-[11px] text-red-400 transition hover:bg-red-50 hover:text-red-600">Устгах</button>
                </div>
              </div>
            ))}
            {announcements.length === 0 && <div className="py-8 text-center text-[12px] text-[#999]">Мэдэгдэл байхгүй</div>}
          </div>
        </div>
      )}
    </div>
  );
}
