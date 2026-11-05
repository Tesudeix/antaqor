import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import YtJob from "@/models/YtJob";
import { failStalled, publicJob } from "@/lib/ytgrab";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const { id } = await params;
  await dbConnect();
  await failStalled();
  /* ЭЗНЭЭР шүүнэ — өөр хүний ажлын id таамагласан ч гарахгүй. */
  const job = await YtJob.findOne({ _id: id, user: userId });
  if (!job) return NextResponse.json({ error: "Ажил олдсонгүй" }, { status: 404 });
  return NextResponse.json({ job: publicJob(job) });
}
