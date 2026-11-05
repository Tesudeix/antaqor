"use client";

import { useEffect, useRef, useState } from "react";
import { Btn, Card, SectionHeader, Skeleton, T } from "@/components/admin/kit";

/* ─── Брэнд · SEO (2026-10-26) ───────────────────────────────────────────────
   Хайлтад (Google) харагдах гарчиг/тайлбар, хуваалцахад гарах cover, favicon ба
   утсанд суулгах апп-ын icon — нэг дороос. Зураг нь оруулмагц хадгалагдана;
   текст «Хадгалах» товчоор. Өгөгдөл: /api/admin/brand → SiteSettings `site_brand`. */

type Brand = { title: string; template: string; description: string; keywords: string[]; ogAlt: string; appName: string; shortName: string; iconBg: string; iconV: string; ogV: string };
type Urls = { icon32: string; icon192: string; icon512: string; apple: string; maskable: string; cover: string };

const field: React.CSSProperties = { width: "100%", borderRadius: 8, border: `1px solid ${T.border}`, background: "#FFFFFF", color: T.text, padding: "10px 12px", fontSize: 14, outline: "none" };
const label: React.CSSProperties = { display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 12.5, fontWeight: 700, color: T.muted };

function Count({ n, max }: { n: number; max: number }) {
  return <span style={{ fontWeight: 600, color: n > max ? T.warnInk : T.faint }}>{n}/{max}</span>;
}

export default function AdminBrandPage() {
  const [b, setB] = useState<Brand | null>(null);
  const [urls, setUrls] = useState<Urls | null>(null);
  const [kw, setKw] = useState("");
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState<{ t: string; bad?: boolean } | null>(null);
  const iconRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  const apply = (d: { brand: Brand; urls: Urls }) => { setB(d.brand); setUrls(d.urls); setKw(d.brand.keywords.join(", ")); };

  useEffect(() => {
    fetch("/api/admin/brand", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(apply)
      .catch(() => setNote({ t: "Ачаалж чадсангүй", bad: true }));
  }, []);

  const flash = (t: string, bad = false) => { setNote({ t, bad }); setTimeout(() => setNote(null), 3500); };

  async function save() {
    if (!b) return;
    setBusy("save");
    try {
      const r = await fetch("/api/admin/brand", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...b, keywords: kw.split(/[,\n]/).map((x) => x.trim()).filter(Boolean) }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Алдаа");
      apply(d);
      flash("✓ Хадгалагдлаа — бүх хуудсанд 5 минутын дотор шинэчлэгдэнэ");
    } catch (e) { flash((e as Error).message, true); } finally { setBusy(""); }
  }

  async function upload(kind: "icon" | "cover", file?: File | null) {
    if (!file) return;
    setBusy(kind);
    try {
      const fd = new FormData(); fd.append("kind", kind); fd.append("file", file);
      const r = await fetch("/api/admin/brand", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Алдаа");
      apply(d);
      flash(kind === "icon" ? "✓ Icon солигдлоо — favicon, iPhone, Android бүгд" : "✓ Cover солигдлоо");
    } catch (e) { flash((e as Error).message, true); } finally {
      setBusy("");
      if (iconRef.current) iconRef.current.value = "";
      if (coverRef.current) coverRef.current.value = "";
    }
  }

  async function reset(what: "icon" | "cover") {
    if (!confirm(what === "icon" ? "Icon-ыг анхдагч руу буцаах уу?" : "Cover-ыг анхдагч руу буцаах уу?")) return;
    setBusy(`reset-${what}`);
    try { const r = await fetch(`/api/admin/brand?what=${what}`, { method: "DELETE" }); const d = await r.json(); if (!r.ok) throw new Error(d.error); apply(d); flash("✓ Анхдагч руу буцлаа"); }
    catch (e) { flash((e as Error).message || "Алдаа", true); } finally { setBusy(""); }
  }

  if (!b || !urls) return <div className="mx-auto max-w-5xl space-y-4">{note ? <Card className="p-6 text-center">{note.t}</Card> : [0, 1, 2].map((i) => <Skeleton key={i} className="h-48" />)}</div>;

  const set = (k: keyof Brand, v: string) => setB({ ...b, [k]: v });
  const pageTitle = b.title;

  return (
    <div className="mx-auto max-w-5xl pb-24">
      <div className="mb-6">
        <h1 className="text-[28px] font-extrabold tracking-tight" style={{ color: T.text }}>Брэнд · SEO</h1>
        <p className="mt-1 max-w-2xl text-[14px] leading-relaxed" style={{ color: T.muted }}>
          Google-д гарах гарчиг, тайлбар, Facebook/Threads-д линк хуваалцахад гарах cover, хөтчийн favicon,
          утсанд «Нүүр дэлгэцэнд нэмэх» үеийн апп-ын icon — бүгд энд.
        </p>
      </div>

      {/* ── 1. Хайлт ── */}
      <SectionHeader title="Хайлтад харагдах байдал" hint="Google, AI хайлт" />
      <Card className="mb-8 p-5">
        <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
          <div className="space-y-4">
            <div>
              <label style={label}><span>Гарчиг</span><Count n={b.title.length} max={60} /></label>
              <input style={field} value={b.title} maxLength={90} onChange={(e) => set("title", e.target.value)} />
            </div>
            <div>
              <label style={label}><span>Тайлбар</span><Count n={b.description.length} max={160} /></label>
              <textarea style={{ ...field, resize: "vertical" }} rows={4} maxLength={320} value={b.description} onChange={(e) => set("description", e.target.value)} />
            </div>
            <div>
              <label style={label}><span>Түлхүүр үгс (таслалаар)</span></label>
              <textarea style={{ ...field, resize: "vertical" }} rows={2} value={kw} onChange={(e) => setKw(e.target.value)} />
            </div>
            <div>
              <label style={label}><span>Дэд хуудасны гарчгийн загвар</span><span style={{ color: T.faint }}>%s = хуудасны нэр</span></label>
              <input style={field} value={b.template} maxLength={60} onChange={(e) => set("template", e.target.value)} />
            </div>
          </div>
          <div>
            <div style={label}><span>Google-д ингэж харагдана</span></div>
            <div className="rounded-[12px] p-4" style={{ border: `1px solid ${T.border}`, background: "#FFFFFF" }}>
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full" style={{ background: "#F1F3F4" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={urls.icon32} alt="" width={18} height={18} />
                </span>
                <div className="leading-tight"><div className="text-[13px]" style={{ color: "#202124" }}>Antaqor</div><div className="text-[12px]" style={{ color: "#4D5156" }}>https://antaqor.com</div></div>
              </div>
              <div className="mt-2 text-[19px] leading-snug" style={{ color: "#1A0DAB" }}>{pageTitle.length > 62 ? `${pageTitle.slice(0, 60)}…` : pageTitle}</div>
              <div className="mt-1 text-[13.5px] leading-snug" style={{ color: "#4D5156" }}>{b.description.length > 162 ? `${b.description.slice(0, 160)}…` : b.description}</div>
            </div>
            <p className="mt-2 text-[12px] leading-relaxed" style={{ color: T.faint }}>Гарчиг ≤60, тайлбар ≤160 тэмдэгт байвал Google таслахгүй.</p>
          </div>
        </div>
      </Card>

      {/* ── 2. Cover ── */}
      <SectionHeader title="Хуваалцах cover" hint="Facebook, Threads, Messenger, Telegram" />
      <Card className="mb-8 p-5">
        <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
          <div>
            <button type="button" onClick={() => coverRef.current?.click()}
              onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); upload("cover", e.dataTransfer.files?.[0]); }}
              className="relative block w-full overflow-hidden rounded-[12px]" style={{ aspectRatio: "1200 / 630", background: "#F1F2F7", border: `1px dashed ${T.borderHi}` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={urls.cover} alt="" className="h-full w-full object-cover" />
              <span className="absolute inset-x-0 bottom-0 p-3 text-left text-[12.5px] font-semibold" style={{ background: "linear-gradient(transparent, rgba(0,0,0,.55))", color: "#FFFFFF" }}>
                {busy === "cover" ? "Боловсруулж байна…" : "Дарж эсвэл чирж солих · 1200×630 болгож тайрна"}
              </span>
            </button>
            <input ref={coverRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => upload("cover", e.target.files?.[0])} />
            <div className="mt-3 flex flex-wrap gap-2">
              <Btn size="sm" variant="secondary" onClick={() => coverRef.current?.click()} loading={busy === "cover"}>Cover солих</Btn>
              {b.ogV && <Btn size="sm" variant="ghost" onClick={() => reset("cover")} loading={busy === "reset-cover"}>Анхдагч руу буцаах</Btn>}
            </div>
            <div className="mt-4">
              <label style={label}><span>Зургийн тайлбар (alt)</span></label>
              <input style={field} value={b.ogAlt} maxLength={140} onChange={(e) => set("ogAlt", e.target.value)} />
            </div>
          </div>
          <div>
            <div style={label}><span>Линк хуваалцахад</span></div>
            <div className="overflow-hidden rounded-[12px]" style={{ border: `1px solid ${T.border}`, background: "#F0F2F5" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={urls.cover} alt="" className="block w-full object-cover" style={{ aspectRatio: "1.91 / 1" }} />
              <div className="px-3 py-2.5">
                <div className="text-[11.5px] uppercase" style={{ color: "#65676B" }}>antaqor.com</div>
                <div className="mt-0.5 text-[15px] font-bold leading-snug" style={{ color: "#050505" }}>{pageTitle}</div>
                <div className="mt-0.5 line-clamp-1 text-[13px]" style={{ color: "#65676B" }}>{b.description}</div>
              </div>
            </div>
            <p className="mt-2 text-[12px] leading-relaxed" style={{ color: T.faint }}>
              Facebook хуучин зургийг кэшилдэг — солисны дараа <a href="https://developers.facebook.com/tools/debug/?q=https%3A%2F%2Fantaqor.com" target="_blank" rel="noreferrer" style={{ color: T.primaryInk, fontWeight: 700 }}>Sharing Debugger</a>-аар «Scrape Again» дарна.
            </p>
          </div>
        </div>
      </Card>

      {/* ── 3. Icon ── */}
      <SectionHeader title="Favicon · апп icon" hint="хөтчийн таб, iPhone, Android" />
      <Card className="mb-8 p-5">
        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <div>
            <button type="button" onClick={() => iconRef.current?.click()}
              onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); upload("icon", e.dataTransfer.files?.[0]); }}
              className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-[16px]" style={{ background: "#F1F2F7", border: `1px dashed ${T.borderHi}` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={urls.icon512} alt="" className="h-[70%] w-[70%] object-contain" />
              {busy === "icon" && <span className="absolute inset-0 flex items-center justify-center text-[13px] font-semibold" style={{ background: "rgba(255,255,255,.85)", color: T.primaryInk }}>Боловсруулж байна…</span>}
            </button>
            <input ref={iconRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => upload("icon", e.target.files?.[0])} />
            <p className="mt-2 text-[12px] leading-relaxed" style={{ color: T.faint }}>Дөрвөлжин PNG, 512×512 ба түүнээс том. Бүх хэмжээг (16 → 512) автоматаар үүсгэнэ.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Btn size="sm" variant="secondary" onClick={() => iconRef.current?.click()} loading={busy === "icon"}>Icon солих</Btn>
              {b.iconV && <Btn size="sm" variant="ghost" onClick={() => reset("icon")} loading={busy === "reset-icon"}>Анхдагч</Btn>}
            </div>
          </div>

          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <div style={label}><span>Хөтчийн таб</span></div>
                <div className="flex items-center gap-2 rounded-t-[10px] px-3 py-2.5" style={{ background: "#DEE1E6" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={urls.icon32} alt="" width={16} height={16} />
                  <span className="truncate text-[12.5px]" style={{ color: "#202124" }}>{pageTitle}</span>
                </div>
                <div className="h-8 rounded-b-[10px]" style={{ background: "#FFFFFF", border: "1px solid #DEE1E6", borderTop: 0 }} />
              </div>
              <div>
                <div style={label}><span>iPhone нүүр дэлгэц</span></div>
                <div className="flex h-[92px] items-center justify-center rounded-[12px]" style={{ background: "linear-gradient(135deg,#5B7CFA,#B66DFF)" }}>
                  <div className="text-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={urls.apple} alt="" width={52} height={52} style={{ borderRadius: 12, boxShadow: "0 2px 6px rgba(0,0,0,.25)" }} />
                    <div className="mt-1 text-[11px] font-semibold" style={{ color: "#FFFFFF" }}>{b.shortName}</div>
                  </div>
                </div>
              </div>
              <div>
                <div style={label}><span>Android</span></div>
                <div className="flex h-[92px] items-center justify-center rounded-[12px]" style={{ background: "#1F2430" }}>
                  <div className="text-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={urls.maskable} alt="" width={52} height={52} style={{ borderRadius: "50%" }} />
                    <div className="mt-1 text-[11px] font-semibold" style={{ color: "#FFFFFF" }}>{b.shortName}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-[1fr_180px_150px]">
              <div>
                <label style={label}><span>Апп-ын бүтэн нэр</span></label>
                <input style={field} value={b.appName} maxLength={60} onChange={(e) => set("appName", e.target.value)} />
              </div>
              <div>
                <label style={label}><span>Icon доорх нэр</span><Count n={b.shortName.length} max={12} /></label>
                <input style={field} value={b.shortName} maxLength={20} onChange={(e) => set("shortName", e.target.value)} />
              </div>
              <div>
                <label style={label}><span>Icon-ы дэвсгэр</span></label>
                <div className="flex items-center gap-2">
                  <input type="color" value={b.iconBg} onChange={(e) => set("iconBg", e.target.value.toUpperCase())} style={{ width: 40, height: 40, padding: 0, border: `1px solid ${T.border}`, borderRadius: 8, background: "#FFFFFF" }} aria-label="Дэвсгэр өнгө" />
                  <input style={{ ...field, fontFamily: "ui-monospace, monospace" }} value={b.iconBg} maxLength={7} onChange={(e) => set("iconBg", e.target.value)} />
                </div>
              </div>
            </div>
            <p className="text-[12px] leading-relaxed" style={{ color: T.faint }}>
              Утсанд аль хэдийн нэмсэн хүмүүсийн icon iPhone дээр автоматаар солигдохгүй — апп-аа устгаад дахин «Нүүр дэлгэцэнд нэмэх» хэрэгтэй. Android хэдэн өдрийн дотор өөрөө шинэчилнэ.
            </p>
          </div>
        </div>
      </Card>

      {/* ── Хадгалах ── */}
      <div className="fixed inset-x-0 bottom-0 z-40 md:left-[252px]" style={{ background: "rgba(255,255,255,.92)", borderTop: `1px solid ${T.border}`, backdropFilter: "blur(12px)" }}>
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 md:px-9">
          <span className="text-[13px] font-semibold" style={{ color: note ? (note.bad ? T.badInk : T.okInk) : T.faint }}>
            {note ? note.t : "Зураг оруулмагц хадгалагдана. Текстийн өөрчлөлтөө доор хадгална."}
          </span>
          <Btn onClick={save} loading={busy === "save"}>Хадгалах</Btn>
        </div>
      </div>
    </div>
  );
}
