import { NextResponse } from "next/server";
import { getAdminSession, unauthorized } from "@/lib/adminAuth";
import dbConnect from "@/lib/mongodb";
import AiVideo from "@/models/AiVideo";
import AiCreation from "@/models/AiCreation";
import { statUpload } from "@/lib/localMedia";

export const dynamic = "force-dynamic";

// Нийтлэхэд БЭЛЭН рийлүүд. Хоёр эх сурвалжийг нэгтгэнэ:
//   · AiVideo     — Seedance студи (/tools/video)
//   · AiCreation  — Kling студи (/ai)
// Зөвхөн ДИСК дээр нь ҮНЭХЭЭР байгаа файлыг гаргана: DB-д мөр байхад
// файл нь алга байх нь тохиолддог бөгөөд тэрийг сонгуулбал нийтлэх үед
// л мэдэгдэнэ — сонгох дэлгэц дээр шүүсэн нь дээр.

interface Row {
  id: string;
  kind: "aivideo" | "aicreation";
  videoUrl: string;
  prompt: string;
  durationSec: number;
  aspectRatio: string;
  bytes: number;
  createdAt: Date;
}

export async function GET() {
  const session = await getAdminSession();
  if (!session) return unauthorized();

  await dbConnect();

  const [seedance, kling] = await Promise.all([
    AiVideo.find({ status: "done", videoUrl: { $ne: "" }, deletedAt: { $exists: false } })
      .sort({ createdAt: -1 })
      .limit(40)
      .select("videoUrl prompt duration ratio createdAt")
      .lean(),
    AiCreation.find({ status: "done", videoUrl: { $ne: "" } })
      .sort({ createdAt: -1 })
      .limit(40)
      .select("videoUrl prompt duration aspectRatio createdAt")
      .lean(),
  ]);

  const candidates: Row[] = [
    ...seedance.map((v) => ({
      id: String(v._id),
      kind: "aivideo" as const,
      videoUrl: v.videoUrl,
      prompt: v.prompt || "",
      durationSec: Number(v.duration) || 0,
      aspectRatio: v.ratio || "",
      bytes: 0,
      createdAt: v.createdAt,
    })),
    ...kling.map((v) => ({
      id: String(v._id),
      kind: "aicreation" as const,
      videoUrl: v.videoUrl,
      prompt: v.prompt || "",
      durationSec: Number(v.duration) || 0,
      aspectRatio: v.aspectRatio || "",
      bytes: 0,
      createdAt: v.createdAt,
    })),
  ];

  const rows: Row[] = [];
  for (const c of candidates) {
    const stat = await statUpload(c.videoUrl);
    if (!stat) continue; // алга болсон файл, эсвэл TikTok дэмждэггүй формат
    rows.push({ ...c, bytes: stat.bytes });
  }

  rows.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  return NextResponse.json({ videos: rows.slice(0, 40) });
}
