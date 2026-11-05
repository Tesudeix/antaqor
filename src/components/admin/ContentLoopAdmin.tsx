"use client";

import { useCallback, useEffect, useState } from "react";

/* ─── САЙЖРУУЛАХ ДАВТАЛТ — админ ────────────────────────────────────────
   Брэндийн цөм · хугацааны цонх · хаягийн задаргаа · тохиргоо ·
   хувилбарууд · ноорог дүгнүүлэх.

   Өнгийг шууд бичсэн шалтгаан: admin/kit-ийн `T` нь цагаан загварын
   утгуудтай хэвээр (text: #141414) атал `Card` нь хар дэвсгэртэй.
   Холивол бичиг нь уншигдахгүй болох эрсдэлтэй. */

const INK = "#14151C";
const SUB = "#565967";
const LINE = "rgba(255,255,255,0.12)";
const SURFACE = "#FFFFFF";
const TEAL = "#2E29FF";
const BAD = "#C81E4A";
const WARN = "#FBBF24";

interface Settings {
  enabled: boolean; tickMinutes: number; minGapMinutes: number; maxPerDay: number;
  minAgeHours: number; minEngagement: number; cooldownDays: number; sourceWindowDays: number;
  networks: string[]; rewriteStrength: "light" | "medium" | "rework"; requireApproval: boolean;
  lastTickAt: string | null; lastPostAt: string | null; lastNote: string;
}
interface BrandValue { name: string; meaning: string }
interface Brand {
  positioning: string; tagline: string; audience: string;
  values: BrandValue[]; avoid: string[]; enabled: boolean;
}
interface Metric {
  _id: string; platform: string; account: string; accountLabel: string;
  externalId: string; permalink: string; text: string; publishedAt?: string;
  views: number; likes: number; comments: number; shares: number;
  engagement: number; reuseCount: number;
}
interface AccountRow {
  account: string; label: string; platform: string;
  posts: number; engagement: number; views: number; best: number;
}
interface Variant {
  _id: string; sourcePlatform: string; sourceText: string; sourcePermalink: string;
  sourceEngagement: number; text: string; rationale: string; novelty: number;
  platforms: string[]; status: string; error: string; createdAt: string;
}
interface ReplyLog {
  _id: string; username: string; incoming: string; sent: string;
  status: string; action: string; note: string; error: string; at: string;
}
interface AutoReply {
  enabled: boolean; maxPerHour: number; killSwitch: boolean; log: ReplyLog[];
}
interface Issue { level: string; message: string }
interface Critique {
  score: number; brandFit: number; valuesHit: string[]; issues: Issue[];
  rewrite: string; rationale: string; benchmark: string; aiUsed: boolean;
}

const NETS = [
  { id: "threads", label: "Threads" },
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
];
const WINDOWS = [
  { id: "7", label: "7 хоног" },
  { id: "30", label: "30 хоног" },
  { id: "all", label: "Бүгд" },
];

const box: React.CSSProperties = { borderRadius: 4, border: `1px solid ${LINE}`, background: SURFACE };
const btn = (on: boolean): React.CSSProperties => ({
  minHeight: 38, padding: "0 14px", borderRadius: 4, fontSize: 12, fontWeight: 700,
  background: on ? TEAL : "transparent", color: on ? "#06222A" : INK,
  border: on ? "1px solid transparent" : `1px solid ${LINE}`, cursor: "pointer",
});
const input: React.CSSProperties = {
  width: "100%", height: 40, padding: "0 10px", borderRadius: 4, fontSize: 13,
  background: "#FFFFFF", color: INK, border: `1px solid ${LINE}`, outline: "none",
};
const area: React.CSSProperties = { ...input, height: "auto", padding: 10, lineHeight: 1.6 };

const ago = (d?: string | null) => {
  if (!d) return "—";
  const m = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return "дөнгөж сая";
  if (m < 60) return m + " мин";
  const h = Math.round(m / 60);
  return h < 48 ? h + " цаг" : Math.round(h / 24) + " хоног";
};
const label = (p: string) => NETS.find((n) => n.id === p)?.label || p;

export default function ContentLoopAdmin() {
  const [s, setS] = useState<Settings | null>(null);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [ar, setAr] = useState<AutoReply | null>(null);
  const [top, setTop] = useState<Metric[]>([]);
  const [byAccount, setByAccount] = useState<AccountRow[]>([]);
  const [totals, setTotals] = useState({ posts: 0, engagement: 0, views: 0 });
  const [variants, setVariants] = useState<Variant[]>([]);
  const [counts, setCounts] = useState({ pending: 0, today: 0 });
  const [win, setWin] = useState("30");
  const [acct, setAcct] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [showBrand, setShowBrand] = useState(false);

  const [draft, setDraft] = useState("");
  const [crit, setCrit] = useState<Critique | null>(null);

  const load = useCallback(async () => {
    const q = new URLSearchParams({ window: win });
    if (acct) q.set("account", acct);
    const r = await fetch("/api/admin/social/loop?" + q, { cache: "no-store" });
    if (!r.ok) return;
    const d = await r.json();
    setS(d.settings); setBrand(d.brand); setAr(d.autoReply || null);
    setTop(d.top || []); setByAccount(d.byAccount || []);
    setTotals(d.totals || { posts: 0, engagement: 0, views: 0 });
    setVariants(d.variants || []);
    setCounts(d.counts || { pending: 0, today: 0 });
  }, [win, acct]);
  useEffect(() => { void load(); }, [load]);

  async function patch(p: Partial<Settings>) {
    setS((x) => (x ? { ...x, ...p } : x));
    await fetch("/api/admin/social/loop", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p),
    });
    await load();
  }

  async function patchAR(p: Partial<AutoReply>) {
    setAr((x) => (x ? { ...x, ...p } : x));
    await fetch("/api/admin/social/loop", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autoReply: p }),
    });
    await load();
  }

  async function saveBrand(b: Brand) {
    setBrand(b);
    await fetch("/api/admin/social/brand", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b),
    });
  }

  async function runNow() {
    setBusy("run"); setMsg("");
    try {
      const r = await fetch("/api/admin/social/loop", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
      });
      const d = await r.json();
      setMsg(d.note || d.error || "Дууслаа");
      await load();
    } finally { setBusy(""); }
  }

  async function act(id: string, action: string, extra: Record<string, unknown> = {}) {
    setBusy(id);
    try {
      const r = await fetch("/api/admin/social/loop/variants", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, ...extra }),
      });
      const d = await r.json();
      if (d.error) setMsg(d.error);
      await load();
    } finally { setBusy(""); }
  }

  async function critique() {
    if (!draft.trim()) return;
    setBusy("crit"); setCrit(null);
    try {
      const r = await fetch("/api/admin/social/critique", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: draft }),
      });
      const d = await r.json();
      if (d.error) setMsg(d.error); else setCrit(d);
    } finally { setBusy(""); }
  }

  if (!s || !brand) {
    return <div className="flex min-h-[40vh] items-center justify-center">
      <div className="h-2 w-2 animate-pulse rounded-full" style={{ background: TEAL }} />
    </div>;
  }

  const num = (lbl: string, key: keyof Settings, hint: string) => (
    <label className="block">
      <span className="block text-[11px] font-bold uppercase" style={{ color: SUB, letterSpacing: ".1em" }}>{lbl}</span>
      <input type="number" value={String(s[key])} style={{ ...input, marginTop: 6 }}
        onChange={(e) => setS({ ...s, [key]: Number(e.target.value) } as Settings)}
        onBlur={(e) => void patch({ [key]: Number(e.target.value) } as Partial<Settings>)} />
      <span className="mt-1 block text-[11px]" style={{ color: SUB }}>{hint}</span>
    </label>
  );

  const pending = variants.filter((v) => v.status === "pending");
  const history = variants.filter((v) => v.status !== "pending");
  const accounts = Array.from(new Map(byAccount.map((a) => [a.account, a])).values());

  return (
    <div className="mx-auto w-full max-w-[920px] pb-20">
      <p className="text-[11px] font-bold uppercase" style={{ color: TEAL, letterSpacing: ".16em" }}>Social</p>
      <h1 className="mt-1.5 text-[26px] font-extrabold" style={{ color: INK }}>Сайжруулах давталт</h1>
      <p className="mt-2 text-[13px] leading-[1.7]" style={{ color: SUB }}>
        Бүх хаягийн үзүүлэлтийг хэмжиж, хамгийн сайн явсан постыг брэндийн
        байр суурийн дагуу шинээр бичиж дахин нийтэлнэ.
      </p>

      {msg && <p className="mt-4 p-3 text-[12px]" style={{ ...box, borderColor: `${TEAL}66`, color: INK }}>{msg}</p>}

      {/* ── Брэндийн цөм ── */}
      <div className="mt-5 p-4" style={{ ...box, borderColor: `${TEAL}44` }}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase" style={{ color: TEAL, letterSpacing: ".12em" }}>
              Personal brand
            </p>
            <p className="mt-1.5 text-[16px] font-extrabold leading-[1.3]" style={{ color: INK }}>
              {brand.positioning || "Байр суурь бичигдээгүй"}
            </p>
            {brand.tagline && <p className="mt-1 text-[13px]" style={{ color: TEAL }}>{brand.tagline}</p>}
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {brand.values.map((v) => (
                <span key={v.name} className="px-2 py-1 text-[11px] font-bold"
                  style={{ border: `1px solid ${LINE}`, borderRadius: 2, color: SUB }}>{v.name}</span>
              ))}
            </div>
          </div>
          <button onClick={() => setShowBrand(!showBrand)} style={{ ...btn(false), flex: "none" }}>
            {showBrand ? "Хаах" : "Засах"}
          </button>
        </div>

        {showBrand && (
          <div className="mt-4 grid gap-3.5 border-t pt-4" style={{ borderColor: LINE }}>
            <label className="block">
              <span className="text-[11px] font-bold uppercase" style={{ color: SUB, letterSpacing: ".1em" }}>Байр суурь</span>
              <input value={brand.positioning} style={{ ...input, marginTop: 6 }}
                onChange={(e) => setBrand({ ...brand, positioning: e.target.value })}
                onBlur={() => void saveBrand(brand)} />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold uppercase" style={{ color: SUB, letterSpacing: ".1em" }}>Уриа</span>
              <input value={brand.tagline} style={{ ...input, marginTop: 6 }}
                onChange={(e) => setBrand({ ...brand, tagline: e.target.value })}
                onBlur={() => void saveBrand(brand)} />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold uppercase" style={{ color: SUB, letterSpacing: ".1em" }}>Хэнд хандаж байна</span>
              <textarea value={brand.audience} rows={2} style={{ ...area, marginTop: 6 }}
                onChange={(e) => setBrand({ ...brand, audience: e.target.value })}
                onBlur={() => void saveBrand(brand)} />
            </label>

            <div>
              <p className="text-[11px] font-bold uppercase" style={{ color: SUB, letterSpacing: ".1em" }}>
                Үнэт зүйлс
              </p>
              <p className="mt-1 text-[11px] leading-[1.6]" style={{ color: SUB }}>
                Утга нь чухал: «Playful бай» гэдэг AI-д юу ч хэлэхгүй, «хүнд
                сэдвийг ч хөнгөн авна» гэдэг нь бичих заавар болно.
              </p>
              <div className="mt-2.5 grid gap-2.5">
                {brand.values.map((v, i) => (
                  <div key={i} className="grid gap-1.5 p-2.5" style={{ ...box, background: "#F8F9FD" }}>
                    <input value={v.name} placeholder="Нэр" style={{ ...input, height: 34, fontWeight: 700 }}
                      onChange={(e) => {
                        const vs = [...brand.values]; vs[i] = { ...v, name: e.target.value };
                        setBrand({ ...brand, values: vs });
                      }}
                      onBlur={() => void saveBrand(brand)} />
                    <textarea value={v.meaning} rows={2} placeholder="Постод хэрхэн илрэх ёстой вэ"
                      style={{ ...area, fontSize: 12 }}
                      onChange={(e) => {
                        const vs = [...brand.values]; vs[i] = { ...v, meaning: e.target.value };
                        setBrand({ ...brand, values: vs });
                      }}
                      onBlur={() => void saveBrand(brand)} />
                    <button className="justify-self-start" style={{ ...btn(false), minHeight: 30, fontSize: 11 }}
                      onClick={() => void saveBrand({ ...brand, values: brand.values.filter((_, j) => j !== i) })}>
                      Хасах
                    </button>
                  </div>
                ))}
              </div>
              {brand.values.length < 10 && (
                <button className="mt-2.5" style={btn(false)}
                  onClick={() => setBrand({ ...brand, values: [...brand.values, { name: "", meaning: "" }] })}>
                  + Үнэт зүйл нэмэх
                </button>
              )}
            </div>

            <label className="block">
              <span className="text-[11px] font-bold uppercase" style={{ color: SUB, letterSpacing: ".1em" }}>
                Хэзээ ч бичихгүй (мөр тус бүрт нэг)
              </span>
              <textarea value={brand.avoid.join("\n")} rows={4} style={{ ...area, marginTop: 6, fontSize: 12 }}
                onChange={(e) => setBrand({ ...brand, avoid: e.target.value.split("\n") })}
                onBlur={() => void saveBrand({ ...brand, avoid: brand.avoid.filter((x) => x.trim()) })} />
            </label>
          </div>
        )}
      </div>

      {/* ── Хугацааны цонх ── */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <div className="inline-flex overflow-hidden" style={{ border: `1px solid ${LINE}`, borderRadius: 4 }}>
          {WINDOWS.map((w) => (
            <button key={w.id} onClick={() => setWin(w.id)} aria-pressed={win === w.id}
              style={{
                height: 36, padding: "0 14px", fontSize: 12, fontWeight: 700, border: 0, cursor: "pointer",
                background: win === w.id ? TEAL : "transparent", color: win === w.id ? "#06222A" : SUB,
              }}>{w.label}</button>
          ))}
        </div>
        {accounts.length > 1 && (
          <select value={acct} onChange={(e) => setAcct(e.target.value)}
            style={{ ...input, width: "auto", height: 36, fontSize: 12 }}>
            <option value="">Бүх хаяг</option>
            {accounts.map((a) => <option key={a.account} value={a.account}>{a.label}</option>)}
          </select>
        )}
        <button onClick={() => void runNow()} disabled={busy === "run"} style={btn(false)}>
          {busy === "run" ? "Ажиллаж байна…" : "Одоо шинэчлэх"}
        </button>
      </div>

      {/* ── Нийт үзүүлэлт ── */}
      <div className="mt-3 grid gap-2.5 sm:grid-cols-4">
        {[
          { k: "Пост", v: String(totals.posts), c: INK },
          { k: "Нийт оролцоо", v: String(totals.engagement), c: TEAL },
          { k: "Нийт хүрэлт", v: String(totals.views), c: INK },
          { k: "Шийдвэр хүлээж буй", v: String(counts.pending), c: counts.pending ? WARN : INK },
        ].map((x) => (
          <div key={x.k} className="p-3.5" style={box}>
            <p className="text-[10.5px] font-bold uppercase" style={{ color: SUB, letterSpacing: ".1em" }}>{x.k}</p>
            <p className="mt-1 text-[18px] font-extrabold tabular-nums" style={{ color: x.c }}>{x.v}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11.5px]" style={{ color: SUB }}>
        Давталт: {s.enabled ? "асаалттай" : "унтраалттай"} · өнөөдөр {counts.today}/{s.maxPerDay} нийтэлсэн ·
        сүүлд үнэлсэн {ago(s.lastTickAt)}{s.lastNote ? ` · ${s.lastNote}` : ""}
      </p>

      {/* ── Хаягийн задаргаа ── */}
      {byAccount.length > 0 && (
        <>
          <h2 className="mt-8 text-[11px] font-bold uppercase" style={{ color: SUB, letterSpacing: ".14em" }}>
            Хаягаар
          </h2>
          <div className="mt-2.5 overflow-x-auto" style={box}>
            <table className="w-full text-[12px]" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ color: SUB }}>
                  {["Хаяг", "Суваг", "Пост", "Оролцоо", "Хүрэлт", "Дээд"].map((h, i) => (
                    <th key={h} className="p-2.5 text-[10.5px] font-bold uppercase"
                      style={{ textAlign: i < 2 ? "left" : "right", letterSpacing: ".08em", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {byAccount.map((a, i) => (
                  <tr key={a.account + a.platform} style={{ borderTop: `1px solid ${LINE}` }}>
                    <td className="p-2.5 font-bold" style={{ color: INK, whiteSpace: "nowrap" }}>{a.label}</td>
                    <td className="p-2.5" style={{ color: SUB }}>{label(a.platform)}</td>
                    <td className="p-2.5 tabular-nums" style={{ color: SUB, textAlign: "right" }}>{a.posts}</td>
                    <td className="p-2.5 font-bold tabular-nums" style={{ color: TEAL, textAlign: "right" }}>{a.engagement}</td>
                    <td className="p-2.5 tabular-nums" style={{ color: SUB, textAlign: "right" }}>{a.views || "—"}</td>
                    <td className="p-2.5 tabular-nums" style={{ color: SUB, textAlign: "right" }}>{a.best}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Шийдвэр хүлээж буй ── */}
      {pending.length > 0 && (
        <>
          <h2 className="mt-8 text-[11px] font-bold uppercase" style={{ color: WARN, letterSpacing: ".14em" }}>
            Шийдвэр хүлээж байна ({pending.length})
          </h2>
          <div className="mt-2.5 grid gap-2.5">
            {pending.map((v) => (
              <div key={v._id} className="p-4" style={{ ...box, borderColor: `${WARN}55` }}>
                <div className="flex flex-wrap items-center gap-2 text-[11px]" style={{ color: SUB }}>
                  <span>эх: {label(v.sourcePlatform)} · {v.sourceEngagement} оролцоо</span>
                  <span style={{ color: v.novelty < 0.5 ? BAD : TEAL }}>шинэлэг {Math.round(v.novelty * 100)}%</span>
                  {v.novelty < 0.5 && <span style={{ color: BAD }}>— эхтэйгээ хэт ойрхон</span>}
                </div>
                <textarea value={v.text} rows={6}
                  onChange={(e) => setVariants((xs) => xs.map((x) => x._id === v._id ? { ...x, text: e.target.value } : x))}
                  onBlur={(e) => void act(v._id, "edit", { text: e.target.value })}
                  className="mt-2.5 w-full resize-y" style={{ ...area }} />
                {v.rationale && <p className="mt-2 text-[11.5px]" style={{ color: SUB }}>AI: {v.rationale}</p>}
                <details className="mt-2">
                  <summary className="cursor-pointer text-[11.5px]" style={{ color: SUB }}>Эх постыг харах</summary>
                  <p className="mt-1.5 whitespace-pre-wrap text-[12px] leading-[1.6]" style={{ color: SUB }}>{v.sourceText}</p>
                </details>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => void act(v._id, "publish")} disabled={busy === v._id} style={btn(true)}>
                    {busy === v._id ? "…" : `Нийтлэх (${v.platforms.map(label).join(", ")})`}
                  </button>
                  <button onClick={() => void act(v._id, "reject")} disabled={busy === v._id} style={btn(false)}>
                    Татгалзах
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Хамгийн сайн ── */}
      <h2 className="mt-8 text-[11px] font-bold uppercase" style={{ color: SUB, letterSpacing: ".14em" }}>
        Хамгийн сайн явсан · {WINDOWS.find((w) => w.id === win)?.label}
      </h2>
      {top.length === 0 ? (
        <p className="mt-2.5 p-4 text-[12.5px]" style={{ ...box, color: SUB }}>
          Энэ цонхонд хэмжилт алга. «Одоо шинэчлэх» дарвал сувгуудаас татна.
        </p>
      ) : (
        <div className="mt-2.5" style={box}>
          {top.map((m, i) => (
            <div key={m._id} className="p-3.5" style={{ borderTop: i ? `1px solid ${LINE}` : "none" }}>
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 flex-1 line-clamp-2 text-[12.5px] leading-[1.6]" style={{ color: INK }}>
                  {m.text || <span style={{ color: SUB }}>(текстгүй)</span>}
                </p>
                <span className="flex-none text-[15px] font-extrabold tabular-nums" style={{ color: TEAL }}>{m.engagement}</span>
              </div>
              <p className="mt-1.5 text-[11px]" style={{ color: SUB }}>
                {m.accountLabel || label(m.platform)} · {label(m.platform)} · {m.likes} лайк · {m.comments} сэтгэгдэл
                {m.shares ? ` · ${m.shares} хуваалцсан` : ""}
                {m.views ? ` · ${m.views} хүрэлт` : ""}
                {m.reuseCount ? ` · ${m.reuseCount}× ашигласан` : ""}
                {m.permalink && <> · <a href={m.permalink} target="_blank" rel="noreferrer" style={{ color: TEAL }}>нээх</a></>}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* ── Тохиргоо ── */}
      <h2 className="mt-8 text-[11px] font-bold uppercase" style={{ color: SUB, letterSpacing: ".14em" }}>Тохиргоо</h2>
      <div className="mt-2.5 p-4" style={box}>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => void patch({ enabled: !s.enabled })} style={btn(s.enabled)}>
            {s.enabled ? "✓ Асаалттай" : "Унтраалттай"}
          </button>
          <button onClick={() => void patch({ requireApproval: !s.requireApproval })} style={btn(s.requireApproval)}>
            {s.requireApproval ? "✓ Хүн баталдаг" : "Шууд нийтэлдэг"}
          </button>
        </div>
        {!s.requireApproval && (
          <p className="mt-2.5 text-[11.5px] leading-[1.6]" style={{ color: WARN }}>
            Хүний баталгаажуулалтгүйгээр брэндийн нэрээр нийтлэгдэнэ. Нийтэлсэн постыг буцааж болохгүй.
          </p>
        )}

        <div className="mt-4 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {num("Үнэлэх давтамж", "tickMinutes", "минут тутам шалгана")}
          {num("Нийтлэлтийн доод зай", "minGapMinutes", "хоёр постын хоорондох минут")}
          {num("Өдрийн хязгаар", "maxPerDay", "өдөрт хамгийн ихдээ")}
          {num("Эхийн доод нас", "minAgeHours", "цагаас залуу постыг авахгүй")}
          {num("Эх хайх цонх", "sourceWindowDays", "хоногийн дотроос л эх сонгоно")}
          {num("Доод оролцоо", "minEngagement", "үүнээс бага бол сонгохгүй")}
          {num("Дахин ашиглах хүлээлт", "cooldownDays", "нэг эхийг дахин авах хүртэл хоног")}
        </div>

        <div className="mt-4">
          <p className="text-[11px] font-bold uppercase" style={{ color: SUB, letterSpacing: ".1em" }}>Нийтлэх сувгууд</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {NETS.map((n) => {
              const on = s.networks.includes(n.id);
              return (
                <button key={n.id} style={btn(on)}
                  onClick={() => {
                    const next = on ? s.networks.filter((x) => x !== n.id) : [...s.networks, n.id];
                    if (next.length) void patch({ networks: next });
                  }}>{on ? "✓ " : ""}{n.label}</button>
              );
            })}
          </div>
        </div>

        <div className="mt-4">
          <p className="text-[11px] font-bold uppercase" style={{ color: SUB, letterSpacing: ".1em" }}>Дахин бичих хүч</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {([["light", "Зөөлөн"], ["medium", "Дунд"], ["rework", "Шинээр"]] as const).map(([v, l]) => (
              <button key={v} style={btn(s.rewriteStrength === v)} onClick={() => void patch({ rewriteStrength: v })}>{l}</button>
            ))}
          </div>
          <p className="mt-2 text-[11.5px] leading-[1.6]" style={{ color: SUB }}>
            «Зөөлөн» нь эх текстэд хамгийн ойр — Meta болон Threads давхардсан
            контентыг барьдаг тул хамгийн эрсдэлтэй нь ч тэр.
          </p>
        </div>
      </div>

      {/* ── AI авто хариулт ── */}
      {ar && (
        <>
          <h2 className="mt-8 text-[11px] font-bold uppercase" style={{ color: SUB, letterSpacing: ".14em" }}>
            AI авто хариулт · Threads
          </h2>
          <div className="mt-2.5 p-4" style={box}>
            <p className="text-[12.5px] leading-[1.7]" style={{ color: SUB }}>
              Ирсэн хариултыг уншаад чиний хоолойгоор хариулна. Түлхүүр үгийн
              дүрмүүд нь тэргүүлэх эрхтэй хэвээр — AI нь зөвхөн ямар ч дүрэмд
              таараагүйг барина.
            </p>

            <div className="mt-3.5 flex flex-wrap items-center gap-2">
              <button onClick={() => void patchAR({ enabled: !ar.enabled })} style={btn(ar.enabled)}>
                {ar.enabled ? "✓ Асаалттай" : "Унтраалттай"}
              </button>
              <button onClick={() => void patchAR({ killSwitch: !ar.killSwitch })}
                style={{ ...btn(false), borderColor: ar.killSwitch ? BAD : LINE, color: ar.killSwitch ? BAD : INK }}>
                {ar.killSwitch ? "⛔ Бүх автоматжуулалт зогссон" : "Бүгдийг зогсоох"}
              </button>
              <label className="flex items-center gap-2 text-[12px]" style={{ color: SUB }}>
                Цагт дээд тал нь
                <input type="number" value={String(ar.maxPerHour)}
                  style={{ ...input, width: 70, height: 36 }}
                  onChange={(e) => setAr({ ...ar, maxPerHour: Number(e.target.value) })}
                  onBlur={(e) => void patchAR({ maxPerHour: Number(e.target.value) })} />
              </label>
            </div>

            <p className="mt-3 text-[11.5px] leading-[1.7]" style={{ color: SUB }}>
              Үнэ, гомдол, дайсагнал, баримт шаардсан асуултад AI
              <strong style={{ color: INK }}> хариулахгүй</strong> — тэднийг чамд
              үлдээж, доорх жагсаалтад шалтгаантай нь бүртгэнэ. Хариулт дотор
              холбоос, өөр хүний хаяг хэзээ ч гарахгүй.
            </p>

            {ar.log.length === 0 ? (
              <p className="mt-3.5 text-[12px]" style={{ color: SUB }}>
                Хараахан AI хариулт алга. Асаасны дараа 5 минут тутам шалгана.
              </p>
            ) : (
              <div className="mt-3.5 grid gap-2">
                {ar.log.map((r) => (
                  <div key={r._id} className="p-3" style={{ ...box, background: "#F8F9FD" }}>
                    <div className="flex flex-wrap items-center gap-2 text-[11px]" style={{ color: SUB }}>
                      <span style={{ color: INK, fontWeight: 700 }}>@{r.username || "?"}</span>
                      <span style={{
                        color: r.status === "sent" ? TEAL : r.status === "error" ? BAD : WARN,
                        fontWeight: 700,
                      }}>
                        {r.status === "sent" ? "хариулсан" : r.status === "error" ? "алдаа" : "хүнд үлдээв"}
                      </span>
                      <span>{ago(r.at)}</span>
                    </div>
                    <p className="mt-1.5 text-[12px] leading-[1.6]" style={{ color: SUB }}>
                      ← {r.incoming.slice(0, 180)}
                    </p>
                    {r.sent && (
                      <p className="mt-1 text-[12.5px] leading-[1.6]" style={{ color: INK }}>→ {r.sent}</p>
                    )}
                    {(r.note || r.error) && (
                      <p className="mt-1 text-[11px]" style={{ color: r.error ? "#FF9DB4" : SUB }}>
                        {r.error || r.note}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Ноорог дүгнүүлэх ── */}
      <h2 className="mt-8 text-[11px] font-bold uppercase" style={{ color: SUB, letterSpacing: ".14em" }}>
        Ноорогоо дүгнүүлэх
      </h2>
      <div className="mt-2.5 p-4" style={box}>
        <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={6}
          placeholder="Бичсэн постоо энд тавь — дүрмийн шалгалт, брэндийн нийцэл, сайжруулсан хувилбар."
          className="w-full resize-y" style={area} />
        <div className="mt-3 flex items-center gap-2">
          <button onClick={() => void critique()} disabled={busy === "crit" || !draft.trim()} style={btn(true)}>
            {busy === "crit" ? "Дүгнэж байна…" : "Дүгнэх"}
          </button>
          <span className="text-[11.5px] tabular-nums" style={{ color: draft.length > 500 ? BAD : SUB }}>
            {draft.length} / 500
          </span>
        </div>

        {crit && (
          <div className="mt-4 border-t pt-4" style={{ borderColor: LINE }}>
            <div className="flex flex-wrap items-center gap-5">
              {[
                { l: "Чанар", v: crit.score },
                { l: "Брэндийн нийцэл", v: crit.brandFit },
              ].map((x) => (
                <div key={x.l}>
                  <p className="text-[10.5px] font-bold uppercase" style={{ color: SUB, letterSpacing: ".1em" }}>{x.l}</p>
                  <p className="text-[24px] font-extrabold tabular-nums"
                    style={{ color: x.v >= 70 ? TEAL : x.v >= 40 ? WARN : BAD }}>{x.v}</p>
                </div>
              ))}
              {crit.valuesHit.length > 0 && (
                <div className="min-w-0">
                  <p className="text-[10.5px] font-bold uppercase" style={{ color: SUB, letterSpacing: ".1em" }}>Тээж байгаа</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {crit.valuesHit.map((v) => (
                      <span key={v} className="px-2 py-0.5 text-[11px] font-bold"
                        style={{ border: `1px solid ${TEAL}66`, borderRadius: 2, color: TEAL }}>{v}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <p className="mt-2 text-[11.5px]" style={{ color: SUB }}>
              {crit.benchmark}{!crit.aiUsed && " · AI хариу өгөөгүй"}
            </p>

            {crit.issues.length > 0 && (
              <ul className="mt-3 grid gap-1.5">
                {crit.issues.map((it, i) => (
                  <li key={i} className="text-[12px] leading-[1.6]"
                    style={{ color: it.level === "bad" ? "#FF9DB4" : it.level === "warn" ? WARN : SUB }}>· {it.message}</li>
                ))}
              </ul>
            )}

            {crit.rewrite && (
              <>
                <p className="mt-4 text-[11px] font-bold uppercase" style={{ color: SUB, letterSpacing: ".1em" }}>
                  Сайжруулсан хувилбар
                </p>
                <p className="mt-1.5 whitespace-pre-wrap p-3 text-[13px] leading-[1.7]"
                  style={{ ...box, background: "#F8F9FD", color: INK }}>{crit.rewrite}</p>
                {crit.rationale && <p className="mt-1.5 text-[11.5px]" style={{ color: SUB }}>{crit.rationale}</p>}
                <button className="mt-2.5" style={btn(false)} onClick={() => { setDraft(crit.rewrite); setCrit(null); }}>
                  Үүнийг авах
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Түүх ── */}
      {history.length > 0 && (
        <>
          <h2 className="mt-8 text-[11px] font-bold uppercase" style={{ color: SUB, letterSpacing: ".14em" }}>Түүх</h2>
          <div className="mt-2.5" style={box}>
            {history.slice(0, 10).map((v, i) => (
              <div key={v._id} className="flex items-start gap-3 p-3" style={{ borderTop: i ? `1px solid ${LINE}` : "none" }}>
                <span className="flex-none text-[11px] font-bold"
                  style={{ color: v.status === "published" ? TEAL : v.status === "failed" ? BAD : SUB, minWidth: 74 }}>
                  {v.status === "published" ? "нийтэлсэн" : v.status === "rejected" ? "татгалзсан" : v.status}
                </span>
                <p className="min-w-0 flex-1 truncate text-[12px]" style={{ color: SUB }}>{v.text}</p>
                <span className="flex-none text-[11px]" style={{ color: SUB }}>{ago(v.createdAt)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
