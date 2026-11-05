"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Icon from "@/components/Icon";
import { WEEKDAYS, PLATFORM_LIMIT, PLATFORM_NAME, checkSlot, fromLocalInput, hm, md, toLocalInput, ub } from "@/lib/contentAgentRules";
import { api, PENDING, type Brand, type Plan, type Slot } from "./agentTypes";
import { StatusTag } from "./bits";
import s from "./Agent.module.css";

/* ─── Нэг постын самбар ───────────────────────────────────────────────────
   Бриф (агент юу, яагаад) → суваг бүрийн бодит харагдац → текст засвар /
   агентаар дахин бичүүлэх → зураг → цаг, суваг → батлах.
   Гар: ← → шилжих · A батлах · S алгасах · ⌘/Ctrl+Enter батлах · Esc хаах */

type Props = {
  plan: Plan; slot: Slot; brand: Brand; color: string; pos: number; total: number;
  handles: { facebook: string; instagram: string; threads: string };
  onNav: (dir: 1 | -1) => void; onNextDraft: () => void; onClose: () => void;
  act: (slotId: string, action: string, extra?: Record<string, unknown>) => Promise<void>;
  say: (msg: string, tone?: "ok" | "err") => void;
};
const REWRITES = ["Богиносгох", "Hook-ийг хурцлах", "Илүү хувийн түүх болгох", "CTA-г тодруулах", "Энгийн хэлээр"];
const EDITABLE = new Set(["draft", "error", "skipped", "scheduled"]);

export default function SlotDrawer({ plan, slot, brand, color, pos, total, handles, onNav, onNextDraft, onClose, act, say }: Props) {
  const server = { caption: slot.caption, at: toLocalInput(slot.at), platforms: slot.platforms };
  const [f, setF] = useState(server);
  const base = useRef(server);
  const [pv, setPv] = useState<string>(slot.platforms[0] || brand.channels[0] || "threads");
  const [instr, setInstr] = useState("");
  const [imgPrompt, setImgPrompt] = useState(slot.imagePrompt);
  const [busy, setBusy] = useState("");
  const file = useRef<HTMLInputElement>(null);

  /* Серверээс шинэ утга ирэхэд (агент дахин бичиж дууссан г.м) хэрэглэгчийн
     хөндөөгүй талбаруудыг л шинэчилнэ — гараар бичсэнийг дарж бичихгүй. */
  const platKey = slot.platforms.join(",");
  useEffect(() => {
    const prev = base.current;
    setF((c) => ({
      caption: c.caption === prev.caption ? slot.caption : c.caption,
      at: c.at === prev.at ? toLocalInput(slot.at) : c.at,
      platforms: c.platforms.join(",") === prev.platforms.join(",") ? slot.platforms : c.platforms,
    }));
    base.current = { caption: slot.caption, at: toLocalInput(slot.at), platforms: slot.platforms };
  }, [slot.caption, slot.at, platKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setImgPrompt(slot.imagePrompt); }, [slot.imagePrompt]);
  useEffect(() => { const o = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = o; }; }, []);

  const atDate = fromLocalInput(f.at);
  const dirty = f.caption !== slot.caption || f.at !== toLocalInput(slot.at) || f.platforms.join(",") !== platKey;
  const edit = { caption: f.caption, at: atDate ? atDate.toISOString() : undefined, platforms: f.platforms };
  const checks = useMemo(() => checkSlot({ ...slot, caption: f.caption, platforms: f.platforms, at: atDate || slot.at }, brand), [slot, f, brand, atDate]);
  const errors = checks.filter((c) => c.level === "error");
  const pending = PENDING.has(slot.status);
  const imgBusy = slot.imageState === "queued" || slot.imageState === "working";
  const editable = EDITABLE.has(slot.status) && !pending;
  const canApprove = slot.status === "draft" && !errors.length && !busy;
  const canSkip = ["draft", "error", "scheduled"].includes(slot.status) && !busy;
  const len = Array.from(f.caption.trim()).length;

  async function go(name: string, fn: () => Promise<void>) {
    if (busy) return;
    setBusy(name);
    try { await fn(); } catch (e) { say((e as Error).message, "err"); } finally { setBusy(""); }
  }
  const save = () => go("save", async () => { await act(slot.id, "save", { edit }); say(slot.status === "scheduled" ? "Товлолт шинэчлэгдлээ" : "Хадгалагдлаа"); });
  const approve = () => go("approve", async () => {
    await act(slot.id, "approve", { edit: dirty ? edit : {} });
    const t = atDate || new Date(slot.at);
    say(`Товлогдлоо · ${WEEKDAYS[ub(t).wd]} ${md(t)} ${hm(t)}`);
    onNextDraft();
  });
  const unapprove = () => go("unapprove", async () => { await act(slot.id, "unapprove"); say("Товлолт цуцлагдлаа — ноорог болж үлдлээ"); });
  const skip = () => go("skip", async () => { await act(slot.id, "skip"); say("Алгаслаа"); onNextDraft(); });
  const unskip = () => go("unskip", async () => { await act(slot.id, "unskip"); say("Сэргээлээ"); });
  const rewrite = (instruction: string) => go("rewrite", async () => {
    if (dirty && slot.status !== "scheduled") await act(slot.id, "save", { edit });
    await act(slot.id, "rewrite", { instruction });
    setInstr(""); say("Агент дахин бичиж байна…");
  });
  const regen = () => go("image", async () => { await act(slot.id, "image", { prompt: imgPrompt }); say("Зураг үүсгэж байна…"); });
  const setImage = (url: string, msg: string) => go("img", async () => { await act(slot.id, "save", { edit: { ...(dirty ? edit : {}), imageUrl: url } }); say(msg); });
  const upload = (fl: File) => go("upload", async () => {
    if (fl.size > 12 * 1048576) throw new Error("Зураг 12MB-аас бага байх ёстой");
    const fd = new FormData(); fd.append("file", fl);
    const r = await api<{ path: string }>("/api/admin/social/image", { method: "POST", body: fd });
    await act(slot.id, "save", { edit: { ...(dirty ? edit : {}), imageUrl: r.path } });
    say("Зураг солигдлоо");
  });

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = !!el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable);
      if (e.key === "Escape") { onClose(); return; }
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); if (canApprove) approve(); return; }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowRight" || e.key === "j") onNav(1);
      else if (e.key === "ArrowLeft" || e.key === "k") onNav(-1);
      else if (e.key === "a" && canApprove) approve();
      else if (e.key === "s" && canSkip && slot.status !== "scheduled") skip();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  const when = atDate || new Date(slot.at);
  const chans = brand.channels.length ? brand.channels : ["threads", "facebook", "instagram"];
  const preview = (p: string) => {
    const props = { text: f.caption, image: slot.imageUrl, when: `${md(when)} ${hm(when)}` };
    if (p === "instagram") return <IgPreview {...props} handle={handles.instagram} />;
    if (p === "facebook") return <FbPreview {...props} handle={handles.facebook} />;
    return <ThPreview {...props} handle={handles.threads} />;
  };

  return (
    <>
      <div className={s.drawerBack} onClick={onClose} />
      <aside className={s.drawer} role="dialog" aria-modal="true" aria-label={slot.title || "Пост"} style={{ "--pc": color } as CSSProperties}>
        <header className={s.dHead}>
          <div className={s.dNav}>
            <button className={s.iconBtn} onClick={() => onNav(-1)} disabled={pos <= 0} aria-label="Өмнөх"><Icon name="chevronLeft" size={16} /></button>
            <span>{pos >= 0 ? `${pos + 1}/${total}` : "—"}</span>
            <button className={s.iconBtn} onClick={() => onNav(1)} disabled={pos < 0 || pos >= total - 1} aria-label="Дараах"><Icon name="chevron" size={16} /></button>
          </div>
          <div className={s.dTitle}><b>{WEEKDAYS[ub(when).wd]} {md(when)} · {hm(when)}</b><StatusTag status={slot.status} /></div>
          <button className={s.iconBtn} onClick={onClose} aria-label="Хаах"><Icon name="cancel" size={16} /></button>
        </header>

        <div className={s.dScroll}>
          <section className={s.brief}>
            <div className={s.briefTop}>
              <span className={s.pillTag}><i />{slot.pillar}</span>
              <span className={s.fmt}><Icon name={slot.format === "image" ? "image" : "compose"} size={12} />{slot.format === "image" ? "Зурагтай" : "Текст"}</span>
              {slot.score > 0 && <span className={s.score} title={slot.scoreWhy}>Агентын үнэлгээ <b>{slot.score}</b></span>}
            </div>
            <h3>{slot.title || "Пост"}</h3>
            {slot.angle && <p>{slot.angle}</p>}
            {(slot.why || slot.scoreWhy || slot.cta) && (
              <details className={s.why}>
                <summary>Агент яагаад ингэж шийдсэн бэ?</summary>
                {slot.why && <p><b>Цаг, сэдэв:</b> {slot.why}</p>}
                {slot.scoreWhy && <p><b>Үнэлгээ:</b> {slot.scoreWhy}</p>}
                {slot.cta && <p><b>CTA:</b> {slot.cta}</p>}
              </details>
            )}
          </section>

          {slot.error && slot.status !== "failed" && <div className={s.dErr}><Icon name="alert" size={16} />{slot.error}</div>}
          {slot.status === "failed" && <div className={s.dErr}><Icon name="alert" size={16} /><div><b>Нийтлэхэд алдаа гарлаа</b><p>{slot.error}</p><a href="/admin">Content Studio → Нийтэлсэн хэсгээс сувгаар нь дахин илгээнэ</a></div></div>}

          {pending ? (
            <div className={s.dWorking}>
              <span className={s.orb} />
              <b>{slot.status === "writing" ? "Агент бичиж байна…" : "Дараалалд байна"}</b>
              <em>{slot.instruction ? `Заавар: «${slot.instruction}»` : "Брэндийн дуу хоолой, шилдэг постуудаас суралцаж"}</em>
              <div className={s.shimLines}><span /><span /><span /><span /></div>
            </div>
          ) : (
            <>
              <section className={s.dSec}>
                <div className={s.secHead}>
                  <h4>Урьдчилан харах</h4>
                  <div className={s.pvTabs}>
                    {chans.map((p) => (
                      <button key={p} aria-pressed={pv === p} onClick={() => setPv(p)}>
                        <i className={`${s.pdot} ${s["p_" + p]}`}>{p === "instagram" ? "IG" : p === "facebook" ? "FB" : "TH"}</i>{PLATFORM_NAME[p]}
                        {!f.platforms.includes(p) && <em>унтраалттай</em>}
                      </button>
                    ))}
                  </div>
                </div>
                <div className={s.pvStage} data-off={!f.platforms.includes(pv)}>{preview(pv)}</div>
              </section>

              <section className={s.dSec}>
                <div className={s.secHead}>
                  <h4>Текст</h4>
                  <div className={s.counters}>
                    {f.platforms.filter((p) => PLATFORM_LIMIT[p] < 5000).map((p) => (
                      <span key={p} data-over={len > PLATFORM_LIMIT[p]}><i style={{ width: `${Math.min(100, (len / PLATFORM_LIMIT[p]) * 100)}%` }} />{len}/{PLATFORM_LIMIT[p]} {p === "threads" ? "TH" : "IG"}</span>
                    ))}
                    {!f.platforms.some((p) => PLATFORM_LIMIT[p] < 5000) && <span>{len} тэмдэгт</span>}
                  </div>
                </div>
                <textarea className={s.editor} value={f.caption} disabled={!editable} onChange={(e) => setF({ ...f, caption: e.target.value })} rows={Math.min(16, Math.max(6, f.caption.split("\n").length + 1))} spellCheck={false} />
                <div className={s.edTools}>
                  {slot.history.length > 0 && editable && (
                    <button className={s.chip} onClick={() => setF({ ...f, caption: slot.history[slot.history.length - 1].caption })} title={slot.history[slot.history.length - 1].note}>
                      <Icon name="refresh" size={12} />Өмнөх хувилбар ({slot.history.length})
                    </button>
                  )}
                  {slot.edited && <span className={s.editedTag}>Гараар зассан</span>}
                  {dirty && <span className={s.dirtyTag}>Хадгалаагүй өөрчлөлт</span>}
                </div>

                {slot.alt && editable && (
                  <div className={s.alt}>
                    <div><span>2 дахь хувилбар</span><p>{slot.alt}</p></div>
                    <button className={s.btn} onClick={() => setF({ ...f, caption: slot.alt })} disabled={f.caption === slot.alt}>Энийг ашиглах</button>
                  </div>
                )}

                {editable && slot.status !== "scheduled" && (
                  <div className={s.rewrite}>
                    <span><Icon name="spark" size={12} />Агентаар дахин бичүүлэх</span>
                    <div className={s.chips}>{REWRITES.map((c) => <button key={c} className={s.chip} disabled={!!busy} onClick={() => rewrite(c)}>{c}</button>)}</div>
                    <form className={s.instr} onSubmit={(e) => { e.preventDefault(); if (instr.trim()) rewrite(instr.trim()); }}>
                      <input value={instr} onChange={(e) => setInstr(e.target.value)} maxLength={400} placeholder="Өөрийн заавар — жишээ: 3 алхмаар задал, эхэнд асуулт тавь" />
                      <button type="submit" className={s.btn} disabled={!instr.trim() || !!busy}>{busy === "rewrite" ? <i className={s.spin} /> : "Бичүүлэх"}</button>
                    </form>
                  </div>
                )}

                {checks.length > 0
                  ? <ul className={s.checks}>{checks.map((c) => <li key={c.code} data-level={c.level}><Icon name="alert" size={12} />{c.label}</li>)}</ul>
                  : <p className={s.allGood}><Icon name="check" size={12} />Шалгалт бүгд тэнцсэн</p>}
              </section>

              <section className={s.dSec}>
                <div className={s.secHead}><h4>Зураг</h4>{imgBusy && <span className={s.stTag} data-st="writing"><i className={s.spinMini} />Үүсгэж байна</span>}</div>
                <div className={s.imgRow}>
                  <div className={s.imgBox}>
                    {slot.imageUrl ? <img src={slot.imageUrl} alt="" /> : imgBusy ? <span className={s.shim}><Icon name="image" size={24} /></span> : <span className={s.noImg}><Icon name="image" size={20} />Зураггүй{f.platforms.includes("instagram") ? " — Instagram явахгүй" : ""}</span>}
                  </div>
                  <div className={s.imgActs}>
                    {brand.imageMode !== "off" && (
                      <button className={s.btn} onClick={regen} disabled={!!busy || imgBusy || slot.status === "scheduled" || !editable}>
                        <Icon name="spark" size={16} />{slot.imageUrl ? "Дахин үүсгэх" : "AI зураг үүсгэх"}<em>~$0.07</em>
                      </button>
                    )}
                    <button className={s.btn} onClick={() => file.current?.click()} disabled={!!busy || !editable}><Icon name="upload" size={16} />Өөрийн зураг</button>
                    <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { const fl = e.target.files?.[0]; if (fl) upload(fl); e.target.value = ""; }} />
                    {slot.imageUrl && editable && <button className={s.textBtn} onClick={() => setImage("", "Зураг хасагдлаа")} disabled={!!busy}>Зураг хасах</button>}
                    {slot.status === "scheduled" && <p className={s.hint}>AI зургийг солихын тулд товлолтыг цуцална.</p>}
                    {brand.imageMode !== "off" && editable && slot.status !== "scheduled" && (
                      <details className={s.promptBox}>
                        <summary>Зургийн промт</summary>
                        <textarea rows={4} value={imgPrompt} onChange={(e) => setImgPrompt(e.target.value)} placeholder="English: subject, setting, light, angle…" />
                      </details>
                    )}
                    {slot.imageError && <p className={s.errSmall}>{slot.imageError}</p>}
                  </div>
                </div>
                {slot.imageHistory.length > 0 && editable && (
                  <div className={s.imgHist}><span>Өмнөх зургууд</span>{slot.imageHistory.map((u) => <button key={u} onClick={() => setImage(u, "Өмнөх зургийг сэргээлээ")} disabled={!!busy}><img src={u} alt="" /></button>)}</div>
                )}
              </section>

              <section className={s.dSec}>
                <div className={s.secHead}><h4>Хэзээ, хаана</h4></div>
                <div className={s.whenRow}>
                  <label className={s.field}><span>Нийтлэх цаг (Улаанбаатар)</span><input type="datetime-local" value={f.at} disabled={!editable} onChange={(e) => setF({ ...f, at: e.target.value })} /></label>
                  <div className={s.quickTimes}>{brand.hours.map((h) => <button key={h} className={s.chip} disabled={!editable} onClick={() => setF({ ...f, at: `${f.at.slice(0, 10)}T${String(h).padStart(2, "0")}:00` })}>{String(h).padStart(2, "0")}:00</button>)}</div>
                </div>
                <div className={s.chanRow}>
                  {chans.map((p) => {
                    const on = f.platforms.includes(p);
                    const blocked = p === "instagram" && !slot.imageUrl;
                    return (
                      <button key={p} aria-pressed={on} disabled={!editable || (blocked && !on) || !brand.channels.includes(p)} onClick={() => setF({ ...f, platforms: on ? f.platforms.filter((x) => x !== p) : [...f.platforms, p] })} title={blocked ? "Instagram-д зураг хэрэгтэй" : ""}>
                        <i className={`${s.pdot} ${s["p_" + p]}`}>{p === "instagram" ? "IG" : p === "facebook" ? "FB" : "TH"}</i>
                        <span><b>{PLATFORM_NAME[p]}</b><em>{(handles as Record<string, string>)[p] ? `@${(handles as Record<string, string>)[p].replace(/^@/, "")}` : "холбоогүй"}</em></span>
                        <Icon name={on ? "check" : "plus"} size={12} />
                      </button>
                    );
                  })}
                </div>
              </section>

              {slot.results.length > 0 && (
                <section className={s.dSec}>
                  <div className={s.secHead}><h4>Нийтлэл</h4>{slot.metrics.syncedAt && <small>Хэмжүүр {md(slot.metrics.syncedAt)} {hm(slot.metrics.syncedAt)}</small>}</div>
                  <div className={s.results}>
                    {slot.results.map((r) => (
                      <a key={r.platform} href={r.permalink || undefined} target="_blank" rel="noreferrer" data-ok={r.status === "ok"}>
                        <i className={`${s.pdot} ${s["p_" + r.platform]}`}>{r.platform === "instagram" ? "IG" : r.platform === "facebook" ? "FB" : "TH"}</i>
                        {PLATFORM_NAME[r.platform]}<em>{r.status === "ok" ? "Харах ↗" : r.status === "unknown" ? "Тодорхойгүй" : "Алдаа"}</em>
                      </a>
                    ))}
                  </div>
                  {slot.status === "published" && (
                    <div className={s.mRow}>
                      <span><b>{slot.metrics.likes}</b>like</span><span><b>{slot.metrics.comments}</b>comment</span><span><b>{slot.metrics.shares}</b>share</span>
                      {slot.metrics.views > 0 && <span><b>{slot.metrics.views}</b>үзэлт</span>}<span data-k="score"><b>{slot.metrics.score}</b>оноо</span>
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </div>

        <footer className={s.dFoot}>
          {slot.status === "draft" && <>
            <button className={s.btn} onClick={skip} disabled={!!busy}>Алгасах <kbd>S</kbd></button>
            <span className={s.grow} />
            {dirty && <button className={s.btn} onClick={save} disabled={!!busy}>{busy === "save" ? <i className={s.spin} /> : "Хадгалах"}</button>}
            <button className={s.primary} onClick={approve} disabled={!canApprove} title={errors.map((e) => e.label).join(" · ")}>
              {busy === "approve" ? <><i className={s.spin} />Товлож байна…</> : <><Icon name="check" size={16} />Батлах · {md(when)} {hm(when)}<kbd>A</kbd></>}
            </button>
          </>}
          {slot.status === "scheduled" && <>
            <button className={s.btn} onClick={unapprove} disabled={!!busy}>{busy === "unapprove" ? <i className={s.spin} /> : "Товлолт цуцлах"}</button>
            <span className={s.grow}><Icon name="clock" size={16} />{WEEKDAYS[ub(when).wd]} {hm(when)}-д автоматаар нийтлэгдэнэ</span>
            {dirty && <button className={s.primary} onClick={save} disabled={!!busy || errors.length > 0}>Өөрчлөлт хадгалах</button>}
          </>}
          {slot.status === "error" && <>
            <button className={s.btn} onClick={skip} disabled={!!busy}>Алгасах</button>
            <span className={s.grow} />
            {dirty && <button className={s.btn} onClick={save} disabled={!!busy}>Гараар бичсэнээ хадгалах</button>}
            <button className={s.primary} onClick={() => rewrite("")} disabled={!!busy}><Icon name="refresh" size={16} />Дахин бичүүлэх</button>
          </>}
          {slot.status === "skipped" && <><span className={s.grow}>Энэ пост алгасагдсан</span><button className={s.primary} onClick={unskip} disabled={!!busy}>Сэргээх</button></>}
          {slot.status === "publishing" && <span className={s.grow}><i className={s.spinMini} />Нийтэлж байна…</span>}
          {slot.status === "published" && <span className={s.grow}><Icon name="check" size={16} />Нийтлэгдсэн · {plan.brand}</span>}
          {slot.status === "failed" && <span className={s.grow}>Алдааг Content Studio-оос сувгаар нь засна</span>}
          {pending && <span className={s.grow}><i className={s.spinMini} />Агент ажиллаж байна…</span>}
        </footer>
      </aside>
    </>
  );
}

/* ─── Суваг бүрийн харагдац ─────────────────────────────────────────────── */
type PV = { text: string; image: string; when: string; handle: string };
const Av = ({ h }: { h: string }) => <span className={s.pvAv}>{(h || "?").replace(/^@/, "").slice(0, 1).toUpperCase()}</span>;
const Svg = ({ d }: { d: ReactNode }) => <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{d}</svg>;
const HEART = <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />;
const BUBBLE = <path d="M20 12a8 8 0 1 1-3.2-6.4L20 4l-.6 4A8 8 0 0 1 20 12z" />;
const REPOST = <><path d="M17 3l3 3-3 3" /><path d="M20 6H8a4 4 0 0 0-4 4v1" /><path d="M7 21l-3-3 3-3" /><path d="M4 18h12a4 4 0 0 0 4-4v-1" /></>;
const SEND = <><path d="M21 3 10 14" /><path d="M21 3l-7 18-4-7-7-4z" /></>;

function ThPreview({ text, image, when, handle }: PV) {
  return (
    <div className={s.pvTh}>
      <Av h={handle} />
      <div className={s.pvBody}>
        <div className={s.pvHead}><b>{handle.replace(/^@/, "")}</b><span>{when}</span></div>
        <p className={s.pvText}>{text || <em>Текст хоосон</em>}</p>
        {image && <img className={s.pvImgR} src={image} alt="" />}
        <div className={s.pvIcons}><Svg d={HEART} /><Svg d={BUBBLE} /><Svg d={REPOST} /><Svg d={SEND} /></div>
      </div>
    </div>
  );
}
function FbPreview({ text, image, when, handle }: PV) {
  return (
    <div className={s.pvFb}>
      <div className={s.pvFbHead}><Av h={handle} /><div><b>{handle}</b><span>Товлосон · {when} · 🌐</span></div></div>
      <p className={s.pvText}>{text || <em>Текст хоосон</em>}</p>
      {image && <img className={s.pvImgFull} src={image} alt="" />}
      <div className={s.pvFbBar}><span>👍 Like</span><span>💬 Comment</span><span>↗ Share</span></div>
    </div>
  );
}
function IgPreview({ text, image, handle }: PV) {
  const [more, setMore] = useState(false);
  const flat = text.replace(/\n+/g, " ");
  return (
    <div className={s.pvIg}>
      <div className={s.pvIgHead}><Av h={handle} /><b>{handle.replace(/^@/, "")}</b><span>•••</span></div>
      <div className={s.pvIgImg}>{image ? <img src={image} alt="" /> : <span><Icon name="alert" size={16} />Instagram-д зураг заавал хэрэгтэй</span>}</div>
      <div className={s.pvIcons}><Svg d={HEART} /><Svg d={BUBBLE} /><Svg d={SEND} /></div>
      <p className={s.pvIgCap}><b>{handle.replace(/^@/, "")}</b> {more || flat.length <= 125 ? text : <>{flat.slice(0, 125)}… <button onClick={() => setMore(true)}>дэлгэрэнгүй</button></>}</p>
    </div>
  );
}
