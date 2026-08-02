import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import MetaBroadcast from "@/models/MetaBroadcast";
import { runBroadcast } from "@/lib/metaBroadcastRun";

export const dynamic = "force-dynamic";

async function gate() {
  const s = await getServerSession(authOptions);
  return s?.user && isAdmin(s.user.email) ? s : null;
}

// Status read — polled by the UI while a broadcast is sending.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await gate())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await dbConnect();
  const broadcast = await MetaBroadcast.findById(id).lean();
  if (!broadcast) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ broadcast });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await gate())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  await dbConnect();

  const broadcast = await MetaBroadcast.findById(id);
  if (!broadcast) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (body.action === "send") {
    if (broadcast.status === "sending") {
      return NextResponse.json({ error: "Аль хэдийн илгээж байна" }, { status: 409 });
    }
    // Mark sending synchronously so the UI flips immediately and a double-click
    // can't launch two workers, then kick off the detached send.
    broadcast.status = "sending";
    broadcast.startedAt = new Date();
    broadcast.lastError = "";
    await broadcast.save();
    void runBroadcast(String(broadcast._id));
    return NextResponse.json({ broadcast });
  }

  if (body.action === "pause") {
    if (broadcast.status === "sending") {
      broadcast.status = "paused";
      await broadcast.save();
    }
    return NextResponse.json({ broadcast });
  }

  return NextResponse.json({ error: "Үл мэдэгдэх үйлдэл" }, { status: 400 });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await gate())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await dbConnect();
  await MetaBroadcast.findByIdAndDelete(id);
  return NextResponse.json({ ok: true });
}
