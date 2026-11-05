import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, unauthorized } from "@/lib/adminAuth";
import { getBrand } from "@/lib/brandProfile";

export const dynamic = "force-dynamic";

/* ─── PERSONAL BRAND-ЫН ЦӨМ ─────────────────────────────────────────────
   Энэ бичлэг нь шинэ пост бичих ба ноорог дүгнэх ХОЁУЛАНГИЙНХ нь
   промптод ордог. Тиймээс эндээс засвал дараагийн пост шууд шинэ
   тодорхойлолтоор бичигдэнэ — build хийх шаардлагагүй. */

export async function GET() {
  if (!(await getAdminSession())) return unauthorized();
  const b = await getBrand();
  return NextResponse.json({
    positioning: b.positioning, tagline: b.tagline, audience: b.audience,
    values: b.values, avoid: b.avoid, enabled: b.enabled,
  });
}

export async function PATCH(req: NextRequest) {
  if (!(await getAdminSession())) return unauthorized();
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const b = await getBrand();

  const str = (v: unknown, max: number, cur: string) =>
    typeof v === "string" ? v.trim().slice(0, max) : cur;

  if (body.positioning !== undefined) b.positioning = str(body.positioning, 300, b.positioning);
  if (body.tagline !== undefined) b.tagline = str(body.tagline, 200, b.tagline);
  if (body.audience !== undefined) b.audience = str(body.audience, 600, b.audience);
  if (typeof body.enabled === "boolean") b.enabled = body.enabled;

  if (Array.isArray(body.values)) {
    /* Утгагүй үнэт зүйл нь AI-д юу ч хэлэхгүй тул нэргүйг нь хасна.
       10-аар хязгаарласан нь промптыг хэт сунгахаас сэргийлнэ. */
    b.values = (body.values as unknown[])
      .map((v) => {
        const o = (v || {}) as Record<string, unknown>;
        return { name: String(o.name || "").trim().slice(0, 40), meaning: String(o.meaning || "").trim().slice(0, 400) };
      })
      .filter((v) => v.name)
      .slice(0, 10);
  }

  if (Array.isArray(body.avoid)) {
    b.avoid = (body.avoid as unknown[]).map((x) => String(x).trim().slice(0, 120)).filter(Boolean).slice(0, 20);
  }

  await b.save();
  return NextResponse.json({ ok: true });
}
