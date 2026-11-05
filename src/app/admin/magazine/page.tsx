"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { MAG_CATEGORIES, autoExcerpt, renderMagazine, type MagCategory } from "@/lib/magazineRender";
import css from "@/components/magazine/magazine.module.css";

/* ─── /admin/magazine — сэтгүүлийн студи (2026-10-11) ─────────────────────
   Эзний UX (antaqor.html): 01 Бичих → 02 Урьдчилан харах → 03 Нийтлэх ·
   Хуваалцах. Өгөгдөл нь News (/api/news) — /magazine ба /news хоёулаа ижил
   нийтлэлийг харуулна. Зүүн талд бүх нийтлэл (ноорог орно), дарвал засна.
   Брутал модернист: 2px хуваагч, идэвхтэй алхам урвуу өнгөтэй, 4px радиус. */

type Draft = {
  slug?: string; title: string; excerpt: string; content: string; coverImage: string;
  category: MagCategory; featured: boolean; published: boolean;
};
type Row = { slug: string; title: string; category: string; views: number; published?: boolean; featured?: boolean; publishedAt?: string };

const EMPTY: Draft = { title: "", excerpt: "", content: "", coverImage: "", category: "AI", featured: false, published: false };
const SITE = "https://antaqor.com";
const B = "rgba(255,255,255,0.16)";

async function uploadImage(file: File): Promise<string> {
  const fd = new FormData(); fd.append("file", file);
  const r = await fetch("/api/upload", { method: "POST", body: fd });
  const d = await r.json();
  if (!r.ok || !d.url) throw new Error(d.error || "Зураг хадгалж чадсангүй");
  return d.url as string;
}

export default function MagazineStudio() {
  const [list, setList] = useState<Row[] | null>(null);
  const [d, setD] = useState<Draft>(EMPTY);
  const [step, setStep] = useState(0);
  const [maxStep, setMaxStep] = useState(0);
  const [mobile, setMobile] = useState(false);
  const [pct, setPct] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [xp, setXp] = useState<string[]>(["facebook", "threads"]);
  const [xpResult, setXpResult] = useState<string>("");
  const coverRef = useRef<HTMLInputElement>(null);
  const inlineRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const loadList = useCallback(async () => {
    try {
      const r = await fetch("/api/news?all=1&limit=50", { cache: "no-store" });
      const j = await r.json();
      setList(j.items || []);
    } catch { setList([]); }
  }, []);
  useEffect(() => { void loadList(); }, [loadList]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const go = (n: number) => { setStep(n); setPct(0); setMaxStep((m) => Math.max(m, n)); setMsg(null); };
  const reset = () => { setD(EMPTY); setStep(0); setMaxStep(0); setMsg(null); setXpResult(""); };

  async function edit(slug: string) {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch(`/api/news/${encodeURIComponent(slug)}`, { cache: "no-store" });
      const j = await r.json();
      const n = j.news;
      setD({
        slug: n.slug, title: n.title || "", excerpt: n.excerpt || "", content: n.content || "", coverImage: n.coverImage || "",
        category: (MAG_CATEGORIES.includes(n.category) ? n.category : "AI") as MagCategory, featured: !!n.featured, published: n.published !== false,
      });
      setStep(0); setMaxStep(2); setXpResult("");
    } catch { setMsg({ ok: false, text: "Ачаалж чадсангүй" }); }
    finally { setBusy(false); }
  }

  /** Хадгалах — шинэ бол POST, байгаа бол PUT. `publish` нь нийтлэх эсэх. */
  async function save(publish: boolean): Promise<string | null> {
    if (!d.title.trim()) { setMsg({ ok: false, text: "Гарчиг бичнэ үү" }); return null; }
    setBusy(true); setMsg(null);
    const payload = {
      title: d.title.trim(), excerpt: (d.excerpt.trim() || autoExcerpt(d.content)), content: d.content,
      coverImage: d.coverImage, category: d.category, featured: d.featured, published: publish, authorName: "Antaqor",
    };
    try {
      const r = d.slug
        ? await fetch(`/api/news/${encodeURIComponent(d.slug)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await fetch("/api/news", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Хадгалж чадсангүй");
      const slug = (j.news?.slug || j.item?.slug || j.slug || d.slug) as string;
      setD((x) => ({ ...x, slug, published: publish, excerpt: payload.excerpt }));
      void loadList();
      return slug;
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Алдаа" });
      return null;
    } finally { setBusy(false); }
  }

  async function onCover(f?: File) {
    if (!f) return;
    setBusy(true);
    try { set("coverImage", await uploadImage(f)); } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Алдаа" }); }
    finally { setBusy(false); }
  }

  async function onInline(f?: File) {
    if (!f) return;
    setBusy(true);
    try {
      const url = await uploadImage(f);
      const cap = (window.prompt("Зургийн тайлбар (заавал биш):") || "").replace(/[\[\]]/g, "");
      const ta = bodyRef.current;
      const at = ta ? ta.selectionStart : d.content.length;
      const block = `\n\n![${cap}](${url})\n\n`;
      set("content", (d.content.slice(0, at) + block + d.content.slice(at)).replace(/\n{3,}/g, "\n\n"));
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Алдаа" }); }
    finally { setBusy(false); }
  }

  async function publishNow() {
    const slug = await save(true);
    if (slug) { go(2); setMsg({ ok: true, text: "Нийтлэгдлээ" }); }
  }

  async function pushSocial() {
    if (!d.slug || !xp.length) return;
    setBusy(true); setXpResult("");
    try {
      const r = await fetch("/api/admin/magazine/share", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: d.slug, platforms: xp }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Илгээж чадсангүй");
      setXpResult((j.results || []).map((x: { platform: string; status: string; error?: string }) => `${x.platform}: ${x.status === "ok" ? "✓" : `✗ ${x.error || ""}`}`).join(" · ") || "Илгээгдлээ");
    } catch (e) { setXpResult(e instanceof Error ? e.message : "Алдаа"); }
    finally { setBusy(false); }
  }

  const html = useMemo(() => renderMagazine(d.content), [d.content]);
  const excerpt = d.excerpt.trim() || autoExcerpt(d.content);
  const minutes = Math.max(1, Math.round(d.content.split(/\s+/).filter(Boolean).length / 200));
  const url = d.slug ? `${SITE}/magazine/${encodeURIComponent(d.slug)}` : `${SITE}/magazine/…`;
  const enc = encodeURIComponent;
  const steps = ["Бичих", "Урьдчилан харах", "Нийтлэх · Хуваалцах"];

  return (
    <div className="mx-auto grid w-full max-w-[1280px] gap-0 text-[#F2F2F4] lg:grid-cols-[280px_minmax(0,1fr)]">
      {/* ═══ Жагсаалт ═══ */}
      <aside className="border-b-2 lg:border-b-0 lg:border-r-2" style={{ borderColor: B }}>
        <div className="flex items-center justify-between gap-2 border-b-2 px-4 py-3" style={{ borderColor: B }}>
          <strong className="text-[16px]">Magazine</strong>
          <button onClick={reset} className="rounded-[4px] bg-[#2E29FF] px-3 py-1.5 text-[12.5px] font-bold text-[#0A0A0A]">＋ Шинэ</button>
        </div>
        <div className="max-h-[40vh] overflow-y-auto lg:max-h-[calc(100vh-180px)]">
          {list === null ? <p className="p-4 text-[13px] text-[#9C9CA6]">Ачаалж байна…</p>
            : list.length === 0 ? <p className="p-4 text-[13px] text-[#9C9CA6]">Нийтлэл алга.</p>
            : list.map((a) => (
              <button key={a.slug} onClick={() => void edit(a.slug)} className="flex w-full flex-col gap-1 border-b px-4 py-3 text-left transition hover:bg-white/5"
                style={{ borderColor: B, background: d.slug === a.slug ? "rgba(46,41,255,0.08)" : undefined }}>
                <span className="line-clamp-2 text-[14px] font-semibold">{a.title}</span>
                <span className="flex items-center gap-2 text-[11.5px] text-[#9C9CA6]">
                  <span className="rounded-[4px] px-1.5 py-0.5 font-bold" style={a.published === false ? { background: "rgba(252,238,10,0.16)", color: "#FCEE0A" } : { background: "rgba(46,41,255,0.14)", color: "#2E29FF" }}>
                    {a.published === false ? "Ноорог" : "Нийтлэгдсэн"}
                  </span>
                  {a.category} · {a.views} үзсэн
                </span>
              </button>
            ))}
        </div>
      </aside>

      {/* ═══ Студи ═══ */}
      <section className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 px-4 py-3" style={{ borderColor: B }}>
          <strong className="text-[18px]">{d.slug ? "Нийтлэл засах" : "Шинэ нийтлэл"}</strong>
          <div className="flex items-center gap-3">
            <Link href="/magazine" target="_blank" className="text-[13px] font-semibold text-[#2E29FF]">Magazine ↗</Link>
            <button onClick={reset} className="rounded-[4px] border border-[#FCEE0A]/60 px-3 py-1.5 text-[12.5px] font-bold text-[#FCEE0A]">Шинээр эхлэх</button>
          </div>
        </div>

        {/* Алхмууд */}
        <div className="grid grid-cols-3 border-b-2" style={{ borderColor: B }}>
          {steps.map((label, i) => {
            const on = step === i;
            const locked = i > maxStep;
            return (
              <button key={label} onClick={() => !locked && go(i)} disabled={locked}
                className="flex flex-col gap-0.5 border-r px-3 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-40 sm:px-6"
                style={{ borderColor: B, background: on ? "#F2F2F4" : "transparent", color: on ? "#0A0A0A" : "#30333F" }}>
                <span className="font-mono text-[11px] tracking-[0.08em]">0{i + 1}</span>
                <strong className="text-[13px] sm:text-[15px]">{label}</strong>
              </button>
            );
          })}
        </div>

        {msg && (
          <p className="mx-4 mt-4 rounded-[4px] px-3 py-2 text-[13px]" style={msg.ok ? { background: "rgba(46,41,255,0.12)", color: "#2E29FF" } : { background: "rgba(255,110,134,0.12)", color: "#FF6E86" }}>{msg.text}</p>
        )}

        {/* ═══ 01 · БИЧИХ ═══ */}
        {step === 0 && (
          <div className="flex max-w-[780px] flex-col gap-5 p-4 sm:p-8">
            <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void onCover(e.target.files?.[0]); e.target.value = ""; }} />
            <button type="button" onClick={() => coverRef.current?.click()}
              onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void onCover(e.dataTransfer.files?.[0]); }}
              className="relative flex aspect-[16/9] flex-col justify-end overflow-hidden rounded-[4px] border-2 p-4 text-left"
              style={{ borderColor: B, background: d.coverImage ? undefined : "repeating-linear-gradient(135deg,rgba(255,255,255,0.06) 0 1px,transparent 1px 12px)" }}>
              {d.coverImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={d.coverImage} alt="" className={`${css.bw} absolute inset-0 h-full w-full object-cover`} />
              )}
              <span className="relative rounded-[4px] bg-black/60 px-2 py-1 text-[14px] font-bold">{d.coverImage ? "Cover солих" : "Cover зураг"}</span>
              <span className="relative mt-1 w-fit rounded-[4px] bg-black/60 px-2 py-0.5 text-[12px] text-[#C9C9D1]">Чирж оруулах · 1600×900 · хар цагаанаар хэвлэгдэнэ</span>
            </button>

            <label className="flex flex-col gap-1.5 text-[12.5px] font-semibold text-[#C9C9D1]">Гарчиг
              <input value={d.title} onChange={(e) => set("title", e.target.value)} maxLength={220} placeholder="Гарчиг…"
                className="h-12 rounded-[4px] border-2 bg-transparent px-3 text-[18px] font-bold text-white outline-none focus:border-[#2E29FF]" style={{ borderColor: B }} />
            </label>

            <div className="flex flex-col gap-1.5 text-[12.5px] font-semibold text-[#C9C9D1]">Ангилал
              <div className="flex flex-wrap border-2" style={{ borderColor: B }}>
                {MAG_CATEGORIES.map((c) => {
                  const on = d.category === c;
                  return (
                    <button key={c} type="button" onClick={() => set("category", c)} className="border-r px-4 py-2.5 text-[14px] font-semibold transition"
                      style={{ borderColor: B, background: on ? "#F2F2F4" : "transparent", color: on ? "#0A0A0A" : "#30333F" }}>{c}</button>
                  );
                })}
              </div>
            </div>

            <label className="flex flex-col gap-1.5 text-[12.5px] font-semibold text-[#C9C9D1]">Товч тайлбар <span className="font-normal text-[#9C9CA6]">· хоосон бол эхний догол мөрөөс</span>
              <textarea value={d.excerpt} onChange={(e) => set("excerpt", e.target.value)} rows={2} maxLength={400}
                className="resize-y rounded-[4px] border-2 bg-transparent px-3 py-2.5 text-[15px] text-white outline-none focus:border-[#2E29FF]" style={{ borderColor: B }} />
            </label>

            <label className="flex flex-col gap-1.5 text-[12.5px] font-semibold text-[#C9C9D1]">Текст
              <span className="font-normal text-[#9C9CA6]"># гарчиг · ## дэд гарчиг · &gt; ишлэл · **тод** · _налуу_ · [холбоос](https://…) · хоосон мөрөөр догол мөр</span>
              <textarea ref={bodyRef} value={d.content} onChange={(e) => set("content", e.target.value)} rows={14} maxLength={50000}
                className="resize-y rounded-[4px] border-2 bg-transparent px-3 py-3 text-[15.5px] leading-[1.65] text-white outline-none focus:border-[#2E29FF]" style={{ borderColor: B }} />
            </label>

            <input ref={inlineRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void onInline(e.target.files?.[0]); e.target.value = ""; }} />
            <div className="grid grid-cols-1 border-2 sm:grid-cols-2" style={{ borderColor: B }}>
              <button type="button" onClick={() => inlineRef.current?.click()} disabled={busy}
                className="flex aspect-[4/3] items-end p-4 text-left text-[13px] font-semibold sm:border-r-2"
                style={{ borderColor: B, background: "repeating-linear-gradient(45deg,rgba(255,255,255,0.06) 0 1px,transparent 1px 10px)" }}>
                ＋ Текстийн зураг <span className="ml-1 font-normal text-[#9C9CA6]">(курсор байгаа газар)</span>
              </button>
              <div className="flex flex-col justify-end gap-1 p-4 text-[13px]">
                <strong>Тайлбар</strong>
                <span className="text-[#9C9CA6]">Бүх зураг хар цагаан болно. Тайлбар нь зургийн доор mono үсгээр гарна.</span>
              </div>
            </div>

            <label className="flex items-center gap-2 text-[14px]">
              <input type="checkbox" checked={d.featured} onChange={(e) => set("featured", e.target.checked)} className="h-4 w-4 accent-[#FCEE0A]" />
              Cover story болгох (нүүрэнд хамгийн том)
            </label>

            <div className="flex flex-wrap gap-2">
              <button onClick={() => go(1)} disabled={!d.title.trim()} className="h-12 rounded-[4px] bg-[#2E29FF] px-5 text-[15px] font-bold text-[#0A0A0A] disabled:opacity-40">Урьдчилан харах →</button>
              <button onClick={async () => { const s = await save(false); if (s) setMsg({ ok: true, text: "Ноорог хадгалагдлаа" }); }} disabled={busy || !d.title.trim()}
                className="h-12 rounded-[4px] border border-[#FCEE0A]/60 px-5 text-[14px] font-bold text-[#FCEE0A] disabled:opacity-40">Ноорог хадгалах</button>
            </div>
          </div>
        )}

        {/* ═══ 02 · УРЬДЧИЛАН ХАРАХ ═══ */}
        {step === 1 && (
          <div className="flex flex-col items-start gap-5 p-4 sm:p-8">
            <div className="flex border-2" style={{ borderColor: B }}>
              {(["Вэб", "Утас"] as const).map((l, i) => {
                const on = mobile === (i === 1);
                return <button key={l} onClick={() => setMobile(i === 1)} className={`px-5 py-2.5 text-[14px] font-semibold ${i ? "border-l-2" : ""}`} style={{ borderColor: B, background: on ? "#F2F2F4" : "transparent", color: on ? "#0A0A0A" : "#30333F" }}>{l}</button>;
              })}
            </div>
            <div className="flex w-full flex-col border-2 bg-[#0A0A0A]" style={{ borderColor: B, maxWidth: mobile ? 375 : 880 }}>
              <div className="border-b px-4 py-2.5 font-mono text-[12px] text-[#9C9CA6]" style={{ borderColor: B }}>antaqor.com/magazine/{d.slug || "…"}</div>
              <div className="h-1 shrink-0 bg-white/10"><div className="h-full bg-[#2E29FF]" style={{ width: `${pct}%` }} /></div>
              <div className="flex justify-between border-b px-4 py-2 text-[12px]" style={{ borderColor: B }}>
                <span className="text-[#9C9CA6]">{pct >= 99 ? "Уншиж дууслаа ✓" : "Уншиж байна"}</span><strong>{pct}%</strong>
              </div>
              <div className="h-[min(62vh,560px)] overflow-y-auto" onScroll={(e) => { const t = e.currentTarget; const m = t.scrollHeight - t.clientHeight; setPct(m > 0 ? Math.min(100, Math.round((t.scrollTop / m) * 100)) : 100); }}>
                {d.coverImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.coverImage} alt="" className={`${css.bw} aspect-[16/9] w-full object-cover`} />
                ) : <div className="aspect-[16/9]" style={{ background: "repeating-linear-gradient(135deg,rgba(255,255,255,0.06) 0 1px,transparent 1px 12px)" }} />}
                <div className="flex flex-col gap-4 p-5 sm:p-8">
                  <span className="font-mono text-[12px] text-[#2E29FF]">{d.category} · {minutes} мин · 0 үзсэн</span>
                  <h1 className="font-extrabold leading-[1.05] tracking-[-0.03em] text-white" style={{ fontSize: mobile ? 28 : 44 }}>{d.title || "Гарчиг"}</h1>
                  {excerpt && <p className="text-[17px] leading-[1.55] text-[#C9C9D1]">{excerpt}</p>}
                  <div className={`${css.prose} ${mobile ? css.compact : ""}`} dangerouslySetInnerHTML={{ __html: html || "<p>Текст энд харагдана…</p>" }} />
                  <div className="flex justify-between border-t-2 pt-3 text-[13px]" style={{ borderColor: B }}><span>Уншиж дууслаа</span><strong>0 хүн үзсэн</strong></div>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => go(0)} className="h-12 rounded-[4px] border border-[#FCEE0A]/60 px-5 text-[14px] font-bold text-[#FCEE0A]">← Засах</button>
              <button onClick={() => void publishNow()} disabled={busy} className="h-12 rounded-[4px] bg-[#2E29FF] px-6 text-[15px] font-bold text-[#0A0A0A] disabled:opacity-40">{busy ? "Нийтэлж байна…" : d.published ? "Шинэчлэх" : "Нийтлэх"}</button>
            </div>
          </div>
        )}

        {/* ═══ 03 · НИЙТЛЭХ · ХУВААЛЦАХ ═══ */}
        {step === 2 && (
          <div className="grid lg:grid-cols-2">
            <div className="flex flex-col gap-4 border-b-2 p-4 sm:p-8 lg:border-b-0 lg:border-r-2" style={{ borderColor: B }}>
              <span className="w-fit rounded-[4px] bg-[#2E29FF] px-2 py-1 text-[12px] font-extrabold text-[#0A0A0A]">{d.published ? "Нийтлэгдлээ" : "Ноорог"}</span>
              <h2 className="text-[28px] font-extrabold">Хуваалцах</h2>
              <div className="flex border-2" style={{ borderColor: B }}>
                <div className="min-w-0 flex-1 truncate px-4 py-3 text-[14px]">{url}</div>
                <button onClick={() => { navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {}); }}
                  className="bg-[#2E29FF] px-4 text-[14px] font-bold text-[#0A0A0A]">{copied ? "Хуулсан ✓" : "Линк хуулах"}</button>
              </div>
              <div className="grid grid-cols-2 border-l-2 border-t-2" style={{ borderColor: B }}>
                {[
                  ["Facebook", `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`],
                  ["X", `https://twitter.com/intent/tweet?url=${enc(url)}&text=${enc(d.title)}`],
                  ["LinkedIn", `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`],
                  ["Threads", `https://www.threads.net/intent/post?text=${enc(`${d.title} ${url}`)}`],
                ].map(([n, h]) => (
                  <button key={n} onClick={() => window.open(h, "_blank", "noopener,noreferrer,width=640,height=560")}
                    className="border-b-2 border-r-2 p-4 text-left text-[14px] font-semibold transition hover:bg-white/5" style={{ borderColor: B }}>{n} ↗</button>
                ))}
              </div>

              <div className="mt-2 flex flex-col gap-3 rounded-[4px] border-2 p-4" style={{ borderColor: B }}>
                <strong className="text-[15px]">Antaqor-ийн сувгууд руу шууд нийтлэх</strong>
                <div className="flex flex-wrap gap-1.5">
                  {[["facebook", "Facebook page"], ["instagram", "Instagram"], ["threads", "Threads"]].map(([k, l]) => {
                    const on = xp.includes(k);
                    return (
                      <button key={k} type="button" onClick={() => setXp((x) => (on ? x.filter((y) => y !== k) : [...x, k]))}
                        className="h-9 rounded-[4px] px-3 text-[13px] font-bold"
                        style={on ? { background: "rgba(252,238,10,0.16)", color: "#FCEE0A", border: "1px solid rgba(252,238,10,0.6)" } : { color: "#565967", border: "1px solid rgba(255,255,255,0.14)" }}>
                        {on ? "■ " : "□ "}{l}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[12px] text-[#9C9CA6]">Гарчиг + товч тайлбар + холбоос, cover зургийн хамт. Instagram cover зураг шаардана.</p>
                <button onClick={() => void pushSocial()} disabled={busy || !d.published || !xp.length || (xp.includes("instagram") && !d.coverImage)}
                  className="h-11 rounded-[4px] bg-[#FCEE0A] text-[14px] font-bold text-[#0A0A0A] disabled:opacity-40">{busy ? "Илгээж байна…" : "Сонгосон сувгууд руу нийтлэх"}</button>
                {xpResult && <p className="text-[13px] text-[#C9C9D1]">{xpResult}</p>}
              </div>
            </div>

            <div className="flex flex-col gap-3 p-4 sm:p-8">
              <span className="font-mono text-[11.5px] tracking-[0.12em] text-[#9C9CA6]">ХУВААЛЦАХ КАРТ</span>
              <div className="border-2 bg-[#141414]" style={{ borderColor: B }}>
                <div className="aspect-[1.91] overflow-hidden border-b-2" style={{ borderColor: B }}>
                  {d.coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.coverImage} alt="" className={`${css.bw} h-full w-full object-cover`} />
                  ) : <div className="h-full" style={{ background: "repeating-linear-gradient(135deg,rgba(255,255,255,0.06) 0 1px,transparent 1px 12px)" }} />}
                </div>
                <div className="flex flex-col gap-2 p-4">
                  <span className="text-[12px] text-[#9C9CA6]">antaqor.com · {d.category}</span>
                  <strong className="text-[22px] leading-[1.15]">{d.title}</strong>
                  <span className="text-[14px] leading-[1.5] text-[#C9C9D1]">{excerpt.length > 110 ? excerpt.slice(0, 110) + "…" : excerpt}</span>
                </div>
              </div>
              {d.slug && <Link href={`/magazine/${encodeURIComponent(d.slug)}`} target="_blank" className="text-[14px] font-semibold text-[#2E29FF]">Нийтлэлийг нээх ↗</Link>}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
