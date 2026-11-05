import { notFound } from "next/navigation";
import { getAdminSession } from "@/lib/adminAuth";
import VpnClient from "./VpnClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "VPN — Antaqor" };

/* Сервер тал дээр хаана. Админ биш хүнд 404 буцаана — "эрх байхгүй" гэж
   хэлэх нь ч хэрэггүй: энэ хуудас байдаг гэдгийг мэдүүлэх шаардлагагүй. */
export default async function VpnPage() {
  const session = await getAdminSession();
  if (!session) notFound();
  return <VpnClient />;
}
