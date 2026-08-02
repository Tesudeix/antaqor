"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { T, MONO, Card, Btn, Skeleton } from "@/components/admin/kit";

// ─── АВТОМАТЖУУЛАЛТ — нэгдсэн Comment-Order Bot модуль ───
// 3 таб: Ботууд · Захиалгууд · Тохиргоо. Нэг бот = "пост дээр түлхүүр үг
// comment хийвэл → авто DM → захиалга". 4 алхамтай wizard, 2 минутад бэлэн.

interface Bot {
  _id: string;
  name: string;
  account: string;
  platform: "instagram" | "messenger" | "both";
  postId: string;
  keywords: string[];
  matchWholeWord: boolean;
  commentReply: string;
  dmText: string;
  dmImage: string;
  dmButtons: { label: string; url: string }[];
  collectOrders: boolean;
  products: { name: string; price: number }[];
  enabled: boolean;
  stats: { triggered: number; dmSent: number; orders: number };
  lastError: string;
}

interface Order {
  _id: string;
  username: string;
  partnerId: string;
  conversationId: string | null;
  product: string;
  qty: number;
  phone: string;
  phoneUnverified: boolean;
  address: string;
  status: "new" | "confirmed" | "paid" | "delivered";
  platform: string;
  createdAt: string;
}

interface Settings {
  account: string;
  enabled: boolean;
  greeting: string;
  conversationStarters: string[];
  defaultAction: string;
  defaultText: string;
  businessFaq: string;
  payText: string;
}

const ORDER_FLOW: Record<Order["status"], { label: string; next: Order["status"] | null; color: string }> = {
  new: { label: "Шинэ", next: "confirmed", color: "#1080CA" },
  confirmed: { label: "Баталгаажсан", next: "paid", color: "#F59E0B" },
  paid: { label: "Төлсөн", next: "delivered", color: "#4ADE80" },
  delivered: { label: "Хүргэсэн", next: null, color: "#8A8680" },
};

const ACCOUNTS = [
  ["antaqor", "Antaqor"],
  ["joymassage", "Joy Massage"],
  ["joybilliard", "Joy Billiard"],
] as const;

const EMPTY_FORM = {
  id: "",
  name: "",
  account: "antaqor",
  platform: "instagram" as Bot["platform"],
  postId: "",
  keywords: "үнэ, захиалга, +",
  matchWholeWord: false,
  commentReply: "{{username}} Танд DM илгээлээ 👋",
  dmText: "Сайн байна уу {{username}}! Сонирхсонд баярлалаа 🙌 Дэлгэрэнгүй мэдээллийг энд илгээж байна.",
  dmImage: "",
  collectOrders: true,
  products: [{ name: "", price: 0 }],
  enabled: true,
};
type Form = typeof EMPTY_FORM;

const INP =
  "w-full rounded-[4px] border border-[rgba(255,255,255,0.1)] bg-[#0a0a0c] px-3 py-2.5 text-[13px] text-[#F4F0E8] outline-none transition focus:border-[#1080CA]";

async function j<TT>(url: string, init?: RequestInit): Promise<TT> {
  const res = await fetch(url, init && { ...init, headers: { "Content-Type": "application/json" } });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data as TT;
}

function ago(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${Math.max(1, m)} мин`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} цаг`;
  return `${Math.floor(h / 24)} хоног`;
}

export default function AutomationPage() {
  const [tab, setTab] = useState<"bots" | "orders" | "settings">("bots");
  const [msg, setMsg] = useState("");

  // Ботууд
  const [bots, setBots] = useState<Bot[] | null>(null);
  const [wizard, setWizard] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<Form>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState("");

  // Захиалгууд
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [orderFilter, setOrderFilter] = useState<string>("");
  const [drawer, setDrawer] = useState<Order | null>(null);
  const [transcript, setTranscript] = useState<{ direction: string; text: string; createdAt: string }[] | null>(null);

  // Тохиргоо
  const [settings, setSettings] = useState<Settings | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);

  const flash = (t: string) => {
    setMsg(t);
    setTimeout(() => setMsg(""), 3000);
  };

  const loadBots = useCallback(() => {
    j<{ bots: Bot[] }>("/api/admin/automation/bots")
      .then((d) => setBots(d.bots))
      .catch(() => setBots([]));
  }, []);
  const loadOrders = useCallback((f: string) => {
    setOrders(null);
    j<{ orders: Order[] }>(`/api/admin/automation/orders${f ? `?status=${f}` : ""}`)
      .then((d) => setOrders(d.orders))
      .catch(() => setOrders([]));
  }, []);
  const loadSettings = useCallback(() => {
    j<Settings>("/api/admin/automation/settings?account=antaqor")
      .then(setSettings)
      .catch(() => {});
  }, []);

  useEffect(loadBots, [loadBots]);
  useEffect(() => {
    if (tab === "orders") loadOrders(orderFilter);
    if (tab === "settings" && !settings) loadSettings();
  }, [tab, orderFilter, loadOrders, loadSettings, settings]);

  const openWizard = (b?: Bot) => {
    setForm(
      b
        ? {
            id: b._id,
            name: b.name,
            account: b.account,
            platform: b.platform,
            postId: b.postId,
            keywords: b.keywords.join(", "),
            matchWholeWord: b.matchWholeWord,
            commentReply: b.commentReply,
            dmText: b.dmText,
            dmImage: b.dmImage,
            collectOrders: b.collectOrders,
            products: b.products.length ? b.products : [{ name: "", price: 0 }],
            enabled: b.enabled,
          }
        : { ...EMPTY_FORM }
    );
    setStep(1);
    setFormErr("");
    setWizard(true);
  };

  const saveBot = async () => {
    setSaving(true);
    setFormErr("");
    try {
      const payload = {
        ...form,
        name: form.name.trim() || `Бот: ${form.keywords.split(",")[0]?.trim() || "шинэ"}`,
        products: form.products.filter((p) => p.name.trim()),
      };
      if (form.id) await j("/api/admin/automation/bots", { method: "PUT", body: JSON.stringify(payload) });
      else await j("/api/admin/automation/bots", { method: "POST", body: JSON.stringify(payload) });
      setWizard(false);
      flash("✓ Бот хадгалагдаад асаалттай боллоо");
      loadBots();
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : "Алдаа");
    } finally {
      setSaving(false);
    }
  };

  const toggleBot = async (b: Bot) => {
    setBots((prev) => prev?.map((x) => (x._id === b._id ? { ...x, enabled: !x.enabled } : x)) ?? prev);
    await j("/api/admin/automation/bots", { method: "PUT", body: JSON.stringify({ id: b._id, enabled: !b.enabled }) }).catch(() => loadBots());
  };

  const deleteBot = async (b: Bot) => {
    if (!confirm(`«${b.name}» ботыг устгах уу?`)) return;
    await j("/api/admin/automation/bots", { method: "DELETE", body: JSON.stringify({ id: b._id }) }).catch(() => {});
    loadBots();
  };

  const advanceOrder = async (o: Order) => {
    const next = ORDER_FLOW[o.status].next;
    if (!next) return;
    setOrders((prev) => prev?.map((x) => (x._id === o._id ? { ...x, status: next } : x)) ?? prev);
    await j("/api/admin/automation/orders", { method: "PATCH", body: JSON.stringify({ id: o._id, status: next }) }).catch(() => loadOrders(orderFilter));
  };

  const openDrawer = (o: Order) => {
    setDrawer(o);
    setTranscript(null);
    if (o.conversationId) {
      j<{ messages: { direction: string; text: string; createdAt: string }[] }>(
        `/api/admin/automation/orders?transcript=${o.conversationId}`
      )
        .then((d) => setTranscript(d.messages))
        .catch(() => setTranscript([]));
    } else setTranscript([]);
  };

  const saveSettings = async () => {
    if (!settings) return;
    setSettingsSaving(true);
    try {
      await j("/api/admin/automation/settings", { method: "PUT", body: JSON.stringify(settings) });
      flash("✓ Тохиргоо хадгалагдлаа");
    } catch {
      flash("Хадгалж чадсангүй");
    } finally {
      setSettingsSaving(false);
    }
  };

  const kwList = form.keywords.split(",").map((s) => s.trim()).filter(Boolean);
  const stepValid =
    step === 1 || (step === 2 ? kwList.length > 0 : step === 3 ? form.dmText.trim().length > 5 : !form.collectOrders || form.products.some((p) => p.name.trim()));

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="chrome flex items-center gap-2 text-[9px] font-bold">
            <span className="text-[#1080CA]">[АВТОМАТ]</span>
            <span className="text-[#1080CA]">/////</span>
            <span style={{ color: T.faint }}>COMMENT → DM → ЗАХИАЛГА</span>
          </div>
          <h1 className="mt-1 text-[24px] font-bold" style={{ color: "#1080CA", fontFamily: "var(--font-display)" }}>
            Автоматжуулалт
          </h1>
        </div>
        {msg && <span className="text-[12px] font-bold" style={{ color: msg.startsWith("✓") ? "#4ADE80" : "#4FA8E8" }}>{msg}</span>}
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-1.5">
        {(
          [
            ["bots", "Ботууд"],
            ["orders", "Захиалгууд"],
            ["settings", "Тохиргоо"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`chrome rounded-[4px] px-4 py-2.5 text-[10px] font-bold transition ${
              tab === id ? "bg-[#1080CA] text-[#161618]" : "border border-[rgba(255,255,255,0.1)] text-[#8A8680] hover:text-[#F4F0E8]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ═══ БОТУУД ═══ */}
      {tab === "bots" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Btn onClick={() => openWizard()}>+ Шинэ бот</Btn>
          </div>
          {bots === null && [0, 1].map((i) => <Skeleton key={i} className="h-28" />)}
          {bots?.length === 0 && (
            <Card className="p-10 text-center">
              <p className="text-[13px]" style={{ color: T.muted }}>
                Пост дээр түлхүүр үг comment хийсэн хүнд авто DM илгээж, захиалга авъя.
              </p>
              <div className="mt-4 flex justify-center">
                <Btn onClick={() => openWizard()}>+ Эхний ботоо үүсгэх</Btn>
              </div>
            </Card>
          )}
          {(bots ?? []).map((b) => (
            <Card key={b._id} hud className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-bold" style={{ color: T.text }}>{b.name}</span>
                    <span className="chrome rounded-[4px] border border-[rgba(255,255,255,0.14)] px-1.5 py-0.5 text-[7px] font-bold" style={{ color: T.faint }}>
                      {b.platform === "both" ? "IG + FB" : b.platform.toUpperCase()}
                    </span>
                    <span className="chrome text-[8px]" style={{ color: T.faint }}>
                      {b.postId ? `ПОСТ: …${b.postId.slice(-6)}` : "БҮХ ПОСТ"} · {ACCOUNTS.find((a) => a[0] === b.account)?.[1] || b.account}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {b.keywords.map((k) => (
                      <span key={k} className="chrome rounded-[4px] bg-[#1080CA] px-2 py-1 text-[8px] font-bold text-[#161618]">{k}</span>
                    ))}
                  </div>
                  <div className="chrome mt-2.5 text-[8px] font-bold" style={{ color: T.faint, fontFamily: MONO }}>
                    TRIGGERED {b.stats?.triggered ?? 0} · DM {b.stats?.dmSent ?? 0} · ЗАХИАЛГА {b.stats?.orders ?? 0}
                    {b.collectOrders ? " · 🛒 ЗАХИАЛГА АВНА" : ""}
                  </div>
                  {b.lastError && (
                    <div className="mt-1.5 text-[11px]" style={{ color: "#4FA8E8" }}>Сүүлийн алдаа: {b.lastError}</div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => toggleBot(b)}
                    aria-label={b.enabled ? "Унтраах" : "Асаах"}
                    className={`chrome rounded-[4px] px-3 py-2 text-[9px] font-bold transition ${
                      b.enabled ? "bg-[#4ADE80]/15 text-[#4ADE80]" : "border border-[rgba(255,255,255,0.14)] text-[#8A8680]"
                    }`}
                  >
                    {b.enabled ? "● ON" : "○ OFF"}
                  </button>
                  <Btn size="sm" variant="ghost" onClick={() => openWizard(b)}>Засах</Btn>
                  <Btn size="sm" variant="danger" onClick={() => deleteBot(b)}>✕</Btn>
                </div>
              </div>
              <div className="mt-2 border-t pt-2" style={{ borderColor: T.border }}>
                <Link href="/admin/social-automation" className="chrome text-[8px] font-bold" style={{ color: T.faint }}>
                  ДЭЛГЭРЭНГҮЙ FLOW ЗАСВАРЛАГЧ →
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ═══ ЗАХИАЛГУУД ═══ */}
      {tab === "orders" && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {[["", "Бүгд"], ["new", "Шинэ"], ["confirmed", "Баталгаажсан"], ["paid", "Төлсөн"], ["delivered", "Хүргэсэн"]].map(([v, l]) => (
              <button
                key={v}
                onClick={() => setOrderFilter(v)}
                className={`chrome rounded-[4px] px-3 py-2 text-[9px] font-bold transition ${
                  orderFilter === v ? "bg-[#1080CA] text-[#161618]" : "border border-[rgba(255,255,255,0.1)] text-[#8A8680]"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
          {orders === null && [0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}
          {orders?.length === 0 && (
            <Card className="p-10 text-center">
              <p className="text-[13px]" style={{ color: T.muted }}>Захиалга ирэхээр энд жагсана. Бот идэвхтэй эсэхээ шалгаарай.</p>
            </Card>
          )}
          {orders && orders.length > 0 && (
            <Card>
              <div className="divide-y" style={{ borderColor: T.border }}>
                {orders.map((o) => (
                  <div key={o._id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <button onClick={() => openDrawer(o)} className="min-w-0 flex-1 text-left">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13px] font-bold" style={{ color: T.text }}>@{o.username || o.partnerId.slice(-6)}</span>
                        <span className="text-[12px]" style={{ color: T.muted, fontVariantNumeric: "tabular-nums" }}>
                          {o.product} × {o.qty}
                        </span>
                      </div>
                      <div className="chrome mt-0.5 text-[9px]" style={{ color: T.faint, fontFamily: MONO }}>
                        {o.phone}{o.phoneUnverified ? " (ШАЛГААГҮЙ)" : ""} · {o.address.slice(0, 40)} · {ago(o.createdAt)}
                      </div>
                    </button>
                    <button
                      onClick={() => advanceOrder(o)}
                      disabled={!ORDER_FLOW[o.status].next}
                      title={ORDER_FLOW[o.status].next ? `Дараагийн төлөв рүү` : ""}
                      className="chrome shrink-0 rounded-[4px] border px-3 py-1.5 text-[8px] font-bold transition disabled:opacity-60"
                      style={{ borderColor: ORDER_FLOW[o.status].color + "66", color: ORDER_FLOW[o.status].color }}
                    >
                      {ORDER_FLOW[o.status].label}{ORDER_FLOW[o.status].next ? " →" : " ✓"}
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ═══ ТОХИРГОО ═══ */}
      {tab === "settings" && (
        <div className="max-w-2xl space-y-4">
          {!settings ? (
            <Skeleton className="h-64" />
          ) : (
            <>
              <Card hud className="space-y-3 p-5">
                <div className="chrome text-[9px] font-bold" style={{ color: "#1080CA" }}>1 · ЭХНИЙ DM МЭНДЧИЛГЭЭ</div>
                <label className="flex items-center gap-2 text-[12px] font-bold" style={{ color: settings.enabled ? "#4ADE80" : T.faint }}>
                  <input type="checkbox" checked={settings.enabled} onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })} />
                  Шинэ хүнд автоматаар мэндчилнэ
                </label>
                <textarea
                  value={settings.greeting}
                  onChange={(e) => setSettings({ ...settings, greeting: e.target.value })}
                  rows={3}
                  placeholder="Сайн байна уу! Юугаар туслах вэ?"
                  className={INP}
                />
                <div>
                  <div className="chrome mb-1.5 text-[8px] font-bold" style={{ color: T.faint }}>ЯРИА ЭХЛҮҮЛЭГЧ ТОВЧНУУД (MAX 4)</div>
                  {[0, 1, 2, 3].map((i) => (
                    <input
                      key={i}
                      value={settings.conversationStarters[i] || ""}
                      onChange={(e) => {
                        const arr = [...settings.conversationStarters];
                        arr[i] = e.target.value;
                        setSettings({ ...settings, conversationStarters: arr.filter((x, idx) => x || idx <= i) });
                      }}
                      placeholder={["Үнэ асуух", "Захиалга өгөх", "", ""][i]}
                      className={`${INP} mb-1.5`}
                      maxLength={40}
                    />
                  ))}
                </div>
              </Card>

              <Card hud className="space-y-3 p-5">
                <div className="chrome text-[9px] font-bold" style={{ color: "#1080CA" }}>2 · ТҮЛХҮҮР ҮГ ТААРААГҮЙ ҮЕД</div>
                <select
                  value={settings.defaultAction}
                  onChange={(e) => setSettings({ ...settings, defaultAction: e.target.value })}
                  className={INP}
                >
                  <option value="smart">Ухаалаг (цэс / AI автоматаар)</option>
                  <option value="menu">Үндсэн цэс харуулах</option>
                  <option value="ai">AI-аар FAQ-аас хариулах</option>
                  <option value="text">Тогтмол текст илгээх</option>
                </select>
                {settings.defaultAction === "text" && (
                  <textarea value={settings.defaultText} onChange={(e) => setSettings({ ...settings, defaultText: e.target.value })} rows={2} className={INP} placeholder="Тогтмол хариу…" />
                )}
                {settings.defaultAction === "ai" && (
                  <textarea value={settings.businessFaq} onChange={(e) => setSettings({ ...settings, businessFaq: e.target.value })} rows={5} className={INP} placeholder="Бизнесийн FAQ — AI эндээс хариулна…" />
                )}
              </Card>

              <Card hud className="space-y-3 p-5">
                <div className="chrome text-[9px] font-bold" style={{ color: "#1080CA" }}>3 · ТӨЛБӨРИЙН МЭДЭЭЛЭЛ (захиалгын дараа илгээгдэнэ)</div>
                <textarea
                  value={settings.payText}
                  onChange={(e) => setSettings({ ...settings, payText: e.target.value })}
                  rows={3}
                  placeholder={"Хаан банк 5926153085\nХүлээн авагч: …\nГүйлгээний утга: утасны дугаараа бичнэ үү"}
                  className={INP}
                />
              </Card>

              <Btn onClick={saveSettings} loading={settingsSaving} className="w-full">Тохиргоо хадгалах</Btn>
            </>
          )}
        </div>
      )}

      {/* ═══ WIZARD — 4 алхам нэг дэлгэцэнд ═══ */}
      {wizard && (
        <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/70 sm:items-center sm:p-4" role="dialog" aria-modal="true" onClick={() => setWizard(false)}>
          <div className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-t-[8px] border bg-[#0E0E12] p-5 sm:rounded-[4px]" style={{ borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div className="chrome text-[10px] font-bold" style={{ color: "#1080CA" }}>
                {form.id ? "БОТ ЗАСАХ" : "ШИНЭ БОТ"} <span className="text-[#1080CA]">/////</span>
              </div>
              <button onClick={() => setWizard(false)} aria-label="Хаах" className="chrome rounded-[4px] border border-[rgba(255,255,255,0.14)] px-2.5 py-1.5 text-[9px] font-bold" style={{ color: T.faint }}>✕</button>
            </div>

            {/* Stepper */}
            <div className="mb-5 flex gap-1.5">
              {["Пост", "Түлхүүр үг", "Хариу", "Захиалга"].map((l, i) => (
                <button
                  key={l}
                  onClick={() => setStep(i + 1)}
                  className={`chrome flex-1 rounded-[4px] px-2 py-2 text-[8px] font-bold transition ${
                    step === i + 1 ? "bg-[#1080CA] text-[#0E0E10]" : step > i + 1 ? "bg-[#1080CA]/15 text-[#0E0E10]" : "border border-[rgba(255,255,255,0.1)] text-[#8A8680]"
                  }`}
                >
                  {i + 1} · {l}
                </button>
              ))}
            </div>

            <div className="grid gap-5 md:grid-cols-[1fr_240px]">
              <div className="space-y-3">
                {step === 1 && (
                  <>
                    <div>
                      <label className="chrome mb-1.5 block text-[8px] font-bold" style={{ color: T.faint }}>ХУУДАС</label>
                      <div className="flex flex-wrap gap-1.5">
                        {ACCOUNTS.map(([v, l]) => (
                          <button key={v} onClick={() => setForm({ ...form, account: v })}
                            className={`chrome rounded-[4px] px-3 py-2 text-[9px] font-bold ${form.account === v ? "bg-[#1080CA] text-[#161618]" : "border border-[rgba(255,255,255,0.1)] text-[#8A8680]"}`}>
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="chrome mb-1.5 block text-[8px] font-bold" style={{ color: T.faint }}>СУВАГ</label>
                      <div className="flex gap-1.5">
                        {([["instagram", "Instagram"], ["messenger", "Facebook"], ["both", "Хоёулаа"]] as const).map(([v, l]) => (
                          <button key={v} onClick={() => setForm({ ...form, platform: v })}
                            className={`chrome rounded-[4px] px-3 py-2 text-[9px] font-bold ${form.platform === v ? "bg-[#1080CA] text-[#161618]" : "border border-[rgba(255,255,255,0.1)] text-[#8A8680]"}`}>
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="chrome mb-1.5 block text-[8px] font-bold" style={{ color: T.faint }}>ПОСТ (хоосон = бүх пост)</label>
                      <input value={form.postId} onChange={(e) => setForm({ ...form, postId: e.target.value })} placeholder="Пост ID — хоосон бол бүх пост дээр ажиллана" className={INP} />
                    </div>
                    <div>
                      <label className="chrome mb-1.5 block text-[8px] font-bold" style={{ color: T.faint }}>БОТЫН НЭР</label>
                      <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ж: Шинэ бүтээгдэхүүний захиалга" className={INP} maxLength={120} />
                    </div>
                  </>
                )}
                {step === 2 && (
                  <>
                    <div>
                      <label className="chrome mb-1.5 block text-[8px] font-bold" style={{ color: T.faint }}>ТҮЛХҮҮР ҮГС (таслалаар)</label>
                      <input value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} placeholder="үнэ, захиалга, +" className={INP} />
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {kwList.map((k) => (
                          <span key={k} className="chrome rounded-[4px] bg-[#1080CA] px-2 py-1 text-[8px] font-bold text-[#161618]">{k}</span>
                        ))}
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-[12px]" style={{ color: T.muted }}>
                      <input type="checkbox" checked={!form.matchWholeWord} onChange={(e) => setForm({ ...form, matchWholeWord: !e.target.checked })} />
                      Comment дотор агуулагдсан бол таарна (унтраавал зөвхөн бүтэн үг)
                    </label>
                  </>
                )}
                {step === 3 && (
                  <>
                    <div>
                      <label className="chrome mb-1.5 block text-[8px] font-bold" style={{ color: T.faint }}>НИЙТЭД ХАРАГДАХ COMMENT ХАРИУ (сонголтоор)</label>
                      <input value={form.commentReply} onChange={(e) => setForm({ ...form, commentReply: e.target.value })} className={INP} maxLength={300} />
                    </div>
                    <div>
                      <label className="chrome mb-1.5 block text-[8px] font-bold" style={{ color: T.faint }}>DM МЕССЕЖ ({"{{username}}"} ашиглаж болно)</label>
                      <textarea value={form.dmText} onChange={(e) => setForm({ ...form, dmText: e.target.value })} rows={4} className={INP} maxLength={900} />
                    </div>
                    <div>
                      <label className="chrome mb-1.5 block text-[8px] font-bold" style={{ color: T.faint }}>ЗУРГИЙН ЛИНК (сонголтоор)</label>
                      <input value={form.dmImage} onChange={(e) => setForm({ ...form, dmImage: e.target.value })} placeholder="/uploads/… эсвэл https://…" className={INP} />
                    </div>
                  </>
                )}
                {step === 4 && (
                  <>
                    <label className="flex items-center gap-2 text-[13px] font-bold" style={{ color: form.collectOrders ? "#4ADE80" : T.muted }}>
                      <input type="checkbox" checked={form.collectOrders} onChange={(e) => setForm({ ...form, collectOrders: e.target.checked })} />
                      DM-ийн дараа захиалга авах (бүтээгдэхүүн → тоо → утас → хаяг)
                    </label>
                    {form.collectOrders && (
                      <div className="space-y-2">
                        <div className="chrome text-[8px] font-bold" style={{ color: T.faint }}>БҮТЭЭГДЭХҮҮН (MAX 6)</div>
                        {form.products.map((p, i) => (
                          <div key={i} className="flex gap-2">
                            <input value={p.name} onChange={(e) => setForm({ ...form, products: form.products.map((x, ix) => (ix === i ? { ...x, name: e.target.value } : x)) })} placeholder="Нэр" className={INP} maxLength={60} />
                            <input type="number" value={p.price || ""} onChange={(e) => setForm({ ...form, products: form.products.map((x, ix) => (ix === i ? { ...x, price: Number(e.target.value) || 0 } : x)) })} placeholder="Үнэ ₮" className={`${INP} w-32`} />
                            {form.products.length > 1 && (
                              <button onClick={() => setForm({ ...form, products: form.products.filter((_, ix) => ix !== i) })} className="chrome shrink-0 text-[10px]" style={{ color: T.faint }}>✕</button>
                            )}
                          </div>
                        ))}
                        {form.products.length < 6 && (
                          <button onClick={() => setForm({ ...form, products: [...form.products, { name: "", price: 0 }] })} className="chrome text-[9px] font-bold" style={{ color: "#1080CA" }}>
                            + Бүтээгдэхүүн нэмэх
                          </button>
                        )}
                        <p className="text-[11px]" style={{ color: T.faint }}>
                          Захиалга баталгаажмагц Тохиргоо-д бичсэн төлбөрийн мэдээлэл автоматаар илгээгдэнэ.
                        </p>
                      </div>
                    )}
                  </>
                )}
                {formErr && <p className="text-[12px] font-bold" style={{ color: "#4FA8E8" }}>{formErr}</p>}
                <div className="flex gap-2 pt-1">
                  {step > 1 && <Btn variant="ghost" onClick={() => setStep(step - 1)}>← Буцах</Btn>}
                  {step < 4 ? (
                    <Btn onClick={() => stepValid && setStep(step + 1)} disabled={!stepValid}>Дараах →</Btn>
                  ) : (
                    <Btn onClick={saveBot} loading={saving} disabled={!stepValid}>{form.id ? "Хадгалах" : "Бот асаах ⚡"}</Btn>
                  )}
                </div>
              </div>

              {/* Live DM preview */}
              <div className="hidden md:block">
                <div className="chrome mb-2 text-[8px] font-bold" style={{ color: T.faint }}>DM PREVIEW</div>
                <div className="rounded-[4px] border p-3" style={{ borderColor: T.border, background: "#0a0a0c" }}>
                  <div className="space-y-2 text-[11px] leading-snug">
                    <div className="ml-6 rounded-[4px] bg-[#1080CA] p-2 text-[#0E0E10]">
                      {form.dmText.replace(/\{\{\s*username\s*\}\}/gi, "@buyer") || "…"}
                    </div>
                    {form.collectOrders && form.products.filter((p) => p.name).length > 0 && (
                      <>
                        <div className="ml-6 rounded-[4px] bg-[#1080CA] p-2 text-[#0E0E10]">Аль бүтээгдэхүүнийг захиалах вэ?</div>
                        <div className="flex flex-wrap gap-1">
                          {form.products.filter((p) => p.name).map((p) => (
                            <span key={p.name} className="rounded-[4px] border border-[#1080CA]/50 px-2 py-1 text-[9px] text-[#1080CA]">{p.name}</span>
                          ))}
                        </div>
                        <div className="rounded-[4px] bg-[#1E1E21] p-2" style={{ color: T.muted }}>Хэдэн ширхэг? → Утас? → Хаяг? → Баталгаажуулах ✓</div>
                      </>
                    )}
                  </div>
                </div>
                <p className="chrome mt-2 text-[7px]" style={{ color: T.faint }}>ХЭРЭГЛЭГЧ БҮРТ ПОСТ ТУТАМД 1 УДАА Л ХАРИУЛНА</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ ORDER DRAWER ═══ */}
      {drawer && (
        <div className="fixed inset-0 z-[95] flex justify-end bg-black/60" role="dialog" aria-modal="true" onClick={() => setDrawer(null)}>
          <div className="h-full w-full max-w-md overflow-y-auto border-l bg-[#0E0E12] p-5" style={{ borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="chrome text-[9px] font-bold" style={{ color: "#1080CA" }}>ЗАХИАЛГА · @{drawer.username || drawer.partnerId.slice(-6)}</div>
                <div className="mt-1 text-[15px] font-bold" style={{ color: T.text, fontVariantNumeric: "tabular-nums" }}>
                  {drawer.product} × {drawer.qty}
                </div>
                <div className="chrome mt-0.5 text-[9px]" style={{ color: T.faint, fontFamily: MONO }}>
                  {drawer.phone} · {drawer.address}
                </div>
              </div>
              <button onClick={() => setDrawer(null)} aria-label="Хаах" className="chrome rounded-[4px] border border-[rgba(255,255,255,0.14)] px-2.5 py-1.5 text-[9px]" style={{ color: T.faint }}>✕</button>
            </div>
            <div className="chrome mb-2 text-[8px] font-bold" style={{ color: T.faint }}>ХАРИЛЦАН ЯРИА</div>
            {transcript === null && <Skeleton className="h-40" />}
            {transcript?.length === 0 && <p className="text-[12px]" style={{ color: T.faint }}>Яриа олдсонгүй.</p>}
            <div className="space-y-1.5">
              {(transcript ?? []).map((m, i) => (
                <div key={i} className={`max-w-[85%] rounded-[4px] p-2 text-[11px] leading-snug ${m.direction === "out" ? "ml-auto bg-[#1080CA] text-[#0E0E10]" : "bg-[#1E1E21] text-[#F4F0E8]"}`}>
                  {m.text}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
