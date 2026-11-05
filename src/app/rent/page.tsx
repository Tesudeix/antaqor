import type { Metadata } from "next";
import RentApp from "@/components/RentApp";

export const metadata: Metadata = {
  /* `absolute` нь эх layout-ийн "%s | Antaqor" загварыг давна. /rent нь
     тусдаа бүтээгдэхүүн тул таб дээр "… | Antaqor" гэж гарах нь утгагүй. */
  title: { absolute: "UB Rent — Улаанбаатарын түрээс" },
  description: "Улаанбаатарын түрээсийн байр. Очихоосоо өмнө дижиталаар шалга — бодит сарын зардал, зам, нар, дуу чимээ.",
};

export default function RentPage() {
  return <RentApp />;
}
