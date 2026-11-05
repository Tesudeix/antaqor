import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, unauthorized } from "@/lib/adminAuth";
import { write } from "@/lib/socialInsights";

/* POST {idea, format} → өөрийн шилдэг постуудаас суралцсан 3 хувилбар. */
export const dynamic = "force-dynamic";
export const maxDuration = 90;

export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) return unauthorized();
  const b = await req.json().catch(() => ({}));
  const idea = String(b.idea || "").trim().slice(0, 1500);
  if (idea.length < 3) return NextResponse.json({ error: "Санаагаа бичнэ үү" }, { status: 400 });
  try {
    const variants = await write(idea, String(b.format || "image"));
    return NextResponse.json({ variants });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "AI алдаа" }, { status: 502 });
  }
}
