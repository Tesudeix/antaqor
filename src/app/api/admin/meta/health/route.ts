import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { accountHealth } from "@/lib/metaHealth";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getServerSession(authOptions);
  if (!s?.user || !isAdmin(s.user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const accounts = await accountHealth();
  return NextResponse.json({ accounts, checkedAt: Date.now() });
}
