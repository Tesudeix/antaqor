import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import TiktokTool from "@/components/TiktokTool";

/* TikTok → mp4. YouTube-ийн хэрэгслээс ялгаатай нь agent шаардахгүй:
   TikTok серверийн IP-г блоклодоггүй тул сервер өөрөө татна. */
export const dynamic = "force-dynamic";
export const metadata = { title: "TikTok → mp4" };

export default async function TiktokToolPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/");
  return <TiktokTool />;
}
