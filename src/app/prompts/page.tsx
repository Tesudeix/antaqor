"use client";

import { AI_VIDEO_ENABLED } from "@/lib/flags";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { trackOnce } from "@/lib/analytics";
import { openPromptAdd } from "@/components/PromptAddSheet";

/* ─── ПРОМПТЫН САН ───────────────────────────────────────────────────────

   ХУУЧИН ХУУДАС ЮУ БАЙСАН БЭ: 5 "багц"-ийн жагсаалт — текст карт,
   зураггүй, "18 ХААЛТТАЙ СЛАЙД" гэсэн тоолуур. Хүн юу авахаа
   ХАРАХГҮЙГЭЭР шийдэх ёстой байв. Промпт бол харагдахгүй зүйл;
   түүний ҮР ДҮН нь харагдана. Тиймээс сан нь текстийн жагсаалт биш,
   ЗУРГИЙН хана байх ёстой.

   ГУРВАН ДҮРЭМ:
     1. НЭГ ЗУРАГ = НЭГ ПРОМПТ. Багц байхгүй, слайд байхгүй, дараалал
        байхгүй. Хүн нэг зураг хараад "яг ийм зүйл хийе" гэж шийдэнэ.
     2. ЗУРАГ ЗААВАЛ (сервер дээр шалгагдана). Зураггүй промпт бол
        шалгаагүй мэдэгдэл — сан нь мэдэгдлийн бус, баримтын газар.
     3. ПРОМПТ НЬ ДАРЖ АЖИЛЛУУЛАХ ТОВЧ. Зургийн промпт → Nano Banana,
        видеоных → Seedance, аль аль нь текст нь бэлэн бөглөгдсөн байдлаар.
        Хуулаад өөр таб руу зөөх алхмыг устгав.

   Хуудасны хэмнэл нь /classroom-тэй нэг гэр бүл: брэндийн скелетон,
   ижил зай, ижил хөдөлгөөн. Хоёр өөр хуудас өөр мэт санагдвал сайт нь
   бүтээгдэхүүн биш, цуглуулга мэт болно. */

interface Item {
  _id: string;
  title: string;
  prompt: string;
  image: string;
  category: string;
  copies: number;
  likes: number;
  author: string;
  avatar: string;
  createdAt: string;
  locked?: boolean;
  access?: "free" | "premium";
  price?: number;
  editions?: number;
  sold?: number;
  remaining?: number | null;
  owned?: boolean;
  mine?: boolean;
  lockReason?: "buy" | "member" | null;
}

const CATS: { id: string; label: string; tool: string | null }[] = [
  { id: "", label: "Бүгд", tool: null },
  { id: "зураг", label: "Зураг", tool: "/tools/nano-banano" },
  // AI видео түр хаалттай үед "Ашиглах" холбоос хаалттай студи руу заахгүй.
  { id: "видео", label: "Видео", tool: AI_VIDEO_ENABLED ? "/tools/video" : null },
  { id: "автоматжуулалт", label: "Автоматжуулалт", tool: null },
  { id: "өдөр тутам", label: "Өдөр тутам", tool: null },
];

const toolFor = (cat: string) => CATS.find((c) => c.id === cat)?.tool || null;

/* ─── Дэлгэрэнгүй хуудас — зураг + промпт + үйлдэл ───────────────────── */
function Detail({ item, onClose, onCopied, onBought }: {
  item: Item; onClose: () => void; onCopied: () => void; onBought: (id: string, prompt: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [buying, setBuying] = useState(false);
  const [buyErr, setBuyErr] = useState("");

  const onBuy = async () => {
    if (buying) return;
    setBuying(true); setBuyErr("");
    try {
      const r = await fetch(`/api/prompts/items/${item._id}/buy`, { method: "POST" });
      const d = await r.json();
      if (!r.ok) { setBuyErr(d.error || "Алдаа"); return; }
      /* Худалдаж авмагц ТЕКСТ нь хэрэгтэй. Дахин татахын оронд жагсаалтыг
         шинэчилж, энэ цонхыг хаана — дараагийн нээлтэд бүтэн ирнэ. */
      onBought(item._id, "");
      onClose();
    } catch {
      setBuyErr("Сүлжээний алдаа");
    } finally { setBuying(false); }
  };
  const tool = toolFor(item.category);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(item.prompt);
      setCopied(true);
      onCopied();
      setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard хаалттай — гараар сонгож болно */ }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <button type="button" aria-label="Хаах" onClick={onClose} className="absolute inset-0 bg-black/75 backdrop-blur-[2px]" />
      <div className="pi-panel relative max-h-[92vh] w-full max-w-[860px] overflow-y-auto rounded-t-[4px] sm:rounded-[4px]"
        style={{ background: "var(--chrome-bg,#F8F9FD)" }}>
        <div className="grid gap-0 sm:grid-cols-[1.1fr_1fr]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.image} alt="" className="max-h-[42vh] w-full object-cover sm:max-h-none sm:h-full" />
          <div className="flex flex-col p-5">
            <div className="flex items-center justify-between gap-3">
              <span className="rounded-[3px] bg-[rgba(46,41,255,0.14)] px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#2E29FF]">
                {item.category}
              </span>
              <button type="button" onClick={onClose} aria-label="Хаах" className="text-[#E2E4E8] transition hover:text-[var(--nav-fg-strong)]">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {item.title && (
              <h2 className="mt-3 text-[18px] font-extrabold leading-snug text-[var(--nav-fg-strong)]">{item.title}</h2>
            )}

            {/* Текст нь СЕРВЕР дээр хаагдсан бол энд юу ч ирээгүй байна —
                нуух зүйл байхгүй, зөвхөн шалтгааныг хэлнэ. */}
            {item.locked ? (
              /* ХОЁР ӨӨР ХААЛТ, хоёр өөр үйлдэл. Тэднийг нэг мессежээр
                 хольж болохгүй: гишүүнчлэл авах нь захиалга, промпт
                 худалдаж авах нь ӨМЧ. Хүн юу хийхээ мэдэж байх ёстой. */
              <div className="mt-3 flex-1 rounded-[4px] p-5 text-center" style={{ background: "rgba(128,128,128,0.08)" }}>
                {item.lockReason === "buy" ? (
                  <>
                    <div className="text-[13.5px] font-bold text-[var(--nav-fg-strong)]">
                      {item.remaining === 0 ? "Бүх хувь зарагдсан" : "Энэ промпт кредитээр зарагдана"}
                    </div>
                    <p className="mt-1.5 text-[12px] leading-relaxed text-[#E2E4E8]">
                      {item.remaining === 0
                        ? "Хязгаарлагдмал цуврал дууссан. Эзэмшигчид нь үүрд эзэмшинэ."
                        : typeof item.remaining === "number"
                        ? `Үлдсэн ${item.remaining} хувь. Авсан хүн үүрд эзэмшинэ — гишүүнчлэл дуусахад ч үлдэнэ.`
                        : "Авсан хүн үүрд эзэмшинэ — гишүүнчлэл дуусахад ч үлдэнэ."}
                    </p>
                    {item.remaining !== 0 && (
                      <button
                        type="button"
                        onClick={onBuy}
                        disabled={buying}
                        className="press mt-3 inline-flex items-center gap-1.5 rounded-[4px] px-5 py-2.5 text-[13px] font-black text-white disabled:opacity-40"
                        style={{ background: "#2E29FF" }}
                      >
                        {buying ? "Авч байна…" : `${item.price} кредитээр авах`}
                      </button>
                    )}
                    {buyErr && <div className="mt-2 text-[11.5px]" style={{ color: "var(--accent-ink, #2E29FF)" }}>{buyErr}</div>}
                  </>
                ) : (
                  <>
                    <div className="text-[13.5px] font-bold text-[var(--nav-fg-strong)]">Промпт гишүүдэд нээлттэй</div>
                    <p className="mt-1.5 text-[12px] leading-relaxed text-[#E2E4E8]">
                      Үр дүнг нь бүгд хардаг. Жороо нь гишүүд авдаг.
                    </p>
                    <Link href="/pricing" className="mt-3 inline-block rounded-[4px] px-4 py-2 text-[12.5px] font-black text-white" style={{ background: "#2E29FF" }}>
                      Гишүүн болох
                    </Link>
                  </>
                )}
              </div>
            ) : (
              <pre className="mt-3 max-h-[34vh] flex-1 overflow-y-auto whitespace-pre-wrap rounded-[4px] p-3.5 text-[13px] leading-[1.6] text-[var(--nav-fg)]"
                style={{ background: "rgba(128,128,128,0.08)", fontFamily: "inherit" }}>
                {item.prompt}
              </pre>
            )}

            <div className={`mt-4 flex flex-col gap-2 ${item.locked ? "hidden" : ""}`}>
              {/* Хамгийн чухал үйлдэл нь ХУУЛАХ биш, АЖИЛЛУУЛАХ. */}
              {tool && (
                <Link
                  href={`${tool}?prompt=${encodeURIComponent(item.prompt)}`}
                  className="press w-full rounded-[4px] py-3 text-center text-[14px] font-black text-white"
                  style={{ background: "#2E29FF" }}
                >
                  {item.category === "видео" ? "Энэ промптоор видео үүсгэх" : "Энэ промптоор зураг үүсгэх"}
                </Link>
              )}
              <button
                type="button"
                onClick={copy}
                className="press w-full rounded-[4px] py-3 text-[14px] font-bold text-[var(--nav-fg-strong)]"
                style={{ background: "rgba(128,128,128,0.10)" }}
              >
                {copied ? "Хуулагдлаа ✓" : "Промпт хуулах"}
              </button>
            </div>

            <div className="mt-3 flex items-center gap-2 text-[11px] text-[#E2E4E8]">
              <span className="truncate">{item.author}</span>
              {item.copies > 0 && <span className="ml-auto shrink-0 tabular-nums">{item.copies} хуулалт</span>}
            </div>
          </div>
        </div>
      </div>
      <style jsx global>{`
        @keyframes pi-rise { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: translateY(0) } }
        .pi-panel { animation: pi-rise 0.22s cubic-bezier(0.2,0.8,0.3,1); }
      `}</style>
    </div>
  );
}

/* Нэмэх цонх нь `@/components/PromptAddSheet`-д НҮҮСЭН: "+" цэснээс ч,
   энэ хуудаснаас ч ижил цонх нээгддэг болсон. Хоёр хуулбар байсан бол
   нэг нь хожим хоцорно. */

/* `useSearchParams` нь статик зурагдалтад Suspense хүрээ шаарддаг —
   үгүй бол build дээр "should be wrapped in a suspense boundary" гэж
   унана. Тиймээс гадна нь нимгэн бүрхүүл тавьж, бүх агуулгыг дотор
   нь үлдээв. */
export default function PromptsPage() {
  return (
    <Suspense fallback={null}>
      <PromptsInner />
    </Suspense>
  );
}

function PromptsInner() {
  const { status } = useSession();
  const search = useSearchParams();
  const q = (search.get("q") || "").trim();
  const [items, setItems] = useState<Item[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [cat, setCat] = useState("");
  const [detail, setDetail] = useState<Item | null>(null);


  const load = useCallback((c: string) => {
    setItems(null);
    fetch(`/api/prompts/items?limit=36${c ? `&category=${encodeURIComponent(c)}` : ""}`)
      .then((r) => r.json())
      .then((d) => { setItems(d.items || []); setCounts(d.counts || {}); })
      .catch(() => setItems([]));
  }, []);

  useEffect(() => { trackOnce("prompts_list_view"); }, []);
  useEffect(() => { load(cat); }, [cat, load]);

  /* Цонх нь энэ хуудасны ГАДНА амьдардаг тул үр дүн нь дохиогоор ирнэ.
     Хуудас хаалттай байсан ч юу ч эвдрэхгүй — сонсогч байхгүй, тэгээд л
     болоо. */
  useEffect(() => {
    const on = (e: Event) => {
      const it = (e as CustomEvent<Item>).detail;
      if (!it) return;
      setItems((prev) => (prev ? [it, ...prev] : [it]));
      setCounts((c) => ({ ...c, [it.category]: (c[it.category] || 0) + 1 }));
    };
    window.addEventListener("antaqor:prompt:added", on);
    return () => window.removeEventListener("antaqor:prompt:added", on);
  }, []);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const bumpCopy = (id: string) => {
    fetch("/api/prompts/items", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => {});
  };

  /* Хайлт нь СЕРВЕР рүү дахин явдаггүй: ангилал аль хэдийн татагдсан
     36 мөрийг л шүүнэ. Сүлжээ дахин хүлээхгүй, бичих бүрт шууд. */
  const ql = q.toLowerCase();
  const shown = items && ql
    ? items.filter((it) =>
        [it.title, it.prompt, it.category, it.author]
          .some((f) => (f || "").toLowerCase().includes(ql)))
    : items;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6 lg:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-extrabold leading-none tracking-[-0.02em] text-[var(--nav-fg-strong)] sm:text-[28px]">
            Промптын сан
          </h1>
          <p className="mt-2 text-[13px] text-[#E2E4E8]">Нэг зураг, нэг промпт. Дараад шууд ажиллуулна.</p>
          {/* Хайлт идэвхтэй үед ЯМАР үг хайснаа харуулна — үгүй бол
              хүн "яагаад цөөхөн юм бэ" гэдгээ ойлгохгүй үлдэнэ. */}
          {q && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-[4px] border border-[rgba(46,41,255,0.3)] bg-[rgba(46,41,255,0.08)] px-3 py-1.5">
              <span className="text-[12.5px] text-[#2E29FF]">
                «{q}» — {shown?.length ?? 0} илэрц
              </span>
              <Link href="/prompts" aria-label="Хайлт цэвэрлэх" className="press text-[15px] leading-none text-[#2E29FF]">×</Link>
            </div>
          )}
        </div>
        {status === "authenticated" && (
          <button
            type="button"
            onClick={() => openPromptAdd(cat || undefined)}
            className="press shrink-0 rounded-[4px] px-4 py-2.5 text-[13px] font-black text-white"
            style={{ background: "#2E29FF" }}
          >
            ＋ Промпт нэмэх
          </button>
        )}
      </div>

      <div className="no-scrollbar mt-5 flex gap-1.5 overflow-x-auto pb-1">
        {CATS.map((c) => (
          <button
            key={c.id || "all"}
            type="button"
            onClick={() => setCat(c.id)}
            className="shrink-0 rounded-[4px] px-3 py-1.5 text-[12px] font-bold transition"
            style={cat === c.id
              /* Цагаан дээр #2E29FF нь 1.61:1, #E2E4E8 нь 1.27:1 —
                  хоёулаа уншигдахгүй. Дүүргэлтийг нь хэвээр үлдээж
                  БИЧГИЙГ нь гүнзгийрүүлэв. */
              ? { background: "rgba(46,41,255,0.18)", color: "var(--neon-ink, #1F1AD9)" }
              : { background: "rgba(46,41,255,0.08)", color: "var(--t-sub, #565967)" }}
          >
            {c.label}
            {c.id && counts[c.id] ? <span className="ml-1.5 tabular-nums opacity-60">{counts[c.id]}</span> : null}
          </button>
        ))}
      </div>

      {/* Скелетон нь эцсийн торны ЯГ хэлбэртэй — ачаалал дуусахад
          хуудас үсрэхгүй. Брэндийн өнгөөр амьсгална. */}
      {shown === null && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-busy="true">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] w-full rounded-[4px] skeleton-brand" />
          ))}
        </div>
      )}

      {shown?.length === 0 && (
        <div className="mt-10 rounded-[4px] px-6 py-16 text-center" style={{ background: "rgba(128,128,128,0.05)" }}>
          <p className="text-[14px] font-bold text-[var(--nav-fg-strong)]">
            {q ? `«${q}» хайлтад тохирох промпт алга` : "Энэ ангилалд промпт алга"}
          </p>
          <p className="mt-1.5 text-[12.5px] text-[#E2E4E8]">
            {q
              ? "Өөр үгээр хайж үзэх, эсвэл хайлтаа цэвэрлэ."
              : status === "authenticated" ? "Эхнийхийг нь чи нэмээрэй." : "Гишүүн болоод эхнийхийг нь нэм."}
          </p>
          {q && (
            <Link href="/prompts" className="press mt-4 inline-flex rounded-[4px] bg-[#2E29FF] px-4 py-2 text-[13px] font-bold text-[#0A0A0A]">
              Бүх промпт харах
            </Link>
          )}
        </div>
      )}

      {shown && shown.length > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((it) => (
            /* Карт: ДЭЭР нь зураг (үр дүн), ДООР нь промпт (жор) — 2026-10-06.
               Хаалттай промптын текстийг сервер илгээдэггүй тул доор нь
               шалтгаан нь бичигдэнэ. */
            /* div role=button: доторх "Хуулах" нь өөрөө товч — button дотор
               button байж болохгүй (HTML буруу, iOS дээр дарагдахгүй). */
            <div
              key={it._id}
              role="button"
              tabIndex={0}
              onClick={() => setDetail(it)}
              onKeyDown={(e) => { if (e.key === "Enter") setDetail(it); }}
              className="group flex cursor-pointer flex-col overflow-hidden rounded-[4px] text-left transition duration-300 hover:-translate-y-1"
              style={{ background: "var(--t-surface, #FFFFFF)", border: "1px solid var(--t-line, rgba(255,255,255,0.06))" }}
            >
              <span className="relative block aspect-square w-full overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.image} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.05]" />
                {it.access === "premium" && (
                  <span className="absolute right-2 top-2 rounded-[4px] px-1.5 py-0.5 text-[10.5px] font-bold tabular-nums"
                    style={{ background: it.owned ? "rgba(23,23,26,0.78)" : "#FCEE0A", color: it.owned ? "#FFFFFF" : "#0A0A0A" }}>
                    {it.owned ? "Эзэмшсэн" : it.remaining === 0 ? "Дууссан" : `✦ ${it.price}`}
                  </span>
                )}
              </span>
              <span className="flex flex-1 flex-col p-3">
                <span className="flex items-center gap-2">
                  <span className="rounded-[3px] px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.1em]" style={{ background: "rgba(46,41,255,0.16)", color: "var(--neon-ink, #1F1AD9)" }}>
                    {it.category}
                  </span>
                  {it.access === "premium" && typeof it.remaining === "number" && it.remaining > 0 && !it.owned && (
                    <span className="text-[10px] text-[#9C9CA6]">{it.sold}/{it.editions}</span>
                  )}
                </span>
                {it.title && <span className="mt-2 line-clamp-1 text-[13.5px] font-bold text-[#F2F2F4]">{it.title}</span>}
                <span className="mt-1.5 line-clamp-3 text-[12.5px] leading-[1.5] text-[#C9C9D1]">
                  {it.locked ? "🔒 Промпт нь гишүүдэд / худалдан авагчид нээлттэй" : it.prompt}
                </span>
                {/* Нэг товшилтоор хуулах — нээх шаардлагагүй (2026-10-06). */}
                {!it.locked && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard?.writeText(it.prompt).then(() => {
                        setCopiedId(it._id);
                        bumpCopy(it._id);
                        setTimeout(() => setCopiedId((c) => (c === it._id ? null : c)), 1500);
                      }).catch(() => {});
                    }}
                    className="press mt-2.5 flex h-8 items-center justify-center rounded-[4px] text-[12.5px] font-bold transition"
                    style={copiedId === it._id ? { background: "rgba(46,41,255,0.14)", color: "#2E29FF" } : { background: "#2E29FF", color: "#FFFFFF" }}
                  >
                    {copiedId === it._id ? "Хуулагдлаа ✓" : "Промпт хуулах"}
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {detail && (
        <Detail
          item={detail}
          onClose={() => setDetail(null)}
          onCopied={() => bumpCopy(detail._id)}
          onBought={() => load(cat)}
        />
      )}
    </main>
  );
}
