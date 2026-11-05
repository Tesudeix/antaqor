import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import GoldApp from "@/components/trader/GoldApp";
import LoginCard from "@/components/LoginCard";

/* trader.antaqor.com/2 — алтны хувилбар (v5, 2026-11-05). Эзэн «/» дээрх v4 скальп терминалтай харьцуулж байна.
   Зөвхөн trader хост дээр: middleware `keep`-д /2, бусад хостоос энд 307. */
export const dynamic = "force-dynamic";
export const metadata = { title: "Tesla Trader · XAU/USD", description: "Алтны бодит цагийн квант шинжилгээ — 86 онцлог, сигналыг шуугианаас ялгаж, walk-forward-оор шалгасан модель." };

export default async function GoldPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return (
      <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 16 }}>
        <div style={{ width: "100%", maxWidth: 420 }}>
          <LoginCard next="/2" heading="Tesla Trader" subtitle="Antaqor бүртгэлээрээ нэвтэрнэ үү" />
        </div>
      </main>
    );
  }
  return <GoldApp />;
}
