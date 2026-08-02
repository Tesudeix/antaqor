"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Btn, Card, SectionHeader, Skeleton, T } from "@/components/admin/kit";

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
}

const EMPTY: Omit<Slide, "id"> = {
  order: 0,
  chrome: "ANTAQOR /// ШИНЭ ЭЛСЭЛТ",
  line1: "БОДИТ ЗҮЙЛ",
  line2: "БҮТЭЭ.",
  sub: "",
  ctaLabel: "Эхлэх",
  ctaHref: "/auth/signup?plan=starter",
  image: "",
  active: true,
};

// ─── Нүүрний hero слайдер — зурагтай слайдуудыг эндээс удирдана ───
export default function AdminHeroPage() {
  const [slides, setSlides] = useState<Slide[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [uploadFor, setUploadFor] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    fetch("/api/admin/hero-slides")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setSlides(d.slides ?? []))
      .catch(() => setSlides([]));
  }, []);

  useEffect(load, [load]);

  const patch = async (id: string, fields: Partial<Slide>) => {
    setBusy(id);
    await fetch("/api/admin/hero-slides", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...fields }),
    });
    setBusy(null);
    load();
  };

  const create = async () => {
    setBusy("new");
    await fetch("/api/admin/hero-slides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(EMPTY),
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

  const pickImage = (id: string) => {
    setUploadFor(id);
    fileRef.current?.click();
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const id = uploadFor;
    if (!file || !id) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("Зураг 5MB-с бага байх ёстой");
      return;
    }
    setBusy(id);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Зураг оруулах амжилтгүй");
        return;
      }
      await patch(id, { image: data.url });
    } finally {
      setBusy(null);
      setUploadFor(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // Local field editing — blur дээр хадгална.
  const setField = (id: string, k: keyof Slide, v: string | number | boolean) =>
    setSlides((prev) => (prev ? prev.map((s) => (s.id === id ? { ...s, [k]: v } : s)) : prev));

  const inputCls =
    "w-full rounded-[4px] border border-[rgba(255,255,255,0.1)] bg-[#0a0a0c] px-2.5 py-2 text-[13px] text-[#F4F0E8] outline-none transition focus:border-[#1080CA]";

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="chrome flex items-center gap-2 text-[9px] font-bold">
            <span className="text-[#1080CA]">[HERO]</span>
            <span className="text-[#1080CA]">/////</span>
            <span style={{ color: T.faint }}>НҮҮРНИЙ СЛАЙДЕР</span>
          </div>
          <h1 className="mt-1 text-[24px] font-bold" style={{ color: "#1080CA", fontFamily: "var(--font-display)" }}>
            Hero слайдууд
          </h1>
          <p className="mt-1 text-[12px]" style={{ color: T.muted }}>
            Идэвхтэй слайд байхгүй бол нүүр хуудас өөрийн үндсэн слайдуудаа харуулна.
          </p>
        </div>
        <Btn onClick={create} loading={busy === "new"}>+ Слайд нэмэх</Btn>
      </div>

      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onFile} className="hidden" />

      {slides === null && <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-40" />)}</div>}
      {slides?.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-[13px]" style={{ color: T.muted }}>
            Слайд алга — «+ Слайд нэмэх» дараад эхэл. Нүүр одоогоор үндсэн слайдуудаа харуулж байна.
          </p>
        </Card>
      )}

      <div className="space-y-4">
        {(slides ?? []).map((s) => (
          <Card key={s.id} hud className="p-4">
            <div className="grid gap-4 md:grid-cols-[180px_1fr]">
              {/* Зураг */}
              <div>
                <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[4px] border border-[rgba(255,255,255,0.1)] bg-[#1080CA]">
                  {s.image ? (
                    <img src={s.image} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="chrome flex h-full items-center justify-center text-[9px] font-bold text-[#1080CA]">
                      ЗУРАГГҮЙ
                    </div>
                  )}
                </div>
                <div className="mt-2 flex gap-2">
                  <Btn size="sm" variant="secondary" onClick={() => pickImage(s.id)} loading={busy === s.id && uploadFor === s.id} className="flex-1">
                    Зураг оруулах
                  </Btn>
                  {s.image && (
                    <Btn size="sm" variant="ghost" onClick={() => patch(s.id, { image: "" })}>✕</Btn>
                  )}
                </div>
              </div>

              {/* Талбарууд */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-[11px] font-bold" style={{ color: s.active ? "#4ADE80" : T.faint }}>
                    <input type="checkbox" checked={s.active} onChange={(e) => patch(s.id, { active: e.target.checked })} />
                    {s.active ? "ИДЭВХТЭЙ" : "УНТРААСАН"}
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="chrome text-[8px]" style={{ color: T.faint }}>ДАРААЛАЛ</span>
                    <input
                      type="number"
                      value={s.order}
                      onChange={(e) => setField(s.id, "order", Number(e.target.value))}
                      onBlur={() => patch(s.id, { order: s.order })}
                      className={`${inputCls} w-16 text-center`}
                    />
                    <Btn size="sm" variant="danger" onClick={() => remove(s.id)} loading={busy === s.id && !uploadFor}>
                      Устгах
                    </Btn>
                  </div>
                </div>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {(
                    [
                      ["chrome", "EYEBROW (жижиг мөр)"],
                      ["line1", "МӨР 1 — шар"],
                      ["line2", "МӨР 2 — хар том"],
                      ["sub", "ТАЙЛБАР"],
                      ["ctaLabel", "ТОВЧНЫ ТЕКСТ"],
                      ["ctaHref", "ТОВЧНЫ ЛИНК"],
                    ] as [keyof Slide, string][]
                  ).map(([k, label]) => (
                    <div key={k} className={k === "sub" ? "sm:col-span-2" : ""}>
                      <label className="chrome mb-1 block text-[8px] font-bold" style={{ color: T.faint }}>{label}</label>
                      <input
                        value={String(s[k] ?? "")}
                        onChange={(e) => setField(s.id, k, e.target.value)}
                        onBlur={(e) => patch(s.id, { [k]: e.target.value } as Partial<Slide>)}
                        className={inputCls}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <ProgramTimeEditor />

      <SocialLinksEditor />

      <SectionHeader title="Урьдчилан харах" hint="antaqor.com нүүр — шинэ табаар нээгдэнэ" action={<Btn href="/" variant="ghost" size="sm">Нүүр үзэх ↗</Btn>} />
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

  const inputCls =
    "w-full rounded-[4px] border border-[rgba(255,255,255,0.1)] bg-[#0a0a0c] px-2.5 py-2 text-[13px] text-[#F4F0E8] outline-none transition focus:border-[#1080CA]";

  return (
    <div className="mt-10">
      <div className="chrome mb-3 flex items-center gap-2 text-[9px] font-bold">
        <span className="text-[#1080CA]">[FOOTER]</span>
        <span className="text-[#1080CA]">/////</span>
        <span style={{ color: T.faint }}>СОШИАЛ ЛИНКҮҮД</span>
      </div>
      <Card hud className="p-4">
        {!loaded ? (
          <Skeleton className="h-24" />
        ) : (
          <div className="space-y-2">
            {links.map((l, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={l.label}
                  onChange={(e) => setLinks(links.map((x, ix) => (ix === i ? { ...x, label: e.target.value } : x)))}
                  placeholder="Instagram / Facebook / YouTube / Threads…"
                  className={`${inputCls} w-40`}
                  maxLength={30}
                />
                <input
                  value={l.href}
                  onChange={(e) => setLinks(links.map((x, ix) => (ix === i ? { ...x, href: e.target.value } : x)))}
                  placeholder="https://…"
                  className={inputCls}
                  maxLength={300}
                />
                <button
                  onClick={() => setLinks(links.filter((_, ix) => ix !== i))}
                  aria-label="Устгах"
                  className="chrome shrink-0 text-[10px]"
                  style={{ color: T.faint }}
                >
                  ✕
                </button>
              </div>
            ))}
            {links.length < 8 && (
              <button
                onClick={() => setLinks([...links, { label: "", href: "" }])}
                className="chrome text-[9px] font-bold text-[#1080CA]"
              >
                + Линк нэмэх
              </button>
            )}
            <div className="flex items-center gap-3 pt-1">
              <Btn size="sm" onClick={save} loading={busy}>Хадгалах</Btn>
              {note && (
                <span className="text-[12px] font-bold" style={{ color: note.startsWith("✓") ? "#4ADE80" : "#4FA8E8" }}>
                  {note}
                </span>
              )}
              <span className="chrome text-[8px]" style={{ color: T.faint }}>
                ХООСОН БОЛ FOOTER ҮНДСЭН ЛИНКҮҮДЭЭ ХАРУУЛНА
              </span>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Хөтөлбөрийн release цаг — Day нээгдэх УБ цаг (SiteSettings) ───
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
      <div className="chrome mb-3 flex items-center gap-2 text-[9px] font-bold">
        <span className="text-[#1080CA]">[ХӨТӨЛБӨР]</span>
        <span className="text-[#1080CA]">/////</span>
        <span style={{ color: T.faint }}>DAY НЭЭГДЭХ ЦАГ (УБ)</span>
      </div>
      <Card hud className="flex flex-wrap items-center gap-3 p-4">
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
              className="w-24 rounded-[4px] border border-[rgba(255,255,255,0.1)] bg-[#0a0a0c] px-3 py-2.5 text-center text-[15px] font-bold text-[#1080CA] outline-none focus:border-[#1080CA]"
              style={{ fontVariantNumeric: "tabular-nums" }}
              aria-label="Нээгдэх цаг"
            />
            <span className="text-[13px]" style={{ color: T.muted }}>
              :00 цагт өдөр бүрийн хичээл нээгдэнэ (гишүүн бүрийн нэгдсэн өдрөөс тоолно)
            </span>
            <Btn size="sm" onClick={save} loading={busy}>Хадгалах</Btn>
            {note && (
              <span className="text-[12px] font-bold" style={{ color: note.startsWith("✓") ? "#4ADE80" : "#4FA8E8" }}>
                {note}
              </span>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
