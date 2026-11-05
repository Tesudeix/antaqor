import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, unauthorized } from "@/lib/adminAuth";
import { embedPending, vectorStats } from "@/lib/vectorIndex";
import { retrieve } from "@/lib/companionRetrieve";

/* GET  ?q=  — RAG хайлтыг шалгах (аль хэсэг, ямар оноотой ирэв) + төлөв
   POST       — вектор нь алга хэсгүүдийг векторжуулах */
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  if (!(await getAdminSession())) return unauthorized();
  const q = (req.nextUrl.searchParams.get("q") || "").trim().slice(0, 500);
  const stats = await vectorStats();
  if (!q) return NextResponse.json({ stats });
  const t0 = Date.now();
  const [know, voice] = await Promise.all([retrieve(q, "knowledge", 5), retrieve(q, "voice", 3)]);
  return NextResponse.json({ stats, ms: Date.now() - t0, mode: know.mode, knowledge: know.hits, voice: voice.hits });
}

export async function POST() {
  if (!(await getAdminSession())) return unauthorized();
  try { return NextResponse.json({ ok: true, ...(await embedPending()), stats: await vectorStats() }); }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 502 }); }
}
