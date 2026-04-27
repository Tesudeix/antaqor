import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import CompanionKnowledge from "@/models/CompanionKnowledge";
import { invalidatePlatformContext } from "@/lib/companionContext";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.email)) return null;
  return session;
}

// GET — list all facts (admin)
export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await dbConnect();
  const facts = await CompanionKnowledge.find().sort({ weight: -1, updatedAt: -1 }).lean();
  return NextResponse.json({ facts });
}

// POST — create
export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await dbConnect();
  const body = (await req.json().catch(() => ({}))) as {
    topic?: string;
    content?: string;
    weight?: number;
    active?: boolean;
  };
  const topic = String(body.topic || "").trim().slice(0, 60);
  const content = String(body.content || "").trim().slice(0, 500);
  if (!topic || !content) {
    return NextResponse.json({ error: "topic + content шаардлагатай" }, { status: 400 });
  }
  const weight = Math.max(1, Math.min(10, Math.round(Number(body.weight) || 5)));
  const fact = await CompanionKnowledge.create({
    topic,
    content,
    weight,
    active: body.active !== false,
    createdBy: (session.user as { id?: string }).id,
  });
  invalidatePlatformContext();
  return NextResponse.json({ fact }, { status: 201 });
}

export const dynamic = "force-dynamic";
