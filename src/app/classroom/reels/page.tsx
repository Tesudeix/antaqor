import type { Metadata } from "next";
import LessonReels from "@/components/LessonReels";

/* 2026-10-01: `/reels` нь КЛИЕНТИЙН видео хүргэлт болсон тул хичээлийн
   reel ЭНД нүүв. Логик нь хэвээр — зөвхөн зам, API-ийн хаяг өөрчлөгдсөн. */
export const metadata: Metadata = {
  title: "Reel хичээл — Antaqor",
  description: "60 секундын богино AI хичээлүүд — скролл хийгээд л сур.",
};

export default function ClassroomReelsPage() {
  return <LessonReels />;
}
