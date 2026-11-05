"use client";

import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { signOut } from "next-auth/react";
import Icon, { type IconName } from "@/components/Icon";
import { agentBase, api, asParam, mnt, type Ctx, type Me, type Seats, type State, type View } from "./types";
import Home from "./views/Home";
import Create from "./views/Create";
import Media from "./views/Media";
import ImageStudio from "./views/Image";
import Planner from "./views/Planner";
import Library from "./views/Library";
import Notebook from "./views/Notebook";
import Products from "./views/Products";
import Insights from "./views/Insights";
import Settings from "./views/Settings";
import Connect from "./views/Connect";
import Admin from "./views/Admin";
import Studio from "./views/Studio";
import Twin from "./views/Twin";
import Landing from "./views/Landing";
import Onboarding from "./views/Onboarding";
import Plans from "./views/Plans";
import s from "./agent.module.css";

/* ─── ANTAQOR AGENT — antaqor.com/content-agent ─────────────────────────────
   2026-10-26: хоёр горим.
   · Бизнес (99,000₮/сар, эзэн, хуучин туршилт) — өдөр тутмын цэс + «Нэмэлт».
   · Гишүүн (Antaqor-ийн төлбөртэй гишүүн) — зөвхөн AI зураг, AI ихэр; бүтээлээ
     community-д хуваалцана. Бизнесийн хуудас (холболт, студи…) огт харагдахгүй.
   Эрхгүй хэрэглэгч → багцын сонголт; зочин → танилцуулга.
   2026-11-01: studio.antaqor.com дээр "/" дээр амьдарна (agentBase) — antaqor.com руу
   холбоос, сайтын цэс байхгүй; утсан дээр доод цэс (4 таб + «Бусад»). */

type NavItem = { v: View; label: string; icon: IconName };
const PRIMARY: NavItem[] = [
  { v: "home", label: "Нүүр", icon: "home" },
  { v: "create", label: "Пост бүтээх", icon: "compose" },
  { v: "image", label: "AI зураг", icon: "image" },
  { v: "twin", label: "AI ихэр", icon: "profile" },
  { v: "planner", label: "Хуанли", icon: "calendar" },
  { v: "products", label: "Бүтээгдэхүүн", icon: "tag" },
  { v: "studio", label: "Студи", icon: "layout" },
  { v: "connect", label: "Хуудас холбох", icon: "link" },
  { v: "settings", label: "Тохиргоо", icon: "settings" },
];
const MORE: NavItem[] = [
  { v: "library", label: "Бүх пост", icon: "folder" },
  { v: "media", label: "AI видео", icon: "video" },
  { v: "notebook", label: "Тэмдэглэл", icon: "notebook" },
  { v: "insights", label: "Үр дүн", icon: "chart" },
  { v: "plans", label: "Багц · төлбөр", icon: "payment" },
];
/* Гишүүний цэс — AI зураг, AI видео (Kling 4.0, кредитээр), AI ихэр, бизнес багц */
const MEMBER_NAV: NavItem[] = [
  { v: "image", label: "AI зураг", icon: "image" },
  { v: "media", label: "AI видео", icon: "video" },
  { v: "twin", label: "AI ихэр", icon: "profile" },
  { v: "plans", label: "Бизнес багц", icon: "star" },
];
const ALL = [...PRIMARY, ...MORE, { v: "admin" as View, label: "Хэрэглэгчид", icon: "users" as IconName }];

/* Нэг дэлгэцийн алдаа бүх аппыг цагаан болгохгүй (2026-10-24: «Сан» ингэж унаж байсан) */
class Boundary extends Component<{ children: ReactNode; onReset: () => void }, { err: string }> {
  state = { err: "" };
  static getDerivedStateFromError(e: Error) { return { err: e.message || "Алдаа" }; }
  componentDidCatch(e: Error) { console.error("[agent] view crashed", e); }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className={s.page}><div className={s.empty}><b>Энэ хэсгийг харуулахад алдаа гарлаа</b><span>{this.state.err}</span>
        <button className={s.btn} onClick={() => { this.setState({ err: "" }); this.props.onReset(); }}>Нүүр рүү буцах</button></div></div>
    );
  }
}

type Boot = { kind: "loading" } | { kind: "guest"; seats: Seats } | { kind: "onboarding"; me: Me; seats: Seats } | { kind: "paywall"; me: Me } | { kind: "error"; msg: string };

/** Багцын сонголт — эрхгүй (гишүүнчлэлгүй, бизнесгүй) хэрэглэгчид */
function Paywall({ me, onPaid }: { me: Me; onPaid: () => void }) {
  const logout = () => { if (window.confirm("Гарах уу?")) signOut({ callbackUrl: `${window.location.origin}${agentBase()}` }); };
  return (
    <div className={s.app} style={{ display: "block" }}>
      <div className={s.land}>
        <header className={s.landTop}>
          <span className={s.orbSm}>A</span><b>Antaqor Agent</b><span style={{ flex: 1 }} />
          {agentBase() !== "/" && <a className={s.ghost} href="/">antaqor.com</a>}
          <button className={s.ghost} onClick={logout}>Гарах</button>
        </header>
        <section className={s.landHero}>
          <span className={s.landKicker}>Сайн байна уу{me.name ? `, ${me.name}` : ""}</span>
          <h1>Багцаа сонгоорой.</h1>
          <p>{me.plan === "expired" ? "Таны бизнес багцын хугацаа дууссан. Пост, тохиргоо тань хадгалагдсан — сунгамагц үргэлжилнэ." : "AI зураг, AI ихэр нь Antaqor гишүүнчлэлд багтсан. Бизнесийн сошиалаа AI-д хөтлүүлэх бол бизнес багц."}</p>
        </section>
        <Plans me={me} onPaid={onPaid} />
      </div>
    </div>
  );
}

export default function AgentApp() {
  const [st, setSt] = useState<State | null>(null);
  const [boot, setBoot] = useState<Boot>({ kind: "loading" });
  const [view, setView] = useState<View>("home");
  const [params, setParams] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ m: string; bad?: boolean } | null>(null);
  const [more, setMore] = useState(false);
  const [menu, setMenu] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [paying, setPaying] = useState(false);
  const hasSt = useRef(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const v = q.get("v") as View | null;
    if (v && ALL.some((n) => n.v === v)) { setView(v); if (MORE.some((n) => n.v === v)) setMore(true); }
    const p: Record<string, string> = {}; q.forEach((val, k) => { if (k !== "v" && k !== "as" && k !== "paid") p[k] = val; }); setParams(p);
    if (q.get("paid")) setPaying(true);
  }, []);
  const reload = useCallback(async () => {
    try {
      const q = asParam();
      const r = await fetch(`/api/content-agent${q ? `?${q}` : ""}`, { cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      if (r.status === 401) { setBoot({ kind: "guest", seats: d.seats || { used: 0, left: 100 } }); return; }
      if (!r.ok) throw new Error(d.error || `Алдаа (${r.status})`);
      if (d.paywall) { setBoot({ kind: "paywall", me: d.me }); return; }
      if (d.onboarding) { setBoot({ kind: "onboarding", me: d.me, seats: d.seats }); return; }
      hasSt.current = true; setSt(d as State); setBoot({ kind: "loading" });
    } catch (e) { if (!hasSt.current) setBoot({ kind: "error", msg: (e as Error).message }); }
  }, []);
  useEffect(() => { reload(); const t = setInterval(reload, 45000); return () => clearInterval(t); }, [reload]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4600); return () => clearTimeout(t); }, [toast]);
  /* QPay-ээс буцаж ирэхэд (?paid=1) — төлбөр баталгаажтал 3с тутам асууна (≤2 мин) */
  useEffect(() => {
    if (!paying) return;
    let n = 0, stop = false;
    const tick = async () => {
      if (stop) return;
      const d = await fetch("/api/content-agent/billing", { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
      if (d.status === "paid" || ++n > 40) {
        stop = true; setPaying(false);
        const u = new URL(window.location.href); u.searchParams.delete("paid"); window.history.replaceState(null, "", u.toString());
        setToast(d.status === "paid" ? { m: "Бизнес багц идэвхжлээ 🎉" } : { m: "Төлбөр хараахан баталгаажаагүй — хэдэн минутын дараа дахин шалгана уу", bad: true });
        hasSt.current = false; setSt(null); await reload();
        return;
      }
      setTimeout(tick, 3000);
    };
    tick();
    return () => { stop = true; };
  }, [paying, reload]);
  /* Higgsfield медиа бүтээгдэж байвал 7с тутам шалгана (cron 5 мин-ээс хурдан) */
  const rendering = !!st && (st.media.some((m) => m.status === "running") || st.posts.some((p) => p.mediaState === "rendering"));
  useEffect(() => {
    if (!rendering) return;
    const t = setInterval(() => { api({ action: "media-poll" }).then(reload).catch(() => {}); }, 7000);
    return () => clearInterval(t);
  }, [rendering, reload]);
  const go = useCallback((v: View, p: Record<string, string> = {}) => {
    setView(v); setParams(p);
    const q = new URLSearchParams({ v, ...p });
    const as = new URLSearchParams(window.location.search).get("as");
    if (as) q.set("as", as);
    window.history.replaceState(null, "", `${agentBase()}?${q}`);
    window.scrollTo({ top: 0 });
  }, []);
  const say = useCallback((m: string, bad = false) => setToast({ m, bad }), []);
  const paidReload = useCallback(() => { setToast({ m: "Бизнес багц идэвхжлээ 🎉" }); hasSt.current = false; setSt(null); reload(); }, [reload]);

  if (paying) return (
    <div className={s.app} style={{ display: "block" }}>
      <div className={s.gate}><i className={s.spinB} /><h2>Төлбөр шалгаж байна…</h2><p className={s.muted}>QPay-ийн гүйлгээ баталгаажмагц бизнес багц автоматаар нээгдэнэ.</p></div>
    </div>
  );
  if (boot.kind === "guest") return <Landing seats={boot.seats} />;
  if (boot.kind === "paywall") return <Paywall me={boot.me} onPaid={paidReload} />;
  if (boot.kind === "onboarding") return <Onboarding me={boot.me} seats={boot.seats} onDone={async () => { await reload(); go("connect", { step: "2" }); }} />;
  if (!st) return (
    <div className={s.app} style={{ display: "block" }}>
      <div className={s.gate}>{boot.kind === "error" ? <><p style={{ color: "#C81E4A" }}>{boot.msg}</p><button className={s.btn} onClick={reload}>Дахин оролдох</button></> : <><span className={s.orb}>A</span><p className={s.muted}>Ачаалж байна…</p></>}</div>
    </div>
  );

  const member = st.me.mode === "member";
  const owner = st.me.ws === "main";
  /* гишүүнд зөвшөөрөгдөөгүй дэлгэц (хуучин холбоос, ?v=studio гэх мэт) → AI зураг */
  const shown: View = member && !MEMBER_NAV.some((n) => n.v === view) ? "image" : view;
  const ctx: Ctx = { st, reload, say, go, params };
  const held = st.posts.filter((p) => p.status === "held").length;
  const brand = owner ? "Antaqor Agent" : member ? "Antaqor Studio" : st.me.business?.name || "Миний бизнес";
  const connected = st.accounts.meta.length + st.accounts.threads.length;
  const who = st.me.name || st.me.email?.split("@")[0] || "Хэрэглэгч";
  const onStudio = agentBase() === "/";
  const toAdmin = !onStudio && (st.me.superAdmin || st.me.plan === "owner");
  const logout = () => { if (window.confirm("Antaqor Agent-аас гарах уу?")) signOut({ callbackUrl: `${window.location.origin}${agentBase()}` }); };
  const toggleAuto = async () => {
    if (!st.cfg.auto && !connected) { say("Эхлээд хуудсаа холбоно уу", true); go("connect"); return; }
    try { await api({ action: "config", config: { auto: !st.cfg.auto } }); say(!st.cfg.auto ? "Автомат асаалаа — агент өөрөө нийтэлнэ" : "Автомат зогслоо — пост ноорог болж үлдэнэ"); await reload(); }
    catch (e) { say((e as Error).message, true); }
  };
  const Page = { home: Home, create: Create, image: ImageStudio, media: Media, planner: Planner, library: Library, notebook: Notebook, products: Products, insights: Insights, settings: Settings, connect: Connect, admin: Admin, studio: Studio, twin: Twin, plans: PlansPage }[shown];
  const navList: NavItem[] = member ? MEMBER_NAV : [...PRIMARY, ...MORE, ...(st.me.superAdmin ? [{ v: "admin" as View, label: "Хэрэглэгчид", icon: "users" as IconName }] : [])];
  const navBtn = (n: NavItem) => (
    <button key={n.v} className={s.navItem} aria-current={shown === n.v ? "page" : undefined} onClick={() => go(n.v)}>
      <Icon name={n.icon} size={20} />{n.label}
      {n.v === "library" && held > 0 && <span className={s.navBadge}>{held}</span>}
      {n.v === "connect" && !connected && <span className={s.navBadge}>!</span>}
    </button>
  );
  /* Кредит (гишүүн): үлдэгдэл бага бол сануулна — 1 кр = 1₮ */
  const cr = st.me.credit;
  /* 2026-11-02: студи кредитгүй болсон — үлдэгдэл, цэнэглэх холбоос бүгд хасагдав. */
  void cr; const low = false;
  const renew = st.me.plan === "trial" || st.me.plan === "expired" || (st.me.plan === "active" && st.me.daysLeft > 0 && st.me.daysLeft <= 5);

  return (
    <div className={s.app}>
      <aside className={s.side}>
        <div className={s.brand}>
          {!member && st.me.business?.logoUrl ? <img className={s.logo} src={st.me.business.logoUrl} alt="" /> : <span className={s.orb}>{brand.slice(0, 1).toUpperCase()}</span>}
          <div className={s.brandName}><b>{brand}</b><span>{owner ? "Workspace · Antaqor" : member ? "Гишүүн · AI зураг, ихэр" : st.me.plan === "active" ? "Бизнес багц" : "Antaqor Agent"}</span></div>
        </div>
        <nav className={s.nav}>
          {member ? MEMBER_NAV.map(navBtn) : <>
            {PRIMARY.map(navBtn)}
            <button className={s.navMore} onClick={() => setMore(!more)} aria-expanded={more}><Icon name={more ? "chevronUp" : "chevronDown"} size={16} />Нэмэлт</button>
            {more && MORE.map(navBtn)}
          </>}
          {st.me.superAdmin && <><div className={s.navSep} />{navBtn({ v: "admin", label: "Хэрэглэгчид", icon: "users" })}</>}
        </nav>
        <div className={s.sideFoot}>
          {member ? null : (<>
            <button className={s.autoPill} data-on={st.cfg.auto} onClick={toggleAuto}>
              <i /><div><b>{st.cfg.auto ? "Автомат асаалттай" : "Автомат унтраалттай"}</b><span>{st.cfg.auto ? "Агент өөрөө нийтэлнэ" : "Та батлаад нийтэлнэ"}</span></div>
            </button>
          </>)}
          <div className={s.acct}>
            <span className={s.acctAv}>{who.slice(0, 1).toUpperCase()}</span>
            <div className={s.acctTx}><b>{who}</b><span>{st.me.email || brand}</span></div>
            {!onStudio && <a className={s.acctBtn} data-k="home" href={toAdmin ? "/admin" : "/"} title={toAdmin ? "Админ руу" : "antaqor.com"}><Icon name="home" size={16} /></a>}
            <button className={s.acctBtn} onClick={logout} title="Гарах" aria-label="Гарах"><Icon name="logout" size={16} /></button>
          </div>
        </div>
      </aside>

      <div className={s.mtop}>
        <div className={s.mtopRow}><span className={s.orbSm}>{brand.slice(0, 1).toUpperCase()}</span><b style={{ flex: 1 }}>{brand}</b>
          {member ? null : <button className={s.chip} aria-pressed={st.cfg.auto} onClick={toggleAuto}>{st.cfg.auto ? "● Автомат" : "○ Гараар"}</button>}
          <button className={s.mIcBtn} onClick={() => setMenu(!menu)} aria-expanded={menu} aria-label="Бүртгэл"><Icon name="profile" size={20} /></button>
        </div>
        {menu && (
          <div className={s.mmenu} onClick={() => setMenu(false)}>
            <div className={s.mmenuHead}><b>{who}</b><span>{st.me.email || brand}</span></div>
            {!member && <button onClick={() => go("settings")}><Icon name="settings" size={20} />Тохиргоо</button>}
            <button onClick={() => go("plans")}><Icon name="payment" size={20} />{member ? "Бизнес багц" : "Багц · төлбөр"}</button>
            {onStudio ? null : toAdmin ? <a href="/admin"><Icon name="grid" size={20} />Админ руу</a> : <a href="/"><Icon name="home" size={20} />antaqor.com</a>}
            <button data-k="out" onClick={logout}><Icon name="logout" size={20} />Гарах</button>
          </div>
        )}
      </div>

      {/* Утасны доод цэс — зөвхөн студийн дэлгэцүүд. 5-аас олон бол эхний 4 + «Бусад» */}
      <nav className={s.mbar} aria-label="Studio">
        {(navList.length <= 5 ? navList : navList.slice(0, 4)).map((n) => (
          <button key={n.v} aria-current={shown === n.v ? "page" : undefined} onClick={() => { setSheet(false); go(n.v); }}><Icon name={n.icon} size={24} /><span>{n.label}</span></button>
        ))}
        {navList.length > 5 && <button aria-expanded={sheet} aria-current={navList.slice(4).some((n) => n.v === shown) ? "page" : undefined} onClick={() => setSheet(!sheet)}><Icon name="grid" size={24} /><span>Бусад</span></button>}
      </nav>
      {sheet && (
        <div className={s.msheetWrap} onClick={() => setSheet(false)}>
          <div className={s.msheet} onClick={(e) => e.stopPropagation()}>
            {navList.slice(4).map((n) => <button key={n.v} aria-current={shown === n.v ? "page" : undefined} onClick={() => { setSheet(false); go(n.v); }}><Icon name={n.icon} size={20} />{n.label}</button>)}
          </div>
        </div>
      )}

      <main className={s.main}>
        {st.me.viewingAs && <div className={s.trialBar} data-k="as">Та «{brand}»-ийн workspace-ийг дэмжлэгийн горимоор үзэж байна. <a href={`${agentBase()}?v=admin`}>Буцах</a></div>}
        {!member && renew && (
          <div className={s.trialBar} data-k={st.me.plan === "expired" ? "bad" : undefined}>
            {st.me.plan === "trial" ? <>Туршилт · <b>{st.me.daysLeft} хоног</b> үлдлээ{st.me.gensLeft !== null ? ` · өнөөдөр ${st.me.gensLeft} бүтээлт` : ""}. </>
              : st.me.plan === "expired" ? <>Бизнес багцын хугацаа дууссан — пост, тохиргоо тань хадгалагдсан. </>
              : <>Бизнес багц <b>{st.me.daysLeft} хоногийн</b> дараа дуусна. </>}
            <button className={s.barBtn} onClick={() => go("plans")}>{st.me.plan === "trial" ? `Үргэлжлүүлэх · ${mnt(st.me.price)}/сар` : `Сунгах · ${mnt(st.me.price)}`}</button>
          </div>
        )}
        {member && st.me.plan === "expired" && <div className={s.trialBar} data-k="bad">Бизнес багцын хугацаа дууссан — одоо гишүүний горимоор (AI зураг, ихэр). <button className={s.barBtn} onClick={() => go("plans")}>Сунгах · {mnt(st.me.price)}</button></div>}
        <Boundary onReset={() => go(member ? "image" : "home")} key={shown}>
          <Page {...ctx} key={shown + JSON.stringify(params)} />
        </Boundary>
      </main>
      {toast && (
        <div className={s.toast} data-bad={!!toast.bad}>
          {toast.m}
        </div>
      )}
    </div>
  );
}

/** Апп доторх «Багц · төлбөр» хуудас */
function PlansPage(ctx: Ctx) {
  const { st, go, reload, say } = ctx;
  return (
    <div className={s.page}>
      <div className={s.pageHead}><div><h1>{st.me.mode === "member" ? "Бизнес багц" : "Багц · төлбөр"}</h1><p>{st.me.mode === "member" ? "Бизнесийнхээ сошиалыг AI-д хөтлүүлэх бол — нэг сарын төлбөр, QPay-ээр шууд нээгдэнэ." : "Таны одоогийн багц ба сунгалт."}</p></div></div>
      <Plans me={st.me} onOpen={() => go("image")} onPaid={() => { say("Бизнес багц идэвхжлээ 🎉"); reload(); }} />
    </div>
  );
}
