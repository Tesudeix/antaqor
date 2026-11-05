import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import CompanionDoc from "@/models/CompanionDoc";
import { chunkText } from "@/lib/companionLearn";
import { embedPending, invalidate } from "@/lib/vectorIndex";

export const dynamic = "force-dynamic";

async function admin() {
  const s = await getServerSession(authOptions);
  return s?.user && isAdmin(s.user.email) ? s : null;
}

// GET — эх сурвалжаар бүлэглэсэн жагсаалт + нийт тоо.
export async function GET() {
  if (!(await admin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await dbConnect();
  const groups = await CompanionDoc.aggregate([
    { $group: { _id: { source: "$source", kind: "$kind" }, chunks: { $sum: 1 }, chars: { $sum: { $strLenCP: "$text" } }, at: { $max: "$createdAt" }, sample: { $first: "$text" } } },
    { $sort: { at: -1 } },
  ]);
  const totals = { knowledge: 0, voice: 0 };
  for (const g of groups) totals[g._id.kind as "knowledge" | "voice"] += g.chunks;
  return NextResponse.json({
    totals,
    sources: groups.map((g) => ({ source: g._id.source, kind: g._id.kind, chunks: g.chunks, chars: g.chars, at: g.at, sample: String(g.sample || "").slice(0, 140) })),
  });
}

// POST { text, source, kind } — текстийг хэсэглэж хадгална.
export async function POST(req: NextRequest) {
  if (!(await admin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { text?: string; source?: string; kind?: string };
  const text = String(body.text || "");
  if (text.trim().length < 20) return NextResponse.json({ error: "Хэт богино — дор хаяж 20 тэмдэгт" }, { status: 400 });
  if (text.length > 400_000) return NextResponse.json({ error: "Хэт урт — 400,000 тэмдэгтээс бага (хуваагаад оруулна уу)" }, { status: 400 });
  const kind = body.kind === "voice" ? "voice" : "knowledge";
  const source = (String(body.source || "").trim() || `Оруулга ${new Date().toISOString().slice(0, 16).replace("T", " ")}`).slice(0, 120);
  const chunks = chunkText(text);
  if (!chunks.length) return NextResponse.json({ error: "Хэсэглэх агуулга олдсонгүй" }, { status: 400 });
  await dbConnect();
  await CompanionDoc.insertMany(chunks.map((c) => ({ kind, source, text: c })));
  /* шууд векторжуулна — алдаа гарвал хэсгүүд хадгалагдсан хэвээр, түлхүүр үгээр хайгдана */
  const emb = await embedPending().catch((e) => ({ embedded: 0, remaining: -1, error: (e as Error).message }));
  return NextResponse.json({ ok: true, source, kind, chunks: chunks.length, embedded: emb.embedded });
}

// DELETE ?source=&kind= — нэг оруулгыг бүхэлд нь устгана.
export async function DELETE(req: NextRequest) {
  if (!(await admin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const source = sp.get("source") || "";
  if (!source) return NextResponse.json({ error: "source шаардлагатай" }, { status: 400 });
  await dbConnect();
  const r = await CompanionDoc.deleteMany({ source, ...(sp.get("kind") ? { kind: sp.get("kind") } : {}) });
  invalidate();
  return NextResponse.json({ ok: true, deleted: r.deletedCount });
}
