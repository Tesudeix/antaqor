"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Icon from "@/components/Icon";
import { PLATFORMS, PLATFORM_LABEL as LABEL, validate, scheduleDate, type SocialPlatform as Platform } from "@/lib/socialInput";
import s from "./Studio.module.css";
import CompetitorTab from "./CompetitorTab";

/* ─── Content Studio v2 (2026-10-17) — өөрийн сошиал өгөгдөл дээр ажилладаг ──
   1. ТОЙМ   — холбосон IG/FB-ийн бодит хэмжүүр + AI-ийн сурсан playbook.
   2. БҮТЭЭХ — санаа → (шилдэг постоосоо суралцсан) 3 хувилбар → медиа →
               суваг → нийтлэх/товлох. Нэг дэлгэц, алхамын самбаргүй.
   3. НИЙТЭЛСЭН — ноорог / товлосон / нийтэлсэн / алдаатай нэг жагсаалтад.
   Нийтлэх backend (/api/admin/social/publish) хуучнаараа. */

type Health = { ok: boolean; label: string; error: string };
type Target = { key: string; label: string; facebook: Health; instagram: Health };
type Thread = { threadsUserId: string; username: string; ok: boolean; error: string };
type Accounts = { targets: Target[]; threads: Thread[] };
type Outcome = { platform: Platform; status: "ok" | "error" | "unknown"; permalink?: string; error?: string };
type Post = { _id: string; text: string; brief: string; imageUrl: string; videoUrl: string; platforms: Platform[]; state: string; createdAt: string; scheduledAt?: string; results: Outcome[] };
type Ins = { _id: string; platform: "instagram" | "facebook"; caption: string; mediaType: string; thumb: string; permalink: string; postedAt: string; likes: number; comments: number; shares: number; saves: number; score: number };
type Group = { key: string; n: number; avg: number };
type Insights = {
  accounts: { platform: string; name: string; followers: number; posts: number; ok: boolean; error?: string }[];
  stats: { total: number; last30: number; avgScore: number; avgLikes: number; avgComments: number; bestFormat: string; bestDay: string; bestHour: string; bestLength: string; formats: Group[]; weekdays: Group[] };
  top: Ins[]; recent: Ins[]; syncedAt: string | null;
  playbook: { summary: string; hooks: string[]; doList: string[]; avoid: string[]; ideas: string[]; learnedAt: string } | null;
};
type Variant = { caption: string; hook: string; score: number; why: string };
type Kind = "reel" | "image" | "text";
type View = "insights" | "create" | "competitors" | "library";

const fullUrl = (u: string) => new URL(u, "https://antaqor.com").href;
const when = (v?: string | null) => v ? new Date(v).toLocaleString("mn-MN", { timeZone: "Asia/Ulaanbaatar", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { cache: "no-store", ...init });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || (r.status === 401 ? "Нэвтрэлт дууссан" : `Алдаа (${r.status})`));
  return d as T;
}
const post = (body: unknown): RequestInit => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const PIcon = ({ p }: { p: string }) => <span className={`${s.pdot} ${s["p_" + p]}`}>{p === "instagram" ? "IG" : p === "facebook" ? "FB" : "TH"}</span>;

export default function ContentStudio() {
  const { data: session } = useSession();
  const [view, setView] = useState<View>("insights");
  const [ins, setIns] = useState<Insights | null>(null);
  const [acc, setAcc] = useState<Accounts | null>(null);
  const [rec, setRec] = useState<{ posts: Post[]; scheduled: Post[]; drafts: Post[] }>({ posts: [], scheduled: [], drafts: [] });
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  // composer
  const [idea, setIdea] = useState("");
  const [kind, setKind] = useState<Kind>("reel");
  const [variants, setVariants] = useState<Variant[]>([]);
  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [platforms, setPlatforms] = useState<Platform[]>(["instagram", "facebook", "threads"]);
  const [at, setAt] = useState("");
  const [filter, setFilter] = useState("all");
  const [metaKey, setMetaKey] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const gate = useRef(false);

  const loadIns = useCallback(async () => { try { setIns(await api<Insights>("/api/admin/social/insights")); } catch (e) { setMsg((e as Error).message); } }, []);
  const loadRec = useCallback(async () => { try { setRec(await api("/api/admin/social/publish?limit=50")); } catch { /* жагсаалт хоосон */ } }, []);
  const loadAcc = useCallback(async () => { try { setAcc(await api<Accounts>("/api/admin/social/accounts?fresh=1")); } catch { /* */ } }, []);
  useEffect(() => { if (session?.user?.email) { void loadIns(); void loadRec(); void loadAcc(); } }, [session?.user?.email, loadIns, loadRec, loadAcc]);
  /* /admin?idea=… — Сошиал хяналт, дэлгүүр, өрсөлдөгчөөс санаатай нээгдэнэ */
  useEffect(() => { const i = new URLSearchParams(window.location.search).get("idea"); if (i) { setIdea(i); setView("create"); window.history.replaceState(null, "", "/admin"); } }, []);

  async function run(name: string, fn: () => Promise<void>) {
    if (gate.current) return; gate.current = true; setBusy(name); setMsg("");
    try { await fn(); } catch (e) { setMsg((e as Error).message); } finally { gate.current = false; setBusy(""); }
  }

  const meta = acc?.targets.find((t) => t.key === metaKey) || acc?.targets.find((t) => /antaqor/i.test(t.key + t.label)) || acc?.targets[0];
  const th = acc?.threads.find((t) => /antaqor/i.test(t.username)) || acc?.threads[0];
  const health = (p: Platform): Health => p === "threads"
    ? { ok: !!th?.ok, label: th ? `@${th.username}` : "Холбогдоогүй", error: th?.error || "Threads холбогдоогүй" }
    : meta ? meta[p] : { ok: false, label: "Холбогдоогүй", error: "Meta холбогдоогүй" };
  const input = { text, imageUrl: imageUrl || undefined, videoUrl: videoUrl || undefined, platforms, overrides: {} };
  const problems = [...validate(input), ...platforms.filter((p) => !health(p).ok).map((p) => `${LABEL[p]}: ${health(p).error}`)];
  if (at) try { scheduleDate(at); } catch (e) { problems.push((e as Error).message); }

  function startFrom(t: string) { setIdea(t); setVariants([]); setView("create"); window.scrollTo({ top: 0, behavior: "smooth" }); }
  const sync = () => run("sync", async () => {
    const r = await api<{ instagram: number; facebook: number; insightsAllowed: boolean; learned: boolean; learnError: string; errors: string[] }>("/api/admin/social/insights", post({ action: "sync" }));
    await loadIns();
    setMsg(`${r.instagram} Instagram + ${r.facebook} Facebook пост шинэчлэгдлээ.${r.learned ? " AI дахин суралцлаа." : r.learnError ? ` AI: ${r.learnError}` : ""}${r.errors.length ? " " + r.errors.join(" · ") : ""}`);
  });
  const writeAI = () => run("write", async () => { const r = await api<{ variants: Variant[] }>("/api/admin/social/write", post({ idea, format: kind })); setVariants(r.variants); });
  const upload = (f: File) => run("upload", async () => {
    const vid = f.type.startsWith("video/") || /\.mp4$/i.test(f.name);
    if (f.size > (vid ? 150 : 12) * 1048576) throw new Error(`Файл ${vid ? 150 : 12}MB-аас бага байх ёстой`);
    const fd = new FormData(); fd.append("file", f);
    const r = await api<{ url: string }>(`/api/admin/social/${vid ? "video" : "image"}`, { method: "POST", body: fd });
    if (vid) { setVideoUrl(r.url); setImageUrl(""); setKind("reel"); } else { setImageUrl(r.url); setVideoUrl(""); if (kind === "text") setKind("image"); }
  });
  const aiImage = () => run("aiimg", async () => {
    const r = await api<{ url: string }>("/api/tools/generate-image", post({ prompt: idea || text.slice(0, 300), model: "nano2", aspectRatio: kind === "reel" ? "9:16" : "4:5", style: "auto" }));
    const blob = await (await fetch(r.url)).blob(); const fd = new FormData(); fd.append("file", new File([blob], "ai.png"));
    const n = await api<{ url: string }>("/api/admin/social/image", { method: "POST", body: fd }); setImageUrl(n.url); setVideoUrl("");
  });
  const toReel = () => run("reel", async () => { const r = await api<{ url: string }>("/api/admin/social/reel", post({ imageUrl })); setVideoUrl(r.url); setImageUrl(""); setKind("reel"); });
  const publish = (draft = false) => run(draft ? "draft" : "publish", async () => {
    const body = { ...input, brief: idea, metaAccount: meta?.key || "", threadsUserId: th?.threadsUserId || "", threads: {}, scheduledAt: !draft && at ? new Date(at).toISOString() : undefined, ...(draft ? { action: "draft" } : { requestKey: crypto.randomUUID() }) };
    const r = await api<{ scheduled: boolean; results: Outcome[]; state: string }>("/api/admin/social/publish", post(body));
    await loadRec();
    if (draft) { setMsg("Ноорог хадгалагдлаа."); return; }
    const ok = r.results?.filter((x) => x.status === "ok").length || 0;
    setMsg(r.scheduled ? `Товлогдлоо — ${when(at)}` : `Нийтлэгдлээ: ${ok}/${platforms.length} суваг.`);
    setText(""); setImageUrl(""); setVideoUrl(""); setVariants([]); setIdea(""); setAt(""); setView("library");
  });

  const all = [...rec.drafts, ...rec.scheduled, ...rec.posts];
  const lib = all.filter((p) => filter === "all" || (filter === "draft" ? p.state === "draft" : filter === "scheduled" ? p.state === "scheduled" : filter === "failed" ? p.results?.some((r) => r.status === "error") : p.state === "published"));
  const st = ins?.stats, pb = ins?.playbook;
  const maxDay = Math.max(1, ...(st?.weekdays || []).map((w) => w.avg));

  return (
    <div className={s.studio}>
      <header className={s.head}>
        <div>
          <span className={s.eyebrow}>CONTENT STUDIO</span>
          <h1>Өөрийн өгөгдлөөс суралцаж, илүү сайн пост.</h1>
        </div>
        <div className={s.accounts}>
          {(ins?.accounts || []).map((a) => (
            <span key={a.platform} className={s.acc} title={a.error || ""}><PIcon p={a.platform} /><b>{a.name}</b><small>{a.followers.toLocaleString()} дагагч</small><i className={a.ok ? s.on : s.off} /></span>
          ))}
          {th && <span className={s.acc}><PIcon p="threads" /><b>@{th.username}</b><i className={th.ok ? s.on : s.off} /></span>}
          {meta && (!meta.facebook.ok || !meta.instagram.ok) && <a className={s.fix} href="/api/admin/meta/oauth/start">Холболт засах →</a>}
        </div>
      </header>

      <nav className={s.tabs}>
        {([["insights", "Тойм", "chart"], ["create", "Бүтээх", "spark"], ["competitors", "Өрсөлдөгч", "target"], ["library", "Нийтэлсэн", "grid"]] as const).map(([v, l, i]) => (
          <button key={v} aria-current={view === v ? "page" : undefined} onClick={() => setView(v)}><Icon name={i} />{l}{v === "library" && all.length > 0 && <b>{all.length}</b>}</button>
        ))}
      </nav>

      {msg && <div className={s.notice} role="status">{msg}<button onClick={() => setMsg("")} aria-label="Хаах">×</button></div>}

      {/* ══ ТОЙМ ══ */}
      {view === "insights" && (
        <div className={s.stack}>
          <div className={s.syncRow}>
            <p>Сүүлд татсан: <b>{when(ins?.syncedAt)}</b> · {st?.total ?? 0} пост шинжилсэн</p>
            <button className={`${s.btn} ${s.primary}`} disabled={!!busy} onClick={sync}><Icon name="refresh" />{busy === "sync" ? "Татаж, суралцаж байна…" : "Шинэчлэх ба суралцах"}</button>
          </div>

          <div className={s.kpis}>
            {[
              ["30 хоногт пост", st?.last30 ?? "—"],
              ["Дундаж оноо / пост", st?.avgScore ?? "—"],
              ["Дундаж ❤ / 💬", st ? `${st.avgLikes} / ${st.avgComments}` : "—"],
              ["Шилдэг формат", st?.bestFormat ?? "—"],
              ["Шилдэг өдөр", st?.bestDay ?? "—"],
              ["Шилдэг цаг", st?.bestHour ?? "—"],
            ].map(([l, v]) => <div key={String(l)} className={s.kpi}><small>{l}</small><b>{v}</b></div>)}
          </div>

          <div className={s.two}>
            <section className={s.card}>
              <div className={s.cardHead}><h2>AI-ийн сурсан зүйл</h2>{pb?.learnedAt && <small>{when(pb.learnedAt)}</small>}</div>
              {pb ? (
                <div className={s.learn}>
                  <p className={s.summary}>{pb.summary}</p>
                  <div className={s.lists}>
                    <div><h3>✓ Ажилладаг</h3><ul>{pb.doList.map((x) => <li key={x}>{x}</li>)}</ul></div>
                    <div><h3>✕ Зайлсхий</h3><ul>{pb.avoid.map((x) => <li key={x}>{x}</li>)}</ul></div>
                  </div>
                  {pb.hooks.length > 0 && <><h3>Ажилласан эхлэлүүд</h3><div className={s.hooks}>{pb.hooks.map((h) => <span key={h}>{h}</span>)}</div></>}
                </div>
              ) : <p className={s.muted}>&quot;Шинэчлэх ба суралцах&quot; дарахад таны постуудаас дүгнэлт гаргана.</p>}
            </section>
            <section className={s.card}>
              <div className={s.cardHead}><h2>Дараагийн постын санаа</h2></div>
              <div className={s.ideas}>
                {(pb?.ideas || []).map((x) => <button key={x} onClick={() => startFrom(x)}><span>{x}</span><em>Бүтээх →</em></button>)}
                {!pb?.ideas?.length && <p className={s.muted}>Суралцсаны дараа энд санаа гарна.</p>}
              </div>
              {!!st?.weekdays?.length && (<>
                <h3 className={s.sub}>Гараг бүрийн дундаж оноо</h3>
                <div className={s.bars}>{st.weekdays.slice().sort((a, b) => ["Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан", "Бямба", "Ням"].indexOf(a.key) - ["Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан", "Бямба", "Ням"].indexOf(b.key)).map((w) => (
                  <div key={w.key} title={`${w.n} пост`}><i style={{ height: `${Math.max(6, (w.avg / maxDay) * 100)}%` }} className={w.key === st.bestDay ? s.best : ""} /><span>{w.key.slice(0, 2)}</span></div>
                ))}</div>
              </>)}
            </section>
          </div>

          <section className={s.card}>
            <div className={s.cardHead}><h2>Хамгийн сайн ажилласан постууд</h2><small>оноо = ❤ + 2×💬 + 3×шэйр/хадгалалт</small></div>
            <div className={s.topGrid}>
              {(ins?.top || []).map((p, i) => (
                <a key={p._id} href={p.permalink} target="_blank" rel="noopener" className={s.topCard}>
                  <div className={s.thumb}>{p.thumb ? <img src={p.thumb} alt="" loading="lazy" /> : <span>{p.mediaType}</span>}<em>#{i + 1}</em><PIcon p={p.platform} /></div>
                  <p>{p.caption.slice(0, 90) || "—"}</p>
                  <div className={s.metrics}><span>❤ {p.likes}</span><span>💬 {p.comments}</span>{p.shares > 0 && <span>↗ {p.shares}</span>}<b>{p.score}</b></div>
                </a>
              ))}
              {!ins?.top?.length && <p className={s.muted}>Пост алга — &quot;Шинэчлэх ба суралцах&quot; дарна уу.</p>}
            </div>
          </section>
        </div>
      )}

      {/* ══ БҮТЭЭХ ══ */}
      {view === "create" && (
        <div className={s.create}>
          <section className={s.card}>
            <div className={s.cardHead}><h2>1 · Санаа</h2><div className={s.seg}>{([["reel", "Reel"], ["image", "Зураг"], ["text", "Текст"]] as const).map(([k, l]) => <button key={k} aria-pressed={kind === k} onClick={() => setKind(k)}>{l}</button>)}</div></div>
            <textarea className={s.input} rows={3} value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="Юуны тухай пост вэ? Жишээ: Монголчууд AI-г буруу ойлгодог 3 зүйл" />
            <button className={`${s.btn} ${s.primary} ${s.wide}`} disabled={!!busy || idea.trim().length < 3} onClick={writeAI}><Icon name="spark" />{busy === "write" ? "Таны шилдэг постуудаас суралцаж бичиж байна…" : "AI бичих — миний шилдэг постоос суралцсан"}</button>
            {variants.length > 0 && (
              <div className={s.variants}>
                {variants.map((v, i) => (
                  <button key={i} className={text === v.caption ? s.picked : ""} onClick={() => setText(v.caption)}>
                    <div className={s.vTop}><b>Хувилбар {i + 1}</b><span className={s.score} style={{ ["--s" as string]: `${v.score}%` }}>{v.score}</span></div>
                    <p>{v.caption}</p>
                    <small>💡 {v.why}</small>
                  </button>
                ))}
              </div>
            )}

            <h3 className={s.sub}>2 · Медиа</h3>
            <div className={s.mediaRow}>
              <button className={s.btn} disabled={!!busy} onClick={() => file.current?.click()}><Icon name="upload" />{busy === "upload" ? "Оруулж байна…" : "Файл оруулах"}</button>
              <button className={s.btn} disabled={!!busy || !(idea || text)} onClick={aiImage}><Icon name="image" />{busy === "aiimg" ? "Үүсгэж байна…" : "AI зураг"}</button>
              {imageUrl && <button className={s.btn} disabled={!!busy} onClick={toReel}><Icon name="reel" />{busy === "reel" ? "…" : "Зургаас Reel"}</button>}
              {(imageUrl || videoUrl) && <button className={s.link} onClick={() => { setImageUrl(""); setVideoUrl(""); }}>Арилгах</button>}
            </div>
            <input ref={file} type="file" hidden accept="image/*,video/mp4,video/quicktime" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
            <p className={s.hint}>Reel: 9:16, 4–60 сек. Instagram зураг/видеогүй пост хүлээж авдаггүй.</p>
          </section>

          <section className={`${s.card} ${s.sticky}`}>
            <div className={s.cardHead}><h2>3 · Урьдчилж харах ба нийтлэх</h2></div>
            <div className={s.phone}>
              <div className={s.phoneHead}><span className={s.avatar}>A</span><b>{ins?.accounts.find((a) => a.platform === "instagram")?.name || "@antaqor"}</b></div>
              <div className={s.phoneMedia}>{videoUrl ? <video src={fullUrl(videoUrl)} controls playsInline /> : imageUrl ? <img src={imageUrl} alt="" /> : <span>{kind === "text" ? "Текст пост" : "Медиа энд харагдана"}</span>}</div>
              <textarea className={s.caption} rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="Тайлбар — AI хувилбар сонгох эсвэл өөрөө бич" />
              <small className={s.count}>{text.length} / 2200</small>
            </div>
            {(acc?.targets.length || 0) > 1 && (
              <label className={s.when}>Facebook / Instagram аккаунт
                <select value={meta?.key || ""} onChange={(e) => setMetaKey(e.target.value)} className={s.field}>
                  {acc!.targets.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </label>
            )}
            <div className={s.channels}>
              {PLATFORMS.map((p) => { const h = health(p); return (
                <label key={p} className={!h.ok ? s.dim : ""}>
                  <input type="checkbox" checked={platforms.includes(p)} onChange={(e) => setPlatforms(e.target.checked ? [...platforms, p] : platforms.filter((x) => x !== p))} />
                  <PIcon p={p} /><span>{LABEL[p]}<small>{h.ok ? h.label : h.error}</small></span>
                </label>
              ); })}
            </div>
            <label className={s.when}>Товлох (хоосон бол одоо)<input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
              {st?.bestDay && <small>Таны шилдэг цаг: {st.bestDay} · {st.bestHour}</small>}</label>
            {problems.length > 0 && (text || imageUrl || videoUrl) && <ul className={s.problems}>{problems.map((p) => <li key={p}>{p}</li>)}</ul>}
            <div className={s.actions}>
              <button className={s.btn} disabled={!!busy || !text} onClick={() => publish(true)}>Ноорог</button>
              <button className={`${s.btn} ${s.dark}`} disabled={!!busy || problems.length > 0} onClick={() => publish(false)}><Icon name="send" />{busy === "publish" ? "Илгээж байна…" : at ? "Товлох" : `${platforms.length} сувагт нийтлэх`}</button>
            </div>
          </section>
        </div>
      )}

      {view === "competitors" && <CompetitorTab onIdea={startFrom} />}

      {/* ══ НИЙТЭЛСЭН ══ */}
      {view === "library" && (
        <div className={s.stack}>
          <div className={s.seg} style={{ alignSelf: "flex-start" }}>
            {([["all", "Бүгд"], ["published", "Нийтэлсэн"], ["scheduled", "Товлосон"], ["draft", "Ноорог"], ["failed", "Алдаатай"]] as const).map(([k, l]) => <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>)}
          </div>
          <div className={s.libList}>
            {lib.map((p) => (
              <article key={p._id} className={s.row}>
                <div className={s.rowMedia}>{p.videoUrl ? <video src={fullUrl(p.videoUrl)} muted preload="metadata" /> : p.imageUrl ? <img src={p.imageUrl} alt="" /> : <span>Aa</span>}</div>
                <div className={s.rowBody}>
                  <p>{p.text || p.brief || "—"}</p>
                  <div className={s.rowMeta}>
                    <span className={s.state}>{p.state === "draft" ? "Ноорог" : p.state === "scheduled" ? `Товлосон · ${when(p.scheduledAt)}` : when(p.createdAt)}</span>
                    {(p.results || []).map((r) => r.permalink
                      ? <a key={r.platform} href={r.permalink} target="_blank" rel="noopener" className={r.status === "ok" ? s.okTag : s.errTag}><PIcon p={r.platform} />{r.status === "ok" ? "✓" : "!"}</a>
                      : <span key={r.platform} className={r.status === "ok" ? s.okTag : s.errTag} title={r.error || ""}><PIcon p={r.platform} />{r.status === "ok" ? "✓" : "!"}</span>)}
                  </div>
                </div>
                {p.state === "draft" && <button className={s.btn} onClick={() => { setText(p.text); setIdea(p.brief); setImageUrl(p.imageUrl || ""); setVideoUrl(p.videoUrl || ""); setPlatforms(p.platforms?.length ? p.platforms : platforms); setView("create"); }}>Нээх</button>}
              </article>
            ))}
            {!lib.length && <p className={s.muted}>Энд одоогоор юу ч алга.</p>}
          </div>
        </div>
      )}

      {busy && busy !== "write" && busy !== "sync" && <div className={s.working}><span />Боловсруулж байна…</div>}
    </div>
  );
}
