import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminAuth";
import dbConnect from "@/lib/mongodb";
import MetaConversation from "@/models/MetaConversation";

export const dynamic = "force-dynamic";

const ALLOWED_STATUS = ["new", "contacted", "qualified", "won", "lost"] as const;
type LeadStatus = (typeof ALLOWED_STATUS)[number];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const body = (await req.json().catch(() => null)) as {
    leadStatus?: string;
    adminNotes?: string;
  } | null;
  if (!body) return NextResponse.json({ error: "Bad json" }, { status: 400 });

  const patch: Record<string, unknown> = {
    leadUpdatedAt: new Date(),
    leadUpdatedByEmail: session.user?.email || "",
  };
  if (body.leadStatus) {
    if (!ALLOWED_STATUS.includes(body.leadStatus as LeadStatus)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    patch.leadStatus = body.leadStatus;
  }
  if (typeof body.adminNotes === "string") {
    patch.adminNotes = body.adminNotes.slice(0, 4000);
  }

  await dbConnect();
  const conv = await MetaConversation.findByIdAndUpdate(id, patch, {
    new: true,
    projection: "leadStatus adminNotes leadUpdatedAt leadUpdatedByEmail",
  }).lean();
  if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true, conv });
}
