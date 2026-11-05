import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import YtAgent from "@/models/YtAgent";
import { newToken, hashToken } from "@/lib/ytgrab";

export const dynamic = "force-dynamic";

/* ─── AGENT-ИЙН НУУЦ ────────────────────────────────────────────────────
   Хэрэглэгч өөрийн машиныг холбох нууцаа эндээс авна.

   Нууц нь НЭГ Л УДАА харагдана: сан дээр sha256 л хадгалагдана. Хаяж
   орхивол шинээр үүсгэхээс өөр арга байхгүй, тэр үед хуучин нь шууд
   хүчингүй болно (нэг хэрэглэгч = нэг нууц). */

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  await dbConnect();
  const raw = newToken();
  await YtAgent.findOneAndUpdate(
    { user: userId },
    {
      $set: { tokenHash: hashToken(raw) },
      /* Шинэ нууц = шинэ машин байж болно. Хуучин машины төлөвийг
         үлдээвэл "холбогдсон" гэж хуурамчаар харуулна. */
      $unset: { lastSeen: 1 },
      $setOnInsert: { user: userId },
    },
    { upsert: true, new: true },
  );

  return NextResponse.json({ token: raw });
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  await dbConnect();
  await YtAgent.deleteOne({ user: userId });
  return NextResponse.json({ ok: true });
}
