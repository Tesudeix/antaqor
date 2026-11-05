import { NextResponse } from "next/server";
import { getSalePlans } from "@/lib/planStore";
import { TERMS_TEXT } from "@/lib/plans";

export const dynamic = "force-dynamic";

// Зарагдаж буй тарифууд — /pricing үүнийг уншина. Богино кэш: админ үнэ
// өөрчилсний дараа удаан хүлээхгүй, гэхдээ хүсэлт бүрд DB цохихгүй.
export async function GET() {
  try {
    const plans = await getSalePlans();
    return NextResponse.json(
      { plans, terms: TERMS_TEXT },
      { headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=120" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load plans";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
