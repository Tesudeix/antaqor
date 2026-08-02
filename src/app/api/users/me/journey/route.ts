import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import ProgramProgress from "@/models/ProgramProgress";
import { isAdmin } from "@/lib/admin";
import { awardXP } from "@/lib/xp";
import SiteSettings from "@/models/SiteSettings";
import { computeJourney, releaseAtFor, dayComplete, PROGRAM_DAYS, type DayProgressLean } from "@/lib/program";

export const dynamic = "force-dynamic";

// ─── 7 хоногийн хөтөлбөрийн API ───
// GET  — серверээс тооцсон бүх төлөв (unlock-дүрэм зөвхөн энд).
// POST — lesson_done / save_draft / submit. Түгжээтэй өдөрт үйлдэл хийхийг
//        сервер талд шалгаж татгалзана (client-ийн лог хангалтгүй).

const LESSON_XP = 20;

interface SessionUser {
  id: string;
}

async function loadContext() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const userId = (session.user as SessionUser).id;
  await dbConnect();
  const user = await User.findById(userId)
    .select("name plan role email clanJoinedAt createdAt subscriptionExpiresAt xp level streakDays")
    .lean();
  if (!user) return null;
  const u = user as unknown as {
    _id: unknown; name?: string; plan?: string; role?: string; email?: string;
    clanJoinedAt?: Date; createdAt?: Date; subscriptionExpiresAt?: Date;
    xp?: number; level?: number; streakDays?: number;
  };
  const now = new Date();
  const admin = u.role === "admin" || isAdmin(u.email);
  const subActive = !!(u.subscriptionExpiresAt && new Date(u.subscriptionExpiresAt) > now);
  const isPaid = admin || subActive;
  // Хуваарийн эх цэг: гишүүн болсон огноо (эсвэл бүртгүүлсэн огноо).
  const anchor = new Date(u.clanJoinedAt || u.createdAt || now);
  return { userId, u, isPaid, anchor, now };
}

async function releaseHour(): Promise<number> {
  const row = await SiteSettings.findOne({ key: "journey_release_hour" }).lean();
  const h = parseInt((row as { value?: string } | null)?.value || "18", 10);
  return Number.isInteger(h) && h >= 0 && h <= 23 ? h : 18;
}

async function buildResponse(ctx: NonNullable<Awaited<ReturnType<typeof loadContext>>>) {
  const doc = await ProgramProgress.findOne({ userId: ctx.userId }).lean();
  const progress = ((doc?.days as DayProgressLean[] | undefined) || []) as DayProgressLean[];
  const { days, nextUnlockAt } = computeJourney(ctx.anchor, progress, ctx.isPaid, new Date(), await releaseHour());

  const completedDays = days.filter((d) => d.status === "completed").length;
  const lessonsDone = days.filter((d) => d.lessonDone).length;
  const assignmentsDone = days.filter(
    (d) => d.assignmentStatus === "submitted" || d.assignmentStatus === "approved"
  ).length;
  const current =
    days.find((d) => d.status === "in_progress") || days.find((d) => d.status === "available") || null;

  return {
    serverNow: new Date().toISOString(),
    isPaid: ctx.isPaid,
    firstName: (ctx.u.name || "").trim().split(" ")[0] || "",
    totals: {
      completedDays,
      lessonsDone,
      assignmentsDone,
      xp: ctx.u.xp || 0,
      level: ctx.u.level || 1,
      streakDays: ctx.u.streakDays || 0,
      subDaysLeft: ctx.u.subscriptionExpiresAt
        ? Math.max(0, Math.ceil((new Date(ctx.u.subscriptionExpiresAt).getTime() - Date.now()) / 86400000))
        : null,
    },
    currentDay: current ? current.day : null,
    nextUnlockAt,
    days,
  };
}

export async function GET() {
  try {
    const ctx = await loadContext();
    if (!ctx) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    return NextResponse.json(await buildResponse(ctx));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "journey failed" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await loadContext();
    if (!ctx) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    if (!ctx.isPaid) return NextResponse.json({ error: "plan_required" }, { status: 402 });

    const b = (await req.json().catch(() => null)) as {
      action?: string;
      day?: number;
      text?: string;
      url?: string;
    } | null;
    const day = Number(b?.day);
    const action = String(b?.action || "");
    if (!Number.isInteger(day) || day < 1 || day > 7 || !PROGRAM_DAYS.some((d) => d.day === day)) {
      return NextResponse.json({ error: "invalid_day" }, { status: 400 });
    }

    // ── Сервер талын unlock шалгалт ──
    const doc =
      (await ProgramProgress.findOne({ userId: ctx.userId })) ||
      (await ProgramProgress.create({ userId: ctx.userId, days: [] }));
    const byDay = new Map(doc.days.map((d) => [d.day, d]));
    const now = new Date();
    const hour = await releaseHour();
    const released = now.getTime() >= releaseAtFor(ctx.anchor, day, hour).getTime();
    const prevDone = day === 1 || dayComplete(byDay.get(day - 1) as DayProgressLean | undefined);
    if (!released || !prevDone) {
      return NextResponse.json(
        { error: "locked", releaseAt: releaseAtFor(ctx.anchor, day, hour).toISOString(), prevDone },
        { status: 403 }
      );
    }

    let entry = byDay.get(day);
    if (!entry) {
      doc.days.push({
        day,
        lessonDoneAt: null,
        assignmentStatus: "not_started",
        draftText: "",
        submittedText: "",
        submittedUrl: "",
        submittedAt: null,
        feedback: "",
        lessonXpAwarded: false,
        assignXpAwarded: false,
      });
      entry = doc.days[doc.days.length - 1];
    }

    const def = PROGRAM_DAYS.find((d) => d.day === day)!;

    if (action === "lesson_done") {
      if (!entry.lessonDoneAt) {
        entry.lessonDoneAt = now;
        if (!entry.lessonXpAwarded) {
          entry.lessonXpAwarded = true;
          // awardXP — level-ийг НЭГ томьёогоор (sqrt(xp/100)) дахин тооцно.
          await awardXP(ctx.userId, "COMPLETE_LESSON", LESSON_XP, `journey-day-${day}`).catch(() => {});
        }
      }
    } else if (action === "save_draft") {
      if (entry.assignmentStatus === "submitted" || entry.assignmentStatus === "approved") {
        return NextResponse.json({ error: "already_submitted" }, { status: 400 });
      }
      entry.draftText = String(b?.text || "").slice(0, 5000);
      entry.assignmentStatus = "draft";
    } else if (action === "submit") {
      const text = String(b?.text || "").trim().slice(0, 5000);
      const url = String(b?.url || "").trim().slice(0, 600);
      if (text.length < 10 && !url) {
        return NextResponse.json({ error: "submission_empty" }, { status: 400 });
      }
      if (entry.assignmentStatus === "approved") {
        return NextResponse.json({ error: "already_approved" }, { status: 400 });
      }
      entry.submittedText = text;
      entry.submittedUrl = url;
      entry.submittedAt = now;
      entry.assignmentStatus = "submitted";
      entry.draftText = "";
      if (!entry.assignXpAwarded) {
        entry.assignXpAwarded = true;
        await awardXP(ctx.userId, "COMPLETE_TASK", def.xpReward, `journey-day-${day}`).catch(() => {});
      }
    } else {
      return NextResponse.json({ error: "invalid_action" }, { status: 400 });
    }

    doc.markModified("days");
    await doc.save();
    return NextResponse.json(await buildResponse(ctx));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "journey action failed" },
      { status: 500 }
    );
  }
}
