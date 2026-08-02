"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

// ── Admin control center for the Influencer Network ──────────────────────
// Three surfaces: Roster (CRUD), creator Applications, and brand Collab leads.

type Network = "instagram" | "tiktok" | "youtube" | "facebook" | "threads" | "x";
type Tier = "nano" | "micro" | "macro" | "mega" | "celebrity";
interface Platform { network: Network; url: string; followers: number }
interface Influencer {
  _id: string; name: string; handle: string; slug: string; avatar: string; cover: string;
  bio: string; location: string; niche: string; tier: Tier; platforms: Platform[];
  totalFollowers: number; engagementRate: number; tags: string[]; rateFrom: number;
  contactEmail: string; contactPhone: string; verified: boolean; featured: boolean;
  status: "active" | "hidden"; order: number;
}
interface Application {
  _id: string; name: string; handle: string; email: string; phone: string; niche: string;
  primaryPlatform: string; followers: number; portfolioUrl: string; message: string;
  status: "new" | "reviewing" | "approved" | "rejected"; adminNote: string; createdAt: string;
}
interface Collab {
  _id: string; influencerName: string; brand: string; name: string; email: string; phone: string;
  budget: number; goal: string; message: string; status: "new" | "contacted" | "won" | "closed";
  adminNote: string; createdAt: string;
}

const NETWORKS: Network[] = ["instagram", "tiktok", "youtube", "facebook", "threads", "x"];
const TIERS: Tier[] = ["nano", "micro", "macro", "mega", "celebrity"];
const ACCENT = "#1080CA";

type EmptyDraft = Omit<Influencer, "_id" | "slug"> & { slug: string };
const EMPTY: EmptyDraft = {
  name: "", handle: "", slug: "", avatar: "", cover: "", bio: "", location: "", niche: "",
  tier: "micro", platforms: [], totalFollowers: 0, engagementRate: 0, tags: [], rateFrom: 0,
  contactEmail: "", contactPhone: "", verified: false, featured: false, status: "active", order: 0,
};

function fmt(n: number): string {
  if (!n) return "0";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}
const inp = "w-full rounded-none border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2 text-[13px] text-[#E8E8E8] placeholder-[#56565E] outline-none focus:border-[rgba(16,128,202,0.4)]";
const lbl = "font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-[#8A8A92]";

export default function AdminInfluencersPage() {
  const [tab, setTab] = useState<"roster" | "apps" | "collabs">("roster");
  const [apps, setApps] = useState<Application[]>([]);
  const [collabs, setCollabs] = useState<Collab[]>([]);

  const loadCounts = useCallback(async () => {
    try {
      const [a, c] = await Promise.all([
        fetch("/api/influencers/applications", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/influencers/collabs", { cache: "no-store" }).then((r) => r.json()),
      ]);
      if (Array.isArray(a.applications)) setApps(a.applications);
      if (Array.isArray(c.collabs)) setCollabs(c.collabs);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { loadCounts(); }, [loadCounts]);

  const newApps = apps.filter((a) => a.status === "new").length;
  const newCollabs = collabs.filter((c) => c.status === "new").length;

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.30em] text-[#1080CA]">ANTAQOR / ADMIN</p>
          <h1 className="mt-1 text-[24px] font-black text-[#E8E8E8]">Инфлюенсер сүлжээ<span className="text-[#1080CA]">.</span></h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/influencers" target="_blank" className="rounded-none border border-[rgba(255,255,255,0.08)] bg-[#0E0E12] px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#8A8A92] transition hover:text-[#E8E8E8]">Нээх ↗</Link>
          <Link href="/admin" className="rounded-none border border-[rgba(255,255,255,0.08)] bg-[#0E0E12] px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#8A8A92] transition hover:text-[#E8E8E8]">← Админ</Link>
        </div>
      </div>

      {/* tabs */}
      <div className="mb-5 flex gap-1 border-b border-[rgba(255,255,255,0.08)]">
        {([["roster", "Роастер"], ["apps", `Өргөдөл${newApps ? ` · ${newApps}` : ""}`], ["collabs", `Хамтрал${newCollabs ? ` · ${newCollabs}` : ""}`]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`relative -mb-px border-b-2 px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.16em] transition ${tab === k ? "border-[#1080CA] text-[#E8E8E8]" : "border-transparent text-[#8A8A92] hover:text-[#E8E8E8]"}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === "roster" && <RosterTab />}
      {tab === "apps" && <ApplicationsTab apps={apps} reload={loadCounts} />}
      {tab === "collabs" && <CollabsTab collabs={collabs} reload={loadCounts} />}
    </div>
  );
}

/* ── Roster ───────────────────────────────────────────────────────────── */
function RosterTab() {
  const [list, setList] = useState<Influencer[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EmptyDraft>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/influencers?all=1", { cache: "no-store" });
      const data = await res.json();
      if (Array.isArray(data.influencers)) setList(data.influencers);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const startNew = () => { setEditingId("new"); setDraft({ ...EMPTY, order: list.length }); setErr(""); };
  const startEdit = (i: Influencer) => {
    setEditingId(i._id);
    setDraft({ ...EMPTY, ...i, platforms: i.platforms || [], tags: i.tags || [] });
    setErr("");
  };
  const cancel = () => { setEditingId(null); setDraft(EMPTY); setErr(""); };

  const save = async () => {
    if (!draft.name.trim()) { setErr("Нэр шаардлагатай"); return; }
    setSaving(true); setErr("");
    try {
      const isNew = editingId === "new";
      const res = await fetch(isNew ? "/api/influencers" : `/api/influencers/${editingId}`, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || "Хадгалж чадсангүй"); return; }
      cancel(); load();
    } finally { setSaving(false); }
  };

  const remove = async (i: Influencer) => {
    if (!confirm(`"${i.name}" устгах уу?`)) return;
    await fetch(`/api/influencers/${i._id}`, { method: "DELETE" });
    load();
  };

  return (
    <div>
      {editingId !== "new" && (
        <button onClick={startNew} className="mb-4 inline-flex items-center gap-1.5 rounded-none bg-[#1080CA] px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[#0E0E10] transition hover:shadow-[0_0_18px_rgba(16,128,202,0.4)]">
          <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" d="M12 4v16m8-8H4" /></svg>
          Шинэ креатор
        </button>
      )}

      {editingId !== null && (
        <InfluencerForm draft={draft} setDraft={setDraft} saving={saving} err={err} onCancel={cancel} onSave={save} isNew={editingId === "new"} />
      )}

      {loading ? (
        <div className="py-10 text-center font-mono text-[10px] uppercase tracking-[0.22em] text-[#8A8A92]">Ачааллаж байна…</div>
      ) : list.length === 0 ? (
        <div className="rounded-none border-2 border-dashed border-[rgba(255,255,255,0.08)] p-10 text-center">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-[#8A8A92]">ХООСОН</p>
          <p className="mt-2 text-[12px] text-[#8A8A92]">Эхний креатораа нэмнэ үү</p>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((i) => (
            <div key={i._id} className={`flex items-center gap-3 rounded-none border bg-[#0E0E12] p-3 transition ${editingId === i._id ? "border-[rgba(16,128,202,0.5)]" : "border-[rgba(255,255,255,0.06)] hover:border-[rgba(16,128,202,0.3)]"}`}>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-none bg-[#0A0A0A]">
                {i.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={i.avatar} alt={i.name} className="h-full w-full object-cover" />
                ) : <span className="font-mono text-[12px] font-black text-[#8A8A92]">{i.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()}</span>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[13px] font-bold text-[#E8E8E8]">{i.name}</span>
                  {i.verified && <span className="text-[#1080CA]">✓</span>}
                  {i.featured && <span className="rounded bg-[rgba(16,128,202,0.12)] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-[#1080CA]">FEAT</span>}
                  {i.status === "hidden" && <span className="rounded bg-[rgba(255,255,255,0.06)] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-[#8A8A92]">НУУСАН</span>}
                </div>
                <p className="truncate text-[11px] text-[#8A8A92]">
                  {i.handle && <>@{i.handle} · </>}{i.niche || "—"} · {fmt(i.totalFollowers)} дагагч · {i.tier}
                </p>
              </div>
              <button onClick={() => startEdit(i)} className="rounded-none border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-2.5 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-[#8A8A92] transition hover:text-[#1080CA]">Засах</button>
              <button onClick={() => remove(i)} aria-label="Устгах" className="rounded-none p-1.5 text-[#8A8A92] transition hover:bg-[rgba(16,128,202,0.1)] hover:text-[#1080CA]">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9M19.228 5.79L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79M7.5 5.79h9" /></svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InfluencerForm({ draft, setDraft, saving, err, onCancel, onSave, isNew }: {
  draft: EmptyDraft; setDraft: (d: EmptyDraft) => void; saving: boolean; err: string;
  onCancel: () => void; onSave: () => void; isNew: boolean;
}) {
  const avatarRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<"avatar" | "cover" | null>(null);
  const set = <K extends keyof EmptyDraft>(k: K, v: EmptyDraft[K]) => setDraft({ ...draft, [k]: v });

  const upload = async (e: React.ChangeEvent<HTMLInputElement>, field: "avatar" | "cover") => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(field);
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok && data.url) set(field, data.url);
    } finally {
      setUploading(null);
      if (field === "avatar" && avatarRef.current) avatarRef.current.value = "";
      if (field === "cover" && coverRef.current) coverRef.current.value = "";
    }
  };

  const setPlatform = (idx: number, patch: Partial<Platform>) => {
    const next = draft.platforms.map((p, i) => (i === idx ? { ...p, ...patch } : p));
    set("platforms", next);
  };
  const addPlatform = () => set("platforms", [...draft.platforms, { network: "instagram", url: "", followers: 0 }]);
  const removePlatform = (idx: number) => set("platforms", draft.platforms.filter((_, i) => i !== idx));

  return (
    <div className="mb-5 rounded-none border border-[rgba(16,128,202,0.3)] bg-[#0E0E10] p-4">
      {/* media */}
      <div className="grid grid-cols-[88px_1fr] gap-3">
        <div>
          <span className={lbl}>Аватар</span>
          <button type="button" onClick={() => avatarRef.current?.click()} disabled={!!uploading}
            className="relative mt-1 flex aspect-square w-full items-center justify-center overflow-hidden rounded-none border-2 border-dashed border-[rgba(255,255,255,0.1)] bg-[#0A0A0A] transition hover:border-[rgba(16,128,202,0.4)]">
            {draft.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={draft.avatar} alt="" className="h-full w-full object-cover" />
            ) : <span className="font-mono text-[9px] text-[#8A8A92]">+ ЗУРАГ</span>}
            {uploading === "avatar" && <span className="absolute inset-0 flex items-center justify-center bg-black/60"><span className="h-2 w-2 animate-pulse rounded-full bg-[#1080CA]" /></span>}
          </button>
          <input ref={avatarRef} type="file" accept="image/*" onChange={(e) => upload(e, "avatar")} className="hidden" />
        </div>
        <div>
          <span className={lbl}>Ковер</span>
          <button type="button" onClick={() => coverRef.current?.click()} disabled={!!uploading}
            className="relative mt-1 flex h-[88px] w-full items-center justify-center overflow-hidden rounded-none border-2 border-dashed border-[rgba(255,255,255,0.1)] bg-[#0A0A0A] transition hover:border-[rgba(16,128,202,0.4)]">
            {draft.cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={draft.cover} alt="" className="h-full w-full object-cover" />
            ) : <span className="font-mono text-[9px] text-[#8A8A92]">+ КОВЕР ЗУРАГ</span>}
            {uploading === "cover" && <span className="absolute inset-0 flex items-center justify-center bg-black/60"><span className="h-2 w-2 animate-pulse rounded-full bg-[#1080CA]" /></span>}
          </button>
          <input ref={coverRef} type="file" accept="image/*" onChange={(e) => upload(e, "cover")} className="hidden" />
        </div>
      </div>

      {/* identity */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <label><span className={lbl}>Нэр *</span><input className={inp + " mt-1"} value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder="Бүтэн нэр" autoFocus /></label>
        <label><span className={lbl}>@Handle</span><input className={inp + " mt-1"} value={draft.handle} onChange={(e) => set("handle", e.target.value)} placeholder="username" /></label>
        <label><span className={lbl}>Slug {isNew ? "(авто)" : ""}</span><input className={inp + " mt-1"} value={draft.slug} onChange={(e) => set("slug", e.target.value)} placeholder="url-key" /></label>
        <label><span className={lbl}>Байршил</span><input className={inp + " mt-1"} value={draft.location} onChange={(e) => set("location", e.target.value)} placeholder="Улаанбаатар" /></label>
        <label><span className={lbl}>Чиглэл</span><input className={inp + " mt-1"} value={draft.niche} onChange={(e) => set("niche", e.target.value)} placeholder="Гоо сайхан" /></label>
        <label><span className={lbl}>Tier</span>
          <select className={inp + " mt-1"} value={draft.tier} onChange={(e) => set("tier", e.target.value as Tier)}>
            {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
      </div>

      <label className="mt-3 block"><span className={lbl}>Био (≤800)</span><textarea className={inp + " mt-1 min-h-[64px] resize-y"} maxLength={800} value={draft.bio} onChange={(e) => set("bio", e.target.value)} placeholder="Танилцуулга" /></label>

      {/* metrics */}
      <div className="mt-3 grid grid-cols-3 gap-3">
        <label><span className={lbl}>Нийт дагагч</span><input type="number" className={inp + " mt-1"} value={draft.totalFollowers || ""} onChange={(e) => set("totalFollowers", Number(e.target.value) || 0)} placeholder="авто нийлбэр" /></label>
        <label><span className={lbl}>Engagement %</span><input type="number" step="0.1" className={inp + " mt-1"} value={draft.engagementRate || ""} onChange={(e) => set("engagementRate", Number(e.target.value) || 0)} placeholder="4.2" /></label>
        <label><span className={lbl}>Үнэ эхлэх (₮)</span><input type="number" className={inp + " mt-1"} value={draft.rateFrom || ""} onChange={(e) => set("rateFrom", Number(e.target.value) || 0)} placeholder="1000000" /></label>
      </div>

      {/* platforms */}
      <div className="mt-4">
        <div className="flex items-center justify-between">
          <span className={lbl}>Платформууд</span>
          <button type="button" onClick={addPlatform} className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#1080CA]">+ нэмэх</button>
        </div>
        <div className="mt-2 space-y-2">
          {draft.platforms.map((p, idx) => (
            <div key={idx} className="grid grid-cols-[110px_1fr_90px_28px] items-center gap-2">
              <select className={inp} value={p.network} onChange={(e) => setPlatform(idx, { network: e.target.value as Network })}>
                {NETWORKS.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <input className={inp} value={p.url} onChange={(e) => setPlatform(idx, { url: e.target.value })} placeholder="https://…" />
              <input type="number" className={inp} value={p.followers || ""} onChange={(e) => setPlatform(idx, { followers: Number(e.target.value) || 0 })} placeholder="дагагч" />
              <button type="button" onClick={() => removePlatform(idx)} className="flex h-9 items-center justify-center text-[#8A8A92] transition hover:text-[#1080CA]">✕</button>
            </div>
          ))}
          {draft.platforms.length === 0 && <p className="text-[11px] text-[#56565E]">Платформ нэмээгүй байна.</p>}
        </div>
      </div>

      {/* tags + contact */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="col-span-2"><span className={lbl}>Tag (таслалаар)</span><input className={inp + " mt-1"} value={draft.tags.join(", ")} onChange={(e) => set("tags", e.target.value.split(",").map((t) => t.trim()).filter(Boolean))} placeholder="ugc, reels, gen-z" /></label>
        <label><span className={lbl}>Холбоо · имэйл (нууц)</span><input className={inp + " mt-1"} value={draft.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} placeholder="creator@mail.com" /></label>
        <label><span className={lbl}>Холбоо · утас (нууц)</span><input className={inp + " mt-1"} value={draft.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} placeholder="9911..." /></label>
      </div>

      {/* toggles */}
      <div className="mt-4 flex flex-wrap items-center gap-4 text-[11px] text-[#8A8A92]">
        <label className="flex items-center gap-1.5"><input type="checkbox" className="h-3.5 w-3.5 accent-[#1080CA]" checked={draft.verified} onChange={(e) => set("verified", e.target.checked)} />Баталгаажсан</label>
        <label className="flex items-center gap-1.5"><input type="checkbox" className="h-3.5 w-3.5 accent-[#1080CA]" checked={draft.featured} onChange={(e) => set("featured", e.target.checked)} />Онцлох</label>
        <label className="flex items-center gap-1.5">Дараалал<input type="number" className="w-16 rounded-none border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-2 py-1 text-center text-[12px] text-[#E8E8E8] outline-none focus:border-[rgba(16,128,202,0.4)]" value={draft.order} onChange={(e) => set("order", Number(e.target.value) || 0)} /></label>
        <label className="flex items-center gap-1.5">Төлөв
          <select className="rounded-none border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-2 py-1 text-[12px] text-[#E8E8E8] outline-none" value={draft.status} onChange={(e) => set("status", e.target.value as "active" | "hidden")}>
            <option value="active">Идэвхтэй</option>
            <option value="hidden">Нуусан</option>
          </select>
        </label>
      </div>

      {err && <p className="mt-3 text-[11px] text-[#1080CA]">{err}</p>}
      <div className="mt-4 flex items-center justify-end gap-2">
        <button onClick={onCancel} className="text-[11px] font-bold text-[#8A8A92] transition hover:text-[#E8E8E8]">Болих</button>
        <button onClick={onSave} disabled={saving || !draft.name.trim()} className="rounded-none bg-[#1080CA] px-4 py-2 text-[11px] font-black uppercase tracking-wider text-[#0E0E10] disabled:opacity-40">{saving ? "Хадгалж байна..." : "Хадгалах"}</button>
      </div>
    </div>
  );
}

/* ── Applications ─────────────────────────────────────────────────────── */
const APP_STATUS: Record<Application["status"], { label: string; color: string }> = {
  new: { label: "Шинэ", color: "#1080CA" }, reviewing: { label: "Хянаж буй", color: "#F5C542" },
  approved: { label: "Зөвшөөрсөн", color: "#3ECf8E" }, rejected: { label: "Татгалзсан", color: "#8A8A92" },
};
function ApplicationsTab({ apps, reload }: { apps: Application[]; reload: () => void }) {
  const [filter, setFilter] = useState<string>("all");
  const shown = filter === "all" ? apps : apps.filter((a) => a.status === filter);

  const update = async (id: string, patch: Partial<Application>) => {
    await fetch(`/api/influencers/applications/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    reload();
  };
  const remove = async (id: string) => { if (!confirm("Устгах уу?")) return; await fetch(`/api/influencers/applications/${id}`, { method: "DELETE" }); reload(); };

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {["all", "new", "reviewing", "approved", "rejected"].map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`rounded-none border px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] transition ${filter === s ? "border-[#1080CA] bg-[rgba(16,128,202,0.12)] text-[#1080CA]" : "border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] text-[#8A8A92] hover:text-[#E8E8E8]"}`}>
            {s === "all" ? "Бүгд" : APP_STATUS[s as Application["status"]].label}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <div className="rounded-none border-2 border-dashed border-[rgba(255,255,255,0.08)] p-10 text-center font-mono text-[10px] uppercase tracking-[0.22em] text-[#8A8A92]">ӨРГӨДӨЛ БАЙХГҮЙ</div>
      ) : (
        <div className="space-y-2">
          {shown.map((a) => (
            <div key={a._id} className="rounded-none border border-[rgba(255,255,255,0.06)] bg-[#0E0E12] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-bold text-[#E8E8E8]">{a.name}</span>
                    {a.handle && <span className="text-[11px] text-[#8A8A92]">@{a.handle}</span>}
                    <span className="rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider" style={{ color: APP_STATUS[a.status].color, background: `${APP_STATUS[a.status].color}1a` }}>{APP_STATUS[a.status].label}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-[#8A8A92]">
                    {a.niche || "—"} · {a.primaryPlatform || "—"} · {fmt(a.followers)} дагагч
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#8A8A92]">
                    <a href={`mailto:${a.email}`} className="text-[#1080CA]">{a.email}</a>{a.phone && ` · ${a.phone}`}{a.portfolioUrl && <> · <a href={a.portfolioUrl} target="_blank" rel="noreferrer" className="underline">portfolio</a></>}
                  </p>
                  {a.message && <p className="mt-2 whitespace-pre-wrap rounded-none bg-[#0A0A0A] p-2 text-[12px] text-[#C8C8C0]">{a.message}</p>}
                </div>
                <button onClick={() => remove(a._id)} aria-label="Устгах" className="shrink-0 rounded-none p-1.5 text-[#8A8A92] transition hover:text-[#1080CA]">✕</button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {(Object.keys(APP_STATUS) as Application["status"][]).map((s) => (
                  <button key={s} onClick={() => update(a._id, { status: s })} className={`rounded-none border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.12em] transition ${a.status === s ? "border-[#1080CA] text-[#1080CA]" : "border-[rgba(255,255,255,0.08)] text-[#8A8A92] hover:text-[#E8E8E8]"}`}>{APP_STATUS[s].label}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Collabs ──────────────────────────────────────────────────────────── */
const COLLAB_STATUS: Record<Collab["status"], { label: string; color: string }> = {
  new: { label: "Шинэ", color: "#1080CA" }, contacted: { label: "Холбогдсон", color: "#F5C542" },
  won: { label: "Хийсэн", color: "#3ECf8E" }, closed: { label: "Хаасан", color: "#8A8A92" },
};
function CollabsTab({ collabs, reload }: { collabs: Collab[]; reload: () => void }) {
  const [filter, setFilter] = useState<string>("all");
  const shown = filter === "all" ? collabs : collabs.filter((c) => c.status === filter);

  const update = async (id: string, patch: Partial<Collab>) => {
    await fetch(`/api/influencers/collabs/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    reload();
  };
  const remove = async (id: string) => { if (!confirm("Устгах уу?")) return; await fetch(`/api/influencers/collabs/${id}`, { method: "DELETE" }); reload(); };

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {["all", "new", "contacted", "won", "closed"].map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`rounded-none border px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] transition ${filter === s ? "border-[#1080CA] bg-[rgba(16,128,202,0.12)] text-[#1080CA]" : "border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] text-[#8A8A92] hover:text-[#E8E8E8]"}`}>
            {s === "all" ? "Бүгд" : COLLAB_STATUS[s as Collab["status"]].label}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <div className="rounded-none border-2 border-dashed border-[rgba(255,255,255,0.08)] p-10 text-center font-mono text-[10px] uppercase tracking-[0.22em] text-[#8A8A92]">ХҮСЭЛТ БАЙХГҮЙ</div>
      ) : (
        <div className="space-y-2">
          {shown.map((c) => (
            <div key={c._id} className="rounded-none border border-[rgba(255,255,255,0.06)] bg-[#0E0E12] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-bold text-[#E8E8E8]">{c.brand || c.name}</span>
                    <span className="rounded bg-[rgba(16,128,202,0.1)] px-1.5 py-0.5 text-[9px] font-bold text-[#1080CA]">{c.influencerName || "Нээлттэй бриф"}</span>
                    <span className="rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider" style={{ color: COLLAB_STATUS[c.status].color, background: `${COLLAB_STATUS[c.status].color}1a` }}>{COLLAB_STATUS[c.status].label}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-[#8A8A92]">
                    {c.name} · <a href={`mailto:${c.email}`} className="text-[#1080CA]">{c.email}</a>{c.phone && ` · ${c.phone}`}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#8A8A92]">Зорилго: {c.goal || "—"}{c.budget ? ` · Төсөв ₮${c.budget.toLocaleString()}` : ""}</p>
                  {c.message && <p className="mt-2 whitespace-pre-wrap rounded-none bg-[#0A0A0A] p-2 text-[12px] text-[#C8C8C0]">{c.message}</p>}
                </div>
                <button onClick={() => remove(c._id)} aria-label="Устгах" className="shrink-0 rounded-none p-1.5 text-[#8A8A92] transition hover:text-[#1080CA]">✕</button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {(Object.keys(COLLAB_STATUS) as Collab["status"][]).map((s) => (
                  <button key={s} onClick={() => update(c._id, { status: s })} className={`rounded-none border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.12em] transition ${c.status === s ? "border-[#1080CA] text-[#1080CA]" : "border-[rgba(255,255,255,0.08)] text-[#8A8A92] hover:text-[#E8E8E8]"}`}>{COLLAB_STATUS[s].label}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
