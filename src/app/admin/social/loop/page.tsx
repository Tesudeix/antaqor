import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/adminAuth";
import ContentLoopAdmin from "@/components/admin/ContentLoopAdmin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Сайжруулах давталт" };

export default async function ContentLoopPage() {
  if (!(await getAdminSession())) redirect("/");
  return <ContentLoopAdmin />;
}
