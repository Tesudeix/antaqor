import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Mission from "@/models/Mission";
import MissionSubmission from "@/models/MissionSubmission";
import { effectivePlan } from "@/lib/planAccess";
import { hasPlanAccess, type PlanId } from "@/lib/plans";
import { awardXP } from "@/lib/xp";

export const dynamic = "force-dynamic";

// POST — submit (or resubmit) a mission deliverable. Plan-gated server-side.
// First submission awards the mission's XP.
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    await dbConnect();

    const { plan, userId } = await effectivePlan();
    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const mission = await Mission.findOne({ slug, status: "active" });
    if (!mission) return NextResponse.json({ error: "Mission олдсонгүй" }, { status: 404 });

    if (!hasPlanAccess(plan, (mission.requiredPlan || "builder") as PlanId)) {
      return NextResponse.json(
        { error: "plan_required", requiredPlan: mission.requiredPlan },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const link = typeof body.link === "string" ? body.link.trim().slice(0, 500) : "";
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 5000) : "";
    if (!link && !note) {
      return NextResponse.json({ error: "Линк эсвэл тайлбар шаардлагатай" }, { status: 400 });
    }

    const existing = await MissionSubmission.findOne({ mission: mission._id, user: userId });
    if (existing) {
      existing.link = link;
      existing.note = note;
      existing.status = "submitted";
      await existing.save();
      return NextResponse.json({ ok: true, resubmitted: true });
    }

    await MissionSubmission.create({ mission: mission._id, user: userId, link, note });
    await Mission.updateOne({ _id: mission._id }, { $inc: { submissionsCount: 1 } });
    awardXP(userId, "COMPLETE_TASK", mission.xpReward || 300, `mission:${mission.slug}`).catch(() => {});

    return NextResponse.json({ ok: true, xpAwarded: mission.xpReward || 300 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
