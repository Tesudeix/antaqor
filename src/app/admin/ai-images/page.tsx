"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, Metric, Btn, SectionHeader, Empty, Skeleton, Status, Money, T, MONO } from "@/components/admin/kit";

/* ─── /admin/ai-images — AI зураг · Credits командын төв ─────────────────
   Нэг дэлгэц, дөрвөн асуулт:
     1. Хэн хэдэн зураг үүсгэж, хэдэн кредит зарцуулав?   (byUser)
     2. Google-д бид хэдэн доллар төлөв, ашиг хэд вэ?      (usd vs ₮)
     3. Хэн кредит цэнэглэхээр данс руу шилжүүлээд хүлээж байна? (pendingTopups)
     4. Үнэ, лайкийн харьцааг энд өөрчилнө.                (pricing) */

interface Sum { count: number; done: number; failed: number; credits: number; usd: number; usdEstimated: number; avgMs: number }
interface Payload {
  days: number;
  kpis: {
    window: Sum; today: Sum; all: Sum;
    revenue: { amount: number; credits: number; count: number };
    burnedMnt: number; costMnt: number; usdMntRate: number;
    circulating: number; holders: number;
    likeCredits: { credits: number; count: number };
  };
  byModel: { _id: { model: string; version: string }; count: number; credits: number; usd: number; avgMs: number }[];
  byUser: { _id: string; count: number; done: number; credits: number; usd: number; last: string; name?: string; email?: string; avatar?: string; balance?: number; phone?: string }[];
  recent: { _id: string; user: { _id: string; name: string; email?: string; avatar?: string } | null; prompt: string; modelId: string; modelVersion: string; aspectRatio: string; resolution: string; url: string; cost: number; usd: number; usdEstimate: boolean; status: string; error: string; durationMs: number; createdAt: string; refCount: number }[];
  pendingTopups: { _id: string; user: { _id: string; name: string; email?: string; avatar?: string; phone?: string; credits?: number } | null; amount: number; creditAmount: number; packageId: string; referenceCode: string; receiptImage: string; receiptUploadedAt?: string; claimedAt?: string; createdAt: string }[];
  pricing: { costs: Record<string, number>; hdMultiplier: number; likesPerCredit: number; likeMilestoneCredits: number };
  catalog: { id: string; label: string; sub: string; provider: string; credits: number; geminiModels?: string[] }[];
  usdRates: Record<string, { inputPerM: number; imageOutPerM: number; estimate?: boolean }>;
}

const usd = (n: number) => `$${(n || 0).toFixed(n >= 10 ? 1 : 3)}`;
const rel = (iso?: string) => {
  if (!iso) return "";
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 1) return "сая";
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ц`;
  return `${Math.floor(h / 24)} өдөр`;
};

export default function AdminAiImagesPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [days, setDays] = useState(30);
  const [err, setErr] = useState("");
  const [flash, setFlash] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [form, setForm] = useState<Payload["pricing"] | null>(null);
  const [saving, setSaving] = useState(false);
  const [rejecting, setRejecting] = useState<{ id: string; note: string } | null>(null);

  const load = useCallback(async (d = days) => {
    try {
      const r = await fetch(`/api/admin/ai-images?days=${d}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "failed");
      setData(j);
      setForm((f) => f ?? j.pricing);
      setErr("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Алдаа");
    }
  }, [days]);

  useEffect(() => { load(days); }, [days, load]);
  useEffect(() => {
    const t = setInterval(() => load(days), 45_000);
    return () => clearInterval(t);
  }, [days, load]);

  const showFlash = (m: string) => { setFlash(m); setTimeout(() => setFlash(""), 3500); };

  const approve = async (p: Payload["pendingTopups"][number]) => {
    if (!confirm(`${p.user?.name || "?"} · ₮${p.amount.toLocaleString()} → +${p.creditAmount}₵ нэмэх үү?`)) return;
    setBusyId(p._id);
    try {
      const r = await fetch(`/api/admin/payments/${p._id}/approve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "failed");
      showFlash(`+${p.creditAmount}₵ → ${p.user?.name || "хэрэглэгч"} (үлдэгдэл ${j.user?.credits ?? "?"}₵)`);
      load(days);
    } catch (e) {
      showFlash("Алдаа: " + (e instanceof Error ? e.message : "failed"));
    } finally { setBusyId(null); }
  };

  const reject = async () => {
    if (!rejecting) return;
    setBusyId(rejecting.id);
    try {
      const r = await fetch(`/api/admin/payments/${rejecting.id}/reject`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note: rejecting.note || "Шилжүүлэг олдсонгүй. Дүн, гүйлгээний утгаа шалгаад дахин илгээнэ үү." }) });
      if (!r.ok) throw new Error((await r.json()).error || "failed");
      showFlash("Татгалзлаа");
      setRejecting(null);
      load(days);
    } catch (e) {
      showFlash("Алдаа: " + (e instanceof Error ? e.message : "failed"));
    } finally { setBusyId(null); }
  };

  const savePricing = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const r = await fetch("/api/admin/ai-images", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "failed");
      setForm(j.pricing);
      showFlash("Үнэ хадгалагдлаа — дараагийн үүсгэлтээс мөрдөнө");
      load(days);
    } catch (e) {
      showFlash("Алдаа: " + (e instanceof Error ? e.message : "failed"));
    } finally { setSaving(false); }
  };

  if (err && !data) return <Empty title="Ачаалж чадсангүй" hint={err} cta={<Btn onClick={() => load(days)}>Дахин</Btn>} />;
  if (!data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const k = data.kpis;
  const margin = k.burnedMnt - k.costMnt;
  const marginPct = k.burnedMnt > 0 ? Math.round((margin / k.burnedMnt) * 100) : 0;

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: T.primaryInk }}>Орлого · AI</div>
          <h1 className="mt-1 text-[22px] font-bold tracking-tight" style={{ color: T.text }}>AI зураг · Credits</h1>
          <p className="mt-1 text-[12px]" style={{ color: T.muted }}>
            Nano Banana 2 · хэрэглэгчийн зардал кредитээр, бидний зардал Google-ийн токеноор.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-[4px] border p-1" style={{ borderColor: T.border }}>
          {[7, 30, 90].map((d) => (
            <button key={d} onClick={() => setDays(d)} className="rounded-[4px] px-3 py-1.5 text-[12px] font-semibold transition"
              style={days === d ? { background: "rgba(46,41,255,0.14)", color: T.primaryInk } : { color: T.muted }}>
              {d} хоног
            </button>
          ))}
        </div>
      </div>

      {flash && (
        <div className="rounded-[4px] border px-3 py-2 text-[12px] font-semibold" style={{ borderColor: "rgba(46,41,255,0.4)", color: T.primaryInk, background: "rgba(46,41,255,0.08)" }}>
          {flash}
        </div>
      )}

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label={`Зураг · ${days} хоног`} value={k.window.done} sub={`өнөөдөр ${k.today.done} · алдаа ${k.window.failed} · ~${Math.round((k.window.avgMs || 0) / 1000)}с`} accent="primary" />
        <Metric label="Кредит зарцуулсан" value={`${k.window.credits.toLocaleString()}₵`} sub={<>≈ <Money value={k.burnedMnt} /> (50₮/₵ доод үнээр)</>} />
        <Metric label="Google-д төлсөн" value={usd(k.window.usd)} sub={<>≈ <Money value={k.costMnt} /> · {k.window.usdEstimated > 0 ? "хэсэг нь тооцоолол" : "токеноор тооцсон"}</>} />
        <Metric label="Ашгийн зөрүү" value={`${marginPct}%`} sub={<Money value={margin} />} accent={margin >= 0 ? "ok" : undefined} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Цэнэглэлт · ₮" value={<Money value={k.revenue.amount} />} sub={`${k.revenue.count} төлбөр · ${k.revenue.credits.toLocaleString()}₵ олгосон`} hud={false} />
        <Metric label="Гүйлгээнд буй кредит" value={`${k.circulating.toLocaleString()}₵`} sub={`${k.holders} хүн үлдэгдэлтэй`} hud={false} />
        <Metric label="Лайк → кредит" value={`${k.likeCredits.credits}₵`} sub={`${k.likeCredits.count} босго · ${data.pricing.likesPerCredit} лайк = ${data.pricing.likeMilestoneCredits}₵`} hud={false} />
        <Metric label="Нийт (бүх цаг)" value={k.all.done} sub={`${k.all.credits.toLocaleString()}₵ · ${usd(k.all.usd)}`} hud={false} />
      </div>

      {/* Pending top-ups — the queue that unblocks members */}
      <section>
        <SectionHeader
          title="Кредит цэнэглэх хүсэлт"
          hint={data.pendingTopups.length ? `${data.pendingTopups.length} хүлээгдэж байна` : "хоосон"}
          action={<Btn href="/admin/payments" variant="ghost" size="sm">Бүх төлбөр →</Btn>}
        />
        {data.pendingTopups.length === 0 ? (
          <Empty title="Хүлээгдэж буй цэнэглэлт алга" hint="Гишүүн данс руу шилжүүлээд баримт оруулахад энд гарч ирнэ. Банкны auto-match код+дүн таарвал өөрөө батлагдана." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.pendingTopups.map((p) => (
              <Card key={p._id} hover className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    {p.user?.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.user.avatar} alt="" className="h-8 w-8 rounded-[4px] object-cover" />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-[4px] text-[12px] font-bold" style={{ background: "rgba(46,41,255,0.14)", color: T.primaryInk }}>
                        {p.user?.name?.charAt(0) || "?"}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-semibold" style={{ color: T.text }}>{p.user?.name || "—"}</div>
                      <div className="truncate text-[11px]" style={{ color: T.faint }}>{p.user?.phone || p.user?.email} · одоо {p.user?.credits ?? 0}₵</div>
                    </div>
                  </div>
                  <Status kind={p.receiptImage ? "pending" : "draft"} labelOverride={p.receiptImage ? "Баримттай" : "Баримтгүй"} />
                </div>
                <div className="mt-3 flex items-center justify-between rounded-[4px] border px-3 py-2" style={{ borderColor: "rgba(46,41,255,0.2)", background: "rgba(46,41,255,0.05)" }}>
                  <div>
                    <div className="text-[9px] uppercase tracking-wider" style={{ color: T.faint }}>Код</div>
                    <div className="text-[15px] font-black tracking-[0.12em]" style={{ color: T.primaryInk, fontFamily: MONO }}>{p.referenceCode}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[9px] uppercase tracking-wider" style={{ color: T.faint }}>Дүн → кредит</div>
                    <div className="text-[13px] font-bold" style={{ color: T.text, fontFamily: MONO }}>₮{p.amount.toLocaleString()} → +{p.creditAmount}₵</div>
                  </div>
                </div>
                {p.receiptImage && (
                  <a href={p.receiptImage} target="_blank" rel="noopener noreferrer" className="mt-2 block overflow-hidden rounded-[4px] border" style={{ borderColor: T.border }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.receiptImage} alt="Баримт" className="max-h-40 w-full object-cover" />
                  </a>
                )}
                <div className="mt-2 text-[10px]" style={{ color: T.faint }}>
                  Үүссэн {rel(p.createdAt)} · {p.packageId}{p.receiptUploadedAt ? ` · баримт ${rel(p.receiptUploadedAt)}` : ""}
                </div>
                <div className="mt-3 flex gap-2">
                  <Btn size="sm" onClick={() => approve(p)} loading={busyId === p._id} className="flex-1">Батлах · +{p.creditAmount}₵</Btn>
                  <Btn size="sm" variant="danger" onClick={() => setRejecting({ id: p._id, note: "" })} disabled={busyId === p._id}>Татгалзах</Btn>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {rejecting && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center" onClick={() => setRejecting(null)}>
          <Card className="w-full max-w-md p-5" >
            <div onClick={(e) => e.stopPropagation()}>
              <div className="text-[14px] font-semibold" style={{ color: T.text }}>Татгалзах шалтгаан</div>
              <textarea value={rejecting.note} onChange={(e) => setRejecting({ ...rejecting, note: e.target.value })} rows={3}
                placeholder="Шилжүүлэг олдсонгүй. Дүн, гүйлгээний утгаа шалгаад дахин илгээнэ үү."
                className="mt-3 w-full rounded-[4px] border bg-transparent px-3 py-2 text-[13px] outline-none"
                style={{ borderColor: T.border, color: T.text }} />
              <div className="mt-3 flex gap-2">
                <Btn variant="ghost" onClick={() => setRejecting(null)} className="flex-1">Болих</Btn>
                <Btn variant="danger" onClick={reject} loading={busyId === rejecting.id} className="flex-1">Татгалзах</Btn>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Per-user spend */}
      <section>
        <SectionHeader title="Хэрэглэгчийн зардал" hint={`${days} хоног · кредитээр эрэмбэлсэн`} />
        {data.byUser.length === 0 ? (
          <Empty title="Энэ хугацаанд зураг үүсгээгүй" />
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[12px]">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider" style={{ color: T.faint }}>
                  <th className="px-4 py-3">Гишүүн</th>
                  <th className="px-3 py-3 text-right">Зураг</th>
                  <th className="px-3 py-3 text-right">Кредит</th>
                  <th className="px-3 py-3 text-right">₮ (50/₵)</th>
                  <th className="px-3 py-3 text-right">Бидний $</th>
                  <th className="px-3 py-3 text-right">Үлдэгдэл</th>
                  <th className="px-4 py-3 text-right">Сүүлд</th>
                </tr>
              </thead>
              <tbody>
                {data.byUser.map((u) => (
                  <tr key={u._id} className="border-t" style={{ borderColor: T.border }}>
                    <td className="px-4 py-2.5">
                      <Link href={`/admin/members?q=${encodeURIComponent(u.email || u.name || "")}`} className="flex items-center gap-2 hover:underline">
                        {u.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={u.avatar} alt="" className="h-6 w-6 rounded-[4px] object-cover" />
                        ) : (
                          <span className="flex h-6 w-6 items-center justify-center rounded-[4px] text-[10px] font-bold" style={{ background: "rgba(46,41,255,0.14)", color: T.primaryInk }}>{u.name?.charAt(0) || "?"}</span>
                        )}
                        <span className="min-w-0">
                          <span className="block truncate font-semibold" style={{ color: T.text }}>{u.name || "—"}</span>
                          <span className="block truncate text-[10px]" style={{ color: T.faint }}>{u.phone || u.email}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-right" style={{ fontFamily: MONO, color: T.text }}>{u.done}{u.count > u.done ? <span style={{ color: T.faint }}> /{u.count}</span> : null}</td>
                    <td className="px-3 py-2.5 text-right font-bold" style={{ fontFamily: MONO, color: T.primaryInk }}>{u.credits}₵</td>
                    <td className="px-3 py-2.5 text-right" style={{ fontFamily: MONO, color: T.text }}>₮{(u.credits * 50).toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-right" style={{ fontFamily: MONO, color: T.muted }}>{usd(u.usd)}</td>
                    <td className="px-3 py-2.5 text-right" style={{ fontFamily: MONO, color: (u.balance ?? 0) < 10 ? T.warn : T.text }}>{u.balance ?? 0}₵</td>
                    <td className="px-4 py-2.5 text-right" style={{ color: T.faint }}>{rel(u.last)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>

      {/* Pricing + like ratio */}
      <section>
        <SectionHeader title="Үнэ · тохиргоо" hint="кредит/зураг · HD үржүүлэгч · лайк → кредит" />
        {form && (
          <Card className="p-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.catalog.map((m) => {
                const rate = m.geminiModels?.[0] ? data.usdRates[m.geminiModels[0]] : undefined;
                const usdPer1k = rate ? (1120 / 1_000_000) * rate.imageOutPerM : null;
                return (
                  <label key={m.id} className="block rounded-[4px] border p-3" style={{ borderColor: T.border }}>
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-semibold" style={{ color: T.text }}>{m.label}</span>
                      <span className="text-[10px] uppercase tracking-wider" style={{ color: T.faint }}>{m.provider}</span>
                    </div>
                    <div className="mt-0.5 text-[10px]" style={{ color: T.faint }}>
                      {m.geminiModels?.[0] || m.sub}{usdPer1k != null ? ` · ≈$${usdPer1k.toFixed(3)}/1K зураг${rate?.estimate ? " (тооцоолол)" : ""}` : ""}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <input type="number" min={1} max={1000} value={form.costs[m.id] ?? m.credits}
                        onChange={(e) => setForm({ ...form, costs: { ...form.costs, [m.id]: Number(e.target.value) } })}
                        className="w-24 rounded-[4px] border bg-transparent px-2 py-1.5 text-[14px] font-bold outline-none"
                        style={{ borderColor: T.borderHi, color: T.primaryInk, fontFamily: MONO }} />
                      <span className="text-[11px]" style={{ color: T.muted }}>₵ / зураг · ≈₮{((form.costs[m.id] ?? m.credits) * 50).toLocaleString()}</span>
                    </div>
                  </label>
                );
              })}
              <label className="block rounded-[4px] border p-3" style={{ borderColor: T.border }}>
                <span className="text-[12px] font-semibold" style={{ color: T.text }}>HD (2K) үржүүлэгч</span>
                <div className="mt-2 flex items-center gap-2">
                  <input type="number" min={1} max={5} step={0.1} value={form.hdMultiplier}
                    onChange={(e) => setForm({ ...form, hdMultiplier: Number(e.target.value) })}
                    className="w-24 rounded-[4px] border bg-transparent px-2 py-1.5 text-[14px] font-bold outline-none"
                    style={{ borderColor: T.borderHi, color: T.primaryInk, fontFamily: MONO }} />
                  <span className="text-[11px]" style={{ color: T.muted }}>× үндсэн үнэ</span>
                </div>
              </label>
              <label className="block rounded-[4px] border p-3" style={{ borderColor: T.border }}>
                <span className="text-[12px] font-semibold" style={{ color: T.text }}>Лайк → кредит</span>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]" style={{ color: T.muted }}>
                  <input type="number" min={1} max={1000} value={form.likesPerCredit}
                    onChange={(e) => setForm({ ...form, likesPerCredit: Number(e.target.value) })}
                    className="w-20 rounded-[4px] border bg-transparent px-2 py-1.5 text-[14px] font-bold outline-none"
                    style={{ borderColor: T.borderHi, color: T.primaryInk, fontFamily: MONO }} />
                  лайк тутамд
                  <input type="number" min={0} max={100} value={form.likeMilestoneCredits}
                    onChange={(e) => setForm({ ...form, likeMilestoneCredits: Number(e.target.value) })}
                    className="w-20 rounded-[4px] border bg-transparent px-2 py-1.5 text-[14px] font-bold outline-none"
                    style={{ borderColor: T.borderHi, color: T.primaryInk, fontFamily: MONO }} />
                  ₵ (0 = унтраах)
                </div>
              </label>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-[11px]" style={{ color: T.faint }}>
                Кредитийн ₮ үнэ багцаас хамаарна: Starter 50₮ · Creator 40₮ · Studio 30₮ · Empire 24₮ / ₵. Nano Banana 2 бидэнд ≈$0.067 (≈₮{Math.round(0.067 * k.usdMntRate)}) тутамд.
              </p>
              <Btn onClick={savePricing} loading={saving}>Хадгалах</Btn>
            </div>
          </Card>
        )}
      </section>

      {/* By model */}
      <section>
        <SectionHeader title="Моделиор" hint={`${days} хоног`} />
        {data.byModel.length === 0 ? <Empty title="Өгөгдөл алга" /> : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.byModel.map((m) => (
              <Card key={`${m._id.model}-${m._id.version}`} className="p-4">
                <div className="text-[12px] font-semibold" style={{ color: T.text }}>{m._id.model}</div>
                <div className="text-[10px]" style={{ color: T.faint, fontFamily: MONO }}>{m._id.version || "—"}</div>
                <div className="mt-2 flex items-baseline gap-3" style={{ fontFamily: MONO }}>
                  <span className="text-[20px] font-bold" style={{ color: T.primaryInk }}>{m.count}</span>
                  <span className="text-[11px]" style={{ color: T.muted }}>{m.credits}₵ · {usd(m.usd)} · ~{Math.round((m.avgMs || 0) / 1000)}с</span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Recent generations */}
      <section>
        <SectionHeader title="Сүүлийн үүсгэлтүүд" hint="36 сүүлийн" />
        {data.recent.length === 0 ? <Empty title="Хоосон" /> : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {data.recent.map((g) => (
              <Card key={g._id} className="overflow-hidden">
                {g.status === "done" && g.url ? (
                  <a href={g.url} target="_blank" rel="noopener noreferrer" className="block aspect-square overflow-hidden bg-black">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={g.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                  </a>
                ) : (
                  <div className="flex aspect-square items-center justify-center p-3 text-center text-[10px]" style={{ color: T.badInk }}>
                    ✕ {g.error?.slice(0, 80) || "алдаа"}
                  </div>
                )}
                <div className="p-2">
                  <div className="truncate text-[10px] font-semibold" style={{ color: T.text }}>{g.user?.name || "—"}</div>
                  <div className="truncate text-[9px]" style={{ color: T.faint }} title={g.prompt}>{g.prompt}</div>
                  <div className="mt-1 flex items-center justify-between text-[9px]" style={{ fontFamily: MONO }}>
                    <span style={{ color: T.primaryInk }}>{g.cost}₵</span>
                    <span style={{ color: T.muted }}>{g.usdEstimate ? "≈" : ""}{usd(g.usd)}</span>
                    <span style={{ color: T.faint }}>{rel(g.createdAt)}</span>
                  </div>
                  <div className="truncate text-[8px]" style={{ color: T.faint }}>{g.modelVersion || g.modelId} · {g.aspectRatio} · {g.resolution === "hd" ? "2K" : "1K"}{g.refCount ? ` · ref×${g.refCount}` : ""}</div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
