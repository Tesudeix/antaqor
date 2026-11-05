import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import { validateUsername, deriveUsername } from "@/lib/usernameDerive";
import { isRecoverableTag } from "@/lib/payTag";

export const dynamic = "force-dynamic";

/* Гүйлгээний утганд бичих нэрээ хүн ӨӨРӨӨ тохируулах цорын ганц зам.
   `/pricing`-ийн төлбөрийн дэлгэц дээрээс шууд дуудагдана: тэнд байгаа
   хүн бол ЯГ одоо мөнгө шилжүүлэх гэж байгаа хүн, тиймээс нэр нь тэр
   мөчид л хамгийн их ач холбогдолтой. */

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "auth" }, { status: 401 });

  await dbConnect();
  const id = (session.user as { id: string }).id;
  const u = (await User.findById(id).select("username name email").lean()) as unknown as {
    username?: string;
    name?: string;
    email?: string;
  } | null;

  return NextResponse.json({
    username: u?.username || "",
    usable: isRecoverableTag(u?.username),
    // Хоосон бол санал болгох хувилбар — хүн зүгээр "Тийм" дарахад л болно.
    suggestion: u?.username ? "" : await deriveUsername({ email: u?.email, name: u?.name }),
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "auth" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const check = validateUsername(String(body?.username || ""));
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

    await dbConnect();
    const id = (session.user as { id: string }).id;

    const taken = await User.findOne({ username: check.value, _id: { $ne: id } })
      .select("_id")
      .lean();
    if (taken) {
      return NextResponse.json({ error: "Энэ нэр аль хэдийн эзэлэгдсэн байна" }, { status: 409 });
    }

    await User.updateOne({ _id: id }, { $set: { username: check.value } });

    return NextResponse.json({ ok: true, username: check.value });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
