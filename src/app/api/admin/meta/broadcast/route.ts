import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import MetaBroadcast from "@/models/MetaBroadcast";
import { audienceCount, AudienceSpec } from "@/lib/metaBroadcastRun";
import MetaPage from "@/models/MetaPage";

export const dynamic = "force-dynamic";

async function gate() {
  const s = await getServerSession(authOptions);
  return s?.user && isAdmin(s.user.email) ? s : null;
}

export async function GET() {
  if (!(await gate())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await dbConnect();
  const broadcasts = await MetaBroadcast.find().sort({ createdAt: -1 }).limit(30).lean();

  // The page used to hard-code three legacy accounts, so a page connected later
  // (REVA) could never be broadcast to, and the default was a dead account with
  // nobody reachable — which made the whole screen look broken. Build the list
  // from the registry, and hand back the reachable count so the choice is
  // informed rather than a guess.
  const pages = await MetaPage.find({ enabled: true })
    .select("key name pageId")
    .lean<{ key: string; name?: string; pageId: string }[]>();
  const legacy = [
    { key: "antaqor", name: "Antaqor" },
    { key: "joymassage", name: "Joy Massage" },
    { key: "joybilliard", name: "Joy Billiard" },
  ].filter((l) => !pages.some((p) => p.key === l.key));
  const keys = [
    { key: "all", name: "Бүх хуудас" },
    ...pages.map((p) => ({ key: p.key, name: p.name || p.pageId })),
    ...legacy,
  ];
  const accounts = await Promise.all(
    keys.map(async (k) => ({
      key: k.key,
      label: k.name,
      reach: await audienceCount({ platform: "both", account: k.key, audience: { intentLabels: [] } }),
    }))
  );
  return NextResponse.json({ broadcasts, accounts });
}

export async function POST(req: NextRequest) {
  const s = await gate();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  await dbConnect();

  const platform = (["instagram", "messenger", "both"].includes(b.platform as string) ? b.platform : "both") as "instagram" | "messenger" | "both";
  const account = typeof b.account === "string" && b.account.trim() ? b.account.trim() : "antaqor";
  const contentType = (["flow", "text"].includes(b.contentType as string) ? b.contentType : "text") as "flow" | "text";
  const intentLabels = Array.isArray(b.intentLabels)
    ? (b.intentLabels as unknown[]).filter((x): x is string => typeof x === "string")
    : [];

  const spec: AudienceSpec = { platform, account, audience: { intentLabels } };
  const count = await audienceCount(spec);

  // Preview mode — just report how many people would receive it, don't persist.
  if (b.preview === true) {
    return NextResponse.json({ count });
  }

  if (!String(b.name || "").trim()) {
    return NextResponse.json({ error: "Кампанит ажлын нэр шаардлагатай" }, { status: 400 });
  }
  if (contentType === "text" && !String(b.text || "").trim()) {
    return NextResponse.json({ error: "Мессежийн текст шаардлагатай" }, { status: 400 });
  }
  if (contentType === "flow" && !String(b.flowId || "").trim()) {
    return NextResponse.json({ error: "Flow сонгоно уу" }, { status: 400 });
  }

  const broadcast = await MetaBroadcast.create({
    name: String(b.name).trim(),
    account,
    platform,
    contentType,
    flowId: contentType === "flow" ? (b.flowId as string) : null,
    text: contentType === "text" ? String(b.text || "").trim() : "",
    imageUrl: typeof b.imageUrl === "string" ? b.imageUrl.trim() : "",
    audience: { intentLabels },
    status: "draft",
    createdByEmail: s.user?.email || "",
  });

  return NextResponse.json({ broadcast, count }, { status: 201 });
}
