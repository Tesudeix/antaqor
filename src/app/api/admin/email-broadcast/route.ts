import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import EmailBroadcast from "@/models/EmailBroadcast";
import { sendEmail } from "@/lib/email";
import {
  buildHtml,
  isAudience,
  isWorkerRunning,
  resolveAudience,
  startBroadcastWorker,
  STALL_MS,
} from "@/lib/emailBroadcast";

export const dynamic = "force-dynamic";

// ─── Бүртгүүлсэн хүмүүс рүү email илгээх (Resend) ───
// audience: new7 | new30 | paid | all — тоон хязгаар БАЙХГҮЙ.
// Илгээлт нь арын ажлаар явдаг тул энэ маршрут хэзээ ч удаан
// хүлээдэггүй: POST ажлыг эхлүүлээд jobId буцаана, GET явцыг хэлнэ.

interface JobLike {
  _id: unknown;
  status: string;
  cursor: number;
  sent: number;
  failed: number;
  skipped: number;
  errorSamples: string[];
  recipients?: unknown[];
  subject: string;
  audience: string;
  heartbeatAt: Date;
  finishedAt?: Date;
}

function jobView(j: JobLike, total: number) {
  const stalled =
    j.status === "running" &&
    !isWorkerRunning(String(j._id)) &&
    Date.now() - new Date(j.heartbeatAt).getTime() > STALL_MS;
  return {
    jobId: String(j._id),
    status: stalled ? "stalled" : j.status,
    audience: j.audience,
    subject: j.subject,
    total,
    done: j.cursor,
    sent: j.sent,
    failed: j.failed,
    skipped: j.skipped,
    errors: j.errorSamples,
    finishedAt: j.finishedAt ?? null,
  };
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await dbConnect();

  // ── Тодорхой ажлын явц ──
  const jobId = req.nextUrl.searchParams.get("jobId");
  if (jobId) {
    const job = await EmailBroadcast.findById(jobId).lean();
    if (!job) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const j = job as unknown as JobLike;
    return NextResponse.json(jobView(j, (j.recipients || []).length));
  }

  // ── Хаяг тоолох + дуусаагүй ажил байвал хамт буцаана ──
  const a = req.nextUrl.searchParams.get("audience");
  if (!isAudience(a)) return NextResponse.json({ error: "invalid_audience" }, { status: 400 });
  const { emails, total, skipped } = await resolveAudience(a);

  // Хуудсаа сэргээсэн админ явж байгаа илгээлт рүүгээ буцаж холбогдоно.
  const active = await EmailBroadcast.findOne({ status: "running" }).sort({ createdAt: -1 }).lean();

  return NextResponse.json({
    audience: a,
    count: emails.length,
    total,
    skipped,
    active: active
      ? jobView(
          active as unknown as JobLike,
          ((active as unknown as JobLike).recipients || []).length
        )
      : null,
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const b = (await req.json().catch(() => null)) as {
    action?: string;
    jobId?: string;
    audience?: string;
    subject?: string;
    message?: string;
    testTo?: string;
  } | null;

  await dbConnect();

  // ── Явж байгаа илгээлтийг зогсоох ──
  if (b?.action === "cancel" && b.jobId) {
    const job = await EmailBroadcast.findById(b.jobId);
    if (!job) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (job.status === "running") {
      job.status = "cancelled";
      job.finishedAt = new Date();
      await job.save();
    }
    return NextResponse.json(jobView(job as unknown as JobLike, job.recipients.length));
  }

  // ── Унасан илгээлтийг үлдсэн хаягаас нь үргэлжлүүлэх ──
  // `cursor` хадгалагддаг тул хэн ч давхар захидал авахгүй.
  if (b?.action === "resume" && b.jobId) {
    const job = await EmailBroadcast.findById(b.jobId);
    if (!job) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (job.cursor >= job.recipients.length) {
      return NextResponse.json({ error: "already_finished" }, { status: 400 });
    }
    job.status = "running";
    job.finishedAt = undefined;
    job.heartbeatAt = new Date();
    await job.save();
    startBroadcastWorker(String(job._id));
    return NextResponse.json(jobView(job as unknown as JobLike, job.recipients.length));
  }

  const subject = (b?.subject || "").trim();
  const message = (b?.message || "").trim();
  if (subject.length < 3 || message.length < 10) {
    return NextResponse.json({ error: "subject_or_message_too_short" }, { status: 400 });
  }

  // ── Туршилтын илгээлт — зөвхөн нэг хаяг руу, шууд ──
  if (b?.testTo && b.testTo.includes("@")) {
    try {
      await sendEmail({
        to: b.testTo.trim(),
        subject,
        html: buildHtml(message),
        text: message,
      });
      return NextResponse.json({ ok: true, test: true, sent: 1, failed: 0 });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "send_failed" },
        { status: 502 }
      );
    }
  }

  if (!isAudience(b?.audience)) {
    return NextResponse.json({ error: "invalid_audience" }, { status: 400 });
  }

  // Хоёр илгээлт зэрэг явбал Resend-ийн хурдны хязгаарыг давхардуулж
  // зөрчинө — нэг нь дуустал шинийг эхлүүлэхгүй.
  const running = await EmailBroadcast.findOne({ status: "running" }).lean();
  if (running) {
    return NextResponse.json(
      { error: "broadcast_already_running", jobId: String((running as { _id: unknown })._id) },
      { status: 409 }
    );
  }

  const { emails, total, skipped } = await resolveAudience(b.audience);
  if (emails.length === 0) {
    return NextResponse.json({ error: "no_recipients" }, { status: 400 });
  }

  const job = await EmailBroadcast.create({
    audience: b.audience,
    subject,
    message,
    recipients: emails,
    skipped,
    startedBy: session.user.email || "",
  });

  startBroadcastWorker(String(job._id));
  console.log(
    `[broadcast] ${job._id} started · audience=${b.audience} recipients=${emails.length} skipped=${skipped} by=${session.user.email}`
  );

  return NextResponse.json({
    ok: true,
    audienceTotal: total,
    ...jobView(job as unknown as JobLike, emails.length),
  });
}
