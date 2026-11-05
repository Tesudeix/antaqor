"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

/* ─── КЛИЕНТИЙН REEL ТЭЖЭЭЛ — /reels ───────────────────────────────────
   Клиентэд хийж өгсөн 15 секундын AI видеог TikTok маягийн босоо
   тэжээлээр үзүүлж, ТАТУУЛНА.

   Үзэхэд НЭВТРЭХ ШААРДЛАГАГҮЙ — клиент холбоосоор шууд ороод татна.
   Оруулах эрх нь `canUploadReels` туг эсвэл админд л нээлттэй.

   БҮРХҮҮЛ ХАРАНХУЙ: сайт цагаан боловч энэ нь медиа гадаргуу.
   Бичлэгийн хүрээ гэрэлтвэл зураг угаагдана — [[antaqor-white-theme]]
   дээрх видеоны дүрэмтэй ижил.

   Гүйлгэлт нь ЖИНХЭНЭ scroll-snap, JS чирэлт БИШ. */

interface Reel {
  id: string;
  title: string;
  client: string;
  caption: string;
  videoUrl: string;
  thumbnail: string;
  durationSec: number;
  views: number;
  downloads: number;
  uploaderName: string;
}

export default function ClientReels() {
  const router = useRouter();
  const { data: session } = useSession();
  const [reels, setReels] = useState<Reel[] | null>(null);
  const [clients, setClients] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [active, setActive] = useState(0);
  const [muted, setMuted] = useState(true);
  const [canUpload, setCanUpload] = useState(false);
  const [sheet, setSheet] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Record<number, HTMLVideoElement | null>>({});

  const load = useCallback(async (client: string) => {
    const q = client ? `?client=${encodeURIComponent(client)}` : "";
    const r = await fetch(`/api/reels${q}`);
    const d = await r.json();
    setReels(Array.isArray(d.reels) ? d.reels : []);
    if (!client && Array.isArray(d.clients)) setClients(d.clients);
    setActive(0);
  }, []);

  useEffect(() => { void load(filter); }, [filter, load]);

  /* Оруулах эрхтэй эсэхийг шалгана — товчийг дэмий үзүүлэхгүй. */
  useEffect(() => {
    if (!session?.user) { setCanUpload(false); return; }
    fetch("/api/reels/can-upload")
      .then((r) => (r.ok ? r.json() : { allowed: false }))
      .then((d) => setCanUpload(!!d.allowed))
      .catch(() => setCanUpload(false));
  }, [session]);

  /* Нэг reel-ээс нөгөө рүү. Товч, товчлуур, чирэлт ГУРВУУЛАА үүгээр
     явна — scrollTop-ыг өөрчилснөөр ҮНДСЭН scroll-snap өөрөө зогсох
     цэгийг шийднэ. Snap-ийг JS чирэлтээр СОЛИХГҮЙ: тэр нь инерц,
     хурд, зогсолтыг гараар дуурайх гэсэн оролдлого болж, утсан дээр
     төрөлхөөсөө муу ажилладаг. */
  const go = useCallback((dir: 1 | -1) => {
    const c = containerRef.current;
    if (!c) return;
    const next = Math.min(Math.max(active + dir, 0), Math.max(0, (reels?.length ?? 1) - 1));
    c.scrollTo({ top: next * c.clientHeight, behavior: "smooth" });
  }, [active, reels?.length]);

  /* ── ТОВЧЛУУР (ширээний компьютер) ──
     Сум, PageUp/Down, зай, мөн j/k (vim-ийн зуршилтай хүнд). */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (["ArrowDown", "PageDown", "j", " "].includes(e.key)) { e.preventDefault(); go(1); }
      else if (["ArrowUp", "PageUp", "k"].includes(e.key)) { e.preventDefault(); go(-1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  /* ── ЧИРЭЛТ (хулганаар дээш/доош татах) ──
     Хүрэлцэх төхөөрөмж дээр АСААХГҮЙ — тэнд төрөлх swipe аль хэдийн
     ажиллаж байгаа бөгөөд хоёуланг нь зэрэг асаавал зөрчилдөнө. */
  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    if (typeof matchMedia === "function" && matchMedia("(pointer:coarse)").matches) return;
    let down = false, startY = 0, startTop = 0, moved = false;
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const t = e.target as HTMLElement;
      if (t.closest("a,button,input,textarea,label")) return;
      down = true; moved = false; startY = e.clientY; startTop = c.scrollTop;
      c.style.scrollSnapType = "none";
    };
    const onMove = (e: PointerEvent) => {
      if (!down) return;
      const dy = e.clientY - startY;
      if (Math.abs(dy) > 4) moved = true;
      c.scrollTop = startTop - dy;
    };
    const onUp = (e: PointerEvent) => {
      if (!down) return;
      down = false;
      c.style.scrollSnapType = "";
      if (!moved) return;
      /* Чирсэн зай нь дэлгэцийн 12%-иас их бол дараагийн reel рүү;
         үгүй бол байрандаа буцна. Snap үүнийг гүйцээнэ. */
      const dy = e.clientY - startY;
      const h = c.clientHeight;
      if (Math.abs(dy) > h * 0.12) go(dy < 0 ? 1 : -1);
      else c.scrollTo({ top: active * h, behavior: "smooth" });
    };
    c.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      c.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [go, active]);

  /* Харагдаж буй бичлэгийг идэвхжүүлнэ. */
  useEffect(() => {
    const c = containerRef.current;
    if (!c || !reels?.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const i = Number((e.target as HTMLElement).dataset.index);
            if (Number.isFinite(i)) setActive(i);
          }
        }
      },
      { root: c, threshold: 0.6 }
    );
    c.querySelectorAll("[data-index]").forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [reels?.length]);

  /* Идэвхтэйг тоглуулж бусдыг зогсооно — хэд хэдэн бичлэг зэрэг
     тоглох нь дуу давхцах, батерей идэх хоёр асуудлыг нэг дор үүсгэнэ. */
  useEffect(() => {
    Object.entries(videoRefs.current).forEach(([k, v]) => {
      if (!v) return;
      if (Number(k) === active) { v.play().catch(() => {}); } else { v.pause(); v.currentTime = 0; }
    });
  }, [active, reels]);

  if (reels === null) {
    return (
      <div className="flex h-[100svh] items-center justify-center bg-black" role="status">
        <div className="h-2 w-2 animate-pulse rounded-full bg-[#2E29FF]" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black text-white">
      {/* ── Дээд мөр ── */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 bg-gradient-to-b from-black/80 to-transparent p-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push("/")}
            className="pointer-events-auto grid h-10 w-10 place-content-center rounded-[4px] bg-black/50 text-[18px]"
            aria-label="Буцах"
          >←</button>
          <span className="text-[10px] font-bold tracking-[0.18em]" style={{ color: "var(--accent-ink, #2E29FF)" }}>REELS</span>
          <div className="flex items-center gap-2">
            {canUpload && (
              <button
                onClick={() => setSheet(true)}
                className="pointer-events-auto grid h-10 w-10 place-content-center rounded-[4px] text-[20px] font-bold"
                style={{ background: "#2E29FF", color: "#FFFFFF" }}
                aria-label="Reel оруулах"
              >+</button>
            )}
            <span className="text-[10px] tabular-nums text-white/70">
              {reels.length ? `${Math.min(active + 1, reels.length)}/${reels.length}` : ""}
            </span>
          </div>
        </div>

        {/* ── Клиентийн шүүлтүүр ── */}
        {clients.length > 0 && (
          <div className="no-scrollbar pointer-events-auto mt-3 flex gap-2 overflow-x-auto">
            <Chip on={!filter} onClick={() => setFilter("")}>Бүгд</Chip>
            {clients.map((c) => (
              <Chip key={c} on={filter === c} onClick={() => setFilter(c)}>{c}</Chip>
            ))}
          </div>
        )}
      </div>

      {/* ── Тэжээл ── */}
      <div ref={containerRef} className="no-scrollbar h-full snap-y snap-mandatory overflow-y-scroll overscroll-contain">
        {reels.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
            <p className="text-[15px] text-white/80">
              {filter ? `«${filter}»-д видео алга.` : "Одоогоор reel алга."}
            </p>
            {canUpload && (
              <button onClick={() => setSheet(true)} className="rounded-[4px] px-5 py-3 text-[14px] font-bold"
                style={{ background: "#2E29FF", color: "#FFFFFF" }}>
                Эхний reel-ээ оруулах
              </button>
            )}
          </div>
        )}

        {reels.map((r, i) => (
          <section key={r.id} data-index={i} className="relative h-full w-full snap-start snap-always">
            <video
              ref={(el) => { videoRefs.current[i] = el; }}
              src={r.videoUrl}
              poster={r.thumbnail || undefined}
              className="absolute inset-0 h-full w-full object-contain"
              loop
              muted={muted}
              playsInline
              preload={i <= active + 1 ? "metadata" : "none"}
              onClick={() => setMuted((m) => !m)}
            />

            {/* Дууны төлөв — өнгө дангаараа биш, бичгээр ч хэлнэ. */}
            {muted && i === active && (
              <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[4px] bg-black/60 px-4 py-2 text-[12px] font-bold">
                🔇 Дуугүй · дарж асаана
              </div>
            )}

            {/* ── Доод мэдээлэл + татах ── */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent p-4 pb-[max(20px,env(safe-area-inset-bottom))]">
              <div className="flex items-end justify-between gap-4">
                <div className="min-w-0 flex-1">
                  {r.client && (
                    <p className="text-[11px] font-bold tracking-[0.14em]" style={{ color: "var(--accent-ink, #2E29FF)" }}>
                      {r.client.toUpperCase()}
                    </p>
                  )}
                  {r.title && <h2 className="mt-1 text-[17px] font-extrabold leading-[1.3]">{r.title}</h2>}
                  {r.caption && <p className="mt-1 line-clamp-2 text-[13px] leading-[1.5] text-white/80">{r.caption}</p>}
                  <p className="mt-2 text-[11px] text-white/55">
                    {r.durationSec ? `${Math.round(r.durationSec)}s · ` : ""}
                    {r.downloads} татсан
                    {r.uploaderName ? ` · ${r.uploaderName}` : ""}
                  </p>
                </div>

                {/* Жинхэнэ <a download> — JS-гүй ч ажиллана. */}
                <a
                  href={`/api/reels/${r.id}/download`}
                  download
                  className="pointer-events-auto grid shrink-0 place-content-center rounded-[4px] px-4 text-[13px] font-bold"
                  style={{ minHeight: 48, minWidth: 48, background: "#2E29FF", color: "#FFFFFF" }}
                >
                  ↓ Татах
                </a>
              </div>
            </div>
          </section>
        ))}
      </div>

      {/* ── Ширээний сум товч. Хүрэлцэх төхөөрөмжид нуугдана
             (`md:` + pointer:fine) — утсанд хурууны swipe нь байгаа. */}
      {reels.length > 1 && (
        <div className="pointer-events-none absolute right-4 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-2 md:flex">
          <button
            onClick={() => go(-1)}
            disabled={active === 0}
            aria-label="Өмнөх reel"
            className="pointer-events-auto grid h-11 w-11 place-content-center rounded-[4px] bg-white/12 text-[18px] backdrop-blur transition hover:bg-white/22 disabled:opacity-30"
          >↑</button>
          <button
            onClick={() => go(1)}
            disabled={active >= reels.length - 1}
            aria-label="Дараагийн reel"
            className="pointer-events-auto grid h-11 w-11 place-content-center rounded-[4px] bg-white/12 text-[18px] backdrop-blur transition hover:bg-white/22 disabled:opacity-30"
          >↓</button>
        </div>
      )}

      {sheet && <UploadSheet onClose={() => setSheet(false)} onDone={() => { setSheet(false); void load(filter); }} />}
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className="shrink-0 whitespace-nowrap rounded-[4px] px-3 py-1.5 text-[12px] font-bold"
      style={on ? { background: "#2E29FF", color: "#FFFFFF" } : { background: "rgba(255,255,255,0.14)", color: "#FFFFFF" }}
    >{children}</button>
  );
}

/* ── Оруулах хуудас ─────────────────────────────────────────────────── */
function UploadSheet({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [client, setClient] = useState("");
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    if (!file) { setErr("Видео сонгоно уу"); return; }
    setBusy(true); setErr("");
    try {
      const fd = new FormData();
      fd.append("video", file);
      fd.append("title", title);
      fd.append("client", client);
      fd.append("caption", caption);
      /* Үргэлжлэх хугацааг хөтөч дээр хэмжиж илгээнэ — сервер дээр
         ffmpeg байхгүй тул өөр аргаар мэдэх боломжгүй. */
      const d = await durationOf(file).catch(() => 0);
      fd.append("durationSec", String(d));
      const res = await fetch("/api/reels/upload", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) { setErr(j.error || "Оруулж чадсангүй"); return; }
      onDone();
    } catch { setErr("Сүлжээний алдаа"); }
    finally { setBusy(false); }
  }

  const input = "w-full rounded-[4px] border border-white/20 bg-white/10 px-3 py-3 text-[14px] text-white outline-none placeholder:text-white/45 focus:border-[#2E29FF]";

  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end bg-black/75" onClick={onClose}>
      <div
        className="max-h-[88svh] overflow-y-auto rounded-t-[4px] bg-[#111113] p-5 pb-[max(24px,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[17px] font-extrabold">Reel оруулах</h2>
          <button onClick={onClose} className="grid h-10 w-10 place-content-center rounded-[4px] bg-white/10 text-[18px]" aria-label="Хаах">✕</button>
        </div>

        <label className="mb-3 flex cursor-pointer flex-col items-center gap-2 rounded-[4px] border border-dashed border-white/25 p-6 text-center">
          <input type="file" accept="video/mp4,video/webm,video/quicktime" className="sr-only"
            onChange={(e) => { setFile(e.target.files?.[0] || null); setErr(""); }} />
          <span className="text-[26px]">🎬</span>
          <span className="text-[14px] font-bold">{file ? file.name : "Видео сонгох"}</span>
          <span className="text-[11px] text-white/50">MP4 · WebM · MOV · 120MB хүртэл</span>
        </label>

        <div className="space-y-3">
          <input className={input} value={client} onChange={(e) => setClient(e.target.value)} placeholder="Клиентийн нэр" maxLength={80} />
          <input className={input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Гарчиг" maxLength={120} />
          <textarea className={`${input} resize-y`} rows={2} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Тайлбар (заавал биш)" maxLength={500} />
        </div>

        {err && <p className="mt-3 text-[13px] font-semibold" style={{ color: "#FF8B8B" }}>{err}</p>}

        <button onClick={submit} disabled={busy || !file}
          className="mt-4 w-full rounded-[4px] text-[15px] font-bold disabled:opacity-45"
          style={{ minHeight: 52, background: "#2E29FF", color: "#FFFFFF" }}>
          {busy ? "Оруулж байна…" : "Нийтлэх"}
        </button>
      </div>
    </div>
  );
}

function durationOf(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => { URL.revokeObjectURL(v.src); resolve(v.duration || 0); };
    v.onerror = () => { URL.revokeObjectURL(v.src); reject(new Error("meta")); };
    v.src = URL.createObjectURL(file);
  });
}
