"use client";

import { useMemo, useRef, useState } from "react";
import Icon from "@/components/Icon";
import { WEEKDAYS, WD_SHORT, pillarColor } from "@/lib/contentAgentRules";
import { api, send, type Accounts, type Brand, type Pillar, type Ready, type State } from "./agentTypes";
import s from "./Agent.module.css";

/* ─── Брэндийн тохиргоо ───────────────────────────────────────────────────
   Агентын хэмнэл · суваг · зураг · контентын багана · дуу хоолой / бриф.
   Бэлэн байдлын жагсаалт нь серверийн readiness()-тэй ижил дүрэмтэй —
   дутуу брэнд автоматаар ажиллахгүй. */

type Props = { state: State; accounts: Accounts | null; onSaved: (msg: string) => Promise<void>; onError: (msg: string) => void; onDeleted: () => void };
const CH = [
  { id: "threads", name: "Threads", note: "Хамгийн том суваг · 500 тэмдэгт" },
  { id: "facebook", name: "Facebook", note: "Хуудас · текст ба зураг" },
  { id: "instagram", name: "Instagram", note: "Зурагтай пост л явна" },
];
const clone = (b: Brand): Brand => JSON.parse(JSON.stringify(b));

function readiness(b: Brand): Ready {
  const items = [
    { label: "Ядаж нэг суваг", ok: b.channels.length > 0 },
    { label: "Нийтлэх цаг", ok: b.hours.length > 0 },
    { label: "Контентын багана", ok: b.pillars.some((p) => p.name.trim()) },
  ];
  if (b.channels.some((c) => c !== "threads")) items.push({ label: "Facebook / Instagram аккаунт", ok: !!b.metaAccount });
  if (b.channels.includes("threads")) items.push({ label: "Threads аккаунт", ok: !!b.threadsUserId });
  if (b.kind === "product") {
    items.push({ label: "Бүтээгдэхүүний нэр, тайлбар", ok: !!(b.product.name.trim() && b.product.description.trim()) });
    items.push({ label: "Ядаж 2 баталгаатай баримт", ok: b.product.facts.filter((f) => f.trim()).length >= 2 });
    items.push({ label: "CTA — хаанаас, яаж авах", ok: !!(b.product.cta.trim() || b.product.link.trim()) });
  }
  return { ok: items.every((i) => i.ok), items };
}

function ListEditor({ label, hint, items, onChange, placeholder, max = 12 }: { label: string; hint?: string; items: string[]; onChange: (v: string[]) => void; placeholder: string; max?: number }) {
  return (
    <div className={s.listEd}>
      <div className={s.listHead}><b>{label}</b>{hint && <span>{hint}</span>}</div>
      {items.map((v, i) => (
        <div key={i} className={s.listRow}>
          <span>{i + 1}</span>
          <input value={v} onChange={(e) => onChange(items.map((x, k) => (k === i ? e.target.value : x)))} placeholder={placeholder} />
          <button className={s.iconBtn} onClick={() => onChange(items.filter((_, k) => k !== i))} aria-label="Хасах"><Icon name="cancel" size={12} /></button>
        </div>
      ))}
      {items.length < max && <button className={s.addRow} onClick={() => onChange([...items, ""])}><Icon name="plus" size={12} />Нэмэх</button>}
    </div>
  );
}

export default function AgentSettings({ state, accounts, onSaved, onError, onDeleted }: Props) {
  const [f, setF] = useState<Brand>(() => clone(state.brand));
  const [orig, setOrig] = useState(() => JSON.stringify(state.brand));
  const [busy, setBusy] = useState("");
  const [askDelete, setAskDelete] = useState(false);
  const refInput = useRef<HTMLInputElement>(null);
  const dirty = JSON.stringify(f) !== orig;
  const ready = useMemo(() => readiness(f), [f]);
  const set = <K extends keyof Brand>(k: K, v: Brand[K]) => setF((x) => ({ ...x, [k]: v }));
  const setP = <K extends keyof Brand["product"]>(k: K, v: Brand["product"][K]) => setF((x) => ({ ...x, product: { ...x.product, [k]: v } }));
  const shareSum = f.pillars.reduce((a, p) => a + (Number(p.share) || 0), 0);
  const names = f.pillars.map((p) => p.name);
  const best = state.insight?.bestHour ? state.insight.bestHour.split("–").map(Number) : null;
  const imgPerWeek = f.imageMode === "auto" ? Math.round((f.postsPerWeek * f.imageShare) / 100) : 0;
  const targets = accounts?.targets || [];
  const meta = targets.find((t) => t.key === f.metaAccount);
  const thr = accounts?.threads.find((t) => t.threadsUserId === f.threadsUserId);

  async function save() {
    if (busy) return;
    setBusy("save");
    try {
      const body = { ...f, pillars: f.pillars.filter((p) => p.name.trim()), product: { ...f.product, usps: f.product.usps.filter((x) => x.trim()), facts: f.product.facts.filter((x) => x.trim()), banned: f.product.banned.filter((x) => x.trim()) } };
      await api("/api/admin/content-agent/brands", send("PUT", { brand: body }));
      setOrig(JSON.stringify(f));
      await onSaved("Тохиргоо хадгалагдлаа");
    } catch (e) { onError((e as Error).message); } finally { setBusy(""); }
  }
  async function uploadRef(fl: File) {
    setBusy("ref");
    try {
      const fd = new FormData(); fd.append("file", fl);
      const r = await api<{ path: string }>("/api/admin/social/image", { method: "POST", body: fd });
      setP("refImages", [...f.product.refImages, r.path].slice(0, 3));
    } catch (e) { onError((e as Error).message); } finally { setBusy(""); }
  }
  async function del() {
    setBusy("del");
    try { await api(`/api/admin/content-agent/brands?key=${encodeURIComponent(f.key)}`, { method: "DELETE" }); onDeleted(); }
    catch (e) { onError((e as Error).message); } finally { setBusy(""); setAskDelete(false); }
  }
  const toggleHour = (h: number) => set("hours", f.hours.includes(h) ? f.hours.filter((x) => x !== h) : [...f.hours, h]);
  const normalize = () => {
    if (!shareSum) return;
    const raw = f.pillars.map((p) => (p.share / shareSum) * 100);
    const r = raw.map(Math.floor); let rest = 100 - r.reduce((a, x) => a + x, 0);
    raw.map((x, i) => [x - Math.floor(x), i] as const).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (rest-- > 0) r[i]++; });
    set("pillars", f.pillars.map((p, i) => ({ ...p, share: r[i] })));
  };

  return (
    <div className={s.settings}>
      <div className={s.setGrid}>
        {/* ── Ажиллагаа ── */}
        <section className={s.card}>
          <div className={s.cardHead}><h2>Агентын ажиллагаа</h2><span className={s.readyPill} data-ok={ready.ok}>{ready.ok ? <><Icon name="check" size={12} />Бэлэн</> : `${ready.items.filter((i) => !i.ok).length} зүйл дутуу`}</span></div>
          <label className={s.switchRow} data-on={f.active}>
            <input type="checkbox" checked={f.active} disabled={!ready.ok && !f.active} onChange={(e) => set("active", e.target.checked)} />
            <span className={s.switch}><i /></span>
            <div>
              <b>Автомат горим</b>
              <p>{f.active ? <>Агент <u>{WEEKDAYS[f.runWeekday - 1]}</u> бүр <u>{String(f.runHour).padStart(2, "0")}:00</u>-д ирэх 7 хоногийн төлөвлөгөө, ноорог, зургийг өөрөө бэлдэж танд мэдэгдэнэ.</> : "Унтраалттай — төлөвлөгөөг зөвхөн «Төлөвлөгөө гаргах» дарж эхлүүлнэ."}</p>
            </div>
          </label>
          <div className={s.runRow}>
            <div className={s.field}><span>Ажиллах гараг</span><div className={s.dayPick}>{WD_SHORT.map((d, i) => <button key={d} aria-pressed={f.runWeekday === i + 1} onClick={() => set("runWeekday", i + 1)}>{d}</button>)}</div></div>
            <label className={s.field}><span>Цаг</span><select value={f.runHour} onChange={(e) => set("runHour", Number(e.target.value))}>{Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}</select></label>
          </div>
          <ul className={s.readyList}>{ready.items.map((i) => <li key={i.label} data-ok={i.ok}><Icon name={i.ok ? "check" : "cancel"} size={12} />{i.label}</li>)}</ul>
          <div className={s.lockRow}><Icon name="lock" size={16} /><div><b>Батлалт: пост бүрийг хүн батална</b><p>Агент брэндийн нэрээр өөрөө нийтлэхгүй. 2–3 долоо хоног туршсаны дараа итгэлтэй баганыг автоматаар батлах сонголтыг нээж болно.</p></div></div>
        </section>

        {/* ── Хэмнэл ── */}
        <section className={s.card}>
          <div className={s.cardHead}><h2>Хэмнэл ба цаг</h2><small>УБ цагаар</small></div>
          <div className={s.stepRow}>
            <div><span className={s.lbl}>7 хоногт</span>
              <div className={s.stepper}>
                <button onClick={() => set("postsPerWeek", Math.max(1, f.postsPerWeek - 1))} aria-label="Хасах">−</button>
                <b>{f.postsPerWeek}</b>
                <button onClick={() => set("postsPerWeek", Math.min(21, f.postsPerWeek + 1))} aria-label="Нэмэх">+</button>
              </div><em>пост</em>
            </div>
            <div className={s.dotWeek} aria-hidden>
              {WD_SHORT.map((d, i) => <div key={d}><span>{d}</span>{Array.from({ length: f.maxPerDay }, (_, k) => <i key={k} data-on={k * 7 + i < f.postsPerWeek} />)}</div>)}
            </div>
          </div>
          <div className={s.field}><span>Өдөрт дээд тал нь (бусад товлосон постыг оруулаад)</span>
            <div className={s.seg}>{[1, 2, 3, 4].map((n) => <button key={n} aria-pressed={f.maxPerDay === n} onClick={() => set("maxPerDay", n)}>{n}</button>)}</div>
          </div>
          <div className={s.field}>
            <span>Нийтлэх цагууд — эхнийх нь гол {best && <em className={s.bestNote}>● өгөгдлөөр шилдэг: {state.insight?.bestHour}</em>}</span>
            <div className={s.hourGrid}>
              {Array.from({ length: 18 }, (_, i) => i + 6).map((h) => {
                const idx = f.hours.indexOf(h);
                return <button key={h} aria-pressed={idx >= 0} data-best={!!best && h >= best[0] && h < (best[1] || 24)} onClick={() => toggleHour(h)}>{String(h).padStart(2, "0")}{idx === 0 && <em>гол</em>}{idx > 0 && <em>{idx + 1}</em>}</button>;
              })}
            </div>
            {f.hours.length > 1 && <div className={s.hourOrder}>{f.hours.map((h, i) => <button key={h} className={s.chip} onClick={() => set("hours", [h, ...f.hours.filter((x) => x !== h)])} disabled={i === 0} title="Гол цаг болгох">{i === 0 ? "★ " : ""}{String(h).padStart(2, "0")}:00</button>)}</div>}
          </div>
        </section>

        {/* ── Сувгууд ── */}
        <section className={s.card}>
          <div className={s.cardHead}><h2>Сувгууд</h2><a className={s.textLink} href="/admin/connections">Аккаунт холбох ↗</a></div>
          <div className={s.chList}>
            {CH.map((c) => {
              const on = f.channels.includes(c.id);
              const health = c.id === "threads" ? (thr ? { ok: thr.ok, label: `@${thr.username}`, error: thr.error } : null) : meta ? meta[c.id as "facebook" | "instagram"] : null;
              return (
                <div key={c.id} className={s.chItem} data-on={on}>
                  <label className={s.switchMini}><input type="checkbox" checked={on} onChange={(e) => set("channels", e.target.checked ? [...f.channels, c.id] : f.channels.filter((x) => x !== c.id))} /><span className={s.switch}><i /></span></label>
                  <i className={`${s.pdot} ${s["p_" + c.id]}`}>{c.id === "instagram" ? "IG" : c.id === "facebook" ? "FB" : "TH"}</i>
                  <div className={s.chInfo}><b>{c.name}</b><span>{c.note}</span></div>
                  {on && (health ? <span className={s.health} data-ok={health.ok} title={health.error}>{health.ok ? health.label || "Холбогдсон" : health.error || "Алдаа"}</span> : <span className={s.health} data-ok={false}>Аккаунт сонгоогүй</span>)}
                </div>
              );
            })}
          </div>
          <div className={s.acctRow}>
            {f.channels.some((c) => c !== "threads") && (
              <label className={s.field}><span>Facebook / Instagram аккаунт</span>
                <select value={f.metaAccount} onChange={(e) => set("metaAccount", e.target.value)}>
                  <option value="">— сонгох —</option>
                  {targets.map((t) => <option key={t.key} value={t.key}>{t.label || t.key} · {t.facebook.ok ? "FB ✓" : "FB ✗"} {t.instagram.ok ? "IG ✓" : "IG ✗"}</option>)}
                </select>
              </label>
            )}
            {f.channels.includes("threads") && (
              <label className={s.field}><span>Threads аккаунт</span>
                <select value={f.threadsUserId} onChange={(e) => set("threadsUserId", e.target.value)}>
                  <option value="">— сонгох —</option>
                  {(accounts?.threads || []).map((t) => <option key={t.threadsUserId} value={t.threadsUserId}>@{t.username} {t.ok ? "✓" : "✗"}</option>)}
                </select>
              </label>
            )}
          </div>
          {f.key !== "antaqor" && (f.metaAccount === "antaqor" || (thr && /antaqor/i.test(thr.username))) && (
            <p className={s.warnLine}><Icon name="alert" size={16} />Анхаар: {f.name}-ийн постууд Antaqor-ын аккаунтад нийтлэгдэнэ. {f.name}-ийн өөрийн хуудсыг «Аккаунт холбох»-оос нэмнэ үү.</p>
          )}
        </section>

        {/* ── Зураг ── */}
        <section className={s.card}>
          <div className={s.cardHead}><h2>Зураг</h2><small>Nano Banana · ~$0.07 / зураг</small></div>
          <div className={s.modeCards}>
            {([["auto", "Автомат", "Агент зурагтай постуудад өөрөө зураг үүсгэнэ"], ["manual", "Гараар", "Зургийг та нэмнэ эсвэл товч дарж үүсгэнэ"], ["off", "Унтраах", "Зөвхөн текст пост (Instagram явахгүй)"]] as const).map(([k, t, d]) => (
              <button key={k} aria-pressed={f.imageMode === k} onClick={() => set("imageMode", k)}><b>{t}</b><span>{d}</span></button>
            ))}
          </div>
          {f.imageMode !== "off" && (
            <div className={s.field}>
              <span>Зурагтай постын хувь — <b>{f.imageShare}%</b> <em className={s.muted}>({f.postsPerWeek} постын ~{Math.round((f.postsPerWeek * f.imageShare) / 100)} нь{imgPerWeek ? ` · 7 хоногт ~$${(imgPerWeek * 0.07).toFixed(2)}` : ""})</em></span>
              <input type="range" min={0} max={100} step={10} value={f.imageShare} onChange={(e) => set("imageShare", Number(e.target.value))} className={s.range} />
            </div>
          )}
          <label className={s.field}><span>Харагдах хэв маяг (зураг бүрт нэмэгдэнэ)</span><textarea rows={3} value={f.visualStyle} onChange={(e) => set("visualStyle", e.target.value)} placeholder="English: lighting, palette, mood, setting…" /></label>
        </section>

        {/* ── Контентын багана ── */}
        <section className={`${s.card} ${s.span2}`}>
          <div className={s.cardHead}><h2>Контентын багана</h2>
            <span className={s.sumPill} data-ok={shareSum === 100}>Нийт {shareSum}%{shareSum !== 100 && <button onClick={normalize}>100 болгох</button>}</span>
          </div>
          <div className={s.mixBar}>{f.pillars.map((p, i) => <i key={i} style={{ flex: Math.max(1, p.share), background: pillarColor(p.name, names) }} />)}</div>
          <div className={s.pillars}>
            {f.pillars.map((p, i) => (
              <div key={i} className={s.pillarRow}>
                <i style={{ background: pillarColor(p.name, names) }} />
                <input className={s.pName} value={p.name} onChange={(e) => set("pillars", f.pillars.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} placeholder="Нэр" />
                <input className={s.pHint} value={p.hint} onChange={(e) => set("pillars", f.pillars.map((x, k) => (k === i ? { ...x, hint: e.target.value } : x)))} placeholder="Агентад өгөх заавар — юу бичих вэ" />
                <div className={s.pShare}><input type="number" min={0} max={100} value={p.share} onChange={(e) => set("pillars", f.pillars.map((x, k) => (k === i ? { ...x, share: Number(e.target.value) || 0 } : x)))} /><span>%</span></div>
                <button className={s.iconBtn} onClick={() => set("pillars", f.pillars.filter((_, k) => k !== i))} aria-label="Хасах"><Icon name="trash" size={16} /></button>
              </div>
            ))}
          </div>
          {f.pillars.length < 8 && <button className={s.addRow} onClick={() => set("pillars", [...f.pillars, { name: "", share: 0, hint: "" } as Pillar])}><Icon name="plus" size={12} />Багана нэмэх</button>}
        </section>

        {/* ── Дуу хоолой / бриф ── */}
        {f.kind === "personal" ? (
          <section className={`${s.card} ${s.span2}`}>
            <div className={s.cardHead}><h2>Брэндийн дуу хоолой</h2><a className={s.textLink} href="/admin/social/loop">Брэндийн цөм засах ↗</a></div>
            {state.voice && (
              <div className={s.voice}>
                <div><span>Байр суурь</span><b>{state.voice.positioning}</b></div>
                <div><span>Уриа</span><b>{state.voice.tagline}</b></div>
                <div><span>Үнэт зүйлс</span><p className={s.valueChips}>{state.voice.values.map((v) => <em key={v}>{v}</em>)}</p></div>
              </div>
            )}
            <p className={s.muted}>Агент энэ цөм + шилдэг постуудаас сурсан playbook + таны Threads-ийн бичих дүрмээр бичнэ.</p>
            <label className={s.field}><span>Нэмэлт заавар <em className={s.muted}>заавал биш</em></span><textarea rows={3} value={f.voiceNotes} onChange={(e) => set("voiceNotes", e.target.value)} placeholder="Жишээ: энэ сард AI agent сэдвийг илүү онцол; хичээлийн үнийг бүү дурд" /></label>
          </section>
        ) : (
          <section className={`${s.card} ${s.span2}`}>
            <div className={s.cardHead}><h2>Бүтээгдэхүүний бриф</h2><small>Агент зөвхөн эндээс баримт авна</small></div>
            <div className={s.briefGrid}>
              <label className={s.field}><span>Брэнд / бүтээгдэхүүний нэр *</span><input value={f.product.name} onChange={(e) => setP("name", e.target.value)} placeholder={f.name} /></label>
              <label className={s.field}><span>Нэг өгүүлбэрээр</span><input value={f.product.oneLiner} onChange={(e) => setP("oneLiner", e.target.value)} placeholder="Юу вэ, хэнд зориулсан" /></label>
              <label className={`${s.field} ${s.span2}`}><span>Дэлгэрэнгүй тайлбар *</span><textarea rows={4} value={f.product.description} onChange={(e) => setP("description", e.target.value)} placeholder="Бүтээгдэхүүн юу хийдэг, юугаар хийгдсэн, яагаад өөр" /></label>
              <label className={s.field}><span>Хэнд (худалдан авагч)</span><input value={f.product.audience} onChange={(e) => setP("audience", e.target.value)} placeholder="25–40 насны залуу ээжүүд, УБ" /></label>
              <label className={s.field}><span>Үнэ</span><input value={f.product.price} onChange={(e) => setP("price", e.target.value)} placeholder="49,000₮" /></label>
              <label className={s.field}><span>Санал / урамшуулал</span><input value={f.product.offer} onChange={(e) => setP("offer", e.target.value)} placeholder="2 ширхэг авбал хүргэлт үнэгүй" /></label>
              <label className={s.field}><span>CTA — яаж авах *</span><input value={f.product.cta} onChange={(e) => setP("cta", e.target.value)} placeholder="Мессежээр захиалаарай / 9911-xxxx" /></label>
              <label className={`${s.field} ${s.span2}`}><span>Холбоос</span><input value={f.product.link} onChange={(e) => setP("link", e.target.value)} placeholder="https://…" /></label>
            </div>
            <div className={s.briefLists}>
              <ListEditor label="Давуу тал" items={f.product.usps} onChange={(v) => setP("usps", v)} placeholder="Жишээ: 100% хөвөн" />
              <ListEditor label="Баталгаатай баримт *" hint="Агент эдгээрээс өөр тоо, баримт бичихгүй" items={f.product.facts} onChange={(v) => setP("facts", v)} placeholder="Жишээ: 2024 оноос хойш 3 салбартай" max={30} />
              <ListEditor label="Хэзээ ч бичихгүй" hint="Хориотой үг, амлалт" items={f.product.banned} onChange={(v) => setP("banned", v)} placeholder="Жишээ: эмчилнэ, 100% баталгаа" />
            </div>
            <div className={s.refs}>
              <div className={s.listHead}><b>Бүтээгдэхүүний бодит зураг</b><span>AI зураг эдгээрийг лавлаж бодит бүтээгдэхүүнийг харуулна · 3 хүртэл</span></div>
              <div className={s.refRow}>
                {f.product.refImages.map((u) => <div key={u} className={s.refImg}><img src={u} alt="" /><button onClick={() => setP("refImages", f.product.refImages.filter((x) => x !== u))} aria-label="Хасах"><Icon name="cancel" size={12} /></button></div>)}
                {f.product.refImages.length < 3 && <button className={s.refAdd} onClick={() => refInput.current?.click()} disabled={busy === "ref"}>{busy === "ref" ? <i className={s.spin} /> : <><Icon name="upload" size={16} />Зураг нэмэх</>}</button>}
                <input ref={refInput} type="file" accept="image/*" hidden onChange={(e) => { const fl = e.target.files?.[0]; if (fl) void uploadRef(fl); e.target.value = ""; }} />
              </div>
            </div>
            <label className={s.field}><span>Дуу хоолой, өнгө аяс</span><textarea rows={2} value={f.voiceNotes} onChange={(e) => set("voiceNotes", e.target.value)} placeholder="Жишээ: дулаан, энгийн, «та» гэж хандана, emoji бага" /></label>
          </section>
        )}

        {f.key !== "antaqor" && (
          <section className={`${s.card} ${s.span2} ${s.dangerCard}`}>
            <div className={s.cardHead}><h2>Брэнд устгах</h2></div>
            <p className={s.muted}>Төлөвлөгөөнүүд архивлагдана. Аль хэдийн товлогдсон постууд Content Studio-д хэвээр үлдэнэ.</p>
            {askDelete
              ? <div className={s.modalActs}><button className={s.btn} onClick={() => setAskDelete(false)}>Болих</button><button className={s.danger} onClick={del} disabled={busy === "del"}>{f.name}-ийг устгах</button></div>
              : <button className={s.btn} onClick={() => setAskDelete(true)}><Icon name="trash" size={16} />Устгах…</button>}
          </section>
        )}
      </div>

      <div className={s.saveBar} data-show={dirty}>
        <span>{dirty ? "Хадгалаагүй өөрчлөлт байна" : "Бүх өөрчлөлт хадгалагдсан"}</span>
        <button className={s.btn} onClick={() => setF(clone(JSON.parse(orig)))} disabled={!dirty || !!busy}>Болих</button>
        <button className={s.primary} onClick={save} disabled={!dirty || !!busy}>{busy === "save" ? <><i className={s.spin} />Хадгалж байна…</> : "Хадгалах"}</button>
      </div>
    </div>
  );
}
