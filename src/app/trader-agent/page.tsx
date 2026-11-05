import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import DeskApp from "@/components/trader/DeskApp";
import LoginCard from "@/components/LoginCard";
import { headers } from "next/headers";

/* Tesla Trader (2026-10-25) — нэвтэрсэн гишүүдэд. v7 (2026-11-06): шинжилгээний ширээ үндсэн хуудас, v4 нь /1 дээр. */
export const dynamic = "force-dynamic";
export const metadata = { title: "Tesla Trader · Шинжилгээний ширээ", description: "Олон хугацааны бүтэц, стратеги, нөхцөлт төлөвлөгөө — түүхэн хэмжилттэй." };

export default async function TraderAgentPage() {
  const session = await getServerSession(authOptions);
  /* trader.antaqor.com дээр "/" нь энэ хуудас тул "/" руу буцаавал гогцоо болно —
     нэвтрээгүй хүнд нэвтрэх картыг энд л үзүүлнэ. */
  if (!session?.user) {
    const onTrader = ((await headers()).get("host") || "").startsWith("trader.");
    return (
      <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 16 }}>
        <div style={{ width: "100%", maxWidth: 420 }}>
          <LoginCard next={onTrader ? "/" : "/trader-agent"} heading="Tesla Trader" subtitle="Antaqor бүртгэлээрээ нэвтэрнэ үү" />
        </div>
      </main>
    );
  }
  return <DeskApp />;
}
