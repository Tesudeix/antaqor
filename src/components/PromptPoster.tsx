import { forwardRef } from "react";

/* ─── Брэндтэй carousel постер — v2 (2026-10-06) ──────────────────────────
   Промптын сангийн анхдагч зураг. HTML-ээр зурагдаж html2canvas-pro-оор
   2x буюу 1080×1350 (4:5) PNG болно; /api/prompts/poster-video нь түүнийг
   6с MP4 болгоно.

   Загвар — "анхаарал татах" нь зорилго (Higgsfield Supercomputer карт):
   хар суурь, teal туяа, ПЕРСПЕКТИВ ТОР (SVG), голлосон неон гарчиг,
   бүтэцтэй промптын мөрүүд (Lighting · Pose · Location …), цагаан CTA
   товч, хөлд брэнд + @хэрэглэгч.

   ДҮРЭМ:
   • Дугаар, шошго, хуудас ХООСОН бол огт зурагдахгүй (хоосон хайрцаг
     үлдэхгүй). Шошгын анхдагч нь хэрэглэгчийн өөрийн нэр.
   • Мөрүүд таслагдахгүй — ороож 3 мөр хүртэл; хэтэрвэл үсгийн хэмжээ
     багасна. ("…"-гээр тайрах нь промптын утгыг алддаг.)
   • ЗУРАГ ГОЛ ДҮР — дээд 340–430px (эзний хүсэлт); гарчиг зургийн доод
     хэсэгт давхцана; зураггүй бол teal туяа + тор чимэглэл (бичиггүй).
   • Бүх радиус 4px — сайтын дүрэм.
   • Зөвхөн inline style — сайтын cohesion анги постерыг өнгөөр
     өөрчлөхгүйн тулд. Гадны зураг ашиглахгүй. */

export interface PosterField { label: string; value: string }

export interface PromptPosterData {
  number: string;
  tag: string;
  title: string;
  fields: PosterField[];
  handle: string; // "@antaqor"
  page: string;
  cta: string;
  /** Дээд хэсгийн зураг (/uploads/...). Хоосон бол зай нь чимэглэлтэй үлдэнэ. */
  image?: string;
}

export const POSTER_W = 540;
export const POSTER_H = 675;

const NEON = "#2E29FF";
const TEAL = "#1F1AD9";
const INK = "#F2F2F4";
const MUTED = "#8A8F98";
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";
const SANS = "Manrope, system-ui, sans-serif";

/** Перспектив тор — дунд цэгээс сацарсан шугамууд + доошлох тусам
    сийрэгжих хэвтээ шугамууд. */
function Grid() {
  const vx = POSTER_W / 2;
  const vy = POSTER_H * 0.42;
  const rays: string[] = [];
  for (let i = -6; i <= 6; i++) {
    const x = vx + i * 120;
    rays.push(`M${vx},${vy} L${x},${POSTER_H}`, `M${vx},${vy} L${x},0`);
  }
  const rows: number[] = [];
  for (let k = 1; k <= 7; k++) {
    const t = Math.pow(k / 7, 1.8);
    rows.push(vy + t * (POSTER_H - vy), vy - t * vy);
  }
  return (
    <svg width={POSTER_W} height={POSTER_H} style={{ position: "absolute", inset: 0 }} aria-hidden>
      <path d={rays.join(" ")} stroke="rgba(46,41,255,0.10)" strokeWidth={1} fill="none" />
      {rows.map((y, i) => (
        <line key={i} x1={0} x2={POSTER_W} y1={y} y2={y} stroke="rgba(46,41,255,0.08)" strokeWidth={1} />
      ))}
    </svg>
  );
}

const R = 4;

const PromptPoster = forwardRef<HTMLDivElement, { d: PromptPosterData }>(function PromptPoster({ d }, ref) {
  const fields = d.fields.filter((f) => f.value.trim()).slice(0, 5);
  const n = fields.length;
  /* ЗУРАГ ГОЛ ДҮР (эзний хүсэлт: "зураг нь их зай эзэлнэ") — постерын
     50–64%. Мөр нэмэгдэх тусам бага зэрэг хумигдана, гэхдээ хэзээ ч 340px-ээс
     доошгүй. Гарчиг нь зургийн ДООД ХЭСЭГТ давхцаж суудаг тул тусдаа зай
     эзлэхгүй; CTA нь хөлд жижиг товч болно. */
  const IMG_H = n <= 2 ? 430 : n === 3 ? 400 : n === 4 ? 370 : 340;
  const total = fields.reduce((k, f) => k + f.value.length, 0);
  const valueSize = n >= 5 || total > 260 ? 12.5 : total > 160 ? 13.5 : 15;
  const title = d.title.trim() || "Viral prompt";
  const titleSize = title.length > 24 ? 28 : title.length > 14 ? 36 : 44;

  return (
    <div
      ref={ref}
      style={{
        width: POSTER_W, height: POSTER_H, flexShrink: 0, position: "relative", overflow: "hidden", boxSizing: "border-box",
        background: "#040506", color: INK, fontFamily: SANS, display: "flex", flexDirection: "column",
      }}
    >
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(90% 34% at 50% 100%, rgba(46,41,255,0.42), transparent 70%)" }} />
      <Grid />

      {/* ─── ЗУРАГ — гол дүр ─── background-image: html2canvas-д найдвартай */}
      <div style={{ position: "relative", height: IMG_H, flexShrink: 0, overflow: "hidden" }}>
        {d.image ? (
          <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${d.image})`, backgroundSize: "cover", backgroundPosition: "center" }} />
        ) : (
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(70% 80% at 50% 30%, rgba(46,41,255,0.55), rgba(4,5,6,0) 75%)" }} />
        )}
        {/* Доод шилжилт — гарчиг зураг дээр уншигдана */}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 150, background: "linear-gradient(180deg, rgba(4,5,6,0) 0%, rgba(4,5,6,0.75) 55%, #040506 100%)" }} />
        {(d.number.trim() || d.tag.trim()) && (
          <div style={{ position: "absolute", left: 22, right: 22, top: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: MONO, fontSize: 18, fontWeight: 700, color: NEON, textShadow: "0 1px 6px rgba(0,0,0,0.8)" }}>{d.number.trim()}</span>
            {d.tag.trim() && (
              <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.2em", color: INK, border: `1px solid ${NEON}`, borderRadius: R, padding: "6px 10px", background: "rgba(4,5,6,0.7)" }}>
                {d.tag.trim().toUpperCase()}
              </span>
            )}
          </div>
        )}
        <div style={{ position: "absolute", left: 22, right: 22, bottom: 12, textAlign: "center" }}>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.34em", color: "#FCEE0A" }}>VIRAL PROMPT</div>
          <div style={{ marginTop: 5, fontSize: titleSize, fontWeight: 800, lineHeight: 1.0, letterSpacing: "-0.03em", color: NEON, textShadow: "0 0 22px rgba(46,41,255,0.6), 0 2px 10px rgba(0,0,0,0.8)" }}>
            {title}
          </div>
        </div>
      </div>

      <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: n >= 5 ? 4 : 6, padding: "8px 22px", minHeight: 0 }}>
        {fields.map((f, i) => (
          <div
            key={i}
            style={{
              display: "flex", alignItems: "baseline", gap: 10, padding: "6px 10px", borderRadius: R,
              background: "linear-gradient(90deg, rgba(46,41,255,0.24), rgba(46,41,255,0.05))",
              borderLeft: `2px solid ${NEON}`,
            }}
          >
            <span style={{ width: 66, flexShrink: 0, fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: "0.16em", color: NEON }}>
              {f.label.toUpperCase()}
            </span>
            <span style={{ fontSize: valueSize, fontWeight: 700, lineHeight: 1.25, color: INK }}>{f.value.trim()}</span>
          </div>
        ))}
      </div>

      <div
        style={{
          position: "relative", flexShrink: 0, height: 38, padding: "0 22px", borderTop: "1px solid rgba(46,41,255,0.35)",
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
          fontFamily: MONO, fontSize: 10, letterSpacing: "0.2em", color: MUTED, background: "rgba(4,5,6,0.6)",
        }}
      >
        <span style={{ whiteSpace: "nowrap" }}>
          <span style={{ color: NEON, fontWeight: 700 }}>ANTAQOR</span>
          {d.handle.trim() && <span style={{ letterSpacing: "0.06em" }}>{`  ·  ${d.handle.trim()}`}</span>}
        </span>
        {d.cta.trim() && (
          <span style={{ fontFamily: SANS, letterSpacing: 0, background: "#FFFFFF", color: "#0A0A0A", fontSize: 11.5, fontWeight: 800, borderRadius: R, padding: "5px 10px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 230 }}>
            {d.cta.trim()}
          </span>
        )}
        {d.page.trim() && <span style={{ whiteSpace: "nowrap" }}>{d.page.trim()}</span>}
      </div>
    </div>
  );
});

export default PromptPoster;
