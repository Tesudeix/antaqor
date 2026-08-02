import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, unauthorized } from "@/lib/adminAuth";
import dbConnect from "@/lib/mongodb";
import { getThreadsSettings } from "@/models/ThreadsSettings";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return unauthorized();
  await dbConnect();
  const s = await getThreadsSettings();
  return NextResponse.json({ settings: { killSwitch: s.killSwitch, maxPerHour: s.maxPerHour } });
}

export async function PATCH(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return unauthorized();
  await dbConnect();
  const body = await req.json();
  const s = await getThreadsSettings();
  if (typeof body.killSwitch === "boolean") s.killSwitch = body.killSwitch;
  if (body.maxPerHour !== undefined) {
    const n = Number(body.maxPerHour);
    if (Number.isFinite(n)) s.maxPerHour = Math.min(200, Math.max(1, Math.round(n)));
  }
  await s.save();
  return NextResponse.json({ settings: { killSwitch: s.killSwitch, maxPerHour: s.maxPerHour } });
}
