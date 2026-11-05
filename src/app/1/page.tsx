import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import TraderApp from "@/components/trader/TraderApp";
import LoginCard from "@/components/LoginCard";

/* trader.antaqor.com/1 — v4 скальп терминал, харьцуулалтад үлдсэн (2026-11-06-наас «/» нь v7).
   Зөвхөн trader хост дээр: middleware `keep`-д /1, бусад хостоос энд 307. */
export const dynamic = "force-dynamic";
export const metadata = { title: "Tesla Trader · Scalp", description: "Валют, алт, криптогийн бодит цагийн скальп терминал — шүүлтүүр, горим, хэмжсэн давуу тал, журнал." };

export default async function ScalpPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return (
      <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 16 }}>
        <div style={{ width: "100%", maxWidth: 420 }}>
          <LoginCard next="/1" heading="Tesla Trader" subtitle="Antaqor бүртгэлээрээ нэвтэрнэ үү" />
        </div>
      </main>
    );
  }
  return <TraderApp />;
}
