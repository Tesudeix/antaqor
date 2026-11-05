// ─── antaqor.com → terguunmeta.mn админ нэвтрэлт (2026-10-20) ──────────────
// joybilliard bridge-тэй ижил: antaqor session-ий имэйл супер админ бол 60 сек
// хүчинтэй HMAC токен үүсгээд terguunmeta руу буцаана. Нууц: TM_BRIDGE_SECRET.
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import crypto from "crypto";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

const TM = "https://terguunmeta.mn";

export async function GET(req: NextRequest) {
  const secret = process.env.TM_BRIDGE_SECRET;
  if (!secret) return NextResponse.json({ error: "bridge not configured" }, { status: 503 });
  const base = process.env.NEXTAUTH_URL || req.url;
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();
  if (!email) {
    return NextResponse.redirect(new URL("/auth/signin?callbackUrl=" + encodeURIComponent("/api/bridge/terguunmeta"), base));
  }
  if (!isAdmin(email)) return NextResponse.redirect(TM + "/admin?bridge=denied");
  const payload = Buffer.from(
    JSON.stringify({ email, name: session?.user?.name || "", exp: Date.now() + 60_000, n: crypto.randomBytes(12).toString("hex") }),
  ).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return NextResponse.redirect(`${TM}/api/admin/antaqor?p=${payload}&s=${sig}`);
}
