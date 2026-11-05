import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SYMBOLS, TFS, type Sym, type TF } from "@/lib/desk/market";
import { INDICATORS, STRATS, type Strat } from "@/lib/desk/engine";
import { ask } from "@/lib/desk/agent";

/* POST {sym, strat, tfs, inds, q, history} → тайлангийн бодит тоон дээр тулгуурласан хариулт */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const s = await getServerSession(authOptions), u = (s?.user as { id?: string } | undefined)?.id;
  if (!u) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { sym?: string; strat?: string; tfs?: string[]; inds?: { id?: string; p?: number }[]; q?: string; history?: { role: string; text: string }[] };
  const tfs = (b.tfs || []).filter((t): t is TF => TFS.includes(t as TF)).slice(0, 3), q = String(b.q || "").trim();
  if (!b.sym || !(b.sym in SYMBOLS) || !b.strat || !(b.strat in STRATS) || !tfs.length || !q) return NextResponse.json({ error: "Асуултаа бичнэ үү" }, { status: 400 });
  try {
    const inds = (b.inds || []).filter((x) => INDICATORS.some((i) => i.id === x.id)).slice(0, 18).map((x) => ({ id: String(x.id), p: Number(x.p) || undefined }));
    return NextResponse.json({ answer: await ask(u, { sym: b.sym as Sym, strat: b.strat as Strat, tfs, inds, q, history: Array.isArray(b.history) ? b.history : [] }) });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 502 }); }
}
