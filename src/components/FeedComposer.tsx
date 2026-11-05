"use client";

import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import s from "./FeedComposer.module.css";
import { FEED_CATEGORIES, CatIcon } from "@/lib/feedCategories";

/* ─── Урсгалын бичих мөр (2026-10-26) ───────────────────────────────────────
   Өмнө нь зөвхөн текст байсан: зураг/видео оруулах бол /posts/new руу шилжих
   ёстой, гар утсан дээр энэ нь «нүүрээс пост хийж болохгүй» мэт санагддаг байв.
   Одоо: текст + 4 хүртэл зураг ЭСВЭЛ 60с хүртэл видео, ноорог хадгална, хуулж
   буулгах/чирэх. Админд «Сошиалд хуваалцах» (Threads/Facebook/Instagram) —
   өмнө нь админы пост бүр Facebook + Threads руу АСУУЛГҮЙ явдаг байв.
   Сервер: ердийн /api/posts (модерац, хязгаар, XP тэнд). */

const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const MAX_VIDEO_SEC = 60;
const DRAFT_KEY = "aq.feed.draft";
const SHARE_KEY = "aq.feed.share";

type Img = { id: string; preview: string; url: string | null; w: number; h: number; failed?: boolean };
type Vid = { preview: string; url: string | null; pct: number; dur: number; w: number; h: number };
type Share = { on: boolean; to: ("threads" | "facebook" | "instagram")[] };
export type ComposedPost = { _id: string; [k: string]: unknown };

const NETS: { k: "threads" | "facebook" | "instagram"; l: string }[] = [
  { k: "threads", l: "Threads" },
  { k: "facebook", l: "Facebook" },
  { k: "instagram", l: "Instagram" },
];

/** Feed-ийн дэмждэг харьцаануудаас хамгийн ойрыг сонгоно */
function nearestAspect(w: number, h: number): string {
  if (!w || !h) return "";
  const r = w / h;
  const opts: [string, number][] = [["1:1", 1], ["4:5", 0.8], ["16:9", 16 / 9], ["9:16", 9 / 16]];
  return opts.reduce((a, b) => (Math.abs(b[1] - r) < Math.abs(a[1] - r) ? b : a))[0];
}
const looksLikeImage = (f: File) => f.type === "" || f.type.startsWith("image/") || f.type === "application/octet-stream" || /\.(jpe?g|png|webp|gif|heic|heif|avif)$/i.test(f.name);
const imgSize = (src: string) => new Promise<{ w: number; h: number }>((res) => { const i = new Image(); i.onload = () => res({ w: i.naturalWidth, h: i.naturalHeight }); i.onerror = () => res({ w: 0, h: 0 }); i.src = src; });
const vidMeta = (src: string) => new Promise<{ dur: number; w: number; h: number }>((res, rej) => {
  const v = document.createElement("video");
  v.preload = "metadata"; v.muted = true; v.playsInline = true;
  v.onloadedmetadata = () => res({ dur: v.duration || 0, w: v.videoWidth, h: v.videoHeight });
  v.onerror = () => rej(new Error("Видео уншигдсангүй"));
  v.src = src;
});
const safe = <T,>(f: () => T, d: T): T => { try { return f(); } catch { return d; } };

export default function FeedComposer({ meAvatar, meName, isAdmin, onPosted, defaultCategory = "" }: { meAvatar?: string; meName?: string; isAdmin: boolean; onPosted: (p: ComposedPost) => void; defaultCategory?: string }) {
  const [text, setText] = useState("");
  /* Ангилал (2026-11-01) — заавал биш; урсгал шүүлттэй байвал тэр ангиллаар эхэлнэ. Хоосон = «ерөнхий». */
  const [cat, setCat] = useState(defaultCategory);
  useEffect(() => { setCat(defaultCategory); }, [defaultCategory]);
  const [imgs, setImgs] = useState<Img[]>([]);
  const [vid, setVid] = useState<Vid | null>(null);
  const [posting, setPosting] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [drag, setDrag] = useState(false);
  const [share, setShare] = useState<Share>({ on: true, to: ["threads", "facebook"] });
  const ta = useRef<HTMLTextAreaElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const vidRef = useRef<HTMLInputElement>(null);

  /* ноорог + хуваалцах сонголтыг төхөөрөмж дээр санана */
  useEffect(() => {
    setText(safe(() => localStorage.getItem(DRAFT_KEY) || "", ""));
    const sv = safe(() => JSON.parse(localStorage.getItem(SHARE_KEY) || "null"), null) as Share | null;
    if (sv && typeof sv.on === "boolean" && Array.isArray(sv.to)) setShare(sv);
  }, []);
  useEffect(() => { safe(() => (text ? localStorage.setItem(DRAFT_KEY, text) : localStorage.removeItem(DRAFT_KEY)), undefined); }, [text]);
  const saveShare = (v: Share) => { setShare(v); safe(() => localStorage.setItem(SHARE_KEY, JSON.stringify(v)), undefined); };

  /* textarea өндөр нь агуулгаараа (гар утсан дээр гүйлгэхгүй) */
  useEffect(() => { const el = ta.current; if (!el) return; el.style.height = "auto"; el.style.height = `${Math.min(el.scrollHeight, 320)}px`; }, [text]);

  const uploading = imgs.some((i) => !i.url && !i.failed) || (!!vid && !vid.url);
  const hasMedia = imgs.some((i) => i.url) || !!vid?.url;
  const canPost = !posting && !uploading && (text.trim().length > 0 || hasMedia);

  async function addImages(files: File[]) {
    setErr(""); setOk("");
    if (vid) { setErr("Нэг постонд зураг эсвэл видео — аль нэг нь"); return; }
    const room = MAX_IMAGES - imgs.length;
    if (room <= 0) { setErr(`Хамгийн ихдээ ${MAX_IMAGES} зураг`); return; }
    const pick = files.filter(looksLikeImage).slice(0, room);
    const big = pick.filter((f) => f.size > MAX_IMAGE_BYTES).length;
    const fit = pick.filter((f) => f.size <= MAX_IMAGE_BYTES);
    if (big) setErr(`${big} зураг 12MB-аас том тул алгаслаа`);
    if (!fit.length) { if (!big) setErr("Зураг сонгогдсонгүй"); return; }
    const rows: Img[] = await Promise.all(fit.map(async (f) => { const preview = URL.createObjectURL(f); const d = await imgSize(preview); return { id: Math.random().toString(36).slice(2), preview, url: null, ...d }; }));
    setImgs((p) => [...p, ...rows]);
    await Promise.all(fit.map(async (f, i) => {
      const fd = new FormData(); fd.append("file", f);
      const r = await fetch("/api/upload", { method: "POST", body: fd }).catch(() => null);
      const d = r ? await r.json().catch(() => ({})) : {};
      const id = rows[i].id;
      setImgs((p) => p.map((x) => (x.id === id ? (r?.ok && d.url ? { ...x, url: d.url } : { ...x, failed: true }) : x)));
      if (!r?.ok) setErr(d.error || "Зураг оруулахад алдаа гарлаа — дахин оролдоно уу");
    }));
  }

  async function addVideo(file?: File) {
    if (!file) return;
    setErr(""); setOk("");
    if (imgs.length) { setErr("Нэг постонд зураг эсвэл видео — аль нэг нь"); return; }
    if (file.size > MAX_VIDEO_BYTES) { setErr("Видео 100MB-аас бага байх ёстой"); return; }
    const preview = URL.createObjectURL(file);
    let meta: { dur: number; w: number; h: number };
    try { meta = await vidMeta(preview); } catch { setErr("Видео уншигдсангүй — MP4/MOV оруулна уу"); URL.revokeObjectURL(preview); return; }
    if (meta.dur > MAX_VIDEO_SEC + 2) { setErr(`Видео ${MAX_VIDEO_SEC} секундээс богино байх ёстой (одоо ${Math.round(meta.dur)}с)`); URL.revokeObjectURL(preview); return; }
    setVid({ preview, url: null, pct: 0, ...meta });
    const fd = new FormData(); fd.append("file", file);
    /* XHR — явцын хувийг харуулна (удаан сүлжээнд «гацсан» мэт харагдахгүй) */
    const res = await new Promise<{ ok: boolean; url?: string; error?: string }>((resolve) => {
      const x = new XMLHttpRequest();
      x.open("POST", "/api/upload");
      x.upload.onprogress = (e) => { if (e.lengthComputable) setVid((v) => (v ? { ...v, pct: Math.round((e.loaded / e.total) * 100) } : v)); };
      x.onload = () => { let d: { url?: string; error?: string } = {}; try { d = JSON.parse(x.responseText); } catch { /* */ } resolve({ ok: x.status >= 200 && x.status < 300, ...d }); };
      x.onerror = () => resolve({ ok: false, error: "Сүлжээ тасарлаа — дахин оролдоно уу" });
      x.send(fd);
    });
    if (!res.ok || !res.url) { setErr(res.error || "Видео оруулахад алдаа гарлаа"); setVid(null); URL.revokeObjectURL(preview); return; }
    setVid((v) => (v ? { ...v, url: res.url!, pct: 100 } : v));
  }

  const removeImg = (id: string) => setImgs((p) => { const x = p.find((i) => i.id === id); if (x) URL.revokeObjectURL(x.preview); return p.filter((i) => i.id !== id); });
  const removeVid = () => { if (vid) URL.revokeObjectURL(vid.preview); setVid(null); };

  function onPaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(e.clipboardData.files || []).filter(looksLikeImage);
    if (files.length) { e.preventDefault(); addImages(files); }
  }
  function onDrop(e: DragEvent) {
    e.preventDefault(); setDrag(false);
    const files = Array.from(e.dataTransfer.files || []);
    const v = files.find((f) => f.type.startsWith("video/"));
    if (v) addVideo(v); else addImages(files);
  }

  async function post() {
    if (!canPost) return;
    setPosting(true); setErr(""); setOk("");
    const images = imgs.filter((i) => i.url).map((i) => i.url as string);
    const first = imgs.find((i) => i.url);
    const to = share.on ? share.to.filter((k) => k !== "instagram" || images.length > 0 || !!vid?.url) : [];
    try {
      const r = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: text.trim(),
          category: cat || "ерөнхий",
          ...(images.length ? { images, aspect: nearestAspect(first?.w || 0, first?.h || 0) } : {}),
          ...(vid?.url ? { video: vid.url, videoDurationSec: Math.round(vid.dur), aspect: nearestAspect(vid.w, vid.h) } : {}),
          /* админ: хоосон массив = хаашаа ч хуваалцахгүй (сервер тэгж ойлгоно) */
          ...(isAdmin ? { crosspost: to } : {}),
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Нийтэлж чадсангүй");
      imgs.forEach((i) => URL.revokeObjectURL(i.preview));
      if (vid) URL.revokeObjectURL(vid.preview);
      setText(""); setImgs([]); setVid(null); setCat(defaultCategory);
      setOk(isAdmin && to.length ? `Нийтлэгдлээ · ${to.map((k) => NETS.find((n) => n.k === k)?.l).join(", ")} руу илгээж байна` : "Нийтлэгдлээ");
      setTimeout(() => setOk(""), 4000);
      if (d.post) onPosted(d.post);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setPosting(false);
    }
  }

  const initial = (meName || "Б").trim().charAt(0).toUpperCase();

  return (
    <div className={s.box} data-drag={drag || undefined}
      onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDrag(true); } }}
      onDragLeave={() => setDrag(false)} onDrop={onDrop}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {meAvatar ? <img className={s.av} src={meAvatar} alt="" /> : <span className={s.av} data-txt>{initial}</span>}
      <div className={s.body}>
        <textarea ref={ta} className={s.ta} value={text} rows={1} maxLength={5000}
          onChange={(e) => setText(e.target.value)} onPaste={onPaste}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) post(); }}
          placeholder="Юу бүтээв? Санаа, зураг, видеогоо хуваалц…" aria-label="Пост бичих" />

        {imgs.length > 0 && (
          <div className={s.grid} data-n={imgs.length}>
            {imgs.map((i) => (
              <div key={i.id} className={s.tile}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={i.preview} alt="" />
                {!i.url && !i.failed && <span className={s.over}><i className={s.spin} /></span>}
                {i.failed && <span className={s.over} data-bad>Алдаа</span>}
                <button type="button" className={s.x} onClick={() => removeImg(i.id)} aria-label="Хасах"><Icon name="cancel" size={16} /></button>
              </div>
            ))}
          </div>
        )}
        {vid && (
          <div className={s.vid}>
            <video src={vid.preview} muted playsInline controls={!!vid.url} />
            {!vid.url && <span className={s.over}><b>{vid.pct}%</b></span>}
            <button type="button" className={s.x} onClick={removeVid} aria-label="Хасах"><Icon name="cancel" size={16} /></button>
          </div>
        )}

        {(text.trim() || imgs.length > 0 || vid) && (
          <div className={s.cats} role="radiogroup" aria-label="Ангилал сонгох">
            {FEED_CATEGORIES.map((c) => (
              <button key={c.slug} type="button" role="radio" aria-checked={cat === c.slug} className={s.cat} title={c.mn}
                onClick={() => setCat(cat === c.slug ? "" : c.slug)}>
                <CatIcon d={c.icon} size={14} />{c.label}
              </button>
            ))}
          </div>
        )}

        {isAdmin && (
          <div className={s.share}>
            <button type="button" className={s.switch} aria-pressed={share.on} onClick={() => saveShare({ ...share, on: !share.on })}>
              <i />Сошиалд хуваалцах
            </button>
            {share.on && NETS.map((n) => {
              const need = n.k === "instagram" && !imgs.length && !vid;
              const on = share.to.includes(n.k);
              return (
                <button key={n.k} type="button" className={s.net} aria-pressed={on} title={need ? "Instagram зөвхөн зураг/видеотой пост авна" : undefined}
                  data-dim={need || undefined}
                  onClick={() => saveShare({ ...share, to: on ? share.to.filter((k) => k !== n.k) : [...share.to, n.k] })}>
                  {on ? "✓ " : ""}{n.l}
                </button>
              );
            })}
            {!share.on && <span className={s.muted}>Зөвхөн antaqor.com-д</span>}
          </div>
        )}

        <div className={s.bar}>
          <button type="button" className={s.tool} onClick={() => imgRef.current?.click()} disabled={!!vid || imgs.length >= MAX_IMAGES} title="Зураг (4 хүртэл)">
            <Icon name="image" size={20} /><span>Зураг</span>
          </button>
          <button type="button" className={s.tool} onClick={() => vidRef.current?.click()} disabled={!!vid || imgs.length > 0} title="Видео (60с хүртэл)">
            <Icon name="video" size={20} /><span>Видео</span>
          </button>
          <Link href="/posts/new" className={s.tool} title="Брэнд карт, карусель, ангилал">
            <Icon name="layout" size={20} /><span>Илүү</span>
          </Link>
          <span className={s.grow} />
          {text.length > 4500 && <span className={s.count} data-warn={text.length > 4900 || undefined}>{5000 - text.length}</span>}
          <button type="button" className={s.post} onClick={post} disabled={!canPost}>
            {posting ? <i className={s.spinW} /> : uploading ? "Оруулж байна…" : "Нийтлэх"}
          </button>
        </div>
        {err && <p className={s.err}>{err}</p>}
        {ok && <p className={s.ok}>{ok}</p>}
      </div>
      <input ref={imgRef} type="file" accept="image/*" multiple hidden onChange={(e) => { addImages(Array.from(e.target.files || [])); e.target.value = ""; }} />
      <input ref={vidRef} type="file" accept="video/mp4,video/quicktime,video/webm" hidden onChange={(e) => { addVideo(e.target.files?.[0]); e.target.value = ""; }} />
    </div>
  );
}
