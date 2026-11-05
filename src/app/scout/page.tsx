import type { Metadata } from "next";
import ScoutPrompt from "@/components/ScoutPrompt";

/* ─── /scout — нэвтэрсэн хүнд зориулсан хаяг ──────────────────────────────
   Нүүр хуудас нэвтэрсэн хэрэглэгчид ЗӨВХӨН урсгал үзүүлдэг (src/app/page.tsx
   доторх шийдвэр — гишүүн болчихсон хүнд элсүүлэх зурвас харуулах нь түүний
   хайж байгаа зүйлийг нуана). Тиймээс Scout-ыг тэнд шахахгүй, өөрийн хаягтай
   болголоо. Зочин нүүрэн дээрээ, гишүүн энд ашиглана — нэг л компонент.   */

export const metadata: Metadata = {
  title: "Korean Food Scout · Antaqor",
  description:
    "Улаанбаатарын солонгос хоолны газраас төсөв, дүүрэг, хүний тоонд тохирохыг нь 30 секундэд ол.",
};

export default function ScoutPage() {
  return <ScoutPrompt />;
}
