"use client";

import { useCallback, useEffect, useState } from "react";

interface Slide { title: string; prompt: string }
interface Pack {
  _id?: string; title: string; slug: string; description: string;
  coverImage: string; category: string; featured: boolean; tags: string[];
  creditPrice: number; requiredPlan: string; freeSlides: number;
  slides: Slide[]; published: boolean; copiesCount: number;
  sold: { n: number; credits: number };
}

const INP =
  "w-full rounded-[4px] border border-[rgba(255,255,255,0.12)] bg-[#0A0A0A] px-2.5 py-2 text-[12px] text-[#E8E8E8] outline-none focus:border-[rgba(46,41,255,0.5)]";
const CAT: Record<string, string> = {
  image: "Зураг", video: "Видео", text: "Текст",
  business: "Бизнес", code: "Код", other: "Бусад",
};

const EMPTY: Pack = {
  title: "", slug: "", description: "", coverImage: "", category: "text",
  featured: false, tags: [], creditPrice: 0, requiredPlan: "free",
  freeSlides: 2, slides: [{ title: "", prompt: "" }], published: true,
  copiesCount: 0, sold: { n: 0, credits: 0 },
};

export default function PromptPacksPage() {
  const [packs, setPacks] = useState<Pack[]>([]);
  const [draft, setDraft] = useState<Pack | null>(null);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/prompt-packs", { cache: "no-store" });
      const d = await r.json();
      if (Array.isArray(d.packs)) setPacks(d.packs);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const say = (m: string) => { setFlash(m); setTimeout(() => setFlash(""), 3000); };

  async function save() {
    if (!draft || saving) return;
    setSaving(true);
    try {
      const r = await fetch("/api/admin/prompt-packs", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, tags: draft.tags.join(",") }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { say(d.error || "Алдаа гарлаа"); return; }
      say("Хадгаллаа ✓"); setDraft(null); void load();
    } finally { setSaving(false); }
  }

  async function remove(slug: string) {
    if (!confirm("Устгах уу? Худалдаж авсан хүн байвал зөвхөн нуугдана.")) return;
    const r = await fetch(`/api/admin/prompt-packs?slug=${encodeURIComponent(slug)}`, { method: "DELETE" });
    const d = await r.json().catch(() => ({}));
    say(d.unpublished ? `${d.sold} хүн авсан тул нуулаа` : "Устгалаа");
    void load();
  }

  const setD = (patch: Partial<Pack>) => setDraft((p) => (p ? { ...p, ...patch } : p));

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#2E29FF]">Prompt packs</div>
          <h1 className="mt-0.5 text-[22px] font-bold text-[#E8E8E8]">Промт сан</h1>
          <p className="mt-1 text-[12px] text-[#E2E4E8]">
            Ковер 1.91:1 · ангилал · креditийн үнэ. Эдгээр багц нь пост тус бүрийн DM-ээр тарагдана.
          </p>
        </div>
        <button onClick={() => setDraft({ ...EMPTY })}
          className="shrink-0 rounded-[4px] bg-[#2E29FF] px-4 py-2 text-[12px] font-bold text-white hover:bg-[#1E1E1E]">
          + Шинэ багц
        </button>
      </div>

      {flash && (
        <div className="mb-4 rounded-[4px] border border-[rgba(74,222,128,0.3)] bg-[rgba(74,222,128,0.08)] px-3 py-2 text-[12px] text-[#4ADE80]">{flash}</div>
      )}

      {draft && (
        <div className="mb-5 rounded-[4px] border border-[rgba(46,41,255,0.35)] bg-[#0A0A0A] p-4">
          <div className="mb-3 text-[12px] font-bold text-[#E8E8E8]">{draft._id ? "Багц засах" : "Шинэ багц"}</div>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-[11px] text-[#E2E4E8]">Гарчиг
              <input className={INP + " mt-1"} value={draft.title} onChange={(e) => setD({ title: e.target.value })} />
            </label>
            <label className="text-[11px] text-[#E2E4E8]">Slug <span className="text-[#E2E4E8]">(URL — хоосон бол гарчгаас)</span>
              <input className={INP + " mt-1"} value={draft.slug} onChange={(e) => setD({ slug: e.target.value })} placeholder="excel-ai" />
            </label>
          </div>

          <label className="mt-2 block text-[11px] text-[#E2E4E8]">Тайлбар
            <textarea rows={2} className={INP + " mt-1"} value={draft.description} onChange={(e) => setD({ description: e.target.value })} />
          </label>

          <label className="mt-2 block text-[11px] text-[#E2E4E8]">
            Ковер зураг — <b className="text-[#FBBF24]">1.91:1</b> (1200×628). Share карт, жагсаалт, дэлгэрэнгүй гурав нэг зургийг ашиглана.
            <input className={INP + " mt-1"} value={draft.coverImage} onChange={(e) => setD({ coverImage: e.target.value })} placeholder="https://antaqor.com/uploads/... .jpg" />
          </label>
          {draft.coverImage && (
            <img src={draft.coverImage} alt="" className="mt-2 aspect-[1.91/1] w-full max-w-sm rounded-[4px] object-cover" />
          )}

          <div className="mt-2 grid gap-2 sm:grid-cols-4">
            <label className="text-[11px] text-[#E2E4E8]">Ангилал
              <select className={INP + " mt-1"} value={draft.category} onChange={(e) => setD({ category: e.target.value })}>
                {Object.entries(CAT).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label className="text-[11px] text-[#E2E4E8]">Кредитийн үнэ <span className="text-[#E2E4E8]">(0 = зарахгүй)</span>
              <input type="number" min={0} className={INP + " mt-1"} value={draft.creditPrice}
                onChange={(e) => setD({ creditPrice: Number(e.target.value) })} />
            </label>
            <label className="text-[11px] text-[#E2E4E8]">Төлөвлөгөө
              <select className={INP + " mt-1"} value={draft.requiredPlan} onChange={(e) => setD({ requiredPlan: e.target.value })}>
                {["free", "starter", "builder", "operator"].map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
            <label className="text-[11px] text-[#E2E4E8]">Үнэгүй слайд
              <input type="number" min={0} className={INP + " mt-1"} value={draft.freeSlides}
                onChange={(e) => setD({ freeSlides: Number(e.target.value) })} />
            </label>
          </div>

          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label className="text-[11px] text-[#E2E4E8]">Таг <span className="text-[#E2E4E8]">(таслалаар)</span>
              <input className={INP + " mt-1"} value={draft.tags.join(", ")}
                onChange={(e) => setD({ tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })} />
            </label>
            <div className="flex items-end gap-4 pb-1 text-[11px] text-[#E2E4E8]">
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={draft.featured} onChange={(e) => setD({ featured: e.target.checked })} />
                Trending
              </label>
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={draft.published} onChange={(e) => setD({ published: e.target.checked })} />
                Нийтлэх
              </label>
            </div>
          </div>

          <div className="mt-3 text-[11px] font-bold text-[#E2E4E8]">Слайдууд ({draft.slides.length})</div>
          <div className="mt-1 space-y-2">
            {draft.slides.map((s, i) => (
              <div key={i} className="rounded-[4px] bg-[#0A0A0A] p-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[#E2E4E8]">{String(i + 1).padStart(2, "0")}</span>
                  <input className={INP} value={s.title} placeholder="Слайдын гарчиг"
                    onChange={(e) => { const n = [...draft.slides]; n[i] = { ...n[i], title: e.target.value }; setD({ slides: n }); }} />
                  <button onClick={() => setD({ slides: draft.slides.filter((_, j) => j !== i) })}
                    className="shrink-0 px-2 text-[14px] text-[#4C47FF]">×</button>
                </div>
                <textarea rows={3} className={INP + " mt-1.5"} value={s.prompt} placeholder="Промтын бүтэн текст…"
                  onChange={(e) => { const n = [...draft.slides]; n[i] = { ...n[i], prompt: e.target.value }; setD({ slides: n }); }} />
              </div>
            ))}
          </div>
          <button onClick={() => setD({ slides: [...draft.slides, { title: "", prompt: "" }] })}
            className="mt-2 rounded-[4px] bg-[rgba(255,255,255,0.07)] px-3 py-1.5 text-[11px] text-[#E8E8E8]">+ Слайд</button>

          <div className="mt-4 flex gap-2">
            <button onClick={save} disabled={saving}
              className="rounded-[4px] bg-[#2E29FF] px-5 py-2 text-[12px] font-bold text-white hover:bg-[#1E1E1E] disabled:opacity-50">
              {saving ? "Хадгалж байна…" : "Хадгалах"}
            </button>
            <button onClick={() => setDraft(null)} className="rounded-[4px] px-4 py-2 text-[12px] text-[#E2E4E8]">Болих</button>
          </div>
        </div>
      )}

      {loading && <div className="text-[12px] text-[#E2E4E8]">Уншиж байна…</div>}

      <div className="space-y-2">
        {packs.map((p) => (
          <div key={p.slug} className="flex items-start gap-3 rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] p-3">
            {p.coverImage
              ? <img src={p.coverImage} alt="" className="h-12 w-[92px] shrink-0 rounded-[4px] object-cover" />
              : <div className="flex h-12 w-[92px] shrink-0 items-center justify-center rounded-[4px] bg-[#0A0A0A] text-[9px] text-[#E2E4E8]">1.91:1</div>}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[13px] font-semibold text-[#E8E8E8]">{p.title}</span>
                {p.featured && <span className="rounded-[3px] bg-[rgba(251,191,36,0.15)] px-1.5 py-0.5 text-[9px] font-bold text-[#FBBF24]">TRENDING</span>}
                {!p.published && <span className="text-[10px] text-[#E2E4E8]">нуугдсан</span>}
              </div>
              <div className="mt-0.5 text-[11px] text-[#E2E4E8]">
                {CAT[p.category] || p.category} · {p.slides.length} слайд · {p.freeSlides} үнэгүй
                {p.creditPrice > 0 && <span className="text-[#2E29FF]"> · {p.creditPrice}₵</span>}
                {p.sold.n > 0 && <span className="text-[#4ADE80]"> · {p.sold.n} зарагдсан ({p.sold.credits}₵)</span>}
              </div>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <a href={`/prompts/${p.slug}`} target="_blank" rel="noreferrer"
                className="rounded-[4px] bg-[rgba(255,255,255,0.07)] px-2.5 py-1.5 text-[11px] text-[#E8E8E8]">↗</a>
              <button onClick={() => setDraft({ ...p })}
                className="rounded-[4px] bg-[rgba(255,255,255,0.07)] px-2.5 py-1.5 text-[11px] text-[#E8E8E8]">Засах</button>
              <button onClick={() => remove(p.slug)}
                className="rounded-[4px] bg-[rgba(46,41,255,0.12)] px-2.5 py-1.5 text-[11px] text-[#4C47FF]">Устгах</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
