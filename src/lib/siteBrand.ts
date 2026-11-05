import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import dbConnect from "@/lib/mongodb";
import SiteSettings from "@/models/SiteSettings";

/* ─── Сайтын брэнд · SEO (2026-10-26) — /admin/brand-аас засна ──────────────
   Гарчиг, тайлбар, түлхүүр үг, хуваалцах cover (OG), favicon ба утсанд
   суулгах апп-ын icon. SiteSettings key `site_brand` (JSON).

   Icon/cover нь ТОГТМОЛ URL-аар (/brand/*, /favicon.ico, /icon,
   /manifest.json) динамикаар үйлчилнэ — админ солимогц build хийхгүйгээр
   шууд солигдоно. Тохиргоо хоосон бол public/ дахь хуучин файлууд (анхдагч)
   хэвээр очно — өөрөөр хэлбэл юу ч эвдэрэхгүй. */

export const BRAND_KEY = "site_brand";

export type Brand = {
  title: string;
  template: string;
  description: string;
  keywords: string[];
  ogAlt: string;
  appName: string;
  shortName: string;
  /** Icon-ы арын өнгө (apple, maskable) */
  iconBg: string;
  /** "" = анхдагч icon; бусад үед /uploads/brand/icon-<v>-*.png */
  iconV: string;
  /** "" = анхдагч cover; бусад үед /uploads/brand/og-<v>.jpg */
  ogV: string;
};

export const BRAND_DEFAULT: Brand = {
  title: "Antaqor — AI Entrepreneur хүрээлэл",
  template: "%s | Antaqor",
  description:
    "Antaqor бол Монголын AI entrepreneur-уудын хүрээлэл. AI-гаар чадвараа үржүүлж, орлого, бүтээл, систем, distribution-ээ өөрөө эзэмшдэг one-person entrepreneur болох сургалт, промптын сан, хаалттай community.",
  keywords: ["Antaqor", "Antaqor хүрээлэл", "AI entrepreneur", "one-person business", "хиймэл оюун", "AI сургалт", "промпт", "prompt engineering", "AI агент", "Монгол бүтээгчид", "AI бизнес", "Монгол AI community"],
  ogAlt: "Antaqor — AI Entrepreneur хүрээлэл",
  appName: "Antaqor — AI Entrepreneur хүрээлэл",
  shortName: "Antaqor",
  iconBg: "#FFFFFF",
  iconV: "",
  ogV: "",
};

const HEX = /^#[0-9a-f]{6}$/i;
const clip = (v: unknown, n: number, d: string) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : d);

export function normalizeBrand(raw: unknown): Brand {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Brand>;
  const kw = Array.isArray(r.keywords) ? r.keywords.map((k) => String(k).trim().slice(0, 60)).filter(Boolean).slice(0, 30) : BRAND_DEFAULT.keywords;
  return {
    title: clip(r.title, 90, BRAND_DEFAULT.title),
    template: clip(r.template, 60, BRAND_DEFAULT.template).includes("%s") ? clip(r.template, 60, BRAND_DEFAULT.template) : BRAND_DEFAULT.template,
    description: clip(r.description, 320, BRAND_DEFAULT.description),
    keywords: kw.length ? kw : BRAND_DEFAULT.keywords,
    ogAlt: clip(r.ogAlt, 140, BRAND_DEFAULT.ogAlt),
    appName: clip(r.appName, 60, BRAND_DEFAULT.appName),
    shortName: clip(r.shortName, 20, BRAND_DEFAULT.shortName),
    iconBg: typeof r.iconBg === "string" && HEX.test(r.iconBg) ? r.iconBg : BRAND_DEFAULT.iconBg,
    iconV: typeof r.iconV === "string" && /^[a-z0-9]{0,16}$/.test(r.iconV) ? r.iconV : "",
    ogV: typeof r.ogV === "string" && /^[a-z0-9]{0,16}$/.test(r.ogV) ? r.ogV : "",
  };
}

let cache: { at: number; v: Brand } | null = null;

export async function getBrand(): Promise<Brand> {
  if (cache && Date.now() - cache.at < 30_000) return cache.v;
  try {
    await dbConnect();
    const row = await SiteSettings.findOne({ key: BRAND_KEY }).lean<{ value?: string }>();
    const v = row?.value ? normalizeBrand(JSON.parse(row.value)) : BRAND_DEFAULT;
    cache = { at: Date.now(), v };
    return v;
  } catch {
    return cache?.v || BRAND_DEFAULT;
  }
}

export async function saveBrand(next: Brand): Promise<Brand> {
  const v = normalizeBrand(next);
  await dbConnect();
  await SiteSettings.findOneAndUpdate({ key: BRAND_KEY }, { $set: { value: JSON.stringify(v) } }, { upsert: true });
  cache = { at: Date.now(), v };
  return v;
}

/* ── Файлууд ── */
const PUB = () => path.join(process.cwd(), "public");
const BRAND_DIR = () => path.join(PUB(), "uploads", "brand");

/** /brand/<name> → (custom файл, анхдагч public файл) */
export const BRAND_FILES: Record<string, { custom: (b: Brand) => string | null; fallback: string; type: string }> = {
  "icon-16.png": { custom: (b) => (b.iconV ? `icon-${b.iconV}-16.png` : null), fallback: "favicon-16x16.png", type: "image/png" },
  "icon-32.png": { custom: (b) => (b.iconV ? `icon-${b.iconV}-32.png` : null), fallback: "favicon-32x32.png", type: "image/png" },
  "icon-192.png": { custom: (b) => (b.iconV ? `icon-${b.iconV}-192.png` : null), fallback: "icon-192.png", type: "image/png" },
  "icon-512.png": { custom: (b) => (b.iconV ? `icon-${b.iconV}-512.png` : null), fallback: "icon-512.png", type: "image/png" },
  "maskable-192.png": { custom: (b) => (b.iconV ? `icon-${b.iconV}-m192.png` : null), fallback: "icon-192-maskable.png", type: "image/png" },
  "maskable-512.png": { custom: (b) => (b.iconV ? `icon-${b.iconV}-m512.png` : null), fallback: "icon-512-maskable.png", type: "image/png" },
  "apple-touch-icon.png": { custom: (b) => (b.iconV ? `icon-${b.iconV}-180.png` : null), fallback: "apple-touch-icon.png", type: "image/png" },
  cover: { custom: (b) => (b.ogV ? `og-${b.ogV}.jpg` : null), fallback: "og.png", type: "image/png" },
};

/** Брэнд файлыг уншина — custom байхгүй/уншигдахгүй бол анхдагч. */
export async function readBrandFile(name: string): Promise<{ body: Buffer; type: string } | null> {
  const f = BRAND_FILES[name];
  if (!f) return null;
  const b = await getBrand();
  const custom = f.custom(b);
  if (custom) {
    try {
      return { body: await readFile(path.join(BRAND_DIR(), custom)), type: custom.endsWith(".jpg") ? "image/jpeg" : "image/png" };
    } catch { /* устсан бол анхдагч руу */ }
  }
  try {
    return { body: await readFile(path.join(PUB(), f.fallback)), type: f.type };
  } catch {
    return null;
  }
}

const newV = () => Date.now().toString(36);

/** Дөрвөлжин icon-оос бүх хэмжээг үүсгэнэ (эх нь icon-<v>-src.png болж хадгалагдана). */
async function renderIcons(v: string, src: Buffer, bg: string) {
  await mkdir(BRAND_DIR(), { recursive: true });
  const out = (n: string) => path.join(BRAND_DIR(), `icon-${v}-${n}.png`);
  for (const n of [16, 32, 192, 512]) await writeFile(out(String(n)), await sharp(src).resize(n, n).png().toBuffer());
  /* iOS тунгалаг хэсгийг хар болгодог — арын өнгөөр дүүргэнэ */
  await writeFile(out("180"), await sharp(src).resize(180, 180).flatten({ background: bg }).png().toBuffer());
  /* Android maskable: аюулгүй бүс ~80% — icon-ыг багасгаж өнгөт дэвсгэр дээр голлуулна */
  for (const n of [192, 512]) {
    const inner = await sharp(src).resize(Math.round(n * 0.78), Math.round(n * 0.78)).png().toBuffer();
    await writeFile(out(`m${n}`), await sharp({ create: { width: n, height: n, channels: 4, background: bg } }).composite([{ input: inner, gravity: "centre" }]).png().toBuffer());
  }
}

export async function uploadIcon(buf: Buffer): Promise<Brand> {
  const meta = await sharp(buf).metadata();
  if (!meta.width || !meta.height) throw new Error("Зураг уншигдсангүй");
  if (Math.min(meta.width, meta.height) < 192) throw new Error("Icon дор хаяж 512×512 байвал сайн (хамгийн багадаа 192px)");
  const src = await sharp(buf).rotate().resize(1024, 1024, { fit: "cover", position: "centre" }).png().toBuffer();
  const b = await getBrand();
  const v = newV();
  await renderIcons(v, src, b.iconBg);
  await writeFile(path.join(BRAND_DIR(), `icon-${v}-src.png`), src);
  return saveBrand({ ...b, iconV: v });
}

/** Арын өнгө солигдоход apple/maskable-ийг эх зургаас дахин үүсгэнэ. */
export async function recolorIcons(b: Brand): Promise<Brand> {
  if (!b.iconV) return b;
  const src = await readFile(path.join(BRAND_DIR(), `icon-${b.iconV}-src.png`)).catch(() => null);
  if (!src) return b;
  const v = newV();
  await renderIcons(v, src, b.iconBg);
  await writeFile(path.join(BRAND_DIR(), `icon-${v}-src.png`), src);
  return { ...b, iconV: v };
}

export async function uploadCover(buf: Buffer): Promise<Brand> {
  const meta = await sharp(buf).metadata();
  if (!meta.width || !meta.height) throw new Error("Зураг уншигдсангүй");
  await mkdir(BRAND_DIR(), { recursive: true });
  const v = newV();
  const jpg = await sharp(buf).rotate().resize(1200, 630, { fit: "cover", position: "attention" }).flatten({ background: "#FFFFFF" }).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
  await writeFile(path.join(BRAND_DIR(), `og-${v}.jpg`), jpg);
  return saveBrand({ ...(await getBrand()), ogV: v });
}

/** Хуудсанд оруулах URL — хувилбараар кэшийг эвддэг. */
export const brandUrl = (b: Brand, name: string) => `/brand/${name}?v=${(name === "cover" ? b.ogV : b.iconV) || "1"}`;
