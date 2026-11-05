"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

/* ─── Сошиал хяналт (2026-10-18) ─────────────────────────────────────────
   Өглөө бүр 4 асуултад хариулна: юуг анхаарах (Анхааруулга), суваг бүр
   ямар байна (Сувгууд), пост бүр яаж ажиллав (Нэгдсэн timeline — Studio-оос
   ч, апп-аас шууд ч нийтэлсэн), гадаа юу ажиллаж байна (Өрсөлдөгч +
   Судалгаа). Өгөгдөл 6 цаг тутам автоматаар шинэчлэгдэнэ. */

type Ch = { platform: string; name: string; followers: number; ok: boolean; error: string; growth7: number | null; posts7: number; posts30: number; avg7: number; avg30: number; views7: number; top: { caption: string; score: number; permalink: string } | null };
type TL = { id: string; platform: string; caption: string; thumb: string; permalink: string; postedAt: string; likes: number; comments: number; shares: number; views: number; score: number; vsBase: number | null; flag: string };
type Day = { day: string; count: number; items: { id: string; text: string; at: string; platforms: string[] }[] };
type Pulse = { id: string; handle: string; platform: string; caption: string; er: number; likes: number; comments: number; permalink: string; thumb: string };
type Al = { level: "high" | "mid" | "info"; title: string; detail: string; href?: string };
type Data = { syncedAt: string | null; channels: Ch[]; timeline: TL[]; calendar: Day[]; pulse: Pulse[]; alerts: Al[]; competitors: number; shop: { toShip: number; products: { name: string; slug: string; tagline: string; price: number; soldOut: boolean; image: string }[] } };
type RS = { own: { id: string; platform: string; caption: string; score: number; likes: number; comments: number; views: number; permalink: string }[]; competitors: { id: string; handle: string; platform: string; caption: string; score: number; er: number; likes: number; comments: number; permalink: string }[]; stats: { own: number; ownAvg: number; comp: number; compAvg: number } };
type Brief = { finding: string; angles: string[]; gap: string; ideas: string[] };

const PF: Record<string, { label: string; bg: string }> = {
  instagram: { label: "IG", bg: "#27272A" }, facebook: { label: "FB", bg: "#27272A" }, threads: { label: "TH", bg: "#27272A" },
};
const LV = { high: { c: "#F87171", bg: "rgba(248,113,113,.10)", t: "Яаралтай" }, mid: { c: "#FAFAFA", bg: "rgba(255,255,255,.08)", t: "Анхаар" }, info: { c: "#A1A1AA", bg: "rgba(255,255,255,.04)", t: "Мэдээлэл" } };
const card = "rounded-[4px] border border-white/[0.07] bg-white/[0.025]";
const n = (x: number) => (x >= 1e4 ? `${(x / 1e3).toFixed(0)}K` : x >= 1e3 ? `${(x / 1e3).toFixed(1)}K` : String(x));
const ago = (s?: string | null) => { if (!s) return "—"; const m = Math.floor((Date.now() - +new Date(s)) / 6e4); return m < 60 ? `${m} мин` : m < 1440 ? `${Math.floor(m / 60)} цаг` : `${Math.floor(m / 1440)} хоног`; };
const WD = ["Ня", "Да", "Мя", "Лх", "Пү", "Ба", "Бя"];
const Dot = ({ p }: { p: string }) => <span className="inline-grid h-[22px] w-[22px] shrink-0 place-items-center rounded-[4px] text-[9px] font-extrabold text-white" style={{ background: PF[p]?.bg || "#444" }}>{PF[p]?.label || p.slice(0, 2).toUpperCase()}</span>;
const studio = (idea: string) => `/admin?idea=${encodeURIComponent(idea)}`;

export default function SocialCommand() {
  const [d, setD] = useState<Data | null>(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [pf, setPf] = useState("all");
  const [q, setQ] = useState("");
  const [rs, setRs] = useState<RS | null>(null);
  const [br, setBr] = useState<Brief | null>(null);

  const load = useCallback(async () => {
    const j = await fetch("/api/admin/command").then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (j) setD(j);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const refresh = async () => {
    setBusy("refresh"); setMsg("");
    const r = await fetch("/api/admin/command", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "refresh" }) }).then((x) => x.json()).catch(() => null);
    setBusy(""); await load();
    if (r) setMsg(`Шинэчлэгдлээ — IG ${r.meta?.instagram ?? 0} · FB ${r.meta?.facebook ?? 0} · Threads ${r.threads?.threads ?? 0} пост${r.threads?.error ? ` (${r.threads.error})` : ""}`);
  };
  const search = async () => {
    if (!q.trim()) return; setBusy("q"); setBr(null);
    const r = await fetch(`/api/admin/command?q=${encodeURIComponent(q)}`).then((x) => x.json()).catch(() => null);
    setBusy(""); setRs(r);
  };
  const makeBrief = async () => {
    setBusy("brief");
    const r = await fetch("/api/admin/command", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "brief", q }) }).then((x) => x.json()).catch(() => null);
    setBusy(""); if (r?.brief) setBr(r.brief); else setMsg(r?.error || "AI тайлан гарсангүй");
  };

  const tl = (d?.timeline || []).filter((t) => pf === "all" || t.platform === pf);
  const totalF = (d?.channels || []).reduce((a, c) => a + c.followers, 0);

  return (
    <div className="mx-auto w-full max-w-[1680px] pb-10 text-white">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold tracking-[-0.01em]">Сошиал хяналт</h1>
          <p className="mt-1 text-[13px] text-white/55">Бүх суваг, бүх пост, өрсөлдөгч — нэг дор · нийт {n(totalF)} дагагч · сүүлд татсан {ago(d?.syncedAt)} өмнө · 6 цаг тутам автомат</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin" className="rounded-[4px] border border-white/10 px-3 py-2 text-[13px] font-semibold hover:border-white/25">+ Пост бүтээх</Link>
          <button onClick={refresh} disabled={!!busy} className="rounded-[4px] bg-[#2E29FF] px-3 py-2 text-[13px] font-semibold hover:bg-[#1F1AD9] disabled:opacity-50">{busy === "refresh" ? "Бүх сувгийг татаж байна…" : "↻ Одоо шинэчлэх"}</button>
        </div>
      </div>
      {msg && <div className="mb-4 flex justify-between rounded-[4px] border border-white/10 bg-white/[0.03] px-4 py-2.5 text-[13px]">{msg}<button onClick={() => setMsg("")} className="text-white/50">×</button></div>}

      {/* 1. Alerts */}
      <section className={`${card} mb-3 p-4`}>
        <div className="mb-2 flex items-center justify-between"><h2 className="text-[15px] font-semibold">Өнөөдөр анхаарах</h2><span className="text-[12px] text-white/45">{d?.alerts.length ?? 0} зүйл</span></div>
        {!d ? <div className="h-16 animate-pulse rounded-[4px] bg-white/[0.03]" /> : !d.alerts.length ? <p className="text-[13px] text-[#4ADE80]">✓ Бүх зүйл хэвийн байна.</p> : (
          <div className="grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
            {d.alerts.map((a, i) => {
              const inner = (<><span className="mt-0.5 shrink-0 rounded-[4px] px-1.5 py-0.5 text-[10.5px] font-bold" style={{ color: LV[a.level].c, background: LV[a.level].bg }}>{LV[a.level].t}</span>
                <span className="min-w-0"><b className="block text-[13px] font-semibold">{a.title}</b><span className="block truncate text-[12px] text-white/50">{a.detail}</span></span></>);
              return a.href ? <Link key={i} href={a.href} className="flex gap-2.5 rounded-[4px] border border-white/[0.06] p-3 hover:bg-white/[0.03]">{inner}</Link> : <div key={i} className="flex gap-2.5 rounded-[4px] border border-white/[0.06] p-3">{inner}</div>;
            })}
          </div>
        )}
      </section>

      {/* 2. Channels */}
      <div className="mb-3 grid gap-3 md:grid-cols-3">
        {(d?.channels || [null, null, null]).map((c, i) => (
          <section key={i} className={`${card} p-4`}>
            {!c ? <div className="h-[150px] animate-pulse rounded-[4px] bg-white/[0.03]" /> : (<>
              <div className="flex items-center gap-2.5"><Dot p={c.platform} /><b className="text-[14px]">{c.name}</b><i className="ml-auto h-2 w-2 rounded-full" style={{ background: c.ok ? "#4ADE80" : "#F87171" }} title={c.error} /></div>
              <div className="mt-3 flex items-end gap-2"><span className="text-[28px] font-bold leading-none tabular-nums">{n(c.followers)}</span><span className="pb-0.5 text-[12px] text-white/50">дагагч</span>
                {c.growth7 !== null && <span className="ml-auto pb-0.5 text-[12px] font-semibold" style={{ color: c.growth7 >= 0 ? "#4ADE80" : "#F87171" }}>{c.growth7 >= 0 ? "+" : ""}{c.growth7} / 7х</span>}</div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                {[["Пост 7х", c.posts7], ["Дундаж оноо", c.avg7], [c.platform === "threads" ? "Үзэлт 7х" : "30х дундаж", c.platform === "threads" ? n(c.views7) : c.avg30]].map(([l, v]) => (
                  <div key={String(l)} className="rounded-[4px] bg-white/[0.03] py-2"><div className="text-[16px] font-bold tabular-nums">{v}</div><div className="text-[10.5px] text-white/45">{l}</div></div>
                ))}
              </div>
              {c.avg30 > 0 && c.posts7 > 0 && <p className="mt-2 text-[12px]" style={{ color: c.avg7 >= c.avg30 ? "#4ADE80" : "#FB923C" }}>{c.avg7 >= c.avg30 ? "↗ Энэ долоо хоног хэвийнээсээ сайн" : "↘ Энэ долоо хоног хэвийнээсээ сул"}</p>}
              {c.top && <a href={c.top.permalink} target="_blank" rel="noopener" className="mt-2 block truncate rounded-[4px] bg-white/[0.03] px-2.5 py-1.5 text-[12px] text-white/70 hover:text-white">🏆 {c.top.caption || "—"} · {c.top.score}</a>}
            </>)}
          </section>
        ))}
      </div>

      {/* 3. Calendar */}
      <section className={`${card} mb-3 p-4`}>
        <div className="mb-3 flex items-center justify-between"><h2 className="text-[15px] font-semibold">Ирэх 14 хоногийн хуваарь</h2><Link href="/admin" className="text-[12px] text-white/55 hover:text-white">Studio →</Link></div>
        <div className="grid grid-cols-7 gap-1.5 lg:grid-cols-[repeat(14,minmax(0,1fr))]">
          {(d?.calendar || []).map((c, i) => {
            const dt = new Date(c.day + "T12:00:00+08:00");
            return (
              <div key={c.day} title={c.items.map((x) => x.text).join("\n")}
                className={`rounded-[4px] border p-2 text-center ${c.count ? "border-white/30 bg-white/[0.06]" : i === 0 ? "border-white/10" : "border-dashed border-white/15"}`}>
                <div className="text-[10.5px] text-white/45">{WD[dt.getDay()]}</div>
                <div className="text-[15px] font-bold tabular-nums">{c.day.slice(8)}</div>
                <div className="mt-0.5 text-[10.5px] font-semibold" style={{ color: c.count ? "#FAFAFA" : "#71717A" }}>{c.count ? `${c.count} пост` : "хоосон"}</div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-3 xl:grid-cols-[1.6fr_1fr]">
        {/* 4. Unified timeline */}
        <section className={`${card} p-4`}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div><h2 className="text-[15px] font-semibold">Бүх пост — нэг дор</h2><p className="text-[12px] text-white/45">Studio-оос ч, апп-аас шууд ч нийтэлсэн бүгд. 🔥 = таны хэвийнээс 2× дээш · ❄ = 2× доош</p></div>
            <div className="flex rounded-full border border-white/10 p-0.5 text-[12px]">
              {[["all", "Бүгд"], ["instagram", "IG"], ["facebook", "FB"], ["threads", "Threads"]].map(([k, l]) => <button key={k} onClick={() => setPf(k)} className={`rounded-full px-3 py-1 ${pf === k ? "bg-white text-black" : "text-white/55 hover:text-white"}`}>{l}</button>)}
            </div>
          </div>
          <div className="divide-y divide-white/[0.05]">
            {tl.map((t) => (
              <a key={t.id} href={t.permalink} target="_blank" rel="noopener" className="flex items-center gap-3 py-2.5 hover:bg-white/[0.02]">
                <Dot p={t.platform} />
                {t.thumb ? <img src={t.thumb} alt="" className="h-10 w-10 shrink-0 rounded-[4px] object-cover" loading="lazy" /> : <span className="h-10 w-10 shrink-0 rounded-[4px] bg-white/[0.04]" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px]">{t.flag === "hot" && "🔥 "}{t.flag === "cold" && "❄ "}{t.caption || "—"}</p>
                  <p className="text-[11.5px] text-white/40">{ago(t.postedAt)} өмнө{t.vsBase !== null ? ` · хэвийнээс ${t.vsBase}×` : ""}</p>
                </div>
                <div className="hidden shrink-0 gap-3 text-[12px] tabular-nums text-white/60 sm:flex">
                  {t.views > 0 && <span>👁 {n(t.views)}</span>}<span>❤ {t.likes}</span><span>💬 {t.comments}</span>{t.shares > 0 && <span>↗ {t.shares}</span>}
                </div>
                <b className="w-10 shrink-0 text-right text-[13px] tabular-nums" style={{ color: t.flag === "hot" ? "#4ADE80" : t.flag === "cold" ? "#FB923C" : "#fff" }}>{t.score}</b>
              </a>
            ))}
            {d && !tl.length && <p className="py-6 text-center text-[13px] text-white/45">Пост алга — &quot;Одоо шинэчлэх&quot; дарна уу.</p>}
          </div>
        </section>

        <div className="flex flex-col gap-3">
          {/* 5. Competitor pulse */}
          <section className={`${card} p-4`}>
            <div className="mb-2 flex items-center justify-between"><h2 className="text-[15px] font-semibold">Өрсөлдөгчийн импульс</h2><Link href="/admin" className="text-[12px] text-white/55 hover:text-white">{d?.competitors ?? 0} хянаж буй →</Link></div>
            <p className="mb-2 text-[12px] text-white/45">Сүүлийн 72 цагт өөрийн дунджаасаа 2 дахин дээш гарсан постууд</p>
            {(d?.pulse || []).map((p) => (
              <div key={p.id} className="mb-2 rounded-[4px] border border-white/[0.06] p-3">
                <div className="flex items-center gap-2 text-[12px]"><Dot p={p.platform} /><b>@{p.handle}</b><span className="ml-auto text-white/50">❤ {p.likes} · 💬 {p.comments}{p.er ? ` · ER ${p.er}` : ""}</span></div>
                <p className="mt-1.5 line-clamp-2 text-[12.5px] text-white/75">{p.caption}</p>
                <div className="mt-2 flex gap-3 text-[12px]"><a href={p.permalink} target="_blank" rel="noopener" className="text-white/55 hover:text-white">Харах ↗</a><Link href={studio(`Энэ санааг өөрийн өнцгөөр: ${p.caption.slice(0, 120)}`)} className="font-semibold text-[#F87171]">Өөрийн хувилбар бүтээх →</Link></div>
              </div>
            ))}
            {d && !d.pulse.length && <p className="text-[13px] text-white/45">{d.competitors ? "Огцом өссөн пост алга." : "Content Studio → Өрсөлдөгч хэсэгт 3–5 аккаунт нэмнэ үү."}</p>}
          </section>

          {/* 6. Shop → post */}
          <section className={`${card} p-4`}>
            <div className="mb-2 flex items-center justify-between"><h2 className="text-[15px] font-semibold">Дэлгүүр → пост</h2><Link href="/admin/shop" className="text-[12px] text-white/55 hover:text-white">{d?.shop.toShip ? `${d.shop.toShip} илгээх →` : "Дэлгүүр →"}</Link></div>
            <div className="space-y-1.5">
              {(d?.shop.products || []).slice(0, 5).map((p) => (
                <div key={p.slug} className="flex items-center gap-2.5 rounded-[4px] bg-white/[0.03] px-2.5 py-2 text-[13px]">
                  {p.image ? <img src={p.image} alt="" className="h-8 w-8 rounded-[4px] object-cover" /> : <span className="h-8 w-8 rounded-[4px] bg-white/[0.06]" />}
                  <span className="min-w-0 flex-1 truncate">{p.name}<small className="block text-[11px] text-white/40">{p.price.toLocaleString()}₮{p.soldOut ? " · дууссан" : ""}</small></span>
                  <Link href={studio(`antaqor.com/shop — ${p.name}: ${p.tagline || ""}. Бүтээгдэхүүнээ танилцуулсан пост`)} className="shrink-0 text-[12px] font-semibold text-[#F87171]">Пост →</Link>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* 7. Research */}
      <section className={`${card} mt-3 p-4`}>
        <h2 className="text-[15px] font-semibold">Судалгаа</h2>
        <p className="mb-3 text-[12px] text-white/45">Сэдэв/түлхүүр үгээр өөрийн болон өрсөлдөгчдийн бүх постоос хайна — аль нь ажилласныг оноогоор эрэмбэлнэ.</p>
        <div className="flex flex-wrap gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void search()} placeholder="жишээ: Claude, agent, бизнес, prompt…"
            className="min-w-[240px] flex-1 rounded-[4px] border border-white/10 bg-white/[0.03] px-3 py-2 text-[13px] outline-none focus:border-white/25" />
          <button onClick={search} disabled={!!busy || !q.trim()} className="rounded-[4px] border border-white/10 px-4 py-2 text-[13px] font-semibold disabled:opacity-40">{busy === "q" ? "…" : "Хайх"}</button>
          {rs && (rs.own.length + rs.competitors.length > 0) && <button onClick={makeBrief} disabled={!!busy} className="rounded-[4px] bg-[#2E29FF] px-4 py-2 text-[13px] font-semibold disabled:opacity-50">{busy === "brief" ? "Дүгнэж байна…" : "✨ AI тайлан"}</button>}
        </div>
        {rs && (
          <div className="mt-4">
            <p className="mb-3 text-[12.5px] text-white/60">Таны {rs.stats.own} пост (дундаж {rs.stats.ownAvg}) · өрсөлдөгчийн {rs.stats.comp} пост (дундаж {rs.stats.compAvg})</p>
            {br && (
              <div className="mb-4 rounded-[4px] border border-[rgba(46,41,255,0.3)] bg-[rgba(46,41,255,0.06)] p-4 text-[13px]">
                <p className="font-semibold">{br.finding}</p>
                <div className="mt-3 grid gap-4 md:grid-cols-3">
                  <div><b className="text-[11.5px] uppercase tracking-wide text-white/50">Ажилласан өнцөг</b><ul className="mt-1 list-disc space-y-1 pl-4 text-white/80">{br.angles.map((x) => <li key={x}>{x}</li>)}</ul></div>
                  <div><b className="text-[11.5px] uppercase tracking-wide text-white/50">Танд дутуу</b><p className="mt-1 text-white/80">{br.gap}</p></div>
                  <div><b className="text-[11.5px] uppercase tracking-wide text-white/50">Постын санаа</b><div className="mt-1 space-y-1">{br.ideas.map((x) => <Link key={x} href={studio(x)} className="block rounded-[4px] bg-white/[0.04] px-2 py-1.5 text-white/85 hover:bg-white/[0.08]">{x} <span className="text-[#F87171]">→</span></Link>)}</div></div>
                </div>
              </div>
            )}
            <div className="grid gap-3 lg:grid-cols-2">
              {([["Миний постууд", rs.own], ["Өрсөлдөгчид", rs.competitors]] as const).map(([title, list]) => (
                <div key={title}>
                  <b className="text-[12.5px] text-white/60">{title} · {list.length}</b>
                  <div className="mt-2 space-y-1.5">
                    {list.slice(0, 10).map((p) => (
                      <a key={p.id} href={p.permalink || undefined} target="_blank" rel="noopener" className="flex gap-2.5 rounded-[4px] bg-white/[0.03] p-2.5 hover:bg-white/[0.05]">
                        <Dot p={p.platform} />
                        <span className="min-w-0 flex-1"><span className="line-clamp-2 text-[12.5px] text-white/80">{"handle" in p ? `@${p.handle}: ` : ""}{p.caption}</span><span className="text-[11.5px] text-white/40">❤ {p.likes} · 💬 {p.comments}</span></span>
                        <b className="shrink-0 text-[13px] tabular-nums">{p.score}</b>
                      </a>
                    ))}
                    {!list.length && <p className="text-[12.5px] text-white/40">Олдсонгүй</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
