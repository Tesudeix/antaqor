"use client";

import { useState } from "react";
import Icon from "@/components/Icon";
import s from "./agent.module.css";

/* «Community-д хуваалцах» (2026-10-26) — AI зураг / ихрийг antaqor.com feed-д
   хэрэглэгчийн өөрийн нэрээр пост болгоно. Сайтын ердийн /api/posts-ийг дуудна:
   модерац, цагийн хязгаар, XP, гишүүдийн урсгал руу чиглүүлэх нь тэнд бий —
   энд давхар бичихгүй. Промпт нь `aiPrompt` (гишүүдэд л харагдана). */
export type ShareItem = { url: string; prompt?: string; video?: boolean; dur?: number };

export default function ShareDialog({ item, onClose, say }: { item: ShareItem; onClose: () => void; say: (m: string, bad?: boolean) => void }) {
  const [text, setText] = useState("");
  const [withPrompt, setWithPrompt] = useState(!!item.prompt);
  const [busy, setBusy] = useState(false);
  const [postId, setPostId] = useState<string | null>(null);

  async function share() {
    setBusy(true);
    try {
      const r = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text.trim(), ...(item.video ? { video: item.url, videoDurationSec: Math.round(item.dur || 0) } : { images: [item.url] }), ...(withPrompt && item.prompt ? { aiPrompt: item.prompt } : {}) }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || `Алдаа (${r.status})`);
      setPostId(String(d.post?._id || ""));
      say("Community-д хуваалцлаа");
    } catch (e) {
      say((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={s.lightbox} onClick={onClose}>
      <div className={s.shareBox} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Community-д хуваалцах">
        <div className={s.cardHead}>
          <h3>Community-д хуваалцах</h3>
          <button className={s.ghost} onClick={onClose} aria-label="Хаах"><Icon name="cancel" size={20} /></button>
        </div>
        {item.video ? <video className={s.shareImg} src={item.url} controls playsInline muted /> : <img className={s.shareImg} src={item.url} alt="" />}
        {postId !== null ? (
          <div className={s.stack}>
            <p className={s.shareOk}><Icon name="check" size={16} />antaqor.com feed-д нийтлэгдлээ</p>
            <div className={s.rowx}>
              <a className={s.pri} href={postId ? `/posts/${postId}` : "/"} target="_blank" rel="noreferrer"><Icon name="external" size={16} />Feed-ээс харах</a>
              <button className={s.btn} onClick={onClose}>Хаах</button>
            </div>
          </div>
        ) : (
          <div className={s.stack}>
            <textarea rows={3} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Тайлбар (заавал биш) — юу бүтээснээ, яаж хийснээ бичээрэй" />
            {item.prompt && (
              <label className={s.shareChk}>
                <input type="checkbox" checked={withPrompt} onChange={(e) => setWithPrompt(e.target.checked)} />
                <span>Промптоо хамт хуваалцах <small className={s.muted}>— гишүүд хуулж ашиглана</small></span>
              </label>
            )}
            <p className={s.muted}>Таны нэрээр antaqor.com-ийн community урсгалд гарна.</p>
            <button className={`${s.pri} ${s.big}`} onClick={share} disabled={busy}>
              {busy ? <><i className={s.spin} />Нийтэлж байна…</> : <><Icon name="send" size={16} />Хуваалцах</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
