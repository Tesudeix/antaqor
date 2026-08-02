import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import Course from "@/models/Course";
import Lesson from "@/models/Lesson";
import Mission from "@/models/Mission";
import MissionSubmission from "@/models/MissionSubmission";
import Post from "@/models/Post";
import { isAdmin } from "@/lib/admin";
import type { PlanId } from "@/lib/plans";

export const dynamic = "force-dynamic";

// GET — everything the member dashboard needs in one round trip:
// next action (lesson), course progress, missions, level/streak, community.
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const userId = (session.user as { id: string }).id;

    await dbConnect();

    const user = await User.findById(userId)
      .select("name plan subscriptionExpiresAt role email level xp streakDays onboarding")
      .lean();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const u = user as unknown as {
      name: string; plan?: string; subscriptionExpiresAt?: Date; role?: string; email?: string;
      level?: number; xp?: number; streakDays?: number;
      onboarding?: { goal?: string; experience?: string; completedAt?: Date };
    };

    const now = new Date();
    const admin = u.role === "admin" || isAdmin(u.email);
    const subActive = !!(u.subscriptionExpiresAt && new Date(u.subscriptionExpiresAt) > now);
    const plan: PlanId = admin ? "operator" : subActive ? ((u.plan as PlanId) || "starter") : "free";

    // ─── Current course + next lesson ───
    // Free starter course = published free-track course with real lessons.
    const course = await Course.findOne({ requiredPlan: "free", comingSoon: { $ne: true } })
      .sort({ order: 1 })
      .select("title description outcome durationMin")
      .lean();

    let nextLesson: { _id: string; title: string; durationSec: number } | null = null;
    let lessonsTotal = 0;
    let lessonsDone = 0;
    if (course) {
      const lessons = await Lesson.find({ course: course._id })
        .sort({ order: 1 })
        .select("title durationSec completedBy")
        .lean();
      lessonsTotal = lessons.length;
      for (const l of lessons) {
        const done = (l.completedBy || []).some((id: unknown) => String(id) === userId);
        if (done) lessonsDone++;
        else if (!nextLesson) {
          nextLesson = { _id: String(l._id), title: l.title, durationSec: l.durationSec || 0 };
        }
      }
    }

    // ─── Missions ───
    const missions = await Mission.find({ status: "active" })
      .sort({ order: 1 })
      .select("slug title brief deliverable skills requiredPlan xpReward weekOf")
      .lean();
    const subs = await MissionSubmission.find({ user: userId })
      .select("mission status")
      .lean();
    const subByMission = new Map(subs.map((s) => [String(s.mission), s.status]));
    const missionsOut = missions.map((m) => ({
      ...m,
      _id: String(m._id),
      mySubmission: subByMission.get(String(m._id)) || null,
    }));

    // ─── Community pulse — 3 recent posts ───
    const posts = await Post.find({})
      .sort({ createdAt: -1 })
      .limit(3)
      .select("content author createdAt category")
      .populate("author", "name avatar")
      .lean();

    return NextResponse.json({
      user: {
        name: u.name,
        plan,
        level: u.level || 1,
        xp: u.xp || 0,
        streakDays: u.streakDays || 0,
        onboarded: !!u.onboarding?.completedAt,
      },
      course: course
        ? {
            _id: String(course._id),
            title: course.title,
            outcome: (course as { outcome?: string }).outcome || "",
            lessonsTotal,
            lessonsDone,
            progressPct: lessonsTotal ? Math.round((lessonsDone / lessonsTotal) * 100) : 0,
          }
        : null,
      nextLesson,
      missions: missionsOut,
      posts: posts.map((p) => ({
        _id: String(p._id),
        content: (p.content || "").slice(0, 120),
        category: p.category || "",
        createdAt: p.createdAt,
        author: p.author ? { name: (p.author as { name?: string }).name || "", avatar: (p.author as { avatar?: string }).avatar || "" } : null,
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
