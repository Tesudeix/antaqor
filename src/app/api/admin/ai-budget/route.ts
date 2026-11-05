import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/admin";
import { budget, addTopup, removeTopup } from "@/lib/aiBudget";

/* Зөвхөн эзэн (super admin) — бусдад 404 (байгаа эсэхийг ч мэдэгдэхгүй). */
export const dynamic = "force-dynamic";
async function owner() { const s = await getServerSession(authOptions); return isSuperAdmin(s?.user?.email) ? s : null; }
const P = ["openai", "gemini", "higgsfield"] as const;

export async function GET() {
  if (!(await owner())) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ providers: await budget() }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(req: NextRequest) {
  if (!(await owner())) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  const p = String(b.provider) as (typeof P)[number];
  if (!P.includes(p)) return NextResponse.json({ error: "provider" }, { status: 400 });
  if (b.action === "remove") { await removeTopup(p, Number(b.index)); return NextResponse.json({ ok: true }); }
  const usd = Number(b.usd);
  if (!(usd > 0 && usd < 10000)) return NextResponse.json({ error: "Дүнгээ $-аар оруулна уу" }, { status: 400 });
  await addTopup(p, Math.round(usd * 100) / 100, String(b.note || ""));
  return NextResponse.json({ ok: true });
}
