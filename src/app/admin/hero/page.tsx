"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Btn, Card, SectionHeader, Skeleton, T } from "@/components/admin/kit";
import { PROGRAM_WEEK_DEFAULT, programDay, type ProgramWeek } from "@/lib/programWeek";

/* ─── /admin/hero — нүүрний слайдер (2026-10-26 цэгцэлсэн) ───────────────────
   Өмнө нь энд нүүрэнд ХАРАГДДАГГҮЙ талбарууд (layout, «МӨР 1 — шар»…)
   засагддаг, дарааллыг тоогоор бичдэг, зургийг зөвхөн товчоор оруулдаг байв.
   Одоо зөвхөн нүүрэнд бодитоор гардаг зүйлс:
     зураг/видео → постер (3:4)
     шошго, гарчиг, тайлбар, товч → постерын ДООР (desktop: баруун талд)
   `layout` талбар DB-д хэвээр, зүгээр л засагдахаа больсон. */

/** Слайдын медиа видео мөн үү — hero дээрх шалгалттай ижил дүрэм. */
const isVideoSrc = (u: string) => /[.](mp4|webm|mov|m4v)([?#]|$)/i.test(u);

interface Slide {
  id: string;
  order: number;
  chrome: string;
  line1: string;
  line2: string;
  sub: string;
  ctaLabel: string;
  ctaHref: string;
  image: string;
  active: boolean;
  layout: string;
}

const EMPTY: Omit<Slide, "id"> = {
  order: 0,
  chrome: "ANTAQOR",
  line1: "AI Creator",
  line2: "хүрээлэл.",
  sub: "",
  ctaLabel: "Нэгдэх",
  ctaHref: "/auth/signup",
  image: "",
  active: true,
  layout: "poster",
};

const FIELDS: { k: keyof Slide; label: string; hint: string; area?: boolean; wide?: boolean }[] = [
  { k: "chrome", label: "Жижиг шошго", hint: "ж: ANTAQOR" },
  { k: "line1", label: "Гарчиг", hint: "ж: AI Creator" },
  { k: "line2", label: "Гарчгийн үргэлжлэл", hint: "ж: хүрээлэл." },
  { k: "sub", label: "Тайлбар", hint: "Нэг хоёр өгүүлбэр — энэ юу вэ, юу олох вэ", area: true, wide: true },
  { k: "ctaLabel", label: "Товчны текст", hint: "ж: Нэгдэх" },
  { k: "ctaHref", label: "Товчны линк", hint: "/auth/signup" },
];

const field: React.CSSProperties = {
  width: "100%",
  borderRadius: 6,
  border: `1px solid ${T.border}`,
  background: "#FFFFFF",
  color: T.text,
  padding: "9px 11px",
  fontSize: 14,
  outline: "none",
};
const labelStyle: React.CSSProperties = { display: "block", marginBottom: 4, fontSize: 12, fontWeight: 600, color: T.muted };

const MAX_IMG = 5 * 1024 * 1024;
const MAX_VID = 25 * 1024 * 1024;

export default function AdminHeroPage() {
  const [slides, setSlides] = useState<Slide[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/admin/hero-slides")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setSlides(d.slides ?? []))
      .catch(() => setSlides([]));
  }, []);

  useEffect(load, [load]);

  const put = (id: string, fields: Partial<Slide>) =>
    fetch("/api/admin/hero-slides", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...fields }),
    }).then((r) => r.ok);

  const create = async () => {
    setBusy("new");
    await fetch("/api/admin/hero-slides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...EMPTY, order: (slides?.length ?? 0) * 10 }),
    });
    setBusy(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Энэ слайдыг устгах уу?")) return;
    setBusy(id);
    await fetch("/api/admin/hero-slides", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setBusy(null);
    load();
  };

  /* Дарааллыг тоогоор бичүүлэхийн оронд ↑↓. Олон слайд ижил `order`-той
     (жишээ нь бүгд 0) байж болох тул солих бүрт бүх жагсаалтыг 0,10,20…
     болгож дахин дугаарлана — зөвхөн өөрчлөгдсөнийг нь хадгална. */
  const move = async (i: number, dir: -1 | 1) => {
    if (!slides) return;
    const j = i + dir;
    if (j < 0 || j >= slides.length) return;
    const next = [...slides];
    [next[i], next[j]] = [next[j], next[i]];
    const renum = next.map((s, ix) => ({ ...s, order: ix * 10 }));
    const was = new Map(slides.map((s) => [s.id, s.order]));
    setSlides(renum);
    setBusy(slides[i].id);
    await Promise.all(renum.filter((s) => was.get(s.id) !== s.order).map((s) => put(s.id, { order: s.order })));
    setBusy(null);
    load();
  };

  const activeCount = (slides ?? []).filter((s) => s.active).length;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-bold" style={{ color: T.text, fontFamily: "var(--font-display)" }}>
            Нүүрний слайдер
          </h1>
          <p className="mt-1 max-w-xl text-[13px] leading-relaxed" style={{ color: T.muted }}>
            Зочин antaqor.com-д ороход хамгийн түрүүнд харагдана. Зураг нь постер болж гарна, доор нь гарчиг,
            тайлбар, товч, Telegram чат, 7 хоногийн хөтөлбөрийн «Day» карт гарна.
          </p>
        </div>
        <div className="flex gap-2">
          <Btn href="/" variant="ghost" size="sm">Нүүр үзэх ↗</Btn>
          <Btn onClick={create} loading={busy === "new"}>+ Слайд нэмэх</Btn>
        </div>
      </div>

      <div
        className="mb-4 flex flex-wrap gap-x-5 gap-y-1 rounded-[6px] px-4 py-3 text-[12px]"
        style={{ background: "rgba(46,41,255,0.06)", color: T.muted }}
      >
        <span><b style={{ color: T.text }}>Хэмжээ:</b> босоо 3:4 (жишээ 1080×1440)</span>
        <span><b style={{ color: T.text }}>Зураг</b> ≤5MB · <b style={{ color: T.text }}>видео</b> ≤25MB (mp4)</span>
        <span><b style={{ color: T.text }}>Нүүрэнд:</b> {activeCount} идэвхтэй слайд{activeCount > 1 ? " — 6 сек тутам солигдоно" : ""}</span>
      </div>

      {slides === null && <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-56" />)}</div>}
      {slides?.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-[13px]" style={{ color: T.muted }}>
            Слайд алга — «+ Слайд нэмэх» дараад зургаа оруулна уу.
          </p>
        </Card>
      )}

      <div className="space-y-4">
        {(slides ?? []).map((s, i) => (
          <SlideCard
            key={s.id}
            slide={s}
            index={i}
            total={slides!.length}
            busy={busy === s.id}
            onMove={(d) => move(i, d)}
            onRemove={() => remove(s.id)}
            onSave={async (f) => {
              setSlides((prev) => (prev ? prev.map((x) => (x.id === s.id ? { ...x, ...f } : x)) : prev));
              return put(s.id, f);
            }}
          />
        ))}
      </div>

      <ProgramWeekEditor />

      <ProgramTimeEditor />

      <SocialLinksEditor />
    </div>
  );
}

// ─── Нэг слайд: зүүн талд постер (чирж оруулна), баруун талд бичвэр ───
function SlideCard({
  slide: s, index, total, busy, onMove, onRemove, onSave,
}: {
  slide: Slide;
  index: number;
  total: number;
  busy: boolean;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  onSave: (f: Partial<Slide>) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState(s);
  const [uploading, setUploading] = useState(false);
  const [drag, setDrag] = useState(false);
  const [saved, setSaved] = useState<"" | "ok" | "err">("");
  const [ratio, setRatio] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => setDraft(s), [s]);

  const save = async (f: Partial<Slide>) => {
    const ok = await onSave(f);
    setSaved(ok ? "ok" : "err");
    setTimeout(() => setSaved(""), 1800);
  };

  const upload = async (file: File) => {
    const isVid = file.type.startsWith("video/");
    if (!isVid && !file.type.startsWith("image/")) return alert("Зураг эсвэл видео файл сонгоно уу");
    if (file.size > (isVid ? MAX_VID : MAX_IMG)) return alert(isVid ? "Видео 25MB-с бага байх ёстой" : "Зураг 5MB-с бага байх ёстой");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) return alert(data.error || "Файл оруулах амжилтгүй");
      setRatio(null);
      await save({ image: data.url });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  /* 3:4-өөс их зөрвөл нүүрэнд хажуу/дээд тал нь тайрагдана (object-cover). */
  const offRatio = ratio !== null && Math.abs(ratio - 0.75) > 0.08;

  return (
    <Card className="p-4" >
      <div className="grid gap-5 md:grid-cols-[200px_1fr]">
        <div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              const f = e.dataTransfer.files?.[0];
              if (f) upload(f);
            }}
            className="relative block aspect-[3/4] w-full overflow-hidden rounded-[8px]"
            style={{
              background: "#F1F2F7",
              outline: `2px dashed ${drag ? T.primary : s.image ? "transparent" : T.borderHi}`,
              outlineOffset: -2,
            }}
            aria-label="Зураг эсвэл видео оруулах"
          >
            {s.image ? (
              isVideoSrc(s.image) ? (
                <video src={s.image} muted loop playsInline autoPlay className="h-full w-full object-cover"
                  onLoadedMetadata={(e) => setRatio(e.currentTarget.videoWidth / (e.currentTarget.videoHeight || 1))} />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.image} alt="" className="h-full w-full object-cover"
                  onLoad={(e) => setRatio(e.currentTarget.naturalWidth / (e.currentTarget.naturalHeight || 1))} />
              )
            ) : (
              <span className="flex h-full flex-col items-center justify-center gap-1 px-3 text-center text-[12px]" style={{ color: T.muted }}>
                <b style={{ color: T.primary, fontSize: 13 }}>Зураг оруулах</b>
                дарж сонгох эсвэл энд чирж тавина
              </span>
            )}
            {(uploading || drag) && (
              <span className="absolute inset-0 flex items-center justify-center text-[13px] font-semibold"
                style={{ background: "rgba(255,255,255,0.86)", color: T.primary }}>
                {uploading ? "Байршуулж байна…" : "Энд тавина уу"}
              </span>
            )}
          </button>
          <input ref={fileRef} type="file" className="hidden"
            accept="image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm,video/quicktime"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
          {offRatio && (
            <p className="mt-2 text-[11px] leading-snug" style={{ color: T.warnInk }}>
              Энэ файл 3:4 биш — нүүрэнд захаас нь тайрагдана.
            </p>
          )}
          {s.image && (
            <div className="mt-2 flex gap-2">
              <Btn size="sm" variant="secondary" onClick={() => fileRef.current?.click()} loading={uploading} className="flex-1">Солих</Btn>
              <Btn size="sm" variant="ghost" onClick={() => save({ image: "" })}>Хасах</Btn>
            </div>
          )}
        </div>

        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => save({ active: !s.active })}
              className="inline-flex items-center gap-2 text-[13px] font-semibold"
              style={{ color: s.active ? T.okInk : T.faint }}
              aria-pressed={s.active}
            >
              <span className="relative inline-block h-5 w-9 rounded-full transition-colors"
                style={{ background: s.active ? "#16A34A" : "#D4D6DE" }}>
                <span className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all"
                  style={{ left: s.active ? 18 : 2 }} />
              </span>
              {s.active ? "Нүүрэнд харагдаж байна" : "Нуусан"}
            </button>
            <div className="flex items-center gap-1.5">
              {saved && (
                <span className="mr-1 text-[12px] font-semibold" style={{ color: saved === "ok" ? T.okInk : T.badInk }}>
                  {saved === "ok" ? "✓ Хадгалагдлаа" : "Хадгалж чадсангүй"}
                </span>
              )}
              <span className="mr-1 text-[12px]" style={{ color: T.faint }}>#{index + 1}</span>
              <Btn size="sm" variant="ghost" onClick={() => onMove(-1)} disabled={index === 0 || busy}>↑</Btn>
              <Btn size="sm" variant="ghost" onClick={() => onMove(1)} disabled={index === total - 1 || busy}>↓</Btn>
              <Btn size="sm" variant="danger" onClick={onRemove} disabled={busy}>Устгах</Btn>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {FIELDS.map(({ k, label, hint, area, wide }) => {
              const v = String(draft[k] ?? "");
              const commit = () => { if (v !== String(s[k] ?? "")) save({ [k]: v } as Partial<Slide>); };
              return (
                <div key={k} className={wide ? "sm:col-span-2" : ""}>
                  <label style={labelStyle}>{label}</label>
                  {area ? (
                    <textarea rows={2} value={v} placeholder={hint} style={{ ...field, resize: "vertical" }}
                      onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} onBlur={commit} />
                  ) : (
                    <input value={v} placeholder={hint} style={field}
                      onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} onBlur={commit} />
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[11px]" style={{ color: T.faint }}>
            Талбараас гармагц автоматаар хадгалагдана. Хоосон талбар нүүрэнд харагдахгүй.
          </p>
        </div>
      </div>
    </Card>
  );
}

// ─── 7 хоногийн хөтөлбөр — «Day N / 7» (SiteSettings `program_week`) ───
function ProgramWeekEditor() {
  const [p, setP] = useState<ProgramWeek | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    fetch("/api/program-week", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setP(d?.program ?? PROGRAM_WEEK_DEFAULT))
      .catch(() => setP(PROGRAM_WEEK_DEFAULT));
  }, []);

  const save = async () => {
    if (!p) return;
    setBusy(true);
    setNote("");
    try {
      const r = await fetch("/api/program-week", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.program) setP(d.program);
      setNote(r.ok ? "✓ Хадгалагдлаа — нүүр 1 минутын дотор шинэчлэгдэнэ" : d.error || "Хадгалж чадсангүй");
    } finally {
      setBusy(false);
    }
  };

  const info = p ? programDay(p) : null;
  const status = !p || !info ? "" :
    !p.active ? "Унтраасан — нүүрэнд харагдахгүй" :
    info.state === "live" ? `Өнөөдөр Day ${info.day} / ${p.days}` :
    info.state === "before" ? `${info.startsIn} өдрийн дараа эхэлнэ` :
    "Дууссан — нүүрэнд харагдахгүй";

  return (
    <div className="mt-10">
      <SectionHeader title="7 хоногийн хөтөлбөр" hint="нүүр + гишүүний урсгал дээрх «Day» карт" />
      <Card className="p-4">
        {!p ? (
          <Skeleton className="h-40" />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button type="button" onClick={() => setP({ ...p, active: !p.active })}
                className="inline-flex items-center gap-2 text-[13px] font-semibold"
                style={{ color: p.active ? T.okInk : T.faint }} aria-pressed={p.active}>
                <span className="relative inline-block h-5 w-9 rounded-full" style={{ background: p.active ? "#16A34A" : "#D4D6DE" }}>
                  <span className="absolute top-0.5 h-4 w-4 rounded-full bg-white" style={{ left: p.active ? 18 : 2 }} />
                </span>
                {p.active ? "Асаалттай" : "Унтраасан"}
              </button>
              <span className="rounded-[4px] px-2.5 py-1 text-[12px] font-bold" style={{ background: "rgba(46,41,255,0.08)", color: T.primary }}>
                {status}{info ? ` · ${info.dates[0]} – ${info.dates[info.dates.length - 1]}` : ""}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_170px_110px]">
              <div>
                <label style={labelStyle}>Нэр</label>
                <input value={p.title} maxLength={80} style={field} onChange={(e) => setP({ ...p, title: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Эхлэх өдөр (Day 1)</label>
                <input type="date" value={p.start} style={field} onChange={(e) => setP({ ...p, start: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Хэдэн өдөр</label>
                <input type="number" min={1} max={30} value={p.days} style={field}
                  onChange={(e) => setP({ ...p, days: Math.min(30, Math.max(1, Number(e.target.value) || 1)) })} />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Өдөр бүрийн сэдэв (заавал биш — бөглөсөн бол нүүрэнд өдрийн жагсаалт болж гарна, өнөөдрийнх тодорно)</label>
              <div className="grid gap-2 sm:grid-cols-2">
                {Array.from({ length: p.days }, (_, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-14 shrink-0 text-[12px] font-bold"
                      style={{ color: info?.state === "live" && info.day === i + 1 ? T.primary : T.faint }}>
                      Day {i + 1}
                    </span>
                    <input value={p.items[i] || ""} maxLength={80} placeholder={info?.dates[i] || ""} style={field}
                      onChange={(e) => {
                        const items = [...p.items];
                        while (items.length < p.days) items.push("");
                        items[i] = e.target.value;
                        setP({ ...p, items });
                      }} />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Btn size="sm" onClick={save} loading={busy}>Хадгалах</Btn>
              {note && (
                <span className="text-[12px] font-semibold" style={{ color: note.startsWith("✓") ? T.okInk : T.badInk }}>{note}</span>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Footer сошиал линкүүд — SiteSettings "social_links" (public: /api/social-links) ───
function SocialLinksEditor() {
  const [links, setLinks] = useState<{ label: string; href: string }[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    fetch("/api/admin/social-links")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (Array.isArray(d?.links)) setLinks(d.links);
      })
      .finally(() => setLoaded(true));
  }, []);

  const save = async () => {
    setBusy(true);
    setNote("");
    try {
      const r = await fetch("/api/admin/social-links", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ links }),
      });
      setNote(r.ok ? "✓ Хадгалагдлаа — footer шинэчлэгдэнэ" : "Хадгалж чадсангүй");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-10">
      <SectionHeader title="Footer сошиал линкүүд" hint="хоосон бол footer үндсэн линкүүдээ харуулна" />
      <Card className="p-4">
        {!loaded ? (
          <Skeleton className="h-24" />
        ) : (
          <div className="space-y-2">
            {links.map((l, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={l.label}
                  onChange={(e) => setLinks(links.map((x, ix) => (ix === i ? { ...x, label: e.target.value } : x)))}
                  placeholder="Instagram / Facebook…"
                  style={{ ...field, width: 160, flex: "none" }}
                  maxLength={30}
                />
                <input
                  value={l.href}
                  onChange={(e) => setLinks(links.map((x, ix) => (ix === i ? { ...x, href: e.target.value } : x)))}
                  placeholder="https://…"
                  style={field}
                  maxLength={300}
                />
                <button onClick={() => setLinks(links.filter((_, ix) => ix !== i))} aria-label="Устгах"
                  className="shrink-0 px-2 text-[13px]" style={{ color: T.faint }}>
                  ✕
                </button>
              </div>
            ))}
            {links.length < 8 && (
              <button onClick={() => setLinks([...links, { label: "", href: "" }])}
                className="text-[13px] font-semibold" style={{ color: T.primary }}>
                + Линк нэмэх
              </button>
            )}
            <div className="flex items-center gap-3 pt-1">
              <Btn size="sm" onClick={save} loading={busy}>Хадгалах</Btn>
              {note && (
                <span className="text-[12px] font-semibold" style={{ color: note.startsWith("✓") ? T.okInk : T.badInk }}>
                  {note}
                </span>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Хувийн аялал (Journey) — Day нээгдэх УБ цаг (SiteSettings) ───
// Энэ нь гишүүн бүрийн НЭГДСЭН өдрөөс тоолдог аялал; дээрх 7 хоногийн
// хөтөлбөрөөс тусдаа.
function ProgramTimeEditor() {
  const [hour, setHour] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    fetch("/api/admin/program-settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setHour(typeof d?.releaseHour === "number" ? d.releaseHour : 18))
      .catch(() => setHour(18));
  }, []);

  const save = async () => {
    if (hour === null) return;
    setBusy(true);
    setNote("");
    try {
      const r = await fetch("/api/admin/program-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ releaseHour: hour }),
      });
      setNote(r.ok ? "✓ Хадгалагдлаа" : "Алдаа");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-10">
      <SectionHeader title="Хувийн аялал" hint="гишүүн бүрийн нэгдсэн өдрөөс тоолно" />
      <Card className="flex flex-wrap items-center gap-3 p-4">
        {hour === null ? (
          <Skeleton className="h-10 w-40" />
        ) : (
          <>
            <input
              type="number"
              min={0}
              max={23}
              value={hour}
              onChange={(e) => setHour(Math.min(23, Math.max(0, Number(e.target.value) || 0)))}
              style={{ ...field, width: 80, textAlign: "center", fontWeight: 700, color: T.primary, fontVariantNumeric: "tabular-nums" }}
              aria-label="Нээгдэх цаг"
            />
            <span className="text-[13px]" style={{ color: T.muted }}>
              :00 цагт (УБ) дараагийн өдрийн хичээл нээгдэнэ
            </span>
            <Btn size="sm" onClick={save} loading={busy}>Хадгалах</Btn>
            {note && (
              <span className="text-[12px] font-semibold" style={{ color: note.startsWith("✓") ? T.okInk : T.badInk }}>
                {note}
              </span>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
