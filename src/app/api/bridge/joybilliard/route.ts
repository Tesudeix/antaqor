// ─── antaqor.com → joybilliard.mn админ нэвтрэлт (2026-10-16) ───────────────
// joybilliard-ийн админ "antaqor.com-оор нэвтрэх" дарахад энд ирнэ. antaqor-ийн
// session-оос имэйл авч, супер админ бол 60 секунд хүчинтэй HMAC гарын үсэгтэй
// токен үүсгээд joybilliard руу буцаана. Нууц: JOY_BRIDGE_SECRET (хоёр талд ижил).
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import crypto from "crypto";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

const JOY = "https://joybilliard.mn";

export async function GET(req: NextRequest) {
  const secret = process.env.JOY_BRIDGE_SECRET;
  if (!secret) return NextResponse.json({ error: "bridge not configured" }, { status: 503 });
  const base = process.env.NEXTAUTH_URL || req.url;
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();
  if (!email) {
    return NextResponse.redirect(new URL("/auth/signin?callbackUrl=" + encodeURIComponent("/api/bridge/joybilliard"), base));
  }
  if (!isAdmin(email)) return NextResponse.redirect(JOY + "/admin.html?bridge=denied");
  const payload = Buffer.from(
    JSON.stringify({ email, name: session?.user?.name || "", exp: Date.now() + 60_000, n: crypto.randomBytes(12).toString("hex") }),
  ).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return NextResponse.redirect(`${JOY}/api/auth/antaqor?p=${payload}&s=${sig}`);
}
