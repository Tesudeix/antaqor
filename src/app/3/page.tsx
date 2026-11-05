import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import FiveApp from "@/components/trader/FiveApp";
import LoginCard from "@/components/LoginCard";

/* trader.antaqor.com/3 — 5 SCAN (v6, 2026-11-05). «/» (v4) ба «/2» (v5)-тай харьцуулж байна.
   Зөвхөн trader хост дээр: middleware `keep`-д /3, бусад хостоос энд 307. */
export const dynamic = "force-dynamic";
export const metadata = { title: "Tesla Trader · 5 Scan", description: "Алтыг таван өөр аргаар зэрэг сканнердаж, дундаж ба санал нийлэлтийг хэмжсэн тоотой нь харуулна." };

export default async function FivePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return (
      <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 16 }}>
        <div style={{ width: "100%", maxWidth: 420 }}>
          <LoginCard next="/3" heading="Tesla Trader" subtitle="Antaqor бүртгэлээрээ нэвтэрнэ үү" />
        </div>
      </main>
    );
  }
  return <FiveApp />;
}
