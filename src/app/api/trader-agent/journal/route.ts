import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { journal, takeTrade, dropTrade } from "@/lib/scalp/service";

/* ─── Tesla Trader · журнал (2026-11-04) ───
   GET → миний скальпууд (нээлттэйг бодит 1 мин лаагаар шалгана) + өдөр/7 хоногийн R + тоормос
   POST {sym, dir, play, grade, entry, sl, tp1, tp2} → «Авсан» (тоормос идэвхтэй бол татгалзана)
   DELETE ?id= */
export const dynamic = "force-dynamic";

async function me() {
  const s = await getServerSession(authOptions);
  return (s?.user as { id?: string } | undefined)?.id || null;
}

export async function GET() {
  const u = await me();
  if (!u) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  return NextResponse.json(await journal(u), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const u = await me();
  if (!u) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  try {
    const id = await takeTrade(u, (await req.json().catch(() => ({}))) as Record<string, unknown>);
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const u = await me();
  if (!u) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id") || "";
  if (!/^[a-f0-9]{24}$/i.test(id)) return NextResponse.json({ error: "id буруу" }, { status: 400 });
  await dropTrade(u, id);
  return NextResponse.json({ ok: true });
}
