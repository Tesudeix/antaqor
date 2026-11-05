import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { randomUUID } from "crypto";
import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import { TraderScan } from "@/models/TraderScan";
import { spendCredits, refundCredits } from "@/lib/credits";
import { getSetting } from "@/lib/siteSettings";
import { scanChart, evaluate, type Levels } from "@/lib/traderScan";
import { recall, learnFromScan, maybeReseed, sampleStats, memoryCount, addMemory } from "@/lib/traderLearn";

/* ─── Tesla Trader API (2026-10-25) ───
   POST  multipart {image, symbol?, tf?} → кредит хасна → скан → хадгална (алдаа гарвал кредит буцна)
   GET   миний сканууд + бодит үр дүн (TP/SL-ийг бодит ханшаар шалгана) + нийт статистик
   PATCH {id, vote: up|down, note} → хэрэглэгчийн үнэлгээ (санах ойд)
   DELETE ?id=
   Хаагдсан скан бүр TraderSample + «сургамж» санах ой болно (lib/traderLearn.ts). */
export const dynamic = "force-dynamic";
export const maxDuration = 180;

const REASON = "TRADER_SCAN";
const busy = new Set<string>();

async function me() {
  const s = await getServerSession(authOptions);
  const id = (s?.user as { id?: string } | undefined)?.id;
  return id ? { id, email: s?.user?.email || "" } : null;
}
const pub = (d: Record<string, unknown>) => {
  const snap = d.snap as Record<string, unknown> | null;
  return { ...d, _id: String(d._id), user: undefined, snap: snap ? { ...snap, recent: undefined } : null };
};
function stats(rows: { outcome?: { status?: string; r?: number } }[]) {
  let win = 0, loss = 0, open = 0, nofill = 0, expired = 0, r = 0;
  for (const x of rows) {
    const st = x.outcome?.status;
    if (st === "tp1" || st === "tp2") { win++; r += x.outcome?.r || 0; }
    else if (st === "sl") { loss++; r -= 1; }
    else if (st === "expired") { expired++; r += x.outcome?.r || 0; }
    else if (st === "nofill") nofill++;
    else if (st === "open" || st === "pending") open++;
  }
  const closed = win + loss;
  return { win, loss, open, nofill, expired, closed, winRate: closed ? Math.round((win / closed) * 100) : null, totalR: +r.toFixed(2) };
}

export async function GET() {
  const u = await me();
  if (!u) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  await dbConnect();
  /* шийдэгдээгүй сканы үр дүнг шалгана — нэг удаад 6, 10 мин тутам */
  const due = await TraderScan.find({ "outcome.status": { $in: ["open", "pending"] }, $or: [{ evaluatedAt: null }, { evaluatedAt: { $lt: new Date(Date.now() - 10 * 60e3) } }] }).sort({ evaluatedAt: 1 }).limit(6).lean();
  await Promise.all(due.map(async (x) => {
    try {
      const o = await evaluate({ symbol: x.symbol, tf: x.tf, dir: String((x.decision as { dir?: string }).dir || "WAIT"), createdAt: x.createdAt, levels: x.levels as unknown as Levels | null });
      await TraderScan.updateOne({ _id: x._id }, { $set: { outcome: o, evaluatedAt: new Date() } });
      if (!["open", "pending"].includes(o.status)) await learnFromScan(String(x._id)).catch((e) => console.error("[trader learn]", (e as Error).message));
    } catch { await TraderScan.updateOne({ _id: x._id }, { $set: { evaluatedAt: new Date() } }); }
  }));
  maybeReseed();
  const [rows, all, user, cost, samples, mem] = await Promise.all([
    TraderScan.find({ user: u.id }).sort({ createdAt: -1 }).limit(30).lean(),
    TraderScan.find({ "decision.dir": { $in: ["BUY", "SELL"] } }).select("outcome").lean(),
    User.findById(u.id).select("credits role email").lean<{ credits?: number; role?: string; email?: string }>(),
    getSetting("traderScanCost"),
    sampleStats().catch(() => ({ backtest: 0, live: 0, seededAt: null })),
    memoryCount(u.id).catch(() => ({ mine: 0, lessons: 0 })),
  ]);
  const free = user?.role === "admin" || ["antaqor@gmail.com", "cyberempire4444@gmail.com"].includes(String(user?.email || "").toLowerCase());
  return NextResponse.json({
    scans: rows.map((x) => pub(x as unknown as Record<string, unknown>)),
    mine: stats(rows.filter((x) => ["BUY", "SELL"].includes(String((x.decision as { dir?: string }).dir)))),
    global: stats(all),
    credits: user?.credits ?? 0, cost: 0, free: true,
    brain: { samples: samples.backtest + samples.live, live: samples.live, memories: mem.mine, lessons: mem.lessons },
  });
}

export async function POST(req: NextRequest) {
  const u = await me();
  if (!u) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  if (busy.has(u.id)) return NextResponse.json({ error: "Өмнөх скан дуусаагүй байна" }, { status: 429 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("image");
  if (!(file instanceof File) || !file.size) return NextResponse.json({ error: "Графикийн зургаа оруулна уу" }, { status: 400 });
  if (file.size > 12 * 1024 * 1024) return NextResponse.json({ error: "Зураг 12MB-аас бага байх ёстой" }, { status: 413 });
  const symbol = String(form?.get("symbol") || "").slice(0, 20);
  const tf = String(form?.get("tf") || "").slice(0, 6);

  /* зураг → JPEG ≤1800px (AI-д илгээх, түүхэнд харуулах) */
  let jpg: Buffer;
  try { jpg = await sharp(Buffer.from(await file.arrayBuffer())).rotate().resize({ width: 1800, height: 1800, fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 88 }).toBuffer(); }
  catch { return NextResponse.json({ error: "Зураг уншиж чадсангүй (jpg, png, webp)" }, { status: 400 }); }

  await dbConnect();
  /* 2026-11-01: Tesla Trader скан үнэгүй (эзний шийдвэр) — кредит хасахгүй. */
  const charged = 0;

  busy.add(u.id);
  const name = `trader-${randomUUID()}.jpg`;
  const dir = path.join(process.cwd(), "public", "uploads");
  try {
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), jpg);
    const r = await scanChart(`data:image/jpeg;base64,${jpg.toString("base64")}`, { symbol, tf }, (feat) => recall(feat));
    const doc = await TraderScan.create({
      user: u.id, image: `/uploads/${name}`, symbol: r.inst?.symbol || r.read.symbol || symbol, tf: r.tf, kind: r.inst?.kind || "",
      read: r.read, snap: r.snap, decision: r.decision, levels: r.levels, text: r.text, warnings: r.warnings,
      quoteUsd: r.quoteUsd, contract: r.inst?.contract || 0, pip: r.inst?.pip || 0, digits: r.inst?.digits ?? 5, charged,
      feat: r.feat, hist: r.hist, overlay: r.overlay,
      outcome: { status: r.decision.dir === "WAIT" || !r.levels ? "na" : r.levels.limit ? "pending" : "open" },
    });
    return NextResponse.json({ scan: pub(doc.toObject() as unknown as Record<string, unknown>) });
  } catch (e) {
    await unlink(path.join(dir, name)).catch(() => {});
    if (charged) await refundCredits({ userId: u.id, amount: charged, reason: `${REASON}_REFUND` }).catch(() => {});
    return NextResponse.json({ error: `${(e as Error).message || "Скан амжилтгүй"}${charged ? " · кредит буцаагдлаа" : ""}` }, { status: 500 });
  } finally { busy.delete(u.id); }
}

export async function PATCH(req: NextRequest) {
  const u = await me();
  if (!u) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { id?: string; vote?: string; note?: string };
  if (!/^[a-f0-9]{24}$/i.test(String(b.id)) || !["up", "down"].includes(String(b.vote))) return NextResponse.json({ error: "Буруу хүсэлт" }, { status: 400 });
  await dbConnect();
  const note = String(b.note || "").slice(0, 400);
  const x = await TraderScan.findOneAndUpdate({ _id: b.id, user: u.id }, { $set: { feedback: { vote: b.vote, note, at: new Date() } } }, { new: true }).lean<{ symbol: string; tf: string; decision: { dir: string; confidence: number } }>();
  if (!x) return NextResponse.json({ error: "Скан олдсонгүй" }, { status: 404 });
  /* үнэлгээ = хэрэглэгчийн хувийн санах ой (чатанд ашиглагдана) */
  await addMemory(u.id, "feedback", `${x.symbol} ${x.tf} ${x.decision.dir} (${x.decision.confidence}%) сканыг хэрэглэгч ${b.vote === "up" ? "ЗӨВ/хэрэгтэй" : "БУРУУ/хэрэггүй"} гэж үнэлсэн${note ? `: ${note}` : ""}`, { scan: b.id, vote: b.vote }).catch(() => {});
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const u = await me();
  if (!u) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id") || "";
  if (!/^[a-f0-9]{24}$/i.test(id)) return NextResponse.json({ error: "id буруу" }, { status: 400 });
  await dbConnect();
  const d = await TraderScan.findOneAndDelete({ _id: id, user: u.id }).lean();
  if (d?.image?.startsWith("/uploads/trader-")) await unlink(path.join(process.cwd(), "public", d.image)).catch(() => {});
  return NextResponse.json({ ok: true });
}
