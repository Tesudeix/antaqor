import { NextRequest, NextResponse } from "next/server";
import { findUserByReferralCode } from "@/lib/credits";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = (searchParams.get("code") || "").trim().toLowerCase();
  if (!code) return NextResponse.json({ user: null });
  const user = await findUserByReferralCode(code);
  return NextResponse.json({ user });
}

export const dynamic = "force-dynamic";
