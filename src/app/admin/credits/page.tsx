"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Btn, Card, Metric, SectionHeader, Skeleton, T } from "@/components/admin/kit";

/* ─── Кредит · Удирдлага (2026-10-28) ────────────────────────────────────────
   1) Хүн хайгаад нэг товшилтоор кредит олгох (mongo id хуулах шаардлагагүй)
   2) Бүх гишүүний зарцуулалт: үлдэгдэл, нийт/30 хоногийн зардал, сүүлийн үйлдэл
   3) Мөр дарахад тухайн хүний гүйлгээ, юунд зарцуулсан нь задарна           */

type Summary = { circulating: number; lifetime: number; activeUsers: number; earned: number; spent: number; earned30d: number; spent30d: number };
type Reason = { _id: { reason: string; kind: "earn" | "spend" }; total: number; count: number };
type Tx = { _id: string; kind: "earn" | "spend"; amount: number; reason: string; balanceAfter: number; createdAt: string; meta?: { note?: string }; user?: { _id: string; name: string } | null };
type Found = { _id: string; name: string; username?: string; email?: string; phone?: string; plan?: string; credits?: number };
type Row = { _id: string; name: string; username?: string; email?: string; phone?: string; plan?: string; credits: number; spent: number; spent30: number; earned: number; lastAt: string };
type Feature = { _id: string; total: number; count: number; users: number };

const LABEL: Record<string, string> = {
  SIGNUP_BONUS: "Бүртгэлийн бэлэг", MEMBERSHIP_BONUS: "Гишүүнчлэлийн бэлэг", ADMIN_ADJUST: "Админ олгосон", ADMIN_RESET: "Админ тэглэсэн",
  REFERRAL_SIGNUP: "Урилга · бүртгэл", REFERRAL_PAID: "Урилга · төлсөн", PURCHASE: "Худалдан авсан", AI_STUDIO: "AI Studio",
  SHARE_POST: "Пост хуваалцсан", POST_CREATE: "Пост", LIKE_RECEIVED: "Лайк", DAILY_LOGIN: "Өдөр тутмын нэвтрэлт", REDEEM_MEMBERSHIP: "Гишүүнчлэл солих",
};
const lbl = (r: string) => LABEL[r] || r;
const PRESETS = [500, 1000, 4500, 15000, 30000];
const SORTS: [string, string][] = [["spent30", "30 хоногийн зардал"], ["spent", "Нийт зардал"], ["credits", "Үлдэгдэл"], ["recent", "Сүүлд идэвхтэй"]];

const field: React.CSSProperties = { width: "100%", borderRadius: 8, border: `1px solid ${T.border}`, background: "#FFFFFF", color: T.text, padding: "10px 12px", fontSize: 14, outline: "none", fontVariantNumeric: "tabular-nums" };
const th: React.CSSProperties = { textAlign: "left", padding: "10px 12px", fontSize: 11.5, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: T.faint, borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "10px 12px", fontSize: 14, borderBottom: `1px solid ${T.border}`, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
const n = (v: number) => Math.round(v || 0).toLocaleString("en-US");
const ago = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 60 ? `${m} мин` : m < 1440 ? `${Math.round(m / 60)} цаг` : `${Math.round(m / 1440)} өдөр`;
};
const who = (u: { name?: string; username?: string; email?: string; phone?: string }) => u.name || u.username || u.email || u.phone || "—";

export default function AdminCreditsPage() {
  const [sum, setSum] = useState<Summary | null>(null);
  const [reasons, setReasons] = useState<Reason[]>([]);
  const [recent, setRecent] = useState<Tx[]>([]);
  const [flash, setFlash] = useState("");

  // олголт
  const [fq, setFq] = useState("");
  const [found, setFound] = useState<Found[]>([]);
  const [pick, setPick] = useState<Found | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const findT = useRef<ReturnType<typeof setTimeout> | null>(null);

  // гишүүдийн хүснэгт
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("spent30");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [meta, setMeta] = useState({ total: 0, spent: 0, spent30: 0, balance: 0 });
  const [feature, setFeature] = useState<Feature[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ user: Found; byReason: Reason[]; tx: Tx[] } | null>(null);

  const loadSummary = useCallback(async () => {
    const r = await fetch("/api/admin/credits", { cache: "no-store" });
    if (!r.ok) return;
    const d = await r.json();
    setSum(d.summary); setReasons(d.reasonBreakdown || []); setRecent(d.recentTx || []);
  }, []);

  const loadRows = useCallback(async () => {
    const r = await fetch(`/api/admin/credits/members?q=${encodeURIComponent(q)}&sort=${sort}&page=${page}`, { cache: "no-store" });
    if (!r.ok) { setRows([]); return; }
    const d = await r.json();
    setRows(d.rows); setMeta(d.meta); setFeature(d.feature || []);
  }, [q, sort, page]);

  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => { const t = setTimeout(loadRows, q ? 250 : 0); return () => clearTimeout(t); }, [loadRows, q]);

  useEffect(() => {
    if (findT.current) clearTimeout(findT.current);
    if (pick || fq.trim().length < 2) { setFound([]); return; }
    findT.current = setTimeout(async () => {
      const r = await fetch(`/api/admin/credits/members?find=${encodeURIComponent(fq.trim())}`);
      if (r.ok) setFound((await r.json()).users || []);
    }, 250);
  }, [fq, pick]);

  async function toggle(id: string) {
    if (open === id) { setOpen(null); setDetail(null); return; }
    setOpen(id); setDetail(null);
    const r = await fetch(`/api/admin/credits/members?id=${id}`, { cache: "no-store" });
    if (r.ok) setDetail(await r.json());
  }

  async function grant(userId: string, amt: number, why?: string) {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/credits", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, amount: amt, note: why || undefined }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Алдаа");
      setFlash(`✓ ${amt > 0 ? "+" : ""}${n(amt)} кр — шинэ үлдэгдэл ${n(d.balance)} кр`);
      setPick(null); setFq(""); setAmount(""); setNote("");
      loadSummary(); loadRows();
      if (open === userId) { setOpen(null); setDetail(null); }
    } catch (e) { setFlash("Алдаа: " + (e as Error).message); } finally { setBusy(false); setTimeout(() => setFlash(""), 5000); }
  }

  if (!sum) return <div className="mx-auto max-w-6xl space-y-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-40" />)}</div>;
  const pages = Math.max(1, Math.ceil(meta.total / 25));
  const amt = Number(amount);

  return (
    <div className="mx-auto max-w-6xl pb-24">
      {flash && <div className="fixed right-4 top-4 z-50 rounded-lg px-4 py-2.5 text-[13px] font-bold shadow-xl" style={{ background: "#fff", border: `1px solid ${T.border}`, color: T.text }}>{flash}</div>}

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-tight" style={{ color: T.text }}>Кредит · Удирдлага</h1>
          <p className="mt-1 text-[14px]" style={{ color: T.muted }}>Кредит олгох, бүх гишүүний зарцуулалтыг нэг дороос хянах. 1 кр = 1₮.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/economics" className="rounded-lg px-4 py-2 text-[13px] font-bold" style={{ border: `1px solid ${T.border}`, color: T.text }}>Ашиг · тооцоо</Link>
          <Link href="/admin/payments" className="rounded-lg px-4 py-2 text-[13px] font-bold" style={{ border: `1px solid ${T.border}`, color: T.text }}>Төлбөр</Link>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Эргэлтэнд (үлдэгдэл)" value={`${n(sum.circulating)} кр`} sub={`${n(sum.activeUsers)} бүртгэлтэй`} />
        <Metric label="Нийт олгосон" value={`${n(sum.earned)} кр`} sub={`30 хоногт ${n(sum.earned30d)}`} />
        <Metric label="Нийт зарцуулсан" value={`${n(sum.spent)} кр`} sub={`30 хоногт ${n(sum.spent30d)}`} />
        <Metric label="Зарцуулсан гишүүн" value={n(meta.total)} sub="гүйлгээтэй хүн" />
      </div>

      {/* ── Олгох ── */}
      <SectionHeader title="Кредит олгох" hint="нэр, username, утас, имэйлээр хайна" />
      <Card className="mb-8 p-5">
        {!pick ? (
          <div className="relative">
            <input style={field} placeholder="Хүнээ хайх… (жишээ: 9464, antaqor)" value={fq} onChange={(e) => setFq(e.target.value)} />
            {found.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg shadow-xl" style={{ background: "#fff", border: `1px solid ${T.border}` }}>
                {found.map((u) => (
                  <button key={u._id} type="button" onClick={() => { setPick(u); setFound([]); }} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-black/5">
                    <span className="min-w-0"><b style={{ color: T.text }}>{who(u)}</b><span className="ml-2 text-[12px]" style={{ color: T.faint }}>{[u.username && "@" + u.username, u.phone, u.plan && u.plan !== "free" ? u.plan : ""].filter(Boolean).join(" · ")}</span></span>
                    <span className="text-[13px] font-bold tabular-nums" style={{ color: T.muted }}>{n(u.credits || 0)} кр</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2.5" style={{ background: "rgba(46,41,255,0.06)" }}>
              <span><b style={{ color: T.text }}>{who(pick)}</b> <span className="text-[12.5px]" style={{ color: T.muted }}>{[pick.username && "@" + pick.username, pick.phone].filter(Boolean).join(" · ")}</span></span>
              <span className="text-[13px]"><b className="tabular-nums">{n(pick.credits || 0)} кр</b> <button type="button" className="ml-3 font-bold" style={{ color: T.primaryInk }} onClick={() => setPick(null)}>Солих</button></span>
            </div>
            <div className="mb-3 flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button key={p} type="button" onClick={() => setAmount(String(p))} className="rounded-lg px-3.5 py-2 text-[13px] font-bold tabular-nums" style={{ border: `1px solid ${amt === p ? T.primaryInk : T.border}`, color: T.text, background: amt === p ? "rgba(46,41,255,0.08)" : "#fff" }}>+{n(p)}</button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-[0.7fr_1.6fr_auto]">
              <input style={field} type="number" placeholder="± кредит" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <input style={field} placeholder="Тайлбар (заавал биш) — жишээ: дансаар 20,000₮ шилжүүлсэн" value={note} onChange={(e) => setNote(e.target.value)} />
              <Btn onClick={() => grant(pick._id, amt, note.trim())} loading={busy} disabled={!Number.isFinite(amt) || amt === 0}>{amt < 0 ? "Хасах" : "Олгох"}</Btn>
            </div>
            <p className="mt-2 text-[12px]" style={{ color: T.faint }}>Сөрөг тоо = хасах (үлдэгдэл 0-ээс доош орохгүй). Гүйлгээ бүр түүхэнд тэмдэглэгдэнэ.</p>
          </div>
        )}
      </Card>

      {/* ── Зардал юунд явав ── */}
      {feature.length > 0 && (
        <>
          <SectionHeader title="Сүүлийн 30 хоног — юунд зарцуулав" hint="үйлдлээр" />
          <Card className="mb-8 overflow-x-auto p-0">
            <table className="w-full border-collapse">
              <thead><tr>{["Үйлдэл", "Нийт кр", "Тоо", "Хүн"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>{feature.map((f) => <tr key={f._id}><td style={td}><b>{lbl(f._id)}</b></td><td style={td}>{n(f.total)}</td><td style={td}>×{n(f.count)}</td><td style={td}>{n(f.users)}</td></tr>)}</tbody>
            </table>
          </Card>
        </>
      )}

      {/* ── Гишүүд ── */}
      <SectionHeader title="Гишүүдийн зарцуулалт" hint={`${n(meta.total)} хүн · нийт ${n(meta.spent)} кр зарцуулсан`} />
      <div className="mb-3 flex flex-wrap gap-2">
        <input style={{ ...field, maxWidth: 320 }} placeholder="Хайх…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <select style={{ ...field, maxWidth: 220 }} value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}>
          {SORTS.map(([k, v]) => <option key={k} value={k}>Эрэмбэ: {v}</option>)}
        </select>
      </div>
      <Card className="mb-3 overflow-x-auto p-0">
        <table className="w-full border-collapse">
          <thead><tr>{["Гишүүн", "Багц", "Үлдэгдэл", "Зарцуулсан (30х)", "Нийт зарцуулсан", "Нийт авсан", "Сүүлд", ""].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {rows === null && <tr><td style={td} colSpan={8}>Ачаалж байна…</td></tr>}
            {rows?.length === 0 && <tr><td style={td} colSpan={8}>Гүйлгээтэй гишүүн олдсонгүй</td></tr>}
            {rows?.map((r) => (
              <>
                <tr key={r._id} onClick={() => toggle(r._id)} style={{ cursor: "pointer", background: open === r._id ? "rgba(46,41,255,0.04)" : undefined }}>
                  <td style={td}><b>{who(r)}</b><span className="ml-2 text-[12px]" style={{ color: T.faint }}>{r.username ? "@" + r.username : r.phone || ""}</span></td>
                  <td style={td}>{r.plan && r.plan !== "free" ? r.plan : "—"}</td>
                  <td style={td}><b>{n(r.credits)}</b></td>
                  <td style={td}>{n(r.spent30)}</td>
                  <td style={td}>{n(r.spent)}</td>
                  <td style={td}>{n(r.earned)}</td>
                  <td style={td}>{r.lastAt ? ago(r.lastAt) : "—"}</td>
                  <td style={td}><button type="button" className="font-bold" style={{ color: T.primaryInk }} onClick={(e) => { e.stopPropagation(); setPick({ _id: r._id, name: r.name, username: r.username, phone: r.phone, credits: r.credits }); setFq(""); window.scrollTo({ top: 0, behavior: "smooth" }); }}>+ Олгох</button></td>
                </tr>
                {open === r._id && (
                  <tr key={r._id + "d"}>
                    <td colSpan={8} style={{ ...td, whiteSpace: "normal", background: "rgba(0,0,0,0.02)" }}>
                      {!detail ? "Ачаалж байна…" : (
                        <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
                          <div>
                            <div className="mb-2 text-[11.5px] font-extrabold uppercase tracking-wider" style={{ color: T.faint }}>Төрлөөр</div>
                            {detail.byReason.map((b, i) => (
                              <div key={i} className="flex justify-between gap-3 py-1 text-[13px]"><span>{b._id.kind === "earn" ? "＋" : "−"} {lbl(b._id.reason)} <span style={{ color: T.faint }}>×{b.count}</span></span><b>{n(b.total)}</b></div>
                            ))}
                          </div>
                          <div>
                            <div className="mb-2 text-[11.5px] font-extrabold uppercase tracking-wider" style={{ color: T.faint }}>Сүүлийн гүйлгээ</div>
                            <div className="max-h-72 overflow-y-auto">
                              {detail.tx.map((t) => (
                                <div key={t._id} className="flex items-center justify-between gap-3 py-1 text-[13px]">
                                  <span className="min-w-0 truncate">{lbl(t.reason)}{t.meta?.note ? <span style={{ color: T.faint }}> · {t.meta.note}</span> : null}<span className="ml-2 text-[11.5px]" style={{ color: T.faint }}>{new Date(t.createdAt).toLocaleString("mn-MN")}</span></span>
                                  <b style={{ color: t.kind === "earn" ? T.okInk : T.badInk }}>{t.kind === "earn" ? "+" : "−"}{n(t.amount)}</b>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </Card>
      <div className="mb-8 flex items-center justify-between text-[13px]" style={{ color: T.muted }}>
        <span>{page} / {pages}</span>
        <span className="flex gap-2">
          <Btn onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>‹ Өмнөх</Btn>
          <Btn onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages}>Дараах ›</Btn>
        </span>
      </div>

      {/* ── Сүүлийн гүйлгээ ── */}
      <SectionHeader title="Сүүлийн гүйлгээ" hint="бүх гишүүн" />
      <Card className="mb-8 p-0">
        {recent.map((t) => (
          <div key={t._id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px]" style={{ borderBottom: `1px solid ${T.border}` }}>
            <span className="min-w-0 truncate"><b>{t.user?.name || "—"}</b> · {lbl(t.reason)}<span className="ml-2 text-[11.5px]" style={{ color: T.faint }}>{new Date(t.createdAt).toLocaleString("mn-MN")}</span></span>
            <b style={{ color: t.kind === "earn" ? T.okInk : T.badInk }}>{t.kind === "earn" ? "+" : "−"}{n(t.amount)}</b>
          </div>
        ))}
        {recent.length === 0 && <div className="p-6 text-center text-[13px]" style={{ color: T.faint }}>Гүйлгээ байхгүй</div>}
      </Card>

      <SectionHeader title="Бүх төрлийн нийлбэр" hint="түүхэн" />
      <Card className="p-4">
        {reasons.slice(0, 14).map((r, i) => (
          <div key={i} className="flex justify-between gap-3 py-1 text-[13px]"><span>{r._id.kind === "earn" ? "＋" : "−"} {lbl(r._id.reason)} <span style={{ color: T.faint }}>×{n(r.count)}</span></span><b>{n(r.total)}</b></div>
        ))}
      </Card>
    </div>
  );
}
