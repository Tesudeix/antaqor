import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Course from "@/models/Course";
import Section from "@/models/Section";
import Subsection from "@/models/Subsection";
import Lesson from "@/models/Lesson";
import LessonTask from "@/models/LessonTask";

// GET — flat 2-level tree with per-lesson tasks:
//   course → sections[] → lessons[] → { task? }
// Legacy: section/subsection-tied tasks render at section level
// (admin can no longer create them, but old data stays visible).
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

  const resolveSectionId = (item: { section?: unknown; subsection?: unknown }): string | null => {
    if (item.section) return String(item.section);
    if (item.subsection) {
      const parentSec = subToSection.get(String(item.subsection));
      if (parentSec) return parentSec;
    }
    return null;
  };

  // Per-lesson tasks (active model)
  const taskByLesson = new Map<string, (typeof tasks)[number]>();
  // Per-section legacy tasks (no lesson ref)
  const legacyTaskBySection = new Map<string, (typeof tasks)[number]>();
  for (const t of tasks) {
    if (t.lesson) {
      const lid = String(t.lesson);
      const existing = taskByLesson.get(lid);
      if (!existing || +new Date(t.createdAt) > +new Date(existing.createdAt)) {
        taskByLesson.set(lid, t);
      }
      continue;
    }
    const sid = resolveSectionId(t);
    if (!sid) continue;
    const existing = legacyTaskBySection.get(sid);
    if (!existing || +new Date(t.createdAt) > +new Date(existing.createdAt)) {
      legacyTaskBySection.set(sid, t);
    }
  }

  // Attach task to each lesson
  const lessonsWithTask = lessons.map((l) => ({
    ...l,
    task: taskByLesson.get(String(l._id)) || null,
  }));

  // Group lessons by section
  const lessonsBySection = new Map<string, typeof lessonsWithTask>();
  for (const l of lessonsWithTask) {
    const sid = resolveSectionId(l);
    if (!sid) continue;
    if (!lessonsBySection.has(sid)) lessonsBySection.set(sid, []);
    lessonsBySection.get(sid)!.push(l);
  }

  const tree = sections.map((sec) => ({
    ...sec,
    lessons: lessonsBySection.get(String(sec._id)) || [],
    legacyTask: legacyTaskBySection.get(String(sec._id)) || null,
  }));

  // Orphan lessons that aren't tied to any section (or section was deleted)
  const orphanLessons = lessonsWithTask.filter((l) => {
    const sid = resolveSectionId(l);
    return !sid || !sections.find((s) => String(s._id) === sid);
  });

  return NextResponse.json({ course, sections: tree, orphanLessons });
}
