import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Course from "@/models/Course";
import Section from "@/models/Section";
import Subsection from "@/models/Subsection";
import Lesson from "@/models/Lesson";
import LessonTask from "@/models/LessonTask";

// GET — return the full nested tree for a single course
//   course → sections[] → subsections[] → { lessons[], task? }
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await dbConnect();
  const course = await Course.findById(id).lean();
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

  const [sections, subsections, lessons, tasks] = await Promise.all([
    Section.find({ course: id }).sort({ order: 1 }).lean(),
    Subsection.find({ course: id }).sort({ order: 1 }).lean(),
    Lesson.find({ course: id }).sort({ order: 1 }).select(
      "_id title description subsection videoUrl thumbnail order requiredLevel attachments"
    ).lean(),
    LessonTask.find({ course: id }).lean(),
  ]);

  // Build nested tree
  const tasksBySubsection = new Map<string, typeof tasks[number]>();
  tasks.forEach((t) => tasksBySubsection.set(String(t.subsection), t));

  const lessonsBySubsection = new Map<string, typeof lessons>();
  lessons.forEach((l) => {
    const k = String(l.subsection || "");
    if (!k) return;
    if (!lessonsBySubsection.has(k)) lessonsBySubsection.set(k, []);
    lessonsBySubsection.get(k)!.push(l);
  });

  const subsBySection = new Map<string, typeof subsections>();
  subsections.forEach((s) => {
    const k = String(s.section);
    if (!subsBySection.has(k)) subsBySection.set(k, []);
    subsBySection.get(k)!.push(s);
  });

  const tree = sections.map((sec) => {
    const subs = (subsBySection.get(String(sec._id)) || []).map((sub) => ({
      ...sub,
      lessons: lessonsBySubsection.get(String(sub._id)) || [],
      task: tasksBySubsection.get(String(sub._id)) || null,
    }));
    return { ...sec, subsections: subs };
  });

  // Orphan lessons that aren't tied to a subsection (legacy / pre-migration)
  const orphanLessons = lessons.filter((l) => !l.subsection);

  return NextResponse.json({ course, sections: tree, orphanLessons });
}
