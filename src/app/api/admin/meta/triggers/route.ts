import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import MetaTrigger from "@/models/MetaTrigger";

export const dynamic = "force-dynamic";

async function gate() {
  const s = await getServerSession(authOptions);
  return s?.user && isAdmin(s.user.email) ? s : null;
}

export async function GET() {
  if (!(await gate())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await dbConnect();
  const triggers = await MetaTrigger.find().sort({ updatedAt: -1 }).lean();
  return NextResponse.json({ triggers });
}

export async function POST(req: NextRequest) {
  const s = await gate();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({})) as Record<string, unknown>;
  if (!String(b.name || "").trim() || !String(b.dmTemplate || "").trim()) {
    return NextResponse.json({ error: "Нэр болон DM текст шаардлагатай" }, { status: 400 });
  }
  await dbConnect();
  const keywords = Array.isArray(b.keywords)
    ? (b.keywords as unknown[]).filter((k): k is string => typeof k === "string").map((k) => k.trim()).filter(Boolean)
    : [];
  const matchMode = (["exact", "contains", "starts_with"].includes(b.matchMode as string) ? b.matchMode : "contains") as "exact" | "contains" | "starts_with";
  const platform = (["instagram", "messenger", "both"].includes(b.platform as string) ? b.platform : "both") as "instagram" | "messenger" | "both";
  const surface = (["comment", "dm", "both"].includes(b.surface as string) ? b.surface : "both") as "comment" | "dm" | "both";

  const trigger = await MetaTrigger.create({
    name: String(b.name).trim(),
    keywords,
    matchMode,
    platform,
    surface,
    account: typeof b.account === "string" ? b.account : "antaqor",
    dmTemplate: String(b.dmTemplate).trim(),
    commentReply: typeof b.commentReply === "string" ? b.commentReply.trim() : "",
    postId: typeof b.postId === "string" ? b.postId.trim() : "",
    enabled: b.enabled !== false,
    createdByEmail: s.user?.email || "",
  });
  return NextResponse.json({ trigger }, { status: 201 });
}
