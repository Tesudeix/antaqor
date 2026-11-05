import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { authOptions } from "@/lib/auth";
import { analyze, quote } from "@/lib/gold/service";
import { readChart, overlayOf } from "@/lib/traderScan";

/* ─── Tesla Trader · XAU/USD API (2026-11-05) ───
   GET ?q=price → bid/ask/spread (Swissquote, 4 с кэш) — дээд мөрийн тикер
   GET          → «Шинжлэх»: бодит алтны дата → модель → шийдвэр (lib/gold/service.ts)
   POST image   → зургийг AI-аар уншиж (хугацаа, зурсан түвшин, үнийн тэнхлэг) + ЯГ ТЭР бодит шинжилгээ,
                  түвшинг зураг дээр давхарлана. Шийдвэрийг ЗУРАГ биш, бодит дата гаргана. */
export const dynamic = "force-dynamic";
export const maxDuration = 120;
const busy = new Set<string>();

async function me() {
  const s = await getServerSession(authOptions);
  return (s?.user as { id?: string } | undefined)?.id || null;
}
const fail = (e: unknown, status = 502) => NextResponse.json({ error: (e as Error).message || "Алдаа" }, { status });

export async function GET(req: NextRequest) {
  if (!(await me())) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  try {
    if (req.nextUrl.searchParams.get("q") === "price") return NextResponse.json(await quote(), { headers: { "Cache-Control": "no-store" } });
    return NextResponse.json(await analyze(), { headers: { "Cache-Control": "no-store" } });
  } catch (e) { console.error("[gold]", (e as Error).message); return fail(e); }
}

export async function POST(req: NextRequest) {
  const u = await me();
  if (!u) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  if (busy.has(u)) return NextResponse.json({ error: "Өмнөх скан дуусаагүй байна" }, { status: 429 });
  const form = await req.formData().catch(() => null), file = form?.get("image");
  if (!(file instanceof File) || !file.size) return NextResponse.json({ error: "Графикийн зургаа оруулна уу" }, { status: 400 });
  if (file.size > 12 * 1024 * 1024) return NextResponse.json({ error: "Зураг 12MB-аас бага байх ёстой" }, { status: 413 });
  let jpg: Buffer;
  try { jpg = await sharp(Buffer.from(await file.arrayBuffer())).rotate().resize({ width: 1800, height: 1800, fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 88 }).toBuffer(); }
  catch { return NextResponse.json({ error: "Зураг уншиж чадсангүй (jpg, png, webp)" }, { status: 400 }); }
  busy.add(u);
  try {
    const name = `trader-${randomUUID()}.jpg`, dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), jpg);
    const [read, a] = await Promise.all([readChart(`data:image/jpeg;base64,${jpg.toString("base64")}`, { symbol: "XAUUSD" }), analyze()]);
    const warnings: string[] = [];
    const sym = read.symbol.toUpperCase();
    if (sym && !/XAU|GOLD|GC/.test(sym)) warnings.push(`Зураг дээр «${read.symbol}» харагдаж байна — Tesla Trader зөвхөн алт (XAU/USD) шинжилнэ. Доорх дүн бодит алтны ханшаар гарсан.`);
    const mid = (a.price.bid + a.price.ask) / 2;
    if (read.lastPrice && Math.abs(read.lastPrice - mid) > Math.max(3 * a.atr5, 8)) warnings.push(`Зураг дээрх үнэ ${read.lastPrice} одоогийн ${mid.toFixed(2)}-оос их зөрж байна — хуучин зураг эсвэл өөр брокерын ханш. Шийдвэр бодит ханшаар гарсан.`);
    if (!read.readable || read.quality < 0.4) warnings.push("Зураг бүдэг эсвэл үнийн тэнхлэг тод биш — давхарласан шугам буруу байж болно.");
    return NextResponse.json({
      ...a, image: `/uploads/${name}`, overlay: overlayOf(read), warnings,
      read: { symbol: read.symbol, timeframe: read.timeframe, lastPrice: read.lastPrice, structure: read.structure, patterns: read.patterns, notes: read.notes, levels: read.levels, quality: read.quality },
    });
  } catch (e) { console.error("[gold image]", (e as Error).message); return fail(e, 500); }
  finally { busy.delete(u); }
}
