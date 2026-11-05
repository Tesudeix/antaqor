import { ImageResponse } from "next/og";
import { readFile, mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import sharp from "sharp";

/* ─── Educational infographic зурагч (2026-10-23) ─────────────────────────
   AI зураг үүсгэгч кирилл бичгийг эвддэг тул infographic-ийг HTML/flex-ээр
   (satori, next/og) зурж PNG болгоно — бичиг үргэлж тод, засвар хийхэд
   шууд дахин зурагдана. 1080×1350 (4:5) — Instagram feed, FB, Threads.
   Фонт: Manrope (кирилл + Ө/Ү), ₮ зэрэг дутуу тэмдэгт DejaVu-аар нөхөгдөнө. */

export type IgTemplate = "steps" | "list" | "compare" | "stat";
export type IgTheme = "light" | "dark" | "brand";
export type IgSpec = {
  template: IgTemplate; title: string; subtitle?: string;
  items: { title: string; text?: string; label?: string }[];
  cta?: string; left?: string; right?: string; handle?: string;
};

const W = 1080, H = 1350;
const THEMES: Record<IgTheme, { bg: string; card: string; ink: string; sub: string; line: string; accent: string; accentInk: string; chip: string }> = {
  light: { bg: "linear-gradient(160deg, #F8F9FD 0%, #EEF0FF 100%)", card: "#FFFFFF", ink: "#14151C", sub: "#565967", line: "rgba(20,21,40,0.10)", accent: "#2E29FF", accentInk: "#FFFFFF", chip: "#EEF0FF" },
  dark: { bg: "linear-gradient(160deg, #0D0E1A 0%, #15124A 100%)", card: "rgba(255,255,255,0.06)", ink: "#FFFFFF", sub: "rgba(255,255,255,0.72)", line: "rgba(255,255,255,0.12)", accent: "#6E6BFF", accentInk: "#FFFFFF", chip: "rgba(110,107,255,0.18)" },
  brand: { bg: "linear-gradient(150deg, #2E29FF 0%, #5B3BFF 55%, #2563FF 100%)", card: "rgba(255,255,255,0.12)", ink: "#FFFFFF", sub: "rgba(255,255,255,0.82)", line: "rgba(255,255,255,0.22)", accent: "#FFFFFF", accentInk: "#2E29FF", chip: "rgba(255,255,255,0.16)" },
};

let fonts: { name: string; data: Buffer; weight: 500 | 800; style: "normal" }[] | null = null;
async function loadFonts() {
  if (fonts) return fonts;
  const dir = path.join(process.cwd(), "assets", "fonts");
  const [m5, m8] = await Promise.all([readFile(path.join(dir, "Manrope-500.woff")), readFile(path.join(dir, "Manrope-800.woff"))]);
  const [d5, d8] = await Promise.all([
    readFile("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf").catch(() => null),
    readFile("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf").catch(() => null),
  ]);
  fonts = [
    { name: "Manrope", data: m5, weight: 500, style: "normal" }, { name: "Manrope", data: m8, weight: 800, style: "normal" },
    ...(d5 ? [{ name: "DejaVu", data: d5, weight: 500 as const, style: "normal" as const }] : []),
    ...(d8 ? [{ name: "DejaVu", data: d8, weight: 800 as const, style: "normal" as const }] : []),
  ];
  return fonts;
}
/* emoji-д фонт алга — infographic дээр хасна */
const clean = (s = "") => s.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "").replace(/\s+/g, " ").trim();

type Item = { title: string; text: string; label: string };
type Th = (typeof THEMES)[IgTheme];

/* Мөрийн тоог ойролцоогоор тооцно (Manrope кирилл: ~0.56em, bold ~0.58em) — satori
   overflow мэдээлдэггүй тул body-г урьдчилан тааруулж багтаана. */
function lines(txt: string, size: number, width: number, bold = false, ls = 0): number {
  if (!txt) return 0;
  const cw = size * (bold ? 0.58 : 0.56) + ls; // нэг тэмдэгтийн дундаж өргөн
  let n = 1, cur = 0;
  for (const w of txt.split(" ")) {
    const ww = w.length * cw, sp = cur ? cw * 0.55 : 0;
    if (cur && cur + sp + ww > width) { n++; cur = ww; } else cur += sp + ww;
  }
  return n;
}
const CW = 940; // 1080 − 2×70

function itemsOf(s: IgSpec): Item[] {
  return s.items.slice(0, s.template === "compare" ? 5 : 6).map((x) => {
    const title = clean(x.title), text = clean(x.text), label = clean(x.label);
    /* compare: загвар заримдаа «Шошго» + «A vs B» гэж өгдөг → хоёр нүд болгон задална */
    if (s.template === "compare") {
      const m = text.match(/^(.+?)\s+(?:vs\.?|VS|→|->)\s+(.+)$/);
      if (m) return { label: label || title, title: m[1].trim(), text: m[2].trim() };
    }
    return { label: s.template === "compare" ? label : "", title, text };
  });
}

/* Body-гийн өндрийг k масштабаар тооцно (фонт, padding ×k; өргөн тогтмол). Normal line-height ≈ 1.37 (Manrope). */
function natural(tpl: IgTemplate, items: Item[], k: number): number {
  const n = items.length, z = (v: number) => v * k;
  if (tpl === "compare") {
    const w = (CW - 16) / 2 - z(52) - 4;
    return z(36) + z(34) * 1.37 + items.reduce((h, x) => h + z(16) + (x.label ? z(22) * 1.37 + z(8) : 0) + z(44) + 4 + Math.max(lines(x.title, z(30), w), lines(x.text, z(30), w, true)) * z(30) * 1.3, 0);
  }
  if (tpl === "stat") {
    const w = (n <= 2 ? CW : CW * 0.475) - z(68) - 4;
    const cell = (x: Item) => z(68) + 4 + z(86) + (x.text ? z(14) + lines(x.text, z(30), w) * z(30) * 1.3 : 0);
    if (n <= 2) return items.reduce((h, x) => h + cell(x), 0) + z(20) * (n - 1);
    let h = 0; for (let i = 0; i < n; i += 2) h += Math.max(cell(items[i]), items[i + 1] ? cell(items[i + 1]) : 0) + (i ? z(20) : 0);
    return h;
  }
  if (tpl === "list") {
    const w = CW * 0.485 - z(56) - 4;
    const cell = (x: Item) => z(56) + 4 + z(54) + z(12) + lines(x.title, z(34), w, true) * z(34) * 1.15 + (x.text ? z(12) + lines(x.text, z(25), w) * z(25) * 1.35 : 0);
    let h = 0; for (let i = 0; i < n; i += 2) h += Math.max(cell(items[i]), items[i + 1] ? cell(items[i + 1]) : 0) + (i ? z(18) : 0);
    return h;
  }
  const w = CW - z(60) - 4 - z(74) - z(26);
  return items.reduce((h, x) => h + z(52) + 4 + Math.max(z(74), lines(x.title, z(36), w, true) * z(36) * 1.15 + (x.text ? z(6) + lines(x.text, z(26), w) * z(26) * 1.35 : 0)), 0) + z(20) * (n - 1);
}

function Body({ s, t, items, k }: { s: IgSpec; t: Th; items: Item[]; k: number }) {
  const z = (v: number) => Math.round(v * k);
  const n = items.length;
  if (s.template === "compare") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: z(16), flex: 1 }}>
        <div style={{ display: "flex", gap: 16 }}>
          {[clean(s.left) || "Өмнө", clean(s.right) || "Одоо"].map((h, i) => (
            <div key={i} style={{ flex: 1, display: "flex", justifyContent: "center", padding: `${z(18)}px 0`, borderRadius: 18, background: i ? t.accent : t.chip, color: i ? t.accentInk : t.ink, fontSize: z(34), fontWeight: 800 }}>{h}</div>
          ))}
        </div>
        {items.map((x, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: z(8) }}>
            {x.label ? <div style={{ display: "flex", fontSize: z(22), fontWeight: 800, letterSpacing: 2, color: t.sub, textTransform: "uppercase" }}>{x.label}</div> : null}
            <div style={{ display: "flex", gap: 16 }}>
              <div style={{ flex: 1, display: "flex", padding: `${z(22)}px ${z(26)}px`, borderRadius: 18, background: t.card, border: `2px solid ${t.line}`, color: t.sub, fontSize: z(30), fontWeight: 500, lineHeight: 1.3 }}>{x.title}</div>
              <div style={{ flex: 1, display: "flex", padding: `${z(22)}px ${z(26)}px`, borderRadius: 18, background: t.card, border: `2px solid ${t.accent}`, color: t.ink, fontSize: z(30), fontWeight: 800, lineHeight: 1.3 }}>{x.text || ""}</div>
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (s.template === "stat") {
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: z(20), flex: 1, alignContent: "flex-start" }}>
        {items.map((x, i) => (
          <div key={i} style={{ width: n <= 2 ? "100%" : "47.5%", display: "flex", flexDirection: "column", padding: `${z(34)}px ${z(34)}px`, borderRadius: 24, background: t.card, border: `2px solid ${t.line}` }}>
            <div style={{ display: "flex", fontSize: z(86), fontWeight: 800, color: t.accent === "#FFFFFF" ? t.ink : t.accent, letterSpacing: -2, lineHeight: 1 }}>{x.title}</div>
            <div style={{ display: "flex", marginTop: z(14), fontSize: z(30), fontWeight: 500, color: t.sub, lineHeight: 1.3 }}>{x.text || ""}</div>
          </div>
        ))}
      </div>
    );
  }
  if (s.template === "list") {
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: z(18), flex: 1, alignContent: "flex-start" }}>
        {items.map((x, i) => (
          <div key={i} style={{ width: "48.5%", display: "flex", flexDirection: "column", gap: z(12), padding: `${z(28)}px ${z(28)}px`, borderRadius: 22, background: t.card, border: `2px solid ${t.line}` }}>
            <div style={{ display: "flex", width: z(54), height: z(54), borderRadius: 14, alignItems: "center", justifyContent: "center", background: t.accent, color: t.accentInk, fontSize: z(28), fontWeight: 800 }}>{String(i + 1).padStart(2, "0")}</div>
            <div style={{ display: "flex", fontSize: z(34), fontWeight: 800, color: t.ink, lineHeight: 1.15 }}>{x.title}</div>
            {x.text ? <div style={{ display: "flex", fontSize: z(25), fontWeight: 500, color: t.sub, lineHeight: 1.35 }}>{x.text}</div> : null}
          </div>
        ))}
      </div>
    );
  }
  /* steps */
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: z(20), flex: 1 }}>
      {items.map((x, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: z(26), padding: `${z(26)}px ${z(30)}px`, borderRadius: 22, background: t.card, border: `2px solid ${t.line}` }}>
          <div style={{ display: "flex", flexShrink: 0, width: z(74), height: z(74), borderRadius: 999, alignItems: "center", justifyContent: "center", background: t.accent, color: t.accentInk, fontSize: z(36), fontWeight: 800 }}>{i + 1}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: z(6), flex: 1 }}>
            <div style={{ display: "flex", fontSize: z(36), fontWeight: 800, color: t.ink, lineHeight: 1.15 }}>{x.title}</div>
            {x.text ? <div style={{ display: "flex", fontSize: z(26), fontWeight: 500, color: t.sub, lineHeight: 1.35 }}>{x.text}</div> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export async function renderInfographic(spec: IgSpec, theme: IgTheme = "light"): Promise<{ url: string; bytes: number }> {
  const t = THEMES[theme] || THEMES.light;
  const s = { ...spec, title: clean(spec.title).slice(0, 70), subtitle: clean(spec.subtitle).slice(0, 140), cta: clean(spec.cta).slice(0, 110) };
  const ts = s.title.length <= 20 ? 82 : s.title.length <= 32 ? 70 : 60;
  /* Багтаах: толгой + хөлийн өндрийг хасаад body-д үлдэх зай → k (0.6–1) */
  const head = 76 + 80 + lines(s.title, ts, CW, true, -2) * ts * 1.04 + (s.subtitle ? 20 + lines(s.subtitle, 32, CW) * 43.2 : 0) + 74;
  const foot = 30 + 28 + lines(s.cta || "x", 27, CW - 200, true) * 35.1 + 60;
  const items = itemsOf(s);
  const room = H - head - foot - 18;
  let k = 1; while (k > 0.6 && natural(s.template, items, k) > room) k = +(k - 0.02).toFixed(2);
  const res = new ImageResponse(
    (
      <div style={{ width: W, height: H, display: "flex", flexDirection: "column", padding: "76px 70px 60px", background: t.bg, fontFamily: "Manrope, DejaVu" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 34 }}>
          <div style={{ display: "flex", width: 46, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center", background: t.accent, color: t.accentInk, fontSize: 24, fontWeight: 800 }}>A</div>
          <div style={{ display: "flex", fontSize: 24, fontWeight: 800, letterSpacing: 6, color: t.ink }}>ANTAQOR</div>
          <div style={{ display: "flex", marginLeft: "auto", padding: "8px 18px", borderRadius: 999, background: t.chip, color: t.ink, fontSize: 22, fontWeight: 800 }}>AI CREATOR</div>
        </div>
        <div style={{ display: "flex", fontSize: ts, fontWeight: 800, color: t.ink, lineHeight: 1.04, letterSpacing: -2 }}>{s.title}</div>
        {s.subtitle ? <div style={{ display: "flex", marginTop: 20, fontSize: 32, fontWeight: 500, color: t.sub, lineHeight: 1.35 }}>{s.subtitle}</div> : null}
        <div style={{ display: "flex", height: 6, width: 120, borderRadius: 6, background: t.accent, margin: "34px 0 34px" }} />
        <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}><Body s={s} t={t} items={items} k={k} /></div>
        <div style={{ display: "flex", alignItems: "center", marginTop: 30, paddingTop: 26, borderTop: `2px solid ${t.line}` }}>
          <div style={{ display: "flex", flex: 1, fontSize: 27, fontWeight: 800, color: t.ink, lineHeight: 1.3 }}>{s.cta || "Илүүг antaqor.com дээр"}</div>
          <div style={{ display: "flex", fontSize: 24, fontWeight: 800, color: t.sub }}>{clean(spec.handle) || "@antaqor"}</div>
        </div>
      </div>
    ),
    { width: W, height: H, fonts: await loadFonts() }
  );
  const png = Buffer.from(await res.arrayBuffer());
  const jpg = await sharp(png).jpeg({ quality: 90, chromaSubsampling: "4:4:4" }).toBuffer();
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  const name = `agent-ig-${randomUUID()}.jpg`;
  await writeFile(path.join(dir, name), jpg);
  return { url: `/uploads/${name}`, bytes: jpg.length };
}
