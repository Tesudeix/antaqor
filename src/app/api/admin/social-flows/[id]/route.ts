import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, unauthorized } from "@/lib/adminAuth";
import dbConnect from "@/lib/mongodb";
import SocialFlow from "@/models/SocialFlow";

const NODE_TYPES = ["trigger", "message", "buttons", "delay", "condition", "action"];

// Sanitise the graph the canvas sends up — keep only well-formed nodes/edges.
function cleanGraph(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  if (Array.isArray(body.nodes)) {
    out.nodes = (body.nodes as Record<string, unknown>[])
      .filter((n) => n && typeof n.id === "string" && NODE_TYPES.includes(String(n.type)))
      .map((n) => ({
        id: String(n.id),
        type: String(n.type),
        x: Number(n.x) || 0,
        y: Number(n.y) || 0,
        data: typeof n.data === "object" && n.data ? n.data : {},
      }));
  }
  if (Array.isArray(body.edges)) {
    const nodeIds = new Set((out.nodes as { id: string }[] | undefined)?.map((n) => n.id) || []);
    out.edges = (body.edges as Record<string, unknown>[])
      .filter((e) => e && typeof e.source === "string" && typeof e.target === "string")
      // Drop edges that dangle (source or target node removed).
      .filter((e) => (nodeIds.size === 0 ? true : nodeIds.has(String(e.source)) && nodeIds.has(String(e.target))))
      .map((e) => ({
        id: String(e.id || `${e.source}-${e.target}-${Math.random().toString(36).slice(2, 7)}`),
        source: String(e.source),
        sourceHandle: String(e.sourceHandle || "out"),
        target: String(e.target),
      }));
  }
  return out;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return unauthorized();
  try {
    const { id } = await params;
    await dbConnect();
    const flow = await SocialFlow.findById(id).lean();
    if (!flow) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ flow });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PUT — save graph + meta (name, platform, enabled). Accepts any subset.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return unauthorized();
  try {
    const { id } = await params;
    const b = await req.json();
    const u: Record<string, unknown> = { ...cleanGraph(b) };
    if (typeof b.name === "string") u.name = b.name.trim().slice(0, 120);
    if (typeof b.description === "string") u.description = b.description.trim().slice(0, 400);
    if (["instagram", "messenger", "facebook", "threads"].includes(b.platform)) u.platform = b.platform;
    if (typeof b.enabled === "boolean") u.enabled = b.enabled;
    if (typeof b.account === "string" && b.account.trim()) u.account = b.account.trim().slice(0, 40);

    await dbConnect();
    const flow = await SocialFlow.findByIdAndUpdate(id, u, { new: true }).lean();
    if (!flow) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ flow });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to save";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return unauthorized();
  try {
    const { id } = await params;
    await dbConnect();
    const r = await SocialFlow.findByIdAndDelete(id);
    if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
