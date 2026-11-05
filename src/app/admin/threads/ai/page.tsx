"use client";

/* ─── Threads AI зохиогч ─────────────────────────────────────────────────
   Нэг дэлгэц, гурван алхам: ШИНЖЛЭХ → БИЧИХ → ТАВИХ.

   Хуудасны бүтэц нь ажлын дарааллыг ХУУЛСАН, цэсний бүтцийг биш:
   1. Дээд талд юүлүүрийн эрүүл мэнд. Юуны түрүүнд "юу эвдэрсэн бэ" —
      сэтгэгдэлд хариу өгөгддөггүй түлхүүр үг байвал шинэ пост бичих нь
      цоорхой хувинд ус хийхтэй адил.
   2. Дунд нь ноорог үүсгэгч.
   3. Доор нь товлолт (дараалал).

   Энэ хуудас ӨӨРӨӨ нийтэлдэггүй: `/api/admin/social/publish`-руу л явуулна.
   Тэнд товлолт, дахин оролдлого, түүх бүгд аль хэдийн бий. Хоёр дахь
   нийтлэгч бичих нь хоёр дахь үнэн үүсгэнэ.                               */

import { useCallback, useEffect, useState } from "react";
import { T, MONO, Card, Btn, SectionHeader, Empty, Skeleton } from "@/components/admin/kit";
import { CTA_LIBRARY, ANGLES, THREADS_MAX_CHARS, voiceWarnings } from "@/lib/threadsVoice";

interface Analysis {
  postCount: number;
  days: number;
  perDay: number;
  withCta: number;
  ctaRate: number;
  avgChars: number;
  ctaKeywords: { keyword: string; count: number; covered: boolean }[];
  leaks: { keyword: string; count: number }[];
  topOpeners: string[];
}

interface TopPost {
  id: string;
  text: string;
  permalink?: string;
  views: number;
  likes: number;
  replies: number;
}

interface Draft {
  text: string;
  angle: string;
  ctaKeyword: string;
  chars: number;
  /** Зөвхөн клиент талд: энэ ноорог одоо ямар төлөвт байгаа. */
  state?: "idle" | "sending" | "done" | "error";
  note?: string;
}

/* Нийлүүлэгчийн оролдлого. `code` нь машины үг тул хүнд харуулахын өмнө
   орчуулна — "billing_not_active" гэдгийг уншаад юу хийхээ мэдэх хүн цөөн. */
interface Attempt {
  name: string;
  model: string;
  ok: boolean;
  status?: number;
  code?: string;
  message?: string;
}

/* Кодыг ҮЙЛДЭЛ рүү хөрвүүлнэ. Гол зорилго нь "алдаа гарлаа" гэж хэлэх биш,
   "чи юу хийвэл засагдах вэ" гэдгийг хэлэх. */
const ATTEMPT_REASON: Record<string, { label: string; fix?: string; href?: string }> = {
  billing_not_active: {
    label: "Данс идэвхгүй",
    fix: "Төлбөрийн мэдээллээ идэвхжүүл",
    href: "https://platform.openai.com/settings/organization/billing/overview",
  },
  insufficient_quota: {
    label: "Квот дууссан",
    fix: "Дансаа цэнэглэ",
    href: "https://platform.openai.com/settings/organization/billing/overview",
  },
  "permission-denied": { label: "Кредит дууссан / сарын хязгаар", fix: "Кредит нэм" },
  invalid_api_key: { label: "Түлхүүр буруу" },
  model_not_found: { label: "Загвар олдсонгүй" },
  empty_content: { label: "Хоосон хариу" },
  network: { label: "Сүлжээ тасарсан" },
};

interface ModelOption { id: string }
interface ProviderCatalog {
  name: string;
  label: string;
  configured: boolean;
  reachable: boolean;
  problem?: string;
  models: ModelOption[];
  fallbackModel: string;
}
interface ActiveModel { provider: string; model: string; pinned: boolean }

interface QueueRow {
  _id: string;
  text: string;
  scheduledAt: string;
  state: string;
  platforms: string[];
}

async function j<R>(url: string, init?: RequestInit): Promise<R> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string })?.error || `HTTP ${res.status}`);
  return data as R;
}

/** `datetime-local` нь ОРОН НУТГИЙН цагийг хүлээж авдаг тул `toISOString`
 *  шууд ашиглаж болохгүй — 8 цагаар зөрнө. Энэ нь товлолтын хамгийн
 *  түгээмэл алдаа. */
function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function ThreadsAIPage() {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [top, setTop] = useState<TopPost[]>([]);
  const [loadingAnalysis, setLoadingAnalysis] = useState(true);
  const [analysisError, setAnalysisError] = useState("");

  const [ctaIndex, setCtaIndex] = useState(0);
  const [angle, setAngle] = useState("");
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(3);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [provider, setProvider] = useState("");
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);

  const [catalog, setCatalog] = useState<ProviderCatalog[]>([]);
  const [active, setActive] = useState<ActiveModel | null>(null);
  const [modelBusy, setModelBusy] = useState(false);
  const [modelError, setModelError] = useState("");

  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [flash, setFlash] = useState("");

  const say = (m: string) => {
    setFlash(m);
    window.setTimeout(() => setFlash(""), 3500);
  };

  const loadAnalysis = useCallback(async (withInsights: boolean) => {
    setLoadingAnalysis(true);
    setAnalysisError("");
    try {
      const d = await j<{ analysis: Analysis; top: TopPost[] }>(
        `/api/admin/threads/ai/analyze${withInsights ? "?insights=1" : ""}`
      );
      setAnalysis(d.analysis);
      if (d.top?.length) setTop(d.top);
    } catch (e) {
      setAnalysisError(e instanceof Error ? e.message : "Алдаа");
    } finally {
      setLoadingAnalysis(false);
    }
  }, []);

  const loadQueue = useCallback(async () => {
    try {
      const d = await j<{ scheduled: QueueRow[] }>("/api/admin/social/publish?limit=1");
      setQueue((d.scheduled || []).filter((r) => r.platforms?.includes("threads")));
    } catch {
      /* дараалал ачаалагдахгүй байх нь хуудсыг зогсоох шалтгаан биш */
    }
  }, []);

  const loadModels = useCallback(async (refresh = false) => {
    setModelBusy(true);
    setModelError("");
    try {
      const d = await j<{ catalog: ProviderCatalog[]; active: ActiveModel | null }>(
        `/api/admin/threads/ai/models${refresh ? "?refresh=1" : ""}`
      );
      setCatalog(d.catalog || []);
      setActive(d.active);
    } catch (e) {
      setModelError(e instanceof Error ? e.message : "Жагсаалт татаж чадсангүй");
    } finally {
      setModelBusy(false);
    }
  }, []);

  const chooseModel = async (value: string) => {
    const [provider, ...rest] = value.split(":");
    const model = rest.join(":");
    setModelBusy(true);
    setModelError("");
    try {
      const d = await j<{ active: ActiveModel | null }>("/api/admin/threads/ai/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value ? { provider, model } : {}),
      });
      setActive(d.active);
      say(value ? `Загвар: ${model}` : "Автомат дараалал сэргээв");
    } catch (e) {
      setModelError(e instanceof Error ? e.message : "Хадгалж чадсангүй");
    } finally {
      setModelBusy(false);
    }
  };

  useEffect(() => {
    loadAnalysis(false);
    loadQueue();
    loadModels(false);
  }, [loadAnalysis, loadQueue, loadModels]);

  const generate = async () => {
    setGenerating(true);
    setGenError("");
    try {
      /* Алдааны биеийг ч уншина: 502 үед `attempts` нь хамгийн үнэтэй
         мэдээлэл бөгөөд `j()` throw хийвэл тэр нь алга болно. */
      const res = await fetch("/api/admin/threads/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ctaIndex, angle, topic, count }),
      });
      const d = (await res.json().catch(() => ({}))) as {
        drafts?: Draft[];
        provider?: string;
        attempts?: Attempt[];
        error?: string;
      };
      setAttempts(d.attempts || []);
      if (!res.ok) throw new Error(d.error || `HTTP ${res.status}`);
      setProvider(d.provider || "");
      setDrafts((d.drafts || []).map((x) => ({ ...x, state: "idle" as const })));
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Алдаа");
    } finally {
      setGenerating(false);
    }
  };

  const editDraft = (i: number, text: string) => {
    setDrafts((prev) =>
      prev.map((d, k) => (k === i ? { ...d, text, chars: text.length, state: "idle" } : d))
    );
  };

  const send = async (i: number, when: Date | null) => {
    const d = drafts[i];
    if (!d || d.chars === 0 || d.chars > THREADS_MAX_CHARS) return;
    setDrafts((prev) => prev.map((x, k) => (k === i ? { ...x, state: "sending" } : x)));
    try {
      const res = await j<{ ok: boolean; scheduled?: boolean; results?: { status: string; error?: string }[] }>(
        "/api/admin/social/publish",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: d.text,
            platforms: ["threads"],
            ...(when ? { scheduledAt: when.toISOString() } : {}),
          }),
        }
      );
      if (res.scheduled) {
        setDrafts((prev) => prev.map((x, k) => (k === i ? { ...x, state: "done", note: "Товлолоо" } : x)));
        say("Товлолт нэмэгдлээ");
        loadQueue();
        return;
      }
      const bad = (res.results || []).find((r) => r.status !== "ok");
      if (bad) throw new Error(bad.error || "Нийтлэхэд алдаа");
      setDrafts((prev) => prev.map((x, k) => (k === i ? { ...x, state: "done", note: "Нийтлэгдлээ" } : x)));
      say("Threads дээр нийтлэгдлээ");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Алдаа";
      setDrafts((prev) => prev.map((x, k) => (k === i ? { ...x, state: "error", note: msg } : x)));
    }
  };

  const cancelQueued = async (id: string) => {
    try {
      await j(`/api/admin/social/publish?id=${id}`, { method: "DELETE" });
      say("Товлолт цуцлагдлаа");
      loadQueue();
    } catch (e) {
      say(e instanceof Error ? e.message : "Цуцлаж чадсангүй");
    }
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-8">
      <div>
        <h1 className="text-[22px] font-extrabold tracking-[-0.02em]" style={{ color: T.text }}>
          Threads AI зохиогч
        </h1>
        <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: T.muted }}>
          @antaqor.ai-ийн бодит постуудаас өнгө аясыг сурч, дуудлагатай ноорог бичнэ.
          Ноорог бүр хүний баталгаа хүлээнэ — AI өөрөө нийтлэхгүй.
        </p>
      </div>

      {flash && (
        <div
          className="rounded-[4px] px-4 py-2.5 text-[13px] font-semibold"
          style={{ background: "rgba(74,222,128,0.12)", color: T.okInk }}
        >
          {flash}
        </div>
      )}

      {/* ═══ 1 · ЮҮЛҮҮРИЙН ЭРҮҮЛ МЭНД ═══════════════════════════════════ */}
      <section>
        <SectionHeader
          title="Юүлүүрийн эрүүл мэнд"
          hint="сүүлийн 50 пост"
          action={
            <Btn variant="ghost" size="sm" onClick={() => loadAnalysis(true)} loading={loadingAnalysis}>
              Гүйцэтгэл татах
            </Btn>
          }
        />

        {loadingAnalysis && !analysis ? (
          <Card className="p-5">
            <Skeleton className="h-4 w-1/3" />
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          </Card>
        ) : analysisError ? (
          <Empty
            title="Шинжилгээ ажиллсангүй"
            hint={analysisError}
            cta={<Btn size="sm" onClick={() => loadAnalysis(false)}>Дахин оролдох</Btn>}
          />
        ) : analysis ? (
          <div className="flex flex-col gap-4">
            <Card className="p-5">
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  { k: "Пост / өдөр", v: analysis.perDay.toFixed(1) },
                  { k: "Дуудлагатай", v: `${analysis.ctaRate}%` },
                  { k: "Дундаж урт", v: `${analysis.avgChars}` },
                  { k: "Хугацаа", v: `${analysis.days} хоног` },
                ].map((m) => (
                  <div key={m.k}>
                    <dd className="text-[24px] font-extrabold leading-none" style={{ color: T.text, fontFamily: MONO }}>
                      {m.v}
                    </dd>
                    <dt className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: T.faint }}>
                      {m.k}
                    </dt>
                  </div>
                ))}
              </dl>
            </Card>

            {/* ─── ЦООРХОЙ ─────────────────────────────────────────────
                Хамгийн үнэтэй мэдээлэл. Пост нь "AI гэж бичээрэй" гэж
                хүсээд, "AI"-д тохирох автомат хариу байхгүй бол сэтгэгдэл
                бичсэн хүн хариу авахгүй — юүлүүр яг тэнд тасарна. */}
            {analysis.leaks.length > 0 ? (
              <Card className="p-5">
                <div className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: T.bad }} />
                  <div className="min-w-0">
                    <div className="text-[14px] font-bold" style={{ color: T.badInk }}>
                      Юүлүүр тасарсан байна
                    </div>
                    <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: T.muted }}>
                      Доорх түлхүүр үгийг сэтгэгдэлд бичихийг постууд чинь хүсдэг ч тэдэнд
                      тохирох автомат хариу БАЙХГҮЙ. Хүн бичээд хариу авахгүй — хамгийн
                      сонирхолтой байгаа мөчид нь алдаж байна.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {analysis.leaks.map((l) => (
                        <span
                          key={l.keyword}
                          className="rounded-[4px] px-2.5 py-1 text-[12px] font-bold"
                          style={{ background: "rgba(10,166,189,0.14)", color: T.badInk, fontFamily: MONO }}
                        >
                          {l.keyword} · {l.count} пост
                        </span>
                      ))}
                    </div>
                    <div className="mt-4">
                      <Btn size="sm" variant="secondary" href="/admin/threads/automation">
                        Автомат хариу нэмэх
                      </Btn>
                    </div>
                  </div>
                </div>
              </Card>
            ) : (
              analysis.ctaKeywords.length > 0 && (
                <Card className="p-5">
                  <div className="flex items-start gap-3">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: T.ok }} />
                    <div>
                      <div className="text-[14px] font-bold" style={{ color: T.okInk }}>
                        Юүлүүр бүтэн
                      </div>
                      <p className="mt-1 text-[13px]" style={{ color: T.muted }}>
                        Хэрэглэж буй бүх түлхүүр үгэнд автомат хариу байна.
                      </p>
                    </div>
                  </div>
                </Card>
              )
            )}

            {top.length > 0 && (
              <Card className="p-5">
                <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: T.faint }}>
                  Хамгийн их үзэгдсэн
                </div>
                <div className="flex flex-col gap-px" style={{ background: T.border }}>
                  {top.slice(0, 6).map((p) => (
                    <a
                      key={p.id}
                      href={p.permalink || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between gap-4 px-1 py-2.5 transition-opacity hover:opacity-80"
                      style={{ background: T.surface }}
                    >
                      <span className="min-w-0 flex-1 truncate text-[13px]" style={{ color: T.text }}>
                        {p.text}
                      </span>
                      <span
                        className="shrink-0 text-[12px] tabular-nums"
                        style={{ color: T.muted, fontFamily: MONO }}
                      >
                        {p.views.toLocaleString()} үзэлт · {p.likes} ❤ · {p.replies} 💬
                      </span>
                    </a>
                  ))}
                </div>
              </Card>
            )}
          </div>
        ) : null}
      </section>

      {/* ═══ 2 · ЯМАР AI АЖИЛЛАЖ БАЙНА ══════════════════════════════════
          "Одоо юу ажиллаж байна" гэдэг нь эзний хамгийн олон удаа асуудаг
          асуулт бөгөөд өмнө нь хариулт нь зөвхөн серверийн лог дотор
          байсан. Жагсаалт нь нийлүүлэгчээс АМЬДААР ирнэ — кодод бичсэн
          жагсаалт нэг сарын дараа худал болдгийг энэ төсөл дээр хоёр удаа
          үзсэн. */}
      <section>
        <SectionHeader
          title="AI загвар"
          hint={active ? (active.pinned ? "гараар тогтоосон" : "автомат") : undefined}
          action={
            <Btn variant="ghost" size="sm" onClick={() => loadModels(true)} loading={modelBusy}>
              Жагсаалт сэргээх
            </Btn>
          }
        />

        <Card className="flex flex-col gap-4 p-5">
          {/* Идэвхтэй загвар — хамгийн том бичиг, учир нь энэ бол хариулт. */}
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-[20px] font-extrabold" style={{ color: T.text, fontFamily: MONO }}>
              {active?.model || "—"}
            </span>
            <span className="text-[13px]" style={{ color: T.muted }}>
              {catalog.find((c) => c.name === active?.provider)?.label || active?.provider || "тохируулаагүй"}
            </span>
            {active && !active.pinned && (
              <span className="text-[11px]" style={{ color: T.faint }}>
                дараалалд эхэнд байгаа тул сонгогдсон
              </span>
            )}
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: T.faint }}>
              Загвар сонгох
            </span>
            <select
              value={active?.pinned ? `${active.provider}:${active.model}` : ""}
              onChange={(e) => chooseModel(e.target.value)}
              disabled={modelBusy}
              className="h-11 rounded-[4px] px-3 text-[13px] outline-none disabled:opacity-50"
              style={{ background: T.surfaceHi, color: T.text }}
            >
              <option value="">Автомат — эхний ажиллаж байгааг нь</option>
              {catalog.map((c) => (
                <optgroup key={c.name} label={c.reachable ? c.label : `${c.label} — боломжгүй`}>
                  {c.models.map((m) => (
                    <option key={c.name + m.id} value={`${c.name}:${m.id}`}>
                      {m.id}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <span className="text-[11px] leading-relaxed" style={{ color: T.faint }}>
              Сонгосон загвар унавал ажил зогсохгүй — дараагийн нийлүүлэгч рүү
              шилжинэ, юу болсныг доор харуулна.
            </span>
          </label>

          {/* Нийлүүлэгчийн төлөв — асуудалтай нь л гарна. */}
          {catalog.some((c) => !c.reachable) && (
            <div className="flex flex-col gap-1.5 border-t pt-3" style={{ borderColor: T.border }}>
              {catalog
                .filter((c) => !c.reachable)
                .map((c) => (
                  <div key={c.name} className="flex flex-wrap items-center gap-2 text-[12px]">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: T.bad }} />
                    <span className="font-bold" style={{ color: T.text, fontFamily: MONO }}>
                      {c.name}
                    </span>
                    <span style={{ color: T.muted }}>{c.problem || "хүрэхгүй байна"}</span>
                  </div>
                ))}
            </div>
          )}

          {modelError && (
            <p className="text-[13px]" style={{ color: T.badInk }}>
              {modelError}
            </p>
          )}
        </Card>
      </section>

      {/* ═══ 3 · НООРОГ ҮҮСГЭХ ══════════════════════════════════════════ */}
      <section>
        <SectionHeader title="Ноорог бичих" hint={provider ? `бичсэн: ${provider}` : undefined} />

        <Card className="flex flex-col gap-5 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: T.faint }}>
                Дуудлага (сүүлийн мөр)
              </span>
              <select
                value={ctaIndex}
                onChange={(e) => setCtaIndex(Number(e.target.value))}
                className="h-11 rounded-[4px] px-3 text-[13px] outline-none"
                style={{ background: T.surfaceHi, color: T.text }}
              >
                {CTA_LIBRARY.map((c, i) => (
                  <option key={c.label} value={i}>
                    {c.label}
                  </option>
                ))}
              </select>
              <span className="text-[11px] leading-relaxed" style={{ color: T.faint }}>
                {CTA_LIBRARY[ctaIndex]?.text}
              </span>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: T.faint }}>
                Өнцөг
              </span>
              <select
                value={angle}
                onChange={(e) => setAngle(e.target.value)}
                className="h-11 rounded-[4px] px-3 text-[13px] outline-none"
                style={{ background: T.surfaceHi, color: T.text }}
              >
                <option value="">Холимог — AI өөрөө сонгоно</option>
                {ANGLES.map((a) => (
                  <option key={a.key} value={a.key}>
                    {a.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: T.faint }}>
              Сэдэв — заавал биш
            </span>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={2}
              placeholder="ж: 9 сарын 1-нд эхлэх 30 хоногийн сургалт, эсвэл өнөөдөр болсон нэг явдал"
              className="resize-none rounded-[4px] px-3 py-2.5 text-[14px] leading-relaxed outline-none"
              style={{ background: T.surfaceHi, color: T.text }}
            />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-[13px]" style={{ color: T.muted }}>
              Тоо
              <select
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="h-9 rounded-[4px] px-2 text-[13px] outline-none"
                style={{ background: T.surfaceHi, color: T.text }}
              >
                {[1, 3, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <Btn onClick={generate} loading={generating}>
              Ноорог үүсгэх
            </Btn>
          </div>

          {genError && (
            <p className="text-[13px]" style={{ color: T.badInk }}>
              {genError}
            </p>
          )}

          {/* ─── Нийлүүлэгчийн эрүүл мэнд ─────────────────────────────────
              Зөвхөн ямар нэг зүйл унасан үед л гарна. Бүх зүйл хэвийн
              байхад энэ мөр байх нь дэмий чимээ — ажиллаж байгаа систем
              өөрийгөө магтах шаардлагагүй. */}
          {attempts.some((a) => !a.ok) && (
            <div className="flex flex-col gap-2 border-t pt-4" style={{ borderColor: T.border }}>
              <span className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: T.faint }}>
                Нийлүүлэгчийн дараалал
              </span>
              {attempts.map((a, i) => {
                const r = a.code ? ATTEMPT_REASON[a.code] : undefined;
                return (
                  <div key={a.name + i} className="flex flex-wrap items-center gap-2 text-[12px]">
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: a.ok ? T.ok : T.bad }}
                    />
                    <span className="font-bold" style={{ color: T.text, fontFamily: MONO }}>
                      {a.name}
                    </span>
                    <span style={{ color: T.faint }}>{a.model}</span>
                    {a.ok ? (
                      <span style={{ color: T.okInk }}>ажиллав</span>
                    ) : (
                      <>
                        <span style={{ color: T.badInk }}>
                          {r?.label || a.code || `HTTP ${a.status ?? "?"}`}
                        </span>
                        {r?.fix &&
                          (r.href ? (
                            <a
                              href={r.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline underline-offset-4"
                              style={{ color: T.primaryInk }}
                            >
                              {r.fix}
                            </a>
                          ) : (
                            <span style={{ color: T.muted }}>{r.fix}</span>
                          ))}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </section>

      {/* ═══ 4 · НООРОГУУД ══════════════════════════════════════════════ */}
      {drafts.length > 0 && (
        <section>
          <SectionHeader title="Ноорог" hint={`${drafts.length} ширхэг · засаад тавь`} />
          <div className="flex flex-col gap-4">
            {drafts.map((d, i) => (
              <DraftCard
                key={i}
                draft={d}
                onChange={(t) => editDraft(i, t)}
                onPublish={() => send(i, null)}
                onSchedule={(when) => send(i, when)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ═══ 5 · ТОВЛОЛТ ════════════════════════════════════════════════ */}
      <section>
        <SectionHeader title="Товлолт" hint="cron 5 минут тутам явуулна" />
        {queue.length === 0 ? (
          <Empty title="Товлосон пост алга" hint="Ноорог үүсгээд «Товлох» дарвал энд эгнэнэ." />
        ) : (
          <div className="flex flex-col gap-px" style={{ background: T.border }}>
            {queue.map((q) => (
              <div key={q._id} className="flex items-start justify-between gap-4 p-4" style={{ background: T.surface }}>
                <div className="min-w-0">
                  <div className="text-[12px] tabular-nums" style={{ color: T.primaryInk, fontFamily: MONO }}>
                    {new Date(q.scheduledAt).toLocaleString("mn-MN")}
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed" style={{ color: T.muted }}>
                    {q.text.slice(0, 240)}
                  </p>
                </div>
                <Btn variant="danger" size="sm" onClick={() => cancelQueued(q._id)}>
                  Цуцлах
                </Btn>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* ─── Нэг ноорог ─────────────────────────────────────────────────────────
   Засварлах талбар нь `textarea` — "AI-ийн гаралт" биш "чиний ноорог".
   Хүн ганц үг сольж чадахгүй бол баталгаажуулалт нь зөвшөөрөл болж
   хувирдаг, тэр нь баталгаа биш.

   Тэмдэгтийн тоолуур нь Threads-ийн 500 хязгаартай харьцуулна: хэтэрсэн
   постыг илгээх товч ажиллахгүй — сервер рүү явуулаад тэндээс алдаа
   авах нь хүнд юу засахыг хэлэхгүй. */
function DraftCard({
  draft,
  onChange,
  onPublish,
  onSchedule,
}: {
  draft: Draft;
  onChange: (t: string) => void;
  onPublish: () => void;
  onSchedule: (when: Date) => void;
}) {
  // Өгөгдмөл товлолт: 1 цагийн дараа, 5 минутын алхамд бөөрөнхийлсөн.
  const [when, setWhen] = useState(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
    return toLocalInput(d);
  });

  const over = draft.chars > THREADS_MAX_CHARS;
  const busy = draft.state === "sending";
  const done = draft.state === "done";
  const warnings = voiceWarnings(draft.text);

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: T.faint }}>
          {draft.angle || "пост"}
          {draft.ctaKeyword ? ` · түлхүүр: ${draft.ctaKeyword}` : " · лайк дуудлага"}
        </span>
        <span
          className="text-[12px] tabular-nums"
          style={{ color: over ? T.bad : T.faint, fontFamily: MONO }}
        >
          {draft.chars}/{THREADS_MAX_CHARS}
        </span>
      </div>

      <textarea
        value={draft.text}
        onChange={(e) => onChange(e.target.value)}
        rows={Math.min(14, Math.max(5, draft.text.split("\n").length + 1))}
        disabled={done}
        className="resize-y rounded-[4px] px-3 py-3 text-[14px] leading-[1.6] outline-none disabled:opacity-60"
        style={{ background: T.surfaceHi, color: T.text }}
      />

      {/* Өнгө аясын шалгалт — бичих бүрд дахин тооцогдоно, тиймээс хүн
          засмагц анхааруулга алга болно. Энэ нь хориглолт БИШ: анхааруулгатай
          ч нийтлэж болно. Загварын гулсалтыг хүний нүдэнд аваачих л зорилго. */}
      {warnings.length > 0 && !done && (
        <div className="flex flex-wrap gap-1.5">
          {warnings.map((w) => (
            <span
              key={w.code}
              className="rounded-[4px] px-2 py-1 text-[11px] font-semibold"
              style={{ background: "rgba(251,191,36,0.12)", color: T.warnInk }}
            >
              {w.label}
            </span>
          ))}
        </div>
      )}

      {done ? (
        <div className="text-[13px] font-semibold" style={{ color: T.okInk }}>
          ✓ {draft.note}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Btn onClick={onPublish} disabled={over || busy} loading={busy}>
              Одоо нийтлэх
            </Btn>
            <input
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              className="h-10 rounded-[4px] px-3 text-[13px] outline-none"
              style={{ background: T.surfaceHi, color: T.text }}
            />
            <Btn
              variant="ghost"
              onClick={() => {
                const d = new Date(when);
                if (!Number.isNaN(d.getTime())) onSchedule(d);
              }}
              disabled={over || busy}
            >
              Товлох
            </Btn>
          </div>
          {draft.state === "error" && (
            <p className="text-[13px]" style={{ color: T.badInk }}>
              {draft.note}
            </p>
          )}
        </>
      )}
    </Card>
  );
}
