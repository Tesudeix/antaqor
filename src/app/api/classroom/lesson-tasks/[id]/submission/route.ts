import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import LessonTask from "@/models/LessonTask";
import TaskSubmission from "@/models/TaskSubmission";

// GET — own submission for this task (or admin: all)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await dbConnect();
  const userId = (session.user as { id: string }).id;
  const isAdminUser = isAdmin(session.user.email);
  if (isAdminUser && new URL(req.url).searchParams.get("all") === "1") {
    const subs = await TaskSubmission.find({ task: id })
      .populate("student", "name email avatar")
      .sort({ submittedAt: -1 })
      .lean();
    return NextResponse.json({ submissions: subs });
  }
  const submission = await TaskSubmission.findOne({ task: id, student: userId }).lean();
  return NextResponse.json({ submission });
}

// POST — student submits / re-submits
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  const { id } = await params;
  const userId = (session.user as { id: string }).id;
  const { answerText, attachments } = await req.json();

  if (!answerText?.trim() && (!attachments || attachments.length === 0)) {
    return NextResponse.json({ error: "Хариу эсвэл хавсралт оруулна уу" }, { status: 400 });
  }

  await dbConnect();
  const task = await LessonTask.findById(id);
  if (!task) return NextResponse.json({ error: "Даалгавар олдсонгүй" }, { status: 404 });

  const safeAttachments = Array.isArray(attachments)
    ? attachments
        .filter((a) => a?.url && a?.name)
        .map((a) => ({ url: String(a.url), name: String(a.name) }))
        .slice(0, 5)
    : [];

  // Upsert: one submission per (task, student); re-submitting clears grade
  const submission = await TaskSubmission.findOneAndUpdate(
    { task: id, student: userId },
    {
      $set: {
        answerText: (answerText || "").trim().slice(0, 10000),
        attachments: safeAttachments,
        submittedAt: new Date(),
        state: "submitted",
        score: undefined,
        gradedAt: undefined,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return NextResponse.json({ submission }, { status: 201 });
}

// PUT — admin grades a submission (?studentId= for admin specific)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const { studentId, score, feedback } = await req.json();
  if (!studentId) return NextResponse.json({ error: "studentId required" }, { status: 400 });
  await dbConnect();
  const submission = await TaskSubmission.findOneAndUpdate(
    { task: id, student: studentId },
    {
      $set: {
        score: typeof score === "number" ? score : 0,
        feedback: (feedback || "").trim().slice(0, 2000),
        state: "graded",
        gradedAt: new Date(),
      },
    },
    { new: true }
  );
  if (!submission) return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  return NextResponse.json({ submission });
}
