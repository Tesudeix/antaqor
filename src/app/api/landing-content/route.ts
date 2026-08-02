import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import LandingContent from "@/models/LandingContent";
import { LANDING_DEFAULTS, type LandingContentFields } from "@/lib/landingContent";

export const dynamic = "force-dynamic";

// Нүүр + Курс хуудасны контент. GET нээлттэй (хуудсууд уншина), PUT зөвхөн админ.
// Mongo унтарсан ч хуудас амьд байхын тулд алдаа гарвал DEFAULTS буцаана.

type Content = LandingContentFields;

/** Хоосон/дутуу талбарыг кодон дахь default-аар нөхнө — хуудас хэзээ ч цоорхойгүй. */
function withDefaults(doc: Record<string, unknown> | null): Content {
  const out: Record<string, unknown> = { ...LANDING_DEFAULTS };
  if (doc) {
    for (const key of Object.keys(LANDING_DEFAULTS) as (keyof Content)[]) {
      const v = doc[key];
      if (v === undefined || v === null) continue;
      if (typeof v === "string" && v.trim() === "") continue;
      if (Array.isArray(v) && v.length === 0) continue;
      out[key] = v;
    }
  }
  return out as unknown as Content;
}

export async function GET() {
  try {
    await dbConnect();
    const doc = await LandingContent.findOne({}).lean();
    return NextResponse.json(
      { content: withDefaults(doc as unknown as Record<string, unknown> | null) },
      { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=300" } }
    );
  } catch {
    return NextResponse.json({ content: LANDING_DEFAULTS });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as Record<string, unknown>;
    // Зөвхөн мэдэгдэж буй талбаруудыг авна — schema-гүй түлхүүр орохгүй.
    const update: Record<string, unknown> = {};
    for (const key of Object.keys(LANDING_DEFAULTS) as (keyof Content)[]) {
      if (key in body) update[key] = body[key];
    }

    await dbConnect();
    const doc = await LandingContent.findOneAndUpdate({}, update, {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }).lean();

    return NextResponse.json({ content: withDefaults(doc as unknown as Record<string, unknown> | null) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "save failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
