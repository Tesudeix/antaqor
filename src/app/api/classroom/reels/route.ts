import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Lesson from "@/models/Lesson";
import Course from "@/models/Course";
import { effectivePlan } from "@/lib/planAccess";
import { hasPlanAccess, PLAN_RANK, isPlanId, type PlanId } from "@/lib/plans";

export const dynamic = "force-dynamic";

// youtube.com/shorts/<id> · watch?v=<id> · youtu.be/<id> · embed/<id>
function youtubeId(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/(?:shorts\/|watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/
  );
  return m ? m[1] : null;
}

/**
 * Reel feed of lessons: every lesson with a video, ordered free → paid tracks.
 * Business logic mirrors the classroom: lessons above the viewer's plan are
 * locked slides (no video URL leaves the server) that upsell the exact plan.
 */
export async function GET() {
  const { plan: viewerPlan, userId } = await effectivePlan();
  await dbConnect();

  const courses = await Course.find({ comingSoon: { $ne: true } })
    .select("title requiredPlan track createdAt")
    .lean();
  const courseById = new Map(
    courses.map((c) => [String(c._id), c as { title?: string; requiredPlan?: string }])
  );

  const lessons = await Lesson.find({
    videoUrl: { $nin: ["", null] },
    course: { $in: courses.map((c) => c._id) },
  })
    .sort({ order: 1, createdAt: 1 })
    .select("title videoUrl videoType thumbnail durationSec completedBy course")
    .lean();

  const items = lessons.map((l) => {
    const course = courseById.get(String(l.course));
    const requiredPlan: PlanId =
      course?.requiredPlan && isPlanId(course.requiredPlan) ? course.requiredPlan : "free";
    const locked = !hasPlanAccess(viewerPlan, requiredPlan);
    const yt = youtubeId(String(l.videoUrl));
    const completed = Boolean(
      userId &&
        (l.completedBy as unknown[] | undefined)?.some((id) => String(id) === String(userId))
    );
    return {
      id: String(l._id),
      title: l.title as string,
      courseId: String(l.course),
      courseTitle: course?.title ?? "",
      requiredPlan,
      locked,
      kind: locked ? "locked" : yt ? "youtube" : "file",
      youtubeId: locked ? null : yt,
      videoUrl: locked || yt ? null : (l.videoUrl as string),
      thumbnail: (l.thumbnail as string) || "",
      durationSec: (l.durationSec as number) || 0,
      completed,
      rank: PLAN_RANK[requiredPlan],
    };
  });

  // Free content first, then by plan tier — the natural upgrade ladder.
  items.sort((a, b) => a.rank - b.rank || a.courseId.localeCompare(b.courseId));

  return NextResponse.json({
    loggedIn: Boolean(userId),
    viewerPlan,
    items: items.map(({ rank: _rank, ...rest }) => rest),
  });
}
