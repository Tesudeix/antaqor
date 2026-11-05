import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import DeskApp from "@/components/trader/DeskApp";
import LoginCard from "@/components/LoginCard";

/* trader.antaqor.com/4 — шинжилгээний ширээ (v7, 2026-11-06). Бусад хувилбартай харьцуулж байна.
   Зөвхөн trader хост дээр: middleware `keep`-д /4, бусад хостоос энд 307. */
export const dynamic = "force-dynamic";
export const metadata = { title: "Tesla Trader · Шинжилгээний ширээ", description: "Олон хугацааны бүтэц, стратеги, нөхцөлт төлөвлөгөө — түүхэн хэмжилттэй." };

export default async function DeskPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return (
      <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 16 }}>
        <div style={{ width: "100%", maxWidth: 420 }}>
          <LoginCard next="/4" heading="Tesla Trader" subtitle="Antaqor бүртгэлээрээ нэвтэрнэ үү" />
        </div>
      </main>
    );
  }
  return <DeskApp />;
}
