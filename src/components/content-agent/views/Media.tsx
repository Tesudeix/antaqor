"use client";

import { useRef, useState } from "react";
import Icon from "@/components/Icon";
import { api, upload, costOf, usd, when, fee, type Ctx, type HfModel, type Media as M, budgetLeft } from "../types";
import ShareDialog, { type ShareItem } from "../ShareDialog";
import s from "../agent.module.css";

/* Медиа студи — Higgsfield: AI зураг (Soul 2, Recraft, Ideogram), AI видео (Wan 3.0, Kling,
   Seedance), Genjutsu (эх видеоны хөдөлгөөнийг дүр/бүтээгдэхүүнд шилжүүлэх).
   Бэлэн болсон медиаг «Пост болгох» — агент caption-уудыг таны хэв маягаар бичнэ. */
type Tab = "image" | "video" | "motion";
/* 2026-10-24: AI зураг тусдаа «AI зураг» хэсэгт шилжсэн — энд видео + Genjutsu */
const TABS: { k: Tab; label: string }[] = [{ k: "video", label: "AI видео" }, { k: "motion", label: "Genjutsu" }];
const unitLabel = (m: HfModel) => (m.unit === "img" ? "/зураг" : m.kind === "motion" ? "/эх сек" : "/сек");

export default function Media(ctx: Ctx) {
  const { st, reload, say, go, params } = ctx;
  /* 2026-10-26: гишүүн AI видеог (Kling 4.0, Wan…) КРЕДИТЭЭР хийнэ — Genjutsu, «Пост болгох» бизнест */
  const member = st.me.mode === "member";
  const [share, setShare] = useState<ShareItem | null>(null);
  const models = st.hf.models;
  const [tab, setTab] = useState<Tab>(params.tab === "motion" ? "motion" : "video");
  const pickDefault = (t: Tab) => (t === "image" ? st.cfg.media.imageModel : t === "video" ? st.cfg.media.videoModel : "genjutsuLite");
  /* Студиос «Reel-д оруулах» → хувцас/бүтээгдэхүүн солих загвар */
  const [model, setModel] = useState(params.char ? "genjutsuSwap" : pickDefault(params.tab === "motion" ? "motion" : "video"));
  const m = models.find((x) => x.id === model) || models.find((x) => x.kind === tab)!;
  const [prompt, setPrompt] = useState(params.prompt || "");
  const [enhance, setEnhance] = useState(true);
  const [ratio, setRatio] = useState(st.cfg.media.ratio);
  const [res, setRes] = useState("");
  const [dur, setDur] = useState(st.cfg.media.videoDur);
  const [start, setStart] = useState(params.image || "");
  const [src, setSrc] = useState<{ url: string; dur: number } | null>(null);
  const [chars, setChars] = useState<string[]>(params.char ? [params.char] : []);
  const [link, setLink] = useState("");
  const [reels, setReels] = useState<{ id: string; permalink: string; thumb: string; caption: string; account: string }[] | null>(null);
  const personas = st.personas.filter((p) => p.status === "ready");
  const [persona, setPersona] = useState("");
  const prodImgs = Array.from(new Set([...personas.map((p) => p.sheetUrl), ...st.products.flatMap((p) => [p.imageUrl, ...(p.gallery || []).filter((g) => g.kind === "image").map((g) => g.url)])].filter(Boolean))).slice(0, 18);
  const [busy, setBusy] = useState("");
  const [toPost, setToPost] = useState<{ id: string; idea: string } | null>(null);
  const fImg = useRef<HTMLInputElement>(null), fVid = useRef<HTMLInputElement>(null), fChar = useRef<HTMLInputElement>(null);

  const R = m.ratios.includes(ratio) ? ratio : m.ratios[0] || "";
  const RES = m.res.includes(res) ? res : tab === "video" && m.res.includes(st.cfg.media.videoRes) ? st.cfg.media.videoRes : m.res[0];
  const D = tab === "video" ? (m.durations.includes(dur) ? dur : m.durations[0]) : tab === "motion" ? Math.ceil(src?.dur || 0) : 0;
  const cost = costOf(models, m.id, RES, D);
  const left = budgetLeft(st);
  const ready = st.hf.ready && (tab === "motion" ? !!src && chars.length > 0 : prompt.trim().length > 2) && cost <= left + 1e-9;
  const list = st.media.filter((x) => (tab === "image" ? x.kind === "image" : x.kind === "video"));

  function switchTab(t: Tab) { setTab(t); setModel(pickDefault(t)); setRes(""); }
  async function up(file: File | undefined | null, kind: "start" | "src" | "char") {
    if (!file) return;
    setBusy(`up-${kind}`);
    try {
      const r = await upload(file);
      if (kind === "src") { if (r.kind !== "video") throw new Error("Видео сонгоно уу"); setSrc({ url: r.url, dur: r.dur || 0 }); }
      else { if (r.kind !== "image") throw new Error("Зураг сонгоно уу"); if (kind === "start") setStart(r.url); else setChars((c) => [...c, r.url].slice(0, 4)); }
    } catch (e) { say((e as Error).message, true); } finally { setBusy(""); }
  }
  async function generate() {
    if (!ready || busy) return;
    setBusy("gen");
    try {
      const r = await api<{ id: string; usd: number }>({ action: "media", model: m.id, prompt, enhance, ratio: R, res: RES, dur: D, imageUrl: tab === "video" ? start || undefined : undefined, videoUrl: src?.url, imageUrls: chars, refDur: src?.dur, personaId: tab === "image" && persona ? persona : undefined });
      say(`Бүтээж эхэллээ · ${fee(st.me, r.usd)} — ${tab === "image" ? "~30 сек" : "1–5 мин"}`);
      await reload();
    } catch (e) { say((e as Error).message, true); } finally { setBusy(""); }
  }
  async function importLink(url = link) {
    if (!url.trim()) return;
    setBusy("link");
    try { const r = await api<{ url: string; dur: number; via: string }>({ action: "reel-import", url }); setSrc({ url: r.url, dur: r.dur }); setReels(null); say(`Видео татагдлаа (${r.dur}с · ${r.via})`); }
    catch (e) { say((e as Error).message, true); } finally { setBusy(""); }
  }
  async function myReels() {
    setBusy("reels");
    try { const r = await api<{ reels: { id: string; permalink: string; thumb: string; caption: string; account: string }[] }>({ action: "reel-list" }); setReels(r.reels); if (!r.reels.length) say("Холбосон Instagram-д татаж болох Reel олдсонгүй", true); }
    catch (e) { say((e as Error).message, true); } finally { setBusy(""); }
  }
  async function makePost() {
    if (!toPost) return;
    setBusy("post");
    try { const r = await api<{ group: string }>({ action: "media-post", id: toPost.id, idea: toPost.idea, count: 3 }); setToPost(null); await reload(); go("create", { group: r.group }); }
    catch (e) { say((e as Error).message, true); } finally { setBusy(""); }
  }
  async function del(x: M) {
    try { await api({ action: "media-del", id: x._id }); await reload(); } catch (e) { say((e as Error).message, true); }
  }

  return (
    <div className={s.page}>
      <div className={s.pageHead}>
        <div><h1>AI видео</h1><p>{member ? "Kling 4.0, Wan, Seedance — санаагаа бичээд видео бүтээ. Гишүүдэд үнэгүй." : "Wan, Kling, Seedance видео ба Genjutsu."} Зураг бүтээх бол <button className={s.linkBtn} onClick={() => go("image")}>AI зураг</button> руу.</p></div>
        {member ? (
          <div className={s.rowx}><span className={s.pill}>Үнэгүй · өдрийн хязгаартай</span></div>
        ) : (
          <div className={s.rowx}><span className={s.pill} data-k={st.hf.ready ? "ig" : undefined}>{st.hf.ready ? "Higgsfield холбогдсон" : "Higgsfield тохируулаагүй"}</span><span className={s.pill}>Өнөөдөр {usd(st.hf.spentToday)}{Number.isFinite(left) ? ` / $${st.cfg.media.dailyUsd}` : " · хязгааргүй"}</span></div>
        )}
      </div>
      <div className={s.create}>
        <div className={s.createIn}>
          <div className={s.card}>
            <div className={s.stack}>
              <div className={s.seg}>{(member ? TABS.filter((t) => t.k === "video") : TABS).map((t) => <button key={t.k} aria-pressed={tab === t.k} onClick={() => switchTab(t.k)}>{t.label}</button>)}</div>
              <div className={s.models}>
                {models.filter((x) => x.kind === tab).map((x) => (
                  <button key={x.id} className={s.pick} aria-pressed={m.id === x.id} onClick={() => { setModel(x.id); setRes(""); }}>
                    <b>{x.label} <em>{member ? `${fee(st.me, Math.min(...Object.values(x.price)) * (x.unit === "s" ? 5 : 1))}${x.unit === "s" ? " / 5с" : ""}` : `${usd(Math.min(...Object.values(x.price)))}${unitLabel(x)}`}</em></b><span>{x.note}</span>
                  </button>
                ))}
              </div>

              {tab === "motion" ? (
                <>
                  <div className={s.grid2}>
                    <div className={s.drop} data-sm onClick={() => fVid.current?.click()}>
                      {busy === "up-src" ? <i className={s.spinB} /> : src ? <video src={src.url} muted playsInline loop autoPlay /> : <><Icon name="video" size={24} /><b>Эх видео</b><span>Хөдөлгөөн (≤15с)</span></>}
                    </div>
                    <div className={s.drop} data-sm onClick={() => chars.length < 4 && fChar.current?.click()}>
                      {busy === "up-char" ? <i className={s.spinB} /> : chars.length ? <div className={s.thumbs}>{chars.map((c) => <img key={c} src={c} alt="" />)}</div> : <><Icon name="image" size={24} /><b>Дүр / бүтээгдэхүүн</b><span>1–4 зураг</span></>}
                    </div>
                  </div>
                  <div className={s.linkRow}>
                    <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Instagram Reel эсвэл TikTok холбоос буулгах" onKeyDown={(e) => { if (e.key === "Enter") importLink(); }} />
                    <button className={s.btn} disabled={!link.trim() || !!busy} onClick={() => importLink()}>{busy === "link" ? <i className={s.spinB} /> : <Icon name="download" size={16} />}Татах</button>
                  </div>
                  <div className={s.rowx}>
                    <button className={s.ghost} disabled={!!busy} onClick={myReels}>{busy === "reels" ? <i className={s.spinB} /> : <Icon name="video" size={16} />}Миний Reels</button>
                    <span className={s.muted} style={{ fontSize: 12.5 }}>Бусдын Instagram Reel-ийг Instagram серверээс татуулдаггүй — утсандаа хадгалаад «Эх видео»-д оруулна уу. TikTok холбоос шууд ажиллана.</span>
                  </div>
                  {reels && reels.length > 0 && (
                    <div className={s.reelGrid}>{reels.map((r) => <button key={r.id} onClick={() => importLink(r.permalink)} title={r.caption}>{r.thumb ? <img src={r.thumb} alt="" /> : <Icon name="video" size={20} />}</button>)}</div>
                  )}
                  {prodImgs.length > 0 && (
                    <div className={s.field}><span>Бүтээгдэхүүний зургаас сонгох</span>
                      <div className={s.reelGrid} data-sq>{prodImgs.map((u) => <button key={u} aria-pressed={chars.includes(u)} onClick={() => setChars((c) => (c.includes(u) ? c.filter((x) => x !== u) : [...c, u].slice(0, 4)))}><img src={u} alt="" /></button>)}</div>
                    </div>
                  )}
                  <input ref={fVid} type="file" accept="video/*" hidden onChange={(e) => up(e.target.files?.[0], "src")} />
                  <input ref={fChar} type="file" accept="image/*" hidden onChange={(e) => up(e.target.files?.[0], "char")} />
                  {(src || chars.length > 0) && <div className={s.rowx}>{src && <span className={s.pill}>Эх видео {src.dur}с</span>}{chars.length > 0 && <button className={s.ghost} onClick={() => setChars([])}>Зургуудыг цэвэрлэх</button>}{src && <button className={s.ghost} onClick={() => setSrc(null)}>Видеог солих</button>}</div>}
                  <input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={m.id === "genjutsuSwap" ? "Юуг солих вэ (англиар) — ж: replace her outfit with this outfit" : "Нэмэлт заавар (англиар, заавал биш) — ж: keep the background"} />
                </>
              ) : (
                <>
                  <textarea rows={4} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={tab === "image" ? "Юу зурах вэ — Монголоор бичиж болно. Ж: Залуу creator шөнө ноутбук дээрээ AI agent-уудаа ажиллуулж байна" : "Ямар видео — Монголоор бичиж болно. Ж: Утсан дээрх AI agent-ийн мэдэгдэл creator-ийн нүүрийг гэрэлтүүлнэ, камер аажмаар ойртоно"} />
                  <label className={s.rowx}><span className={s.switch}><input type="checkbox" checked={enhance} onChange={(e) => setEnhance(e.target.checked)} /><i /></span><span className={s.muted}>Агент промптыг брэндийн арт дирекшнээр сайжруулна (англи, бичиггүй)</span></label>
                  {tab === "image" && personas.length > 0 && (
                    <div className={s.field}><span>Миний дүр <small className={s.muted}>— сонговол зурганд таны дүр орно</small></span>
                      <div className={s.perRow}>
                        <button className={s.perCard} aria-pressed={!persona} onClick={() => setPersona("")}><span>Дүргүй</span></button>
                        {personas.map((p) => <button key={p._id} className={s.perCard} aria-pressed={persona === p._id} onClick={() => setPersona(p._id)}><img src={p.sheetUrl} alt="" /><span>{p.name}</span></button>)}
                      </div>
                    </div>
                  )}
                  {tab === "video" && (
                    <div className={s.drop} data-sm onClick={() => fImg.current?.click()}>
                      {busy === "up-start" ? <i className={s.spinB} /> : start ? <img src={start} alt="" /> : <><Icon name="image" size={24} /><b>Эхлэх зураг (заавал биш)</b><span>Зургийг хөдөлгөөнтэй болгоно</span></>}
                    </div>
                  )}
                  {tab === "video" && start && <button className={s.ghost} onClick={() => setStart("")}>Эхлэх зургийг хасах</button>}
                  <input ref={fImg} type="file" accept="image/*" hidden onChange={(e) => up(e.target.files?.[0], "start")} />
                </>
              )}

              {tab !== "motion" && !(tab === "video" && start) && <div className={s.field}><span>Харьцаа</span><div className={s.rowx}>{m.ratios.map((r) => <button key={r} className={s.chip} aria-pressed={R === r} onClick={() => setRatio(r)}>{r}</button>)}</div></div>}
              <div className={s.grid2}>
                {m.res.length > 1 && <div className={s.field}><span>{m.kind === "image" && m.id === "ideogram" ? "Горим" : "Чанар"}</span><div className={s.seg}>{m.res.map((r) => <button key={r} aria-pressed={RES === r} onClick={() => setRes(r)}>{r}</button>)}</div></div>}
                {tab === "video" && <div className={s.field}><span>Урт</span><div className={s.seg}>{m.durations.map((d) => <button key={d} aria-pressed={D === d} onClick={() => setDur(d)}>{d}с</button>)}</div></div>}
              </div>
              <button className={`${s.pri} ${s.big}`} onClick={generate} disabled={!ready || !!busy}>
                {busy === "gen" ? <><i className={s.spin} />Илгээж байна…</> : <><Icon name="spark" size={16} />Бүтээх · {fee(st.me, cost)}</>}
              </button>
              <p className={s.muted}>{cost > left ? (member ? "Өнөөдрийн хязгаар дууслаа — маргааш дахин." : `Өнөөдрийн хязгаар хүрэлцэхгүй (үлдэгдэл ${usd(Math.max(0, left))}) — Тохиргооноос нэмнэ.`) : tab === "motion" ? "Genjutsu: эх видеоны хөдөлгөөн, камер, дууг хадгалж, дүрийг таны зургаар солино. Үнэ эх видеоны секундээр." : `Higgsfield-ийн одоогийн үнэ.${Number.isFinite(left) ? ` Өнөөдрийн үлдэгдэл ${usd(Math.max(0, left))}.` : ""}`}</p>
            </div>
          </div>
        </div>

        <div className={s.results}>
          {toPost && (
            <div className={s.card}>
              <div className={s.cardHead}><h3>Пост болгох</h3><small>Агент 3 caption бичиж медиаг хавсаргана</small></div>
              <div className={s.stack}>
                <textarea rows={3} value={toPost.idea} onChange={(e) => setToPost({ ...toPost, idea: e.target.value })} placeholder="Юуны тухай пост вэ? (заавал биш — хоосон бол дүрслэлээс бичнэ)" />
                <div className={s.rowx}><span style={{ flex: 1 }} /><button className={s.ghost} onClick={() => setToPost(null)}>Болих</button><button className={s.pri} disabled={busy === "post"} onClick={makePost}>{busy === "post" ? <><i className={s.spin} />Бичиж байна…</> : "3 хувилбар бичих"}</button></div>
              </div>
            </div>
          )}
          {list.length ? (
            <div className={s.mgrid}>
              {list.map((x) => (
                <div key={x._id} className={s.mcard} data-s={x.status}>
                  <div className={s.mthumb} style={{ aspectRatio: (x.ratio || "1:1").replace(":", " / ") }}>
                    {x.status === "done" ? (x.kind === "video" ? <video src={x.url} controls playsInline preload="metadata" /> : <img src={x.url} alt="" loading="lazy" />)
                      : x.status === "running" ? <div className={s.mrun}><i className={s.spinB} /><span>{x.kind === "video" ? "Видео бүтээж байна" : "Зурж байна"}…</span><small>{when(x.createdAt).time}-с</small></div>
                      : <div className={s.mrun}><Icon name="alert" size={20} /><span>{x.error || "Амжилтгүй"}</span></div>}
                  </div>
                  <div className={s.mbody}>
                    <div className={s.rowx}><span className={s.pill}>{models.find((y) => y.id === x.modelId)?.label || x.modelId}</span>{x.dur > 0 && <span className={s.pill}>{x.dur}с</span>}{!member && <span className={s.pill}>{usd(x.usd)}</span>}{x.postId && <span className={s.pill} data-k="ig">Постонд</span>}</div>
                    <p title={x.prompt}>{x.idea || x.prompt}</p>
                    <div className={s.pcActs}>
                      {x.status === "done" && !member && <button className={s.pri} onClick={() => setToPost({ id: x._id, idea: x.idea })}><Icon name="compose" size={16} />Пост болгох</button>}
                      {x.status === "done" && <button className={member ? s.pri : s.btn} onClick={() => setShare({ url: x.url, prompt: x.idea, video: x.kind === "video", dur: x.dur })}><Icon name="send" size={16} />Community-д</button>}
                      {x.status === "done" && x.kind === "image" && <button className={s.btn} onClick={() => { switchTab("video"); setStart(x.url); window.scrollTo({ top: 0, behavior: "smooth" }); }}><Icon name="play" size={16} />Хөдөлгөх</button>}
                      {x.status === "done" && <a className={s.ghost} href={x.url} download target="_blank" rel="noreferrer"><Icon name="download" size={16} /></a>}
                      {x.status !== "running" && <button className={s.ghost} onClick={() => del(x)} aria-label="Устгах"><Icon name="trash" size={16} /></button>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={s.card}><div className={s.empty}><b>{tab === "image" ? "AI зураг алга" : "AI видео алга"}</b><span>Зүүн талаас загвараа сонгоод эхний медиагаа бүтээ. Бүх медиа энд хадгалагдана.</span></div></div>
          )}
        </div>
      </div>
      {share && <ShareDialog item={share} onClose={() => setShare(null)} say={say} />}
    </div>
  );
}
