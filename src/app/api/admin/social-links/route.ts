import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import SiteSettings from "@/models/SiteSettings";

export const dynamic = "force-dynamic";

async function gate() {
  const s = await getServerSession(authOptions);
  return s?.user && isAdmin(s.user.email) ? s : null;
}

export async function GET() {
  if (!(await gate())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await dbConnect();
  const row = await SiteSettings.findOne({ key: "social_links" }).lean();
  let links: { label: string; href: string }[] = [];
  try {
    const parsed = JSON.parse(row?.value || "[]");
    if (Array.isArray(parsed)) links = parsed;
  } catch {
    /* empty */
  }
  return NextResponse.json({ links });
}

export async function PUT(req: NextRequest) {
  if (!(await gate())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => null)) as { links?: { label?: string; href?: string }[] } | null;
  if (!Array.isArray(b?.links)) return NextResponse.json({ error: "links_required" }, { status: 400 });
  const links = b.links
    .filter((l) => l && String(l.label || "").trim() && String(l.href || "").trim())
    .slice(0, 8)
    .map((l) => ({ label: String(l.label).trim().slice(0, 30), href: String(l.href).trim().slice(0, 300) }));
  await dbConnect();
  await SiteSettings.findOneAndUpdate(
    { key: "social_links" },
    { $set: { value: JSON.stringify(links) } },
    { upsert: true }
  );
  return NextResponse.json({ ok: true, links });
}
