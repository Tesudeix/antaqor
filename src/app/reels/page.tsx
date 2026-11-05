import type { Metadata } from "next";
import ClientReels from "@/components/ClientReels";

/* 2026-10-01: `/reels` нь КЛИЕНТЭД хийсэн AI видеоны тэжээл боллоо.
   Өмнөх хичээлийн reel нь /classroom/reels руу нүүсэн. */
export const metadata: Metadata = {
  title: "Reels — Antaqor",
  description: "Клиентүүдэд хийсэн AI видео. Скролл хийгээд үз, шууд тат.",
};

export default function ReelsPage() {
  return <ClientReels />;
}
