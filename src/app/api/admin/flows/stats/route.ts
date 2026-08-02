import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import MetaFlowSession from "@/models/MetaFlowSession";

export const dynamic = "force-dynamic";

// Live per-flow contact counts, powered by MetaFlowSession. Lets the Flow
// Builder list SHOW the machine — how many contacts are active, where they're
// parked, how many finished — instead of guessing. One aggregate query.
//
// Response: { stats: { [flowId]: { active, completed, exited, nodes: { [nodeId]: n } } } }
export async function GET() {
  const s = await getServerSession(authOptions);
  if (!s?.user || !isAdmin(s.user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  await dbConnect();

  const rows = await MetaFlowSession.aggregate<{
    _id: { flowId: string; status: string; nodeId: string };
    n: number;
  }>([{ $group: { _id: { flowId: "$flowId", status: "$status", nodeId: "$nodeId" }, n: { $sum: 1 } } }]);

  const stats: Record<string, { active: number; completed: number; exited: number; nodes: Record<string, number> }> = {};
  for (const r of rows) {
    const { flowId, status, nodeId } = r._id;
    if (!flowId) continue;
    const f = (stats[flowId] ||= { active: 0, completed: 0, exited: 0, nodes: {} });
    if (status === "active") {
      f.active += r.n;
      f.nodes[nodeId] = (f.nodes[nodeId] || 0) + r.n;
    } else if (status === "completed") {
      f.completed += r.n;
    } else if (status === "exited") {
      f.exited += r.n;
    }
  }

  return NextResponse.json({ stats });
}
