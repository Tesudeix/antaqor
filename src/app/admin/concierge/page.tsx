"use client";

import { useCallback, useEffect, useState } from "react";
import { Btn, Card, SectionHeader, Skeleton, T } from "@/components/admin/kit";

/* ─── Messenger агент ─ нэг хуудас. Эзэн зөвхөн 5 талбар бөглөнө. ─────────── */

type Cfg = {
  enabled: boolean; includeInstagram: boolean; name: string; about: string; offers: string; facts: string; goal: string;
  rules: string; handoffPhone: string; address: "чи" | "та"; useThreads: boolean; useFeed: boolean; disclosure: boolean;
  waitSec: number; maxPerDay: number;
};
type Log = { _id: string; partner: string; inText: string; action: string; why: string; reply: string; ms: number; createdAt: string };
type Data = { cfg: Cfg | null; sources: { threads: number; feed: number }; logs: Log[]; stats: Record<string, number> };

const EMPTY: Cfg = { enabled: false, includeInstagram: false, name: "Antaqor", about: "", offers: "", facts: "", goal: "", rules: "", handoffPhone: "94641031", address: "чи", useThreads: true, useFeed: true, disclosure: true, waitSec: 6, maxPerDay: 30 };
const field: React.CSSProperties = { width: "100%", borderRadius: 8, border: `1px solid ${T.border}`, background: "#fff", color: T.text, padding: "10px 12px", fontSize: 14, outline: "none", lineHeight: 1.5 };
const lab: React.CSSProperties = { display: "block", marginBottom: 5, fontSize: 13, fontWeight: 800, color: T.text };
const hint: React.CSSProperties = { marginTop: 4, fontSize: 12.5, color: T.faint, lineHeight: 1.45 };
const ACT: Record<string, { t: string; c: string }> = {
  reply: { t: "Хариулсан", c: T.okInk }, skip: { t: "Чимээгүй", c: T.faint }, handoff: { t: "Танд шилжүүлсэн", c: T.warnInk }, error: { t: "AI алдаа", c: T.badInk },
};

export default function ConciergePage() {
  const [d, setD] = useState<Data | null>(null);
  const [c, setC] = useState<Cfg>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [chat, setChat] = useState<{ from: "me" | "them"; text: string; meta?: string }[]>([]);
  const [msg, setMsg] = useState("");
  const [thinking, setThinking] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/concierge", { cache: "no-store" });
    if (!r.ok) return;
    const x: Data = await r.json();
    setD(x); if (x.cfg) setC({ ...EMPTY, ...x.cfg });
  }, []);
  useEffect(() => { load(); }, [load]);

  const set = <K extends keyof Cfg>(k: K, v: Cfg[K]) => setC((p) => ({ ...p, [k]: v }));

  async function save(next?: Cfg) {
    const body = next || c;
    setBusy(true); setNote("");
    const r = await fetch("/api/admin/concierge", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    setNote(r.ok ? "✓ Хадгалагдлаа — 15 секундын дотор шинэ тохиргоо үйлчилнэ" : "Алдаа гарлаа");
    if (r.ok) load();
  }

  async function send() {
    const text = msg.trim();
    if (!text || thinking) return;
    // «them» (хэрэглэгч) ба «me» (агент) мессежийг ээлжлэн
    const next = [...chat, { from: "them" as const, text }];
    setChat(next); setMsg(""); setThinking(true);
    const r = await fetch("/api/admin/concierge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: next.map((m) => ({ from: m.from, text: m.text })), cfg: c }) });
    const o = r.ok ? await r.json() : null;
    setThinking(false);
    if (!o) { setChat([...next, { from: "me", text: "(алдаа)", meta: "error" }]); return; }
    setChat(o.action === "skip" || !o.reply ? [...next, { from: "me", text: "— чимээгүй —", meta: `skip · ${o.why}` }] : [...next, { from: "me", text: o.reply, meta: `${o.action}${o.why ? " · " + o.why : ""}` }]);
  }

  if (!d) return <div className="mx-auto max-w-4xl space-y-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-40" />)}</div>;
  const s = d.stats;
  const total = (s.reply || 0) + (s.skip || 0) + (s.handoff || 0);

  return (
    <div className="mx-auto max-w-4xl pb-24">
      <div className="mb-6">
        <h1 className="text-[28px] font-extrabold tracking-tight" style={{ color: T.text }}>Messenger агент</h1>
        <p className="mt-1 max-w-2xl text-[14px] leading-relaxed" style={{ color: T.muted }}>
          Хүнтэй чатлаж байгаа мэт: мессеж бүрт хариулахгүй, товч түлхэхгүй, богино бичнэ. Хариулах эсэхээ өөрөө шийднэ, мэдэхгүй зүйлээ танд шилжүүлнэ. Хэв маягийг Threads болон antaqor.com feed-ээс сурна.
        </p>
      </div>

      {/* ── Асаах ── */}
      <Card className="mb-8 flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <div className="text-[16px] font-extrabold" style={{ color: T.text }}>{c.enabled ? "Агент ажиллаж байна" : "Агент унтарсан"}</div>
          <div className="mt-0.5 text-[13px]" style={{ color: T.muted }}>
            {c.enabled ? "Facebook Messenger дээрх бичсэн мессежүүдэд энэ агент хариулна (хуучин цэс, товч, автомат хариу ХАМААРАХГҮЙ)." : "Асаагаагүй үед хуучин автомат хариу хэвээр ажиллана."}
          </div>
          {total > 0 && <div className="mt-1 text-[12.5px]" style={{ color: T.faint }}>7 хоног: хариулсан {s.reply || 0} · чимээгүй {s.skip || 0} · шилжүүлсэн {s.handoff || 0}{s.error ? ` · алдаа ${s.error}` : ""}</div>}
        </div>
        <Btn variant={c.enabled ? "secondary" : "primary"} onClick={() => { const n = { ...c, enabled: !c.enabled }; setC(n); save(n); }} loading={busy}>{c.enabled ? "Унтраах" : "Асаах"}</Btn>
      </Card>

      {/* ── Үндсэн мэдээлэл ── */}
      <SectionHeader title="Үндсэн мэдээлэл" hint="энэ 5 талбараас л агент хариулна" action={<Btn onClick={() => save()} loading={busy}>Хадгалах</Btn>} />
      <Card className="mb-8 space-y-5 p-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_1fr]">
          <div><label style={lab}>Нэр (хэн гэж танилцах)</label><input style={field} value={c.name} onChange={(e) => set("name", e.target.value)} /></div>
          <div><label style={lab}>Хандалт</label>
            <select style={field} value={c.address} onChange={(e) => set("address", e.target.value as "чи" | "та")}><option value="чи">«чи» — ойр, залуу</option><option value="та">«та» — албан</option></select></div>
          <div><label style={lab}>Танд шилжүүлэх утас</label><input style={field} value={c.handoffPhone} onChange={(e) => set("handoffPhone", e.target.value)} /></div>
        </div>
        <div><label style={lab}>1 · Би хэн бэ</label>
          <textarea style={field} rows={3} value={c.about} onChange={(e) => set("about", e.target.value)} placeholder="Жишээ: 27 настай, 4 жил AI салбарт. Antaqor — Монголын AI creator хүрээлэл. Ажилчингүй, өөрийн системээр ажилладаг." />
          <div style={hint}>2-3 өгүүлбэр хангалттай.</div></div>
        <div><label style={lab}>2 · Юу санал болгодог</label>
          <textarea style={field} rows={4} value={c.offers} onChange={(e) => set("offers", e.target.value)} placeholder={"7 хоногийн AI Creator сургалт (Plus / Pro / Max)\nAI Studio: зураг, видео бүтээх кредит\nAI агент / Messenger автоматжуулалт бизнесд"} />
          <div style={hint}>Мөр бүр нэг зүйл.</div></div>
        <div><label style={lab}>3 · Баримт — үнэ, огноо, нөхцөл, линк</label>
          <textarea style={field} rows={5} value={c.facts} onChange={(e) => set("facts", e.target.value)} placeholder={"Plus 9,000₮ — 4,500 кредит\nPro 49,000₮ — 15,000 кредит\nMax 100,000₮ — 30,000 кредит\nТөлбөр: antaqor.com/pricing, QPay эсвэл Хаан банк 5926153085\nСургалт: өнөөдөр 20:00 Zoom"} />
          <div style={hint}>Агент үнэ, огноог ЗӨВХӨН эндээс хэлнэ. Энд байхгүйг зохиохгүй — танд шилжүүлнэ.</div></div>
        <div><label style={lab}>4 · Зорилго</label>
          <textarea style={field} rows={2} value={c.goal} onChange={(e) => set("goal", e.target.value)} placeholder="Асуултад нь шууд хариулж, тохирвол antaqor.com/pricing руу чиглүүл. Бизнесийн хүнийг нь асуулт асуугаад ойлго." /></div>
        <div><label style={lab}>5 · Хориглох / онцгой дүрэм</label>
          <textarea style={field} rows={2} value={c.rules} onChange={(e) => set("rules", e.target.value)} placeholder={"Хөнгөлөлт амлахгүй. Буцаалтын асуудал бол надад шилжүүл.\nСургалтын агуулгыг урьдчилж задлахгүй."} /></div>
        {note && <p className="text-[13px] font-semibold" style={{ color: note.startsWith("✓") ? T.okInk : T.badInk }}>{note}</p>}
      </Card>

      {/* ── Эх сурвалж ── */}
      <SectionHeader title="Хэв маягаа хаанаас сурах вэ" hint="автоматаар шинэчлэгдэнэ" />
      <Card className="mb-8 p-5">
        <div className="flex flex-wrap gap-x-8 gap-y-3 text-[14px]">
          <label className="flex items-center gap-2"><input type="checkbox" checked={c.useThreads} onChange={(e) => set("useThreads", e.target.checked)} /> Threads постууд <b style={{ color: d.sources.threads ? T.okInk : T.badInk }}>{d.sources.threads ? `${d.sources.threads} уншсан` : "холбогдоогүй"}</b></label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={c.useFeed} onChange={(e) => set("useFeed", e.target.checked)} /> antaqor.com feed <b style={{ color: d.sources.feed ? T.okInk : T.badInk }}>{d.sources.feed ? `${d.sources.feed} уншсан` : "пост алга"}</b></label>
        </div>
        <details className="mt-4">
          <summary className="cursor-pointer text-[13px] font-bold" style={{ color: T.primaryInk }}>Нарийн тохиргоо</summary>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <div><label style={lab}>Хүлээх хугацаа (сек)</label><input style={field} type="number" value={c.waitSec} onChange={(e) => set("waitSec", Number(e.target.value))} /><div style={hint}>Хүн дараалан бичихэд бүгдийг нь уншаад нэг л хариулна.</div></div>
            <div><label style={lab}>Хүнд өдөрт дээд тал нь</label><input style={field} type="number" value={c.maxPerDay} onChange={(e) => set("maxPerDay", Number(e.target.value))} /></div>
            <div className="space-y-2 pt-6 text-[14px]">
              <label className="flex items-center gap-2"><input type="checkbox" checked={c.disclosure} onChange={(e) => set("disclosure", e.target.checked)} /> Эхний хариунд «AI туслах» гэж бичих</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={c.includeInstagram} onChange={(e) => set("includeInstagram", e.target.checked)} /> Instagram DM дээр бас</label>
            </div>
          </div>
          <div className="mt-3"><Btn variant="secondary" size="sm" onClick={() => save()} loading={busy}>Хадгалах</Btn></div>
        </details>
      </Card>

      {/* ── Туршиж үзэх ── */}
      <SectionHeader title="Туршиж үзэх" hint="юу ч илгээгдэхгүй · хадгалаагүй өөрчлөлтийг ч ашиглана" action={<button type="button" className="text-[13px] font-bold" style={{ color: T.primaryInk }} onClick={() => setChat([])}>Цэвэрлэх</button>} />
      <Card className="mb-8 p-5">
        <div className="mb-3 max-h-80 space-y-2 overflow-y-auto">
          {chat.length === 0 && <div className="text-[13px]" style={{ color: T.faint }}>Хэрэглэгч шиг бичээд агент яаж хариулахыг харна уу. «за», «баярлалаа» гэж бичвэл чимээгүй байх ёстой.</div>}
          {chat.map((m, i) => (
            <div key={i} className={m.from === "me" ? "flex justify-end" : "flex justify-start"}>
              <div className="max-w-[80%] rounded-2xl px-3.5 py-2 text-[14px]" style={m.from === "me" ? { background: "#2E29FF", color: "#fff" } : { background: "#F1F2F6", color: T.text }}>
                {m.text}{m.meta && <div className="mt-1 text-[11px] opacity-70">{m.meta}</div>}
              </div>
            </div>
          ))}
          {thinking && <div className="text-[13px]" style={{ color: T.faint }}>бичиж байна…</div>}
        </div>
        <div className="flex gap-2">
          <input style={field} value={msg} onChange={(e) => setMsg(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Хэрэглэгчийн мессеж…" />
          <Btn onClick={send} loading={thinking}>Илгээх</Btn>
        </div>
      </Card>

      {/* ── Шийдвэрүүд ── */}
      <SectionHeader title="Сүүлийн шийдвэрүүд" hint="яагаад хариулсан / хариулаагүй" />
      <Card className="p-0">
        {d.logs.length === 0 && <div className="p-6 text-center text-[13px]" style={{ color: T.faint }}>Одоохондоо хоосон</div>}
        {d.logs.map((l) => {
          const a = ACT[l.action] || ACT.skip;
          return (
            <div key={l._id} className="px-4 py-3 text-[13.5px]" style={{ borderBottom: `1px solid ${T.border}` }}>
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate"><b>{l.partner}</b>: <span style={{ color: T.muted }}>{l.inText}</span></span>
                <span className="shrink-0 text-[12px] font-extrabold" style={{ color: a.c }}>{a.t}</span>
              </div>
              {l.reply && <div className="mt-1" style={{ color: T.text }}>→ {l.reply}</div>}
              <div className="mt-0.5 text-[11.5px]" style={{ color: T.faint }}>{l.why}{l.why ? " · " : ""}{new Date(l.createdAt).toLocaleString("mn-MN")}{l.ms ? ` · ${(l.ms / 1000).toFixed(1)}с` : ""}</div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
