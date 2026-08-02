import type { Metadata } from "next";
import LessonReels from "@/components/LessonReels";

export const metadata: Metadata = {
  title: "Reel хичээл — Antaqor",
  description: "60 секундын богино AI хичээлүүд — скролл хийгээд л сур.",
};

export default function ReelsPage() {
  return <LessonReels />;
}
