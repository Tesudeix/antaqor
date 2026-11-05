"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import LoginCard from "@/components/LoginCard";
import { PROMPT_CATEGORIES } from "@/components/PromptAddSheet";
import PromptPoster, { POSTER_W, POSTER_H, type PromptPosterData } from "@/components/PromptPoster";

/* ─── /prompts/new — ПРОМПТ НЭМЭХ, Higgsfield маяг (2026-10-06) ────────────
   Зүүнд хэрэгслийн самбар: хоёр "Required" хайрцаг (зураг, промпт), ангилал,
   нийтлэх товч. Баруунд тайз: картын АМЬД урьдчилсан харагдац — дээр нь
   зураг, доор нь промпт — яг /prompts дээр харагдах хэлбэрээрээ.

   API нь хуучин цонхтой (PromptAddSheet) ИЖИЛ: POST /api/prompts/items.
   Зураг заавал гэдэг дүрэм UI, API, схем гурван давхаргад хэвээр. */

/* Viral промптын бүтэц — постер дээрх мөрүүд, промпт угсрах дараалал. */
const POSTER_FIELDS = [
  { key: "lighting", label: "Lighting", hint: "hard sunlight, blue shadows" },
  { key: "pose", label: "Pose", hint: "looking over shoulder" },
  { key: "location", label: "Location", hint: "Tokyo rooftop at dusk" },
  { key: "camera", label: "Camera", hint: "35mm, low angle, f/1.8" },
  { key: "style", label: "Style", hint: "cinematic, film grain" },
] as const;

function RequiredBox({
  title, hint, done, onClick, children, icon,
}: {
  title: string; hint: string; done: boolean; onClick?: () => void; children?: React.ReactNode; icon: React.ReactNode;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className="relative flex w-full flex-col items-center justify-center rounded-[4px] border border-dashed px-5 py-7 text-center transition"
      style={{ borderColor: done ? "#2E29FF" : "rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.025)" }}
    >
      <span
        className="absolute right-3 top-3 rounded-full px-2.5 py-1 text-[11.5px] font-medium"
        style={{ background: done ? "rgba(46,41,255,0.18)" : "rgba(255,255,255,0.06)", color: done ? "#1F1AD9" : "#565967" }}
      >
        {done ? "✓ Бэлэн" : "Required"}
      </span>
      {children ?? (
        <>
          <span className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "rgba(255,255,255,0.06)", color: "#14151C" }}>
            {icon}
          </span>
          <span className="mt-4 text-[17px] font-semibold text-[#F2F2F4]">{title}</span>
          <span className="mt-1 text-[14px] text-[#9C9CA6]">{hint}</span>
        </>
      )}
    </Tag>
  );
}

function Creator() {
  const router = useRouter();
  const search = useSearchParams();
  const { data: session, status } = useSession();
  const myName = session?.user?.name || "";
  const myHandle = ((session?.user as { username?: string } | undefined)?.username || myName).trim();
  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(search?.get("category") || PROMPT_CATEGORIES[0].id);
  const [image, setImage] = useState("");
  /* Зураггүй хүнд АНХДАГЧ ПОСТЕР: текстээ бичээд нийтлэхэд HTML постер
     PNG болж зураг болно. "upload" горимд хуучин шигээ өөрийн зураг. */
  const [mode, setMode] = useState<"poster" | "upload">("poster");
  const [pTitle, setPTitle] = useState("");
  /* Бүтэцтэй промпт — viral зургийн "жор"-ын үндсэн хэсгүүд. Хоосон мөр
     постер дээр зурагдахгүй. */
  const [pFields, setPFields] = useState<Record<string, string>>({});
  /* Шошго: null = анхдагч (хэрэглэгчийн өөрийн нэр). Хүн устгавал "" →
     постер дээр шошго харагдахгүй. Дугаар, хуудас мөн хоосон бол алга. */
  const [pTag, setPTag] = useState<string | null>(null);
  const [pNum, setPNum] = useState("");
  const [pPage, setPPage] = useState("");
  const [pCta, setPCta] = useState("Промптыг antaqor.com-оос хуул");
  const [dl, setDl] = useState<"" | "png" | "mp4">("");
  /* Сүүлд upload хийсэн постер — PNG/MP4 татаад дараа нь нийтлэхэд дахин
     upload хийхгүйн тулд (постерын агуулга өөрчлөгдөөгүй бол). */
  const uploaded = useRef<{ key: string; url: string } | null>(null);
  const posterRef = useRef<HTMLDivElement>(null);
  /* Урьдчилсан харагдацын масштаб — картын БОДИТ өргөнөөс. Утсан дээр карт
     340px-ээс нарийн тул тогтмол масштаб постерыг баруун талаас тайрна. */
  const previewRef = useRef<HTMLDivElement>(null);
  const [pScale, setPScale] = useState(340 / POSTER_W);
  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setPScale(e.contentRect.width / POSTER_W));
    ro.observe(el);
    return () => ro.disconnect();
  }, [mode]);
  const [access, setAccess] = useState<"free" | "premium">("free");
  const [price, setPrice] = useState(50);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  if (status === "unauthenticated") {
    return <LoginCard next="/prompts/new" heading="Промпт нэмэхийн тулд нэвтэрнэ үү" subtitle="Зураг + промптоо хуваалцаарай" />;
  }

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

  const posterData: PromptPosterData = {
    number: pNum,
    tag: pTag ?? myName,
    title: pTitle.trim(),
    fields: POSTER_FIELDS.map((f) => ({ label: f.label, value: pFields[f.key] || "" })),
    handle: myHandle ? `@${myHandle.replace(/^@/, "")}` : "",
    page: pPage,
    cta: pCta,
    image: image || undefined,
  };
  const posterKey = JSON.stringify(posterData);
  const posterReady = mode === "poster" && (pTitle.trim().length > 0 || Object.values(pFields).some((v) => v.trim()));
  const ready = (mode === "upload" ? !!image : posterReady) && prompt.trim().length > 0 && !uploading;

  /** Бүтэцтэй талбаруудаас промптын текст угсрах — хүн дахин бичихгүй. */
  const composePrompt = () => {
    const lines = [
      pTitle.trim() && `Subject: ${pTitle.trim()}`,
      ...POSTER_FIELDS.map((f) => (pFields[f.key] || "").trim() && `${f.label}: ${(pFields[f.key] || "").trim()}`),
    ].filter(Boolean);
    if (lines.length) setPrompt(lines.join("\n"));
  };

  /** HTML постер → 1080×1350 PNG blob (offscreen бүтэн хэмжээтэй хуулбараас). */
  const capture = async (): Promise<Blob> => {
    const node = posterRef.current;
    if (!node) throw new Error("Постер бэлэн биш байна");
    if (document.fonts?.ready) await document.fonts.ready;
    const { default: html2canvas } = await import("html2canvas-pro");
    const canvas = await html2canvas(node, { scale: 2, backgroundColor: "#F8F9FD", logging: false });
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/png"));
    if (!blob) throw new Error("Постер зурж чадсангүй");
    return blob;
  };

  /** Постерыг /api/upload руу — агуулга өөрчлөгдөөгүй бол өмнөхийг ашиглана. */
  const renderPoster = async (): Promise<string> => {
    if (uploaded.current?.key === posterKey) return uploaded.current.url;
    const blob = await capture();
    const fd = new FormData();
    fd.append("file", new File([blob], "poster.png", { type: "image/png" }));
    const r = await fetch("/api/upload", { method: "POST", body: fd });
    const d = await r.json();
    if (!r.ok || !d.url) throw new Error(d.error || "Постер хадгалж чадсангүй");
    uploaded.current = { key: posterKey, url: d.url as string };
    return d.url as string;
  };

  const saveBlob = (blob: Blob, name: string) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };

  const downloadPng = async () => {
    if (dl) return;
    setDl("png"); setErr("");
    try { saveBlob(await capture(), "antaqor-prompt.png"); }
    catch (e) { setErr(e instanceof Error ? e.message : "Алдаа"); }
    finally { setDl(""); }
  };

  /* MP4: постер upload → сервер ffmpeg (6с zoom + fade, 1080×1350). */
  const downloadMp4 = async () => {
    if (dl) return;
    setDl("mp4"); setErr("");
    try {
      const img = await renderPoster();
      const r = await fetch("/api/prompts/poster-video", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: img }),
      });
      const d = await r.json();
      if (!r.ok || !d.url) throw new Error(d.error || "Видео үүсгэж чадсангүй");
      const v = await fetch(d.url);
      saveBlob(await v.blob(), "antaqor-prompt.mp4");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Алдаа");
    } finally { setDl(""); }
  };

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true); setErr("");
    try {
      const finalImage = mode === "poster" ? await renderPoster() : image;
      const r = await fetch("/api/prompts/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(), title: (title.trim() || (mode === "poster" ? pTitle.trim() : "")), category, image: finalImage,
          access, price: access === "premium" ? price : 0, editions: 0,
        }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Алдаа"); return; }
      router.push("/prompts");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Сүлжээний алдаа");
    } finally { setBusy(false); }
  };

  const catLabel = PROMPT_CATEGORIES.find((c) => c.id === category)?.label || category;

  return (
    <div className="mx-auto grid w-full max-w-[1200px] gap-5 px-4 pb-24 pt-2 lg:grid-cols-[440px_minmax(0,1fr)] lg:px-0 lg:pb-10">
      {/* ═══ ЗҮҮН — хэрэгслийн самбар ═══ */}
      <section className="self-start rounded-[4px] p-4" style={{ background: "#FFFFFF", border: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex gap-6 border-b px-2" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
          {PROMPT_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className="relative pb-3 pt-1 text-[15px] font-medium transition"
              style={{ color: category === c.id ? "#14151C" : "#565967" }}
            >
              {c.label}
              {category === c.id && <span className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-[#F2F2F4]" />}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-3.5">
          {/* Зураг: АНХДАГЧ ПОСТЕР эсвэл өөрийн зураг */}
          <div className="grid grid-cols-2 gap-1 rounded-[4px] p-1" style={{ background: "rgba(255,255,255,0.04)" }}>
            {([["poster", "Постер үүсгэх"], ["upload", "Зураг оруулах"]] as const).map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className="h-10 rounded-[4px] text-[13.5px] font-semibold transition"
                style={mode === m ? { background: "#F1F2F7", color: "#14151C" } : { color: "#565967" }}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === "upload" ? (
            <>
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
          <RequiredBox
            title={uploading ? "Илгээж байна…" : "Зургаа оруул"}
            hint="Промптоор гаргасан үр дүнгийн зураг"
            done={!!image}
            onClick={() => fileRef.current?.click()}
            icon={
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />
              </svg>
            }
          >
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt="" className="max-h-[220px] w-full rounded-[4px] object-cover" />
            ) : undefined}
          </RequiredBox>
            </>
          ) : (
            <RequiredBox title="" hint="" done={posterReady} icon={null}>
              <div className="flex w-full flex-col gap-2.5 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-[15px] font-semibold text-[#F2F2F4]">Брэндтэй постер</span>
                  <span className="text-[11px] text-[#62666F]">хоосон мөр харагдахгүй</span>
                </div>
                {/* Постерын ДЭЭД зураг — заавал биш; хоосон бол чимэглэлтэй зай үлдэнэ. */}
                <input ref={fileRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                    className="flex h-11 flex-1 items-center justify-center gap-2 rounded-[4px] border border-dashed text-[13.5px] font-semibold text-[#F2F2F4] disabled:opacity-50"
                    style={{ borderColor: image ? "#2E29FF" : "rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.03)" }}>
                    {uploading ? "Илгээж байна…" : image ? "Дээд зургийг солих" : "＋ Дээд зураг (заавал биш)"}
                  </button>
                  {image && (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={image} alt="" className="h-11 w-11 rounded-[4px] object-cover" />
                      <button type="button" onClick={() => setImage("")} aria-label="Зураг авах"
                        className="h-11 w-9 rounded-[4px] text-[16px] text-[#9C9CA6]" style={{ background: "rgba(255,255,255,0.05)" }}>×</button>
                    </>
                  )}
                </div>
                <input value={pTitle} onChange={(e) => setPTitle(e.target.value)} maxLength={32} placeholder="Гарчиг — жишээ: Cinematic portrait"
                  className="h-11 w-full rounded-[4px] px-3 text-[14.5px] font-semibold text-[#F2F2F4] outline-none placeholder:text-[#62666F]"
                  style={{ background: "rgba(255,255,255,0.05)" }} />
                {POSTER_FIELDS.map((f) => (
                  <label key={f.key} className="flex items-center gap-2 rounded-[4px] pl-3" style={{ background: "rgba(255,255,255,0.05)" }}>
                    <span className="w-[70px] shrink-0 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#2E29FF]">{f.label}</span>
                    <input value={pFields[f.key] || ""} onChange={(e) => setPFields((x) => ({ ...x, [f.key]: e.target.value }))} maxLength={110}
                      placeholder={f.hint}
                      className="h-10 min-w-0 flex-1 bg-transparent pr-3 text-[13.5px] text-[#F2F2F4] outline-none placeholder:text-[#62666F]" />
                  </label>
                ))}
                <button type="button" onClick={composePrompt}
                  className="self-start rounded-[4px] px-3 py-1.5 text-[12.5px] font-semibold text-[#2E29FF]" style={{ background: "rgba(46,41,255,0.10)" }}>
                  ↓ Талбаруудаас промпт угсрах
                </button>
                <div className="grid grid-cols-3 gap-2">
                  <label className="flex flex-col gap-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#62666F]">
                    Дугаар
                    <input value={pNum} onChange={(e) => setPNum(e.target.value)} maxLength={4} placeholder="—"
                      className="h-9 w-full rounded-[4px] px-2 text-[13px] font-semibold normal-case tracking-normal text-[#F2F2F4] outline-none" style={{ background: "rgba(255,255,255,0.05)" }} />
                  </label>
                  <label className="flex flex-col gap-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#62666F]">
                    Шошго
                    <input value={pTag ?? myName} onChange={(e) => setPTag(e.target.value)} maxLength={18} placeholder="—"
                      className="h-9 w-full rounded-[4px] px-2 text-[13px] font-semibold normal-case tracking-normal text-[#F2F2F4] outline-none" style={{ background: "rgba(255,255,255,0.05)" }} />
                  </label>
                  <label className="flex flex-col gap-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#62666F]">
                    Хуудас
                    <input value={pPage} onChange={(e) => setPPage(e.target.value)} maxLength={9} placeholder="01 / 05"
                      className="h-9 w-full rounded-[4px] px-2 text-[13px] font-semibold normal-case tracking-normal text-[#F2F2F4] outline-none" style={{ background: "rgba(255,255,255,0.05)" }} />
                  </label>
                </div>
                <input value={pCta} onChange={(e) => setPCta(e.target.value)} maxLength={36} placeholder="Товчны бичиг (хоосон бол товч алга)"
                  className="h-10 w-full rounded-[4px] px-3 text-[13.5px] text-[#F2F2F4] outline-none placeholder:text-[#62666F]"
                  style={{ background: "rgba(255,255,255,0.05)" }} />
              </div>
            </RequiredBox>
          )}

          <RequiredBox title="" hint="" done={prompt.trim().length > 0} icon={null}>
            <div className="w-full text-left">
              <div className="mb-2 text-[15px] font-semibold text-[#F2F2F4]">Промпт бичих</div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                maxLength={4000}
                rows={6}
                placeholder="Энэ зургийг гаргасан промптоо энд бич…"
                className="w-full resize-none rounded-[4px] bg-transparent text-[14.5px] leading-[1.6] text-[#F2F2F4] outline-none placeholder:text-[#62666F]"
              />
              <div className="text-right text-[11px] tabular-nums text-[#62666F]">{prompt.length}/4000</div>
            </div>
          </RequiredBox>

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder="Гарчиг (заавал биш)"
            className="h-12 w-full rounded-[4px] px-4 text-[14.5px] text-[#F2F2F4] outline-none placeholder:text-[#62666F]"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          />

          <div className="flex items-center gap-2">
            {(["free", "premium"] as const).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAccess(a)}
                className="h-10 flex-1 rounded-[4px] text-[13.5px] font-semibold transition"
                style={access === a
                  ? { background: "rgba(46,41,255,0.18)", color: "#4C47FF" }
                  : { background: "rgba(255,255,255,0.04)", color: "#565967" }}
              >
                {a === "free" ? "Үнэгүй" : "Кредитээр зарах"}
              </button>
            ))}
          </div>
          {access === "premium" && (
            <label className="flex items-center justify-between rounded-[4px] px-4 py-2.5 text-[13.5px] text-[#9C9CA6]" style={{ background: "rgba(255,255,255,0.04)" }}>
              Үнэ (кредит)
              <input
                type="number"
                min={1}
                value={price}
                onChange={(e) => setPrice(Math.max(1, Number(e.target.value) || 1))}
                className="w-24 bg-transparent text-right text-[15px] font-bold text-[#F2F2F4] outline-none"
              />
            </label>
          )}

          {err && <p className="text-[13px] text-[#FF6E86]">{err}</p>}

          <button
            type="button"
            onClick={submit}
            disabled={!ready || busy}
            className="press mt-2 h-14 w-full rounded-[4px] text-[17px] font-bold transition disabled:opacity-40"
            style={{ background: "#2E29FF", color: "#FFFFFF", boxShadow: "0 6px 0 -2px #1E1E1E" }}
          >
            {busy ? "Нийтэлж байна…" : "Нийтлэх"}
          </button>
        </div>
      </section>

      {/* html2canvas барих БҮТЭН хэмжээтэй хуулбар — дэлгэцээс гадна. Урьдчилсан
          харагдац нь transform-оор жижгэрсэн тул түүнийг барьж болохгүй. */}
      {mode === "poster" && (
        <div aria-hidden style={{ position: "fixed", left: -10000, top: 0, pointerEvents: "none" }}>
          <PromptPoster ref={posterRef} d={posterData} />
        </div>
      )}

      {/* ═══ БАРУУН — тайз: амьд урьдчилсан харагдац ═══ */}
      <section
        className="flex min-h-[520px] flex-col items-center justify-center rounded-[4px] px-5 py-10"
        style={{ background: "#FFFFFF", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <article className="w-full max-w-[340px] overflow-hidden rounded-[4px]" style={{ background: "#FFFFFF", boxShadow: "0 30px 80px -30px rgba(46,41,255,0.45)" }}>
          {mode === "poster" ? (
            <div ref={previewRef} className="relative w-full overflow-hidden" style={{ aspectRatio: `${POSTER_W} / ${POSTER_H}` }}>
              <div style={{ position: "absolute", left: 0, top: 0, transformOrigin: "top left", transform: `scale(${pScale})` }}>
                <PromptPoster d={posterData} />
              </div>
            </div>
          ) : (
          <div className="aspect-square w-full" style={{ background: image ? undefined : "linear-gradient(135deg,#1E1E1E 0%,#2E29FF 100%)" }}>
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-[13px] font-semibold text-white/70">Зураг энд гарна</div>
            )}
          </div>
          )}
          <div className="p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-[4px] px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.1em]" style={{ background: "rgba(46,41,255,0.16)", color: "#4C47FF" }}>
                {catLabel}
              </span>
              {access === "premium" && <span className="text-[12px] font-bold text-[#FCEE0A]">✦ {price}</span>}
            </div>
            {title && <div className="mt-2.5 text-[16px] font-bold text-[#F2F2F4]">{title}</div>}
            <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-[13.5px] leading-[1.55] text-[#C9C9D1]">
              {prompt.trim() || "Промпт чинь энд харагдана…"}
            </p>
            <div className="mt-3 flex h-9 items-center justify-center gap-1.5 rounded-[4px] text-[13px] font-bold" style={{ background: "#2E29FF", color: "#FFFFFF" }}>
              Промпт хуулах
            </div>
          </div>
        </article>

        {mode === "poster" && (
          <div className="mt-4 grid w-full max-w-[340px] grid-cols-2 gap-2">
            <button type="button" onClick={downloadPng} disabled={!!dl || !posterReady}
              className="press h-11 rounded-[4px] text-[13.5px] font-bold transition disabled:opacity-40 border border-[#FCEE0A]/60 bg-transparent text-[#FCEE0A] hover:bg-[rgba(252,238,10,0.12)]">
              {dl === "png" ? "Зурж байна…" : "⬇ Зураг (PNG)"}
            </button>
            <button type="button" onClick={downloadMp4} disabled={!!dl || !posterReady}
              className="press h-11 rounded-[4px] text-[13.5px] font-bold transition disabled:opacity-40" style={{ background: "rgba(46,41,255,0.14)", color: "#2E29FF" }}>
              {dl === "mp4" ? "Видео хийж байна…" : "⬇ Видео (MP4)"}
            </button>
          </div>
        )}

        <h2 className="mt-10 text-center text-[clamp(28px,4vw,44px)] font-extrabold uppercase leading-[1.02] tracking-[-0.02em] text-[#F2F2F4]">
          Зургаа хуваалц,<br />промптоо үлдээ
        </h2>
        <p className="mt-3 text-center text-[16px] text-[#9C9CA6]">Дээр нь үр дүн, доор нь жор — бусад нь шууд давтана.</p>
        <Link href="/prompts" className="mt-5 text-[14px] font-semibold text-[#4C47FF]">Промптын сан руу →</Link>
      </section>
    </div>
  );
}

export default function NewPromptPage() {
  return (
    <Suspense fallback={null}>
      <Creator />
    </Suspense>
  );
}
