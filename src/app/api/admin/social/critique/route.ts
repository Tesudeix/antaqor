import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, unauthorized } from "@/lib/adminAuth";
import { critiquePost } from "@/lib/postCritique";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/* Хүний бичсэн ноорогийг дүгнэнэ. Нийтлэхгүй — зөвхөн санал. */
export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) return unauthorized();

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const text = String(body.text || "").trim();
  if (!text) return NextResponse.json({ error: "Текст хоосон" }, { status: 400 });
  if (text.length > 5000) return NextResponse.json({ error: "Текст хэт урт" }, { status: 400 });

  try {
    return NextResponse.json(await critiquePost(text));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Дүгнэж чадсангүй" }, { status: 500 });
  }
}
