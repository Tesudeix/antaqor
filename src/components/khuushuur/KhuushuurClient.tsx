"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Oswald } from "next/font/google";
import KhArt from "./KhArt";
import s from "./khuushuur.module.css";

/* ─── ТАЛ ХУУШУУР — /khuushuur (2026-10-17) ──────────────────────────────
   KFC-ийн хүргэлтийн меню маягийн landscape байршил: дээд мөрөнд
   очиж авах / хүргэлт + хаяг + сагс, зүүн талд наалддаг ангиллын цэс,
   баруун талд бараан тор. Сагс → нэр/утас/хаяг → QPay (Wire).
   Цэс бүхэлдээ /admin/khuushuur-ээс засагдана. */

const display = Oswald({ subsets: ["latin", "cyrillic"], weight: ["500", "700"], display: "swap" });

type Item = {
  _id: string; slug: string; category: string; name: string; kcal: string; description: string;
  price: number; image: string; art: string; tag: string; soldOut: boolean;
};
type Cat = { id: string; name: string };
type Mode = "delivery" | "pickup";

const CART = "kh_cart";
const INFO = "kh_info";
const mnt = (n: number) => n.toLocaleString("en-US") + "₮";
const load = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d; } catch { return d; } };
const save = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const BRANCH = "Сансар, 32-ын тойрог";

export default function KhuushuurClient() {
  const [cats, setCats] = useState<Cat[]>([]);
  const [items, setItems] = useState<Item[] | null>(null);
  const [fee, setFee] = useState({ fee: 3000, freeOver: 25000 });
  const [cart, setCart] = useState<Record<string, number>>({});
  const [mode, setMode] = useState<Mode>("delivery");
  const [info, setInfo] = useState({ name: "", phone: "", address: "", note: "" });
  const [drawer, setDrawer] = useState(false);
  const [step, setStep] = useState<"cart" | "form">("cart");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [toast, setToast] = useState("");
  const [active, setActive] = useState("");
  const [order, setOrder] = useState<{ no: string; status: string; total?: number } | null>(null);
  const toastT = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setCart(load(CART, {}));
    const i = load(INFO, { name: "", phone: "", address: "", note: "", mode: "delivery" as Mode });
    setInfo({ name: i.name || "", phone: i.phone || "", address: i.address || "", note: "" });
    setMode(i.mode === "pickup" ? "pickup" : "delivery");
    fetch("/api/khuushuur/items").then((r) => r.json()).then((d) => {
      setCats(d.categories || []); setItems(d.items || []); if (d.delivery) setFee(d.delivery);
    }).catch(() => setItems([]));
  }, []);
  useEffect(() => { save(CART, cart); }, [cart]);
  useEffect(() => { save(INFO, { name: info.name, phone: info.phone, address: info.address, mode }); }, [info.name, info.phone, info.address, mode]);

  /* сайтын ерөнхий hazard зураас, бараан дэвсгэр энд хамаагүй — өөрийн цагаан хүрээтэй */
  useEffect(() => {
    const st = document.createElement("style");
    st.textContent = "body::before,body::after{display:none!important}html,body{background:#ffffff!important;color-scheme:light}";
    document.head.appendChild(st);
    return () => st.remove();
  }, []);

  /* QPay-ээс буцаж ирэх: ?order=KH-… */
  useEffect(() => {
    const no = new URLSearchParams(location.search).get("order");
    if (!no) return;
    let n = 0, stop = false;
    setOrder({ no, status: "checking" });
    const poll = async () => {
      if (stop) return;
      const r = await fetch(`/api/khuushuur/orders/${no}`).then((x) => x.json()).catch(() => null);
      if (r?.status && !["pending", "cancelled"].includes(r.status)) { setOrder({ no, status: "paid", total: r.total }); setCart({}); return; }
      if (r?.status === "cancelled") { setOrder({ no, status: "cancelled" }); return; }
      if (++n < 40) setTimeout(poll, 3000); else setOrder({ no, status: "pending", total: r?.total });
    };
    void poll();
    return () => { stop = true; };
  }, []);

  const groups = useMemo(
    () => cats.map((c) => ({ ...c, list: (items || []).filter((i) => i.category === c.id) })).filter((g) => g.list.length),
    [cats, items]
  );
  useEffect(() => { if (groups[0] && !active) setActive(groups[0].id); }, [groups, active]);

  /* зүүн цэс — гүйлгэх үед идэвхтэй ангиллыг тодруулна */
  useEffect(() => {
    if (!groups.length || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) setActive(e.target.id.replace(/^c-/, "")); }), { rootMargin: "-30% 0px -60% 0px" });
    groups.forEach((g) => { const el = document.getElementById(`c-${g.id}`); if (el) io.observe(el); });
    return () => io.disconnect();
  }, [groups]);

  const bySlug = useMemo(() => new Map((items || []).map((i) => [i.slug, i])), [items]);
  const lines = Object.entries(cart).map(([slug, qty]) => ({ slug, qty, it: bySlug.get(slug) })).filter((l) => l.it && l.qty > 0) as { slug: string; qty: number; it: Item }[];
  const count = lines.reduce((a, l) => a + l.qty, 0);
  const subtotal = lines.reduce((a, l) => a + l.qty * l.it.price, 0);
  const delivery = mode === "pickup" || subtotal === 0 || subtotal >= fee.freeOver ? 0 : fee.fee;
  const total = subtotal + delivery;

  const say = (t: string) => { setToast(t); if (toastT.current) clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(""), 1800); };
  const add = useCallback((it: Item) => {
    if (it.soldOut) return;
    setCart((c) => ({ ...c, [it.slug]: Math.min(50, (c[it.slug] || 0) + 1) }));
    say(`${it.name} нэмэгдлээ`);
  }, []);
  const bump = (slug: string, d: number) => setCart((c) => { const n = { ...c }; n[slug] = (n[slug] || 0) + d; if (n[slug] <= 0) delete n[slug]; return n; });

  const openCart = () => { setStep("cart"); setErr(""); setDrawer(true); };
  useEffect(() => {
    document.documentElement.style.overflow = drawer ? "hidden" : "";
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setDrawer(false); };
    window.addEventListener("keydown", k);
    return () => { document.documentElement.style.overflow = ""; window.removeEventListener("keydown", k); };
  }, [drawer]);

  async function pay() {
    setErr("");
    if (info.name.trim().length < 2) return setErr("Нэрээ бичнэ үү");
    if (info.phone.replace(/\D/g, "").length < 8) return setErr("Утасны дугаараа (8 орон) бичнэ үү");
    if (mode === "delivery" && info.address.trim().length < 6) return setErr("Хүргэлтийн хаягаа бүрэн бичнэ үү");
    setBusy(true);
    const r = await fetch("/api/khuushuur/orders", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, items: lines.map((l) => ({ slug: l.slug, qty: l.qty })), customer: { ...info, address: mode === "pickup" ? `Очиж авах: ${BRANCH}` : info.address } }),
    }).then(async (x) => ({ ok: x.ok, j: await x.json().catch(() => ({})) })).catch(() => ({ ok: false, j: { error: "Сүлжээний алдаа. Дахин оролдоно уу." } }));
    if (r.j.url) { location.href = r.j.url; return; }
    setBusy(false);
    setErr(r.j.error || "Захиалга үүсгэж чадсангүй");
  }

  return (
    <div className={s.root} style={{ ["--kh-display" as string]: display.style.fontFamily }}>
      <header className={s.bar}>
        <div className={s.barIn}>
          <Link href="/khuushuur" className={s.brand}>
            <svg width="40" height="28" viewBox="0 0 120 84" aria-hidden="true"><path d="M8 74 A52 52 0 0 1 112 74 Z" fill="#c8261b" /><path d="M8 74 H112" stroke="#17120e" strokeWidth="6" /></svg>
            <span>Тал Хуушуур<small>ГАЛТАЙ ТОГООНООС</small></span>
          </Link>
          <div className={s.mode} role="group" aria-label="Захиалгын төрөл">
            <button aria-pressed={mode === "pickup"} onClick={() => setMode("pickup")}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 9l2-5h14l2 5v2a3 3 0 0 1-2 2.8V21H5v-7.2A3 3 0 0 1 3 11V9zm6 12v-5h6v5" /></svg>Очиж авах
            </button>
            <button aria-pressed={mode === "delivery"} onClick={() => setMode("delivery")}>
              <svg width="24" height="22" viewBox="0 0 26 24" fill="currentColor" aria-hidden="true"><path d="M2 15l2-6c.4-1 1.3-2 2.6-2h10c1 0 1.9.5 2.5 1.3L22 12h1.5a1.5 1.5 0 0 1 1.5 1.5V17h-2.2a3 3 0 0 0-5.6 0H9.8a3 3 0 0 0-5.6 0H2v-2zm5-1h5V9H7.5zm7 0h6l-2.4-4c-.2-.3-.6-.5-1-.5H14z" /><circle cx="7" cy="18" r="2" /><circle cx="20" cy="18" r="2" /></svg>Хүргэлтээр
            </button>
          </div>
          <div className={s.addr}>
            {mode === "delivery" ? (
              <input id="kh-addr" value={info.address} onChange={(e) => setInfo({ ...info, address: e.target.value })} placeholder="Хаяг — дүүрэг, хороо, байр, тоот" aria-label="Хүргэлтийн хаяг" />
            ) : (
              <div className={s.branch}>Салбар: <b>{BRANCH}</b> · 10:00–23:00</div>
            )}
          </div>
          <button className={s.cartBtn} onClick={openCart} aria-label={`Сагс, ${count} бараа`}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M3 4h2l2.4 11h11L21 7H6.2" /><circle cx="9" cy="20" r="1.6" fill="currentColor" /><circle cx="18" cy="20" r="1.6" fill="currentColor" /></svg>
            <span className={s.badge}>{count}</span><b>{mnt(total)}</b>
          </button>
        </div>
      </header>

      {order && (
        <div className={`${s.notice} ${order.status === "paid" ? s.ok : ""}`} role="status">
          <div>
            {order.status === "checking" && <>Төлбөрийг шалгаж байна… <b>{order.no}</b></>}
            {order.status === "paid" && <>Захиалга <b>{order.no}</b> баталгаажлаа{order.total ? ` · ${mnt(order.total)}` : ""}. Тогоонд орлоо — 35 минутад хүргэнэ.</>}
            {order.status === "pending" && <>Захиалга <b>{order.no}</b> төлөгдөөгүй байна. QPay-ээ дахин нээх бол доорх товчийг дарна уу.</>}
            {order.status === "cancelled" && <>Захиалга <b>{order.no}</b> цуцлагдсан.</>}
          </div>
          {order.status === "pending" && (
            <button onClick={async () => { const r = await fetch(`/api/khuushuur/orders/${order.no}`, { method: "POST" }).then((x) => x.json()).catch(() => ({})); if (r.url) location.href = r.url; else if (r.paid) setOrder({ ...order, status: "paid" }); }}>QPay нээх</button>
          )}
          <button className={s.noticeX} aria-label="Хаах" onClick={() => { setOrder(null); history.replaceState(null, "", "/khuushuur"); }}>×</button>
        </div>
      )}

      <div className={s.wrap}>
        <nav className={s.rail} aria-label="Цэсний ангилал">
          {groups.map((g) => (
            <a key={g.id} href={`#c-${g.id}`} className={active === g.id ? s.on : ""}>{g.name}</a>
          ))}
          <div className={s.hours}><strong>Өдөр бүр 10:00–23:00</strong>Хүргэлт: УБ хотын 6 дүүрэг<br />{mnt(fee.freeOver)}-өөс дээш хүргэлт үнэгүй</div>
        </nav>

        <main className={s.main}>
          <div className={s.hero}>
            <div>
              <h1>Шарсан даруйд нь <em>халуунаар</em> хүргэнэ</h1>
              <p>Гараар элдсэн гурил, шинэ татсан мах, хонины өөх. Тогооноос таны үүд хүртэл 35 минут.</p>
              <div className={s.facts}>
                <div><b>35 мин</b>Дундаж хүргэлт</div>
                <div><b>150 гр</b>Нэг хуушуур</div>
                <div><b>{mnt(fee.freeOver)}+</b>Хүргэлт үнэгүй</div>
              </div>
            </div>
            <KhArt art="stack" className={s.heroArt} />
          </div>

          {items === null && <div className={s.grid}>{Array.from({ length: 6 }).map((_, i) => <div key={i} className={`${s.card} ${s.skel}`} />)}</div>}
          {items && !groups.length && <p className={s.empty}>Цэс удахгүй нээгдэнэ.</p>}

          {groups.map((g) => (
            <section key={g.id} id={`c-${g.id}`} className={s.section}>
              <h2>{g.name}</h2>
              <div className={s.grid}>
                {g.list.map((it) => (
                  <article key={it._id} className={`${s.card} ${it.soldOut ? s.out : ""}`}>
                    {(it.soldOut || it.tag) && <span className={s.tag}>{it.soldOut ? "Дууссан" : it.tag}</span>}
                    <div className={s.art}>
                      {it.image ? <img src={it.image} alt={it.name} loading="lazy" /> : <KhArt art={it.art} />}
                    </div>
                    <h3>{it.name}</h3>
                    {it.kcal && <div className={s.kcal}>{it.kcal}</div>}
                    {it.description && <p className={s.desc}>{it.description}</p>}
                    <div className={s.price}>{mnt(it.price)}</div>
                    <button className={s.add} disabled={it.soldOut} onClick={() => add(it)}>{it.soldOut ? "Өнөөдөр дууссан" : "Сагсанд хийх"}</button>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </main>
      </div>

      {drawer && <div className={s.scrim} onClick={() => setDrawer(false)} />}
      <aside className={`${s.drawer} ${drawer ? s.open : ""}`} aria-label="Сагс" aria-hidden={!drawer}>
        <header>
          <h2>{step === "cart" ? "Таны сагс" : "Захиалга"}</h2>
          <button className={s.x} onClick={() => setDrawer(false)} aria-label="Хаах">×</button>
        </header>

        {step === "cart" ? (
          <div className={s.lines}>
            {lines.length ? lines.map((l) => (
              <div key={l.slug} className={s.line}>
                {l.it.image ? <img src={l.it.image} alt="" /> : <KhArt art={l.it.art} />}
                <div><div className={s.ln}>{l.it.name}</div><div className={s.lp}>{mnt(l.it.price)} × {l.qty}</div></div>
                <div className={s.qty}>
                  <button onClick={() => bump(l.slug, -1)} aria-label="Хасах">−</button><span>{l.qty}</span><button onClick={() => bump(l.slug, 1)} aria-label="Нэмэх">+</button>
                </div>
              </div>
            )) : <p className={s.emptyCart}>Сагс хоосон байна.<br />Цэснээс хуушуураа сонгоно уу.</p>}
          </div>
        ) : (
          <div className={s.form}>
            <div className={s.modeMini}>
              <button aria-pressed={mode === "delivery"} onClick={() => setMode("delivery")}>Хүргэлтээр</button>
              <button aria-pressed={mode === "pickup"} onClick={() => setMode("pickup")}>Очиж авах</button>
            </div>
            <label htmlFor="kh-name">Нэр</label>
            <input id="kh-name" value={info.name} onChange={(e) => setInfo({ ...info, name: e.target.value })} autoComplete="name" />
            <label htmlFor="kh-phone">Утас</label>
            <input id="kh-phone" inputMode="tel" value={info.phone} onChange={(e) => setInfo({ ...info, phone: e.target.value })} autoComplete="tel" placeholder="9911 2233" />
            {mode === "delivery" ? (<>
              <label htmlFor="kh-addr2">Хүргэлтийн хаяг</label>
              <textarea id="kh-addr2" rows={2} value={info.address} onChange={(e) => setInfo({ ...info, address: e.target.value })} placeholder="Дүүрэг, хороо, байр, орц, давхар, тоот" />
            </>) : <p className={s.branchNote}>Салбар: <b>{BRANCH}</b>. Бэлэн болмогц утсаар мэдэгдэнэ.</p>}
            <label htmlFor="kh-note">Нэмэлт тайлбар</label>
            <input id="kh-note" value={info.note} onChange={(e) => setInfo({ ...info, note: e.target.value })} placeholder="Ж: сонгино багатай, орцны код 1234" />
          </div>
        )}

        <div className={s.sum}>
          <span>Дүн</span><span>{mnt(subtotal)}</span>
          <span>{mode === "pickup" ? "Очиж авах" : "Хүргэлт"}</span><span>{delivery ? mnt(delivery) : "Үнэгүй"}</span>
          <span className={s.t}>Нийт</span><span className={s.t}>{mnt(total)}</span>
        </div>
        {mode === "delivery" && subtotal > 0 && subtotal < fee.freeOver && <p className={s.note}>Дахиад {mnt(fee.freeOver - subtotal)} нэмбэл хүргэлт үнэгүй.</p>}
        {err && <p className={s.err} role="alert">{err}</p>}
        {step === "cart" ? (
          <button className={s.checkout} disabled={!count} onClick={() => { setErr(""); setStep("form"); }}>Үргэлжлүүлэх</button>
        ) : (
          <div className={s.actions}>
            <button className={s.back} onClick={() => setStep("cart")}>← Сагс</button>
            <button className={s.checkout} disabled={!count || busy} onClick={() => void pay()}>{busy ? "QPay нээж байна…" : `QPay-ээр төлөх · ${mnt(total)}`}</button>
          </div>
        )}
      </aside>

      {toast && <div className={s.toast} role="status">{toast}</div>}
    </div>
  );
}
