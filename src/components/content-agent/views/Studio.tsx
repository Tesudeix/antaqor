"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import { IMAGE_PRESETS, MOTION_PRESETS, CATEGORIES, forCat, packFor, type Category } from "@/lib/studioPresets";
import { api, upload, costOf, usd, type Analysis, type Ctx, budgetLeft } from "../types";
import s from "../agent.module.css";

/* Бүтээгдэхүүний студи v2 —
   1) Зураг оруулахад агент шинжилнэ: ангилал (хувцас / хоол / …) + зурган дахь эд зүйлс.
   2) Хэрэглэгч «аль хэсэг?» гэдгээ товшиж сонгоно (кардиган, жинс, пүүз…) — бичих шаардлагагүй.
   3) Ангилалд тохирсон загварууд: хувцас — салгах, ghost, flat lay, өмсөж үзэх; хоол — амттай,
      дээрээс, цэс; гоо сайхан, технологи, гэр, гоёл тус бүр өөрийн загвартай.
   4) «Миний дүр» — биеийн зургаас ref sheet; try-on, кампанит ажил, 3D-д таны дүр орно. */
type Item = { key: string; url: string; kind: "image" | "video"; label: string; mediaId: string; running?: boolean; error?: string };

export default function Studio(ctx: Ctx) {
  const { st, reload, say, go, params } = ctx;
  const products = st.products;
  const [pid, setPid] = useState(params.product || products.find((p) => p.imageUrl)?._id || products[0]?._id || "");
  const product = products.find((p) => p._id === pid);
  const [base, setBase] = useState(params.image || product?.imageUrl || "");
  const [ana, setAna] = useState<Analysis | null>(product?.analysis && product.analysis.src === (params.image || product?.imageUrl) ? product.analysis : null);
  const [cat, setCat] = useState<Category>((product?.category as Category) || "clothing");
  const [sel, setSel] = useState<number[]>([]);
  const [persona, setPersona] = useState(st.personas.find((p) => p.isDefault && p.status === "ready")?._id || "");
  const [hq, setHq] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const models = st.hf.models;
  const left = budgetLeft(st);
  const readyPersonas = st.personas.filter((p) => p.status === "ready");

  /* суурь зураг солигдоход шинжилнэ (бүтээгдэхүүнд кэшлэгдсэн бол дахин дуудахгүй) */
  useEffect(() => {
    if (!base) { setAna(null); return; }
    if (ana?.src === base) return;
    if (product?.analysis?.src === base) { setAna(product.analysis); setCat((product.analysis.category as Category) || "other"); setSel([]); return; }
    let live = true;
    setBusy("analyze");
    api<{ analysis: Analysis }>({ action: "analyze", imageUrl: base, productId: pid || undefined })
      .then((r) => { if (!live) return; setAna(r.analysis); setCat((r.analysis.category as Category) || "other"); setSel([]); })
      .catch((e) => live && say((e as Error).message, true))
      .finally(() => live && setBusy(""));
    return () => { live = false; };
  }, [base]); // eslint-disable-line react-hooks/exhaustive-deps
  /* тэмдэглэлд @нэр бичвэл тэр дүрийг сонгоно */
  useEffect(() => { const m = /@([^\s@]+)/.exec(note); if (!m) return; const p = readyPersonas.find((x) => x.name.toLowerCase().startsWith(m[1].toLowerCase())); if (p) setPersona(p._id); }, [note]); // eslint-disable-line react-hooks/exhaustive-deps

  const items = ana?.items || [];
  const chosen = sel.map((i) => items[i]?.en).filter(Boolean) as string[];
  const running: Item[] = st.media.filter((m) => m.productId === pid && (m.status === "running" || (m.status === "failed" && Date.now() - +new Date(m.createdAt) < 2 * 3600e3))).map((m) => ({ key: m._id, url: "", kind: m.kind, label: m.idea || m.preset || "", mediaId: m._id, running: m.status === "running", error: m.status === "failed" ? m.error : "" }));
  const done: Item[] = [...(product?.gallery || [])].reverse().map((g) => ({ key: g.url, url: g.url, kind: g.kind, label: g.label, mediaId: g.mediaId }));
  const results = [...running, ...done];
  const priceImg = (model: string, q: string) => costOf(models, model, hq ? (model === "flare" ? "high" : "2k") : model === "flare" ? q : "1k", 0);
  const priceVid = costOf(models, "wan3", st.cfg.media.videoRes, 5);
  const pk = packFor(cat);
  const packUsd = priceImg("flare", "medium") * (1 + pk.also.length) + priceVid;
  const label = (id: string) => IMAGE_PRESETS.find((x) => x.id === id)?.label || MOTION_PRESETS.find((x) => x.id === id)?.label || id;

  function pick(id: string) { const p = products.find((x) => x._id === id); setPid(id); setBase(p?.imageUrl || ""); setAna(p?.analysis && p.analysis.src === p.imageUrl ? p.analysis : null); setSel([]); }
  async function onFile(f?: File | null) {
    if (!f) return;
    setBusy("up");
    try {
      const r = await upload(f);
      if (r.kind !== "image") throw new Error("Зураг сонгоно уу");
      setBase(r.url);
      if (product && !product.imageUrl) { await api({ action: "product", id: product._id, doc: { ...product, imageUrl: r.url } }); await reload(); }
    } catch (e) { say((e as Error).message, true); } finally { setBusy(""); }
  }
  async function act(name: string, body: Record<string, unknown>, ok: string) {
    if (!base) { say("Эхлээд зураг оруулна уу", true); return; }
    setBusy(name);
    try { const r = await api<{ usd?: number }>({ ...body, imageUrl: base, productId: pid || undefined, category: cat, items: chosen, personaId: persona || undefined, note }); say(`${ok}${r.usd ? ` · ≈ ${usd(r.usd)}` : ""}`); await reload(); }
    catch (e) { say((e as Error).message, true); } finally { setBusy(""); }
  }
  async function itemOp(it: Item, op: "main" | "remove" | "post") {
    try {
      if (op === "main") { await api({ action: "product-main", productId: pid, url: it.url }); say("Үндсэн зураг боллоо"); }
      if (op === "remove") { await api({ action: "gallery-remove", productId: pid, url: it.url }); say("Хаслаа"); }
      if (op === "post") { const r = await api<{ group: string }>({ action: "media-post", id: it.mediaId, idea: product ? `${product.name} — ${product.pitch}` : "", count: 1 }); await reload(); go("create", { group: r.group }); return; }
      await reload();
    } catch (e) { say((e as Error).message, true); }
  }
  async function perOp(id: string, op: string) { try { await api({ action: "persona", op, id }); await reload(); } catch (e) { say((e as Error).message, true); } }

  if (!st.hf.ready) return <div className={s.page}><div className={s.empty}><b>AI студи одоогоор идэвхгүй</b><span>Higgsfield тохируулаагүй байна.</span></div></div>;
  return (
    <div className={s.page}>
      <div className={s.pageHead}>
        <div><h1>Бүтээгдэхүүний студи ✨</h1><p>Утасны энгийн зургаас premium каталог, таны дүр өмссөн зураг, хөдөлгөөнтэй видео.</p></div>
        <div className={s.rowx}>
          {products.length > 0 && <select value={pid} onChange={(e) => pick(e.target.value)} style={{ width: "auto", minWidth: 200 }}>{products.map((p) => <option key={p._id} value={p._id}>{p.imageUrl ? "🖼 " : ""}{p.name}</option>)}</select>}
          <span className={s.pill}>Өнөөдөр {usd(st.hf.spentToday)} / ${st.cfg.media.dailyUsd}</span>
        </div>
      </div>

      <div className={s.studio}>
        <aside className={s.studioSide}>
          <div className={s.srcFrame} onClick={() => file.current?.click()} role="button" tabIndex={0}>
            {busy === "up" ? <i className={s.spinB} /> : base ? <img src={base} alt="" /> : <div className={s.srcEmpty}><Icon name="upload" size={32} /><b>Бүтээгдэхүүний зураг</b><span>Утсаар авсан энгийн зураг ч болно</span></div>}
            {base && <span className={s.srcSwap}><Icon name="refresh" size={16} />Солих</span>}
          </div>
          <input ref={file} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />

          {base && (
            <div className={s.anaBox}>
              {busy === "analyze" ? <span className={s.muted}><i className={s.spinB} /> Агент зургийг шинжилж байна…</span> : (
                <>
                  <div className={s.field}><span>Юу вэ?</span><div className={s.rowx}>{CATEGORIES.map((c) => <button key={c.id} className={s.chip} aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>{c.label}</button>)}</div></div>
                  {items.length > 0 && (
                    <div className={s.field}><span>Аль хэсгийг? <small className={s.muted}>{sel.length ? `${sel.length} сонгосон` : cat === "clothing" ? "сонгоогүй бол бүх хувцас" : "сонгоогүй бол гол бүтээгдэхүүн"}</small></span>
                      <div className={s.rowx}>{items.map((it, i) => <button key={i} className={s.chip} aria-pressed={sel.includes(i)} title={it.en} onClick={() => setSel(sel.includes(i) ? sel.filter((x) => x !== i) : [...sel, i])}>{sel.includes(i) ? "✓ " : ""}{it.mn}</button>)}</div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div className={s.field}><span>Миний дүр <small className={s.muted}>— өмсөж үзэх, кампанит ажилд</small></span>
            <div className={s.perRow}>
              <button className={s.perCard} aria-pressed={!persona} onClick={() => setPersona("")}><span>Дүргүй</span></button>
              {st.personas.map((p) => (
                <button key={p._id} className={s.perCard} aria-pressed={persona === p._id} disabled={p.status !== "ready"} onClick={() => setPersona(p._id)} title={p.status === "failed" ? p.error : p.name}>
                  {p.status === "ready" ? <img src={p.sheetUrl} alt="" /> : p.status === "rendering" ? <i className={s.spinB} /> : <Icon name="alert" size={16} />}
                  <span>{p.name}</span>
                </button>
              ))}
              <button className={s.perCard} onClick={() => go("twin", { new: "1" })}><Icon name="plus" size={20} /><span>AI ихэр</span></button>
            </div>
          </div>

          <button className={s.packBtn} disabled={!base || !!busy || packUsd > left} onClick={() => act("pack", { action: "studio-pack" }, "Premium багц эхэллээ — 1–3 минут")}>
            {busy === "pack" ? <i className={s.spin} /> : <Icon name="spark" size={24} />}
            <span><b>Premium багц · 1 товч</b><small>{[label(pk.first), ...pk.also.map(label)].join(" + ")} → {label(pk.then)} видео · ≈ {usd(packUsd)}</small></span>
          </button>
          <label className={s.rowx}><span className={s.switch}><input type="checkbox" checked={hq} onChange={(e) => setHq(e.target.checked)} /><i /></span><span className={s.muted}>Дээд чанар (илүү нарийн, үнэтэй)</span></label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Нэмэлт заавар — ж: logo-г тод харуул, @дүрийн нэр" />
        </aside>

        <div className={s.stack}>
          <section className={s.card}>
            <div className={s.cardHead}><h3>Зураг · {CATEGORIES.find((c) => c.id === cat)?.label}</h3><small>{chosen.length ? `«${sel.map((i) => items[i]?.mn).join(", ")}» дээр` : "Суурь зураг дээр ажиллана"}</small></div>
            <div className={s.tiles}>
              {forCat(IMAGE_PRESETS, cat).map((p) => {
                const needP = p.persona === "need" && !persona;
                return (
                  <button key={p.id} className={s.tile} data-tag={p.tag} disabled={!base || !!busy || needP} title={needP ? "«Миний дүр» сонгоно уу" : ""} onClick={() => act(p.id, { action: "studio", preset: p.id, hq }, `«${p.label}» эхэллээ`)}>
                    {busy === p.id ? <i className={s.spinB} /> : null}<b>{p.label}{p.persona && persona ? " · дүртэй" : ""}</b><span>{needP ? "Эхлээд «Миний дүр»-ээ сонго" : p.desc}</span><em>{usd(priceImg(p.model, p.quality))}</em>
                  </button>
                );
              })}
            </div>
          </section>
          <section className={s.card}>
            <div className={s.cardHead}><h3>Хөдөлгөөн</h3><small>Суурь зургийг 5 секундын видео болгоно</small></div>
            <div className={s.tiles}>
              {forCat(MOTION_PRESETS, cat).map((m) => (
                <button key={m.id} className={s.tile} data-tag="motion" disabled={!base || !!busy} onClick={() => act(m.id, { action: "motion", preset: m.id }, `«${m.label}» видео эхэллээ — 1–2 минут`)}>
                  {busy === m.id ? <i className={s.spinB} /> : null}<b>{m.label}</b><span>{m.desc}</span><em>{usd(priceVid)}</em>
                </button>
              ))}
            </div>
          </section>

          <section className={s.card}>
            <div className={s.cardHead}><h3>Үр дүн</h3><small>{product ? `«${product.name}»-ийн gallery` : "Бүтээгдэхүүн сонгоогүй"}</small></div>
            {results.length ? (
              <div className={s.mgrid}>
                {results.map((it) => (
                  <div key={it.key} className={s.mcard} data-s={it.running ? "running" : it.error ? "failed" : "done"}>
                    <div className={s.mthumb} style={{ aspectRatio: "1 / 1" }}>
                      {it.running ? <div className={s.mrun}><i className={s.spinB} /><span>{it.label || "Бүтээж байна"}…</span></div>
                        : it.error ? <div className={s.mrun}><Icon name="alert" size={20} /><span>{it.error}</span></div>
                        : it.kind === "video" ? <video src={it.url} autoPlay muted loop playsInline /> : <img src={it.url} alt="" loading="lazy" />}
                    </div>
                    {!it.running && !it.error && (
                      <div className={s.mbody}>
                        <div className={s.rowx}><span className={s.pill} data-k="ig">{it.label}</span>{product?.imageUrl === it.url && <span className={s.pill} data-s="published">Үндсэн</span>}</div>
                        <div className={s.pcActs}>
                          {it.kind === "image" && <button className={s.btn} onClick={() => { setBase(it.url); window.scrollTo({ top: 0, behavior: "smooth" }); say("Суурь зураг боллоо — дараагийн загвараа сонго"); }}>Үүнээс үргэлжлүүлэх</button>}
                          {it.kind === "image" && <button className={s.ghost} onClick={() => go("media", { tab: "motion", char: it.url })}>Reel-д оруулах</button>}
                          {it.mediaId && <button className={s.ghost} onClick={() => itemOp(it, "post")}>Пост болгох</button>}
                          {it.kind === "image" && product?.imageUrl !== it.url && <button className={s.ghost} onClick={() => itemOp(it, "main")}>Үндсэн болгох</button>}
                          <a className={s.ghost} href={it.url} download target="_blank" rel="noreferrer"><Icon name="download" size={16} /></a>
                          <button className={s.ghost} onClick={() => itemOp(it, "remove")} aria-label="Хасах"><Icon name="trash" size={16} /></button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : <div className={s.empty}><b>Одоогоор хоосон</b><span>«Premium багц» дээр дарж эхлээрэй — үр дүн энд гарна.</span></div>}
          </section>

          {st.personas.length > 0 && (
            <section className={s.card}>
              <div className={s.cardHead}><h3>Миний дүрүүд</h3><small>Ref sheet — Медиа студи, AI зурагтай постод ч ашиглагдана</small></div>
              <div className={s.mgrid}>
                {st.personas.map((p) => (
                  <div key={p._id} className={s.mcard}>
                    <div className={s.mthumb} style={{ aspectRatio: "3 / 2" }}>{p.status === "ready" ? <img src={p.sheetUrl} alt="" /> : <div className={s.mrun}>{p.status === "rendering" ? <><i className={s.spinB} /><span>Sheet бүтээж байна…</span></> : <><Icon name="alert" size={20} /><span>{p.error || "Амжилтгүй"}</span></>}</div>}</div>
                    <div className={s.mbody}>
                      <div className={s.rowx}><b>@{p.name}</b>{p.isDefault && <span className={s.pill} data-s="published">Үндсэн</span>}</div>
                      <div className={s.pcActs}>
                        {p.status === "ready" && !p.isDefault && <button className={s.ghost} onClick={() => perOp(p._id, "default")}>Үндсэн болгох</button>}
                        {p.status === "failed" && <button className={s.btn} onClick={() => perOp(p._id, "retry")}>Дахин оролдох</button>}
                        {p.status === "ready" && <a className={s.ghost} href={p.sheetUrl} download target="_blank" rel="noreferrer"><Icon name="download" size={16} /></a>}
                        <button className={s.ghost} onClick={() => perOp(p._id, "delete")} aria-label="Устгах"><Icon name="trash" size={16} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
