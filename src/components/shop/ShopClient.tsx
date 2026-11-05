"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import s from "./shop.module.css";

/* ─── ANTAQOR SUPPLY — /shop (2026-10-16) ────────────────────────────────
   Хэрэглэгчийн аялал: 3D hero (харах → эргүүлэх → өнгө сонгох) →
   WHITE цуглуулга → BLACK цуглуулга → бараа (sheet) → сагс → QPay.
   Минимал цагаан/хар, хөдөлгөөн = blur→тод, дээш хөвөх, дараалсан. */

const Product3D = dynamic(() => import("./Product3D"), { ssr: false });

type Size = { label: string; stock: number };
type Color = { name: string; hex: string };
type P = {
  _id: string; name: string; slug: string; kind: string; tagline: string; description: string;
  price: number; compareAtPrice: number; images: string[]; model3d: string;
  colors: Color[]; sizes: Size[]; tone: "light" | "dark"; featured: boolean; soldOut: boolean;
};
type Line = { slug: string; size: string; color: string; qty: number };

const CART = "aq_shop_cart";
const ADDR = "aq_shop_addr";
const mnt = (n: number) => n.toLocaleString("en-US") + "₮";
const load = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d; } catch { return d; } };
const save = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };

/* зураггүй бараанд — kind-аар минимал дүрс */
function Silhouette({ kind, hex }: { kind: string; hex: string }) {
  const d =
    kind === "cap" ? "M30 70c0-24 18-40 40-40s40 16 40 40H30zm-8 4h96c4 0 4 6 0 8-14 6-34 8-48 8s-34-2-48-8c-4-2-4-8 0-8z"
    : kind === "tee" ? "M52 22l-26 12-16 26 18 10 10-12v62h64V58l10 12 18-10-16-26-26-12c-2 9-10 15-18 15s-16-6-18-15z"
    : "M54 20c4-6 10-9 16-9s12 3 16 9l24 12 16 46-16 6-10-24v76H40V60L30 84l-16-6 16-46 24-12zm-2 10c4 12 10 18 18 18s14-6 18-18";
  return (
    <svg viewBox="0 0 140 140" className={s.sil} aria-hidden="true">
      <path d={d} fill={hex} stroke="rgba(127,127,127,.35)" strokeWidth="1" />
    </svg>
  );
}

/* зураггүй бараа — hero-той ижил 3D загварыг нэг удаа PNG болгон зурна */
function Thumb({ kind, hex, dark }: { kind: string; hex: string; dark?: boolean }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let on = true;
    import("./Product3D").then((m) => m.renderThumb(kind, hex, dark)).then((u) => { if (on) setUrl(u); }).catch(() => {});
    return () => { on = false; };
  }, [kind, hex, dark]);
  return url ? <img src={url} alt="" className={s.thumb3d} /> : <Silhouette kind={kind} hex={hex} />;
}

/* scroll дээр blur→тод, дараалан */
function useReveal(dep: unknown) {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-rv]:not(.rv-on)"));
    if (!("IntersectionObserver" in window)) { els.forEach((e) => e.classList.add("rv-on")); return; }
    const io = new IntersectionObserver((es) => {
      const hit = es.filter((e) => e.isIntersecting).map((e) => e.target as HTMLElement)
        .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top || a.getBoundingClientRect().left - b.getBoundingClientRect().left);
      /* нэг мөрөнд (ижил top) байгаа картууд зүүнээс баруун тийш дараалж гарна, мөр бүр шинээр тоолно */
      let rowTop = -1e9, col = 0;
      hit.forEach((el) => { io.unobserve(el); const t = Math.round(el.getBoundingClientRect().top); if (Math.abs(t - rowTop) > 8) { rowTop = t; col = 0; } el.style.transitionDelay = `${Math.min(col++, 6) * 80}ms`; el.classList.add("rv-on"); });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [dep]);
}

export default function ShopClient() {
  const [items, setItems] = useState<P[] | null>(null);
  const [cart, setCart] = useState<Line[]>([]);
  const [open, setOpen] = useState<P | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [heroColor, setHeroColor] = useState<string>("");
  const [ready3d, setReady3d] = useState(false);
  const [toast, setToast] = useState("");
  const [order, setOrder] = useState<{ no: string; status: string; total?: number } | null>(null);

  useEffect(() => {
    setCart(load<Line[]>(CART, []));
    fetch("/api/shop/products").then((r) => r.json()).then((d) => setItems(d.products || [])).catch(() => setItems([]));
  }, []);
  useEffect(() => { save(CART, cart); }, [cart]);
  /* сайтын ерөнхий hazard зураас (body::before) энд хамаагүй — дэлгүүр өөрийн хүрээтэй */
  useEffect(() => {
    const st = document.createElement("style");
    st.textContent = "body::before,body::after{display:none!important}html,body{background:#F4F4F1!important}";
    document.head.appendChild(st);
    return () => st.remove();
  }, []);
  useReveal(items);

  /* QPay-ээс буцаж ирэх: ?order=AQ-… */
  useEffect(() => {
    const no = new URLSearchParams(location.search).get("order");
    if (!no) return;
    let n = 0, stop = false;
    setOrder({ no, status: "checking" });
    const poll = async () => {
      if (stop) return;
      const r = await fetch(`/api/shop/orders/${no}`).then((x) => x.json()).catch(() => null);
      if (r?.status === "paid" || r?.status === "shipped" || r?.status === "done") {
        setOrder({ no, status: "paid", total: r.total }); setCart([]); return;
      }
      if (r?.status === "cancelled") { setOrder({ no, status: "cancelled" }); return; }
      if (++n < 40) setTimeout(poll, 3000); else setOrder({ no, status: "pending", total: r?.total });
    };
    void poll();
    return () => { stop = true; };
  }, []);

  const hero = useMemo(() => items?.find((p) => p.featured) || items?.[0] || null, [items]);
  useEffect(() => { if (hero && !heroColor) setHeroColor(hero.colors[0]?.hex || "#111111"); }, [hero, heroColor]);
  const light = (items || []).filter((p) => p.tone === "light");
  const dark = (items || []).filter((p) => p.tone === "dark");
  const bySlug = useMemo(() => new Map((items || []).map((p) => [p.slug, p])), [items]);
  const lines = cart.map((l) => ({ ...l, p: bySlug.get(l.slug) })).filter((l) => l.p) as (Line & { p: P })[];
  const count = lines.reduce((a, l) => a + l.qty, 0);
  const subtotal = lines.reduce((a, l) => a + l.qty * l.p.price, 0);

  const add = useCallback((p: P, size: string, color: string) => {
    setCart((c) => {
      const i = c.findIndex((x) => x.slug === p.slug && x.size === size && x.color === color);
      if (i >= 0) { const n = [...c]; n[i] = { ...n[i], qty: Math.min(10, n[i].qty + 1) }; return n; }
      return [...c, { slug: p.slug, size, color, qty: 1 }];
    });
    setToast(`${p.name} — сагсанд нэмэгдлээ`);
    setTimeout(() => setToast(""), 2200);
  }, []);

  /* body scroll lock (sheet/drawer нээлттэй үед) */
  useEffect(() => {
    const lock = !!open || drawer;
    document.documentElement.style.overflow = lock ? "hidden" : "";
    return () => { document.documentElement.style.overflow = ""; };
  }, [open, drawer]);

  return (
    <div className={s.root}>
      {/* ── top bar: mix-blend difference → цагаан дээр хар, хар дээр цагаан ── */}
      <header className={s.bar}>
        <Link href="/" className={s.brand}>ANTAQOR<span>SUPPLY</span></Link>
        <nav className={s.nav}>
          <a href="#white">White</a><a href="#black">Black</a>
        </nav>
        <button className={s.cartBtn} onClick={() => setDrawer(true)} aria-label={`Сагс, ${count} бараа`}>
          Сагс<span className={s.count} data-n={count}>{count}</span>
        </button>
      </header>

      {/* ── HERO: 3D ── */}
      <section className={s.hero}>
        <h1 className={s.mega} aria-label="ANTAQOR SUPPLY">
          {"ANTAQOR".split("").map((ch, i) => <span key={i} style={{ animationDelay: `${120 + i * 60}ms` }}>{ch}</span>)}
        </h1>
        <div className={`${s.stage} ${ready3d ? s.stageOn : ""}`}>
          {hero && <Product3D model={hero.model3d} kind={hero.kind} color={heroColor || "#111"} className={s.canvas} onReady={() => setReady3d(true)} />}
          {!hero && items && <div className={s.empty}>Удахгүй.</div>}
        </div>
        <div className={s.hint} aria-hidden="true">⟲ Чирж эргүүл</div>
        {hero && (
          <div className={s.heroInfo}>
            <div className={s.heroL}>
              <span className={s.kicker}>Drop 01 · Онцлох</span>
              <h2>{hero.name}</h2>
              {hero.tagline && <p>{hero.tagline}</p>}
            </div>
            <div className={s.heroR}>
              <div className={s.swatches} role="radiogroup" aria-label="Өнгө">
                {hero.colors.map((c) => (
                  <button key={c.hex + c.name} role="radio" aria-checked={heroColor === c.hex} aria-label={c.name}
                    className={`${s.sw} ${heroColor === c.hex ? s.swOn : ""}`} style={{ background: c.hex }} onClick={() => setHeroColor(c.hex)} />
                ))}
              </div>
              <div className={s.price}>{mnt(hero.price)}{hero.compareAtPrice > hero.price && <s>{mnt(hero.compareAtPrice)}</s>}</div>
              <button className={s.cta} onClick={() => setOpen(hero)}>{hero.soldOut ? "Удахгүй" : "Сонгох"} <span>→</span></button>
            </div>
          </div>
        )}
      </section>

      {/* ── marquee ── */}
      <div className={s.marquee} aria-hidden="true"><div>{Array.from({ length: 8 }).map((_, i) => <span key={i}>ANTAQOR SUPPLY — BUILT FOR CREATORS — </span>)}</div></div>

      {/* ── WHITE ── */}
      <section id="white" className={`${s.col} ${s.white}`}>
        <div className={s.colHead} data-rv><span>01</span><h3>White</h3><p>Цэвэр. Тайван. Өдөр бүр.</p></div>
        <Grid list={light} onOpen={setOpen} loading={!items} />
      </section>

      {/* ── BLACK ── */}
      <section id="black" className={`${s.col} ${s.black}`}>
        <div className={s.colHead} data-rv><span>02</span><h3>Black</h3><p>Шөнийн ажил. Чимээгүй хүч.</p></div>
        <Grid list={dark} onOpen={setOpen} loading={!items} />
      </section>

      <footer className={s.foot}>
        <div>ANTAQOR SUPPLY</div>
        <p>Улаанбаатар дотор хүргэлт · QPay-ээр төлнө</p>
      </footer>

      {/* ── product sheet ── */}
      {open && <Sheet p={open} onClose={() => setOpen(null)} onAdd={(z, c) => { add(open, z, c); setOpen(null); setDrawer(true); }} />}

      {/* ── cart drawer ── */}
      <Drawer open={drawer} onClose={() => setDrawer(false)} lines={lines} subtotal={subtotal}
        setQty={(i, q) => setCart((c) => { const n = [...c]; const idx = c.findIndex((x) => x.slug === lines[i].slug && x.size === lines[i].size && x.color === lines[i].color); if (idx < 0) return c; if (q <= 0) n.splice(idx, 1); else n[idx] = { ...n[idx], qty: Math.min(10, q) }; return n; })} />

      {toast && <div className={s.toast} role="status">{toast}</div>}

      {order && <OrderState o={order} onClose={() => { setOrder(null); history.replaceState(null, "", "/shop"); }} />}
    </div>
  );
}

function Grid({ list, onOpen, loading }: { list: P[]; onOpen: (p: P) => void; loading: boolean }) {
  if (loading) return <div className={s.grid}>{[0, 1, 2, 3].map((i) => <div key={i} className={s.skel} />)}</div>;
  if (!list.length) return <p className={s.none} data-rv>Шинэ бараа удахгүй.</p>;
  return (
    <div className={s.grid}>
      {list.map((p) => (
        <button key={p._id} className={s.card} data-rv onClick={() => onOpen(p)}>
          <div className={s.media}>
            {p.images[0] ? (
              <>
                <img src={p.images[0]} alt={p.name} loading="lazy" decoding="async" />
                {p.images[1] && <img className={s.alt} src={p.images[1]} alt="" loading="lazy" decoding="async" />}
              </>
            ) : <Thumb kind={p.kind} hex={p.colors[0]?.hex || "#888"} dark={p.tone === "dark"} />}
            {p.soldOut && <span className={s.tag}>Удахгүй</span>}
            {!p.soldOut && p.compareAtPrice > p.price && <span className={s.tag}>−{Math.round((1 - p.price / p.compareAtPrice) * 100)}%</span>}
          </div>
          <div className={s.meta}>
            <span className={s.name}>{p.name}</span>
            <span className={s.pr}>{mnt(p.price)}</span>
          </div>
          {/* өнгөний мөр үргэлж байна (1 өнгөтэй бол ч) — картын өндөр бүгд ижил */}
          <div className={s.dots}>{p.colors.map((c) => <i key={c.hex + c.name} style={{ background: c.hex }} />)}<em>{p.colors.length > 1 ? `${p.colors.length} өнгө` : p.colors[0]?.name || ""}</em></div>
        </button>
      ))}
    </div>
  );
}

function Sheet({ p, onClose, onAdd }: { p: P; onClose: () => void; onAdd: (size: string, color: string) => void }) {
  const [size, setSize] = useState(p.sizes.find((x) => x.stock > 0)?.label || "");
  const [color, setColor] = useState(p.colors[0]?.name || "");
  const [img, setImg] = useState(0);
  const hex = p.colors.find((c) => c.name === color)?.hex || "#111";
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); addEventListener("keydown", k); return () => removeEventListener("keydown", k); }, [onClose]);
  const stockOf = p.sizes.find((x) => x.label === size)?.stock ?? 0;
  const can = !p.soldOut && (!p.sizes.length || stockOf > 0);
  return (
    <div className={s.scrim} onClick={onClose}>
      <div className={s.sheet} role="dialog" aria-modal="true" aria-label={p.name} onClick={(e) => e.stopPropagation()}>
        <button className={s.x} onClick={onClose} aria-label="Хаах">×</button>
        <div className={s.sheetMedia}>
          {p.images.length ? (
            <>
              <img key={img} src={p.images[img]} alt={p.name} className={s.sheetImg} />
              {p.images.length > 1 && <div className={s.thumbs}>{p.images.map((u, i) => <button key={u} className={i === img ? s.thOn : ""} onClick={() => setImg(i)}><img src={u} alt="" /></button>)}</div>}
            </>
          ) : <Product3D model={p.model3d} kind={p.kind} color={hex} className={s.sheet3d} />}
        </div>
        <div className={s.sheetBody}>
          <span className={s.kicker}>{p.tone === "dark" ? "Black" : "White"} collection</span>
          <h2>{p.name}</h2>
          <div className={s.price}>{mnt(p.price)}{p.compareAtPrice > p.price && <s>{mnt(p.compareAtPrice)}</s>}</div>
          {p.tagline && <p className={s.tagline}>{p.tagline}</p>}
          {!!p.colors.length && (<>
            <div className={s.lbl}>Өнгө — {color}</div>
            <div className={s.swatches}>{p.colors.map((c) => <button key={c.name} aria-label={c.name} className={`${s.sw} ${c.name === color ? s.swOn : ""}`} style={{ background: c.hex }} onClick={() => setColor(c.name)} />)}</div>
          </>)}
          {!!p.sizes.length && (<>
            <div className={s.lbl}>Хэмжээ</div>
            <div className={s.sizes}>{p.sizes.map((z) => (
              <button key={z.label} disabled={z.stock <= 0} className={z.label === size ? s.szOn : ""} onClick={() => setSize(z.label)}>{z.label}</button>
            ))}</div>
            {can && stockOf > 0 && stockOf <= 3 && <div className={s.low}>Сүүлийн {stockOf} ширхэг</div>}
          </>)}
          <button className={s.add} disabled={!can} onClick={() => onAdd(size, color)}>{can ? `Сагсанд нэмэх — ${mnt(p.price)}` : "Удахгүй"}</button>
          {p.description && <p className={s.desc}>{p.description}</p>}
        </div>
      </div>
    </div>
  );
}

function Drawer({ open, onClose, lines, subtotal, setQty }: {
  open: boolean; onClose: () => void; lines: (Line & { p: P })[]; subtotal: number; setQty: (i: number, q: number) => void;
}) {
  const [step, setStep] = useState<"cart" | "form">("cart");
  const [f, setF] = useState({ name: "", phone: "", address: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const first = useRef(true);
  useEffect(() => { if (first.current) { first.current = false; setF((x) => ({ ...x, ...load(ADDR, {}) })); } }, []);
  useEffect(() => { if (!open) { setStep("cart"); setErr(""); } }, [open]);

  async function pay() {
    setErr("");
    if (f.name.trim().length < 2 || f.phone.replace(/\D/g, "").length < 8 || f.address.trim().length < 6) { setErr("Нэр, утас (8 орон), хаягаа бүрэн бичнэ үү"); return; }
    setBusy(true);
    save(ADDR, { name: f.name, phone: f.phone, address: f.address });
    const r = await fetch("/api/shop/orders", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: lines.map((l) => ({ slug: l.slug, size: l.size, color: l.color, qty: l.qty })), customer: f }) })
      .then(async (x) => ({ ok: x.ok, d: await x.json().catch(() => ({})) })).catch(() => ({ ok: false, d: { error: "Сүлжээний алдаа" } }));
    setBusy(false);
    if (r.d?.url) { location.href = r.d.url; return; }
    setErr(r.d?.error || "Алдаа гарлаа");
  }

  return (
    <div className={`${s.dScrim} ${open ? s.dOn : ""}`} onClick={onClose} aria-hidden={!open}>
      <aside className={s.drawer} onClick={(e) => e.stopPropagation()} aria-label="Сагс">
        <div className={s.dHead}><b>{step === "cart" ? "Сагс" : "Хүргэлт"}</b><button onClick={onClose} aria-label="Хаах">×</button></div>
        {!lines.length ? <p className={s.dEmpty}>Сагс хоосон байна.</p> : step === "cart" ? (
          <>
            <ul className={s.lines}>{lines.map((l, i) => (
              <li key={l.slug + l.size + l.color}>
                <div className={s.lImg}>{l.p.images[0] ? <img src={l.p.images[0]} alt="" /> : <Thumb kind={l.p.kind} hex={l.p.colors.find((c) => c.name === l.color)?.hex || "#888"} />}</div>
                <div className={s.lMeta}><b>{l.p.name}</b><span>{[l.color, l.size].filter(Boolean).join(" · ")}</span><span>{mnt(l.p.price)}</span></div>
                <div className={s.qty}><button onClick={() => setQty(i, l.qty - 1)} aria-label="Хасах">−</button><span>{l.qty}</span><button onClick={() => setQty(i, l.qty + 1)} aria-label="Нэмэх">+</button></div>
              </li>
            ))}</ul>
            <div className={s.sum}><span>Нийт</span><b>{mnt(subtotal)}</b></div>
            <p className={s.small}>Хүргэлт Улаанбаатар дотор үнэгүй.</p>
            <button className={s.add} onClick={() => setStep("form")}>Үргэлжлүүлэх →</button>
          </>
        ) : (
          <div className={s.form}>
            <label>Нэр<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" /></label>
            <label>Утас<input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} inputMode="tel" autoComplete="tel" /></label>
            <label>Хүргэлтийн хаяг<textarea rows={3} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} autoComplete="street-address" /></label>
            <label>Нэмэлт тэмдэглэл<input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
            <div className={s.sum}><span>Төлөх</span><b>{mnt(subtotal)}</b></div>
            {err && <p className={s.err}>{err}</p>}
            <button className={s.add} disabled={busy} onClick={() => void pay()}>{busy ? "QPay нээж байна…" : `QPay-ээр төлөх — ${mnt(subtotal)}`}</button>
            <button className={s.back} onClick={() => setStep("cart")}>← Сагс руу</button>
          </div>
        )}
      </aside>
    </div>
  );
}

function OrderState({ o, onClose }: { o: { no: string; status: string; total?: number }; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  async function retry() {
    setBusy(true);
    const r = await fetch(`/api/shop/orders/${o.no}`, { method: "POST" }).then((x) => x.json()).catch(() => ({}));
    setBusy(false);
    if (r.url) location.href = r.url; else if (r.paid) location.reload();
  }
  return (
    <div className={s.scrim}>
      <div className={s.state} role="dialog" aria-modal="true">
        {o.status === "checking" && (<><div className={s.spin} /><h3>Төлбөр шалгаж байна…</h3><p>{o.no}</p></>)}
        {o.status === "paid" && (<><div className={s.check}>✓</div><h3>Баярлалаа!</h3><p>Захиалга <b>{o.no}</b> баталгаажлаа. Бид удахгүй утсаар холбогдож хүргэлтээ тохирно.</p><button className={s.add} onClick={onClose}>Дэлгүүр рүү</button></>)}
        {o.status === "pending" && (<><h3>Төлбөр хүлээгдэж байна</h3><p>{o.no}{o.total ? ` · ${mnt(o.total)}` : ""}</p><button className={s.add} disabled={busy} onClick={() => void retry()}>QPay дахин нээх</button><button className={s.back} onClick={onClose}>Хаах</button></>)}
        {o.status === "cancelled" && (<><h3>Захиалга цуцлагдсан</h3><p>{o.no}</p><button className={s.add} onClick={onClose}>Хаах</button></>)}
      </div>
    </div>
  );
}
