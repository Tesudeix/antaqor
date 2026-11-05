"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import { api, when, type Ctx, type Post } from "../types";
import PostCard from "../PostCard";
import s from "../agent.module.css";

/* Нүүр — нэг том асуулт «Юуны тухай пост хийх вэ?» → НЭГ бэлэн пост (+ «Өөр хувилбар»).
   Шинэ байгууллагад 4 алхмын жагсаалт. Доор нь удахгүй гарах ба анхаарах постууд. */
type Fmt = "post" | "image" | "video";
const FMTS: { k: Fmt; label: string }[] = [{ k: "post", label: "Текст" }, { k: "image", label: "Зурагтай" }, { k: "video", label: "Видео" }];

export default function Home(ctx: Ctx) {
  const { st, go, reload, say, params } = ctx;
  const owner = st.me.ws === "main";
  const [idea, setIdea] = useState(params.idea || "");
  const [fmt, setFmt] = useState<Fmt>("post");
  const [productId, setProductId] = useState(params.product || "");
  const [busy, setBusy] = useState("");
  const [group, setGroup] = useState("");
  const personas = st.personas.filter((p) => p.status === "ready");
  const [persona, setPersona] = useState(personas.find((p) => p.isDefault)?._id || "");
  const product = st.products.find((p) => p._id === productId);
  const usePersona = fmt === "image" && !product && !!persona;
  useEffect(() => { if (product?.imageUrl && fmt === "post") setFmt("image"); }, [productId]); // eslint-disable-line react-hooks/exhaustive-deps

  const now = Date.now();
  const upcoming = st.posts.filter((p) => p.status === "scheduled" && +new Date(p.at) > now - 3600e3).sort((a, b) => +new Date(a.at) - +new Date(b.at)).slice(0, 6);
  const held = st.posts.filter((p) => p.status === "held").slice(0, 3);
  const made: Post[] = group ? st.posts.filter((p) => p.variantGroup === group) : [];
  const connected = st.accounts.meta.length + st.accounts.threads.length > 0;
  const steps = [
    { done: true, t: "Бизнесээ танилцуулсан", go: () => go("settings") },
    { done: connected, t: "Хуудсаа холбох", go: () => go("connect") },
    { done: st.posts.some((p) => ["scheduled", "published"].includes(p.status)), t: "Анхны постоо нийтлэх", go: () => document.getElementById("composer")?.focus() },
    { done: st.cfg.auto, t: "Автомат горимыг асаах", go: () => go("settings") },
  ];
  const showSteps = !owner && steps.some((x) => !x.done);
  const visual = fmt !== "post" && !(fmt === "image" && product?.imageUrl);
  const noHf = visual && !st.hf.ready;

  async function create(more = false) {
    if (busy || (!idea.trim() && !product)) return;
    setBusy(more ? "more" : "make");
    try {
      const input = product
        ? { source: "product", productId: product._id, text: idea, format: fmt, count: 1, useProductImage: fmt !== "post", group: more ? group : undefined }
        : { source: "idea", text: idea, format: fmt, count: 1, group: more ? group : undefined, media: usePersona ? { personaId: persona } : undefined };
      const r = await api<{ group: string }>({ action: "create", input });
      setGroup(r.group);
      await reload();
      say(more ? "Өөр хувилбар нэмэгдлээ" : fmt === "post" ? "Пост бэлэн" : "Пост бэлэн — зураг/видео удахгүй гарна");
    } catch (e) { say((e as Error).message, true); } finally { setBusy(""); }
  }

  const h = new Date(+new Date() + 8 * 3600e3).getUTCHours();
  return (
    <div className={s.page}>
      {params.step === "3" && <div className={s.onbSteps}><span>1. Бизнес ✓</span><i /><span>2. Хуудас ✓</span><i /><span data-on>3. Анхны пост</span></div>}
      <div className={s.pageHead}><div><h1>{h < 12 ? "Өглөөний мэнд" : h < 18 ? "Өдрийн мэнд" : "Оройн мэнд"}{st.me.name ? `, ${st.me.name}` : ""} 👋</h1>
        <p>{st.cfg.auto ? "Агент автоматаар ажиллаж байна." : "Агент танд бэлэн пост бэлдэнэ — та шалгаад нийтэлнэ."}</p></div></div>

      {showSteps && (
        <section className={s.checklist}>
          {steps.map((x, i) => (
            <button key={x.t} data-done={x.done} onClick={x.go}><i>{x.done ? <Icon name="check" size={16} /> : i + 1}</i><span>{x.t}</span>{!x.done && <Icon name="chevron" size={16} />}</button>
          ))}
        </section>
      )}

      <section className={s.composer}>
        <label htmlFor="composer">Юуны тухай пост хийх вэ?</label>
        <textarea id="composer" rows={3} value={idea} onChange={(e) => setIdea(e.target.value)} placeholder={owner ? st.ask : "Ж: Шинэ загварын буйдан ирлээ, 3 өнгөтэй. Захиалга авч эхэлсэн."}
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") create(); }} />
        <div className={s.composerRow}>
          <div className={s.seg}>{FMTS.map((f) => <button key={f.k} aria-pressed={fmt === f.k} onClick={() => setFmt(f.k)}>{f.label}</button>)}</div>
          {st.products.length > 0 && (
            <select value={productId} onChange={(e) => setProductId(e.target.value)} aria-label="Бүтээгдэхүүн" style={{ width: "auto", minWidth: 180 }}>
              <option value="">Бүтээгдэхүүн сонгох (заавал биш)</option>
              {st.products.filter((p) => p.active).map((p) => <option key={p._id} value={p._id}>{p.imageUrl ? "🖼 " : ""}{p.name}</option>)}
            </select>
          )}
          {fmt === "image" && !product && personas.length > 0 && (
            <select value={persona} onChange={(e) => setPersona(e.target.value)} aria-label="Миний дүр" style={{ width: "auto", minWidth: 150 }}>
              <option value="">Дүргүй зураг</option>
              {personas.map((p) => <option key={p._id} value={p._id}>@{p.name}</option>)}
            </select>
          )}
          <span style={{ flex: 1 }} />
          <button className={`${s.pri} ${s.big}`} disabled={(!idea.trim() && !product) || !!busy || noHf} onClick={() => create()}>
            {busy === "make" ? <><i className={s.spin} />Бичиж байна…</> : <><Icon name="spark" size={20} />Пост бүтээх</>}
          </button>
        </div>
        {product?.imageUrl && fmt !== "post" && <p className={s.muted}>«{product.name}»-ийн зураг {fmt === "video" ? "хөдөлгөөнтэй видео болно" : "постонд хавсарна"}.</p>}
        {noHf && <p className={s.muted}>AI зураг/видео одоогоор идэвхгүй байна.</p>}
      </section>

      {made.length > 0 && (
        <section className={s.stack}>
          {made.map((p) => <PostCard key={p._id} p={p} ctx={ctx} />)}
          <div className={s.rowx}>
            <button className={s.btn} disabled={!!busy} onClick={() => create(true)}>{busy === "more" ? <i className={s.spinB} /> : <Icon name="refresh" size={16} />}Өөр хувилбар</button>
            <button className={s.ghost} onClick={() => { setGroup(""); setIdea(""); }}>Шинэ пост</button>
          </div>
        </section>
      )}

      <div className={s.grid2}>
        <section className={s.card}>
          <div className={s.cardHead}><h3>Удахгүй нийтлэгдэх</h3><button className={s.ghost} onClick={() => go("planner")}>Хуанли →</button></div>
          {upcoming.length ? <div className={s.timeline}>{upcoming.map((p) => { const w = when(p.at); return <div key={p._id} className={s.tl}><time>{w.time}<small>{w.day}</small></time><i /><span>{p.kind === "video" ? "🎬 " : (p.kind || "text") !== "text" ? "🖼 " : ""}{p.text.split("\n")[0]}</span></div>; })}</div>
            : <div className={s.empty}><b>Товлосон пост алга</b><span>Дээрээс пост бүтээгээд «Нийтлэх» дарна уу.</span></div>}
        </section>
        <section className={s.card}>
          <div className={s.cardHead}><h3>Сүүлд нийтэлсэн</h3><button className={s.ghost} onClick={() => go("insights")}>Үр дүн →</button></div>
          {(() => { const recent = st.posts.filter((p) => p.status === "published").sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 5); return recent.length
            ? <div className={s.timeline}>{recent.map((p) => <div key={p._id} className={s.tl}><time>{when(p.at).time}<small>{when(p.at).day}</small></time><i /><span>❤ {p.metrics.likes} 💬 {p.metrics.comments} — {p.text.split("\n")[0]}</span></div>)}</div>
            : <p className={s.muted}>Нийтлэгдсэн постын хандалт энд харагдана.</p>; })()}
        </section>
      </div>

      {held.length > 0 && (
        <section className={s.stack}>
          <div className={s.cardHead}><h3>Анхаарах</h3><small>Шалгаад, засаад нийтэлнэ үү</small></div>
          {held.map((p) => <PostCard key={p._id} p={p} ctx={ctx} />)}
        </section>
      )}
    </div>
  );
}
