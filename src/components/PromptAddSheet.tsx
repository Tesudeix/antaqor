"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/* ─── ПРОМПТ НЭМЭХ — ГАНЦ хэрэгжүүлэлт, ХОЁР дуудагч ─────────────────────

   Энэ цонх нь эхлээд `/prompts` хуудасны дотор амьдардаг байсан. "+"
   цэснээс ч нэмэх шаардлага гарахад хамгийн хялбар зам нь түүнийг
   хуулах байв — тэр нь хоёр хуулбар, хоёр зан байдал, хожим нэг нь
   хоцрох гэсэн үг. Оронд нь цонхыг ГАДАГШ гаргаж, дохиогоор нээдэг
   болгов:

     window.dispatchEvent(new CustomEvent("antaqor:prompt:add"))

   Нэмэгдсэн промпт нь буцаад дохио болж тарна
   (`antaqor:prompt:added`) — `/prompts` хуудас нээлттэй байвал шинэ
   картаа шууд урдаа тавина, хаалттай байсан ч юу ч эвдрэхгүй.

   ЗУРАГ ЗААВАЛ гэдэг дүрэм нь энд UI, API, схем гурван түвшинд
   давхарлана. Хамгийн гадна давхарга нь ЗӨВХӨН эелдэг байдлын төлөө —
   жинхэнэ хаалт нь серверт. */

export const PROMPT_CATEGORIES: { id: string; label: string }[] = [
  { id: "зураг", label: "Зураг" },
  { id: "видео", label: "Видео" },
  { id: "автоматжуулалт", label: "Автоматжуулалт" },
  { id: "өдөр тутам", label: "Өдөр тутам" },
];

export function openPromptAdd(category?: string) {
  window.dispatchEvent(new CustomEvent("antaqor:prompt:add", { detail: { category } }));
}

function Sheet({ initialCategory, onClose }: { initialCategory?: string; onClose: () => void }) {
  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(initialCategory || "зураг");
  const [image, setImage] = useState("");
  /* ҮНЭГҮЙ нь анхдагч. Зохиогч эхлээд юм өгч, дараа нь зарна — эсрэгээр
     эхэлбэл хэн ч анхны итгэлээ олохгүй. */
  const [access, setAccess] = useState<"free" | "premium">("free");
  const [price, setPrice] = useState<number>(50);
  const [editions, setEditions] = useState<number>(0);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

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

  const upload = async (file: File) => {
    setUploading(true); setErr("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok || !d.url) throw new Error(d.error || "Зураг хадгалж чадсангүй");
      setImage(d.url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Алдаа");
    } finally { setUploading(false); }
  };

  const submit = async () => {
    if (busy || !prompt.trim() || !image) return;
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/prompts/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(), title: title.trim(), category, image,
          access, price: access === "premium" ? price : 0, editions,
        }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Алдаа"); return; }
      window.dispatchEvent(new CustomEvent("antaqor:prompt:added", { detail: d.item }));
      onClose();
    } catch {
      setErr("Сүлжээний алдаа");
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <button type="button" aria-label="Хаах" onClick={onClose} className="absolute inset-0 bg-black/75 backdrop-blur-[2px]" />
      <div
        className="pa-panel relative max-h-[92vh] w-full max-w-[520px] overflow-y-auto rounded-t-[4px] p-5 pb-[calc(20px+var(--nav-safe,0px))] sm:rounded-[4px] sm:pb-5"
        style={{ background: "var(--chrome-bg,#F8F9FD)" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-extrabold text-[var(--nav-fg-strong)]">Промпт нэмэх</h2>
          <button type="button" onClick={onClose} aria-label="Хаах" className="text-[#E2E4E8] transition hover:text-[var(--nav-fg-strong)]">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* ЗУРАГ ЭХНИЙ АЛХАМ. Дараалал өөрөө дүрмийг зааж өгнө: энд үр
            дүнгүй промпт байрлахгүй. Сүүлд асуувал хүн промптоо бичээд
            дараа нь татгалзах болно. */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="mt-4 flex aspect-video w-full items-center justify-center overflow-hidden rounded-[4px] transition"
          style={{ background: image ? "transparent" : "rgba(128,128,128,0.08)" }}
        >
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" className="h-full w-full object-cover" />
          ) : uploading ? (
            <span className="h-full w-full rounded-[4px] skeleton-brand" />
          ) : (
            <span className="text-[12.5px] font-bold text-[#E2E4E8]">＋ Үр дүнгийн зураг (заавал)</span>
          )}
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); if (fileRef.current) fileRef.current.value = ""; }} />

        <div className="mt-3 flex flex-wrap gap-1.5">
          {PROMPT_CATEGORIES.map((c) => (
            <button key={c.id} type="button" onClick={() => setCategory(c.id)}
              className="rounded-[4px] px-2.5 py-1.5 text-[11.5px] font-bold transition"
              style={category === c.id
                ? { background: "rgba(46,41,255,0.14)", color: "var(--accent-ink, #2E29FF)" }
                : { background: "rgba(128,128,128,0.08)", color: "var(--t-body, #30333F)" }}>
              {c.label}
            </button>
          ))}
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Гарчиг (заавал биш)"
          maxLength={120}
          className="mt-3 w-full rounded-[4px] px-3.5 py-2.5 text-[14px] text-[var(--nav-fg-strong)] placeholder-[#62666F] outline-none"
          style={{ background: "rgba(128,128,128,0.08)" }}
        />
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Промптоо энд буулга…"
          rows={6}
          maxLength={4000}
          className="mt-2 w-full resize-none rounded-[4px] px-3.5 py-3 text-[13.5px] leading-[1.6] text-[var(--nav-fg-strong)] placeholder-[#62666F] outline-none"
          style={{ background: "rgba(128,128,128,0.08)" }}
        />

        {/* ─── ҮНЭГҮЙ / ЗАРНА ───────────────────────────────────────────
            Хоёр товч, хоёр өөр бизнес. Үнэгүй нь нэр хүнд цуглуулна,
            зарах нь кредит. Сонголт нь ил байх ёстой — нуувал хэн ч
            зарахаа мэдэхгүй. */}
        <div className="mt-3 grid grid-cols-2 gap-1.5">
          {(["free", "premium"] as const).map((a) => (
            <button key={a} type="button" onClick={() => setAccess(a)}
              className="rounded-[4px] px-3 py-2.5 text-[12.5px] font-bold transition"
              style={access === a
                ? { background: "rgba(46,41,255,0.14)", color: "var(--accent-ink, #2E29FF)" }
                : { background: "rgba(128,128,128,0.08)", color: "var(--t-body, #30333F)" }}>
              {a === "free" ? "Үнэгүй" : "Кредитээр зарах"}
            </button>
          ))}
        </div>

        {access === "premium" && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-[#E2E4E8]">Үнэ (кредит)</span>
              <input
                type="number" min={1} max={100000} value={price}
                onChange={(e) => setPrice(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full rounded-[4px] px-3 py-2.5 text-[14px] font-bold tabular-nums text-[var(--nav-fg-strong)] outline-none"
                style={{ background: "rgba(128,128,128,0.08)" }}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-[#E2E4E8]">Хувь (0=хязгааргүй)</span>
              <input
                type="number" min={0} max={1000} value={editions}
                onChange={(e) => setEditions(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full rounded-[4px] px-3 py-2.5 text-[14px] font-bold tabular-nums text-[var(--nav-fg-strong)] outline-none"
                style={{ background: "rgba(128,128,128,0.08)" }}
              />
            </label>
            <p className="col-span-2 text-[11px] leading-relaxed text-[#E2E4E8]">
              {editions > 0
                ? `Зөвхөн ${editions} хүн эзэмшинэ. Дуусвал дахин зарагдахгүй — ховордол нь үнэ цэн.`
                : "Хязгааргүй хувь. Хомсдол хэрэгтэй бол тоо оруул."}
            </p>
          </div>
        )}

        {err && <div className="mt-2 text-[12px]" style={{ color: "var(--accent-ink, #2E29FF)" }}>{err}</div>}

        <button
          type="button"
          onClick={submit}
          disabled={busy || !prompt.trim() || !image}
          className="press mt-4 w-full rounded-[4px] py-3 text-[14px] font-black text-white transition disabled:opacity-35"
          style={{ background: "#2E29FF" }}
        >
          {busy ? "Нэмж байна…" : "Санд нэмэх"}
        </button>
        {!image && <p className="mt-2 text-center text-[11px] text-[#E2E4E8]">Зураггүй промпт нэмэгдэхгүй</p>}
      </div>

      <style jsx global>{`
        @keyframes pa-rise { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: translateY(0) } }
        .pa-panel { animation: pa-rise 0.22s cubic-bezier(0.2,0.8,0.3,1); }
      `}</style>
    </div>
  );
}

/** Дэлхий нийтийн хост — `layout.tsx`-д нэг л удаа суулгана. */
export default function PromptAddSheetHost() {
  const router = useRouter();
  /* 2026-10-06: цонхны оронд бүтэн хуудас /prompts/new (Higgsfield маяг).
     Дохио, дуудагчид өөрчлөгдөөгүй — зөвхөн хүрэх газар нь. `Sheet` код
     нь доор хэвээр (ашиглагдахгүй). */
  useEffect(() => {
    const on = (e: Event) => {
      const cat = (e as CustomEvent<{ category?: string }>).detail?.category;
      router.push(cat ? `/prompts/new?category=${encodeURIComponent(cat)}` : "/prompts/new");
    };
    window.addEventListener("antaqor:prompt:add", on);
    return () => window.removeEventListener("antaqor:prompt:add", on);
  }, [router]);

  return null;
}

// Хуучин цонх — /prompts/new-д шилжсэн. Устгаагүй: буцаах шаардлага гарвал.
export const LegacyPromptSheet = Sheet;
