"use client";

import { useEffect, useMemo, useState } from "react";
import { Btn, Card, Metric, SectionHeader, Skeleton, T } from "@/components/admin/kit";
import { creditsFor, costPerCredit, fmtCr, fmtMnt, MAX_BONUS, membershipMargin, packageMargin, suggestGift, type Econ, type PlanId } from "@/lib/creditEconomics";

/* ─── Ашиг · Кредит (2026-10-26) ─────────────────────────────────────────────
   1 кредит = 1₮. Үйлдлийн үнэ = ceil10(Higgsfield $ × ханш × markup).
   Энд: тохиргоо → нэг үйлдлийн ашиг → багцын ашиг → гишүүнчлэл + бэлэг кредитийн
   ашиг → сүүлийн 30 хоногийн БОДИТ орлого/зардал. Тоо бүр тохиргоог өөрчлөхөд шууд. */

type Data = {
  econ: Econ;
  actions: { label: string; group: string; usd: number }[];
  packages: { id: string; label: string; price: number; credits: number }[];
  plans: { planId: string; name: string; price: number }[];
  last30: {
    revenue: { membership: number; membershipN: number; credits: number; creditsN: number; agent: number; agentN: number };
    hf: { who: "member" | "owner" | "business"; usd: number; n: number; credits: number }[];
    gifts: { signup: number; membership: number };
    studioSpend: number;
  };
  outstanding: { credits: number; users: number };
};

const field: React.CSSProperties = { width: "100%", borderRadius: 8, border: `1px solid ${T.border}`, background: "#FFFFFF", color: T.text, padding: "9px 11px", fontSize: 14, outline: "none", fontVariantNumeric: "tabular-nums" };
const lab: React.CSSProperties = { display: "block", marginBottom: 5, fontSize: 12.5, fontWeight: 700, color: T.muted };
const th: React.CSSProperties = { textAlign: "left", padding: "10px 12px", fontSize: 11.5, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: T.faint, borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "10px 12px", fontSize: 14, borderBottom: `1px solid ${T.border}`, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
const pctColor = (p: number) => (p >= 40 ? T.okInk : p >= 20 ? T.warnInk : T.badInk);
const Pct = ({ v }: { v: number }) => <b style={{ color: pctColor(v) }}>{v.toFixed(0)}%</b>;

export default function EconomicsPage() {
  const [d, setD] = useState<Data | null>(null);
  const [e, setE] = useState<Econ | null>(null);
  const [usage, setUsage] = useState(60);
  const [hfUsd, setHfUsd] = useState(5);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    fetch("/api/admin/economics", { cache: "no-store" }).then((r) => (r.ok ? r.json() : Promise.reject())).then((x: Data) => { setD(x); setE(x.econ); }).catch(() => setNote("Ачаалж чадсангүй"));
  }, []);

  const rows = useMemo(() => {
    if (!d || !e) return [];
    return d.actions.map((a) => {
      const costMnt = a.usd * e.fx;
      const credits = creditsFor(a.usd, e);
      const fee = 1 - e.feePct / 100;
      const base = credits * fee - costMnt;                         // суурь багц (1 кр = 1₮)
      const worstRev = (credits / (1 + MAX_BONUS)) * fee;           // +30% бонустай багц
      return { ...a, costMnt, credits, basePct: (base / (credits * fee)) * 100, worstPct: ((worstRev - costMnt) / worstRev) * 100, profit: base };
    });
  }, [d, e]);

  if (!d || !e) return <div className="mx-auto max-w-6xl space-y-4">{note ? <Card className="p-6">{note}</Card> : [0, 1, 2].map((i) => <Skeleton key={i} className="h-40" />)}</div>;

  const set = (k: keyof Econ, v: number) => setE({ ...e, [k]: v });
  const setStarter = (k: PlanId, v: number) => setE({ ...e, starter: { ...e.starter, [k]: v } });
  const num = (v: string) => Number(v.replace(/[^\d.]/g, "")) || 0;

  async function save() {
    setBusy(true); setNote("");
    try {
      const r = await fetch("/api/admin/economics", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(e) });
      const x = await r.json();
      if (!r.ok) throw new Error(x.error || "Алдаа");
      setE(x.econ); setNote("✓ Хадгалагдлаа — шинэ үнэ 30 секундын дотор үйлчилнэ");
    } catch (err) { setNote((err as Error).message); } finally { setBusy(false); }
  }

  const l = d.last30;
  const hfSpent = l.hf.reduce((a, x) => a + x.usd, 0);
  const memberHf = l.hf.find((x) => x.who === "member");
  const revenue = l.revenue.membership + l.revenue.credits + l.revenue.agent;
  const hfMnt = hfSpent * e.fx;
  const gross = revenue * (1 - e.feePct / 100) - hfMnt;
  const liability = d.outstanding.credits * costPerCredit(e);
  const planIds: PlanId[] = ["starter", "builder", "operator"];
  const planOf = (id: PlanId) => d.plans.find((p) => p.planId === id);

  return (
    <div className="mx-auto max-w-6xl pb-24">
      <div className="mb-6">
        <h1 className="text-[28px] font-extrabold tracking-tight" style={{ color: T.text }}>Ашиг · Кредит</h1>
        <p className="mt-1 max-w-3xl text-[14px] leading-relaxed" style={{ color: T.muted }}>
          <b style={{ color: T.text }}>1 кредит = 1₮.</b> Үйлдэл бүрийн үнэ = Higgsfield-ийн бодит $ өртөг × ханш × markup (10-аар бөөрөнхийлнө).
          Хэрэглэгч бүх кредитээ зарцуулсан ч нэг кредит бидэнд хамгийн ихдээ <b style={{ color: T.text }}>{costPerCredit(e).toFixed(2)}₮</b> өртөгтэй.
        </p>
      </div>

      {/* ── 30 хоног ── */}
      <SectionHeader title="Сүүлийн 30 хоног — бодит" hint="төлөгдсөн төлбөр, Higgsfield зардал" />
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Орлого" value={fmtMnt(revenue)} sub={`Гишүүнчлэл ${fmtMnt(l.revenue.membership)} · Кредит ${fmtMnt(l.revenue.credits)} · Бизнес ${fmtMnt(l.revenue.agent)}`} />
        <Metric label="Higgsfield зардал" value={`$${hfSpent.toFixed(2)}`} sub={`≈ ${fmtMnt(hfMnt)} · гишүүн $${(memberHf?.usd || 0).toFixed(2)}`} />
        <Metric label="Бохир ашиг" value={fmtMnt(gross)} accent={gross >= 0 ? "ok" : undefined} sub={revenue > 0 ? `${((gross / (revenue * (1 - e.feePct / 100))) * 100).toFixed(0)}% · шимтгэл ${e.feePct}% хассан` : "орлого алга"} />
        <Metric label="Үлдэгдэл кредит" value={fmtCr(d.outstanding.credits)} sub={`${d.outstanding.users} хүн · хамгийн их өртөг ${fmtMnt(liability)}`} />
      </div>
      <p className="-mt-5 mb-8 text-[12.5px]" style={{ color: T.faint }}>
        Бэлэг: бүртгэл {fmtCr(l.gifts.signup)}, гишүүнчлэл {fmtCr(l.gifts.membership)} · AI Studio-д гишүүд зарцуулсан {fmtCr(l.studioSpend)}.
        Эзний (main) зардал ${(l.hf.find((x) => x.who === "owner")?.usd || 0).toFixed(2)}, бизнес ${(l.hf.find((x) => x.who === "business")?.usd || 0).toFixed(2)}.
      </p>

      {/* ── Тохиргоо ── */}
      <SectionHeader title="Тохиргоо" hint="үнэ, бэлэг, сануулга" action={<Btn onClick={save} loading={busy}>Хадгалах</Btn>} />
      <Card className="mb-3 p-5">
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <div><label style={lab}>Ханш ₮/$</label><input style={field} value={e.fx} onChange={(x) => set("fx", num(x.target.value))} /></div>
          <div><label style={lab}>Markup ×</label><input style={field} value={e.markup} onChange={(x) => set("markup", num(x.target.value))} /></div>
          <div><label style={lab}>QPay шимтгэл %</label><input style={field} value={e.feePct} onChange={(x) => set("feePct", num(x.target.value))} /></div>
          <div><label style={lab}>Гишүүнчлэлийн AI хувь %</label><input style={field} value={e.aiShare} onChange={(x) => set("aiShare", num(x.target.value))} /></div>
          <div><label style={lab}>Бүртгэлийн бэлэг кр</label><input style={field} value={e.signupBonus} onChange={(x) => set("signupBonus", num(x.target.value))} /></div>
          <div><label style={lab}>«Бага» сануулга кр</label><input style={field} value={e.lowAt} onChange={(x) => set("lowAt", num(x.target.value))} /></div>
        </div>
        {note && <p className="mt-3 text-[13px] font-semibold" style={{ color: note.startsWith("✓") ? T.okInk : T.badInk }}>{note}</p>}
      </Card>
      <p className="mb-8 text-[12.5px] leading-relaxed" style={{ color: T.faint }}>
        Markup 2 = суурь багц дээр 50% ашиг; хамгийн их бонустай (+30%) багц дээр ~35%. Ханшийг Монголбанкаар үе үе шинэчилнэ — Higgsfield доллараар авдаг.
      </p>

      {/* ── Гишүүнчлэл ── */}
      <SectionHeader title="Гишүүнчлэл + бэлэг кредит" hint="хэдэн кредит өгвөл ашигтай вэ" />
      <Card className="mb-3 overflow-x-auto p-0">
        <table className="w-full border-collapse">
          <thead><tr>{["Багц", "Үнэ", "Бэлэг кредит (30 хоног)", "Санал", "AI өртөг (бүгд)", "Ашиг (бүгд)", `Ашиг (${usage}% хэрэглээ)`].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {planIds.map((id) => {
              const p = planOf(id);
              if (!p) return null;
              const gift = e.starter[id];
              const m = membershipMargin(p.price, gift, e, usage);
              return (
                <tr key={id} style={id === "builder" ? { background: "rgba(46,41,255,0.04)" } : undefined}>
                  <td style={td}><b>{p.name}</b></td>
                  <td style={td}>{fmtMnt(p.price)}</td>
                  <td style={td}><input style={{ ...field, width: 120, padding: "6px 9px" }} value={gift} onChange={(x) => setStarter(id, num(x.target.value))} /></td>
                  <td style={td}><button type="button" className="text-[13px] font-bold" style={{ color: T.primaryInk }} onClick={() => setStarter(id, suggestGift(p.price, e))}>{fmtCr(suggestGift(p.price, e))}</button></td>
                  <td style={td}>{fmtMnt(m.worstCost)}</td>
                  <td style={td}>{fmtMnt(m.worstProfit)} · <Pct v={m.worstPct} /></td>
                  <td style={td}>{fmtMnt(m.expProfit)} · <Pct v={m.expPct} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <div className="mb-8 flex flex-wrap items-center gap-3 text-[12.5px]" style={{ color: T.faint }}>
        <span>«Санал» = үнийн {e.aiShare}%-ийг AI-д зориулсан хэмжээ (дарж хэрэглэнэ). Бэлгийг гишүүнчлэл төлөх бүрт олгоно (жилээр бол ×12).</span>
        <label className="flex items-center gap-2">Хэрэглээ
          <input type="range" min={10} max={100} step={10} value={usage} onChange={(x) => setUsage(Number(x.target.value))} />
          <b style={{ color: T.text }}>{usage}%</b>
        </label>
      </div>

      {/* ── Higgsfield төсөв ── */}
      <SectionHeader title="Higgsfield төсөв" hint="$ цэнэглэсэн бол хэдэн хүнд хүрэх вэ" />
      <Card className="mb-8 p-5">
        <div className="mb-4 flex flex-wrap items-end gap-4">
          <div style={{ width: 160 }}><label style={lab}>Цэнэглэсэн $</label><input style={field} value={hfUsd} onChange={(x) => setHfUsd(num(x.target.value))} /></div>
          <p className="text-[13px] leading-relaxed" style={{ color: T.muted }}>
            ${hfUsd} ≈ <b style={{ color: T.text }}>{fmtMnt(hfUsd * e.fx)}</b> өртөг → бүгдийг зарвал <b style={{ color: T.text }}>{fmtCr(hfUsd * e.fx * e.markup)}</b> (markup {e.markup}×).
            Хэрэглэгч бүр хамгийн ихдээ өөрийн бэлэг кредитийн {(100 / e.markup).toFixed(0)}% өртөгтэй.
          </p>
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead><tr>{["Багц", "Бэлэг кр", "Нэг хүний өртөг", "Хэдэн хүн (бүгд)", `Хэдэн хүн (${usage}%)`].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {planIds.map((id) => {
                  const gift = e.starter[id];
                  const worstUsd = (gift * costPerCredit(e)) / e.fx;
                  return (
                    <tr key={id}>
                      <td style={td}><b>{planOf(id)?.name || id}</b></td>
                      <td style={td}>{fmtCr(gift)}</td>
                      <td style={td}>${worstUsd.toFixed(2)}</td>
                      <td style={td}><b>{worstUsd > 0 ? Math.floor(hfUsd / worstUsd) : "—"}</b></td>
                      <td style={td}><b>{worstUsd > 0 ? Math.floor(hfUsd / (worstUsd * (usage / 100))) : "—"}</b></td>
                    </tr>
                  );
                })}
                <tr><td style={td}><b>Бүртгэл</b></td><td style={td}>{fmtCr(e.signupBonus)}</td><td style={td}>${((e.signupBonus * costPerCredit(e)) / e.fx).toFixed(2)}</td><td style={td}><b>{e.signupBonus > 0 ? Math.floor(hfUsd / ((e.signupBonus * costPerCredit(e)) / e.fx)) : "—"}</b></td><td style={td}>—</td></tr>
              </tbody>
            </table>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead><tr>{["Нэг ашигласан үйлдэл", "Нийт хэдэн удаа"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {d.actions.map((a) => <tr key={a.label}><td style={td}>{a.label}</td><td style={td}><b>{a.usd > 0 ? Math.floor(hfUsd / a.usd).toLocaleString("en-US") : "—"}</b></td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
        <p className="mt-3 text-[12.5px]" style={{ color: T.faint }}>«Бүгд» = хүн бэлэг кредитээ 100% зарцуулсан хамгийн муу тохиолдол. «{usage}%» = дээрх хэрэглээний гулсуураар. Хэрэглэгчийн бодит зарцуулалтыг /admin/credits-ээс хар.</p>
      </Card>

      {/* ── Нэг үйлдэл ── */}
      <SectionHeader title="Нэг үйлдлийн ашиг" hint="Higgsfield-ийн одоогийн үнээр" />
      <Card className="mb-8 overflow-x-auto p-0">
        <table className="w-full border-collapse">
          <thead><tr>{["Үйлдэл", "Higgsfield", "Өртөг ₮", "Үнэ (кр = ₮)", "Ашиг ₮", "Ашиг % (суурь)", "Ашиг % (+30% бонус)"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td style={td}><span style={{ color: T.faint, fontSize: 12 }}>{r.group} · </span><b>{r.label}</b></td>
                <td style={td}>${r.usd.toFixed(3)}</td>
                <td style={td}>{fmtMnt(r.costMnt)}</td>
                <td style={td}><b>{fmtCr(r.credits)}</b></td>
                <td style={td}>{fmtMnt(r.profit)}</td>
                <td style={td}><Pct v={r.basePct} /></td>
                <td style={td}><Pct v={r.worstPct} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* ── Багцууд ── */}
      <SectionHeader title="Кредитийн багц" hint="хэрэглэгч бүгдийг зарцуулсан тохиолдолд" />
      <Card className="mb-8 overflow-x-auto p-0">
        <table className="w-full border-collapse">
          <thead><tr>{["Багц", "Үнэ", "Кредит", "Орлого (шимтгэл хассан)", "Хамгийн их өртөг", "Ашиг"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {d.packages.map((p) => {
              const m = packageMargin(p.price, p.credits, e);
              return (
                <tr key={p.id}>
                  <td style={td}><b>{p.label}</b></td>
                  <td style={td}>{fmtMnt(p.price)}</td>
                  <td style={td}>{fmtCr(p.credits)}</td>
                  <td style={td}>{fmtMnt(m.revenue)}</td>
                  <td style={td}>{fmtMnt(m.cost)}</td>
                  <td style={td}>{fmtMnt(m.profit)} · <Pct v={m.pct} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
