"use client";

import { useCallback, useEffect, useState } from "react";
import Icon from "@/components/Icon";
import s from "./Studio.module.css";

/* ─── Өрсөлдөгч (2026-10-17) ─────────────────────────────────────────────
   Хаяг нэмэх → тэдний постуудыг ER-ээр (оноо / 1000 дагагч) эрэмбэлэх →
   пост бүрийг AI-аар задлах (hook, формат, яагаад, сэтгэл хөдлөл) →
   "Antaqor-д тохируулсан санаа"-г шууд Бүтээх рүү. IG/Threads нь албан
   ёсны API, FB болон бусад нь гараар. */

type Pf = "instagram" | "threads" | "facebook";
type Comp = { _id: string; platform: Pf; handle: string; name: string; followers: number; avatar: string; lastSyncAt?: string; error: string; posts: number; avgEr: number };
type Br = { hook: string; format: string; why: string; emotion: string; adapt: string };
type CP = { _id: string; competitor: string; platform: Pf; handle: string; caption: string; mediaType: string; thumb: string; permalink: string; likes: number; comments: number; er: number; manual: boolean; analysis?: Br };
type Sum = { summary: string; doList: string[]; avoid: string[]; ideas: string[]; learnedAt?: string } | null;

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { cache: "no-store", ...init });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `Алдаа (${r.status})`);
  return d as T;
}
const post = (b: unknown): RequestInit => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
const PIcon = ({ p }: { p: string }) => <span className={`${s.pdot} ${s["p_" + p]}`}>{p === "instagram" ? "IG" : p === "facebook" ? "FB" : "TH"}</span>;
const LBL: Record<Pf, string> = { instagram: "Instagram", threads: "Threads", facebook: "Facebook" };

export default function CompetitorTab({ onIdea }: { onIdea: (idea: string) => void }) {
  const [data, setData] = useState<{ competitors: Comp[]; posts: CP[]; summary: Sum } | null>(null);
  const [pf, setPf] = useState<Pf>("instagram");
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [only, setOnly] = useState("");
  const [manual, setManual] = useState(false);
  const [m, setM] = useState({ platform: "facebook" as Pf, handle: "", url: "", caption: "", likes: "", comments: "", followers: "" });
  const [open, setOpen] = useState<string>("");

  const load = useCallback(async (c = only) => {
    try { setData(await api(`/api/admin/social/competitors${c ? `?competitor=${c}` : ""}`)); } catch (e) { setMsg((e as Error).message); }
  }, [only]);
  useEffect(() => { void load(); }, [load]);

  async function run(name: string, fn: () => Promise<void>) {
    if (busy) return; setBusy(name); setMsg("");
    try { await fn(); } catch (e) { setMsg((e as Error).message); } finally { setBusy(""); }
  }
  const add = () => run("add", async () => {
    const r = await api<{ error: string }>("/api/admin/social/competitors", post({ action: "add", platform: pf, handle }));
    setHandle(""); await load();
    if (r.error && !r.error.startsWith("perm:")) setMsg(r.error);
  });
  const analyze = (id: string) => run(`a${id}`, async () => { await api("/api/admin/social/competitors", post({ action: "analyze", postId: id })); setOpen(id); await load(); });
  const addManual = () => run("manual", async () => {
    const r = await api<{ id: string }>("/api/admin/social/competitors", post({ action: "manual", ...m }));
    setM({ ...m, url: "", caption: "", likes: "", comments: "" }); setManual(false); setOpen(r.id); await load();
  });
  const summary = () => run("sum", async () => { await api("/api/admin/social/competitors", post({ action: "summary" })); await load(); });

  const perm = (data?.competitors || []).map((c) => c.error).filter((e) => e.startsWith("perm:"));
  const needIg = perm.includes("perm:instagram"), needTh = perm.includes("perm:threads");
  const sum = data?.summary;

  return (
    <div className={s.stack}>
      {msg && <div className={s.notice} role="status">{msg}<button onClick={() => setMsg("")} aria-label="Хаах">×</button></div>}

      {(needIg || needTh) && (
        <div className={s.permBox}>
          <div><b>Өрсөлдөгчийн постыг унших эрх хэрэгтэй.</b><p>Meta-ийн албан ёсны API нь нэг удаагийн нэмэлт зөвшөөрөл шаарддаг. Дарахад Facebook/Threads цонх нээгдэж та зөвшөөрнө — таны одоогийн холболт хэвээр.</p></div>
          <div className={s.mediaRow}>
            {needIg && <a className={`${s.btn} ${s.primary}`} href="/api/admin/meta/oauth/start?extended=1">Instagram эрх нээх</a>}
            {needTh && <a className={`${s.btn} ${s.dark}`} href="/api/admin/threads/auth?extended=1">Threads эрх нээх</a>}
          </div>
        </div>
      )}

      <section className={s.card}>
        <div className={s.cardHead}><h2>Өрсөлдөгч нэмэх</h2><button className={s.link} onClick={() => setManual(!manual)}>{manual ? "Хаах" : "+ Постыг гараар нэмэх (Facebook гэх мэт)"}</button></div>
        <div className={s.addRow}>
          <div className={s.seg}>{(["instagram", "threads", "facebook"] as Pf[]).map((p) => <button key={p} aria-pressed={pf === p} onClick={() => setPf(p)}>{LBL[p]}</button>)}</div>
          <input className={s.field} value={handle} onChange={(e) => setHandle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handle && void add()} placeholder={pf === "facebook" ? "Хуудасны нэр (постыг гараар нэмнэ)" : "@хаяг эсвэл профайлын холбоос"} />
          <button className={`${s.btn} ${s.primary}`} disabled={!handle.trim() || !!busy} onClick={add}>{busy === "add" ? "Татаж байна…" : "Нэмэх"}</button>
        </div>
        {pf === "instagram" && <p className={s.hint}>Зөвхөн business / creator аккаунт (ихэнх брэнд, блогер ийм байдаг).</p>}

        {manual && (
          <div className={s.manual}>
            <div className={s.seg}>{(["facebook", "instagram", "threads"] as Pf[]).map((p) => <button key={p} aria-pressed={m.platform === p} onClick={() => setM({ ...m, platform: p })}>{LBL[p]}</button>)}</div>
            <div className={s.mGrid}>
              <input className={s.field} placeholder="Хуудас / хаяг" value={m.handle} onChange={(e) => setM({ ...m, handle: e.target.value })} />
              <input className={s.field} placeholder="Постын холбоос (заавал биш)" value={m.url} onChange={(e) => setM({ ...m, url: e.target.value })} />
              <input className={s.field} type="number" placeholder="❤ Лайк/реакц" value={m.likes} onChange={(e) => setM({ ...m, likes: e.target.value })} />
              <input className={s.field} type="number" placeholder="💬 Коммент" value={m.comments} onChange={(e) => setM({ ...m, comments: e.target.value })} />
              <input className={s.field} type="number" placeholder="Дагагчийн тоо" value={m.followers} onChange={(e) => setM({ ...m, followers: e.target.value })} />
            </div>
            <textarea className={s.input} rows={4} placeholder="Постын текстийг хуулж тавина уу" value={m.caption} onChange={(e) => setM({ ...m, caption: e.target.value })} />
            <button className={`${s.btn} ${s.dark}`} disabled={m.caption.trim().length < 10 || !!busy} onClick={addManual}>{busy === "manual" ? "Задалж байна…" : "Нэмээд задлах"}</button>
          </div>
        )}

        {!!data?.competitors.length && (
          <div className={s.compList}>
            <button className={`${s.compChip} ${!only ? s.compOn : ""}`} onClick={() => { setOnly(""); void load(""); }}>Бүгд</button>
            {data.competitors.map((c) => (
              <div key={c._id} className={`${s.compChip} ${only === c._id ? s.compOn : ""}`}>
                <button onClick={() => { setOnly(c._id); void load(c._id); }} title={c.error && !c.error.startsWith("perm:") ? c.error : ""}>
                  {c.avatar ? <img src={c.avatar} alt="" /> : <PIcon p={c.platform} />}
                  <span><b>@{c.handle}</b><small>{c.followers ? `${c.followers.toLocaleString()} дагагч · ` : ""}{c.posts} пост{c.avgEr ? ` · ER ${c.avgEr}` : ""}{c.error ? " · ⚠" : ""}</small></span>
                </button>
                <button className={s.x} aria-label="Шинэчлэх" disabled={!!busy} onClick={() => run(`s${c._id}`, async () => { await api("/api/admin/social/competitors", post({ action: "sync", id: c._id })); await load(); })}>↻</button>
                <button className={s.x} aria-label="Устгах" onClick={() => run(`d${c._id}`, async () => { if (!confirm(`@${c.handle}-г хасах уу?`)) return; await api(`/api/admin/social/competitors?id=${c._id}`, { method: "DELETE" }); if (only === c._id) setOnly(""); await load(""); })}>×</button>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className={s.two}>
        <section className={s.card}>
          <div className={s.cardHead}><h2>Өрсөлдөгчдөөс сурах зүйл</h2><button className={`${s.btn}`} disabled={!!busy || !data?.posts.length} onClick={summary}><Icon name="spark" />{busy === "sum" ? "Дүгнэж байна…" : sum ? "Дахин дүгнэх" : "AI дүгнэлт"}</button></div>
          {sum ? (
            <div className={s.learn}>
              <p className={s.summary}>{sum.summary}</p>
              <div className={s.lists}>
                <div><h3>Тэдэнд ажилладаг</h3><ul>{sum.doList.map((x) => <li key={x}>{x}</li>)}</ul></div>
                <div><h3>Танд дутуу байгаа</h3><ul>{sum.avoid.map((x) => <li key={x}>{x}</li>)}</ul></div>
              </div>
            </div>
          ) : <p className={s.muted}>Өрсөлдөгч нэмээд &quot;AI дүгнэлт&quot; дарахад тэдний давтагддаг хэв маяг болон танд дутуу байгаа зүйлийг гаргана.</p>}
        </section>
        <section className={s.card}>
          <div className={s.cardHead}><h2>Таны өнцгөөр санаа</h2></div>
          <div className={s.ideas}>
            {(sum?.ideas || []).map((x) => <button key={x} onClick={() => onIdea(x)}><span>{x}</span><em>Бүтээх →</em></button>)}
            {!sum?.ideas?.length && <p className={s.muted}>Дүгнэлт хийсний дараа энд гарна.</p>}
          </div>
        </section>
      </div>

      <section className={s.card}>
        <div className={s.cardHead}><h2>Хамгийн сайн ажилласан контент</h2><small>ER = (❤ + 2×💬) / 1000 дагагч — жижиг, том аккаунтыг шударга харьцуулна</small></div>
        <div className={s.compGrid}>
          {(data?.posts || []).map((p) => (
            <article key={p._id} className={s.compCard}>
              <a href={p.permalink || undefined} target="_blank" rel="noopener" className={s.thumb}>
                {p.thumb ? <img src={p.thumb} alt="" loading="lazy" /> : <span className={s.textThumb}>{p.caption.slice(0, 120)}</span>}
                <PIcon p={p.platform} />{p.er > 0 && <em>ER {p.er}</em>}
              </a>
              <div className={s.cBody}>
                <small>@{p.handle}{p.manual ? " · гараар" : ""}</small>
                <p>{p.caption.slice(0, 110) || "—"}</p>
                <div className={s.metrics}><span>❤ {p.likes.toLocaleString()}</span><span>💬 {p.comments.toLocaleString()}</span></div>
                {p.analysis && open === p._id ? (
                  <div className={s.breakdown}>
                    <div><b>Hook</b><span>{p.analysis.hook}</span></div>
                    <div><b>Формат</b><span>{p.analysis.format}</span></div>
                    <div><b>Яагаад</b><span>{p.analysis.why}</span></div>
                    <div><b>Мэдрэмж</b><span>{p.analysis.emotion}</span></div>
                    <button className={s.adapt} onClick={() => onIdea(p.analysis!.adapt)}><span>💡 {p.analysis.adapt}</span><em>Бүтээх →</em></button>
                  </div>
                ) : (
                  <button className={s.btn} disabled={!!busy} onClick={() => (p.analysis ? setOpen(p._id) : analyze(p._id))}>
                    <Icon name="spark" />{busy === `a${p._id}` ? "Задалж байна…" : p.analysis ? "Задаргаа харах" : "Задлах"}
                  </button>
                )}
              </div>
            </article>
          ))}
          {data && !data.posts.length && <p className={s.muted}>Өрсөлдөгч нэмэхэд тэдний постууд энд гарна.</p>}
        </div>
      </section>
    </div>
  );
}
