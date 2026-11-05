import type { Metadata } from "next";
import Circles from "@/components/Circles";

export const metadata: Metadata = {
  title: "Хүрээлэл",
  description: "Antaqor доторх хүрээллүүд — өөрийн бүлгээ сонгож, тэндээ бүтээ.",
};

export default function CirclesPage() {
  return <Circles />;
}
