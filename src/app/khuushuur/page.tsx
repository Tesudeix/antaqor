import type { Metadata } from "next";
import KhuushuurClient from "@/components/khuushuur/KhuushuurClient";

export const metadata: Metadata = {
  title: "Тал Хуушуур — Хүргэлтийн меню",
  description: "Шарсан даруйд нь халуунаар хүргэнэ. Үхэр, хонины махтай хуушуур, багц, шөл, хачир — QPay-ээр төлнө.",
  alternates: { canonical: "https://antaqor.com/khuushuur" },
  openGraph: { title: "Тал Хуушуур", description: "Хуушуур хүргэлт — QPay-ээр захиал.", url: "https://antaqor.com/khuushuur", type: "website" },
};

export default function KhuushuurPage() {
  return <KhuushuurClient />;
}
