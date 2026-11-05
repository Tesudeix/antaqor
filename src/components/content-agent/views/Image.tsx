"use client";

import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import Icon from "@/components/Icon";
import { api, fee, upload, usd, when, type Ctx, type Media as M, budgetLeft } from "../types";
import { AUTO, IMG_MODELS, RATIO_USE, autoPick, imgCost, imgModel, imgNorm, type ImgModel } from "@/lib/agentImageModels";
import ShareDialog, { type ShareItem } from "../ShareDialog";
import s from "../agent.module.css";

/* ─── AI зураг (2026-10-24) — Higgsfield-ийн Image хуудсаас санаа авсан ───
   Дээр: бүтээлүүд (нэг удаагийн бүтээлт = нэг мөр). Доор: нэг мөр промпт + сонголтууд.
   Хэрэглэгч загвар мэдэх шаардлагагүй — «Автомат» бичсэнээс нь сонгоно. Монголоор бичнэ,
   агент англи руу хөрвүүлж сайжруулна (бичгийг өөрчлөхгүй). @ — AI ихэр, + — лавлах зураг. */

type Pop = "" | "model" | "ratio" | "q" | "res" | "plus" | "at";
type Saved = { model: string; ratio: string; res: string; q: string; count: number; enhance: boolean };
const KEY = "agent.image.v1";
const IDEAS: { t: string; p: string }[] = [
  { t: "Бүтээгдэхүүн", p: "Манай бүтээгдэхүүнийг цагаан гантиг ширээн дээр, зөөлөн өглөөний гэрэлтэй, тансаг студийн зураг" },
  { t: "Постер", p: "Кофе шопын постер, дээр нь \"ШИНЭ АМТ −20%\" гэж том бичсэн, дулаан өнгө" },
  { t: "Хоол", p: "Халуун хуушуур модон тавган дээр, уур гарсан, амттай харагдах ойрын зураг" },
  { t: "Монгол байгаль", p: "Хангайн уулс, нар жаргах үе, морьтой залуу, кино шиг өргөн зураг" },
  { t: "Сошиал пост", p: "Залуу бизнес эмэгтэй оффисдоо ноутбук дээр AI ашиглаж байна, Instagram-д тохирох тод зураг" },
  { t: "Лого / график", p: "Минимал лого: цасан ирвэс, хар ба цэнхэр өнгө, цагаан дэвсгэр" },
];

function loadSaved(): Partial<Saved> {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}") as Partial<Saved>; } catch { return {}; }
}
/** Харьцааны жижиг дүрс (хэлбэрээр нь таньдаг) */
function Shape({ r }: { r: string }) {
  const [w, h] = r === "auto" ? [1, 1] : r.split(":").map(Number);
  const k = 16 / Math.max(w, h);
  return <i className={s.shape} data-auto={r === "auto" || undefined} style={{ width: Math.max(6, w * k), height: Math.max(6, h * k) }} />;
}

export default function ImageStudio(ctx: Ctx) {
  const { st, reload, say, go, params } = ctx;
  const google = st.hf.google !== false;
  const ready = st.personas.filter((p) => p.status === "ready" && p.sheetUrl);
  const [saved] = useState<Partial<Saved>>(() => (typeof window === "undefined" ? {} : loadSaved()));
  const [model, setModel] = useState(saved.model && (saved.model === AUTO || imgModel(saved.model)) ? saved.model : AUTO);
  const [ratio, setRatio] = useState(saved.ratio || "auto");
  const [res, setRes] = useState(saved.res || "");
  const [q, setQ] = useState(saved.q || "");
  const [count, setCount] = useState(Math.min(4, Math.max(1, saved.count || 1)));
  const [enhance, setEnhance] = useState(saved.enhance !== false);
  const pre = ready.find((p) => p._id === params.at);
  const [prompt, setPrompt] = useState(params.prompt || (pre ? `@${pre.name} ` : ""));
  const [refs, setRefs] = useState<string[]>(params.ref ? [params.ref] : []);
  const [pers, setPers] = useState<string[]>(pre ? [pre._id] : []);
  const [pop, setPop] = useState<Pop>("");
  const [busy, setBusy] = useState("");
  const [drag, setDrag] = useState(false);
  const [view, setView] = useState<M | null>(null);
  const [toPost, setToPost] = useState<{ id: string; idea: string } | null>(null);
  const [share, setShare] = useState<ShareItem | null>(null);
  /* гишүүний горим: пост/видео (бизнесийн боломж) нуугдана, community-д хуваалцах үндсэн үйлдэл */
  const isBiz = st.me.mode !== "member";
  const file = useRef<HTMLInputElement>(null);
  const ta = useRef<HTMLTextAreaElement>(null);
  const bar = useRef<HTMLDivElement>(null);

  /* «Автомат» үед аль загвар сонгогдохыг шууд харуулна */
  const nRefs = refs.length + pers.length;
  const auto = autoPick(prompt, nRefs, google);
  const m: ImgModel = imgModel(model === AUTO ? auto.id : model) || imgModel("gpt2")!;
  const n = imgNorm(m, { ratio, res, q });
  const unit = imgCost(m.id, n.res, n.q);
  const cost = unit * count;
  const left = budgetLeft(st);
  const refOver = nRefs > m.refs;
  const down = m.provider === "google" && !google;
  const can = st.hf.ready && prompt.trim().length >= 3 && cost <= left + 1e-9 && !down;
  const why = !st.hf.ready ? "Higgsfield тохируулаагүй" : prompt.trim().length < 3 ? "Юу зурахаа бичнэ үү" : down ? `${m.label} түр ажиллахгүй — өөр загвар сонгоно уу` : cost > left ? `Өнөөдрийн хязгаар хүрэлцэхгүй (үлдэгдэл ${usd(Math.max(0, left))})` : "";

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify({ model, ratio, res, q, count, enhance } satisfies Saved)); } catch { /* хувийн цонх */ }
  }, [model, ratio, res, q, count, enhance]);
  /* Цонхны гадна дарахад цэс хаагдана */
  useEffect(() => {
    if (!pop) return;
    const h = (e: MouseEvent) => { if (bar.current && !bar.current.contains(e.target as Node)) setPop(""); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [pop]);
  useEffect(() => {
    const el = ta.current; if (!el) return;
    el.style.height = "auto"; el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, [prompt]);

  /* бүтээлүүд — нэг удаагийн бүтээлт (batch) нэг мөр, хамгийн шинэ нь дээрээ */
  const images = useMemo(() => st.media.filter((x) => x.kind === "image"), [st.media]);
  const groups = useMemo(() => {
    const out: { key: string; items: M[] }[] = [];
    const at = new Map<string, number>();
    for (const x of images) {
      const k = x.batch || x._id;
      if (!at.has(k)) { at.set(k, out.length); out.push({ key: k, items: [] }); }
      out[at.get(k)!].items.push(x);
    }
    return out;
  }, [images]);
  const done = images.filter((x) => x.status === "done");
  const prodImgs = Array.from(new Set(st.products.flatMap((p) => [p.imageUrl, ...(p.gallery || []).filter((g) => g.kind === "image").map((g) => g.url)]).filter(Boolean))).slice(0, 24);

  async function addFiles(list: FileList | File[] | null | undefined) {
    const files = Array.from(list || []).filter((f) => f.type.startsWith("image/")).slice(0, 10 - refs.length);
    if (!files.length) return;
    setBusy("up");
    try {
      for (const f of files) { const r = await upload(f); if (r.kind === "image") setRefs((x) => (x.includes(r.url) ? x : [...x, r.url].slice(0, 10))); }
      setPop("");
    } catch (e) { say((e as Error).message, true); } finally { setBusy(""); }
  }
  const toggleRef = (u: string) => setRefs((x) => (x.includes(u) ? x.filter((y) => y !== u) : [...x, u].slice(0, 10)));
  function togglePer(id: string) {
    const p = ready.find((x) => x._id === id); if (!p) return;
    if (pers.includes(id)) { setPers((x) => x.filter((y) => y !== id)); setPrompt((t) => t.replace(new RegExp(`@${p.name}\\s?`, "g"), "")); }
    else { setPers((x) => [...x, id].slice(0, 3)); if (!prompt.includes(`@${p.name}`)) setPrompt((t) => `${t.replace(/@$/, "")}${t && !/[\s@]$/.test(t) ? " " : ""}@${p.name} `); }
    setPop(""); ta.current?.focus();
  }
  function reuse(x: M) {
    setPrompt(x.idea || x.prompt); setModel(imgModel(x.modelId) ? x.modelId : AUTO);
    if (x.ratio) setRatio(x.ratio); if (x.res) setRes(x.res); if (x.q) setQ(x.q);
    setRefs((x.refs || []).filter((u) => !ready.some((p) => p.sheetUrl === u)));
    setPers(ready.filter((p) => (x.refs || []).includes(p.sheetUrl)).map((p) => p._id));
    setView(null); ta.current?.focus();
  }
  async function generate() {
    if (!can || busy) return;
    setBusy("gen"); setPop("");
    try {
      const r = await api<{ ids: string[]; label: string; usd: number; auto: boolean }>({ action: "image-gen", model, prompt, enhance, ratio: n.ratio, res: n.res, q: n.q, count, refs, personaIds: pers });
      say(`${r.ids.length} зураг бүтээж байна · ${r.label}${r.auto ? " (автомат)" : ""} · ${fee(st.me, r.usd, r.ids.length)} — ~30 сек`);
      await reload();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) { say((e as Error).message, true); } finally { setBusy(""); }
  }
  async function del(x: M) {
    try { await api({ action: "media-del", id: x._id }); setView(null); await reload(); } catch (e) { say((e as Error).message, true); }
  }
  async function makePost() {
    if (!toPost) return;
    setBusy("post");
    try { const r = await api<{ group: string }>({ action: "media-post", id: toPost.id, idea: toPost.idea, count: 1 }); setToPost(null); setView(null); await reload(); go("create", { group: r.group }); }
    catch (e) { say((e as Error).message, true); } finally { setBusy(""); }
  }
  function onPaste(e: ClipboardEvent) {
    const f = Array.from(e.clipboardData.files || []).filter((x) => x.type.startsWith("image/"));
    if (f.length) { e.preventDefault(); addFiles(f); }
  }
  function onDrop(e: DragEvent) { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }
  /* lightbox: ← → товчоор шилжинэ */
  useEffect(() => {
    if (!view) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") setView(null);
      const i = done.findIndex((x) => x._id === view._id);
      if (e.key === "ArrowRight" && i >= 0 && i < done.length - 1) setView(done[i + 1]);
      if (e.key === "ArrowLeft" && i > 0) setView(done[i - 1]);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [view, done]);

  const label = (id: string) => imgModel(id)?.label || st.hf.models.find((y) => y.id === id)?.label || id;
  const qLabel = m.quals.find((x) => x.id === n.q)?.label;

  return (
    <div className={s.page} data-image onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDrag(true); } }} onDragLeave={(e) => { if (e.currentTarget === e.target) setDrag(false); }} onDrop={onDrop}>
      <div className={s.pageHead}>
        <div><h1>AI зураг</h1><p>Санаагаа Монголоор бичээд «Бүтээх» дар. Зураг оруулж, AI ихрээ дуудаж болно.</p></div>
        <div className={s.rowx}><span className={s.pill}>{isBiz ? <>Өнөөдөр {usd(st.hf.spentToday)}{Number.isFinite(left) ? ` / $${st.cfg.media.dailyUsd}` : " · хязгааргүй"}</> : <>Үнэгүй · өдрийн хязгаартай</>}</span></div>
      </div>

      {groups.length === 0 ? (
        <div className={s.imgEmpty}>
          <span className={s.imgEmptyIc}><Icon name="image" size={32} /></span>
          <b>Анхны зургаа бүтээгээрэй</b>
          <p>Доорх санаануудаас сонгох эсвэл өөрийнхөөрөө бичээрэй. Юу хүсч байгаагаа энгийнээр бичихэд хангалттай.</p>
          <div className={s.ideaGrid}>
            {IDEAS.map((x, i) => <button key={x.t} className={s.idea} data-i={i} onClick={() => { setPrompt(x.p); ta.current?.focus(); }}><b>{x.t}</b><span>{x.p}</span></button>)}
          </div>
        </div>
      ) : (
        <div className={s.batches}>
          {groups.map((g) => {
            const h = g.items[0];
            return (
              <section key={g.key} className={s.batch}>
                <header>
                  <p title={h.idea || h.prompt}>{h.idea || h.prompt}</p>
                  <div className={s.rowx}>
                    <span className={s.pill}>{label(h.modelId)}</span>
                    {h.ratio && <span className={s.pill}>{h.ratio === "auto" ? "Авто" : h.ratio}</span>}
                    <span className={s.muted}>{when(h.createdAt).day} {when(h.createdAt).time}</span>
                    <button className={s.ghost} onClick={() => reuse(h)} title="Энэ тохиргоогоор дахин бүтээх"><Icon name="refresh" size={16} />Дахин</button>
                  </div>
                </header>
                <div className={s.bgrid}>
                  {g.items.map((x) => (
                    <div key={x._id} className={s.gtile} data-s={x.status} style={{ aspectRatio: x.status === "done" ? undefined : (x.ratio && x.ratio !== "auto" ? x.ratio : "1:1").replace(":", " / ") }}>
                      {x.status === "done" ? (
                        <>
                          <button className={s.tileImg} onClick={() => setView(x)} aria-label="Томоор харах"><img src={x.url} alt="" loading="lazy" /></button>
                          <div className={s.tileActs}>
                            <a href={x.url} download target="_blank" rel="noreferrer" title="Татах"><Icon name="download" size={16} /></a>
                            <button onClick={() => toggleRef(x.url)} title="Лавлах зураг болгох" aria-pressed={refs.includes(x.url)}><Icon name="plus" size={16} /></button>
                            <button onClick={() => setShare({ url: x.url, prompt: x.idea })} title="Community-д хуваалцах"><Icon name="send" size={16} /></button>
                            {isBiz && <button onClick={() => go("media", { tab: "video", image: x.url })} title="Видео болгох"><Icon name="play" size={16} /></button>}
                          </div>
                        </>
                      ) : x.status === "running" ? (
                        <div className={s.tileRun}><i className={s.spinB} /><span>{!x.requestId && !(x.endpoint || "").startsWith("google:") ? "Дараалалд…" : "Зурж байна…"}</span><small>{label(x.modelId)}</small></div>
                      ) : (
                        <div className={s.tileRun} data-bad><Icon name="alert" size={20} /><span>{x.error || "Амжилтгүй"}</span>
                          <div className={s.rowx}><button className={s.ghost} onClick={() => reuse(x)}>Дахин</button><button className={s.ghost} onClick={() => del(x)} aria-label="Устгах"><Icon name="trash" size={16} /></button></div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* ── Доод мөр: промпт + сонголтууд ── */}
      <div className={s.composer2} ref={bar} data-drag={drag || undefined}>
        {drag && <div className={s.dropHint}><Icon name="upload" size={24} />Зургаа энд тавина уу</div>}
        {(refs.length > 0 || pers.length > 0) && (
          <div className={s.refRow}>
            {pers.map((id) => { const p = ready.find((x) => x._id === id); return p ? <span key={id} className={s.refChip} data-per><img src={p.sheetUrl} alt="" /><b>@{p.name}</b><button onClick={() => togglePer(id)} aria-label="Хасах"><Icon name="cancel" size={12} /></button></span> : null; })}
            {refs.map((u, i) => <span key={u} className={s.refChip}><img src={u} alt="" /><b>{pers.length + i + 1}</b><button onClick={() => toggleRef(u)} aria-label="Хасах"><Icon name="cancel" size={12} /></button></span>)}
            {refOver && <span className={s.refWarn}>{m.refs ? `${m.label} ${m.refs} хүртэл зураг авна` : `${m.label} зураг авдаггүй — «Автомат» сонговол зурагтай ажиллана`}</span>}
          </div>
        )}
        <textarea ref={ta} rows={1} value={prompt} onPaste={onPaste} placeholder="Юу зурах вэ? Монголоор бичээрэй…"
          onChange={(e) => { setPrompt(e.target.value); if (/(^|\s)@$/.test(e.target.value) && ready.length) setPop("at"); }}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); generate(); } }} />
        <div className={s.cbar}>
          <div className={s.cchips}>
            <button className={s.cbtn} data-ic onClick={() => setPop(pop === "plus" ? "" : "plus")} aria-expanded={pop === "plus"} title="Зураг оруулах">{busy === "up" ? <i className={s.spinB} /> : <Icon name="plus" size={20} />}</button>
            <button className={s.cbtn} data-ic onClick={() => setPop(pop === "at" ? "" : "at")} aria-expanded={pop === "at"} title="AI ихэр дуудах"><b className={s.atSign}>@</b></button>
            <span className={s.csep} />
            <button className={s.cbtn} onClick={() => setPop(pop === "model" ? "" : "model")} aria-expanded={pop === "model"}>
              <Icon name="spark" size={16} />{model === AUTO ? <>Автомат<em>· {m.label}</em></> : m.label}<Icon name="chevronDown" size={12} />
            </button>
            <button className={s.cbtn} onClick={() => setPop(pop === "ratio" ? "" : "ratio")} aria-expanded={pop === "ratio"}><Shape r={n.ratio} />{n.ratio === "auto" ? "Авто" : n.ratio}</button>
            {m.quals.length > 0 && <button className={s.cbtn} onClick={() => setPop(pop === "q" ? "" : "q")} aria-expanded={pop === "q"}><Icon name="star" size={16} />{qLabel}</button>}
            {m.res.length > 1 && <button className={s.cbtn} onClick={() => setPop(pop === "res" ? "" : "res")} aria-expanded={pop === "res"}>{n.res.toUpperCase()}</button>}
            <span className={s.stepper}>
              <button onClick={() => setCount(Math.max(1, count - 1))} disabled={count <= 1} aria-label="Цөөн">−</button>
              <b>{count}/4</b>
              <button onClick={() => setCount(Math.min(4, count + 1))} disabled={count >= 4} aria-label="Олон">+</button>
            </span>
            <button className={s.cbtn} aria-pressed={enhance} onClick={() => setEnhance(!enhance)} title="Агент таны санааг англи руу хөрвүүлж, гэрэл, зохиомж нэмнэ. Бичсэн текстийг өөрчлөхгүй.">
              <Icon name="bolt" size={16} />Сайжруулах
            </button>
          </div>
          <button className={s.genBtn} onClick={generate} disabled={!can || !!busy} title={why}>
            {busy === "gen" ? <><i className={s.spin} />Илгээж байна</> : <>Бүтээх<small>{isBiz ? usd(cost) : fee(st.me, cost, count)}</small></>}
          </button>
        </div>
        {why && prompt.trim().length >= 3 && <p className={s.cwhy}>{why}</p>}

        {pop === "model" && (
          <div className={s.popover} data-wide>
            <button className={s.mrow} aria-pressed={model === AUTO} onClick={() => { setModel(AUTO); setPop(""); }}>
              <span className={s.mIc} data-auto><Icon name="spark" size={20} /></span>
              <div><b>Автомат <small>· санал болгох</small></b><span>Агент таны бичсэн санаа, зурагнаас хамгийн тохирох загварыг сонгоно. Одоо: <b>{imgModel(auto.id)?.label}</b> — {auto.why}.</span></div>
            </button>
            {IMG_MODELS.map((x) => {
              const off = x.provider === "google" && !google;
              const nn = imgNorm(x, {});
              return (
                <button key={x.id} className={s.mrow} aria-pressed={model === x.id} disabled={off} onClick={() => { setModel(x.id); setPop(""); }}>
                  <span className={s.mIc} data-by={x.provider === "google" ? "google" : x.by.startsWith("OpenAI") ? "openai" : x.by === "xAI" ? "xai" : "other"}>{x.label.slice(0, 1)}</span>
                  <div>
                    <b>{x.label} <small>· {x.by}</small></b>
                    <span>{x.note}</span>
                    <div className={s.mTags}>{off ? <em data-bad>Түр ажиллахгүй{st.me.superAdmin ? " — Google AI Studio-д цэнэглэнэ үү" : ""}</em> : <>{x.refs > 0 && <em>Зураг оруулж болно</em>}{x.tags.map((t) => <em key={t}>{t}</em>)}</>}</div>
                  </div>
                  {isBiz && <i className={s.mPrice}>≈{usd(imgCost(x.id, nn.res, nn.q))}</i>}
                </button>
              );
            })}
          </div>
        )}
        {pop === "ratio" && (
          <div className={s.popover}>
            <p className={s.popT}>Хэмжээ — хаана ашиглах вэ?</p>
            <div className={s.ratioGrid}>
              {m.ratios.map((r) => <button key={r} aria-pressed={n.ratio === r} onClick={() => { setRatio(r); setPop(""); }}><Shape r={r} /><b>{r === "auto" ? "Авто" : r}</b><span>{r === "auto" ? "Загвар өөрөө" : RATIO_USE[r] || ""}</span></button>)}
            </div>
          </div>
        )}
        {pop === "q" && (
          <div className={s.popover}>
            <p className={s.popT}>Чанар</p>
            {m.quals.map((x) => <button key={x.id} className={s.optRow} aria-pressed={n.q === x.id} onClick={() => { setQ(x.id); setPop(""); }}><b>{x.label}</b><span>{x.hint}</span>{isBiz && <i>{usd(imgCost(m.id, n.res, x.id))}</i>}</button>)}
          </div>
        )}
        {pop === "res" && (
          <div className={s.popover}>
            <p className={s.popT}>Нягтрал</p>
            {m.res.map((r) => <button key={r} className={s.optRow} aria-pressed={n.res === r} onClick={() => { setRes(r); setPop(""); }}><b>{r.toUpperCase()}</b><span>{r === "1k" || r === "720p" ? "Сошиал пост" : r === "2k" || r === "1080p" ? "Тод, том дэлгэц" : "Хэвлэл, баннер"}</span>{isBiz && <i>{usd(imgCost(m.id, r, n.q))}</i>}</button>)}
          </div>
        )}
        {pop === "plus" && (
          <div className={s.popover} data-wide>
            <button className={s.optRow} onClick={() => file.current?.click()}><Icon name="upload" size={20} /><b>Зураг оруулах</b><span>Утас, компьютероос · эсвэл энд чирж / Ctrl+V</span></button>
            {prodImgs.length > 0 && <><p className={s.popT}>Бүтээгдэхүүний зураг</p><div className={s.pickGrid}>{prodImgs.map((u) => <button key={u} aria-pressed={refs.includes(u)} onClick={() => toggleRef(u)}><img src={u} alt="" /></button>)}</div></>}
            {done.length > 0 && <><p className={s.popT}>Миний бүтээлүүд</p><div className={s.pickGrid}>{done.slice(0, 18).map((x) => <button key={x._id} aria-pressed={refs.includes(x.url)} onClick={() => toggleRef(x.url)}><img src={x.url} alt="" /></button>)}</div></>}
          </div>
        )}
        {pop === "at" && (
          <div className={s.popover}>
            <p className={s.popT}>AI ихэр дуудах</p>
            {ready.length ? ready.map((p) => (
              <button key={p._id} className={s.optRow} aria-pressed={pers.includes(p._id)} onClick={() => togglePer(p._id)}><img className={s.perAv} src={p.sheetUrl} alt="" /><b>@{p.name}</b><span>Зурганд яг энэ хүн орно</span></button>
            )) : <p className={s.muted} style={{ padding: "4px 6px 8px" }}>Танд AI ихэр алга. Өөрийн зургаар ихрээ бүтээгээд энд дуудаарай.</p>}
            <button className={s.optRow} onClick={() => go("twin", { new: "1" })}><Icon name="plus" size={20} /><b>Шинэ AI ихэр</b><span>Өөрийн зургаар</span></button>
          </div>
        )}
        <input ref={file} type="file" accept="image/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
      </div>

      {/* ── Томоор харах ── */}
      {view && (
        <div className={s.lightbox} onClick={() => setView(null)}>
          <div className={s.lbIn} onClick={(e) => e.stopPropagation()}>
            <div className={s.lbImg}><img src={view.url} alt="" /></div>
            <aside className={s.lbSide}>
              <div className={s.rowx}><span className={s.pill}>{label(view.modelId)}</span>{view.ratio && <span className={s.pill}>{view.ratio === "auto" ? "Авто" : view.ratio}</span>}{view.res && <span className={s.pill}>{view.res.toUpperCase()}</span>}{isBiz && <span className={s.pill}>{usd(view.usd)}</span>}<button className={s.ghost} style={{ marginLeft: "auto" }} onClick={() => setView(null)} aria-label="Хаах"><Icon name="cancel" size={20} /></button></div>
              <p className={s.lbIdea}>{view.idea || view.prompt}</p>
              {view.idea && view.prompt !== view.idea && <details className={s.lbPrompt}><summary>AI-д илгээсэн промпт</summary><p>{view.prompt}</p></details>}
              {toPost?.id === view._id ? (
                <div className={s.stack}>
                  <textarea rows={3} value={toPost.idea} onChange={(e) => setToPost({ ...toPost, idea: e.target.value })} placeholder="Юуны тухай пост вэ? (хоосон бол зургаас бичнэ)" />
                  <div className={s.rowx}><button className={s.ghost} onClick={() => setToPost(null)}>Болих</button><button className={s.pri} disabled={busy === "post"} onClick={makePost}>{busy === "post" ? <><i className={s.spin} />Бичиж байна…</> : "Пост бичүүлэх"}</button></div>
                </div>
              ) : (
                <div className={s.lbActs}>
                  <button className={isBiz ? s.btn : s.pri} onClick={() => setShare({ url: view.url, prompt: view.idea })}><Icon name="send" size={16} />Community-д хуваалцах</button>
                  {isBiz && <button className={s.pri} onClick={() => setToPost({ id: view._id, idea: view.idea })}><Icon name="compose" size={16} />Пост болгох</button>}
                  <a className={s.btn} href={view.url} download target="_blank" rel="noreferrer"><Icon name="download" size={16} />Татах</a>
                  <button className={s.btn} onClick={() => { toggleRef(view.url); setView(null); }}><Icon name="plus" size={16} />Лавлах зураг болгох</button>
                  {isBiz && <button className={s.btn} onClick={() => go("media", { tab: "video", image: view.url })}><Icon name="play" size={16} />Видео болгох</button>}
                  <button className={s.btn} onClick={() => reuse(view)}><Icon name="refresh" size={16} />Дахин бүтээх</button>
                  <button className={s.danger} onClick={() => del(view)}><Icon name="trash" size={16} />Устгах</button>
                </div>
              )}
            </aside>
          </div>
        </div>
      )}
      {share && <ShareDialog item={share} onClose={() => setShare(null)} say={say} />}
    </div>
  );
}
