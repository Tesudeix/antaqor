import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;
  await dbConnect();
  const u = await User.findById(userId).select("credits creditsLifetime").lean();
  if (!u) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const user = u as unknown as { credits?: number; creditsLifetime?: number };
  return NextResponse.json({
    credits: user.credits ?? 0,
    creditsLifetime: user.creditsLifetime ?? 0,
  });
}
