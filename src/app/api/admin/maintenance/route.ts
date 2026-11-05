import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import SiteSettings from "@/models/SiteSettings";

export const dynamic = "force-dynamic";

// Засвартай горимын унтраалга. SiteSettings keys:
//   maintenance_on   "1" | "0"
//   maintenance_text  чөлөөт текст (хоосон бол default мессеж)

async function gate() {
  const s = await getServerSession(authOptions);
  return s?.user && isAdmin(s.user.email) ? s : null;
}

export async function GET() {
  if (!(await gate())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await dbConnect();
  const rows = await SiteSettings.find({
    key: { $in: ["maintenance_on", "maintenance_text"] },
  }).lean();
  const map: Record<string, string> = {};
  for (const r of rows as unknown as { key: string; value: string }[]) map[r.key] = r.value ?? "";
  return NextResponse.json({ on: map.maintenance_on === "1", text: map.maintenance_text || "" });
}

export async function PUT(req: NextRequest) {
  if (!(await gate())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => null)) as { on?: boolean; text?: string } | null;
  if (!b || typeof b.on !== "boolean") {
    return NextResponse.json({ error: "on: boolean шаардлагатай" }, { status: 400 });
  }
  const text = String(b.text ?? "").slice(0, 240);

  await dbConnect();
  await SiteSettings.findOneAndUpdate(
    { key: "maintenance_on" },
    { $set: { value: b.on ? "1" : "0" } },
    { upsert: true }
  );
  await SiteSettings.findOneAndUpdate(
    { key: "maintenance_text" },
    { $set: { value: text } },
    { upsert: true }
  );
  return NextResponse.json({ ok: true, on: b.on, text });
}
