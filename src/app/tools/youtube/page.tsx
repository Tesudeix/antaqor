import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import YoutubeTool from "@/components/YoutubeTool";

/* Нэвтэрсэн хүн бүрт. Татац нь ТЭДНИЙ ӨӨРИЙН машин дээр гүйдэг тул
   админд хаах шаардлага байхгүй болсон — өмнө нь ажил эзний хувийн
   компьютерт гүйдэг байсан учраас л хаалттай байв. Төлбөрийг кредит
   барина (админ/house хаяг үнэгүй — spendCredits өөрөө тооцдог). */
export const dynamic = "force-dynamic";
export const metadata = { title: "Холбоос → MP4 / MP3" };

export default async function YoutubeToolPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/");
  return <YoutubeTool />;
}
