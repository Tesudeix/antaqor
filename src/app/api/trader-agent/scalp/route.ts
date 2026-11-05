import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { board, analyze } from "@/lib/scalp/service";
import { bySym } from "@/lib/scalp/engine";

/* ─── Tesla Trader · Scalp API (2026-11-04) ───
   GET            → 13 хэрэгслийн самбар (15 с кэш, бүх хэрэглэгчид нэг)
   GET ?sym=EURUSD → нэг хэрэгслийн бүрэн шинжилгээ (чарт, шүүлтүүр, гэр бүл, давуу тал, мэдээ)
   Тооцоо бүхэлдээ детерминист (lib/scalp/engine.ts) — AI дуудахгүй, кредитгүй. */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const s = await getServerSession(authOptions);
  if (!(s?.user as { id?: string } | undefined)?.id) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  const sym = req.nextUrl.searchParams.get("sym");
  try {
    if (sym) {
      const inst = bySym(sym);
      if (!inst) return NextResponse.json({ error: "Хэрэгсэл олдсонгүй" }, { status: 404 });
      return NextResponse.json(await analyze(inst, true), { headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json(await board(), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[scalp]", (e as Error).message);
    return NextResponse.json({ error: "Ханшийн өгөгдөл түр ирэхгүй байна — хэдэн секундын дараа дахин оролдоно." }, { status: 502 });
  }
}
