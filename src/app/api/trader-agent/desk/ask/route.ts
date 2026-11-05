import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SYMBOLS, TFS, type Sym, type TF } from "@/lib/desk/market";
import { ask } from "@/lib/desk/agent";

/* POST {sym, tf, q, history} → одоогийн уншилтын бодит тоон дээр тулгуурласан хариулт */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const s = await getServerSession(authOptions), u = (s?.user as { id?: string } | undefined)?.id;
  if (!u) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { sym?: string; tf?: string; q?: string; history?: { role: string; text: string }[] }, q = String(b.q || "").trim();
  if (!b.sym || !(b.sym in SYMBOLS) || !TFS.includes(b.tf as TF) || !q) return NextResponse.json({ error: "Асуултаа бичнэ үү" }, { status: 400 });
  try { return NextResponse.json({ answer: await ask(u, { sym: b.sym as Sym, tf: b.tf as TF, q, history: Array.isArray(b.history) ? b.history : [] }) }); }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 502 }); }
}
