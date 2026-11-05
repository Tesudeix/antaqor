import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

export const dynamic = "force-dynamic";

/* Аль төрлийг авахаа хүн өөрөө шийднэ.

   `payment` ба `system` энд БАЙХГҮЙ бөгөөд байх ч ёсгүй: тэдгээр нь
   сурталчилгаа биш, тухайн хүний мөнгө болон эрхийн талаарх мэдээлэл.
   Түүнийг унтраах товч тавих нь хүнд өөрт нь хохиролтой сонголт санал
   болгож байгаа хэрэг.

   Хоосон утга = ЗӨВШӨӨРСӨН. 650 хуучин бүртгэлд энэ талбар байхгүй тул
   анхдагч нь "тийм" байх ёстой — эс бөгөөс шинэчлэлт нь бүх хүний
   мэдэгдлийг чимээгүйхэн унтраана. */

const KEYS = ["newPosts", "newCourses"] as const;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "auth" }, { status: 401 });

  await dbConnect();
  const id = (session.user as { id: string }).id;
  const u = (await User.findById(id).select("notificationPrefs").lean()) as unknown as {
    notificationPrefs?: Record<string, boolean>;
  } | null;

  const p = u?.notificationPrefs || {};
  return NextResponse.json({
    prefs: Object.fromEntries(KEYS.map((k) => [k, p[k] !== false])),
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "auth" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const set: Record<string, boolean> = {};
    for (const k of KEYS) {
      if (typeof body?.[k] === "boolean") set[`notificationPrefs.${k}`] = body[k] as boolean;
    }
    if (Object.keys(set).length === 0) {
      return NextResponse.json({ error: "Өөрчлөх утга алга" }, { status: 400 });
    }

    await dbConnect();
    const id = (session.user as { id: string }).id;
    await User.updateOne({ _id: id }, { $set: set });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
