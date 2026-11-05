import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Types } from "mongoose";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import dbConnect from "@/lib/mongodb";
import AiVideo from "@/models/AiVideo";
import { downloadOutput } from "@/lib/seedance";
import { getTask } from "@/lib/higgsfield";
import { refundCredits } from "@/lib/credits";

// ─── GET /api/tools/video-status?id=… ──────────────────────────────────────
//
// Асинхрон урсгалын ХОЁРДУГААР хагас. Хуудас үүнийг тогтмол дууддаг.
// Даалгавар дуусмагц:
//   SUCCEEDED → видеог өөрсдийн /uploads руу ТАТАЖ АВНА, мөрийг "done"
//   FAILED    → кредитийг буцаана, мөрийг "failed"
//
// ЯАГААД ТАТАЖ АВДАГ ВЭ: ModelArk-ийн гаралтын холбоос 24 ЦАГ хүчинтэй. Түүнийг
// шууд хадгалбал хэдэн цагийн дараа гишүүний түүх, постын видео хоёулаа
// үхнэ. Нэг удаа хуулж авах нь тэр бүх ангиллын алдааг устгана.
//
// НЭГ УДААГИЙН БАТАЛГАА: буцаан олголт `refunded` тугаар хамгаалагдсан —
// хуудас 10 удаа асуусан ч кредит нэг л удаа буцна.

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const REASON = "AI_VIDEO_GEN";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const id = new URL(req.url).searchParams.get("id") || "";
  if (!Types.ObjectId.isValid(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  await dbConnect();
  const row = await AiVideo.findOne({ _id: id, user: userId });
  if (!row) return NextResponse.json({ error: "Олдсонгүй" }, { status: 404 });

  // Аль хэдийн шийдэгдсэн — ModelArk-г дахин зовоох хэрэггүй.
  if (row.status !== "processing") return NextResponse.json(shape(row));
  if (!row.taskId) return NextResponse.json(shape(row));

  let task;
  try {
    task = await getTask(row.taskId);
  } catch (e) {
    // Түр зуурын алдаа: төлөвийг БҮҮ ӨӨРЧИЛ. Хуудас дахин асууна.
    return NextResponse.json({ ...shape(row), pollError: (e as Error).message });
  }

  if (task.status === "succeeded" && task.videoUrl) {
    try {
      const { buf, mime } = await downloadOutput(task.videoUrl);
      await mkdir(UPLOAD_DIR, { recursive: true });
      const ext = mime.includes("webm") ? "webm" : "mp4";
      const filename = `tool-vid-${randomUUID()}.${ext}`;
      await writeFile(path.join(UPLOAD_DIR, filename), buf);

      row.videoUrl = `/uploads/${filename}`;
      row.mime = mime;
      row.bytes = buf.length;
      row.status = "done";
      row.progress = 1;
      /* ModelArk дуусахдаа ЖИНХЭНЭ өртгөө ТОКЕНООР хэлдэг — маржиныг
         хэмжих цорын ганц бодит тоо. Алдвал дахин хэзээ ч олдохгүй тул
         энд барина. */
      row.durationMs = Date.now() - new Date(row.createdAt).getTime();
      await row.save();
      return NextResponse.json(shape(row));
    } catch (e) {
      // ModelArk амжилттай болсон ч бид татаж чадсангүй — гишүүн видеогүй
      // үлдэж байгаа тул кредитийг буцаана.
      const msg = e instanceof Error ? e.message : "Татаж чадсангүй";
      await finishFailed(row, msg, userId);
      return NextResponse.json(shape(row));
    }
  }

  /* `expired` НЭМЭГДЭВ: ModelArk даалгаврыг хугацаа дуусахад тийш
     шилжүүлдэг бөгөөд тэр нь эцсийн төлөв. Үүнийг тоохгүй бол мөр
     "processing" дээр МӨНХӨД өлгөөтэй үлдэж, кредит буцахгүй. */
  if (task.status === "failed") {
    await finishFailed(row, task.failure || "Видео үүсгэлт амжилтгүй", userId);
    return NextResponse.json(shape(row));
  }

  /* queued / running — Higgsfield хувь өгдөггүй тул хугацаанд тулгуурласан
     ТААМАГ (≈90с-т 0.9 хүртэл): гишүүнд "хөдөлж байна" гэдгийг харуулна. */
  const elapsed = (Date.now() - new Date(row.createdAt).getTime()) / 1000;
  const guess = Math.min(0.9, (task.status === "running" ? 0.15 : 0.05) + elapsed / 100);
  if (guess > (row.progress || 0) + 0.02) {
    row.progress = guess;
    await row.save();
  }
  return NextResponse.json(shape(row));
}

async function finishFailed(
  row: { status: string; error: string; cost: number; refunded: boolean; save: () => Promise<unknown> },
  message: string,
  userId: string
) {
  // Буцаан олголт НЭГ л удаа: `refunded` тугийг эхлээд шалгана.
  if (row.cost > 0 && !row.refunded) {
    await refundCredits({ userId, amount: row.cost, reason: REASON }).catch(() => {});
    row.refunded = true;
  }
  row.status = "failed";
  row.error = String(message).slice(0, 500);
  await row.save();
}

function shape(r: {
  _id: unknown; status: string; videoUrl: string; error: string; progress: number;
  prompt: string; modelId: string; ratio: string; duration: number; cost: number;
  refunded: boolean; createdAt: Date;
}) {
  return {
    id: String(r._id),
    status: r.status,
    url: r.videoUrl,
    error: r.error,
    progress: r.progress,
    prompt: r.prompt,
    model: r.modelId,
    ratio: r.ratio,
    duration: r.duration,
    cost: r.cost,
    refunded: r.refunded,
    createdAt: r.createdAt,
  };
}

export const dynamic = "force-dynamic";
