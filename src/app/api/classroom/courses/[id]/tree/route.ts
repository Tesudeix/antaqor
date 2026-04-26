import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Course from "@/models/Course";
import Section from "@/models/Section";
import Subsection from "@/models/Subsection";
import Lesson from "@/models/Lesson";
import LessonTask from "@/models/LessonTask";

// GET — flat 2-level tree:
//   course → sections[] → { lessons[], task? }
// Backwards-compat: lessons/tasks tied to a subsection are remapped
// to that subsection's parent section so legacy data still renders.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await dbConnect();
  const course = await Course.findById(id).lean();
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

  const [sections, subsections, lessons, tasks] = await Promise.all([
    Section.find({ course: id }).sort({ order: 1 }).lean(),
    Subsection.find({ course: id }).select("_id section").lean(),
    Lesson.find({ course: id }).sort({ order: 1 }).select(
      "_id title description section subsection videoUrl thumbnail order requiredLevel attachments"
    ).lean(),
    LessonTask.find({ course: id }).lean(),
  ]);

  // subsection→section lookup table for legacy data
  const subToSection = new Map<string, string>();
  subsections.forEach((s) => subToSection.set(String(s._id), String(s.section)));

  const resolveSectionId = (lesson: { section?: unknown; subsection?: unknown }): string | null => {
    if (lesson.section) return String(lesson.section);
    if (lesson.subsection) {
      const parentSec = subToSection.get(String(lesson.subsection));
      if (parentSec) return parentSec;
    }
    return null;
  };

  // Group lessons by section
  const lessonsBySection = new Map<string, typeof lessons>();
  for (const l of lessons) {
    const sid = resolveSectionId(l);
    if (!sid) continue;
    if (!lessonsBySection.has(sid)) lessonsBySection.set(sid, []);
    lessonsBySection.get(sid)!.push(l);
  }

  // Pick task per section (one section → one task)
  const taskBySection = new Map<string, (typeof tasks)[number]>();
  for (const t of tasks) {
    const sid = resolveSectionId(t);
    if (!sid) continue;
    // Prefer most-recent if multiple
    const existing = taskBySection.get(sid);
    if (!existing || +new Date(t.createdAt) > +new Date(existing.createdAt)) {
      taskBySection.set(sid, t);
    }
  }

  const tree = sections.map((sec) => ({
    ...sec,
    lessons: lessonsBySection.get(String(sec._id)) || [],
    task: taskBySection.get(String(sec._id)) || null,
  }));

  // Orphan lessons that aren't tied to any section (or section was deleted)
  const orphanLessons = lessons.filter((l) => {
    const sid = resolveSectionId(l);
    return !sid || !sections.find((s) => String(s._id) === sid);
  });

  return NextResponse.json({ course, sections: tree, orphanLessons });
}
