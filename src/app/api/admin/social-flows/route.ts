import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, unauthorized } from "@/lib/adminAuth";
import dbConnect from "@/lib/mongodb";
import SocialFlow from "@/models/SocialFlow";

// GET — admin lists all social automation flows (newest edited first).
export async function GET() {
  const session = await getAdminSession();
  if (!session) return unauthorized();
  try {
    await dbConnect();
    const flows = await SocialFlow.find({}).sort({ updatedAt: -1 }).limit(200).lean();
    return NextResponse.json({ flows });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load flows";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST — admin creates a new flow, seeded with a single trigger node so the
// canvas is never empty (an automation always starts from a trigger).
export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return unauthorized();
  try {
    const b = await req.json().catch(() => ({}));
    const name = String(b.name || "").trim() || "Шинэ автоматжуулалт";
    const platform = ["instagram", "messenger", "facebook", "threads"].includes(b.platform)
      ? b.platform
      : "instagram";

    await dbConnect();
    const account = typeof b.account === "string" && b.account.trim() ? b.account.trim() : "antaqor";
    const flow = await SocialFlow.create({
      name,
      platform,
      account,
      createdByEmail: session.user?.email || "",
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          x: 80,
          y: 140,
          data: { keywords: [], matchMode: "contains" },
        },
      ],
      edges: [],
    });
    return NextResponse.json({ flow }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create flow";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
