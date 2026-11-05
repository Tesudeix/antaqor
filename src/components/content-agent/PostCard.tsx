"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import { api, FMT, PL, toLocal, fromLocal, when, costOf, usd, type Ctx, type IgSpec, type Plat, type Post } from "./types";
import s from "./agent.module.css";

/* Нэг постын карт — засах · үсэг засах · нийтлэх/товлох (олон аккаунт) · infographic загвар */
type Panel = "" | "edit" | "publish" | "design" | "media";
const ST: Record<string, string> = { draft: "Ноорог", scheduled: "Товлогдсон", held: "Анхаарах", published: "Нийтлэгдсэн", failed: "Алдаа" };

export default function PostCard({ p, ctx, compact }: { p: Post; ctx: Ctx; compact?: boolean }) {
  const { st, reload, say } = ctx;
  const [panel, setPanel] = useState<Panel>("");
  const [text, setText] = useState(p.text);
  const [at, setAt] = useState(toLocal(+new Date(p.at) > Date.now() + 120e3 ? p.at : new Date(Date.now() + 3600e3)));
  const [plats, setPlats] = useState<Plat[]>(p.platforms);
  const [meta, setMeta] = useState(p.metaAccount || st.cfg.accounts.metaAccount || st.accounts.meta[0]?.key || "");
  const [thr, setThr] = useState(p.threadsUserId || st.cfg.accounts.threadsUserId || st.accounts.threads[0]?.id || "");
  const [spec, setSpec] = useState<IgSpec | null>(p.infographic);
  const [theme, setTheme] = useState((p.infographic as { theme?: string } | null)?.theme || "light");
  const [busy, setBusy] = useState("");
  const [open, setOpen] = useState(false);
  /* AI медиа (Higgsfield) */
  const [mk, setMk] = useState<"image" | "video">(p.kind === "video" ? "video" : p.imageUrl ? "video" : "image");
  const [mModel, setMModel] = useState("");
  const [mRatio, setMRatio] = useState(st.cfg.media.ratio);
  const [mDur, setMDur] = useState(st.cfg.media.videoDur);
  const [fromImage, setFromImage] = useState(!!p.imageUrl);
  const [note, setNote] = useState("");
  const mm = st.hf.models.find((x) => x.id === mModel && x.kind === mk) || st.hf.models.find((x) => x.id === (mk === "video" ? st.cfg.media.videoModel : st.cfg.media.imageModel)) || st.hf.models.find((x) => x.kind === mk);
  const mRes = mm ? (mk === "video" && mm.res.includes(st.cfg.media.videoRes) ? st.cfg.media.videoRes : mm.res[0]) : "";
  const mD = mm && mk === "video" ? (mm.durations.includes(mDur) ? mDur : mm.durations[0]) : 0;
  const mR = mm ? (mm.ratios.includes(mRatio) ? mRatio : mm.ratios[0]) : "";
  const rendering = p.mediaState === "rendering";
  const hasMedia = !!(p.imageUrl || p.videoUrl) || rendering || p.mediaState === "failed";
  const editable = ["draft", "held", "failed"].includes(p.status);
  useEffect(() => { if (panel !== "edit") setText(p.text); }, [p.text, panel]);
  const len = Array.from(text).length;
  const ratio = p.pred.base ? p.pred.score / p.pred.base : 0;
  const w = when(p.at);
  const scheduledLike = p.status === "scheduled" || p.status === "published";

  async function run(name: string, body: Record<string, unknown>, ok: string) {
    setBusy(name);
    try { const r = await api<{ queued?: boolean }>({ action: "post", id: p._id, ...body }); say(r.queued ? "Медиа бэлэн болмогц автоматаар товлогдоно" : ok); setPanel(""); await reload(); }
    catch (e) { say((e as Error).message, true); } finally { setBusy(""); }
  }
  async function fix() {
    setBusy("fix");
    try {
      const r = await api<{ text: string; fixes: { from: string; to: string }[]; generic: string[] }>({ action: "polish", text });
      setText(r.text);
      say(r.fixes.length || r.generic.length ? `${r.fixes.length} үсэг засав · ${r.generic.length} generic хэллэг солив` : "Алдаа олдсонгүй");
    } catch (e) { say((e as Error).message, true); } finally { setBusy(""); }
  }
  const togglePlat = (x: Plat) => setPlats(plats.includes(x) ? plats.filter((y) => y !== x) : [...plats, x]);

  return (
    <article className={s.pc} data-media={hasMedia && !compact} data-held={p.status === "held"}>
      {hasMedia && !compact && (
        <div className={s.pcMedia}>
          {rendering ? <div className={s.mrun}><i className={s.spinB} /><span>{p.kind === "video" ? "AI видео" : "AI зураг"} бүтээж байна…</span>{p.queued && <small>Бэлэн болмогц товлогдоно</small>}</div>
            : p.videoUrl ? <video src={p.videoUrl} controls playsInline preload="metadata" poster={p.imageUrl || undefined} />
            : p.imageUrl ? <img src={p.imageUrl} alt="" loading="lazy" />
            : <div className={s.mrun}><span>Медиа амжилтгүй</span></div>}
          {(p.videoUrl || p.imageUrl) && !rendering && <a href={p.videoUrl || p.imageUrl} target="_blank" rel="noreferrer" download>Татах</a>}
        </div>
      )}
      <div className={s.pcBody}>
        <div className={s.pcMeta}>
          {scheduledLike && <span className={s.pill} data-k="time">{w.day} {w.time}</span>}
          <span className={s.pill} data-s={p.status}>{ST[p.status] || p.status}</span>
          {p.kind === "infographic" ? <span className={s.pill} data-k="ig"><Icon name="image" size={12} />Infographic</span> : p.kind === "image" || p.kind === "video" ? <span className={s.pill} data-k="ig"><Icon name={p.kind === "video" ? "video" : "image"} size={12} />{FMT[p.kind]}</span> : null}
          {p.kind !== "infographic" && <span className={s.pill}>{p.angle || FMT[p.format]}</span>}
          {p.platforms.map((x) => <span key={x} className={s.pill}>{PL[x]}</span>)}
          {p.audience && <span className={s.pill}>{p.audience}</span>}
          {st.me.ws === "main" && <span className={`${s.pill} ${s.grow}`} data-k="test" title={["Ижил төстэй өмнөх постууд:", ...(p.pred.nn || []).map((n) => `[${n.score}] ${n.text}`)].join("\n")}>
            Тест {p.pred.score}{ratio > 0 ? ` · ${ratio >= 1 ? `${ratio.toFixed(1)}×` : "доогуур"}` : ""} · шинэ {Math.round(p.pred.novelty * 100)}%
          </span>}
        </div>
        {p.status === "held" && p.holdReason && <p className={s.pcReason}>{p.holdReason}</p>}
        {p.status === "failed" && p.holdReason && <p className={s.pcReason}>{p.holdReason}</p>}

        {panel === "edit" ? (
          <div className={s.pcPanel}>
            <textarea rows={Math.min(14, Math.max(4, text.split("\n").length + 1))} value={text} onChange={(e) => setText(e.target.value)} />
            <div className={s.rowx}>
              <span className={s.cnt} data-over={plats.includes("threads") && len > 500}>{len}{plats.includes("threads") ? "/500" : ""}</span>
              <button className={s.btn} onClick={fix} disabled={!!busy}>{busy === "fix" ? <i className={s.spinB} /> : <Icon name="spark" size={16} />}Үсэг засах + generic хасах</button>
              <span style={{ flex: 1 }} />
              <button className={s.ghost} onClick={() => { setPanel(""); setText(p.text); }}>Болих</button>
              <button className={s.pri} disabled={!!busy || !text.trim()} onClick={() => run("edit", { op: "edit", text }, "Хадгаллаа")}>Хадгалах</button>
            </div>
          </div>
        ) : (
          <>
            <p className={s.pcText} data-clamp={!open && text.split("\n").length > 7}>{p.text}</p>
            {!open && p.text.split("\n").length > 7 && <button className={s.more} onClick={() => setOpen(true)}>Бүгдийг харах</button>}
          </>
        )}

        {((p.fixes || []).length > 0 || (p.generic || []).length > 0) && panel !== "edit" && (
          <div className={s.pcNotes}>
            {(p.fixes || []).length > 0 && <span title={p.fixes.map((f) => `${f.from} → ${f.to}`).join("\n")}>✓ {p.fixes.length} үсэг засагдсан</span>}
            {(p.generic || []).length > 0 && <span title={p.generic.join("\n")}>✓ {p.generic.length} хоосон хэллэг солигдсон</span>}
          </div>
        )}
        {p.status === "published" && (
          <div className={s.pcMetrics}>
            <span>❤ {p.metrics.likes}</span><span>💬 {p.metrics.comments}</span>{p.metrics.views > 0 && <span>👁 {p.metrics.views}</span>}<span>оноо {p.metrics.score}</span>
            {p.results.filter((r) => r.permalink).map((r) => <a key={r.platform} href={r.permalink} target="_blank" rel="noreferrer">{PL[r.platform as Plat] || r.platform} ↗</a>)}
          </div>
        )}

        {panel === "publish" && (
          <div className={s.pcPanel}>
            <div className={s.rowx}>
              {(["threads", "facebook", "instagram"] as Plat[]).map((x) => (
                <button key={x} className={s.chip} aria-pressed={plats.includes(x)} disabled={x === "instagram" && !p.imageUrl && !p.videoUrl && !rendering} title={x === "instagram" && !p.imageUrl && !p.videoUrl && !rendering ? "Instagram-д зураг/видео хэрэгтэй — «AI медиа»" : ""} onClick={() => togglePlat(x)}>{PL[x]}</button>
              ))}
            </div>
            <div className={s.grid2}>
              {plats.some((x) => x !== "threads") && (
                <label className={s.field}><span>Facebook / Instagram хуудас</span>
                  <select value={meta} onChange={(e) => setMeta(e.target.value)}>{st.accounts.meta.map((m) => <option key={m.key} value={m.key}>{m.label || m.key}{m.instagram ? " · IG" : ""}</option>)}</select>
                </label>
              )}
              {plats.includes("threads") && (
                <label className={s.field}><span>Threads аккаунт</span>
                  <select value={thr} onChange={(e) => setThr(e.target.value)}>{st.accounts.threads.map((t) => <option key={t.id} value={t.id}>@{t.username}{t.ok ? "" : " (дахин холбох)"}</option>)}</select>
                </label>
              )}
            </div>
            <div className={s.rowx}>
              <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
              <span style={{ flex: 1 }} />
              <button className={s.btn} disabled={!!busy || !plats.length} onClick={() => run("now", { op: "now", platforms: plats, metaAccount: meta, threadsUserId: thr }, "1 минутын дараа нийтлэгдэнэ")}><Icon name="bolt" size={16} />Одоо</button>
              <button className={s.pri} disabled={!!busy || !plats.length} onClick={() => run("schedule", { op: "schedule", at: fromLocal(at), platforms: plats, metaAccount: meta, threadsUserId: thr }, "Товлогдлоо")}><Icon name="calendar" size={16} />Товлох</button>
            </div>
          </div>
        )}

        {panel === "design" && spec && (
          <div className={s.pcPanel}>
            <div className={s.rowx}>
              <div className={s.seg}>{(["light", "dark", "brand"] as const).map((t) => <button key={t} aria-pressed={theme === t} onClick={() => setTheme(t)}>{t === "light" ? "Цайвар" : t === "dark" ? "Бараан" : "Брэнд"}</button>)}</div>
              <div className={s.seg}>{(["steps", "list", "compare", "stat"] as const).map((t) => <button key={t} aria-pressed={spec.template === t} onClick={() => setSpec({ ...spec, template: t })}>{t === "steps" ? "Алхам" : t === "list" ? "Жагсаалт" : t === "compare" ? "Харьцуулах" : "Тоо"}</button>)}</div>
            </div>
            <input value={spec.title} onChange={(e) => setSpec({ ...spec, title: e.target.value })} placeholder="Гарчиг" />
            <input value={spec.subtitle || ""} onChange={(e) => setSpec({ ...spec, subtitle: e.target.value })} placeholder="Дэд гарчиг" />
            {spec.template === "compare" && <div className={s.grid2}><input value={spec.left || ""} onChange={(e) => setSpec({ ...spec, left: e.target.value })} placeholder="Зүүн багана (Өмнө)" /><input value={spec.right || ""} onChange={(e) => setSpec({ ...spec, right: e.target.value })} placeholder="Баруун багана (Одоо)" /></div>}
            <div className={s.igItems}>
              {spec.items.map((it, i) => (
                <div key={i} className={s.igItem}>
                  <span>{i + 1}</span>
                  <input value={it.title} onChange={(e) => setSpec({ ...spec, items: spec.items.map((x, k) => (k === i ? { ...x, title: e.target.value } : x)) })} />
                  <input value={it.text || ""} onChange={(e) => setSpec({ ...spec, items: spec.items.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)) })} />
                  <button className={s.ghost} onClick={() => setSpec({ ...spec, items: spec.items.filter((_, k) => k !== i) })} aria-label="Хасах"><Icon name="cancel" size={12} /></button>
                </div>
              ))}
              {spec.items.length < 6 && <button className={s.ghost} onClick={() => setSpec({ ...spec, items: [...spec.items, { title: "", text: "" }] })}>+ Мөр нэмэх</button>}
            </div>
            <input value={spec.cta || ""} onChange={(e) => setSpec({ ...spec, cta: e.target.value })} placeholder="Доод мөр (CTA)" />
            <div className={s.rowx}><span style={{ flex: 1 }} /><button className={s.ghost} onClick={() => setPanel("")}>Болих</button>
              <button className={s.pri} disabled={!!busy} onClick={() => run("rerender", { op: "rerender", spec, theme }, "Infographic шинэчлэгдлээ")}>{busy === "rerender" ? <><i className={s.spin} />Зурж байна…</> : "Дахин зурах"}</button>
            </div>
          </div>
        )}

        {panel === "media" && mm && (
          <div className={s.pcPanel}>
            <div className={s.rowx}>
              <div className={s.seg}><button aria-pressed={mk === "image"} onClick={() => setMk("image")}>AI зураг</button><button aria-pressed={mk === "video"} onClick={() => setMk("video")}>AI видео</button></div>
              <select style={{ flex: 1, minWidth: 160 }} value={mm.id} onChange={(e) => setMModel(e.target.value)}>{st.hf.models.filter((x) => x.kind === mk).map((x) => <option key={x.id} value={x.id}>{x.label} — {x.note}</option>)}</select>
            </div>
            {!(mk === "video" && fromImage && p.imageUrl) && <div className={s.rowx}>{mm.ratios.map((r) => <button key={r} className={s.chip} aria-pressed={mR === r} onClick={() => setMRatio(r)}>{r}</button>)}</div>}
            {mk === "video" && <div className={s.rowx}><div className={s.seg}>{mm.durations.map((d) => <button key={d} aria-pressed={mD === d} onClick={() => setMDur(d)}>{d}с</button>)}</div>
              {p.imageUrl && mm.epImage && <label className={s.rowx}><span className={s.switch}><input type="checkbox" checked={fromImage} onChange={(e) => setFromImage(e.target.checked)} /><i /></span><span className={s.muted}>Одоогийн зургийг хөдөлгөөнтэй болгох</span></label>}</div>}
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Нэмэлт заавар (заавал биш) — ж: шөнийн гэрэл, утсан дээр ойрын план" />
            <div className={s.rowx}><span className={s.muted}>≈ {usd(costOf(st.hf.models, mm.id, mRes, mD))} · агент постоос промпт бичнэ</span><span style={{ flex: 1 }} /><button className={s.ghost} onClick={() => setPanel("")}>Болих</button>
              <button className={s.pri} disabled={!!busy || !st.hf.ready} onClick={() => run("media", { op: "media", kind: mk, note, media: { model: mm.id, ratio: mR, res: mRes, dur: mD, fromImage: mk === "video" && fromImage && !!p.imageUrl } }, `${mk === "video" ? "Видео" : "Зураг"} бүтээж эхэллээ`)}>{busy === "media" ? <><i className={s.spin} />Илгээж байна…</> : "Бүтээх"}</button>
            </div>
          </div>
        )}

        {panel === "" && (
          <div className={s.pcActs}>
            {["draft", "held", "failed"].includes(p.status) && <button className={s.pri} onClick={() => setPanel("publish")}><Icon name="send" size={16} />Нийтлэх</button>}
            {p.status !== "published" && <button className={s.btn} onClick={() => setPanel("edit")}><Icon name="edit" size={16} />Засах</button>}
            {p.kind === "infographic" && p.status !== "published" && <button className={s.btn} onClick={() => setPanel("design")}><Icon name="image" size={16} />Загвар</button>}
            {editable && !rendering && st.hf.ready && <button className={s.btn} onClick={() => setPanel("media")}><Icon name="video" size={16} />{p.videoUrl || (p.imageUrl && p.kind === "image") ? "Медиа солих" : "AI медиа"}</button>}
            {editable && !rendering && (p.kind === "image" || p.kind === "video") && <button className={s.ghost} onClick={() => run("detach", { op: "detach" }, "Медиа хаслаа")}>Медиа хасах</button>}
            {p.status === "scheduled" && <button className={s.btn} onClick={() => run("now", { op: "edit", at: new Date(Date.now() + 70e3).toISOString() }, "1 минутын дараа нийтлэгдэнэ")}><Icon name="bolt" size={16} />Одоо</button>}
            <button className={s.ghost} onClick={() => run("dup", { op: "duplicate" }, "Хуулбар үүслээ — Сан")}><Icon name="copy" size={16} />Хуулах</button>
            {p.status !== "published" && <button className={s.ghost} onClick={() => run("del", { op: "delete" }, "Устгалаа")}><Icon name="trash" size={16} /></button>}
          </div>
        )}
      </div>
    </article>
  );
}
