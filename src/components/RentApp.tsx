"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

/* ─── UB RENT — /rent ──────────────────────────────────────────────────
   Өгөгдсөн прототипийн БҮХ 10 дэлгэцийг хөрвүүлэв. Тооцооны томьёо
   (зардал, зам, нар, дуу чимээ) нь прототипээс ҮСЭГ ЧАНГА хуулагдсан —
   тоонууд нь зохиомол биш, тэнд тодорхойлогдсон загвар.

   ӨӨРИЙН ПАЛИТРТАЙ: сайт #0A0A0A харанхуй боловч энэ нь өгөгдсөн
   дизайны хэл — цайвар цаас (#FFFDF7), хар бэх (#0A0A0A), teal
   (#00C2A8), 3px хүрээ, хатуу сүүдэр. /yuki, /erchis-тэй адил нэг
   апп дээр сууж буй ТУСДАА бүтээгдэхүүний гадаргуу. */

const TEAL = "#00C2A8";
const INK = "#0A0A0A";
const PAPER = "#FFFDF7";

const WD = ["Ня", "Да", "Мя", "Лх", "Пү", "Ба", "Бя"];
const DESTS = ["Төв талбай", "Их тойруу", "МУИС", "Зайсан"];
const SLOTS = ["09:00", "10:00", "11:30", "13:00", "14:30", "16:00", "17:30", "18:30", "19:30"];
const FURN = [
  { k: "sofa", label: "Буйдан", x: "46%", y: "52%", w: "38%", size: "210см" },
  { k: "bed", label: "Ор", x: "10%", y: "30%", w: "34%", size: "160см" },
  { k: "table", label: "Ширээ", x: "52%", y: "24%", w: "26%", size: "120см" },
  { k: "tv", label: "ТВ", x: "14%", y: "12%", w: "28%", size: '55"' },
];

export interface Listing {
  id: string; title: string; price: number; location: string; district: string;
  area: number; rooms: number; baths: number; floor: number; badge: string;
  photo: string; desc: string; hoa: number; orient: string; sunPeak: number;
  noise: number; road: string; fee: number; deposit: number;
  /** [км, энгийн мин, оргил мин] × 4 чиглэл */
  routes: number[][];
}

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
const short = (n: number) => (n >= 1e6 ? (n / 1e6).toFixed(2).replace(/0$/, "") + "M" : Math.round(n / 1000) + "K");
const hh = (n: number) => (n < 10 ? "0" : "") + n + ":00";

/* ── Сарын бодит зардал. Прототипийн `calc()`. ────────────────────── */
function calc(l: Listing, s: { budget: number; dest: number; mode: string; hh: number; months: number }) {
  const r = l.routes[s.dest] || [0, 0, 0];
  const [km, off, peakCar] = r;
  const bus = s.mode === "bus";
  const peak = bus ? Math.round(peakCar * 1.35 + 8) : peakCar;
  const offM = bus ? Math.round(off * 1.4 + 8) : off;
  const transport = bus ? 2 * 22 * 500 : km * 2 * 22 * 260;
  const heat = l.area * 1400, elec = 22000 + s.hh * 14000, water = s.hh * 11000, net = 45000;

  const raw: [string, number, string][] = [
    ["Түрээс", l.price, "Зар дээрх"],
    ["СӨХ", l.hoa, "Сар бүр"],
    ["Дулаан", heat, l.area + "м² · өвөл"],
    ["Цахилгаан", elec, s.hh + " хүн"],
    ["Ус", water, s.hh + " хүн"],
    ["Интернэт", net, "100Mbps"],
    [bus ? "Автобус" : "Шатахуун", transport, "22 ажлын өдөр"],
  ];
  const total = raw.reduce((a, x) => a + x[1], 0);
  const max = Math.max(...raw.map((x) => x[1]));
  const pct = Math.round((total / s.budget) * 100);
  const fit = pct <= 90 ? ["Төсөвт багтана", TEAL] : pct <= 100 ? ["Хил дээр", "#FFFFFF"] : ["Төсвөөс хэтэрнэ", "#FFD7CF"];

  const fee = l.price * l.fee;
  const upfront: [string, string, number][] = [
    ["Эхний сарын түрээс", "Нүүхээс өмнө", l.price],
    ["Барьцаа", l.deposit + " сарын түрээс", l.price * l.deposit],
    ["Агентын шимтгэл", l.fee ? "50% · нэг удаа" : "Эзэмшигчээс шууд", fee],
    ["Нүүлгэлт", "Ойролцоо дүн", 150000],
  ];
  const maxR = Math.max(...l.routes.map((x) => x[2] || 0), 1);

  return {
    peak, off: offM, total, totalFmt: fmt(total), totalShort: short(total),
    budgetPct: pct, budgetBar: Math.min(pct, 100) + "%", fitLabel: fit[0], fitBg: fit[1],
    hiddenFmt: fmt(total - l.price),
    items: raw.map((x) => ({ label: x[0], fmt: fmt(x[1]), note: x[2], w: Math.max(4, (x[1] / max) * 100) + "%" })),
    transportFmt: fmt(transport), monthHours: Math.round((peak * 2 * 22) / 60),
    allRoutes: l.routes.map((x, i) => {
      const m = bus ? Math.round(x[2] * 1.35 + 8) : x[2];
      return { name: DESTS[i], min: m, w: ((x[2] || 0) / maxR) * 100 + "%", on: i === s.dest };
    }),
    upfront: upfront.map((u) => ({ label: u[0], note: u[1], fmt: fmt(u[2]) })),
    upfrontFmt: fmt(upfront.reduce((a, u) => a + u[2], 0)),
    contractFmt: short(total * s.months),
    depositRule: l.deposit === 1 ? "Гэрээ дуусахад" : "2 сарын дараа",
  };
}

/* ── Нэг өдрийн нар/чимээ. Прототипийн `dayVals()`. ───────────────── */
function dayVals(l: Listing, sim: ReturnType<typeof calc>, hour: number, dest: number) {
  const light = hour < 7 || hour > 18 ? 0 : Math.max(0, Math.round((1 - Math.abs(hour - l.sunPeak) / 6) * 100));
  const prof: Record<number, number> = { 7: 6, 8: 14, 9: 10, 12: 4, 13: 4, 17: 10, 18: 16, 19: 12, 20: 6, 22: -8, 23: -12 };
  const db = Math.max(28, l.noise + (prof[hour] ?? 0));
  const act = hour < 8 ? "Өглөө · сэрэх" : hour < 9 ? "Ажилдаа явах" : hour < 18 ? "Өдөр · гэртээ биш"
    : hour < 20 ? "Буцаж ирэх" : hour < 22 ? "Орой · амрах" : "Унтах";
  return {
    hourLabel: hh(hour), light, db, dark: hour >= 19 || hour < 7 ? 0.55 : Math.max(0, 0.5 - light / 200), activity: act,
    events: [
      { t: hh(Math.max(7, l.sunPeak - 2)), title: "Нар орж ирнэ", sub: `${l.orient} цонх · хамгийн гэрэлтэй ${hh(l.sunPeak)}`, bg: TEAL },
      { t: "08:00", title: "Ажилдаа гарна", sub: `${DESTS[dest]} хүртэл ${sim.peak} мин`, bg: "#fff" },
      { t: "18:00", title: "Гэртээ ирнэ", sub: `Оргил цаг · ${sim.peak} мин`, bg: "#fff" },
      { t: "19:00", title: "Хамгийн чимээтэй", sub: `${l.road} · ${l.noise + 12} dB`, bg: l.noise > 50 ? "#FFD7CF" : "#fff" },
      { t: "23:00", title: "Нам гүм", sub: `${Math.max(28, l.noise - 12)} dB · унтахад ${l.noise - 12 < 40 ? "тохиромжтой" : "дунд зэрэг"}`, bg: "#E6F7F4" },
    ],
  };
}

/* ── Жижиг хэсгүүд ──────────────────────────────────────────────── */
const box = (extra: React.CSSProperties = {}): React.CSSProperties =>
  ({ border: `3px solid ${INK}`, background: "#fff", ...extra });
const hard = (c = INK) => `3px 3px 0 ${c}`;

function Btn({ on, onClick, children, style }: { on?: boolean; onClick?: () => void; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <button onClick={onClick} style={{
      border: `3px solid ${INK}`, background: on ? TEAL : "#fff", color: INK,
      padding: "10px 14px", fontWeight: 900, fontSize: 13, minHeight: 44,
      boxShadow: on ? hard() : "none", cursor: "pointer", ...style,
    }}>{children}</button>
  );
}

function Bar({ w, bg = TEAL }: { w: string; bg?: string }) {
  return <div style={{ height: 10, border: `2px solid ${INK}`, background: "#fff" }}>
    <div style={{ width: w, height: "100%", background: bg }} />
  </div>;
}

export default function RentApp() {
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [busy, setBusy] = useState<{ listing: string; date: string; slot: string }[]>([]);
  const [screen, setScreen] = useState("home");
  const [district, setDistrict] = useState("Бүгд");
  const [query, setQuery] = useState("");
  const [cur, setCur] = useState<string>("");
  const [saved, setSaved] = useState<string[]>([]);
  const [tool, setTool] = useState("walk");
  const [placed, setPlaced] = useState<string[]>([]);
  const [day, setDay] = useState(0);
  const [slot, setSlot] = useState<string | null>(null);
  const [mode, setMode] = useState("in");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [bookings, setBookings] = useState<{ id: string; title: string; location: string; day: string; slot: string; mode: string; status: string }[]>([]);
  const [err, setErr] = useState("");
  const [sending, setSending] = useState(false);
  /* Зар тавих нь НЭВТЭРСЭН гишүүнд нээлттэй — админ байх шаардлагагүй.
     Байр хайх, цаг захиалах хоёр нэвтрэлтгүй хэвээр. */
  const { data: session } = useSession();
  const [draft, setDraft] = useState({
    title: "", price: "", location: "", district: "", area: "", rooms: "",
    baths: "", floor: "", desc: "", contactPhone: "", photo: "",
  });

  // симуляцын тохиргоо
  const [simBudget, setSimBudget] = useState(2500000);
  const [simDest, setSimDest] = useState(0);
  const [simMode, setSimMode] = useState("car");
  const [simHh, setSimHh] = useState(2);
  const [simMonths, setSimMonths] = useState(12);
  const [simTab, setSimTab] = useState("cost");
  const [simHour, setSimHour] = useState(8);

  useEffect(() => {
    fetch("/api/rent/listings").then((r) => r.json()).then((d) => {
      const rows: Listing[] = Array.isArray(d.listings) ? d.listings : [];
      setListings(rows); setBusy(Array.isArray(d.busy) ? d.busy : []);
      if (rows[0]) setCur(rows[0].id);
    }).catch(() => setListings([]));
    try { setSaved(JSON.parse(localStorage.getItem("rent:saved") || "[]")); } catch { /* хаалттай */ }
  }, []);

  const persistSaved = (next: string[]) => {
    setSaved(next);
    try { localStorage.setItem("rent:saved", JSON.stringify(next)); } catch { /* хаалттай */ }
  };
  const toggleSave = (id: string) => persistSaved(saved.includes(id) ? saved.filter((x) => x !== id) : [...saved, id]);

  const loadBookings = useCallback(async () => {
    const p = phone.replace(/\D/g, "");
    const r = await fetch(`/api/rent/bookings${p.length >= 6 ? `?phone=${p}` : ""}`);
    const d = await r.json();
    setBookings(Array.isArray(d.bookings) ? d.bookings : []);
  }, [phone]);

  const days = useMemo(() => Array.from({ length: 10 }, (_, i) => {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + i);
    return { n: d.getDate(), wd: i === 0 ? "Өнөө" : WD[d.getDay()], iso: d.toISOString().slice(0, 10), label: `${d.getMonth() + 1}/${d.getDate()} ${WD[d.getDay()]}` };
  }), []);

  const L = listings || [];
  const curL = L.find((x) => x.id === cur) || L[0];
  const simState = { budget: simBudget, dest: simDest, mode: simMode, hh: simHh, months: simMonths };
  const sim = curL ? calc(curL, simState) : null;
  const dv = curL && sim ? dayVals(curL, sim, simHour, simDest) : null;

  const q = query.trim().toLowerCase();
  const filtered = L.filter((l) => (district === "Бүгд" || l.district === district) && (!q || (l.title + l.location).toLowerCase().includes(q)));
  const districts = ["Бүгд", ...Array.from(new Set(L.map((l) => l.district).filter(Boolean)))];

  const takenToday = (iso: string) => busy.filter((b) => b.listing === cur && b.date === iso).map((b) => b.slot);

  async function confirmBook() {
    if (!slot || !curL) return;
    if (phone.replace(/\D/g, "").length < 6) { setErr("Утасны дугаараа оруулна уу"); return; }
    setSending(true); setErr("");
    try {
      const res = await fetch("/api/rent/bookings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listing: curL.id, date: days[day].iso, dayLabel: days[day].label, slot,
          mode: mode === "in" ? "Биеэр" : "Видео", name, phone,
        }),
      });
      const d = await res.json();
      if (!res.ok) { setErr(d.error || "Захиалж чадсангүй"); return; }
      setBusy((b) => [...b, { listing: curL.id, date: days[day].iso, slot }]);
      setScreen("done");
    } catch { setErr("Сүлжээний алдаа"); }
    finally { setSending(false); }
  }

  async function submitListing() {
    if (!draft.title.trim() || !Number(draft.price)) { setErr("Гарчиг, үнэ шаардлагатай"); return; }
    setSending(true); setErr("");
    try {
      const res = await fetch("/api/rent/listings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft, price: Number(draft.price), area: Number(draft.area),
          rooms: Number(draft.rooms), baths: Number(draft.baths), floor: Number(draft.floor),
        }),
      });
      const d = await res.json();
      if (!res.ok) { setErr(d.error || "Нийтэлж чадсангүй"); return; }
      const r = await fetch("/api/rent/listings").then((x) => x.json());
      setListings(r.listings || []);
      setDraft({ title: "", price: "", location: "", district: "", area: "", rooms: "", baths: "", floor: "", desc: "", contactPhone: "", photo: "" });
      setScreen("home");
    } catch { setErr("Сүлжээний алдаа"); }
    finally { setSending(false); }
  }

  if (listings === null) {
    return <div style={{ background: PAPER, minHeight: "100svh", display: "grid", placeContent: "center" }}>
      <div style={{ width: 10, height: 10, background: TEAL }} />
    </div>;
  }

  const Shell = ({ children, dark }: { children: React.ReactNode; dark?: boolean }) => (
    <div style={{ background: dark ? INK : PAPER, color: dark ? "#fff" : INK, minHeight: "100svh", paddingBottom: 96, fontFamily: "var(--font-sans), sans-serif" }}>
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "16px 16px 0" }}>{children}</div>
      {["home", "saved", "bookings"].includes(screen) && (
        <nav style={{ position: "fixed", left: 0, right: 0, bottom: 0, display: "flex", borderTop: `3px solid ${INK}`, background: "#fff", maxWidth: 520, margin: "0 auto" }}>
          {[["home", "Нүүр"], ["saved", "Хадгалсан"], ["bookings", "Захиалга"]].map(([k, lab], i) => (
            <button key={k} onClick={() => { setScreen(k); if (k === "bookings") void loadBookings(); }}
              style={{ flex: 1, padding: "14px 4px", minHeight: 56, fontWeight: 900, fontSize: 12, background: screen === k ? TEAL : "#fff", color: INK, border: 0, borderRight: i < 2 ? `3px solid ${INK}` : 0, cursor: "pointer" }}>
              {lab}
            </button>
          ))}
        </nav>
      )}
    </div>
  );

  /* ═══ НҮҮР ═══ */
  if (screen === "home") return (
    <Shell>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 900, letterSpacing: "0.18em", color: "#6B6B6B" }}>УЛААНБААТАР · ТҮРЭЭС</p>
      <h1 style={{ margin: "6px 0 0", fontSize: 34, lineHeight: 1, fontWeight: 900, letterSpacing: "-0.03em", textTransform: "uppercase" }}>
        Байраа очихоос өмнө<br /><span style={{ color: TEAL }}>дижиталаар</span> шалга.
      </h1>

      {session?.user && (
        <Btn on onClick={() => { setErr(""); setScreen("post"); }} style={{ width: "100%", marginTop: 16, padding: 14, boxShadow: hard() }}>
          + Байраа түрээслүүлэх
        </Btn>
      )}

      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Хайх — байр, байршил…"
        style={{ ...box(), width: "100%", padding: "13px 14px", marginTop: 16, fontSize: 14, fontWeight: 700, outline: "none" }} />

      <div style={{ display: "flex", gap: 8, overflowX: "auto", margin: "12px 0 18px", paddingBottom: 4 }}>
        {districts.map((d) => (
          <button key={d} onClick={() => setDistrict(d)} style={{
            flexShrink: 0, border: `3px solid ${INK}`, background: district === d ? INK : "#fff",
            color: district === d ? TEAL : INK, padding: "9px 13px", fontWeight: 900, fontSize: 12,
            boxShadow: hard(district === d ? TEAL : INK), cursor: "pointer", minHeight: 44,
          }}>{d}</button>
        ))}
      </div>

      <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 900, letterSpacing: "0.14em" }}>ШИНЭ ЗАРУУД · {filtered.length}</p>
      {filtered.length === 0 && <p style={{ fontSize: 14, fontWeight: 700 }}>Илэрц олдсонгүй. Өөр дүүрэг сонгоно уу.</p>}

      <div style={{ display: "grid", gap: 14 }}>
        {filtered.map((l) => (
          <article key={l.id} onClick={() => { setCur(l.id); setScreen("detail"); }} style={{ ...box(), boxShadow: hard(), cursor: "pointer" }}>
            <div style={{ position: "relative", aspectRatio: "16/10", background: "#E6F7F4", borderBottom: `3px solid ${INK}`, overflow: "hidden" }}>
              {l.photo && <img src={l.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
              {l.badge && <span style={{ position: "absolute", top: 10, left: 10, background: TEAL, border: `3px solid ${INK}`, padding: "4px 8px", fontSize: 11, fontWeight: 900 }}>{l.badge}</span>}
              <button onClick={(e) => { e.stopPropagation(); toggleSave(l.id); }} aria-label="Хадгалах"
                style={{ position: "absolute", top: 10, right: 10, width: 44, height: 44, border: `3px solid ${INK}`, background: saved.includes(l.id) ? TEAL : "#fff", fontSize: 18, cursor: "pointer" }}>♥</button>
            </div>
            <div style={{ padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, letterSpacing: "-0.02em" }}>{l.title}</h2>
                <span style={{ fontSize: 17, fontWeight: 900, whiteSpace: "nowrap" }}>{fmt(l.price)}<span style={{ fontSize: 11 }}> /сар</span></span>
              </div>
              <p style={{ margin: "4px 0 10px", fontSize: 13, color: "#555" }}>{l.location}</p>
              <div style={{ display: "flex", gap: 14, fontSize: 12, fontWeight: 700 }}>
                <span>{l.area} м²</span><span>{l.rooms} өрөө</span><span>{l.baths} угаалга</span><span>{l.floor} давхар</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </Shell>
  );

  /* ═══ ЗАР НЭМЭХ ═══ */
  if (screen === "post") {
    const F = (k: keyof typeof draft, label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
      <label style={{ display: "block", marginBottom: 10 }}>
        <span style={{ display: "block", fontSize: 11, fontWeight: 900, letterSpacing: "0.14em", marginBottom: 5 }}>{label}</span>
        <input value={draft[k]} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
          {...extra}
          style={{ ...box(), width: "100%", padding: "12px 13px", fontSize: 14, fontWeight: 700, outline: "none" }} />
      </label>
    );
    return (
      <Shell>
        <Btn onClick={() => setScreen("home")} style={{ marginBottom: 14 }}>← Буцах</Btn>
        <h2 style={{ margin: "0 0 4px", fontSize: 30, fontWeight: 900, textTransform: "uppercase", letterSpacing: "-0.02em", lineHeight: 1 }}>
          Байраа түрээслүүлэх
        </h2>
        <p style={{ margin: "8px 0 18px", fontSize: 13, color: "#555" }}>
          Зар шууд нийтлэгдэнэ. Зам, нар, чимээний нарийн үзүүлэлтийг дараа нь тохируулна.
        </p>

        {F("title", "ГАРЧИГ", { placeholder: "2 өрөө байр" })}
        {F("price", "ҮНЭ ₮ / САР", { inputMode: "numeric", placeholder: "1800000" })}
        {F("location", "БАЙРШИЛ", { placeholder: "Хан-Уул, River Garden" })}
        {F("district", "ДҮҮРЭГ", { placeholder: "Хан-Уул" })}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {F("area", "М²", { inputMode: "numeric" })}
          {F("rooms", "ӨРӨӨ", { inputMode: "numeric" })}
          {F("baths", "УГААЛГА", { inputMode: "numeric" })}
          {F("floor", "ДАВХАР", { inputMode: "numeric" })}
        </div>
        {F("contactPhone", "ХОЛБОО БАРИХ УТАС", { inputMode: "tel" })}
        {F("photo", "ЗУРГИЙН ЗАМ (заавал биш)", { placeholder: "/uploads/..." })}

        <label style={{ display: "block", marginBottom: 10 }}>
          <span style={{ display: "block", fontSize: 11, fontWeight: 900, letterSpacing: "0.14em", marginBottom: 5 }}>ТАЙЛБАР</span>
          <textarea value={draft.desc} onChange={(e) => setDraft({ ...draft, desc: e.target.value })} rows={4}
            style={{ ...box(), width: "100%", padding: "12px 13px", fontSize: 14, fontWeight: 700, outline: "none", resize: "vertical" }} />
        </label>

        {err && <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 900, background: "#FFD7CF", border: `3px solid ${INK}`, padding: "8px 10px" }}>{err}</p>}

        <Btn on onClick={submitListing} style={{ width: "100%", padding: 16, fontSize: 15, boxShadow: hard() }}>
          {sending ? "Нийтэлж байна…" : "Нийтлэх"}
        </Btn>
      </Shell>
    );
  }

  if (!curL || !sim || !dv) return <Shell><p>Зар алга.</p></Shell>;

  /* ═══ ДЭЛГЭРЭНГҮЙ ═══ */
  if (screen === "detail") return (
    <Shell>
      <Btn onClick={() => setScreen("home")} style={{ marginBottom: 14 }}>← Буцах</Btn>
      <div style={{ ...box(), boxShadow: hard() }}>
        <div style={{ aspectRatio: "16/10", background: "#E6F7F4", borderBottom: `3px solid ${INK}`, overflow: "hidden" }}>
          {curL.photo && <img src={curL.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
        </div>
        <div style={{ padding: 16 }}>
          <h2 style={{ margin: 0, fontSize: 28, fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1.05 }}>{curL.title}</h2>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#555" }}>{curL.location}</p>
          <p style={{ margin: "12px 0 0", fontSize: 26, fontWeight: 900 }}>{fmt(curL.price)}<span style={{ fontSize: 13 }}> / сар</span></p>
          <div style={{ display: "flex", gap: 14, fontSize: 12, fontWeight: 700, marginTop: 10 }}>
            <span>{curL.area} м²</span><span>{curL.rooms} өрөө</span><span>{curL.baths} угаалга</span><span>{curL.floor} давхар</span>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
        {[["walk", "Walk", "Виртуал алхалт"], ["measure", "Measure", "Хэмжих"], ["furniture", "Тавилга", "Тааруулах"], ["compare", "Compare", "Харьцуулах"]].map(([k, lab, sub], i) => (
          <Btn key={k} on={i === 0} onClick={() => k === "compare" ? setScreen("saved") : (setTool(k), setScreen("tour"))}
            style={{ textAlign: "left", boxShadow: hard() }}>
            <span style={{ display: "block", fontSize: 14 }}>{lab}</span>
            <span style={{ display: "block", fontSize: 10, fontWeight: 700, opacity: .7 }}>{sub}</span>
          </Btn>
        ))}
      </div>

      <button onClick={() => setScreen("simSetup")} style={{ ...box({ background: INK, color: "#fff" }), width: "100%", marginTop: 14, padding: 16, textAlign: "left", boxShadow: hard(TEAL), cursor: "pointer", minHeight: 44 }}>
        <span style={{ display: "block", fontSize: 11, fontWeight: 900, letterSpacing: "0.14em", color: TEAL }}>ДИЖИТАЛ ШАЛГАЛТ</span>
        <span style={{ display: "block", fontSize: 22, fontWeight: 900, marginTop: 4 }}>Энд нэг сар амьдарвал?</span>
        <span style={{ display: "block", fontSize: 12, marginTop: 6, opacity: .8 }}>Нийт / сар · {sim.totalShort}₮ — симуляц хийх →</span>
      </button>

      <h3 style={{ margin: "20px 0 8px", fontSize: 12, fontWeight: 900, letterSpacing: "0.14em" }}>ТАЙЛБАР</h3>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7 }}>{curL.desc}</p>

      <Btn on onClick={() => { setSlot(null); setErr(""); setScreen("book"); }} style={{ width: "100%", marginTop: 20, padding: 16, fontSize: 15, boxShadow: hard() }}>
        Viewing захиалах
      </Btn>
    </Shell>
  );

  /* ═══ ТУР (walk / measure / furniture) ═══ */
  if (screen === "tour") return (
    <Shell dark>
      <Btn onClick={() => setScreen("detail")} style={{ marginBottom: 14 }}>← Буцах</Btn>
      <div style={{ position: "relative", aspectRatio: "4/5", border: `3px solid #fff`, background: "#15202B", overflow: "hidden" }}>
        {curL.photo && <img src={curL.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: tool === "walk" ? 1 : .45 }} />}
        {tool === "measure" && (
          <div style={{ position: "absolute", inset: 0, display: "grid", placeContent: "center" }}>
            <div style={{ border: "3px dashed " + TEAL, padding: "26px 34px", color: "#fff", fontWeight: 900, fontSize: 20 }}>4.20 м</div>
          </div>
        )}
        {tool === "furniture" && FURN.filter((f) => placed.includes(f.k)).map((f) => (
          <button key={f.k} onClick={() => setPlaced(placed.filter((x) => x !== f.k))}
            style={{ position: "absolute", left: f.x, top: f.y, width: f.w, border: `3px solid ${INK}`, background: TEAL, color: INK, padding: "8px 4px", fontWeight: 900, fontSize: 11, cursor: "pointer" }}>
            {f.label}<br /><span style={{ fontSize: 9 }}>{f.size}</span>
          </button>
        ))}
        <span style={{ position: "absolute", top: 10, left: 10, background: TEAL, border: `3px solid ${INK}`, padding: "4px 8px", fontSize: 11, fontWeight: 900 }}>360° ҮЗЭХ</span>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        {[["walk", "Walk"], ["measure", "Measure"], ["furniture", "Тавилга"]].map(([k, lab]) => (
          <Btn key={k} on={tool === k} onClick={() => setTool(k)} style={{ flex: 1 }}>{lab}</Btn>
        ))}
      </div>

      {tool === "furniture" && (
        <>
          <p style={{ margin: "16px 0 8px", fontSize: 11, fontWeight: 900, letterSpacing: "0.14em" }}>МИНИЙ ТАВИЛГА</p>
          <p style={{ margin: "0 0 10px", fontSize: 12, opacity: .7 }}>Дарж байрлуул · дахин дарж авна</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {FURN.map((f) => {
              const on = placed.includes(f.k);
              return <Btn key={f.k} on={on} onClick={() => setPlaced(on ? placed.filter((x) => x !== f.k) : [...placed, f.k])}>
                {f.label} · {f.size}
              </Btn>;
            })}
          </div>
        </>
      )}

      <Btn on onClick={() => { setSlot(null); setScreen("book"); }} style={{ width: "100%", marginTop: 20, padding: 16, fontSize: 15 }}>
        Таалагдлаа · Viewing авах
      </Btn>
    </Shell>
  );

  /* ═══ СИМУЛЯЦЫН ТОХИРГОО ═══ */
  if (screen === "simSetup") return (
    <Shell>
      <Btn onClick={() => setScreen("detail")} style={{ marginBottom: 14 }}>← Буцах</Btn>
      <h2 style={{ margin: "0 0 4px", fontSize: 30, fontWeight: 900, lineHeight: 1, textTransform: "uppercase", letterSpacing: "-0.02em" }}>
        Таны амьдралын<br />нөхцөл
      </h2>

      <div style={{ ...box(), boxShadow: hard(), padding: 16, marginTop: 18 }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 900, letterSpacing: "0.14em" }}>САРЫН ТӨСӨВ</p>
        <p style={{ margin: "6px 0 10px", fontSize: 26, fontWeight: 900 }}>{fmt(simBudget)}₮</p>
        <input type="range" min={800000} max={6000000} step={50000} value={simBudget}
          onChange={(e) => setSimBudget(+e.target.value)} style={{ width: "100%", accentColor: TEAL }} />
      </div>

      <p style={{ margin: "18px 0 8px", fontSize: 11, fontWeight: 900, letterSpacing: "0.14em" }}>АЖИЛ / СУРГУУЛЬ ХААНА?</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {DESTS.map((d, i) => <Btn key={d} on={simDest === i} onClick={() => setSimDest(i)}>{d}</Btn>)}
      </div>

      <p style={{ margin: "18px 0 8px", fontSize: 11, fontWeight: 900, letterSpacing: "0.14em" }}>УНАА</p>
      <div style={{ display: "flex", gap: 8 }}>
        {[["car", "Машин"], ["bus", "Автобус"]].map(([k, lab]) => <Btn key={k} on={simMode === k} onClick={() => setSimMode(k)} style={{ flex: 1 }}>{lab}</Btn>)}
      </div>

      <p style={{ margin: "18px 0 8px", fontSize: 11, fontWeight: 900, letterSpacing: "0.14em" }}>ӨРХ</p>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Btn onClick={() => setSimHh(Math.max(1, simHh - 1))} style={{ width: 52 }}>−</Btn>
        <span style={{ fontSize: 24, fontWeight: 900, minWidth: 60, textAlign: "center" }}>{simHh} хүн</span>
        <Btn onClick={() => setSimHh(Math.min(6, simHh + 1))} style={{ width: 52 }}>+</Btn>
      </div>

      <p style={{ margin: "18px 0 8px", fontSize: 11, fontWeight: 900, letterSpacing: "0.14em" }}>ГЭРЭЭ</p>
      <div style={{ display: "flex", gap: 8 }}>
        {[6, 12].map((m) => <Btn key={m} on={simMonths === m} onClick={() => setSimMonths(m)} style={{ flex: 1 }}>{m} сар</Btn>)}
      </div>

      <Btn on onClick={() => { setSimTab("cost"); setScreen("sim"); }} style={{ width: "100%", marginTop: 22, padding: 16, fontSize: 15, boxShadow: hard() }}>
        Симуляц харах →
      </Btn>
    </Shell>
  );

  /* ═══ СИМУЛЯЦ ═══ */
  if (screen === "sim") return (
    <Shell>
      <Btn onClick={() => setScreen("simSetup")} style={{ marginBottom: 14 }}>← Тохиргоо</Btn>
      <div style={{ display: "flex" }}>
        {[["cost", "Зардал"], ["commute", "Зам"], ["day", "Нэг өдөр"], ["move", "Нүүх"]].map(([k, lab], i) => (
          <button key={k} onClick={() => setSimTab(k)} style={{
            flex: 1, padding: "12px 2px", minHeight: 48, fontWeight: 900, fontSize: 12, cursor: "pointer",
            background: simTab === k ? INK : "#fff", color: simTab === k ? TEAL : INK,
            border: `3px solid ${INK}`, borderRight: i < 3 ? 0 : `3px solid ${INK}`,
          }}>{lab}</button>
        ))}
      </div>

      {simTab === "cost" && (
        <div style={{ marginTop: 16 }}>
          <div style={{ ...box({ background: INK, color: "#fff" }), padding: 16, boxShadow: hard(TEAL) }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 900, letterSpacing: "0.14em", color: TEAL }}>САРЫН БОДИТ НИЙТ ЗАРДАЛ</p>
            <p style={{ margin: "6px 0 0", fontSize: 40, fontWeight: 900, lineHeight: .95 }}>{sim.totalFmt}₮</p>
            <p style={{ margin: "8px 0 0", fontSize: 12, opacity: .85 }}>
              Зар дээрх үнээс <b style={{ color: TEAL }}>{sim.hiddenFmt}₮</b> нэмэгдэж байна. Дулааныг өвлийн дунджаар тооцов.
            </p>
            <div style={{ marginTop: 12, background: sim.fitBg, color: INK, border: `3px solid ${INK}`, padding: "8px 10px", fontWeight: 900, fontSize: 13, display: "inline-block" }}>
              {sim.fitLabel} · төсвийн {sim.budgetPct}%
            </div>
          </div>
          <div style={{ marginTop: 14 }}><Bar w={sim.budgetBar} bg={sim.budgetPct > 100 ? "#FFD7CF" : TEAL} /></div>
          <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
            {sim.items.map((it) => (
              <div key={it.label} style={{ ...box(), padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 900, fontSize: 14 }}>
                  <span>{it.label}</span><span>{it.fmt}₮</span>
                </div>
                <p style={{ margin: "2px 0 8px", fontSize: 11, color: "#666" }}>{it.note}</p>
                <Bar w={it.w} />
              </div>
            ))}
          </div>
        </div>
      )}

      {simTab === "commute" && (
        <div style={{ marginTop: 16 }}>
          <div style={{ ...box(), padding: 16, boxShadow: hard() }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 900, letterSpacing: "0.14em" }}>ОРГИЛ ЗАМ · {DESTS[simDest]}</p>
            <p style={{ margin: "6px 0 0", fontSize: 40, fontWeight: 900, lineHeight: .95 }}>{sim.peak} <span style={{ fontSize: 15 }}>минут</span></p>
            <p style={{ margin: "6px 0 0", fontSize: 13 }}>11:00 · Энгийн — {sim.off} минут</p>
            <p style={{ margin: "10px 0 0", fontSize: 13, fontWeight: 900 }}>Сард замд {sim.monthHours} цаг</p>
          </div>
          <p style={{ margin: "18px 0 8px", fontSize: 11, fontWeight: 900, letterSpacing: "0.14em" }}>ОРГИЛ ЦАГААР · БҮХ ЧИГЛЭЛ</p>
          <div style={{ display: "grid", gap: 10 }}>
            {sim.allRoutes.map((r) => (
              <div key={r.name} style={{ ...box({ background: r.on ? "#E6F7F4" : "#fff" }), padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 900, fontSize: 14 }}>
                  <span>{r.name}</span><span>{r.min} мин</span>
                </div>
                <div style={{ marginTop: 8 }}><Bar w={r.w} /></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {simTab === "day" && (
        <div style={{ marginTop: 16 }}>
          <div style={{ ...box(), padding: 16, boxShadow: hard() }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 900, letterSpacing: "0.14em" }}>ТАНЫ НЭГ ӨДӨР</p>
              <span style={{ fontSize: 22, fontWeight: 900 }}>{dv.hourLabel}</span>
            </div>
            <input type="range" min={0} max={23} value={simHour} onChange={(e) => setSimHour(+e.target.value)}
              style={{ width: "100%", marginTop: 10, accentColor: TEAL }} aria-label="Цагаа гүйлгэ" />
            <p style={{ margin: "4px 0 14px", fontSize: 13, fontWeight: 700 }}>{dv.activity}</p>
            <p style={{ margin: "0 0 4px", fontSize: 12, fontWeight: 900 }}>Нарны гэрэл · {dv.light}%</p>
            <Bar w={dv.light + "%"} />
            <p style={{ margin: "12px 0 4px", fontSize: 12, fontWeight: 900 }}>Дуу чимээ · {dv.db} dB</p>
            <Bar w={Math.min(100, (dv.db / 80) * 100) + "%"} bg={dv.db > 55 ? "#FFD7CF" : TEAL} />
          </div>
          <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
            {dv.events.map((e, i) => (
              <div key={i} style={{ ...box({ background: e.bg }), padding: 12, display: "flex", gap: 12 }}>
                <span style={{ fontWeight: 900, fontSize: 13, minWidth: 48 }}>{e.t}</span>
                <span><b style={{ fontSize: 13 }}>{e.title}</b><br /><span style={{ fontSize: 11, color: "#444" }}>{e.sub}</span></span>
              </div>
            ))}
          </div>
        </div>
      )}

      {simTab === "move" && (
        <div style={{ marginTop: 16 }}>
          <div style={{ ...box({ background: INK, color: "#fff" }), padding: 16, boxShadow: hard(TEAL) }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 900, letterSpacing: "0.14em", color: TEAL }}>НҮҮХ ӨДӨР БЭЛЭН БАЙХ МӨНГӨ</p>
            <p style={{ margin: "6px 0 0", fontSize: 40, fontWeight: 900, lineHeight: .95 }}>{sim.upfrontFmt}₮</p>
          </div>
          <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
            {sim.upfront.map((u) => (
              <div key={u.label} style={{ ...box(), padding: 12, display: "flex", justifyContent: "space-between" }}>
                <span><b style={{ fontSize: 14 }}>{u.label}</b><br /><span style={{ fontSize: 11, color: "#666" }}>{u.note}</span></span>
                <b style={{ fontSize: 14 }}>{u.fmt}₮</b>
              </div>
            ))}
          </div>
          <div style={{ ...box(), padding: 12, marginTop: 14 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 900 }}>Барьцаа буцаалт · {sim.depositRule}</p>
            <p style={{ margin: "6px 0 0", fontSize: 13 }}>{simMonths} сарын гэрээний нийт — {sim.contractFmt}₮</p>
          </div>
        </div>
      )}

      <Btn on onClick={() => { setSlot(null); setScreen("book"); }} style={{ width: "100%", marginTop: 20, padding: 16, fontSize: 15, boxShadow: hard() }}>
        Viewing захиалах
      </Btn>
    </Shell>
  );

  /* ═══ ЗАХИАЛАХ ═══ */
  if (screen === "book") {
    const taken = takenToday(days[day].iso);
    return (
      <Shell>
        <Btn onClick={() => setScreen("detail")} style={{ marginBottom: 14 }}>← Буцах</Btn>
        <h2 style={{ margin: 0, fontSize: 30, fontWeight: 900, textTransform: "uppercase", letterSpacing: "-0.02em", lineHeight: 1 }}>Viewing захиалах</h2>
        <p style={{ margin: "8px 0 0", fontSize: 13, color: "#555" }}>{curL.title} · {curL.location}</p>

        <p style={{ margin: "18px 0 8px", fontSize: 11, fontWeight: 900, letterSpacing: "0.14em" }}>ӨДӨР</p>
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
          {days.map((d, i) => (
            <button key={d.iso} onClick={() => { setDay(i); setSlot(null); }} style={{
              flexShrink: 0, minWidth: 58, minHeight: 58, border: `3px solid ${INK}`,
              background: day === i ? TEAL : "#fff", boxShadow: day === i ? hard() : "none",
              fontWeight: 900, cursor: "pointer", color: INK,
            }}>
              <span style={{ display: "block", fontSize: 10 }}>{d.wd}</span>
              <span style={{ display: "block", fontSize: 17 }}>{d.n}</span>
            </button>
          ))}
        </div>

        <p style={{ margin: "18px 0 8px", fontSize: 11, fontWeight: 900, letterSpacing: "0.14em" }}>ЦАГ</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
          {SLOTS.map((t) => {
            const dis = taken.includes(t);
            return <button key={t} disabled={dis} onClick={() => setSlot(t)} style={{
              border: `3px solid ${INK}`, background: slot === t ? TEAL : "#fff", color: INK,
              padding: "12px 4px", minHeight: 48, fontWeight: 900, fontSize: 13,
              opacity: dis ? .4 : 1, textDecoration: dis ? "line-through" : "none",
              boxShadow: slot === t ? hard() : "none", cursor: dis ? "not-allowed" : "pointer",
            }}>{t}</button>;
          })}
        </div>

        <p style={{ margin: "18px 0 8px", fontSize: 11, fontWeight: 900, letterSpacing: "0.14em" }}>ҮЗЭХ ХЭЛБЭР</p>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn on={mode === "in"} onClick={() => setMode("in")} style={{ flex: 1 }}>Биеэр очих</Btn>
          <Btn on={mode === "video"} onClick={() => setMode("video")} style={{ flex: 1 }}>Видео дуудлага</Btn>
        </div>

        <p style={{ margin: "18px 0 8px", fontSize: 11, fontWeight: 900, letterSpacing: "0.14em" }}>ХОЛБОО БАРИХ</p>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Таны нэр"
          style={{ ...box(), width: "100%", padding: "13px 14px", fontSize: 14, fontWeight: 700, outline: "none", marginBottom: 8 }} />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="Утасны дугаар"
          style={{ ...box(), width: "100%", padding: "13px 14px", fontSize: 14, fontWeight: 700, outline: "none" }} />

        {err && <p style={{ margin: "12px 0 0", fontSize: 13, fontWeight: 900, background: "#FFD7CF", border: `3px solid ${INK}`, padding: "8px 10px" }}>{err}</p>}

        <Btn on={!!slot} onClick={confirmBook} style={{ width: "100%", marginTop: 18, padding: 16, fontSize: 15, opacity: slot ? 1 : .45, boxShadow: slot ? hard() : "none" }}>
          {sending ? "Илгээж байна…" : slot ? `Баталгаажуулах · ${slot}` : "Цаг сонгоно уу"}
        </Btn>
      </Shell>
    );
  }

  /* ═══ БАТАЛГААЖЛАА ═══ */
  if (screen === "done") return (
    <div style={{ background: TEAL, minHeight: "100svh", display: "grid", placeContent: "center", textAlign: "center", padding: 24 }}>
      <div style={{ ...box({ background: "#fff" }), padding: 28, boxShadow: hard(), maxWidth: 400 }}>
        <h2 style={{ margin: 0, fontSize: 30, fontWeight: 900, textTransform: "uppercase", lineHeight: 1 }}>Viewing баталгаажлаа.</h2>
        <p style={{ margin: "14px 0 0", fontSize: 15, fontWeight: 700 }}>{curL.title}</p>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#555" }}>{curL.location}</p>
        <p style={{ margin: "14px 0 0", fontSize: 17, fontWeight: 900 }}>{days[day].label} · {slot}</p>
        <p style={{ margin: "4px 0 18px", fontSize: 13 }}>{mode === "in" ? "Биеэр очих" : "Видео дуудлага"}</p>
        <Btn on onClick={() => { void loadBookings(); setScreen("bookings"); }} style={{ width: "100%", marginBottom: 8 }}>Миний захиалга</Btn>
        <Btn onClick={() => setScreen("home")} style={{ width: "100%" }}>Нүүр рүү буцах</Btn>
      </div>
    </div>
  );

  /* ═══ ХАДГАЛСАН ═══ */
  if (screen === "saved") {
    const list = L.filter((l) => saved.includes(l.id));
    return (
      <Shell>
        <h2 style={{ margin: "0 0 16px", fontSize: 30, fontWeight: 900, textTransform: "uppercase", letterSpacing: "-0.02em" }}>Хадгалсан</h2>
        {list.length === 0 && <p style={{ fontSize: 14 }}>Хадгалсан байр алга. Зар дээрх зүрхийг дарж shortlist үүсгэ.</p>}
        <div style={{ display: "grid", gap: 12 }}>
          {list.map((l) => (
            <div key={l.id} onClick={() => { setCur(l.id); setScreen("detail"); }} style={{ ...box(), padding: 14, boxShadow: hard(), cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <b style={{ fontSize: 16 }}>{l.title}</b>
                <b style={{ fontSize: 15, whiteSpace: "nowrap" }}>{fmt(l.price)}₮</b>
              </div>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#555" }}>{l.location}</p>
              <p style={{ margin: "8px 0 0", fontSize: 12, fontWeight: 700 }}>
                Нийт / сар — {calc(l, simState).totalFmt}₮
              </p>
            </div>
          ))}
        </div>
      </Shell>
    );
  }

  /* ═══ ЗАХИАЛГА ═══ */
  return (
    <Shell>
      <h2 style={{ margin: "0 0 10px", fontSize: 30, fontWeight: 900, textTransform: "uppercase", letterSpacing: "-0.02em" }}>Захиалга</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="Утсаа оруулаад хайх"
          style={{ ...box(), flex: 1, padding: "12px 13px", fontSize: 14, fontWeight: 700, outline: "none" }} />
        <Btn on onClick={() => void loadBookings()}>Хайх</Btn>
      </div>
      {bookings.length === 0 && <p style={{ fontSize: 14 }}>Viewing захиалга алга.</p>}
      <div style={{ display: "grid", gap: 12 }}>
        {bookings.map((b) => (
          <div key={b.id} style={{ ...box(), padding: 14, boxShadow: hard() }}>
            <b style={{ fontSize: 16 }}>{b.title}</b>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#555" }}>{b.location}</p>
            <p style={{ margin: "10px 0 0", fontSize: 15, fontWeight: 900 }}>{b.day} · {b.slot}</p>
            <p style={{ margin: "2px 0 0", fontSize: 12 }}>{b.mode} · {b.status === "confirmed" ? "Баталгаажсан" : b.status === "cancelled" ? "Цуцлагдсан" : "Хүлээгдэж буй"}</p>
          </div>
        ))}
      </div>
    </Shell>
  );
}
