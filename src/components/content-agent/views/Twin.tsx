"use client";

import { useRef, useState } from "react";
import Icon from "@/components/Icon";
import { TWIN_STYLES, TWIN_PALETTES, TWIN_EXPRS, TWIN_SHEETS, DEFAULT_WARDROBE, type TwinStyle, type TwinPalette, type TwinExpr, type TwinSheet } from "@/lib/twinPresets";
import { api, upload, costOf, fee, type Ctx, type Persona, type TwinProfile, type WardrobeItem, budgetLeft } from "../types";
import ShareDialog, { type ShareItem } from "../ShareDialog";
import s from "../agent.module.css";

/* AI ихэр — хэрэглэгч өөрийн зургаас дижитал ихрээ бүтээж, дахин дахин дуудаж ашиглана.
   Бүтээгч 5 алхам: 1 Зураг (нүүр / бие / гар / стиль тусдаа) → 2 Таны онцлог (агент шинжилж
   бөглөнө, та засна) → 3 Стиль, өнгө, илэрхийлэл → 4 Хувцас (анхдагч: костюм) → 5 Sheet-үүд.
   Дэлгэрэнгүй: sheet-үүд, хувцас солих, стиль солих, Студи / Медиа / Reel-д ашиглах. */
type Slot = "faces" | "bodies" | "hands" | "styleRef";
const SLOTS: { k: Slot; label: string; tip: string; max: number; need?: boolean }[] = [
  { k: "faces", label: "Нүүр", tip: "Урдаас, тод гэрэлтэй · малгай, нүдний шилгүй · 1–2 зураг", max: 2, need: true },
  { k: "bodies", label: "Бие", tip: "Толгойноос хөл хүртэл, энгийн байрлалд", max: 1 },
  { k: "hands", label: "Гар", tip: "Хоёр гарын ар тал", max: 1 },
  { k: "styleRef", label: "Стилийн лавлах", tip: "Энэ зургийн рендер, өнгө, гэрлийг яг дуурайна", max: 1 },
];
const STEPS = ["Зураг", "Таны онцлог", "Стиль", "Хувцас", "Бүтээх"];
const KIND: Record<string, string> = { head: "Толгойн sheet", body: "Биеийн sheet", sculpt: "3D скульптур", outfit: "Хувцас", photo: "Зураг" };

function Wardrobe({ items, sel, onToggle, onAdd, busy }: { items: WardrobeItem[]; sel: string[]; onToggle: (w: WardrobeItem) => void; onAdd: () => void; busy: boolean }) {
  return (
    <div className={s.wardGrid}>
      {items.map((w) => (
        <button key={w.url} className={s.wardItem} aria-pressed={sel.includes(w.url)} onClick={() => onToggle(w)} title={w.label}>
          <img src={w.url} alt="" loading="lazy" /><span>{sel.includes(w.url) ? "✓ " : ""}{w.label}</span>
        </button>
      ))}
      <button className={s.wardItem} data-add onClick={onAdd}>{busy ? <i className={s.spinB} /> : <Icon name="plus" size={24} />}<span>Хувцас нэмэх</span></button>
    </div>
  );
}

export default function Twin(ctx: Ctx) {
  const { st, reload, say, params } = ctx;
  const twins = st.personas;
  const [view, setView] = useState<string>(params.new ? "new" : params.id || (twins.length ? "list" : "new"));
  const cur = twins.find((t) => t._id === view);
  const price = costOf(st.hf.models, "flare", "medium", 0);
  const wardFile = useRef<HTMLInputElement>(null);
  const [wardBusy, setWardBusy] = useState(false);
  async function addWard(after?: (url: string, label: string) => void) {
    wardFile.current?.click();
    wardFile.current!.onchange = async () => {
      const f = wardFile.current?.files?.[0]; if (!f) return;
      setWardBusy(true);
      try { const r = await upload(f); if (r.kind !== "image") throw new Error("Зураг сонгоно уу"); const label = f.name.replace(/\.[a-z0-9]+$/i, "").slice(0, 40) || "Хувцас"; await api({ action: "wardrobe", url: r.url, label }); await reload(); after?.(r.url, label); }
      catch (e) { say((e as Error).message, true); } finally { setWardBusy(false); if (wardFile.current) wardFile.current.value = ""; }
    };
  }

  return (
    <div className={s.page}>
      <input ref={wardFile} type="file" accept="image/*" hidden />
      <div className={s.pageHead}>
        <div><h1>AI ихэр</h1><p>Өөрийн зургаас дижитал ихрээ бүтээ — нэг удаа бүтээгээд бүх контентод дуудаж ашигла.</p></div>
        <div className={s.rowx}>
          {view !== "list" && twins.length > 0 && <button className={s.ghost} onClick={() => setView("list")}><Icon name="chevronLeft" size={16} />Бүх ихэр</button>}
          {view !== "new" && <button className={s.pri} onClick={() => setView("new")}><Icon name="plus" size={16} />Шинэ ихэр</button>}
        </div>
      </div>
      {view === "new" ? <Builder ctx={ctx} price={price} onDone={(id) => setView(id)} addWard={addWard} wardBusy={wardBusy} />
        : cur ? <Detail ctx={ctx} t={cur} price={price} addWard={addWard} wardBusy={wardBusy} onDeleted={() => setView("list")} />
        : (
          <div className={s.mgrid}>
            {twins.map((t) => (
              <button key={t._id} className={s.twinCard} onClick={() => setView(t._id)}>
                <div>{t.sheetUrl ? <img src={(t.sheets.find((x) => x.kind === "head") || t.sheets[0])?.url || t.sheetUrl} alt="" /> : t.status === "rendering" ? <i className={s.spinB} /> : <Icon name="alert" size={20} />}</div>
                <b>@{t.name}{t.isDefault ? " · үндсэн" : ""}</b><span>{t.status === "rendering" ? "Бүтээж байна…" : t.status === "failed" ? t.error || "Амжилтгүй" : `${t.sheets.length || 1} sheet`}</span>
              </button>
            ))}
            <button className={s.twinCard} data-add onClick={() => setView("new")}><div><Icon name="plus" size={32} /></div><b>Шинэ ихэр</b><span>5 алхам · ~2 минут</span></button>
          </div>
        )}
      {st.hf.ready ? null : <p className={s.muted}>AI студи одоогоор идэвхгүй (Higgsfield).</p>}
    </div>
  );
}

function Builder({ ctx, price, onDone, addWard, wardBusy }: { ctx: Ctx; price: number; onDone: (id: string) => void; addWard: (after?: (u: string, l: string) => void) => void; wardBusy: boolean }) {
  const { st, reload, say } = ctx;
  const [step, setStep] = useState(0);
  const [ph, setPh] = useState<Record<Slot, string[]>>({ faces: [], bodies: [], hands: [], styleRef: [] });
  const [profile, setProfile] = useState<TwinProfile | null>(null);
  const [name, setName] = useState(st.me.name || "");
  const [style, setStyle] = useState<TwinStyle>("hyper");
  const [palette, setPalette] = useState<TwinPalette>("dark_blue");
  const [expr, setExpr] = useState<TwinExpr>("calm");
  const [outfit, setOutfit] = useState<string[]>(DEFAULT_WARDROBE.map((w) => w.url));
  const [sheets, setSheets] = useState<TwinSheet[]>(["head", "body"]);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [slot, setSlot] = useState<Slot>("faces");
  const labels = outfit.map((u) => st.wardrobe.find((w) => w.url === u)?.label || "");
  const total = price * sheets.length;
  const left = budgetLeft(st);

  function pickFile(k: Slot) { setSlot(k); fileRef.current?.click(); }
  async function onFile(f?: File | null) {
    if (!f) return;
    setBusy(`up-${slot}`);
    try { const r = await upload(f); if (r.kind !== "image") throw new Error("Зураг сонгоно уу"); const max = SLOTS.find((x) => x.k === slot)!.max; setPh((p) => ({ ...p, [slot]: [...p[slot], r.url].slice(-max) })); }
    catch (e) { say((e as Error).message, true); } finally { setBusy(""); if (fileRef.current) fileRef.current.value = ""; }
  }
  async function analyze() {
    setBusy("analyze");
    try { const r = await api<{ profile: TwinProfile }>({ action: "twin-analyze", faces: ph.faces, bodies: ph.bodies }); setProfile(r.profile); setStep(1); }
    catch (e) { say((e as Error).message, true); } finally { setBusy(""); }
  }
  async function create() {
    if (!profile) return;
    setBusy("create");
    try {
      const r = await api<{ id: string; usd: number }>({ action: "twin-create", ok, name, faces: ph.faces, bodies: ph.bodies, hands: ph.hands, styleRef: ph.styleRef[0] || "", profile, style, palette, expr, outfit, outfitLabels: labels, sheets });
      say(`Ихэр бүтээгдэж байна · ${fee(st.me, r.usd, sheets.length)} — 20–40 секунд`); await reload(); onDone(r.id);
    } catch (e) { say((e as Error).message, true); } finally { setBusy(""); }
  }
  const P = (k: keyof TwinProfile, v: string) => setProfile((p) => (p ? { ...p, [k]: v } : p));

  return (
    <div className={s.stack}>
      <div className={s.twinSteps}>{STEPS.map((x, i) => <button key={x} data-on={i === step} data-done={i < step} disabled={i > step || (i > 0 && !profile)} onClick={() => setStep(i)}><i>{i < step ? "✓" : i + 1}</i>{x}</button>)}</div>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />

      {step === 0 && (
        <section className={s.card}>
          <div className={s.cardHead}><h3>1. Зургаа оруулна уу</h3><small>Хэдий чинээ тод зураг — төдий чинээ яг өөртэй тань адил</small></div>
          <div className={s.slotGrid}>
            {SLOTS.map((x) => (
              <div key={x.k} className={s.slot}>
                <div className={s.slotHead}><b>{x.label}{x.need ? " *" : ""}</b><small>{x.tip}</small></div>
                <div className={s.reelGrid} data-sq>
                  {ph[x.k].map((u) => <button key={u} onClick={() => setPh({ ...ph, [x.k]: ph[x.k].filter((y) => y !== u) })} title="Хасах"><img src={u} alt="" /></button>)}
                  {ph[x.k].length < x.max && <button onClick={() => pickFile(x.k)}>{busy === `up-${x.k}` ? <i className={s.spinB} /> : <Icon name="plus" size={20} />}</button>}
                </div>
              </div>
            ))}
          </div>
          <div className={s.rowx} style={{ marginTop: 14 }}><span className={s.muted}>Агент таны нүүрний бүтцийг (шанаа, хөмсөг, нүд, хамар, ам, чих) уншаад дараагийн алхамд асуулт болгон харуулна.</span><span style={{ flex: 1 }} />
            <button className={`${s.pri} ${s.big}`} disabled={!ph.faces.length || !!busy} onClick={analyze}>{busy === "analyze" ? <><i className={s.spin} />Шинжилж байна…</> : <>Шинжлүүлэх <Icon name="arrow" size={16} /></>}</button></div>
        </section>
      )}

      {step === 1 && profile && (
        <section className={s.card}>
          <div className={s.cardHead}><h3>2. Таны онцлог — зөв үү?</h3><small>Агент зургаас бөглөлөө · буруу бол засна уу</small></div>
          <div className={s.stack}>
            <div className={s.grid3}>
              <label className={s.field}><span>Ихрээ юу гэж дуудах вэ?</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ж: Болд (@Болд)" /></label>
              <div className={s.field}><span>Хүйс</span><div className={s.seg}>{[["male", "Эрэгтэй"], ["female", "Эмэгтэй"]].map(([k, l]) => <button key={k} aria-pressed={profile.gender === k} onClick={() => P("gender", k)}>{l}</button>)}</div></div>
              <label className={s.field}><span>Нас</span><input value={profile.age} onChange={(e) => P("age", e.target.value)} /></label>
              <label className={s.field}><span>Нүдний өнгө зөв үү?</span><input value={profile.eyeColor} onChange={(e) => P("eyeColor", e.target.value)} /></label>
              <label className={s.field}><span>Үс (өнгө, урт, засалт)</span><input value={profile.hair} onChange={(e) => P("hair", e.target.value)} /></label>
              <label className={s.field}><span>Арьс (сэвх, мэнгэ…)</span><input value={profile.skin} onChange={(e) => P("skin", e.target.value)} /></label>
            </div>
            <label className={s.field}><span>Биеийн галбир, өндөр</span><input value={profile.build} onChange={(e) => P("build", e.target.value)} placeholder="Ж: дунд өндөр, өргөн мөртэй" /></label>
            <label className={s.field}><span>Нүүрний DNA — ихрийн хамгийн чухал хэсэг <small className={s.muted}>(ж: «шанаа нүүрний хамгийн өргөн хэсэг» гэж нэмж болно)</small></span>
              <textarea rows={8} value={profile.dna} onChange={(e) => P("dna", e.target.value)} className={s.dnaBox} /></label>
            <div className={s.rowx}><button className={s.ghost} onClick={() => setStep(0)}>← Буцах</button><span style={{ flex: 1 }} /><button className={s.pri} disabled={!profile.dna.trim()} onClick={() => setStep(2)}>Зөв байна <Icon name="arrow" size={16} /></button></div>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className={s.card}>
          <div className={s.cardHead}><h3>3. Ямар стилиэр бүтээх вэ?</h3></div>
          <div className={s.stack}>
            <div className={s.styleGrid}>{TWIN_STYLES.map((x) => (
              <button key={x.id} className={s.styleCard} aria-pressed={style === x.id} onClick={() => setStyle(x.id)}>
                {x.example ? <img src={x.example} alt="" /> : <div className={s.styleNo}>{x.id === "photo" ? "📷" : "✨"}</div>}<b>{x.label}</b><span>{x.desc}</span>
              </button>
            ))}</div>
            <div className={s.field}><span>Өнгө, гэрэл</span><div className={s.rowx}>{TWIN_PALETTES.map((x) => <button key={x.id} className={s.chip} aria-pressed={palette === x.id} onClick={() => setPalette(x.id)}><i className={s.swatch} style={{ background: `linear-gradient(135deg, ${x.swatch[0]} 50%, ${x.swatch[1]} 50%)` }} />{x.label}</button>)}</div></div>
            <div className={s.field}><span>Илэрхийлэл</span><div className={s.rowx}>{TWIN_EXPRS.map((x) => <button key={x.id} className={s.chip} aria-pressed={expr === x.id} onClick={() => setExpr(x.id)}>{x.label}</button>)}</div></div>
            <div className={s.rowx}><button className={s.ghost} onClick={() => setStep(1)}>← Буцах</button><span style={{ flex: 1 }} /><button className={s.pri} onClick={() => setStep(3)}>Дараах <Icon name="arrow" size={16} /></button></div>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className={s.card}>
          <div className={s.cardHead}><h3>4. Ихэр юу өмсөх вэ?</h3><small>{outfit.length ? `${outfit.length} хувцас сонгосон` : "Сонгоогүй бол саарал hoodie, хар өмд, цагаан пүүз"}</small></div>
          <Wardrobe items={st.wardrobe} sel={outfit} busy={wardBusy} onAdd={() => addWard((u) => setOutfit((o) => [...o, u].slice(-4)))}
            onToggle={(w) => setOutfit(outfit.includes(w.url) ? outfit.filter((x) => x !== w.url) : [...outfit, w.url].slice(-4))} />
          <div className={s.rowx} style={{ marginTop: 12 }}><button className={s.ghost} onClick={() => setStep(2)}>← Буцах</button><button className={s.ghost} onClick={() => setOutfit([])}>Энгийн хувцастай</button><span style={{ flex: 1 }} /><button className={s.pri} onClick={() => setStep(4)}>Дараах <Icon name="arrow" size={16} /></button></div>
        </section>
      )}

      {step === 4 && (
        <section className={s.card}>
          <div className={s.cardHead}><h3>5. Ямар sheet-үүд бүтээх вэ?</h3><small>Нэг бүр {fee(st.me, price)}</small></div>
          <div className={s.stack}>
            <div className={s.styleGrid}>{TWIN_SHEETS.map((x) => (
              <button key={x.id} className={s.styleCard} aria-pressed={sheets.includes(x.id)} onClick={() => setSheets(sheets.includes(x.id) ? sheets.filter((y) => y !== x.id) : [...sheets, x.id])}>
                {x.example ? <img src={x.example} alt="" /> : <div className={s.styleNo}>🧑</div>}<b>{sheets.includes(x.id) ? "✓ " : ""}{x.label}</b><span>{x.desc}</span>
              </button>
            ))}</div>
            <label className={s.rowx}><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} style={{ width: 20, minHeight: 20 }} /><span>Эдгээр нь миний эсвэл зөвшөөрөл авсан хүний зураг</span></label>
            <div className={s.rowx}><button className={s.ghost} onClick={() => setStep(3)}>← Буцах</button><span style={{ flex: 1 }} />
              <button className={`${s.pri} ${s.big}`} disabled={!ok || !sheets.length || !!busy || total > left} onClick={create}>{busy === "create" ? <><i className={s.spin} />Бүтээж байна…</> : <><Icon name="spark" size={20} />Ихрээ бүтээх · {fee(st.me, total, sheets.length)}</>}</button></div>
            {total > left && <p className={s.muted}>Өнөөдрийн медиа хязгаар хүрэлцэхгүй байна.</p>}
          </div>
        </section>
      )}
    </div>
  );
}

function Detail({ ctx, t, price, addWard, wardBusy, onDeleted }: { ctx: Ctx; t: Persona; price: number; addWard: (after?: (u: string, l: string) => void) => void; wardBusy: boolean; onDeleted: () => void }) {
  const { st, reload, say, go } = ctx;
  const running = st.media.filter((m) => m.status === "running" && m.personaId === t._id);
  const [wear, setWear] = useState<string[]>([]);
  const [mode, setMode] = useState<"outfit" | "photo">("outfit");
  const [scene, setScene] = useState("");
  const [save, setSave] = useState(false);
  const [busy, setBusy] = useState("");
  const [prof, setProf] = useState<TwinProfile | null>(t.profile);
  const [share, setShare] = useState<ShareItem | null>(null);
  const isBiz = st.me.mode !== "member";
  const [showDna, setShowDna] = useState(false);
  const legacy = !t.profile;

  async function call(name: string, body: Record<string, unknown>, ok: string) {
    setBusy(name);
    try { const r = await api<{ usd?: number }>(body); say(`${ok}${r.usd ? ` · ${fee(st.me, r.usd)}` : ""}`); await reload(); }
    catch (e) { say((e as Error).message, true); } finally { setBusy(""); }
  }
  return (
    <div className={s.stack}>
      <section className={s.card}>
        <div className={s.cardHead}>
          <h3>@{t.name} {t.isDefault && <span className={s.pill} data-s="published">Үндсэн</span>}</h3>
          <div className={s.rowx}>
            {!t.isDefault && t.status === "ready" && <button className={s.ghost} onClick={() => call("def", { action: "persona", op: "default", id: t._id }, "Үндсэн ихэр боллоо")}>Үндсэн болгох</button>}
            <button className={s.ghost} onClick={async () => { await call("del", { action: "persona", op: "delete", id: t._id }, "Устгалаа"); onDeleted(); }}><Icon name="trash" size={16} /></button>
          </div>
        </div>
        <div className={s.useRow}>
          <span className={s.muted}>Ашиглах:</span>
          <button className={s.btn} onClick={() => go("image", { at: t._id })}><Icon name="image" size={16} />AI зураг</button>
          {t.sheetUrl && <button className={s.btn} onClick={() => setShare({ url: t.sheetUrl })}><Icon name="send" size={16} />Community-д хуваалцах</button>}
          {isBiz && <button className={s.btn} onClick={() => go("studio")}><Icon name="image" size={16} />Бүтээгдэхүүн өмсүүлэх (Студи)</button>}
          {isBiz && t.sheetUrl && <button className={s.btn} onClick={() => go("media", { tab: "motion", char: t.sheetUrl })}><Icon name="video" size={16} />Reel-д оруулах</button>}
          {isBiz && <button className={s.btn} onClick={() => go("home")}><Icon name="compose" size={16} />Пост</button>}
        </div>
      </section>

      <div className={s.mgrid} data-wide>
        {running.map((m) => <div key={m._id} className={s.mcard}><div className={s.mthumb} style={{ aspectRatio: "1 / 1" }}><div className={s.mrun}><i className={s.spinB} /><span>{m.idea || "Бүтээж байна"}…</span></div></div></div>)}
        {[...t.sheets].reverse().map((x) => (
          <div key={x.url} className={s.mcard}>
            <div className={s.mthumb} style={{ aspectRatio: x.kind === "head" ? "16 / 9" : x.kind === "sculpt" ? "3 / 2" : x.kind === "photo" ? "3 / 4" : "1 / 1", maxHeight: 520 }}><img src={x.url} alt="" loading="lazy" style={{ objectFit: "contain" }} /></div>
            <div className={s.mbody}>
              <div className={s.rowx}><span className={s.pill} data-k="ig">{KIND[x.kind] || x.label}</span>{t.sheetUrl === x.url && <span className={s.pill} data-s="published">Лавлах</span>}{x.kind === "outfit" && <small className={s.muted}>{x.label.replace(/^Хувцас: /, "")}</small>}</div>
              <div className={s.pcActs}>
                {["head", "body", "sculpt"].includes(x.kind) && !legacy && <button className={s.ghost} disabled={!!busy} onClick={() => call(`re-${x.kind}`, { action: "twin-regen", id: t._id, kind: x.kind }, "Дахин бүтээж байна")}><Icon name="refresh" size={16} />Дахин</button>}
                <button className={s.ghost} onClick={() => setShare({ url: x.url })} title="Community-д хуваалцах"><Icon name="send" size={16} /></button>
                <a className={s.ghost} href={x.url} download target="_blank" rel="noreferrer"><Icon name="download" size={16} /></a>
              </div>
            </div>
          </div>
        ))}
        {!t.sheets.length && t.sheetUrl && <div className={s.mcard}><div className={s.mthumb} style={{ aspectRatio: "3 / 2" }}><img src={t.sheetUrl} alt="" /></div></div>}
      </div>

      {!legacy && (
        <>
          <section className={s.card}>
            <div className={s.cardHead}><h3>Хувцас өмсүүлэх</h3><small>Шүүгээнээс 1–4 хувцас · студиос салгасан хувцас энд автоматаар орно</small></div>
            <div className={s.stack}>
              <Wardrobe items={st.wardrobe} sel={wear} busy={wardBusy} onAdd={() => addWard((u) => setWear((o) => [...o, u].slice(-4)))} onToggle={(w) => setWear(wear.includes(w.url) ? wear.filter((x) => x !== w.url) : [...wear, w.url].slice(-4))} />
              <div className={s.rowx}>
                <div className={s.seg}><button aria-pressed={mode === "outfit"} onClick={() => setMode("outfit")}>4 өнцгийн sheet</button><button aria-pressed={mode === "photo"} onClick={() => setMode("photo")}>Нэг зураг (орчинтой)</button></div>
                {mode === "photo" && <input style={{ flex: 1, minWidth: 220 }} value={scene} onChange={(e) => setScene(e.target.value)} placeholder="Орчин — ж: оффисын хурлын өрөө, оройн гэрэл" />}
              </div>
              <div className={s.rowx}>
                <label className={s.rowx}><input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} style={{ width: 20, minHeight: 20 }} /><span className={s.muted}>Үүнийг ихрийн үндсэн хувцас болгох</span></label>
                <span style={{ flex: 1 }} />
                <button className={s.pri} disabled={(!wear.length && mode === "outfit") || !!busy} onClick={() => call("dress", { action: "twin-dress", id: t._id, items: wear, labels: wear.map((u) => st.wardrobe.find((w) => w.url === u)?.label || ""), mode, scene, save }, mode === "photo" ? "Зураг бүтээж байна" : "Хувцас өмсүүлж байна")}>
                  {busy === "dress" ? <i className={s.spin} /> : <Icon name="spark" size={16} />}{mode === "photo" ? "Зураг бүтээх" : "Өмсүүлэх"} · {fee(st.me, price)}
                </button>
              </div>
            </div>
          </section>

          <section className={s.card}>
            <div className={s.cardHead}><h3>Стиль солих</h3><small>Одоо: {TWIN_STYLES.find((x) => x.id === t.style)?.label} · {TWIN_PALETTES.find((x) => x.id === t.palette)?.label}</small></div>
            <div className={s.stack}>
              <div className={s.rowx}>{TWIN_STYLES.map((x) => <button key={x.id} className={s.chip} disabled={!!busy} onClick={() => call(`st-${x.id}`, { action: "twin-regen", id: t._id, kind: x.id === "sculpt" ? "sculpt" : "head", style: x.id === "sculpt" ? undefined : x.id }, `«${x.label}» толгойн sheet бүтээж байна`)}>{busy === `st-${x.id}` ? <i className={s.spinB} /> : null}{x.label}</button>)}</div>
              <div className={s.rowx}>{TWIN_PALETTES.map((x) => <button key={x.id} className={s.chip} disabled={!!busy} onClick={() => call(`pl-${x.id}`, { action: "twin-regen", id: t._id, kind: "body", palette: x.id }, `«${x.label}» биеийн sheet бүтээж байна`)}><i className={s.swatch} style={{ background: `linear-gradient(135deg, ${x.swatch[0]} 50%, ${x.swatch[1]} 50%)` }} />{x.label}</button>)}</div>
            </div>
          </section>

          <section className={s.card}>
            <button className={s.helpBtn} onClick={() => setShowDna(!showDna)}><Icon name={showDna ? "chevronUp" : "chevronDown"} size={16} />Нүүрний DNA ба онцлог (засах)</button>
            {showDna && prof && (
              <div className={s.stack} style={{ marginTop: 12 }}>
                <div className={s.grid3}>
                  <label className={s.field}><span>Нүдний өнгө</span><input value={prof.eyeColor} onChange={(e) => setProf({ ...prof, eyeColor: e.target.value })} /></label>
                  <label className={s.field}><span>Үс</span><input value={prof.hair} onChange={(e) => setProf({ ...prof, hair: e.target.value })} /></label>
                  <label className={s.field}><span>Арьс</span><input value={prof.skin} onChange={(e) => setProf({ ...prof, skin: e.target.value })} /></label>
                </div>
                <textarea rows={8} className={s.dnaBox} value={prof.dna} onChange={(e) => setProf({ ...prof, dna: e.target.value })} />
                <div className={s.rowx}><span style={{ flex: 1 }} /><button className={s.btn} onClick={() => call("prof", { action: "twin-profile", id: t._id, profile: prof }, "Хадгаллаа — дараагийн sheet-үүдэд хэрэглэгдэнэ")}>Хадгалах</button></div>
              </div>
            )}
          </section>
        </>
      )}
      {legacy && <p className={s.muted}>Энэ нь хуучин хялбар дүр — нүүрний DNA, хувцас солих боломжтой бол «Шинэ ихэр» бүтээнэ үү.</p>}
      {share && <ShareDialog item={share} onClose={() => setShare(null)} say={say} />}
    </div>
  );
}
