"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Icon from "@/components/Icon";
import { DAY, WEEKDAYS, WD_SHORT, checkSlot, hm, md, ub, ymd, pillarColor } from "@/lib/contentAgentRules";
import { api, send, firstLine, PENDING, type Accounts, type External, type Slot, type State } from "./agentTypes";
import SlotDrawer from "./SlotDrawer";
import { Plats, StatusTag } from "./bits";
import AgentSettings from "./AgentSettings";
import s from "./Agent.module.css";

/* ─── Контент агент (2026-10-23) ──────────────────────────────────────────
   7 ХОНОГ  — агентын стратеги, календарь, ноорог бүрийг нэг нэгээр нь эсвэл
              бүгдийг нь батална. Батлах = товлох; нийтлэлтийг social-schedule.
   ТОХИРГОО — брэнд бүрийн хэмнэл, суваг, зураг, контентын багана, бриф.
   ТҮҮХ     — өнгөрсөн 7 хоногуудын батлалт ба үр дүн.
   Агент ажиллаж байхад 2.5с тутам, бусад үед 60с тутам шинэчилнэ. */

type Tab = "week" | "settings" | "history";
type Confirm = { title: string; body: string; label: string; tone?: "danger"; run: () => Promise<void> };
type Item = { kind: "slot"; at: number; slot: Slot } | { kind: "ext"; at: number; ext: External };

const ago = (ms: number) => { const s2 = Math.max(0, Math.round(ms / 1000)); return s2 < 60 ? `${s2}с` : `${Math.floor(s2 / 60)}м ${String(s2 % 60).padStart(2, "0")}с`; };
function until(ms: number) {
  if (ms <= 0) return "одоо";
  const d = Math.floor(ms / DAY), h = Math.floor((ms % DAY) / 3600e3), m = Math.floor((ms % 3600e3) / 60e3);
  return d ? `${d} өдөр ${h} цагийн дараа` : h ? `${h} цаг ${m} минутын дараа` : `${m} минутын дараа`;
}
const tagOf = (brief: string, state: string) => { const m = /^\[([^\]]+)\]/.exec(brief || ""); return m ? m[1].replace(/\s+\d{1,2}\/\d{1,2}.*$/, "").slice(0, 28) : state === "published" ? "Нийтлэгдсэн" : "Гараар товлосон"; };


export default function ContentAgent() {
  const [brandKey, setBrandKey] = useState("");
  const [week, setWeek] = useState("");
  const [tab, setTab] = useState<Tab>("week");
  const [st, setSt] = useState<State | null>(null);
  const [acc, setAcc] = useState<Accounts | null>(null);
  const [err, setErr] = useState("");
  const [toast, setToast] = useState<{ msg: string; tone: "ok" | "err" } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [newBrand, setNewBrand] = useState<{ name: string; key: string; kind: "product" | "personal" } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const inited = useRef(false);
  const seq = useRef(0);

  /* URL ↔ төлөв (?brand=&week=&tab=) — холбоосоор хуваалцаж, F5 дарсан ч байрандаа */
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setBrandKey(q.get("brand") || "");
    setWeek(q.get("week") || "");
    const t = q.get("tab"); if (t === "settings" || t === "history") setTab(t);
    inited.current = true;
  }, []);
  useEffect(() => {
    if (!inited.current) return;
    const q = new URLSearchParams();
    if (brandKey) q.set("brand", brandKey);
    if (week) q.set("week", week);
    if (tab !== "week") q.set("tab", tab);
    window.history.replaceState(null, "", `/admin/content-agent${q.toString() ? `?${q}` : ""}`);
  }, [brandKey, week, tab]);

  const load = useCallback(async () => {
    const my = ++seq.current;
    try {
      const d = await api<State>(`/api/admin/content-agent?brand=${encodeURIComponent(brandKey)}&week=${encodeURIComponent(week)}`);
      if (my !== seq.current) return;
      setSt(d); setErr("");
      if (!brandKey) setBrandKey(d.brand.key);
    } catch (e) { if (my === seq.current) setErr((e as Error).message); }
  }, [brandKey, week]);
  useEffect(() => { if (inited.current) void load(); }, [load]);
  useEffect(() => { api<Accounts>("/api/admin/social/accounts").then(setAcc).catch(() => {}); }, []);

  const plan = st?.plan || null;
  const working = !!plan && (plan.status === "planning" || plan.status === "writing" || plan.slots.some((x) => PENDING.has(x.status) || x.imageState === "queued" || x.imageState === "working" || x.status === "publishing"));
  useEffect(() => {
    if (!st) return;
    const t = setTimeout(() => { void load(); }, working ? 2500 : 60000);
    return () => clearTimeout(t);
  }, [st, working, load]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), working ? 1000 : 30000); return () => clearInterval(t); }, [working]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4200); return () => clearTimeout(t); }, [toast]);

  const say = (msg: string, tone: "ok" | "err" = "ok") => setToast({ msg, tone });
  async function run(name: string, fn: () => Promise<void>) {
    if (busy) return;
    setBusy(name);
    try { await fn(); } catch (e) { say((e as Error).message, "err"); } finally { setBusy(""); }
  }
  const slotAct = useCallback(async (slotId: string, action: string, extra: Record<string, unknown> = {}) => {
    if (!plan) return;
    await api("/api/admin/content-agent/slot", send("PATCH", { planId: plan._id, slotId, action, ...extra }));
    await load();
  }, [plan, load]);

  /* ── derived ── */
  const brand = st?.brand;
  const pillarNames = useMemo(() => (brand?.pillars || []).map((p) => p.name), [brand]);
  const slots = useMemo(() => [...(plan?.slots || [])].sort((a, b) => +new Date(a.at) - +new Date(b.at)), [plan]);
  const issues = useMemo(() => {
    const m = new Map<string, { errors: number; warns: number }>();
    if (!brand) return m;
    for (const x of slots) {
      const c = checkSlot(x, brand, { now });
      m.set(x.id, { errors: c.filter((i) => i.level === "error").length, warns: c.filter((i) => i.level === "warn").length });
    }
    return m;
  }, [slots, brand, now]);
  const count = (...k: string[]) => slots.filter((x) => k.includes(x.status)).length;
  const drafts = slots.filter((x) => x.status === "draft");
  const readyDrafts = drafts.filter((x) => !issues.get(x.id)?.errors);
  const pending = slots.filter((x) => PENDING.has(x.status)).length;
  const imgTotal = slots.filter((x) => x.imageState !== "none").length;
  const imgDone = slots.filter((x) => x.imageState === "done" || x.imageState === "error").length;
  const weekStart = st ? new Date(st.week.start).getTime() : 0;
  const days = useMemo(() => {
    if (!st) return [];
    const today = ymd(new Date(now));
    return Array.from({ length: 7 }, (_, i) => {
      const d0 = weekStart + i * DAY;
      const items: Item[] = [
        ...slots.filter((x) => +new Date(x.at) >= d0 && +new Date(x.at) < d0 + DAY).map((slot) => ({ kind: "slot" as const, at: +new Date(slot.at), slot })),
        ...st.external.filter((x) => +new Date(x.at) >= d0 && +new Date(x.at) < d0 + DAY).map((ext) => ({ kind: "ext" as const, at: +new Date(ext.at), ext })),
      ].sort((a, b) => a.at - b.at);
      return { i, date: new Date(d0), today: ymd(new Date(d0)) === today, past: d0 + DAY < now, items };
    });
  }, [st, slots, weekStart, now]);
  const cur = open ? slots.find((x) => x.id === open) || null : null;
  const navOrder = slots.filter((x) => x.status !== "skipped").map((x) => x.id);

  const meta = acc?.targets.find((t) => t.key === brand?.metaAccount);
  const thr = acc?.threads.find((t) => t.threadsUserId === brand?.threadsUserId);
  const handles = { facebook: meta?.facebook.label || brand?.name || "", instagram: (meta?.instagram.label || "").replace(/^@/, "") || brand?.key || "", threads: thr?.username || brand?.key || "" };

  /* ── actions ── */
  const shiftWeek = (n: number) => { setOpen(null); setWeek(ymd(new Date(weekStart + n * 7 * DAY + 12 * 3600e3))); };
  const create = (replace = false) => run("create", async () => {
    await api("/api/admin/content-agent", send("POST", { action: "create", brand: brand!.key, week: st!.week.start, note, replace }));
    setNote(""); say("Агент ажиллаж эхэллээ — 2–3 минутад бэлэн болно"); await load();
  });
  const askReplan = () => { setMenu(false); setConfirm({
    title: "Дахин төлөвлөх үү?", label: "Шинээр төлөвлөх",
    body: `Одоогийн төлөвлөгөөний батлаагүй ноорог устана. Батлагдсан ${count("scheduled", "publishing", "published")} пост хуваарьтаа хэвээр үлдэж, календарьт «өөр пост» болж харагдана.`,
    run: async () => { await api("/api/admin/content-agent", send("POST", { action: "create", brand: brand!.key, week: st!.week.start, note: plan?.note || "", replace: true })); say("Шинэ төлөвлөгөө гаргаж байна"); await load(); },
  }); };
  const askArchive = () => { setMenu(false); setConfirm({
    title: "Төлөвлөгөөг устгах уу?", label: "Устгах", tone: "danger",
    body: "Ноорог, стратеги архивлагдана. Аль хэдийн товлогдсон постууд цуцлагдахгүй — тэдгээрийг Content Studio-оос удирдана.",
    run: async () => { await api("/api/admin/content-agent", send("POST", { action: "archive", planId: plan!._id })); setOpen(null); say("Төлөвлөгөө архивлагдлаа"); await load(); },
  }); };
  const askApproveAll = () => setConfirm({
    title: `${readyDrafts.length} ноорог батлах уу?`, label: `${readyDrafts.length} пост товлох`,
    body: `Батлагдсан пост бүр товлосон цагтаа ${brand?.name}-ийн сувгуудад автоматаар нийтлэгдэнэ. Нийтлэгдэхээс өмнө хүссэн үедээ цуцалж, засах боломжтой.${drafts.length > readyDrafts.length ? ` Алдаатай ${drafts.length - readyDrafts.length} ноорог алгасагдана.` : ""}`,
    run: async () => {
      const r = await api<{ approved: string[]; failed: { id: string; error: string }[] }>("/api/admin/content-agent", send("POST", { action: "approveAll", planId: plan!._id }));
      say(r.failed.length ? `${r.approved.length} товлогдлоо · ${r.failed.length} алдаатай: ${r.failed[0].error}` : `${r.approved.length} пост товлогдлоо ✓`, r.failed.length ? "err" : "ok");
      await load();
    },
  });
  const addBrand = () => run("brand", async () => {
    const r = await api<{ key: string }>("/api/admin/content-agent/brands", send("POST", newBrand));
    setNewBrand(null); setBrandKey(r.key); setTab("settings"); say("Брэнд нэмэгдлээ — брифээ бөглөнө үү");
  });

  if (!st) {
    return (
      <div className={s.agent}>
        {err ? <div className={s.fatal}><Icon name="alert" size={20} /><p>{err}</p><button className={s.btn} onClick={() => void load()}>Дахин оролдох</button></div>
          : <div className={s.boot}><span className={s.orb} /><p>Агентыг ачаалж байна…</p></div>}
      </div>
    );
  }
  const b = st.brand;
  const nextRunMs = st.nextRun ? +new Date(st.nextRun) - now : 0;
  const expected = Math.max(1, Math.round((b.postsPerWeek * days.filter((d) => +d.date + DAY > now + 2 * 3600e3).length) / 7));
  const initialGen = !!plan && (plan.status === "planning" || (plan.status === "writing" && (pending >= 2 || slots.every((x) => !x.caption))));
  const mix = (() => {
    const m = new Map<string, number>();
    slots.filter((x) => x.status !== "skipped").forEach((x) => m.set(x.pillar, (m.get(x.pillar) || 0) + 1));
    return [...m].sort((a, c) => c[1] - a[1]);
  })();

  return (
    <div className={s.agent}>
      {/* ── Толгой ── */}
      <header className={s.head}>
        <div className={s.headText}>
          <span className={s.eyebrow}><i className={b.active ? s.live : s.idle} />КОНТЕНТ АГЕНТ</span>
          <h1>7 хоног бүр төлөвлөж, бичиж, зураг гаргана. <em>Та зөвхөн батална.</em></h1>
        </div>
        <div className={s.headSide}>
          <div className={s.brands} role="tablist" aria-label="Брэнд">
            {st.brands.map((x) => (
              <button key={x.key} role="tab" aria-selected={x.key === b.key} className={s.brandPill} onClick={() => { setOpen(null); setBrandKey(x.key); }}>
                <span className={s.brandAv}>{x.name.slice(0, 1).toUpperCase()}</span>
                <span>{x.name}</span>
                {!x.ready.ok ? <i className={s.brandWarn} title="Тохиргоо дутуу" /> : x.active ? <i className={s.brandOn} title="Автомат асаалттай" /> : null}
              </button>
            ))}
            <button className={s.brandAdd} onClick={() => setNewBrand({ name: "", key: "", kind: "product" })} aria-label="Брэнд нэмэх" title="Брэнд нэмэх"><Icon name="plus" size={16} /></button>
          </div>
          <button className={s.pulse} data-on={b.active} onClick={() => setTab("settings")}>
            {b.active && st.nextRun
              ? <><i /><span>Автомат · <b>{WEEKDAYS[b.runWeekday - 1]} {String(b.runHour).padStart(2, "0")}:00</b> · {until(nextRunMs)}</span></>
              : <><i /><span>Автомат унтраалттай — {st.ready.ok ? "асаах" : "тохиргоо дутуу"}</span></>}
          </button>
        </div>
      </header>

      <nav className={s.tabs} role="tablist">
        <button role="tab" aria-current={tab === "week" ? "page" : undefined} onClick={() => setTab("week")}><Icon name="calendar" size={16} />7 хоног{drafts.length > 0 && <b>{drafts.length}</b>}</button>
        <button role="tab" aria-current={tab === "settings" ? "page" : undefined} onClick={() => setTab("settings")}><Icon name="settings" size={16} />Тохиргоо{!st.ready.ok && <b className={s.tabWarn}>!</b>}</button>
        <button role="tab" aria-current={tab === "history" ? "page" : undefined} onClick={() => setTab("history")}><Icon name="chart" size={16} />Түүх</button>
      </nav>
      {err && <div className={s.inlineErr}><Icon name="alert" size={16} />{err}</div>}

      {tab === "week" && (
        <div className={s.stack}>
          {/* ── 7 хоногийн мөр ── */}
          <div className={s.weekBar}>
            <div className={s.weekNav}>
              <button className={s.iconBtn} onClick={() => shiftWeek(-1)} aria-label="Өмнөх 7 хоног"><Icon name="chevronLeft" size={16} /></button>
              <div className={s.weekTitle}><b>{st.week.iso}-р 7 хоног</b><span>{st.week.label}{st.week.isCurrent ? " · энэ 7 хоног" : st.week.isPast ? " · өнгөрсөн" : ""}</span></div>
              <button className={s.iconBtn} onClick={() => shiftWeek(1)} aria-label="Дараагийн 7 хоног"><Icon name="chevron" size={16} /></button>
              {!st.week.isCurrent && <button className={s.textBtn} onClick={() => { setOpen(null); setWeek(""); }}>Энэ 7 хоног</button>}
            </div>
            {plan && (
              <div className={s.weekActions}>
                <span className={s.planState} data-st={plan.status}>
                  {plan.status === "ready" ? <><Icon name="check" size={16} />Бэлэн</> : plan.status === "failed" ? <><Icon name="alert" size={16} />Амжилтгүй</> : <><i className={s.spinMini} />Ажиллаж байна</>}
                </span>
                <span className={s.planMeta}>{plan.createdBy === "cron" ? "Автомат" : "Гараар"} · {md(plan.createdAt)} {hm(plan.createdAt)}</span>
                <div className={s.menuWrap}>
                  <button className={s.iconBtn} onClick={() => setMenu((v) => !v)} aria-label="Үйлдлүүд" aria-expanded={menu}><Icon name="dots" size={16} /></button>
                  {menu && (
                    <div className={s.menu} onMouseLeave={() => setMenu(false)}>
                      {!st.week.isPast && <button onClick={askReplan} disabled={working}><Icon name="refresh" size={16} />Дахин төлөвлөх</button>}
                      <button onClick={askArchive} className={s.menuDanger}><Icon name="trash" size={16} />Төлөвлөгөө устгах</button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Төлөвлөгөө алга ── */}
          {!plan && (
            <section className={s.empty}>
              <div className={s.emptyMain}>
                <span className={s.kicker}>{st.week.isPast ? "Өнгөрсөн 7 хоног" : "Төлөвлөгөө алга"}</span>
                <h2>{st.week.isPast ? "Энэ 7 хоногт агент ажиллаагүй" : <>{b.name}-ийн {st.week.iso}-р 7 хоногийг агентад даатга</>}</h2>
                {!st.week.isPast && <>
                  <p>Агент сүүлийн постуудын үр дүн, playbook, аль хэдийн товлосон постуудыг уншаад <b>~{expected} постын</b> стратеги, ноорог, зураг бэлдэнэ. <b>Таны батламжгүйгээр нэг ч пост нийтлэгдэхгүй.</b></p>
                  <label className={s.noteBox}>
                    <span>Энэ 7 хоногт онцлох зүйл <em>заавал биш</em></span>
                    <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={600} placeholder={b.kind === "product" ? "Жишээ: 11/1-нээс 15% хямдрал, шинэ өнгө ирсэн" : "Жишээ: шинэ хичээл нээгдэнэ, нэг хэрэгслийг онцлох"} />
                  </label>
                  {!!st.insight?.ideas.length && (
                    <div className={s.ideaChips}><span>Playbook-ийн санаа</span>{st.insight.ideas.slice(0, 4).map((i) => <button key={i} onClick={() => setNote(i)} title={i}>{i}</button>)}</div>
                  )}
                  <div className={s.emptyCta}>
                    <button className={s.primary} disabled={!st.ready.ok || busy === "create"} onClick={() => create(false)}>
                      {busy === "create" ? <><i className={s.spin} />Эхлүүлж байна…</> : <><Icon name="spark" size={16} />Төлөвлөгөө гаргах</>}
                    </button>
                    <span className={s.est}><Icon name="clock" size={16} />~2–3 минут{b.imageMode === "auto" ? ` · зураг ~$${(Math.round(expected * b.imageShare / 100) * 0.07).toFixed(2)}` : ""}</span>
                  </div>
                  {!st.ready.ok && (
                    <div className={s.readyBox}>
                      <b>Эхлэхээс өмнө дутуу:</b>
                      <ul>{st.ready.items.filter((i) => !i.ok).map((i) => <li key={i.label}>{i.label}</li>)}</ul>
                      <button className={s.btn} onClick={() => setTab("settings")}>Тохиргоо руу</button>
                    </div>
                  )}
                </>}
                <div className={s.reads}>
                  <span><Icon name="chart" size={16} />{st.insight?.total ? `Шилдэг: ${st.insight.bestFormat} · ${st.insight.bestDay} · ${st.insight.bestHour}` : "Хэмжүүр алга — брифээр ажиллана"}</span>
                  <span><Icon name="calendar" size={16} />Хуваарьт {st.external.length} пост</span>
                  <span><Icon name="shield" size={16} />Хүн батална</span>
                </div>
              </div>
              <ol className={s.pipeline}>
                {[
                  ["chart", "Уншина", "Сүүлийн постуудын оноо, шилдэг цаг, товлогдсон постууд"],
                  ["target", "Стратеги", "7 хоногийн нэг сэдэв, контентын холимог, цаг"],
                  ["compose", "Бичнэ", "Брэндийн дуу хоолойгоор пост бүрийг 2 хувилбараар"],
                  ["image", "Зураг", "Зурагтай постуудад Nano Banana-аар"],
                  ["check", "Та батална", "Нэг товчоор товлогдоно — эсвэл засаад, алгасаад"],
                ].map(([ic, t, d], i) => (
                  <li key={t} style={{ "--i": i } as CSSProperties}><span><Icon name={ic as "chart"} size={16} /></span><div><b>{t}</b><em>{d}</em></div></li>
                ))}
              </ol>
            </section>
          )}

          {/* ── Агент ажиллаж байна ── */}
          {plan && initialGen && (
            <section className={s.console}>
              <div className={s.consoleHead}>
                <span className={s.orb} />
                <div><b>Агент ажиллаж байна</b><span>{ago(now - +new Date(plan.createdAt))} · {plan.status === "planning" ? "өгөгдөл уншиж, стратеги гаргаж байна" : pending ? `${slots.length - pending}/${slots.length} ноорог` : `зураг ${imgDone}/${imgTotal}`}</span></div>
              </div>
              <div className={s.consoleBar}><i style={{ width: `${plan.status === "planning" ? 12 : Math.round(15 + ((slots.length - pending + imgDone) / Math.max(1, slots.length + imgTotal)) * 85)}%` }} /></div>
              <ol className={s.steps}>
                {[
                  { t: "Өгөгдөл ба стратеги", d: plan.strategy.theme ? `«${plan.strategy.theme}» · ${slots.length} пост` : "Сүүлийн постууд, playbook, товлогдсон постууд", state: plan.status === "planning" ? "run" : "done" },
                  { t: `Ноорог ${slots.length - pending}/${slots.length || "…"}`, d: "Брэндийн дуу хоолойгоор, 2 хувилбар", state: plan.status === "planning" ? "wait" : pending ? "run" : "done" },
                  { t: `Зураг ${imgDone}/${imgTotal}`, d: imgTotal ? "Nano Banana · 4:5" : "Энэ 7 хоногт зурагтай пост алга", state: plan.status === "planning" || pending ? "wait" : imgDone < imgTotal ? "run" : "done" },
                  { t: "Таны батламж", d: "Ноорог бүрийг шалгаад батална", state: "wait" },
                ].map((x) => (
                  <li key={x.t} data-state={x.state}><span>{x.state === "done" ? <Icon name="check" size={16} /> : x.state === "run" ? <i className={s.spinMini} /> : null}</span><div><b>{x.t}</b><em>{x.d}</em></div></li>
                ))}
              </ol>
              {plan.log.length > 0 && <div className={s.logTail}>{plan.log.slice(-4).map((l, i) => <p key={i} data-ok={l.ok}><time>{hm(l.at)}</time>{l.step} — {l.detail}</p>)}</div>}
            </section>
          )}

          {plan?.status === "failed" && (
            <div className={s.failBox}>
              <Icon name="alert" size={20} />
              <div><b>Агент төлөвлөгөө гаргаж чадсангүй</b><p>{plan.error}</p></div>
              <button className={s.btn} disabled={!!busy} onClick={() => run("retry", async () => { await api("/api/admin/content-agent", send("POST", { action: "retry", planId: plan._id })); await load(); })}>Дахин оролдох</button>
            </div>
          )}

          {/* ── Стратеги ── */}
          {plan && plan.strategy.theme && (
            <section className={s.strategy}>
              <div className={s.stratMain}>
                <span className={s.kicker}>7 хоногийн сэдэв</span>
                <h2>{plan.strategy.theme}</h2>
                {plan.strategy.goal && <p className={s.goal}><Icon name="target" size={16} />{plan.strategy.goal}</p>}
                {plan.strategy.summary && <p className={s.stratSum}>{plan.strategy.summary}</p>}
                {plan.note && <p className={s.ownerNote}><b>Таны тэмдэглэл</b>{plan.note}</p>}
              </div>
              <div className={s.stratMix}>
                <span className={s.kicker}>Контентын холимог</span>
                <div className={s.mixBar}>{mix.map(([n, c]) => <i key={n} style={{ flex: c, background: pillarColor(n, pillarNames) }} title={`${n}: ${c}`} />)}</div>
                <ul className={s.mixLegend}>{mix.map(([n, c]) => <li key={n}><i style={{ background: pillarColor(n, pillarNames) }} />{n}<b>{c}</b></li>)}</ul>
              </div>
              <div className={s.stratLearn}>
                <span className={s.kicker}>Өгөгдлөөс сурсан</span>
                <ol>{plan.strategy.learned.map((l) => <li key={l}>{l}</li>)}</ol>
                <div className={s.ctxChips}>
                  <span>7 хоногт {plan.context.posts7d} пост</span>
                  {plan.context.avg7d > 0 && <span>Дундаж оноо {plan.context.avg7d}</span>}
                  {plan.context.bestHour && <span>Шилдэг цаг {plan.context.bestHour}</span>}
                  {plan.context.external > 0 && <span>Өөр товлосон {plan.context.external}</span>}
                </div>
              </div>
            </section>
          )}

          {/* ── Явц ба бөөнөөр батлах ── */}
          {plan && slots.length > 0 && (
            <section className={s.progress}>
              <div className={s.progBar} aria-hidden>
                {[["pending", pending], ["draft", drafts.length], ["scheduled", count("scheduled", "publishing")], ["published", count("published")], ["failed", count("failed", "error")], ["skipped", count("skipped")]]
                  .filter(([, n]) => (n as number) > 0).map(([k, n]) => <i key={k as string} data-k={k as string} style={{ flex: n as number }} />)}
              </div>
              <div className={s.progRow}>
                <div className={s.progStats}>
                  <span data-k="draft"><b>{drafts.length}</b>батлах</span>
                  <span data-k="scheduled"><b>{count("scheduled", "publishing")}</b>товлогдсон</span>
                  <span data-k="published"><b>{count("published")}</b>нийтлэгдсэн</span>
                  {count("skipped") > 0 && <span data-k="skipped"><b>{count("skipped")}</b>алгассан</span>}
                  {count("failed", "error") > 0 && <span data-k="failed"><b>{count("failed", "error")}</b>алдаа</span>}
                  {plan.usd > 0 && <span data-k="usd"><b>${plan.usd.toFixed(2)}</b>зураг</span>}
                </div>
                <div className={s.progActs}>
                  {drafts.length > 0 && <button className={s.btn} onClick={() => setOpen(drafts[0].id)}>Нэг нэгээр шалгах <kbd>→</kbd></button>}
                  {readyDrafts.length > 0 && <button className={s.primary} disabled={!!busy || working} onClick={askApproveAll}><Icon name="check" size={16} />{readyDrafts.length} ноорог батлах</button>}
                </div>
              </div>
            </section>
          )}

          {/* ── Календарь ── */}
          {(plan || st.external.length > 0) && (
            <section className={s.cal}>
              {days.map((d) => (
                <div key={d.i} className={s.day} data-today={d.today} data-past={d.past}>
                  <header className={s.dayHead}>
                    <span>{WD_SHORT[d.i]}</span><b>{ub(d.date).d}</b>
                    {d.today && <em>Өнөөдөр</em>}
                  </header>
                  <div className={s.dayBody}>
                    {d.items.length === 0 && <span className={s.dayEmpty}>—</span>}
                    {d.items.map((it) => it.kind === "slot" ? (
                      <SlotCard key={it.slot.id} slot={it.slot} color={pillarColor(it.slot.pillar, pillarNames)} issue={issues.get(it.slot.id)} onOpen={() => setOpen(it.slot.id)} active={open === it.slot.id} />
                    ) : (
                      <a key={it.ext._id} className={s.ghost} href={it.ext.permalink || "/admin"} target={it.ext.permalink ? "_blank" : undefined} rel="noreferrer" title="Агентын бус пост — Content Studio-оос удирдана">
                        <div className={s.slotTop}><time>{hm(it.ext.at)}</time><Plats p={it.ext.platforms} /></div>
                        <span className={s.ghostTag}>{tagOf(it.ext.brief, it.ext.state)}</span>
                        <p>{firstLine(it.ext.text)}</p>
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )}
        </div>
      )}

      {tab === "settings" && (
        <AgentSettings key={b.key} state={st} accounts={acc} onSaved={async (m) => { say(m); await load(); }} onError={(m) => say(m, "err")}
          onDeleted={() => { setBrandKey(""); setTab("week"); say("Брэнд устгагдлаа"); }} />
      )}

      {tab === "history" && <History st={st} onPick={(w) => { setWeek(ymd(new Date(+new Date(w) + 12 * 3600e3))); setTab("week"); }} />}

      {cur && plan && (
        <SlotDrawer key={cur.id} plan={plan} slot={cur} brand={b} handles={handles} color={pillarColor(cur.pillar, pillarNames)}
          pos={navOrder.indexOf(cur.id)} total={navOrder.length}
          onNav={(dir) => { const i = navOrder.indexOf(cur.id); const n = navOrder[i + dir]; if (n) setOpen(n); }}
          onNextDraft={() => { const i = slots.findIndex((x) => x.id === cur.id); const n = [...slots.slice(i + 1), ...slots.slice(0, i)].find((x) => x.status === "draft" && x.id !== cur.id); setOpen(n ? n.id : null); }}
          onClose={() => setOpen(null)} act={slotAct} say={say} />
      )}

      {confirm && (
        <div className={s.modalBack} onClick={() => !busy && setConfirm(null)}>
          <div className={s.modal} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3>{confirm.title}</h3>
            <p>{confirm.body}</p>
            <div className={s.modalActs}>
              <button className={s.btn} onClick={() => setConfirm(null)} disabled={!!busy}>Болих</button>
              <button className={confirm.tone === "danger" ? s.danger : s.primary} disabled={!!busy} onClick={() => run("confirm", async () => { await confirm.run(); setConfirm(null); })}>
                {busy === "confirm" ? <><i className={s.spin} />Түр хүлээнэ үү…</> : confirm.label}
              </button>
            </div>
          </div>
        </div>
      )}

      {newBrand && (
        <div className={s.modalBack} onClick={() => !busy && setNewBrand(null)}>
          <form className={s.modal} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); addBrand(); }}>
            <h3>Шинэ брэнд</h3>
            <p>Агент энэ брэндийн нэрээр, түүний өөрийн сувгууд руу ажиллана. Брифээ бөглөж, сувгаа холбосны дараа идэвхжүүлнэ.</p>
            <label className={s.field}><span>Нэр</span><input autoFocus value={newBrand.name} onChange={(e) => setNewBrand({ ...newBrand, name: e.target.value, key: newBrand.key || "" })} placeholder="Hooji" /></label>
            <label className={s.field}><span>Түлхүүр (латин)</span><input value={newBrand.key} onChange={(e) => setNewBrand({ ...newBrand, key: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} placeholder={newBrand.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "hooji"} /></label>
            <div className={s.seg}>
              {(["product", "personal"] as const).map((k) => <button type="button" key={k} aria-pressed={newBrand.kind === k} onClick={() => setNewBrand({ ...newBrand, kind: k })}>{k === "product" ? "Бүтээгдэхүүн / бизнес" : "Хувь хүн"}</button>)}
            </div>
            <div className={s.modalActs}>
              <button type="button" className={s.btn} onClick={() => setNewBrand(null)}>Болих</button>
              <button type="submit" className={s.primary} disabled={!newBrand.name.trim() || busy === "brand"}>Нэмэх</button>
            </div>
          </form>
        </div>
      )}

      {toast && <div className={s.toast} data-tone={toast.tone} role="status">{toast.tone === "ok" ? <Icon name="check" size={16} /> : <Icon name="alert" size={16} />}{toast.msg}</div>}
    </div>
  );
}

function SlotCard({ slot, color, issue, onOpen, active }: { slot: Slot; color: string; issue?: { errors: number; warns: number }; onOpen: () => void; active: boolean }) {
  const pend = PENDING.has(slot.status);
  const img = slot.imageUrl;
  const imgBusy = slot.imageState === "queued" || slot.imageState === "working";
  const showIssue = slot.status === "draft" && issue && (issue.errors || issue.warns);
  return (
    <button className={s.slot} data-st={slot.status} data-active={active} style={{ "--pc": color } as CSSProperties} onClick={onOpen}>
      <div className={s.slotTop}><time>{hm(slot.at)}</time><Plats p={slot.platforms} /></div>
      {(img || imgBusy) && <div className={s.thumb}>{img ? <img src={img} alt="" loading="lazy" /> : <span className={s.shim}><Icon name="image" size={16} /></span>}</div>}
      {pend ? (
        <div className={s.slotWorking}><span /><span /><span /><em>{slot.status === "writing" ? "Бичиж байна…" : "Дараалалд"}</em></div>
      ) : (
        <p className={s.slotText}>{firstLine(slot.caption) || slot.hook || slot.title}</p>
      )}
      <div className={s.slotFoot}>
        <span className={s.pillTag}><i />{slot.pillar}</span>
        {slot.status === "published" && slot.metrics.syncedAt
          ? <span className={s.metrics}><Icon name="heart" size={12} />{slot.metrics.likes}<Icon name="chat" size={12} />{slot.metrics.comments}{slot.metrics.views > 0 && <><Icon name="eye" size={12} />{slot.metrics.views}</>}</span>
          : <StatusTag status={slot.status} />}
      </div>
      {showIssue ? <span className={s.issue} data-err={!!issue.errors} title={issue.errors ? "Батлахаас өмнө засах зүйл байна" : "Анхааруулга байна"}>{issue.errors ? "!" : issue.warns}</span> : null}
    </button>
  );
}

function History({ st, onPick }: { st: State; onPick: (weekStart: string) => void }) {
  const rows = st.history;
  const max = Math.max(1, ...rows.map((r) => r.score));
  if (!rows.length) return <section className={s.card}><div className={s.blank}><Icon name="chart" size={24} /><b>Түүх хоосон</b><p>Агентын анхны 7 хоногийн дараа батлалт, нийтлэл, үр дүн энд харагдана.</p></div></section>;
  return (
    <div className={s.stack}>
      <section className={s.card}>
        <div className={s.cardHead}><h2>7 хоног бүрийн үр дүн</h2><small>Оноо = like + 2×comment + 3×share (нийтлэгдсэн агентын постууд)</small></div>
        <div className={s.hBars}>
          {[...rows].reverse().map((r) => (
            <button key={r._id} onClick={() => onPick(r.weekStart)} title={`${r.label}: оноо ${r.score}`}>
              <i style={{ height: `${Math.max(4, (r.score / max) * 100)}%` }} />
              <span>{r.iso}</span>
            </button>
          ))}
        </div>
      </section>
      <section className={s.card}>
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead><tr><th>7 хоног</th><th>Сэдэв</th><th>Пост</th><th>Батлагдсан</th><th>Гараар зассан</th><th>Нийтлэгдсэн</th><th>Оноо</th><th /></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r._id} onClick={() => onPick(r.weekStart)}>
                  <td><b>{r.iso}-р</b><span>{r.label}</span></td>
                  <td className={s.tdTheme}>{r.theme || "—"}<span>{r.by === "cron" ? "Автомат" : "Гараар"}</span></td>
                  <td>{r.total}</td>
                  <td><span className={s.rate}><i style={{ width: `${r.total ? (r.approved / r.total) * 100 : 0}%` }} /></span>{r.approved}/{r.total}</td>
                  <td>{r.edited}</td>
                  <td>{r.published}</td>
                  <td><b>{r.score}</b></td>
                  <td><Icon name="chevron" size={16} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
