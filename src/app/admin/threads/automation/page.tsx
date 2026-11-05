"use client";

// Threads Engagement Automation — control center.
// 5 screens (tabs): Dashboard · Automations · Builder · Logs · Accounts.
// Event source is POLLING (cron /api/cron/threads-automation every 5 min):
// the Threads API has no like/comment webhooks, and never exposes WHO liked.

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { T, MONO, Card, Btn, SectionHeader, Empty, Skeleton, Spinner } from "@/components/admin/kit";

// ── Types ──
interface Automation {
  _id: string;
  name: string;
  triggerType: "new_comment" | "new_like";
  scope: "all" | "post" | "hashtag";
  scopeValue: string;
  threadsUserId: string;
  keywords: string[];
  matchMode: string;
  caseSensitive: boolean;
  excludeKeywords: string[];
  firstTimeOnly: boolean;
  activeFrom: number;
  activeTo: number;
  action: "reply" | "log_lead" | "reply_and_log";
  replyTemplate: string;
  replyVariations: string[];
  leadLabel: string;
  enabled: boolean;
  hitCount: number;
  lastFiredAt?: string;
}
interface LogRow {
  _id: string; replyId: string; eventType: "comment" | "like"; postId: string;
  username: string; replyText: string; status: "sent" | "error" | "skipped" | "seeded";
  triggerName?: string; actionTaken?: string; sentText?: string; error?: string;
  retryCount: number; createdAt: string;
}
interface Account {
  threadsUserId: string; username: string; status: "active" | "reconnect_needed";
  backoffUntil: string | null; failCount: number; expiresAt: string; automations: number;
}
interface Stats {
  triggersToday: number; sentToday: number; errorsToday: number; sentWeek: number;
  sentHour: number; leadsToday: number; activeAutomations: number;
  topPost: { postId: string; count: number } | null;
  topAutomations: { _id: string; name: string; hitCount: number; enabled: boolean; triggerType: string }[];
}

const emptyForm = {
  name: "", triggerType: "new_comment" as const, scope: "all" as const, scopeValue: "",
  threadsUserId: "", keywords: "", matchMode: "contains", caseSensitive: false,
  excludeKeywords: "", firstTimeOnly: false, activeFrom: 0, activeTo: 0,
  action: "reply" as const, replyTemplate: "", replyVariations: "", leadLabel: "", enabled: true,
};
type FormState = { [K in keyof typeof emptyForm]: (typeof emptyForm)[K] extends boolean ? boolean : (typeof emptyForm)[K] extends number ? number : string } & { _id?: string };

// ── Templates library — 3 prebuilt automations ──
const TEMPLATES: { title: string; desc: string; form: Partial<FormState> }[] = [
  {
    title: "Линк асуусан хүнд Day 1 илгээх",
    desc: "«линк, эхлэх, хаанаас» гэвэл шууд хариу + lead",
    form: {
      name: "Funnel: линк → Day 1", triggerType: "new_comment", matchMode: "contains",
      keywords: "линк, link, эхлэх, хаанаас, суудал",
      action: "reply_and_log", leadLabel: "threads-funnel",
      replyTemplate: "{{username}} Day 1: ChatGPT — нэгдсэн өдрөө 6 цагаас эхэлнэ 🔥 antaqor.com (өнөөдрийн 20 суудлаас цөөхөн үлдсэн)",
    },
  },
  {
    title: "Үнэ асуусан хүнд хариулах",
    desc: "«үнэ, хэд» гэвэл Runner үнэ + баталгааг хэлнэ",
    form: {
      name: "Үнэ → Runner 9,900₮", triggerType: "new_comment", matchMode: "contains",
      keywords: "үнэ, price, hed, хэд, төлбөр",
      action: "reply_and_log", leadLabel: "price-ask",
      replyTemplate: "{{username}} Runner plan сард 9,900₮ — бүх курс, prompt сан нээгдэнэ. Төлбөрийн дараа шууд идэвхжинэ: antaqor.com",
    },
  },
  {
    title: "Бүх шинэ сэтгэгдэлд баярлалаа",
    desc: "Түлхүүр үг шаардахгүй — анх удаа бичсэн хүн бүрд",
    form: {
      name: "Бүх сэтгэгдэлд хариулах", triggerType: "new_comment", matchMode: "any",
      action: "reply", firstTimeOnly: true,
      replyTemplate: "{{username}} баярлалаа 🔥 AI-г хамтдаа сурцгаая — antaqor.com",
    },
  },
  {
    title: "Сэтгэгдэл → Lead бүртгэх",
    desc: "«авах, захиалах» гэсэн хүнийг CRM-д хадгална",
    form: {
      name: "Сонирхогчийг lead болгох", triggerType: "new_comment", matchMode: "contains",
      keywords: "авах, захиалах, утас, бүртгүүлэх", action: "reply_and_log", leadLabel: "lead",
      replyTemplate: "{{username}} баярлалаа! Тантай удахгүй холбогдоно 🤝",
    },
  },
];

const TABS = [
  { id: "dash", label: "Хяналт" },
  { id: "autos", label: "Automation" },
  { id: "builder", label: "Бүтээгч" },
  { id: "logs", label: "Лог" },
  { id: "accounts", label: "Акаунт" },
] as const;
type TabId = (typeof TABS)[number]["id"];

async function j<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init && { ...init, headers: { "Content-Type": "application/json", ...(init.headers || {}) } });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data as T;
}

export default function ThreadsAutomationPage() {
  const [tab, setTab] = useState<TabId>("dash");
  const [msg, setMsg] = useState("");

  // dashboard
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsErr, setStatsErr] = useState("");
  const [settings, setSettings] = useState<{ killSwitch: boolean; maxPerHour: number } | null>(null);
  const [running, setRunning] = useState(false);
  // automations
  const [autos, setAutos] = useState<Automation[] | null>(null);
  const [autosErr, setAutosErr] = useState("");
  // builder
  const [form, setForm] = useState<FormState>({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState("");
  // logs
  const [logs, setLogs] = useState<LogRow[] | null>(null);
  const [logCounts, setLogCounts] = useState<Record<string, number> | null>(null);
  const [logFilter, setLogFilter] = useState("");
  const [logsErr, setLogsErr] = useState("");
  const [retrying, setRetrying] = useState<string | null>(null);
  // accounts
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [accountsErr, setAccountsErr] = useState("");

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 4000); };

  const loadStats = useCallback(async () => {
    setStatsErr("");
    try {
      const [s, cfg] = await Promise.all([
        j<Stats>("/api/admin/threads/stats"),
        j<{ settings: { killSwitch: boolean; maxPerHour: number } }>("/api/admin/threads/settings"),
      ]);
      setStats(s); setSettings(cfg.settings);
    } catch (e) { setStatsErr(e instanceof Error ? e.message : "Алдаа"); }
  }, []);

  const loadAutos = useCallback(async () => {
    setAutosErr("");
    try { setAutos((await j<{ triggers: Automation[] }>("/api/admin/threads/triggers")).triggers); }
    catch (e) { setAutosErr(e instanceof Error ? e.message : "Алдаа"); }
  }, []);

  const loadLogs = useCallback(async (filter: string) => {
    setLogsErr("");
    try {
      const d = await j<{ logs: LogRow[]; counts: Record<string, number> }>(
        `/api/admin/threads/automation-log${filter ? `?status=${filter}` : ""}`
      );
      setLogs(d.logs); setLogCounts(d.counts);
    } catch (e) { setLogsErr(e instanceof Error ? e.message : "Алдаа"); }
  }, []);

  const loadAccounts = useCallback(async () => {
    setAccountsErr("");
    try { setAccounts((await j<{ accounts: Account[] }>("/api/admin/threads/accounts")).accounts); }
    catch (e) { setAccountsErr(e instanceof Error ? e.message : "Алдаа"); }
  }, []);

  useEffect(() => { loadStats(); loadAutos(); loadAccounts(); }, [loadStats, loadAutos, loadAccounts]);
  useEffect(() => { loadLogs(logFilter); }, [logFilter, loadLogs]);

  // ── actions ──
  const runNow = async () => {
    setRunning(true);
    try {
      const r = await j<{ sent: number; scanned: number; killed?: boolean }>("/api/cron/threads-automation", { method: "POST" });
      flash(r.killed ? "Kill switch идэвхтэй — юу ч ажиллаагүй" : `Ажиллалаа: ${r.scanned} шалгаж, ${r.sent} илгээв`);
      loadStats(); loadLogs(logFilter);
    } catch (e) { flash(e instanceof Error ? e.message : "Алдаа"); }
    finally { setRunning(false); }
  };

  const toggleKill = async () => {
    if (!settings) return;
    const next = !settings.killSwitch;
    setSettings({ ...settings, killSwitch: next });
    try { await j("/api/admin/threads/settings", { method: "PATCH", body: JSON.stringify({ killSwitch: next }) }); }
    catch { setSettings({ ...settings }); }
  };

  const saveRate = async (n: number) => {
    if (!settings) return;
    setSettings({ ...settings, maxPerHour: n });
    try { await j("/api/admin/threads/settings", { method: "PATCH", body: JSON.stringify({ maxPerHour: n }) }); } catch { /* keep UI */ }
  };

  const toggleAuto = async (a: Automation) => {
    setAutos((prev) => prev?.map((x) => (x._id === a._id ? { ...x, enabled: !a.enabled } : x)) || null);
    try { await j(`/api/admin/threads/triggers/${a._id}`, { method: "PATCH", body: JSON.stringify({ enabled: !a.enabled }) }); }
    catch { loadAutos(); }
  };

  const duplicateAuto = async (a: Automation) => {
    try { await j(`/api/admin/threads/triggers/${a._id}`, { method: "POST" }); flash("Хуулбарлав (идэвхгүй төлөвтэй)"); loadAutos(); }
    catch (e) { flash(e instanceof Error ? e.message : "Алдаа"); }
  };

  const deleteAuto = async (a: Automation) => {
    if (!confirm(`«${a.name}» automation-ыг устгах уу?`)) return;
    try { await j(`/api/admin/threads/triggers/${a._id}`, { method: "DELETE" }); loadAutos(); }
    catch (e) { flash(e instanceof Error ? e.message : "Алдаа"); }
  };

  const editAuto = (a: Automation) => {
    setForm({
      _id: a._id, name: a.name, triggerType: a.triggerType || "new_comment",
      scope: a.scope || "all", scopeValue: a.scopeValue || "", threadsUserId: a.threadsUserId || "",
      keywords: (a.keywords || []).join(", "), matchMode: a.matchMode || "contains",
      caseSensitive: !!a.caseSensitive, excludeKeywords: (a.excludeKeywords || []).join(", "),
      firstTimeOnly: !!a.firstTimeOnly, activeFrom: a.activeFrom || 0, activeTo: a.activeTo || 0,
      action: a.action || "reply", replyTemplate: a.replyTemplate || "",
      replyVariations: (a.replyVariations || []).join("\n"), leadLabel: a.leadLabel || "", enabled: a.enabled,
    } as FormState);
    setTab("builder");
  };

  const applyTemplate = (tpl: Partial<FormState>) => {
    setForm({ ...emptyForm, ...tpl } as FormState);
    setTab("builder");
  };

  // Нэг товшилтоор загварыг шууд идэвхтэй automation болгоно.
  const quickCreate = async (tpl: Partial<FormState>) => {
    try {
      const payload = { ...emptyForm, ...tpl, replyVariations: [] as string[] };
      await j("/api/admin/threads/triggers", { method: "POST", body: JSON.stringify(payload) });
      flash("Automation үүсээд асаалттай боллоо ⚡");
      loadAutos();
    } catch (e) { flash(e instanceof Error ? e.message : "Алдаа"); }
  };

  const saveForm = async () => {
    setSaving(true); setFormErr("");
    const payload = {
      ...form,
      keywords: form.keywords, excludeKeywords: form.excludeKeywords,
      replyVariations: form.replyVariations.split("\n").map((s) => s.trim()).filter(Boolean),
    };
    try {
      if (form._id) await j(`/api/admin/threads/triggers/${form._id}`, { method: "PATCH", body: JSON.stringify(payload) });
      else await j("/api/admin/threads/triggers", { method: "POST", body: JSON.stringify(payload) });
      flash(form._id ? "Хадгалагдлаа" : "Automation үүслээ");
      setForm({ ...emptyForm });
      loadAutos(); setTab("autos");
    } catch (e) { setFormErr(e instanceof Error ? e.message : "Алдаа"); }
    finally { setSaving(false); }
  };

  const retryLog = async (row: LogRow) => {
    setRetrying(row._id);
    try { await j(`/api/admin/threads/automation-log/${row._id}/retry`, { method: "POST" }); flash("Дахин илгээв"); loadLogs(logFilter); }
    catch (e) { flash(e instanceof Error ? e.message : "Retry алдаа"); }
    finally { setRetrying(null); }
  };

  const disconnect = async (acc: Account) => {
    if (!confirm(`@${acc.username || acc.threadsUserId} акаунтыг салгах уу?`)) return;
    try { await j(`/api/admin/threads/accounts?id=${acc.threadsUserId}`, { method: "DELETE" }); loadAccounts(); }
    catch (e) { flash(e instanceof Error ? e.message : "Алдаа"); }
  };

  const isLike = form.triggerType === "new_like";

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl tracking-[1px]" style={{ color: T.text }}>Threads Automation</h1>
          <p className="mt-1 text-[11px] tracking-[2px]" style={{ color: T.faint, fontFamily: MONO }}>
            LIKE · COMMENT → TRIGGER → CONDITION → ACTION // POLLING 5 МИН
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Btn variant="ghost" onClick={runNow} loading={running}>⚡ Одоо ажиллуулах</Btn>
          {settings && (
            <button onClick={toggleKill}
              className="flex items-center gap-2 border px-3 py-2 text-[10px] font-bold uppercase tracking-[2px] transition"
              style={{
                borderColor: settings.killSwitch ? T.primary : T.border,
                background: settings.killSwitch ? "rgba(46,41,255,0.12)" : "transparent",
                color: settings.killSwitch ? T.primary : T.muted,
              }}>
              <span className={`h-2 w-2 rounded-full ${settings.killSwitch ? "animate-pulse" : ""}`}
                style={{ background: settings.killSwitch ? T.primary : T.ok }} />
              {settings.killSwitch ? "KILL SWITCH: ON" : "СИСТЕМ АЖИЛЛАЖ БАЙНА"}
            </button>
          )}
        </div>
      </div>

      {msg && (
        <div className="mb-4 border-l-2 px-4 py-2.5 text-[12px]" style={{ borderColor: T.secondary, background: "rgba(46,41,255,0.06)", color: T.secondaryInk }}>
          {msg}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 flex flex-wrap gap-1 border-b" style={{ borderColor: T.border }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-[2px] transition"
            style={{
              color: tab === t.id ? T.primary : T.muted,
              borderBottom: tab === t.id ? `2px solid ${T.primary}` : "2px solid transparent",
            }}>
            {t.label}
            {t.id === "logs" && logCounts?.errors ? (
              <span className="ml-1.5 rounded-[4px] px-1.5 text-[11px]" style={{ background: "rgba(46,41,255,0.15)", color: T.primaryInk }}>{logCounts.errors}</span>
            ) : null}
          </button>
        ))}
      </div>

      {/* ═══ DASHBOARD ═══ */}
      {tab === "dash" && (
        <div className="space-y-6">
          {statsErr ? (
            <Card className="p-6 text-center">
              <p className="text-[12px]" style={{ color: T.primaryInk }}>{statsErr}</p>
              <Btn variant="ghost" className="mt-3" onClick={loadStats}>Дахин ачаалах</Btn>
            </Card>
          ) : !stats ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[0, 1, 2, 3].map((i) => <Card key={i} className="p-4"><Skeleton className="h-3 w-20" /><Skeleton className="mt-3 h-7 w-14" /></Card>)}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Card className="p-4">
                  <div className="text-[10px] uppercase tracking-[1px]" style={{ color: T.faint }}>Өнөөдөр trigger</div>
                  <div className="mt-1 text-2xl" style={{ color: T.text, fontFamily: MONO }}>{stats.triggersToday}</div>
                </Card>
                <Card className="p-4">
                  <div className="text-[10px] uppercase tracking-[1px]" style={{ color: T.faint }}>Хариу илгээсэн</div>
                  <div className="mt-1 text-2xl" style={{ color: T.primaryInk, fontFamily: MONO }}>{stats.sentToday}</div>
                  <div className="text-[11px]" style={{ color: T.faint }}>7 хоног: {stats.sentWeek}</div>
                </Card>
                <Card className="p-4">
                  <div className="text-[10px] uppercase tracking-[1px]" style={{ color: T.faint }}>Lead (24ц)</div>
                  <div className="mt-1 text-2xl" style={{ color: T.secondaryInk, fontFamily: MONO }}>{stats.leadsToday}</div>
                </Card>
                <Card className="p-4">
                  <div className="text-[10px] uppercase tracking-[1px]" style={{ color: T.faint }}>Алдаа (24ц)</div>
                  <div className="mt-1 text-2xl" style={{ color: stats.errorsToday ? T.warn : T.ok, fontFamily: MONO }}>{stats.errorsToday}</div>
                </Card>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <Card className="p-5">
                  <SectionHeader title="Топ automation" hint="Хамгийн олон ажилласан" />
                  {stats.topAutomations.length === 0 ? (
                    <Empty title="Одоогоор ажиллаагүй" hint="Automation үүсгэвэл энд статистик гарна" />
                  ) : (
                    <div className="mt-3 space-y-2">
                      {stats.topAutomations.map((a) => (
                        <div key={a._id} className="flex items-center justify-between border px-3 py-2" style={{ borderColor: T.border }}>
                          <div className="flex items-center gap-2 text-[12px]" style={{ color: T.text }}>
                            <span className="text-[11px] uppercase" style={{ color: a.triggerType === "new_like" ? T.warn : T.secondary, fontFamily: MONO }}>
                              {a.triggerType === "new_like" ? "LIKE" : "CMT"}
                            </span>
                            {a.name}
                          </div>
                          <span style={{ color: T.primaryInk, fontFamily: MONO }}>{a.hitCount}×</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                <Card className="p-5">
                  <SectionHeader title="Guardrails" hint="Спам хамгаалалт" />
                  <div className="mt-3 space-y-3 text-[12px]" style={{ color: T.muted }}>
                    <div className="flex items-center justify-between">
                      <span>Цагт илгээх дээд хязгаар (акаунт тус бүр)</span>
                      <input type="number" min={1} max={200} value={settings?.maxPerHour ?? 30}
                        onChange={(e) => saveRate(Number(e.target.value) || 30)}
                        className="w-20 border bg-transparent px-2 py-1 text-right text-[13px]"
                        style={{ borderColor: T.border, color: T.text, fontFamily: MONO }} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Энэ цагт илгээсэн</span>
                      <span style={{ color: T.text, fontFamily: MONO }}>{stats.sentHour} / {settings?.maxPerHour ?? 30}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Идэвхтэй automation</span>
                      <span style={{ color: T.text, fontFamily: MONO }}>{stats.activeAutomations}</span>
                    </div>
                    {stats.topPost && (
                      <div className="flex items-center justify-between">
                        <span>Топ пост (7 хоног)</span>
                        <span style={{ color: T.secondaryInk, fontFamily: MONO }}>{stats.topPost.count} хариу</span>
                      </div>
                    )}
                    <p className="border-t pt-3 text-[10px] leading-relaxed" style={{ borderColor: T.border, color: T.faint }}>
                      Нэг сэтгэгдэлд 2 удаа хэзээ ч хариулахгүй (event ID lock) · 429/5xx үед exponential backoff ·
                      Token хүчингүй болбол акаунт «дахин холбох» төлөвт орж, automation нь зогсоно.
                    </p>
                  </div>
                </Card>
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══ AUTOMATIONS LIST ═══ */}
      {tab === "autos" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <SectionHeader title="Automation" hint="Trigger → Condition → Action урсгалууд" />
            <Btn onClick={() => { setForm({ ...emptyForm }); setTab("builder"); }}>+ Шинэ</Btn>
          </div>

          {/* Templates library */}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {TEMPLATES.map((t) => (
              <div key={t.title}
                className="flex flex-col rounded-[4px] border p-3 text-left transition hover:border-[rgba(46,41,255,0.4)]"
                style={{ borderColor: T.border, background: T.surface }}>
                <div className="text-[11px] font-bold uppercase tracking-[2px]" style={{ color: T.secondaryInk, fontFamily: MONO }}>ЗАГВАР</div>
                <div className="mt-1 text-[13px] font-bold" style={{ color: T.text }}>{t.title}</div>
                <div className="mt-0.5 flex-1 text-[11px]" style={{ color: T.muted }}>{t.desc}</div>
                <div className="mt-2.5 flex gap-1.5">
                  <Btn size="sm" onClick={() => quickCreate(t.form)}>⚡ Шууд асаах</Btn>
                  <Btn size="sm" variant="ghost" onClick={() => applyTemplate(t.form)}>Засах</Btn>
                </div>
              </div>
            ))}
          </div>

          {autosErr ? (
            <Card className="p-6 text-center">
              <p className="text-[12px]" style={{ color: T.primaryInk }}>{autosErr}</p>
              <Btn variant="ghost" className="mt-3" onClick={loadAutos}>Дахин ачаалах</Btn>
            </Card>
          ) : autos === null ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <Card key={i} className="p-4"><Skeleton className="h-5 w-2/3" /><Skeleton className="mt-2 h-3 w-1/3" /></Card>)}</div>
          ) : autos.length === 0 ? (
            <Empty title="Automation алга" hint="Дээрх загваруудаас эхлэх эсвэл шинээр үүсгэ"
              cta={<Btn onClick={() => setTab("builder")}>Эхний automation</Btn>} />
          ) : (
            <div className="space-y-2">
              {autos.map((a) => (
                <Card key={a._id} className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[1px]"
                          style={{ background: a.triggerType === "new_like" ? "rgba(251,191,36,0.12)" : "rgba(46,41,255,0.1)", color: a.triggerType === "new_like" ? T.warn : T.secondary, fontFamily: MONO }}>
                          {a.triggerType === "new_like" ? "ШИНЭ ЛАЙК" : "ШИНЭ СЭТГЭГДЭЛ"}
                        </span>
                        <span className="text-[14px] font-bold" style={{ color: T.text }}>{a.name}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]" style={{ color: T.muted, fontFamily: MONO }}>
                        <span className="border px-1.5 py-0.5" style={{ borderColor: T.border }}>
                          {a.scope === "all" ? "БҮХ ПОСТ" : a.scope === "post" ? `ПОСТ:${a.scopeValue.slice(0, 10)}…` : `#${a.scopeValue}`}
                        </span>
                        <span style={{ color: T.faint }}>→</span>
                        {a.triggerType === "new_comment" && (
                          <>
                            <span className="border px-1.5 py-0.5" style={{ borderColor: T.border }}>
                              {a.matchMode === "any" ? "БҮГД" : (a.keywords || []).slice(0, 3).join("·") || "—"}
                            </span>
                            <span style={{ color: T.faint }}>→</span>
                          </>
                        )}
                        <span className="border px-1.5 py-0.5" style={{ borderColor: "rgba(46,41,255,0.3)", color: T.primaryInk }}>
                          {a.action === "log_lead" ? "LEAD БҮРТГЭХ" : a.action === "reply_and_log" ? "ХАРИУ + LEAD" : "ХАРИУ БИЧИХ"}
                        </span>
                        <span className="ml-2" style={{ color: T.faint }}>{a.hitCount}× ажилласан</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => toggleAuto(a)} title={a.enabled ? "Түр зогсоох" : "Идэвхжүүлэх"}
                        className="relative h-6 w-11 rounded-[4px] transition"
                        style={{ background: a.enabled ? T.primary : "rgba(255,255,255,0.12)" }}>
                        <span className="absolute top-0.5 h-5 w-5 rounded-[4px] bg-white transition-all" style={{ left: a.enabled ? 22 : 2 }} />
                      </button>
                      <Btn variant="ghost" size="sm" onClick={() => editAuto(a)}>Засах</Btn>
                      <Btn variant="ghost" size="sm" onClick={() => duplicateAuto(a)}>Хуулах</Btn>
                      <Btn variant="ghost" size="sm" onClick={() => deleteAuto(a)}>Устгах</Btn>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ BUILDER ═══ */}
      {tab === "builder" && (
        <div className="mx-auto max-w-2xl space-y-4">
          <SectionHeader title={form._id ? "Automation засах" : "Шинэ automation"} hint="Trigger → Condition → Action" />

          <Card className="p-5">
            <FieldLabel>Нэр</FieldLabel>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Жишээ: Үнэ асуусан хүнд хариулах" className="w-full border bg-transparent px-3 py-2.5 text-[13px] outline-none"
              style={{ borderColor: T.border, color: T.text }} />
            <div className="mt-3">
              <FieldLabel>Акаунт</FieldLabel>
              <select value={form.threadsUserId} onChange={(e) => setForm({ ...form, threadsUserId: e.target.value })}
                className="w-full border bg-transparent px-3 py-2.5 text-[13px] outline-none"
                style={{ borderColor: T.border, color: T.text, background: T.surface }}>
                <option value="">Бүх холбогдсон акаунт</option>
                {(accounts || []).map((acc) => (
                  <option key={acc.threadsUserId} value={acc.threadsUserId}>
                    @{acc.username || acc.threadsUserId}{acc.status === "reconnect_needed" ? " (дахин холбох!)" : ""}
                  </option>
                ))}
              </select>
            </div>
          </Card>

          {/* TRIGGER */}
          <FlowCard step="1" title="TRIGGER" color={T.secondary}>
            <div className="grid grid-cols-2 gap-2">
              <ChipBtn on={form.triggerType === "new_comment"} onClick={() => setForm({ ...form, triggerType: "new_comment" })}>💬 Шинэ сэтгэгдэл</ChipBtn>
              <ChipBtn on={form.triggerType === "new_like"} onClick={() => setForm({ ...form, triggerType: "new_like" })}>❤️ Шинэ лайк</ChipBtn>
            </div>
            {isLike && (
              <p className="mt-2 border-l-2 pl-2 text-[10px] leading-relaxed" style={{ borderColor: T.warn, color: T.warnInk }}>
                Threads API нь ХЭН лайк дарсныг өгдөггүй — {"{{username}}"} ажиллахгүй, {"{{count}}"} (нийт лайк) ажиллана.
                Талархлын хариу нэг пост дээр 24 цагт нэг л удаа бичигдэнэ.
              </p>
            )}
            <div className="mt-3">
              <FieldLabel>Хамрах хүрээ</FieldLabel>
              <div className="grid grid-cols-3 gap-2">
                <ChipBtn on={form.scope === "all"} onClick={() => setForm({ ...form, scope: "all", scopeValue: "" })}>Бүх пост</ChipBtn>
                <ChipBtn on={form.scope === "post"} onClick={() => setForm({ ...form, scope: "post" })}>Нэг пост</ChipBtn>
                <ChipBtn on={form.scope === "hashtag"} onClick={() => setForm({ ...form, scope: "hashtag" })}>#Hashtag</ChipBtn>
              </div>
              {form.scope !== "all" && (
                <input value={form.scopeValue} onChange={(e) => setForm({ ...form, scopeValue: e.target.value })}
                  placeholder={form.scope === "post" ? "Пост ID (ж: 18041...)" : "hashtag (# тавихгүй)"}
                  className="mt-2 w-full border bg-transparent px-3 py-2 text-[12px] outline-none"
                  style={{ borderColor: T.border, color: T.text, fontFamily: MONO }} />
              )}
            </div>
          </FlowCard>

          {/* CONDITION */}
          <FlowCard step="2" title="CONDITION" color={T.warn}>
            {!isLike ? (
              <>
                <FieldLabel>Түлхүүр үг (таслалаар)</FieldLabel>
                <input value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                  placeholder="үнэ, price, хэд" className="w-full border bg-transparent px-3 py-2 text-[12px] outline-none"
                  style={{ borderColor: T.border, color: T.text }} />
                <div className="mt-2 grid grid-cols-4 gap-1.5">
                  {([["contains", "Агуулсан"], ["exact", "Яг таарсан"], ["starts_with", "Эхэлсэн"], ["any", "Бүх сэтгэгдэл"]] as const).map(([v, l]) => (
                    <ChipBtn key={v} on={form.matchMode === v} onClick={() => setForm({ ...form, matchMode: v })}>{l}</ChipBtn>
                  ))}
                </div>
                <div className="mt-3">
                  <FieldLabel>Хасах үгс (энэ үг байвал алгасна)</FieldLabel>
                  <input value={form.excludeKeywords} onChange={(e) => setForm({ ...form, excludeKeywords: e.target.value })}
                    placeholder="spam, бот" className="w-full border bg-transparent px-3 py-2 text-[12px] outline-none"
                    style={{ borderColor: T.border, color: T.text }} />
                </div>
                <label className="mt-3 flex cursor-pointer items-center gap-2 text-[12px]" style={{ color: T.muted }}>
                  <input type="checkbox" checked={form.firstTimeOnly} onChange={(e) => setForm({ ...form, firstTimeOnly: e.target.checked })} />
                  Зөвхөн анх удаа хандаж буй хүнд (first-time engager)
                </label>
              </>
            ) : (
              <p className="text-[11px]" style={{ color: T.muted }}>Лайк trigger-т түлхүүр үгийн нөхцөл хамаарахгүй.</p>
            )}
            <div className="mt-3">
              <FieldLabel>Идэвхтэй цаг (Улаанбаатар, 0-23; ижил бол үргэлж)</FieldLabel>
              <div className="flex items-center gap-2" style={{ fontFamily: MONO }}>
                <input type="number" min={0} max={23} value={form.activeFrom}
                  onChange={(e) => setForm({ ...form, activeFrom: Number(e.target.value) || 0 })}
                  className="w-16 border bg-transparent px-2 py-1.5 text-center text-[12px]" style={{ borderColor: T.border, color: T.text }} />
                <span style={{ color: T.faint }}>—</span>
                <input type="number" min={0} max={23} value={form.activeTo}
                  onChange={(e) => setForm({ ...form, activeTo: Number(e.target.value) || 0 })}
                  className="w-16 border bg-transparent px-2 py-1.5 text-center text-[12px]" style={{ borderColor: T.border, color: T.text }} />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <DisabledChip>Дагагч эсэх — API-аар боломжгүй</DisabledChip>
              <DisabledChip>Хэл таних — API-аар боломжгүй</DisabledChip>
            </div>
          </FlowCard>

          {/* ACTION */}
          <FlowCard step="3" title="ACTION" color={T.primary} last>
            <div className="grid grid-cols-3 gap-2">
              <ChipBtn on={form.action === "reply"} onClick={() => setForm({ ...form, action: "reply" })}>💬 Хариу бичих</ChipBtn>
              <ChipBtn on={form.action === "log_lead"} onClick={() => setForm({ ...form, action: "log_lead" })} disabled={isLike}>📇 Lead бүртгэх</ChipBtn>
              <ChipBtn on={form.action === "reply_and_log"} onClick={() => setForm({ ...form, action: "reply_and_log" })} disabled={isLike}>Хоёулаа</ChipBtn>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <DisabledChip>Лайк дарах — API-аар боломжгүй</DisabledChip>
              <DisabledChip>DM илгээх — API-аар боломжгүй</DisabledChip>
            </div>

            {form.action !== "log_lead" && (
              <div className="mt-3">
                <FieldLabel>Хариу текст ({isLike ? "{{count}} = нийт лайк" : "{{username}} = хэрэглэгч"})</FieldLabel>
                <textarea value={form.replyTemplate} onChange={(e) => setForm({ ...form, replyTemplate: e.target.value })}
                  rows={3} maxLength={480}
                  placeholder={isLike ? "🔥 {{count}} лайк! Баярлалаа" : "{{username}} сайн байна уу! …"}
                  className="w-full border bg-transparent px-3 py-2 text-[12px] outline-none"
                  style={{ borderColor: T.border, color: T.text }} />
                <FieldLabel>Хувилбарууд (мөр тус бүр 1; санамсаргүй сонгоно)</FieldLabel>
                <textarea value={form.replyVariations} onChange={(e) => setForm({ ...form, replyVariations: e.target.value })}
                  rows={2} placeholder="Өөр хувилбар хариу…"
                  className="w-full border bg-transparent px-3 py-2 text-[12px] outline-none"
                  style={{ borderColor: T.border, color: T.text }} />
              </div>
            )}
            {(form.action === "log_lead" || form.action === "reply_and_log") && (
              <div className="mt-3">
                <FieldLabel>Lead шошго</FieldLabel>
                <input value={form.leadLabel} onChange={(e) => setForm({ ...form, leadLabel: e.target.value })}
                  placeholder="lead" className="w-full border bg-transparent px-3 py-2 text-[12px] outline-none"
                  style={{ borderColor: T.border, color: T.text, fontFamily: MONO }} />
              </div>
            )}
          </FlowCard>

          {formErr && <div className="border-l-2 px-3 py-2 text-[12px]" style={{ borderColor: T.primary, background: "rgba(46,41,255,0.07)", color: T.primaryInk }}>{formErr}</div>}

          <div className="flex items-center gap-2">
            <Btn onClick={saveForm} loading={saving}>{form._id ? "Хадгалах" : "Automation үүсгэх"}</Btn>
            <Btn variant="ghost" onClick={() => { setForm({ ...emptyForm }); setTab("autos"); }}>Болих</Btn>
            <label className="ml-auto flex cursor-pointer items-center gap-2 text-[12px]" style={{ color: T.muted }}>
              <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
              Шууд идэвхжүүлэх
            </label>
          </div>
        </div>
      )}

      {/* ═══ LOGS ═══ */}
      {tab === "logs" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SectionHeader title="Ажиллагааны лог" hint={logCounts ? `Нийт үзсэн: ${logCounts.seen} · Илгээсэн: ${logCounts.sent} · Lead: ${logCounts.leads}` : undefined} />
            <div className="flex gap-1.5">
              {([["", "Гол"], ["sent", "Амжилттай"], ["error", "Алдаа"], ["skipped", "Алгассан"], ["seeded", "Хуучин"]] as const).map(([v, l]) => (
                <button key={v} onClick={() => setLogFilter(v)}
                  className="px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-[1.5px] transition"
                  style={{ color: logFilter === v ? T.primary : T.faint, background: logFilter === v ? "rgba(46,41,255,0.08)" : "transparent" }}>
                  {l}{logCounts && v ? ` ${logCounts[v] ?? 0}` : ""}
                </button>
              ))}
            </div>
          </div>

          {logsErr ? (
            <Card className="p-6 text-center">
              <p className="text-[12px]" style={{ color: T.primaryInk }}>{logsErr}</p>
              <Btn variant="ghost" className="mt-3" onClick={() => loadLogs(logFilter)}>Дахин ачаалах</Btn>
            </Card>
          ) : logs === null ? (
            <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Card key={i} className="p-3"><Skeleton className="h-4 w-full" /></Card>)}</div>
          ) : logs.length === 0 ? (
            <Empty title="Лог хоосон" hint="Automation ажиллаж эхлэхээр энд бүх үйлдэл бүртгэгдэнэ" />
          ) : (
            <div className="space-y-1.5">
              {logs.map((row) => (
                <Card key={row._id} className="p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[1px]" style={{
                          fontFamily: MONO,
                          background: row.status === "sent" ? "rgba(74,222,128,0.1)" : row.status === "error" ? "rgba(46,41,255,0.12)" : "rgba(255,255,255,0.05)",
                          color: row.status === "sent" ? T.ok : row.status === "error" ? T.primary : T.faint,
                        }}>
                          {row.status === "sent" ? "SUCCESS" : row.status === "error" ? "FAILED" : row.status === "skipped" ? "SKIPPED" : "SEEDED"}
                        </span>
                        <span style={{ color: T.faint, fontFamily: MONO }}>{row.eventType === "like" ? "❤️ LIKE" : "💬 CMT"}</span>
                        {row.username && <span style={{ color: T.secondaryInk }}>@{row.username}</span>}
                        {row.triggerName && <span style={{ color: T.muted }}>→ {row.triggerName}</span>}
                        {row.retryCount > 0 && <span style={{ color: T.warnInk, fontFamily: MONO }}>retry×{row.retryCount}</span>}
                        <span style={{ color: T.faint, fontFamily: MONO }}>
                          {new Date(row.createdAt).toLocaleString("mn-MN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      {row.replyText && <p className="mt-1 truncate text-[12px]" style={{ color: T.muted }}>«{row.replyText}»</p>}
                      {row.sentText && <p className="mt-0.5 truncate text-[12px]" style={{ color: T.okInk }}>↳ {row.sentText}</p>}
                      {row.error && <p className="mt-0.5 text-[11px]" style={{ color: T.primaryInk, fontFamily: MONO }}>{row.error}</p>}
                    </div>
                    {row.status === "error" && (
                      <Btn variant="ghost" size="sm" onClick={() => retryLog(row)} loading={retrying === row._id}>↻ Дахин</Btn>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ ACCOUNTS ═══ */}
      {tab === "accounts" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <SectionHeader title="Threads акаунтууд" hint="Automation ажиллах хуудсууд" />
            <Btn href="/api/admin/threads/auth">+ Акаунт холбох</Btn>
          </div>
          {accountsErr ? (
            <Card className="p-6 text-center">
              <p className="text-[12px]" style={{ color: T.primaryInk }}>{accountsErr}</p>
              <Btn variant="ghost" className="mt-3" onClick={loadAccounts}>Дахин ачаалах</Btn>
            </Card>
          ) : accounts === null ? (
            <Card className="p-6 text-center"><Spinner className="mx-auto h-6 w-6" /></Card>
          ) : accounts.length === 0 ? (
            <Empty title="Холбогдсон акаунт алга" hint="Threads акаунтаа холбоод automation ажиллуулна"
              cta={<Btn href="/api/admin/threads/auth">Threads холбох</Btn>} />
          ) : (
            <div className="space-y-2">
              {accounts.map((acc) => (
                <Card key={acc.threadsUserId} className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-bold" style={{ color: T.text }}>@{acc.username || acc.threadsUserId}</span>
                        <span className="px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[1px]" style={{
                          fontFamily: MONO,
                          background: acc.status === "active" ? "rgba(74,222,128,0.1)" : "rgba(251,191,36,0.12)",
                          color: acc.status === "active" ? T.ok : T.warn,
                        }}>
                          {acc.status === "active" ? "ИДЭВХТЭЙ" : "ДАХИН ХОЛБОХ ШААРДЛАГАТАЙ"}
                        </span>
                      </div>
                      <div className="mt-1 text-[10px]" style={{ color: T.faint, fontFamily: MONO }}>
                        {acc.automations} automation · token дуусах: {new Date(acc.expiresAt).toLocaleDateString("mn-MN")}
                        {acc.backoffUntil && new Date(acc.backoffUntil) > new Date() && (
                          <span style={{ color: T.warnInk }}> · backoff: {new Date(acc.backoffUntil).toLocaleTimeString("mn-MN")}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      {acc.status === "reconnect_needed" && <Btn size="sm" href="/api/admin/threads/auth">Дахин холбох</Btn>}
                      <Btn variant="ghost" size="sm" onClick={() => disconnect(acc)}>Салгах</Btn>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
          <p className="text-[10px] leading-relaxed" style={{ color: T.faint }}>
            Токен хүчингүй болмогц акаунт автоматаар «дахин холбох» төлөвт орж, түүний automation-ууд зогсоно.
            Дахин холбоход бүгд үргэлжилнэ.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Small UI atoms ──
function FieldLabel({ children }: { children: ReactNode }) {
  return <div className="mb-1.5 mt-1 text-[11px] font-bold uppercase tracking-[1.5px]" style={{ color: T.faint, fontFamily: MONO }}>{children}</div>;
}

function ChipBtn({ children, on, onClick, disabled }: { children: ReactNode; on: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="border px-2 py-2 text-[11px] font-bold transition disabled:cursor-not-allowed disabled:opacity-40"
      style={{
        borderColor: on ? T.primary : T.border,
        background: on ? "rgba(46,41,255,0.08)" : "transparent",
        color: on ? T.text : T.muted,
      }}>
      {children}
    </button>
  );
}

function DisabledChip({ children }: { children: ReactNode }) {
  return (
    <span className="border border-dashed px-2 py-1 text-[11px] uppercase tracking-[1px]"
      style={{ borderColor: T.border, color: T.faint, fontFamily: MONO }}>
      🚫 {children}
    </span>
  );
}

function FlowCard({ step, title, color, children, last }: { step: string; title: string; color: string; children: ReactNode; last?: boolean }) {
  return (
    <div className="relative">
      <Card className="p-5" hud>
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center text-[11px] font-black" style={{ background: `${color}1f`, color, fontFamily: MONO }}>{step}</span>
          <span className="text-[10px] font-bold uppercase tracking-[3px]" style={{ color, fontFamily: MONO }}>{title}</span>
        </div>
        {children}
      </Card>
      {!last && (
        <div className="flex justify-center py-1">
          <span style={{ color: T.faint }}>↓</span>
        </div>
      )}
    </div>
  );
}
