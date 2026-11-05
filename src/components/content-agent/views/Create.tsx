"use client";

import { useEffect, useRef, useState } from "react";
import Icon, { type IconName } from "@/components/Icon";
import { api, shrink, costOf, usd, PL, type Ctx, type Plat, type Post } from "../types";
import PostCard from "../PostCard";
import s from "../agent.module.css";

/* Бүтээх — эх сурвалж (санаа / зураг / сайн пост / тэмдэглэл / бүтээгдэхүүн) → хэлбэр →
   audience → хувилбарын тоо → «Бүтээх». Агент санал биш, БЭЛЭН хувилбарууд гаргана:
   үсэг засагдсан, generic хасагдсан, vector тесттэй, infographic зурагтай. */
type Src = "idea" | "image" | "top" | "note" | "product";
const SRCS: { k: Src; label: string; icon: IconName }[] = [
  { k: "idea", label: "Санаа", icon: "compose" }, { k: "image", label: "Зураг", icon: "image" }, { k: "top", label: "Сайн пост", icon: "star" },
  { k: "note", label: "Тэмдэглэл", icon: "notebook" }, { k: "product", label: "Бүтээгдэхүүн", icon: "tag" },
];
const STEPS = ["Threads ба тэмдэглэлээ уншиж байна", "Таны сэтгэлгээгээр хувилбарууд бичиж байна", "Үсэг засаж, generic хэллэг хасаж байна", "Vector тест — өмнөх постуудтай харьцуулж байна", "Бэлэн боллоо"];

export default function Create(ctx: Ctx) {
  const { st, reload, say, params } = ctx;
  const [src, setSrc] = useState<Src>((params.src as Src) || "idea");
  const [text, setText] = useState(params.idea || "");
  const [img, setImg] = useState("");
  const [postKey, setPostKey] = useState(params.post || "");
  const [noteId, setNoteId] = useState(params.note || "");
  const [productId, setProductId] = useState(params.product || st.products[0]?._id || "");
  type Fmt = "post" | "infographic" | "image" | "video";
  const [format, setFormat] = useState<Fmt>((params.format as Fmt) || "post");
  const media = format === "image" || format === "video";
  const [mModel, setMModel] = useState("");
  const [mRatio, setMRatio] = useState(st.cfg.media.ratio);
  const [mDur, setMDur] = useState(st.cfg.media.videoDur);
  const mm = st.hf.models.find((x) => x.id === mModel && x.kind === format) || st.hf.models.find((x) => x.id === (format === "video" ? st.cfg.media.videoModel : st.cfg.media.imageModel)) || st.hf.models.find((x) => x.kind === format);
  const mRes = mm ? (format === "video" && mm.res.includes(st.cfg.media.videoRes) ? st.cfg.media.videoRes : mm.res[0]) : "";
  const mD = mm && format === "video" ? (mm.durations.includes(mDur) ? mDur : mm.durations[0]) : 0;
  const mR = mm ? (mm.ratios.includes(mRatio) ? mRatio : mm.ratios[0]) : "";
  const [theme, setTheme] = useState<"light" | "dark" | "brand">("light");
  const [audienceId, setAudienceId] = useState(st.audiences.find((a) => a.isDefault)?._id || "");
  const [count, setCount] = useState(1);
  const [useImg, setUseImg] = useState(true);
  const [plats, setPlats] = useState<Plat[]>(st.cfg.channels);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [group, setGroup] = useState(params.group || "");
  const [ideaOut, setIdeaOut] = useState("");
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!busy) return; setStep(0); const t = setInterval(() => setStep((x) => Math.min(x + 1, 3)), 7000); return () => clearInterval(t); }, [busy]);
  useEffect(() => { if ((format === "infographic" || format === "image" || format === "video") && !plats.includes("instagram")) setPlats([...plats, "instagram"]); }, [format]); // eslint-disable-line react-hooks/exhaustive-deps

  const variants: Post[] = group ? st.posts.filter((p) => p.variantGroup === group) : [];
  const recentGroups = Array.from(new Map(st.posts.filter((p) => p.variantGroup && p.origin?.src !== "plan" && p.source === "idea").map((p) => [p.variantGroup, p])).values()).slice(0, 6);
  const ready = src === "idea" ? text.trim().length > 2 : src === "image" ? !!img : src === "top" ? !!postKey : src === "note" ? !!noteId : !!productId;

  async function onFile(f?: File | null) {
    if (!f) return;
    try { setImg(await shrink(f)); } catch (e) { say((e as Error).message, true); }
  }
  async function create(more = false) {
    if (!ready || busy) return;
    setBusy(true);
    try {
      const r = await api<{ group: string; idea: string; posts: Post[] }>({ action: "create", input: { source: src, text, imageDataUrl: src === "image" ? img : undefined, postKey, noteId, productId, audienceId: audienceId || undefined, format, count: more ? 1 : count, platforms: plats, theme, useProductImage: useImg, group: more ? group : undefined, media: media && mm ? { model: mm.id, ratio: mR, res: mRes, dur: mD } : undefined } });
      setStep(4); setGroup(r.group); setIdeaOut(r.idea);
      await reload();
      say(more ? "Өөр хувилбар нэмэгдлээ" : r.posts.length === 1 ? "Пост бэлэн" : `${r.posts.length} хувилбар бэлэн`);
    } catch (e) { say((e as Error).message, true); } finally { setBusy(false); }
  }

  return (
    <div className={s.page}>
      <div className={s.pageHead}><div><h1>Пост бүтээх</h1><p>Санаа, зураг, бүтээгдэхүүн эсвэл тэмдэглэлээс бэлэн пост. Таалагдахгүй бол «Өөр хувилбар».</p></div></div>
      <div className={s.create}>
        <div className={s.createIn}>
          <div className={s.card}>
            <div className={s.stack}>
              <div className={s.srcTabs}>{SRCS.map((x) => <button key={x.k} aria-pressed={src === x.k} onClick={() => setSrc(x.k)}><Icon name={x.icon} size={20} />{x.label}</button>)}</div>
              {src === "idea" && <textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder={st.me.ws === "main" ? `${st.ask}\n\nЖишээ: Claude-ийн шинэ хичээл өнөө шөнө нэмэгдэнэ. Сурагчдын ихэнх нь промтоо систем болгож чаддаггүй.` : "Ж: Шинэ загварын буйдан ирлээ, 3 өнгөтэй. Захиалга авч эхэлсэн."} onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") create(); }} />}
              {src === "image" && (
                <>
                  <div className={s.drop} onClick={() => file.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files?.[0]); }}>
                    {img ? <img src={img} alt="" /> : <><Icon name="upload" size={24} /><b>Зураг оруулах</b><span>Infographic, screenshot, слайд — агент уншаад санаа гаргана</span></>}
                  </div>
                  <input ref={file} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
                  <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Нэмэлт тайлбар (заавал биш)" />
                </>
              )}
              {src === "top" && (
                <>
                  <div className={s.pickList}>
                    {st.top.filter((t) => t.platform === "threads").slice(0, 20).map((t) => (
                      <button key={t.key} className={s.pick} aria-pressed={postKey === t.key} onClick={() => setPostKey(t.key)}>
                        <b>Оноо {t.score} · ❤ {t.likes} · 💬 {t.comments}{t.views ? ` · 👁 ${t.views}` : ""}</b><span>{t.text}</span>
                      </button>
                    ))}
                  </div>
                  <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Заавар — жишээ: илүү богино, өөр hook" />
                </>
              )}
              {src === "note" && (st.notes.length ? (
                <div className={s.pickList}>{st.notes.slice(0, 30).map((n) => <button key={n._id} className={s.pick} aria-pressed={noteId === n._id} onClick={() => setNoteId(n._id)}><b>{n.title || "Гарчиггүй"}</b><span>{n.body}</span></button>)}</div>
              ) : <div className={s.empty}><b>Тэмдэглэл алга</b><button className={s.btn} onClick={() => ctx.go("notebook")}>Тэмдэглэл бичих</button></div>)}
              {src === "product" && (st.products.length ? (
                <>
                  <select value={productId} onChange={(e) => setProductId(e.target.value)}>{st.products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</select>
                  <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Онцлох зүйл (заавал биш) — жишээ: энэ 7 хоногт бүртгэл нээлттэй" />
                  {st.products.find((x) => x._id === productId)?.imageUrl && <label className={s.rowx}><span className={s.switch}><input type="checkbox" checked={useImg} onChange={(e) => setUseImg(e.target.checked)} /><i /></span><span className={s.muted}>Бүтээгдэхүүний зургийг постонд хавсаргах</span></label>}
                </>
              ) : <div className={s.empty}><b>Бүтээгдэхүүн алга</b><button className={s.btn} onClick={() => ctx.go("products")}>Нэмэх</button></div>)}
            </div>
          </div>

          <div className={s.card}>
            <div className={s.stack}>
              <div className={s.field}><span>Хэлбэр</span>
                <div className={s.seg}>
                  <button aria-pressed={format === "post"} onClick={() => setFormat("post")}>Текст</button>
                  <button aria-pressed={format === "infographic"} onClick={() => setFormat("infographic")}>Infographic</button>
                  <button aria-pressed={format === "image"} onClick={() => setFormat("image")} disabled={!st.hf.ready}>AI зураг</button>
                  <button aria-pressed={format === "video"} onClick={() => setFormat("video")} disabled={!st.hf.ready}>AI видео</button>
                </div>
              </div>
              {media && mm && (
                <div className={s.pcPanel}>
                  <label className={s.field}><span>Higgsfield загвар</span>
                    <select value={mm.id} onChange={(e) => setMModel(e.target.value)}>{st.hf.models.filter((x) => x.kind === format).map((x) => <option key={x.id} value={x.id}>{x.label} — {x.note}</option>)}</select>
                  </label>
                  <div className={s.rowx}>{mm.ratios.map((r) => <button key={r} className={s.chip} aria-pressed={mR === r} onClick={() => setMRatio(r)}>{r}</button>)}</div>
                  {format === "video" && <div className={s.seg}>{mm.durations.map((d) => <button key={d} aria-pressed={mD === d} onClick={() => setMDur(d)}>{d}с</button>)}</div>}
                  <p className={s.muted}>Хувилбар бүрт {format === "video" ? "видео" : "зураг"} · ≈ {usd(costOf(st.hf.models, mm.id, mRes, mD) * count)} нийт · өнөөдөр {usd(st.hf.spentToday)} / ${st.cfg.media.dailyUsd}</p>
                </div>
              )}
              {format === "infographic" && <div className={s.field}><span>Өнгө</span><div className={s.seg}>{(["light", "dark", "brand"] as const).map((t) => <button key={t} aria-pressed={theme === t} onClick={() => setTheme(t)}>{t === "light" ? "Цайвар" : t === "dark" ? "Бараан" : "Брэнд"}</button>)}</div></div>}
              <div className={s.grid2}>
                <label className={s.field}><span>Audience</span>
                  <select value={audienceId} onChange={(e) => setAudienceId(e.target.value)}><option value="">Ерөнхий</option>{st.audiences.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}</select>
                </label>
                <div className={s.field}><span>Хувилбар</span><div className={s.seg}>{[1, 2, 3].map((n) => <button key={n} aria-pressed={count === n} onClick={() => setCount(n)}>{n}</button>)}</div></div>
              </div>
              <div className={s.field}><span>Суваг</span>
                <div className={s.rowx}>{(["threads", "facebook", "instagram"] as Plat[]).map((x) => <button key={x} className={s.chip} aria-pressed={plats.includes(x)} disabled={x === "instagram" && format === "post"} title={x === "instagram" && format === "post" ? "Instagram-д зураг хэрэгтэй — infographic / AI зураг / AI видео сонгоно уу" : ""} onClick={() => setPlats(plats.includes(x) ? plats.filter((y) => y !== x) : [...plats, x])}>{PL[x]}</button>)}</div>
              </div>
              <button className={`${s.pri} ${s.big}`} onClick={() => create()} disabled={!ready || busy}>
                {busy ? <><i className={s.spin} />Бүтээж байна…</> : <><Icon name="spark" size={16} />{count} хувилбар бүтээх{media ? ` + ${format === "video" ? "видео" : "зураг"}` : ""}</>}
              </button>
              {busy && <ol className={s.steps}>{STEPS.slice(0, 4).map((t, i) => <li key={t} data-s={i < step ? "done" : i === step ? "run" : "wait"}><i>{i < step ? "✓" : i === step ? <span className={s.spinB} /> : ""}</i>{t}</li>)}</ol>}
            </div>
          </div>
        </div>

        <div className={s.results}>
          {variants.length > 0 ? (
            <>
              <div className={s.resHead}><Icon name="spark" size={20} /><div><b>{variants.length === 1 ? "Бэлэн пост" : `${variants.length} хувилбар`}</b><br /><span>{ideaOut || variants[0].idea}</span></div></div>
              {variants.map((p) => <PostCard key={p._id} p={p} ctx={ctx} />)}
              <div className={s.rowx}><button className={s.btn} disabled={busy} onClick={() => create(true)}>{busy ? <i className={s.spinB} /> : <Icon name="refresh" size={16} />}Өөр хувилбар</button></div>
            </>
          ) : (
            <div className={s.card}>
              <div className={s.cardHead}><h3>Сүүлд бүтээсэн</h3><small>Хувилбар бүр Санд хадгалагдана</small></div>
              {recentGroups.length ? (
                <div className={s.stack}>{recentGroups.map((p) => (
                  <button key={p.variantGroup} className={s.pick} onClick={() => setGroup(p.variantGroup)}>
                    <b>{st.posts.filter((x) => x.variantGroup === p.variantGroup).length} хувилбар · {p.kind === "infographic" ? "Infographic" : p.kind === "image" ? "AI зураг" : p.kind === "video" ? "AI видео" : "Пост"}</b><span>{p.idea || p.text}</span>
                  </button>
                ))}</div>
              ) : <div className={s.empty}><b>Эхний санаагаа оруул</b><span>Агент таны Threads, тэмдэглэл, сэтгэлгээнээс суралцаж хэд хэдэн хувилбар бүтээнэ.</span></div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
