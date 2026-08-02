import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import SiteSettings from "@/models/SiteSettings";

export const dynamic = "force-dynamic";

const TITLE_KEY = "classroomTitle";
const DESC_KEY = "classroomDescription";
const DEFAULT_TITLE = "Сургалт";
const DEFAULT_DESC = "Эвент · хичээл — нэг газар";

const TITLE_MAX = 80;
const DESC_MAX = 240;

interface SettingDoc { value?: string }

async function readMeta() {
  await dbConnect();
  const [titleDoc, descDoc] = await Promise.all([
    SiteSettings.findOne({ key: TITLE_KEY }).lean(),
    SiteSettings.findOne({ key: DESC_KEY }).lean(),
  ]);
  const t = (titleDoc as unknown as SettingDoc | null)?.value;
  const d = (descDoc as unknown as SettingDoc | null)?.value;
  return {
    title: t && t.length > 0 ? t : DEFAULT_TITLE,
    description: d && d.length > 0 ? d : DEFAULT_DESC,
  };
}

export async function GET() {
  try {
    const meta = await readMeta();
    return NextResponse.json(meta);
  } catch {
    // If the DB ever fails for any reason, serve defaults so the page never breaks.
    return NextResponse.json({ title: DEFAULT_TITLE, description: DEFAULT_DESC });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as { title?: unknown; description?: unknown };

  await dbConnect();

  if (typeof body.title === "string") {
    const v = body.title.trim().slice(0, TITLE_MAX);
    if (v.length === 0) {
      return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
    }
    await SiteSettings.findOneAndUpdate(
      { key: TITLE_KEY },
      { value: v },
      { upsert: true, new: true }
    );
  }
  if (typeof body.description === "string") {
    // Description is allowed to be empty (admin may want to hide subline)
    const v = body.description.trim().slice(0, DESC_MAX);
    await SiteSettings.findOneAndUpdate(
      { key: DESC_KEY },
      { value: v },
      { upsert: true, new: true }
    );
  }

  const meta = await readMeta();
  return NextResponse.json(meta);
}
