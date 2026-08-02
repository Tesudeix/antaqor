import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Mission from "@/models/Mission";
import MissionSubmission from "@/models/MissionSubmission";
import { effectivePlan } from "@/lib/planAccess";
import { hasPlanAccess, type PlanId } from "@/lib/plans";

export const dynamic = "force-dynamic";

// GET — active missions. Full instructions only for plans that unlock them;
// everyone sees the brief + deliverable + skills (that's the sales surface).
export async function GET() {
  try {
    await dbConnect();
    const { plan, userId } = await effectivePlan();

    const missions = await Mission.find({ status: "active" })
      .sort({ order: 1, createdAt: -1 })
      .lean();

    const subs = userId
      ? await MissionSubmission.find({ user: userId }).select("mission status feedback").lean()
      : [];
    const subByMission = new Map(subs.map((s) => [String(s.mission), s]));

    const out = missions.map((m) => {
      const unlocked = hasPlanAccess(plan, (m.requiredPlan || "builder") as PlanId);
      const sub = subByMission.get(String(m._id));
      return {
        _id: String(m._id),
        slug: m.slug,
        title: m.title,
        brief: m.brief,
        deliverable: m.deliverable,
        skills: m.skills || [],
        requiredPlan: m.requiredPlan,
        xpReward: m.xpReward,
        weekOf: m.weekOf || null,
        submissionsCount: m.submissionsCount || 0,
        unlocked,
        instructions: unlocked ? m.instructions : "",
        mySubmission: sub ? { status: sub.status, feedback: sub.feedback || "" } : null,
      };
    });

    return NextResponse.json({ missions: out, viewerPlan: plan });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
